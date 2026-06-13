import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { pb } from "@/integrations/pocketbase/client";

export type UserRole = "admin" | "user";

export type User = {
  id: string;
  email?: string;
  subscription_tier?: string;
  [key: string]: any;
};

interface AuthContextType {
  user: User | null;
  /** true while the initial session is being restored/refreshed */
  loading: boolean;
  /** derived role from the auth record */
  role: UserRole;
  isAdmin: boolean;
  signUp: (email: string, password: string, firstName?: string, lastName?: string, pseudo?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** force a token + record refresh against PocketBase */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readUser(): User | null {
  return pb.authStore.isValid ? (pb.authStore.record as User) : null;
}

function deriveRole(u: User | null): UserRole {
  return u?.subscription_tier === "admin" ? "admin" : "user";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser());
  // start in loading state only if we have a token to validate
  const [loading, setLoading] = useState<boolean>(pb.authStore.isValid);

  // keep React state in sync with the PocketBase auth store (login, logout, refresh)
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => setUser(readUser()));
    return () => unsubscribe();
  }, []);

  // on mount: if a token exists, validate & refresh it server-side.
  // an invalid/expired token clears the session instead of leaving a stale user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pb.authStore.isValid) {
        setLoading(false);
        return;
      }
      try {
        const auth = await pb.collection("users").authRefresh();
        if (auth.record?.is_banned) pb.authStore.clear();
      } catch {
        pb.authStore.clear();
      } finally {
        if (!cancelled) {
          setUser(readUser());
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const auth = await pb.collection("users").authWithPassword(email, password);
      if (auth.record?.is_banned) {
        pb.authStore.clear();
        return { error: new Error("Votre compte a été banni. Contactez l'administrateur.") };
      }
      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    pseudo?: string
  ): Promise<{ error: Error | null }> => {
    try {
      const payload: Record<string, any> = {
        email,
        password,
        passwordConfirm: password,
        emailVisibility: true,
      };
      if (pseudo) {
        payload.pseudo = pseudo;
        payload.username = pseudo.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 150);
      }
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (fullName) payload.name = fullName;

      await pb.collection("users").create(payload);
      await pb.collection("users").authWithPassword(email, password);
      try {
        await pb.collection("users").requestVerification(email);
      } catch {}
      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signOut = async () => {
    pb.authStore.clear();
  };

  const refresh = async () => {
    if (!pb.authStore.isValid) return;
    try {
      await pb.collection("users").authRefresh();
    } catch {
      pb.authStore.clear();
    } finally {
      setUser(readUser());
    }
  };

  const role = deriveRole(user);

  return (
    <AuthContext.Provider
      value={{ user, loading, role, isAdmin: role === "admin", signIn, signUp, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
