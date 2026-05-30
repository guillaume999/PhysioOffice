import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    if (import.meta.env.DEV) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    const record = pb.authStore.record;
    setIsAdmin(record?.subscription_tier === "admin");
    setLoading(false);
  }, [user, authLoading]);

  return { isAdmin, loading };
}
