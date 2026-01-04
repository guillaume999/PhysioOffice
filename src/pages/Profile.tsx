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
import { Loader2, User, Mail, Lock, Save } from "lucide-react";
import { z } from "zod";
import { PagePopup } from "@/components/popup/PagePopup";

const passwordSchema = z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").max(100, "Mot de passe trop long");

interface Profile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  specialty: string | null;
  pseudo: string | null;
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [pseudo, setPseudo] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ new?: string; confirm?: string }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, specialty, pseudo")
        .eq("user_id", user!.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
      }

      if (data) {
        setProfile(data);
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setSpecialty(data.specialty || "");
        setPseudo(data.pseudo || "");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate pseudo is required
    if (!pseudo || pseudo.trim().length < 3) {
      toast({
        title: "Pseudo requis",
        description: "Le pseudo doit contenir au moins 3 caractères",
        variant: "destructive",
      });
      return;
    }

    // Client-side validation for reserved pseudo
    if (pseudo.toLowerCase() === "admin") {
      toast({
        title: "Pseudo non autorisé",
        description: "Le pseudo 'admin' est réservé et ne peut pas être utilisé",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          specialty: specialty,
          pseudo: pseudo || null,
        })
        .eq("user_id", user!.id);

      if (error) {
        let errorMessage = "Impossible de mettre à jour le profil";
        
        if (error.code === "23505") {
          if (error.message.includes("idx_profiles_pseudo_unique")) {
            errorMessage = "Ce pseudo est déjà utilisé par un autre utilisateur";
          } else if (error.message.includes("idx_profiles_email_unique")) {
            errorMessage = "Cet email est déjà utilisé par un autre utilisateur";
          }
        } else if (error.message.includes("admin")) {
          errorMessage = "Le pseudo 'admin' est réservé et ne peut pas être utilisé";
        }
        
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Profil mis à jour",
          description: "Vos informations ont été enregistrées",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const validatePasswordForm = () => {
    const errors: { new?: string; confirm?: string } = {};

    const newPasswordResult = passwordSchema.safeParse(newPassword);
    if (!newPasswordResult.success) {
      errors.new = newPasswordResult.error.errors[0].message;
    }

    if (newPassword !== confirmPassword) {
      errors.confirm = "Les mots de passe ne correspondent pas";
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Mot de passe modifié",
          description: "Votre mot de passe a été mis à jour avec succès",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PagePopup pageKey="profile" />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Mon Profil</h1>
          <p className="text-muted-foreground mt-2">Gérez vos informations personnelles et votre mot de passe</p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informations personnelles
              </CardTitle>
              <CardDescription>
                Mettez à jour vos informations de profil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Dupont"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pseudo">Pseudo * (affiché comme auteur)</Label>
                  <Input
                    id="pseudo"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    placeholder="MonPseudo"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Ce pseudo sera utilisé comme nom d'auteur pour vos séances, exercices et traitements partagés</p>
                  {!pseudo && (
                    <p className="text-xs text-amber-600">Le pseudo est obligatoire pour créer du contenu</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialty">Spécialité</Label>
                  <Input
                    id="specialty"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Kinésithérapeute, Ostéopathe..."
                  />
                </div>

                <Button type="submit" disabled={saving} className="gradient-primary text-primary-foreground">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Modifier le mot de passe
              </CardTitle>
              <CardDescription>
                Changez votre mot de passe pour sécuriser votre compte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordErrors((prev) => ({ ...prev, new: undefined }));
                      }}
                      placeholder="••••••••"
                      className={`pl-10 ${passwordErrors.new ? "border-destructive" : ""}`}
                    />
                  </div>
                  {passwordErrors.new && (
                    <p className="text-sm text-destructive">{passwordErrors.new}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordErrors((prev) => ({ ...prev, confirm: undefined }));
                      }}
                      placeholder="••••••••"
                      className={`pl-10 ${passwordErrors.confirm ? "border-destructive" : ""}`}
                    />
                  </div>
                  {passwordErrors.confirm && (
                    <p className="text-sm text-destructive">{passwordErrors.confirm}</p>
                  )}
                </div>

                <Button type="submit" disabled={passwordLoading} variant="outline">
                  {passwordLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Modification...
                    </>
                  ) : (
                    "Modifier le mot de passe"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
