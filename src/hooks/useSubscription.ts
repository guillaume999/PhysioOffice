import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";

export type SubscriptionTier = "free" | "basic" | "premium";

interface SubscriptionStatus {
  tier: SubscriptionTier;
  subscribed: boolean;
  subscriptionEnd: Date | null;
  loading: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<SubscriptionStatus>({
    tier: "free",
    subscribed: false,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus({ tier: "free", subscribed: false, subscriptionEnd: null, loading: false });
      return;
    }

    try {
      // Lire le tier directement depuis le record PocketBase
      const record = pb.authStore.record;
      const tier = (record?.subscription_tier as SubscriptionTier) || "free";
      const subscriptionEnd = record?.subscription_end ? new Date(record.subscription_end) : null;
      const subscribed = tier !== "free" && (!subscriptionEnd || subscriptionEnd > new Date());

      setStatus({ tier, subscribed, subscriptionEnd, loading: false });
    } catch (err) {
      console.error("Error checking subscription:", err);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  // TODO: implémenter checkout via PocketBase hook ou service externe
  const startCheckout = async (_priceId: string) => {
    toast({
      title: "Non disponible",
      description: "Le paiement doit être configuré via un PocketBase hook ou service externe.",
      variant: "destructive",
    });
  };

  const openCustomerPortal = async () => {
    toast({
      title: "Non disponible",
      description: "Le portail client doit être configuré via un service externe.",
      variant: "destructive",
    });
  };

  return { ...status, checkSubscription, startCheckout, openCustomerPortal };
}
