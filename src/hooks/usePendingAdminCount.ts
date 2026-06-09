import { useEffect, useState } from "react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";

export function usePendingAdminCount() {
  const { isAdmin, user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin || !user) return;

    let cancelled = false;

    const fetchCount = async () => {
      try {
        const [allExercices, consultedExercices, allTraitements, allSeances] = await Promise.all([
          pb.collection("exercices").getFullList({ filter: 'is_copy = false', fields: 'id' }),
          pb.collection("exercice_consultations").getFullList({
            filter: `user = "${user.id}" && is_consulted = true`,
            fields: 'exercice',
          }),
          pb.collection("traitement_types").getFullList({ filter: 'is_copy = false', fields: 'id' }),
          pb.collection("seance_types").getFullList({ filter: 'is_copy = false', fields: 'id' }),
        ]);

        if (!cancelled) {
          const consultedExerciceIds = new Set(consultedExercices.map((c: any) => c.exercice));
          const unconsultedExercices = allExercices.filter((e: any) => !consultedExerciceIds.has(e.id)).length;

          const getLocalSet = (key: string): Set<string> => {
            try {
              const stored = localStorage.getItem(key);
              return stored ? new Set(JSON.parse(stored)) : new Set();
            } catch { return new Set(); }
          };

          const consultedTraitementIds = getLocalSet(`admin_consulted_traitements_${user.id}`);
          const unconsultedTraitements = allTraitements.filter((t: any) => !consultedTraitementIds.has(t.id)).length;

          const consultedSeanceIds = getLocalSet(`admin_consulted_seances_${user.id}`);
          const unconsultedSeances = allSeances.filter((s: any) => !consultedSeanceIds.has(s.id)).length;

          setCount(unconsultedExercices + unconsultedTraitements + unconsultedSeances);
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
