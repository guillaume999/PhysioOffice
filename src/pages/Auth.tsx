import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { pb } from "@/integrations/pocketbase/client";
import { Loader2, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Email invalide").max(255, "Email trop long");
const passwordSchema = z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").max(100, "Mot de passe trop long");
const nameSchema = z.string().max(100, "Nom trop long").optional();
const pseudoSchema = z
  .string()
  .min(3, "Le pseudo doit contenir au moins 3 caractères")
  .max(30, "Le pseudo ne doit pas dépasser 30 caractères")
  .regex(/^[A-Za-z0-9-]+$/, "Le pseudo ne peut contenir que des lettres, chiffres et tirets");

type AuthMode = "login" | "signup" | "forgot-password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; pseudo?: string }>({});
  
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; pseudo?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    if (mode !== "forgot-password") {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    if (mode === "signup") {
      const pseudoResult = pseudoSchema.safeParse(pseudo);
      if (!pseudoResult.success) {
        newErrors.pseudo = pseudoResult.error.errors[0].message;
      } else if (pseudo.toLowerCase() === "admin") {
        newErrors.pseudo = "Ce pseudo est réservé";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = async () => {
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setErrors({ email: emailResult.error.errors[0].message });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email envoyé",
          description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe.",
        });
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "forgot-password") {
      await handleForgotPassword();
      return;
    }
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Erreur de connexion",
              description: "Email ou mot de passe incorrect",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erreur",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Connexion réussie",
            description: "Bienvenue sur PhysioOffice !",
          });
        }
      } else {
        const { error } = await signUp(email, password, firstName, lastName, pseudo);
        if (error) {
          const msg = error.message || "";
          const details = (error as any).details || "";
          const pseudoTaken =
            /pseudo[\s\S]*validation_not_unique/i.test(details) ||
            /pseudo[\s\S]*validation_not_unique/i.test(msg) ||
            /pseudo[\s\S]*(déjà|already|unique)/i.test(msg);
          if (pseudoTaken) {
            setErrors((prev) => ({ ...prev, pseudo: "Ce pseudo est déjà pris" }));
            toast({
              title: "Pseudo indisponible",
              description: "Ce pseudo est déjà pris",
              variant: "destructive",
            });
          } else if (msg.includes("User already registered")) {
            toast({
              title: "Compte existant",
              description: "Un compte existe déjà avec cet email. Essayez de vous connecter.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erreur",
              description: msg,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Compte créé !",
            description: "Votre compte a été créé avec succès.",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Connexion";
      case "signup": return "Créer un compte";
      case "forgot-password": return "Mot de passe oublié";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "login": return "Connectez-vous à votre espace PhysioOffice";
      case "signup": return "Rejoignez PhysioOffice et gérez votre cabinet";
      case "forgot-password": return "Entrez votre email pour recevoir un lien de réinitialisation";
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        
        <Card className="w-full max-w-md relative z-10 shadow-soft animate-scale-in">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-foreground">M</span>
            </div>
            <CardTitle className="text-2xl font-display">{getTitle()}</CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pseudo">Pseudo * (nom d'auteur)</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="pseudo"
                        placeholder="MonPseudo"
                        value={pseudo}
                        onChange={(e) => {
                          setPseudo(e.target.value);
                          setErrors((prev) => ({ ...prev, pseudo: undefined }));
                        }}
                        className={`pl-10 ${errors.pseudo ? "border-destructive" : ""}`}
                      />
                    </div>
                    {errors.pseudo && (
                      <p className="text-sm text-destructive">{errors.pseudo}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Ce pseudo sera affiché comme auteur de vos contenus partagés</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        placeholder="Jean"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        placeholder="Dupont"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="docteur@exemple.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              {mode !== "forgot-password" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={`pl-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
              )}

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot-password");
                    setErrors({});
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              )}

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : mode === "login" ? (
                  "Se connecter"
                ) : mode === "signup" ? (
                  "Créer mon compte"
                ) : (
                  "Envoyer le lien"
                )}
              </Button>
            </form>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const fakeUser = {
                    id: "dev_user_local",
                    collectionId: "_pb_users_auth_",
                    collectionName: "users",
                    email: "dev@local",
                    pseudo: "dev",
                    first_name: "Dev",
                    last_name: "User",
                    name: "Dev User",
                    verified: true,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                  };
                  // Fake JWT-shaped token so pb.authStore.isValid returns true
                  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
                  const payload = btoa(
                    JSON.stringify({
                      id: fakeUser.id,
                      type: "authRecord",
                      collectionId: fakeUser.collectionId,
                      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
                    })
                  );
                  const fakeToken = `${header}.${payload}.devsignature`;
                  pb.authStore.save(fakeToken, fakeUser as any);
                  toast({
                    title: "Connexion simulée",
                    description: "Session de dev créée localement.",
                  });
                  navigate("/");
                }}
              >
                Connexion simulée (dev)
              </Button>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Crée une session locale fictive sans appeler le serveur.
              </p>
            </div>

            <div className="mt-6 text-center space-y-2">
              {mode === "forgot-password" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrors({});
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la connexion
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setErrors({});
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {mode === "login"
                    ? "Pas encore de compte ? Créez-en un"
                    : "Déjà un compte ? Connectez-vous"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
