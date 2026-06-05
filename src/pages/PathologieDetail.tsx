import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

const CATEGORIES = [
  "Traumatologie",
  "Orthopédie",
  "Neurologie",
  "Rhumatologie",
  "Cardiovasculaire",
  "Respiratoire",
  "Psychiatrie",
  "Gériatrie",
  "Urologie",
  "Dermatologie",
  "Pédiatrie",
  "Gynécologie",
  "Médecine interne",
  "Chirurgie",
];

// Sections internes structurées du champ `description` (Markdown).
// Ordre = ordre d'affichage et de stockage.
const SECTIONS = [
  { key: "description", label: "Description" },
  { key: "traitement_orthopedique", label: "Traitement orthopédique" },
  { key: "traitement_chirurgical", label: "Traitement chirurgical" },
  { key: "bilan", label: "Bilan" },
  { key: "traitement_kine", label: "Traitement kiné" },
  { key: "complications", label: "Complications" },
  { key: "contre_indications", label: "Contre-indications" },
  { key: "evolution_delais", label: "Évolution & délais" },
  { key: "mots_cles", label: "Mots-clés" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

// Construit le Markdown final à partir du dictionnaire de sections.
function buildDescription(sections: Record<SectionKey, string>): string {
  return SECTIONS.map(({ key, label }) => {
    const content = (sections[key] || "").trim();
    return `## ${label}\n${content}`;
  }).join("\n\n");
}

// Parse un Markdown structuré en ses sections. Tolérant : ce qui ne matche pas
// va dans la première section. Cherche les headings de niveau 2.
function parseDescription(md: string): Record<SectionKey, string> {
  const empty = SECTIONS.reduce((acc, s) => ({ ...acc, [s.key]: "" }),
    {} as Record<SectionKey, string>);
  if (!md) return empty;

  const labelToKey = new Map<string, SectionKey>(
    SECTIONS.map((s) => [s.label.toLowerCase(), s.key])
  );

  const lines = md.split(/\r?\n/);
  let current: SectionKey | null = null;
  const buffers: Record<SectionKey, string[]> = SECTIONS.reduce(
    (acc, s) => ({ ...acc, [s.key]: [] }),
    {} as Record<SectionKey, string[]>
  );
  const preamble: string[] = [];

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      const key = labelToKey.get(m[1].trim().toLowerCase());
      if (key) {
        current = key;
        continue;
      }
    }
    if (current) buffers[current].push(line);
    else preamble.push(line);
  }

  // Si rien n'a été reconnu et qu'il y a du contenu en préambule, le mettre
  // dans la première section "description".
  if (
    preamble.join("").trim().length > 0 &&
    Object.values(buffers).every((b) => b.length === 0)
  ) {
    buffers.description = preamble;
  }

  return SECTIONS.reduce(
    (acc, s) => ({ ...acc, [s.key]: buffers[s.key].join("\n").trim() }),
    {} as Record<SectionKey, string>
  );
}

export default function PathologieDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [categorie, setCategorie] = useState<string>("");
  const [objectifs, setObjectifs] = useState("");
  const [sections, setSections] = useState<Record<SectionKey, string>>(() =>
    SECTIONS.reduce(
      (acc, s) => ({ ...acc, [s.key]: "" }),
      {} as Record<SectionKey, string>
    )
  );
  // Champ legacy `traitement` (texte libre) — conservé pour rétrocompat.
  const [traitement, setTraitement] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Liaisons traitement_types
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [availableTraitements, setAvailableTraitements] = useState<TraitementOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (id && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const r = await pb.collection("pathologies").getOne(id);
      const rec = r as any;
      setName(rec.name || "");
      setCategorie(rec.categorie || "");
      setObjectifs(rec.objectifs || "");
      setTraitement(rec.traitement || "");
      setSections(parseDescription(rec.description || ""));
      setLinkedIds(Array.isArray(rec.traitement_types) ? rec.traitement_types : []);

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
        categorie: categorie || "",
        objectifs: objectifs.trim(),
        description: buildDescription(sections),
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

  const setSection = (key: SectionKey, value: string) =>
    setSections((prev) => ({ ...prev, [key]: value }));

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

  // Sections renseignées en premier dans l'accordéon
  const filledKeys = SECTIONS.filter((s) => (sections[s.key] || "").trim().length > 0).map(
    (s) => s.key
  );

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categorie">Catégorie</Label>
                  <Select value={categorie} onValueChange={setCategorie}>
                    <SelectTrigger id="categorie">
                      <SelectValue placeholder="Choisir une catégorie…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objectifs">Objectifs</Label>
                  <Input
                    id="objectifs"
                    value={objectifs}
                    onChange={(e) => setObjectifs(e.target.value)}
                    placeholder="Ex. récupération de l'amplitude, indolence…"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description structurée</Label>
                <p className="text-xs text-muted-foreground">
                  Sections enregistrées dans le champ <code>description</code>.
                </p>
                <Accordion
                  type="multiple"
                  defaultValue={filledKeys.length ? filledKeys : ["description"]}
                  className="border rounded-md"
                >
                  {SECTIONS.map(({ key, label }) => (
                    <AccordionItem key={key} value={key}>
                      <AccordionTrigger className="px-3 text-sm font-medium">
                        <span className="flex items-center gap-2">
                          {label}
                          {(sections[key] || "").trim() && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              rempli
                            </Badge>
                          )}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <Textarea
                          value={sections[key]}
                          onChange={(e) => setSection(key, e.target.value)}
                          placeholder={
                            key === "mots_cles"
                              ? "genou, ligament, post-op"
                              : `Saisir ${label.toLowerCase()}…`
                          }
                          rows={key === "mots_cles" ? 2 : 6}
                          className={key === "mots_cles" ? "" : "min-h-[120px]"}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              <div className="space-y-2">
                <Label htmlFor="traitement">Notes libres (legacy)</Label>
                <p className="text-xs text-muted-foreground">
                  Champ <code>traitement</code> historique, conservé pour compatibilité.
                </p>
                <Textarea
                  id="traitement"
                  value={traitement}
                  onChange={(e) => setTraitement(e.target.value)}
                  placeholder="Notes libres, à migrer progressivement vers la description structurée."
                  rows={6}
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
                                value={`mine ${t.nom} ${t.pathologie || ""} ${t.id}`}
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
                                value={`platform ${t.nom} ${t.pathologie || ""} ${t.id}`}
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
