import { useEffect, useState } from "react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { fetchCorbeilleTotal } from "@/lib/corbeille";

export function usePendingAdminCount() {
  const { isAdmin, user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin || !user) return;

    let cancelled = false;

    const fetchCount = async () => {
      try {
        const [
          pendingExercices, pendingTraitements, pendingSeances,
          modifExercices, modifTraitements, modifSeances,
          corbeilleCount,
        ] = await Promise.all([
          pb.collection("exercices").getFullList({
            filter: 'is_copy = false && (status = "pending" || status = "withdrawal_requested")',
            fields: 'id',
          }),
          pb.collection("traitement_types").getFullList({
            filter: 'is_copy = false && is_shared = true && is_validated = false && is_refused = false',
            fields: 'id',
          }),
          pb.collection("seance_types").getFullList({
            filter: 'is_copy = false && is_shared = true && is_validated = false && is_refused = false',
            fields: 'id',
          }),
          pb.collection("exercices").getFullList({
            filter: 'is_copy = false && modification_pending = true',
            fields: 'id',
          }).catch(() => [] as any[]),
          pb.collection("traitement_types").getFullList({
            filter: 'is_copy = false && modification_pending = true',
            fields: 'id',
          }).catch(() => [] as any[]),
          pb.collection("seance_types").getFullList({
            filter: 'is_copy = false && modification_pending = true',
            fields: 'id',
          }).catch(() => [] as any[]),
          fetchCorbeilleTotal(),
        ]);

        if (!cancelled) {
          setCount(
            pendingExercices.length + pendingTraitements.length + pendingSeances.length +
            modifExercices.length + modifTraitements.length + modifSeances.length +
            corbeilleCount
          );
        }
      } catch {
        // silently ignore — navbar badge is non-critical
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin, user]);

  return count;
}
