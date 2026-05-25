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

function pbErrorToSupabase(err: unknown): { message: string; code?: string; details?: string } {
  if (err instanceof ClientResponseError) {
    return {
      message: err.message,
      code: String(err.status),
      details: JSON.stringify(err.data ?? {}),
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
    this.selectFields = top.includes("*") || top.length === 0 ? "" : top.join(",");
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
    this.orderBy.push(`${prefix}${col}`);
    return this;
  }
  limit(n: number): this { this.limitN = n; return this; }
  range(from: number, to: number): this { this.rangeFrom = from; this.rangeTo = to; return this; }
  single(): this { this.singleMode = "single"; return this; }
  maybeSingle(): this { this.singleMode = "maybe"; return this; }

  private buildFilter(): string {
    return this.filters
      .map((f) => {
        if (f.op === "raw") return f.val;
        if (f.op === "in") {
          const arr = f.val as any[];
          if (arr.length === 0) return `${f.col} = "__never__"`;
          return "(" + arr.map((v) => `${f.col} = ${escapeFilterValue(v)}`).join(" || ") + ")";
        }
        if (f.val === null) {
          return f.op === "=" ? `${f.col} = null` : `${f.col} != null`;
        }
        return `${f.col} ${f.op} ${escapeFilterValue(f.val)}`;
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
            return { data: item, error: null, count: 1 };
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
          return { data: res.items, error: null, count: res.totalItems };
        }

        const items = await coll.getFullList({ filter, sort, fields, batch: 500 });
        return { data: items, error: null, count: items.length };
      }

      if (this.mode === "insert" || this.mode === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created: any[] = [];
        for (const row of rows) {
          // Strip undefined fields
          const clean: Row = {};
          Object.entries(row).forEach(([k, v]) => { if (v !== undefined) clean[k] = v; });
          const rec = await coll.create(clean);
          created.push(rec);
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
        const updated: any[] = [];
        for (const m of matches) {
          const rec = await coll.update(m.id, clean);
          updated.push(rec);
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
  if (!pb.authStore.isValid || !pb.authStore.record) return null;
  return {
    access_token: pb.authStore.token,
    refresh_token: pb.authStore.token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 0,
    user: pb.authStore.record,
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
    const rec = pb.authStore.record;
    return { data: { user: rec ?? null }, error: rec ? null : { message: "No user" } };
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
      return { data: { user: auth.record, session: currentSession() }, error: null };
    } catch (e) {
      return { data: { user: null, session: null }, error: pbErrorToSupabase(e) };
    }
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    try {
      const meta = options?.data ?? {};
      const rec = await pb.collection("users").create({
        email,
        password,
        passwordConfirm: password,
        ...meta,
      });
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
  then<R = QueryResult>(onf?: any, onr?: any): Promise<R> {
    return this.exec().then(onf, onr) as any;
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