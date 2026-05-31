import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.id);

    // Validate messages input
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages invalides" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (messages.length > 50) {
      return new Response(JSON.stringify({ error: "Trop de messages. Limite : 50." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== "string") {
        return new Response(JSON.stringify({ error: "Format de message invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.content.length > 10000) {
        return new Response(JSON.stringify({ error: "Message trop long. Limite : 10 000 caractères." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if user can use AI (subscription tier)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    const { data: limits } = await supabaseClient
      .from("subscription_limits")
      .select("can_use_ai")
      .eq("tier", profile?.subscription_tier || "free")
      .single();

    if (!limits?.can_use_ai) {
      console.error("User subscription does not allow AI usage");
      return new Response(JSON.stringify({ error: "Votre abonnement ne permet pas l'utilisation de l'IA. Passez à un plan supérieur." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Received messages:", messages.length, "from user:", user.id);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `Tu es un assistant médical IA professionnel et bienveillant. Tu aides les professionnels de santé à analyser les symptômes et à suggérer des diagnostics potentiels.

IMPORTANT: Tu ne poses PAS de diagnostic définitif. Tu fournis des informations éducatives et des pistes de réflexion pour aider le professionnel de santé.

Tes réponses doivent être:
- Claires et structurées
- Basées sur des connaissances médicales établies
- Accompagnées de recommandations pour des examens complémentaires si nécessaire
- Toujours accompagnées d'un rappel que seul un médecin peut poser un diagnostic

Tu peux:
- Analyser des symptômes décrits
- Suggérer des diagnostics différentiels
- Proposer des examens complémentaires
- Fournir des informations sur les pathologies
- Aider à la rédaction de notes médicales`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway for user:", user.id);

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("AI chat error:", errorMessage);
    return new Response(JSON.stringify({ error: "Une erreur interne est survenue. Veuillez réessayer." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
