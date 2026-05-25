/**
 * Supabase → PocketBase compatibility shim.
 *
 * This wrapper mimics a subset of the @supabase/supabase-js API so that
 * existing code that imports `supabase` keeps working while we migrate
 * the data layer to PocketBase.
 *
 * Known limitations:
 *  - No automatic joins (`select("*, relation(*)")` — relation part is ignored;
 *    use PocketBase `expand` directly when needed).
 *  - `supabase.rpc()` returns "not implemented" — replace call sites manually.
 *  - Edge functions (`supabase.functions.invoke`) return an error — the four
 *    edge functions (ai-chat, check-subscription, create-checkout,
 *    customer-portal) must be rewritten as PocketBase hooks or external services.
 *  - Storage API is a thin wrapper around a PocketBase "files" collection.
 */
import { ClientResponseError } from "pocketbase";
import { pb } from "./client";

type Row = Record<string, any>;

type QueryResult = { data: any; error: any; count: number | null };

// ---------------------------------------------------------------------------
// Field name translation: app (Supabase convention) <-> PocketBase storage.
// Keys = name used in app code; values = real column name in PocketBase.
// ---------------------------------------------------------------------------
const APP_TO_PB: Record<string, string> = {
  created_at: "created",
  updated_at: "updated",
  has_mutual: "mutuelle",
  remaining_sessions: "seances_restantes",
  // PocketBase's auth relation is conventionally named `user`,
  // while the app uses Supabase's `user_id` everywhere.
  user_id: "user",
};
const PB_TO_APP: Record<string, string> = Object.fromEntries(
  Object.entries(APP_TO_PB).map(([k, v]) => [v, k])
);

/**
 * Explicit value mapping for PocketBase Select fields.
 * The app uses English/snake_case values; PocketBase stores French
 * capitalised labels. Lookup is case-insensitive on the source value.
 */
const PB_VALUE_MAP: Record<string, Record<string, string>> = {
  prescription: { none: "Non", non: "Non", yes: "Oui", oui: "Oui", no: "Non" },
  status: {
    active: "Actif",
    actif: "Actif",
    inactive: "Inactif",
    inactif: "Inactif",
    waiting: "En attente",
    en_traitement: "En traitement",
  },
};

function mapSelectValue(pbField: string, value: any): any {
  const dict = PB_VALUE_MAP[pbField];
  if (!dict || typeof value !== "string") return value;
  return dict[value] ?? dict[value.toLowerCase()] ?? value;
}

/** App field name → PocketBase column name. */
function toPb(field: string): string {
  return APP_TO_PB[field] ?? field;
}
/** PocketBase column name → app field name. */
function fromPb(field: string): string {
  return PB_TO_APP[field] ?? field;
}
/** Translate a write payload from app → PocketBase. */
function mapPayloadToPb(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const pbKey = toPb(k);
    out[pbKey] = pbKey in PB_VALUE_MAP ? mapSelectValue(pbKey, v) : v;
  }
  return out;
}
/** Translate a single record (or null) from PocketBase → app. */
function mapRecordFromPb<T extends Row | null | undefined>(rec: T): T {
  if (!rec || typeof rec !== "object") return rec;
  const out: Row = {};
  for (const [k, v] of Object.entries(rec)) {
    out[fromPb(k)] = v;
  }
  return out as T;
}
/** Translate a list of records from PocketBase → app. */
function mapRecordsFromPb(items: any[]): any[] {
  return items.map((r) => mapRecordFromPb(r));
}
/** Rewrite a PocketBase filter expression string, replacing app field names. */
function translateFilterExpr(expr: string): string {
  let out = expr;
  for (const [app, pb] of Object.entries(APP_TO_PB)) {
    // word-boundary replace so we don't touch substrings inside values
    out = out.replace(new RegExp(`\\b${app}\\b`, "g"), pb);
  }
  return out;
}

