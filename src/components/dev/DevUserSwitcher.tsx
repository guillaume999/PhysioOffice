import { useState } from "react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { ChevronUp, ChevronDown, Loader2, X } from "lucide-react";

interface DevPersona {
  label: string;
  color: string;
  email: string;
  password: string;
}

const personas: DevPersona[] = [
  {
    label: "Admin",
    color: "bg-red-500",
    email: import.meta.env.VITE_DEV_ADMIN_EMAIL ?? "",
    password: import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? "",
  },
  {
    label: "User 1",
    color: "bg-blue-500",
    email: import.meta.env.VITE_DEV_USER1_EMAIL ?? "",
    password: import.meta.env.VITE_DEV_USER1_PASSWORD ?? "",
  },
  {
    label: "User 2",
    color: "bg-green-500",
    email: import.meta.env.VITE_DEV_USER2_EMAIL ?? "",
    password: import.meta.env.VITE_DEV_USER2_PASSWORD ?? "",
  }
];

export function DevUserSwitcher() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!import.meta.env.DEV) return null;

  const switchTo = async (persona: DevPersona) => {
    if (!persona.email || !persona.password) {
      setError(`Credentials missing for ${persona.label} — check .env.local`);
      return;
    }
    setLoading(persona.label);
    setError(null);
    try {
      if (pb.authStore.isValid) pb.authStore.clear();
      await pb.collection("users").authWithPassword(persona.email, persona.password);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de connexion");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-mono text-xs select-none">
      {open && (
        <div className="mb-2 bg-zinc-900 text-white rounded-xl shadow-2xl border border-zinc-700 w-56 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 bg-zinc-800">
            <span className="font-bold text-yellow-400">DEV switcher</span>
            <button onClick={() => setOpen(false)} aria-label="Fermer">
              <X className="w-3.5 h-3.5 text-zinc-400 hover:text-white transition-colors" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-zinc-700">
            {user ? (
              <>
                <div className="text-zinc-200 truncate">{user.email ?? user.pseudo ?? user.id}</div>
                <div className="text-zinc-500">{user.subscription_tier ?? "aucun tier"}</div>
              </>
            ) : (
              <span className="text-zinc-500">Non connecté</span>
            )}
          </div>

          <div className="p-2 flex flex-col gap-1">
            {personas.map((p) => (
              <button
                key={p.label}
                onClick={() => switchTo(p)}
                disabled={loading !== null}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 text-left w-full"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${p.color}`} />
                <span className="text-zinc-200">{p.label}</span>
                <span className="text-zinc-600 truncate flex-1">{p.email || "—"}</span>
                {loading === p.label && (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0 text-zinc-400" />
                )}
              </button>
            ))}

            {user && (
              <button
                onClick={() => signOut()}
                disabled={loading !== null}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 text-left w-full text-zinc-500 hover:text-zinc-300"
              >
                <span className="w-2 h-2 rounded-full shrink-0 bg-zinc-600" />
                Déconnexion
              </button>
            )}
          </div>

          {error && (
            <div className="px-3 pb-2 text-red-400 text-[10px] leading-tight">{error}</div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-yellow-400 text-zinc-900 font-bold px-2.5 py-1 rounded-lg shadow-lg hover:bg-yellow-300 transition-colors ml-auto"
      >
        DEV
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>
    </div>
  );
}
