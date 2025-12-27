import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SubscriptionTier = "free" | "basic" | "premium";

interface SubscriptionStatus {
  tier: SubscriptionTier;
  subscribed: boolean;
  subscriptionEnd: Date | null;
  loading: boolean;
}

export function useSubscription() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<SubscriptionStatus>({
    tier: "free",
    subscribed: false,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!user || !session) {
      setStatus({
        tier: "free",
        subscribed: false,
        subscriptionEnd: null,
        loading: false,
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error checking subscription:", error);
        return;
      }

      setStatus({
        tier: (data?.tier as SubscriptionTier) || "free",
        subscribed: data?.subscribed || false,
        subscriptionEnd: data?.subscription_end ? new Date(data.subscription_end) : null,
        loading: false,
      });
    } catch (err) {
      console.error("Error checking subscription:", err);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  }, [user, session]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const startCheckout = async (priceId: string) => {
    if (!session) {
      toast({
        title: "Connexion requise",
        description: "Vous devez être connecté pour souscrire à un abonnement.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error creating checkout:", err);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer le paiement. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const openCustomerPortal = async () => {
    if (!session) {
      toast({
        title: "Connexion requise",
        description: "Vous devez être connecté pour gérer votre abonnement.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'ouvrir le portail client. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  return {
    ...status,
    checkSubscription,
    startCheckout,
    openCustomerPortal,
  };
}
