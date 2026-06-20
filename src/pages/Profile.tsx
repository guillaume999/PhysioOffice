import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { pb } from "@/integrations/pocketbase/client";
import { Loader2, User, Mail, Lock, Save, FileText } from "lucide-react";
import { z } from "zod";
import { PagePopup } from "@/components/popup/PagePopup";
import { DirectorySettingsCard } from "@/components/profile/DirectorySettingsCard";

const passwordSchema = z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").max(100, "Mot de passe trop long");

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [pseudo, setPseudo] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ new?: string; confirm?: string }>({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    pb.collection("users").getOne(user.id)
      .then((rec) => {
        setFirstName(rec.first_name || "");
        setLastName(rec.last_name || "");
        setSpecialty(rec.specialty || "");
        setPseudo(rec.pseudo || "");
      })
      .catch(() => {
        const rec = pb.authStore.record;
        if (rec) {
          setFirstName(rec.first_name || "");
          setLastName(rec.last_name || "");
          setSpecialty(rec.specialty || "");
          setPseudo(rec.pseudo || "");
        }
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await pb.collection("users").update(pb.authStore.record!.id, {
        first_name: firstName,
        last_name: lastName,
        specialty,
      });
      try { await pb.collection("users").authRefresh(); } catch {}
      toast({ title: "Profil mis à jour", description: "Vos informations ont été enregistrées" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible de mettre à jour le profil", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const validatePasswordForm = () => {
    const errors: { new?: string; confirm?: string } = {};
    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) errors.new = result.error.errors[0].message;
    if (newPassword !== confirmPassword) errors.confirm = "Les mots de passe ne correspondent pas";
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    setPasswordLoading(true);
    try {
      await pb.collection("users").update(pb.authStore.record!.id, {
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: "",
      });
      toast({ title: "Mot de passe modifié", description: "Votre mot de passe a été mis à jour avec succès" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible de modifier le mot de passe", variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading || loading) {
    return <Layout><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;
  }

  return (
    <Layout>
      <PagePopup pageKey="profile" />
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Mon Profil</h1>
            <p className="text-muted-foreground mt-2">Gérez vos informations personnelles et votre mot de passe</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/journal")} className="gap-2">
            <FileText className="w-4 h-4" />Journal d'activité
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Informations personnelles</CardTitle>
              <CardDescription>Mettez à jour vos informations de profil</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pseudo">Pseudo * (affiché comme auteur)</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="pseudo" value={pseudo} disabled readOnly className="pl-10 bg-muted" />
                  </div>
                  <p className="text-xs text-muted-foreground">Le pseudo ne peut pas être modifié</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" value={user?.email || ""} disabled className="pl-10 bg-muted" />
                  </div>
                  <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Spécialité</Label>
                  <Input id="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Kinésithérapeute, Ostéopathe..." />
                </div>
                <Button type="submit" disabled={saving} className="gradient-primary text-primary-foreground">
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</> : <><Save className="w-4 h-4 mr-2" />Enregistrer</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Modifier le mot de passe</CardTitle>
              <CardDescription>Changez votre mot de passe pour sécuriser votre compte</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="newPassword" type="password" value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordErrors(p => ({ ...p, new: undefined })); }}
                      placeholder="••••••••" className={`pl-10 ${passwordErrors.new ? "border-destructive" : ""}`} />
                  </div>
                  {passwordErrors.new && <p className="text-sm text-destructive">{passwordErrors.new}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="confirmPassword" type="password" value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErrors(p => ({ ...p, confirm: undefined })); }}
                      placeholder="••••••••" className={`pl-10 ${passwordErrors.confirm ? "border-destructive" : ""}`} />
                  </div>
                  {passwordErrors.confirm && <p className="text-sm text-destructive">{passwordErrors.confirm}</p>}
                </div>
                <Button type="submit" disabled={passwordLoading} variant="outline">
                  {passwordLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Modification...</> : "Modifier le mot de passe"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {user && <DirectorySettingsCard userId={user.id} />}
        </div>
      </div>
    </Layout>
  );
}
