import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map Stripe price IDs to subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
  "price_1Sj6inBpgDWDQoCJIeQFcCOy": "basic",
  "price_1Sj6guBpgDWDQoCJOrqbnJvy": "basic",
  "price_1Sj6fABpgDWDQoCJdiVEtGHx": "premium",
  "price_1Sj6elBpgDWDQoCJUQ2dOYR3": "premium",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found, returning free tier");
      
      // Update profile to free tier
      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_tier: "free",
          is_premium: false,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_end_date: null,
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: "free",
        subscription_end: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let tier = "free";
    let subscriptionEnd = null;
    let subscriptionId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionId = subscription.id;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      
      const priceId = subscription.items.data[0]?.price?.id;
      tier = PRICE_TO_TIER[priceId] || "free";
      
      logStep("Active subscription found", { 
        subscriptionId, 
        priceId, 
        tier, 
        endDate: subscriptionEnd 
      });
    } else {
      logStep("No active subscription found");
    }

    // Update profile with subscription info
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_tier: tier,
        is_premium: tier !== "free",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_end_date: subscriptionEnd,
      })
      .eq("user_id", user.id);

    if (updateError) {
      logStep("Error updating profile", { error: updateError.message });
    } else {
      logStep("Profile updated successfully", { tier });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Une erreur interne est survenue. Veuillez réessayer." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