function pbErrorToSupabase(err: unknown): { message: string; code?: string; details?: string } {
  if (err instanceof ClientResponseError) {
    // PocketBase wraps field-level errors in err.data.data — surface them
    // so the UI shows the actual reason (e.g. "users.name: field is required"
    // or "Only superusers can perform this request") instead of the generic
    // "Something went wrong while processing your request." message.
    const data: any = err.data ?? {};
    const fieldErrors = data?.data && typeof data.data === "object" ? data.data : null;
    let message = data?.message || err.message;
    if (fieldErrors) {
      const parts = Object.entries(fieldErrors).map(([field, info]: [string, any]) => {
        const msg = info?.message ?? JSON.stringify(info);
        return `${field}: ${msg}`;
      });
      if (parts.length) message = `${message} — ${parts.join("; ")}`;
    }
    if (err.status === 403 || err.status === 401) {
      message = `${message} (status ${err.status} — vérifier les règles d'accès de la collection "${(err as any).url ?? ""}" sur PocketBase)`;
    }
    if (err.status === 404) {
      message = `${message} (404 — collection ou enregistrement introuvable)`;
    }
    // Log full payload to console for deeper debugging
    console.error("[PocketBase error]", err.status, err.url, data);
    return {
      message,
      code: String(err.status),
      details: JSON.stringify(data),
    };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}

function escapeFilterValue(v: any): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return `"${v.toISOString()}"`;
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

type Filter = { op: string; col: string; val: any };

class QueryBuilder {
  private filters: Filter[] = [];
  private orderBy: string[] = [];
  private limitN: number | null = null;
  private offsetN: number = 0;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private selectFields: string = "";
  private expandFields: string = "";
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private returning: boolean = false;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(private collection: string) {}

  select(fields: string = "*", _opts?: { count?: string; head?: boolean }): this {
    // Strip relation joins like "*, profiles(name)" — keep only top-level fields.
    const top = fields
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f && !f.includes("("));
    // Translate app field names → PocketBase column names for the `fields` param.
    this.selectFields =
      top.includes("*") || top.length === 0
        ? ""
        : top.map((f) => toPb(f)).join(",");
    if (this.mode !== "insert" && this.mode !== "update" && this.mode !== "upsert" && this.mode !== "delete") {
      this.mode = "select";
    } else {
      this.returning = true;
    }
    return this;
  }

  insert(data: Row | Row[]): this {
    this.mode = "insert";
    this.payload = data;
    return this;
  }

  update(data: Row): this {
    this.mode = "update";
    this.payload = data;
    return this;
  }

  upsert(data: Row | Row[], _opts?: any): this {
    this.mode = "upsert";
    this.payload = data;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  eq(col: string, val: any): this { this.filters.push({ op: "=", col, val }); return this; }
  neq(col: string, val: any): this { this.filters.push({ op: "!=", col, val }); return this; }
  gt(col: string, val: any): this { this.filters.push({ op: ">", col, val }); return this; }
  gte(col: string, val: any): this { this.filters.push({ op: ">=", col, val }); return this; }
  lt(col: string, val: any): this { this.filters.push({ op: "<", col, val }); return this; }
  lte(col: string, val: any): this { this.filters.push({ op: "<=", col, val }); return this; }
  like(col: string, val: string): this { this.filters.push({ op: "~", col, val: val.replace(/%/g, "") }); return this; }
  ilike(col: string, val: string): this { return this.like(col, val); }
  is(col: string, val: any): this {
    if (val === null) this.filters.push({ op: "=", col, val: null });
    else this.filters.push({ op: "=", col, val });
    return this;
  }
  in(col: string, vals: any[]): this { this.filters.push({ op: "in", col, val: vals }); return this; }
  contains(col: string, vals: any): this {
    const arr = Array.isArray(vals) ? vals : [vals];
    arr.forEach((v) => this.filters.push({ op: "~", col, val: v }));
    return this;
  }
  or(expr: string): this { this.filters.push({ op: "raw", col: "", val: `(${expr.replace(/\.eq\./g, " = ").replace(/,/g, " || ")})` }); return this; }
  not(col: string, op: string, val: any): this {
    const inv = op === "is" ? "!=" : `!${op}`;
    this.filters.push({ op: inv, col, val });
    return this;
  }
  filter(col: string, op: string, val: any): this { this.filters.push({ op, col, val }); return this; }
  match(criteria: Row): this {
    Object.entries(criteria).forEach(([k, v]) => this.eq(k, v));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    const prefix = opts?.ascending === false ? "-" : "+";
    this.orderBy.push(`${prefix}${toPb(col)}`);
    return this;
  }
  limit(n: number): this { this.limitN = n; return this; }
  range(from: number, to: number): this { this.rangeFrom = from; this.rangeTo = to; return this; }
  single(): this { this.singleMode = "single"; return this; }
  maybeSingle(): this { this.singleMode = "maybe"; return this; }

  private buildFilter(): string {
    return this.filters
      .map((f) => {
        if (f.op === "raw") return translateFilterExpr(String(f.val));
        const col = toPb(f.col);
        if (f.op === "in") {
          const arr = f.val as any[];
          if (arr.length === 0) return `${col} = "__never__"`;
          return "(" + arr.map((v) => `${col} = ${escapeFilterValue(v)}`).join(" || ") + ")";
        }
        if (f.val === null) {
          return f.op === "=" ? `${col} = null` : `${col} != null`;
        }
        return `${col} ${f.op} ${escapeFilterValue(f.val)}`;
      })
      .join(" && ");
  }

  private async exec(): Promise<QueryResult> {
    try {
      const coll = pb.collection(this.collection);

      if (this.mode === "select") {
        const filter = this.buildFilter() || undefined;
        const sort = this.orderBy.length ? this.orderBy.join(",") : undefined;
        const fields = this.selectFields || undefined;

        if (this.singleMode !== "none") {
          try {
            const item = await coll.getFirstListItem(filter ?? "", { sort, fields });
            return { data: mapRecordFromPb(item), error: null, count: 1 };
          } catch (e) {
            if (e instanceof ClientResponseError && e.status === 404) {
              if (this.singleMode === "maybe") return { data: null, error: null, count: 0 };
              return { data: null, error: pbErrorToSupabase(e), count: 0 };
            }
            throw e;
          }
        }

        if (this.limitN !== null || this.rangeFrom !== null) {
          const perPage = this.limitN ?? ((this.rangeTo ?? 0) - (this.rangeFrom ?? 0) + 1);
          const page = this.rangeFrom !== null ? Math.floor(this.rangeFrom / perPage) + 1 : 1;
          const res = await coll.getList(page, perPage, { filter, sort, fields });
          return { data: mapRecordsFromPb(res.items), error: null, count: res.totalItems };
        }

        const items = await coll.getFullList({ filter, sort, fields, batch: 500 });
        return { data: mapRecordsFromPb(items), error: null, count: items.length };
      }

      if (this.mode === "insert" || this.mode === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created: any[] = [];
        const currentUserId =
          (pb.authStore as any).record?.id ?? (pb.authStore as any).model?.id ?? null;
        for (const row of rows) {
          // Strip undefined fields
          const clean: Row = {};
          Object.entries(row).forEach(([k, v]) => { if (v !== undefined) clean[k] = v; });
          // Auto-inject the authenticated user id when not provided and
          // we're not writing to the users collection itself.
          if (
            currentUserId &&
            this.collection !== "users" &&
            clean.user === undefined &&
            clean.user_id === undefined
          ) {
            clean.user = currentUserId;
          }
          const rec = await coll.create(mapPayloadToPb(clean));
          created.push(mapRecordFromPb(rec));
        }
        if (this.singleMode !== "none") return { data: created[0] ?? null, error: null, count: created.length };
        return { data: this.returning || this.selectFields ? created : null, error: null, count: created.length };
      }

      if (this.mode === "update") {
        const filter = this.buildFilter();
        if (!filter) return { data: null, error: { message: "UPDATE without filter is forbidden" }, count: 0 };
        const matches = await coll.getFullList({ filter, batch: 500 });
        const clean: Row = {};
        Object.entries(this.payload as Row).forEach(([k, v]) => { if (v !== undefined) clean[k] = v; });
        const pbPayload = mapPayloadToPb(clean);
        const updated: any[] = [];
        for (const m of matches) {
          const rec = await coll.update(m.id, pbPayload);
          updated.push(mapRecordFromPb(rec));
        }
        if (this.singleMode !== "none") return { data: updated[0] ?? null, error: null, count: updated.length };
        return { data: this.returning || this.selectFields ? updated : null, error: null, count: updated.length };
      }

      if (this.mode === "delete") {
        const filter = this.buildFilter();
        if (!filter) return { data: null, error: { message: "DELETE without filter is forbidden" }, count: 0 };
        const matches = await coll.getFullList({ filter, batch: 500 });
        for (const m of matches) {
          await coll.delete(m.id);
        }
        return { data: null, error: null, count: matches.length };
      }

      return { data: null, error: { message: `Unknown mode ${this.mode}` }, count: 0 };
    } catch (e) {
      return { data: null, error: pbErrorToSupabase(e), count: 0 };
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled as any, onrejected as any) as Promise<TResult1 | TResult2>;
  }
  catch<R = never>(onrejected?: ((r: any) => R | PromiseLike<R>) | null): Promise<any> {
    return this.exec().catch(onrejected as any) as any;
  }
}

// ===== Auth shim =====

type AuthChangeCallback = (event: string, session: any) => void;
const authListeners = new Set<AuthChangeCallback>();

function currentSession() {
  const model = (pb.authStore as any).record ?? (pb.authStore as any).model;
  if (!pb.authStore.isValid || !model) return null;
  return {
    access_token: pb.authStore.token,
    refresh_token: pb.authStore.token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 0,
    user: mapRecordFromPb(model),
  };
}

pb.authStore.onChange(() => {
  const sess = currentSession();
  const event = sess ? "SIGNED_IN" : "SIGNED_OUT";
  authListeners.forEach((cb) => cb(event, sess));
}, false);

const authApi = {
  async getSession() {
    return { data: { session: currentSession() }, error: null };
  },
  async getUser() {
    const rec = (pb.authStore as any).record ?? (pb.authStore as any).model;
    if (!pb.authStore.isValid || !rec) {
      return { data: { user: null }, error: null };
    }
    return { data: { user: mapRecordFromPb(rec) }, error: null };
  },
  onAuthStateChange(cb: AuthChangeCallback) {
    authListeners.add(cb);
    // Fire initial state asynchronously (matches Supabase behavior)
    queueMicrotask(() => cb(currentSession() ? "INITIAL_SESSION" : "INITIAL_SESSION", currentSession()));
    return {
      data: {
        subscription: {
          unsubscribe: () => { authListeners.delete(cb); },
        },
      },
    };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const auth = await pb.collection("users").authWithPassword(email, password);
      return { data: { user: mapRecordFromPb(auth.record as any), session: currentSession() }, error: null };
    } catch (e) {
      return { data: { user: null, session: null }, error: pbErrorToSupabase(e) };
    }
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    try {
      const meta = options?.data ?? {};
      // Map Supabase-style metadata to PocketBase default `users` collection fields.
      // PocketBase's built-in users collection has: email, password, passwordConfirm,
      // username, name, avatar, emailVisibility, verified.
      // Custom fields (pseudo, first_name, last_name) are forwarded only if present —
      // PocketBase will reject unknown fields, so we also expose `name` (full name)
      // and `username` derived from the pseudo when provided.
      const payload: Record<string, any> = {
        email,
        password,
        passwordConfirm: password,
        emailVisibility: true,
      };

      const firstName = meta.first_name ?? meta.firstName;
      const lastName = meta.last_name ?? meta.lastName;
      const pseudo = meta.pseudo;

      if (pseudo) {
        payload.pseudo = pseudo;
        // PocketBase requires `username` to be 3-150 chars, alphanumeric + _-.
        payload.username = String(pseudo).toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 150);
      }
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (fullName) payload.name = fullName;

      // Forward any other metadata fields verbatim (caller's responsibility
      // to ensure they exist on the PocketBase users collection).
      for (const [k, v] of Object.entries(meta)) {
        if (["first_name", "firstName", "last_name", "lastName", "pseudo"].includes(k)) continue;
        if (v !== undefined && !(k in payload)) payload[k] = v;
      }

      let rec;
      try {
        rec = await pb.collection("users").create(payload);
      } catch (e) {
        // Retry without optional custom fields if PocketBase complains about unknown columns.
        if (e instanceof ClientResponseError && e.status === 400) {
          const minimal: Record<string, any> = {
            email,
            password,
            passwordConfirm: password,
            emailVisibility: true,
          };
          if (payload.username) minimal.username = payload.username;
          if (payload.name) minimal.name = payload.name;
          rec = await pb.collection("users").create(minimal);
        } else {
          throw e;
        }
      }
      try {
        await pb.collection("users").requestVerification(email);
      } catch {}
      // Auto sign in after signup (PocketBase doesn't auto-confirm by default — adjust if needed)
      try {
        await pb.collection("users").authWithPassword(email, password);
      } catch {}
      return { data: { user: rec, session: currentSession() }, error: null };
    } catch (e) {
      return { data: { user: null, session: null }, error: pbErrorToSupabase(e) };
    }
  },
  async signOut(_opts?: { scope?: string }) {
    pb.authStore.clear();
    return { error: null };
  },
  async resetPasswordForEmail(email: string, _opts?: { redirectTo?: string }) {
    try {
      await pb.collection("users").requestPasswordReset(email);
      return { data: {}, error: null };
    } catch (e) {
      return { data: null, error: pbErrorToSupabase(e) };
    }
  },
  async updateUser(attrs: any) {
    try {
      const id = pb.authStore.record?.id;
      if (!id) return { data: { user: null }, error: { message: "Not authenticated" } };
      const rec = await pb.collection("users").update(id, attrs);
      return { data: { user: rec }, error: null };
    } catch (e) {
      return { data: { user: null }, error: pbErrorToSupabase(e) };
    }
  },
};

