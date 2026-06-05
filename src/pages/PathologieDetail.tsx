import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Save, Trash2, X, Shield, User as UserIcon } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Search } from "lucide-react";

interface TraitementOption {
  id: string;
  nom: string;
  pathologie: string | null;
  user_id: string;
  is_platform: boolean;
}

export default function PathologieDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [traitement, setTraitement] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Liaisons traitement_types
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [availableTraitements, setAvailableTraitements] = useState<TraitementOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (id && user) load();
  }, [id, user]);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const r = await pb.collection("pathologies").getOne(id);
      setName((r as any).name || "");
      setTraitement((r as any).traitement || "");
      setLinkedIds(Array.isArray((r as any).traitement_types) ? (r as any).traitement_types : []);

      // Charge les traitements disponibles : ceux de l'utilisateur + ceux de la plateforme
      const [mine, featured] = await Promise.all([
        pb.collection("traitement_types").getFullList({
          filter: `user = "${user.id}"`,
          fields: "id,nom,pathologie,user",
        }),
        pb.collection("featured_traitements").getFullList({
          fields: "traitement_type",
        }).catch(() => [] as any[]),
      ]);

      const platformIds = (featured as any[]).map((f) => f.traitement_type).filter(Boolean);
      const platformRecords = platformIds.length
        ? await pb.collection("traitement_types").getFullList({
            filter: platformIds.map((tid) => `id = "${tid}"`).join(" || "),
            fields: "id,nom,pathologie,user",
          })
        : [];

      // Construit la liste finale (ID réels conservés) :
      // - perso = traitements possédés par l'utilisateur
      // - plateforme = traitements présents dans featured_traitements (même s'ils appartiennent à l'utilisateur)
      const mineOpts: TraitementOption[] = (mine as any[]).map((t) => ({
        id: t.id,
        nom: t.nom || "Sans nom",
        pathologie: t.pathologie || null,
        user_id: t.user,
        is_platform: false,
      }));
      const platformOpts: TraitementOption[] = (platformRecords as any[]).map((t) => ({
        id: t.id,
        nom: t.nom || "Sans nom",
        pathologie: t.pathologie || null,
        user_id: t.user,
        is_platform: true,
      }));
      setAvailableTraitements([...mineOpts, ...platformOpts]);
    } catch (e) {
      console.error(e);
      toast.error("Pathologie introuvable");
      navigate("/pathologies");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      await pb.collection("pathologies").update(id, {
        name: name.trim(),
        traitement,
        traitement_types: linkedIds,
      });
      toast.success("Enregistré");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await pb.collection("pathologies").delete(id);
      toast.success("Pathologie supprimée");
      navigate("/pathologies");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Maps utiles
  const traitementsById = useMemo(() => {
    const m = new Map<string, TraitementOption>();
    for (const t of availableTraitements) m.set(t.id, t);
    return m;
  }, [availableTraitements]);

  const linkedTraitements = linkedIds
    .map((tid) => traitementsById.get(tid))
    .filter((t): t is TraitementOption => !!t);

  const addLinkById = (tid: string) => {
    if (!linkedIds.includes(tid)) setLinkedIds([...linkedIds, tid]);
  };

  const minePicker = availableTraitements.filter((t) => !t.is_platform && !linkedIds.includes(t.id));
  const platformPicker = availableTraitements.filter((t) => t.is_platform && !linkedIds.includes(t.id));

  const removeLink = (tid: string) => {
    setLinkedIds(linkedIds.filter((x) => x !== tid));
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Connectez-vous pour accéder à cette page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/pathologies")} className="gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pathologie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom de la pathologie"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="traitement">Traitement / Protocole</Label>
                <Textarea
                  id="traitement"
                  value={traitement}
                  onChange={(e) => setTraitement(e.target.value)}
                  placeholder="Décrivez le protocole de traitement, conseils, contre-indications, exercices recommandés…"
                  rows={14}
                  className="min-h-[300px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Traitements liés</Label>
                <p className="text-xs text-muted-foreground">
                  Vos traitements types personnels et ceux de la plateforme rattachés à cette pathologie.
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {linkedTraitements.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Aucun traitement lié</span>
                  ) : (
                    linkedTraitements.map((t) => (
                      <Badge
                        key={t.id}
                        variant={t.is_platform ? "default" : "secondary"}
                        className="gap-1.5"
                        title={t.is_platform ? "Traitement plateforme" : "Votre traitement"}
                      >
                        {t.is_platform ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        {t.nom}
                        <X
                          className="w-3 h-3 cursor-pointer hover:opacity-70"
                          onClick={() => removeLink(t.id)}
                        />
                      </Badge>
                    ))
                  )}
                </div>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal text-muted-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <Search className="w-3 h-3" />
                        Lier un traitement type…
                      </span>
                      <ChevronsUpDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher un traitement…" />
                      <CommandList>
                        <CommandEmpty>Aucun traitement disponible.</CommandEmpty>
                        {minePicker.length > 0 && (
                          <CommandGroup heading="Mes traitements">
                            {minePicker.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={`mine-${t.id}`}
                                onSelect={() => { addLinkById(t.id); setPickerOpen(false); }}
                              >
                                <UserIcon className="w-3 h-3 mr-2 text-muted-foreground" />
                                <span className="flex-1">{t.nom}</span>
                                {t.pathologie && (
                                  <Badge variant="outline" className="ml-2 text-xs">{t.pathologie}</Badge>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {platformPicker.length > 0 && (
                          <CommandGroup heading="Plateforme">
                            {platformPicker.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={`platform-${t.id}`}
                                onSelect={() => { addLinkById(t.id); setPickerOpen(false); }}
                              >
                                <Shield className="w-3 h-3 mr-2 text-primary" />
                                <span className="flex-1">{t.nom}</span>
                                {t.pathologie && (
                                  <Badge variant="outline" className="ml-2 text-xs">{t.pathologie}</Badge>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="text-destructive gap-2"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
                <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette pathologie ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {name} » sera supprimée. Les exercices, séances et traitements qui l'utilisent comme tag
                conserveront le tag tel quel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
