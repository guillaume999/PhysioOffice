import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSubscription, SubscriptionTier } from "@/hooks/useSubscription";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Sparkles, Crown, Users } from "lucide-react";

// Stripe price IDs
const PRICES = {
  basic: {
    monthly: "price_1Sj6inBpgDWDQoCJIeQFcCOy",
    yearly: "price_1Sj6guBpgDWDQoCJOrqbnJvy",
  },
  premium: {
    monthly: "price_1Sj6fABpgDWDQoCJdiVEtGHx",
    yearly: "price_1Sj6elBpgDWDQoCJUQ2dOYR3",
  },
};

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: PlanFeature[];
  icon: React.ReactNode;
  popular?: boolean;
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Gratuit",
    description: "Pour découvrir l'application",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: <Users className="h-6 w-6" />,
    features: [
      { text: "5 patients", included: true },
      { text: "3 exercices personnels", included: true },
      { text: "3 séances personnelles", included: true },
      { text: "3 traitements personnels", included: true },
      { text: "Accès à la plateforme", included: true },
      { text: "Partage d'exercices", included: false },
      { text: "Diagnostic IA", included: false },
    ],
  },
  {
    id: "basic",
    name: "Basic",
    description: "Pour les kinésithérapeutes indépendants",
    monthlyPrice: 3.99,
    yearlyPrice: 43.09,
    icon: <Sparkles className="h-6 w-6" />,
    popular: true,
    features: [
      { text: "20 patients", included: true },
      { text: "15 exercices personnels", included: true },
      { text: "15 séances personnelles", included: true },
      { text: "15 traitements personnels", included: true },
      { text: "Accès à la plateforme", included: true },
      { text: "Partage d'exercices", included: true },
      { text: "Diagnostic IA", included: true },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Pour les cabinets et professionnels avancés",
    monthlyPrice: 19.99,
    yearlyPrice: 215.89,
    icon: <Crown className="h-6 w-6" />,
    features: [
      { text: "Patients illimités", included: true },
      { text: "Exercices illimités", included: true },
      { text: "Séances illimitées", included: true },
      { text: "Traitements illimités", included: true },
      { text: "Accès à la plateforme", included: true },
      { text: "Partage d'exercices", included: true },
      { text: "Diagnostic IA avancé", included: true },
    ],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tier, subscribed, loading, startCheckout, openCustomerPortal } = useSubscription();
  const [isYearly, setIsYearly] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: SubscriptionTier) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (planId === "free") return;

    setCheckoutLoading(planId);
    const priceId = isYearly 
      ? PRICES[planId as keyof typeof PRICES].yearly 
      : PRICES[planId as keyof typeof PRICES].monthly;
    
    await startCheckout(priceId);
    setCheckoutLoading(null);
  };

  const getButtonText = (planId: SubscriptionTier) => {
    if (!user) return "Se connecter";
    if (tier === planId) return "Votre plan actuel";
    if (planId === "free") return "Plan gratuit";
    return "S'abonner";
  };

  const isCurrentPlan = (planId: SubscriptionTier) => tier === planId;

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choisissez votre forfait</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Des outils professionnels pour optimiser votre pratique de kinésithérapeute
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
              Mensuel
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
              Annuel
              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                -10%
              </Badge>
            </Label>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative flex flex-col ${
                  isCurrentPlan(plan.id) 
                    ? "border-primary ring-2 ring-primary/20" 
                    : plan.popular 
                      ? "border-primary/50" 
                      : ""
                }`}
              >
                {plan.popular && !isCurrentPlan(plan.id) && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Populaire
                  </Badge>
                )}
                {isCurrentPlan(plan.id) && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600">
                    Votre plan
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 text-primary">
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold">
                      {isYearly ? (
                        <>
                          {plan.yearlyPrice === 0 ? "0" : plan.yearlyPrice.toFixed(2)}€
                          <span className="text-lg font-normal text-muted-foreground">/an</span>
                        </>
                      ) : (
                        <>
                          {plan.monthlyPrice === 0 ? "0" : plan.monthlyPrice.toFixed(2)}€
                          <span className="text-lg font-normal text-muted-foreground">/mois</span>
                        </>
                      )}
                    </div>
                    {isYearly && plan.monthlyPrice > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        soit {(plan.yearlyPrice / 12).toFixed(2)}€/mois
                      </p>
                    )}
                  </div>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Check className={`h-5 w-5 flex-shrink-0 ${
                          feature.included ? "text-primary" : "text-muted-foreground/30"
                        }`} />
                        <span className={feature.included ? "" : "text-muted-foreground/50 line-through"}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  {isCurrentPlan(plan.id) && subscribed ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={openCustomerPortal}
                    >
                      Gérer l'abonnement
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.id === "free" ? "outline" : "default"}
                      disabled={isCurrentPlan(plan.id) || checkoutLoading === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {checkoutLoading === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {getButtonText(plan.id)}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Paiement sécurisé par Stripe. Annulez à tout moment.</p>
          <p className="mt-2">
            Des questions ? <a href="/contact" className="text-primary hover:underline">Contactez-nous</a>
          </p>
        </div>
      </div>
    </Layout>
  );
}
