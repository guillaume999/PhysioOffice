import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { pb } from "@/integrations/pocketbase/client";

export type User = {
  id: string;
  email?: string;
  [key: string]: any;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName?: string, lastName?: string, pseudo?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(
    pb.authStore.isValid ? (pb.authStore.record as User) : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.isValid ? (pb.authStore.record as User) : null);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      await pb.collection("users").authWithPassword(email, password);
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

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