// ===== Storage shim (very thin) =====

const storageApi = {
  from(_bucket: string) {
    return {
      async upload(_path: string, _file: File | Blob, _opts?: any) {
        return { data: null, error: { message: "supabase.storage.upload is not supported in PocketBase migration. Use pb.collection('videos').create(FormData) directly." } };
      },
      getPublicUrl(_path: string) {
        return { data: { publicUrl: "" } };
      },
      async remove(_paths: string[]) {
        return { data: null, error: null };
      },
      async list(_path?: string, _opts?: any) {
        return { data: [], error: null };
      },
      async download(_path: string) {
        return { data: null, error: { message: "download not supported" } };
      },
      async createSignedUploadUrl(_path: string) {
        return { data: null, error: { message: "signed upload not supported" } };
      },
      async createSignedUrl(_path: string, _expiresIn: number) {
        return { data: null, error: { message: "createSignedUrl not supported" } };
      },
    };
  },
};

// ===== Functions shim =====

const functionsApi = {
  async invoke(name: string, _opts?: any) {
    console.warn(`[compat] supabase.functions.invoke("${name}") called — edge functions are not available in PocketBase self-hosted mode.`);
    return { data: null, error: { message: `Edge function "${name}" non disponible en mode self-hosted PocketBase.` } };
  },
};

// ===== Top-level export =====

// RPC returns a thenable so callers can chain .maybeSingle() / .single()
class RpcResult {
  constructor(private name: string) {}
  single() { return this; }
  maybeSingle() { return this; }
  private async exec(): Promise<QueryResult> {
    console.warn(`[compat] supabase.rpc("${this.name}") called — not implemented.`);
    return { data: null, error: { message: `RPC "${this.name}" non disponible.` }, count: 0 };
  }
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled as any, onrejected as any) as Promise<TResult1 | TResult2>;
  }
}

export const supabase = {
  from(collection: string) {
    return new QueryBuilder(collection);
  },
  auth: authApi,
  storage: storageApi,
  functions: functionsApi,
  rpc(name: string, _params?: any) {
    return new RpcResult(name);
  },
  channel(_name: string) {
    // Realtime stub — wrap PocketBase subscriptions
    const subs: Array<() => void> = [];
    return {
      on(_event: string, _filter: any, _cb: any) { return this; },
      subscribe(_cb?: any) { return this; },
      unsubscribe() { subs.forEach((u) => u()); return Promise.resolve("ok"); },
    };
  },
  removeChannel(_ch: any) { /* no-op */ },
};

export type SupabaseShim = typeof supabase;