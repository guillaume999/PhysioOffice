import { useAuth } from "@/lib/auth";

/**
 * Thin wrapper kept for backwards compatibility. The role now lives in the
 * auth context; in DEV we still treat the local fake session as admin.
 */
export function useAdmin() {
  const { isAdmin, loading } = useAuth();
  if (import.meta.env.DEV) {
    return { isAdmin: true, loading: false };
  }
  return { isAdmin, loading };
}
