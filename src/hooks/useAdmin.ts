import { useAuth } from "@/lib/auth";

/**
 * Thin wrapper kept for backwards compatibility. The role lives in the auth
 * context and reflects the actually authenticated user — including the account
 * chosen via the DEV switcher — so admin-only UI is gated by the real role.
 */
export function useAdmin() {
  const { isAdmin, loading } = useAuth();
  return { isAdmin, loading };
}
