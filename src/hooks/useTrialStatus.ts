import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";

interface TrialStatus {
  isInTrial: boolean;
  isPremium: boolean;
  trialEndDate: Date | null;
  daysRemaining: number;
}

export function useTrialStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<TrialStatus>({
    isInTrial: false,
    isPremium: false,
    trialEndDate: null,
    daysRemaining: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTrialStatus = async () => {
      if (!user) {
        setStatus({ isInTrial: false, isPremium: false, trialEndDate: null, daysRemaining: 0 });
        setLoading(false);
        return;
      }

      try {
        const record = await pb.collection("users").getOne(user.id);
        const trialEndDate = record.trial_end_date ? new Date(record.trial_end_date) : null;
        const now = new Date();
        const isInTrial = trialEndDate ? trialEndDate > now : false;
        const daysRemaining = trialEndDate
          ? Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        setStatus({
          isInTrial: isInTrial && !record.is_premium,
          isPremium: record.is_premium || false,
          trialEndDate,
          daysRemaining,
        });
      } catch (err) {
        console.error("Error checking trial status:", err);
      } finally {
        setLoading(false);
      }
    };

    checkTrialStatus();
  }, [user]);

  return { ...status, loading };
}
