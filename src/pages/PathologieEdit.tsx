import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { softDelete, withActive } from "@/lib/corbeille";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  X,
  Shield,
  User as UserIcon,
  Search,
  ChevronsUpDown,
} from "lucide-react";
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
import { KineEditor, type ExerciceOption } from "@/components/pathologie/KineEditor";
import { RichTextEditor } from "@/components/pathologie/RichTextEditor";
import { TagReferenceSelect } from "@/components/tags/TagReferenceSelect";
import DOMPurify from "dompurify";
import {
  CATEGORIES,
  SECTIONS,
  SectionKey,
  emptySections,
  buildSectionsDescription,
  parseDescription,
  parseKineItems,
  parseMotsCles,
  serializeMotsCles,
  type KineItem,
} from "@/lib/pathologie";

interface TraitementOption {
  id: string;
  nom: string;
  pathologie: string | null;
  user_id: string;
  is_platform: boolean;
}

export default function PathologieEdit() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [categorie, setCategorie] = useState<string>("");
  const [sections, setSections] = useState<Record<SectionKey, string>>(emptySections);
  // Sections en liste de blocs (mode "blocks"/"mixed") : items par clé de section.
  const [itemsBySection, setItemsBySection] = useState<Partial<Record<SectionKey, KineItem[]>>>({});
  const [traitement, setTraitement] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [isHiddenFromList, setIsHiddenFromList] = useState(false);
  const [isPlatform, setIsPlatform] = useState(false);
  const initialShareState = useRef<{ shared: boolean; validated: boolean }>({ shared: false, validated: false });

  const [ownerId, setOwnerId] = useState<string>("");
  const isOwner = !!user && !!ownerId && user.id === ownerId;
  const canEdit = isOwner || isAdmin;

  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [availableTraitements, setAvailableTraitements] = useState<TraitementOption[]>([]);
  const [availableExercices, setAvailableExercices] = useState<ExerciceOption[]>([]);
  const [objectifOptions, setObjectifOptions] = useState<string[]>([]);
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
      const owner = rec.user || "";
      setOwnerId(owner);

      // Page d'édition réservée à l'auteur ou à un admin.
      if (!(isAdmin || (user && owner && user.id === owner))) {
        toast.error("Lecture seule : édition réservée à l'auteur.");
        navigate(`/pathologies/${id}`);
        return;
      }

      setName(rec.name || "");
      setCategorie(rec.categorie || "");
      setTraitement(rec.traitement || "");
      const parsed = parseDescription(rec.description || "");
      const items: Partial<Record<SectionKey, KineItem[]>> = {};
      const texts = { ...parsed };
      for (const s of SECTIONS) {
        if (s.mode !== "text") {
          items[s.key] = parseKineItems(parsed[s.key]);
          texts[s.key] = "";
        }
      }
      setItemsBySection(items);
      setSections(texts);
      setLinkedIds(Array.isArray(rec.traitement_types) ? rec.traitement_types : []);
      setIsShared(!!rec.is_shared);
      setIsValidated(!!rec.is_validated);
      setIsHiddenFromList(!!rec.is_hidden_from_list);
      initialShareState.current = { shared: !!rec.is_shared, validated: !!rec.is_validated };

      try {
        const fp = await pb.collection("featured_pathologies").getFullList({
          filter: `pathologie = "${id}"`,
          fields: "id",
        });
        setIsPlatform((fp as any[]).length > 0);
      } catch {
        setIsPlatform(false);
      }

      const [mine, featured, exData] = await Promise.all([
        pb.collection("traitement_types").getFullList({
          filter: withActive(`user = "${user.id}"`),
          fields: "id,nom,pathologie,user",
        }),
        pb.collection("featured_traitements").getFullList({ fields: "traitement_type" }).catch(() => [] as any[]),
        pb.collection("exercices").getFullList({
          filter: withActive(`(user = "${user.id}" || status = "shared")`),
          sort: "title",
          fields: "id,title,user,status",
        }).catch(() => [] as any[]),
      ]);

      const platformIds = (featured as any[]).map((f) => f.traitement_type).filter(Boolean);
      const platformRecords = platformIds.length
        ? await pb.collection("traitement_types").getFullList({
            filter: withActive(platformIds.map((tid) => `id = "${tid}"`).join(" || ")),
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

      setAvailableExercices(
        (exData as any[]).map((e) => ({
          id: e.id,
          title: e.title || "Sans titre",
          is_platform: e.status === "shared" && e.user !== user.id,
        }))
      );

      await reloadObjectifs();
    } catch (e) {
      console.error(e);
      toast.error("Pathologie introuvable");
      navigate("/pathologies");
    } finally {
      setLoading(false);
    }
  };

  // Autosave. `contentChange` = modification de contenu : si un user non-admin
  // édite une patho déjà partagée+validée, on remet is_shared/is_validated à
  // false (re-proposition obligatoire).
  const saveField = async (patch: Record<string, unknown>, opts?: { contentChange?: boolean }) => {
    if (!id) return;
    const body: Record<string, unknown> = { ...patch };
    let reset = false;
    if (opts?.contentChange && !isAdmin && initialShareState.current.shared && initialShareState.current.validated) {
      body.is_shared = false;
      body.is_validated = false;
      reset = true;
    }
    try {
      await pb.collection("pathologies").update(id, body);
      if (reset) {
        setIsShared(false);
        setIsValidated(false);
        initialShareState.current = { shared: false, validated: false };
      }
      toast.success("Enregistré");
    } catch (e) {
      console.error(e);
      toast.error("Erreur d'enregistrement");
    }
  };

  // Liste des objectifs (bibliothèque) servant d'options aux mots-clés.
  const reloadObjectifs = async () => {
    if (!user) return;
    try {
      const data = await pb.collection("objectifs").getFullList({
        filter: withActive(`user = "${user.id}"`),
        fields: "name",
        sort: "name",
      });
      setObjectifOptions([
        ...new Set((data as any[]).map((o) => o.name).filter(Boolean)),
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const setSection = (key: SectionKey, value: string) =>
    setSections((prev) => ({ ...prev, [key]: value }));

  // Tags mots-clés courants (noms d'objectifs) dérivés de la section texte.
  const motsClesTags = useMemo(() => parseMotsCles(sections.mots_cles), [sections.mots_cles]);

  // Sauvegarde dédiée des mots-clés (stockés en texte dans la section mots_cles).
  const saveMotsCles = (tags: string[]) => {
    const value = serializeMotsCles(tags);
    const nextSections = { ...sections, mots_cles: value };
    setSections(nextSections);
    const cleaned = (Object.keys(nextSections) as SectionKey[]).reduce(
      (acc, k) => ({ ...acc, [k]: DOMPurify.sanitize(nextSections[k] || "") }),
      {} as Record<SectionKey, string>
    );
    saveField(
      { description: buildSectionsDescription(cleaned, cleanItemsBySection(itemsBySection)) },
      { contentChange: true }
    );
  };

  const addObjectif = (value: string) => {
    if (!value || motsClesTags.includes(value)) return;
    saveMotsCles([...motsClesTags, value]);
  };
  const removeObjectif = (tag: string) =>
    saveMotsCles(motsClesTags.filter((t) => t !== tag));

  // Désinfecte (DOMPurify) le HTML des sections texte + blocs avant stockage.
  const cleanSections = (): Record<SectionKey, string> =>
    (Object.keys(sections) as SectionKey[]).reduce(
      (acc, k) => ({ ...acc, [k]: DOMPurify.sanitize(sections[k] || "") }),
      {} as Record<SectionKey, string>
    );
  const cleanItems = (its: KineItem[]): KineItem[] =>
    its.map((it) =>
      it.type === "text"
        ? { type: "text", title: it.title || "", value: DOMPurify.sanitize(it.value) }
        : it
    );
  const cleanItemsBySection = (
    map: Partial<Record<SectionKey, KineItem[]>>
  ): Partial<Record<SectionKey, KineItem[]>> => {
    const out: Partial<Record<SectionKey, KineItem[]>> = {};
    for (const k of Object.keys(map) as SectionKey[]) out[k] = cleanItems(map[k] || []);
    return out;
  };

  // Sauvegarde d'une section texte (mode "text") — au blur.
  const saveSection = () =>
    saveField(
      { description: buildSectionsDescription(cleanSections(), cleanItemsBySection(itemsBySection)) },
      { contentChange: true }
    );

  // Sauvegarde d'une section en liste de blocs (mode "blocks"/"mixed").
  const saveSectionItems = (key: SectionKey, items: KineItem[]) => {
    const next = { ...itemsBySection, [key]: items };
    setItemsBySection(next);
    saveField(
      { description: buildSectionsDescription(cleanSections(), cleanItemsBySection(next)) },
      { contentChange: true }
    );
  };

  const setSectionItems = (key: SectionKey, items: KineItem[]) =>
    setItemsBySection((prev) => ({ ...prev, [key]: items }));

  const saveName = () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    saveField({ name: name.trim() }, { contentChange: true });
  };

  const saveCategorie = (value: string) => {
    setCategorie(value);
    saveField({ categorie: value || "" }, { contentChange: true });
  };

  const saveTraitement = () => saveField({ traitement: DOMPurify.sanitize(traitement) }, { contentChange: true });

  const saveLinks = (ids: string[]) => {
    setLinkedIds(ids);
    saveField({ traitement_types: ids }, { contentChange: true });
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await softDelete("pathologies", id);
      toast.success("Pathologie déplacée vers la corbeille");
      navigate("/pathologies");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    }
  };

  const traitementsById = useMemo(() => {
    const m = new Map<string, TraitementOption>();
    for (const t of availableTraitements) m.set(t.id, t);
    return m;
  }, [availableTraitements]);

  const linkedTraitements = linkedIds
    .map((tid) => traitementsById.get(tid))
    .filter((t): t is TraitementOption => !!t);

  const addLinkById = (tid: string) => {
    if (!linkedIds.includes(tid)) saveLinks([...linkedIds, tid]);
  };
  const removeLink = (tid: string) => saveLinks(linkedIds.filter((x) => x !== tid));

  const minePicker = availableTraitements.filter((t) => !t.is_platform && !linkedIds.includes(t.id));
  const platformPicker = availableTraitements.filter((t) => t.is_platform && !linkedIds.includes(t.id));

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
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate(`/pathologies/${id}`)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour à la fiche
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Éditer : {name || "Pathologie"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="general">
                <TabsList className="flex flex-wrap h-auto justify-start gap-1">
                  <TabsTrigger value="general">Général</TabsTrigger>
                  {SECTIONS.map(({ key, label }) => (
                    <TabsTrigger key={key} value={key}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Onglet Général */}
                <TabsContent value="general" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={saveName}
                      placeholder="Nom de la pathologie"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categorie">Catégorie</Label>
                    <Select value={categorie} onValueChange={saveCategorie}>
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
                    <Label>Notes libres (legacy)</Label>
                    <RichTextEditor
                      value={traitement}
                      onChange={setTraitement}
                      onBlur={saveTraitement}
                      placeholder="Notes libres, à migrer progressivement vers la description structurée."
                      minHeight={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Traitements liés</Label>
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
                            <X className="w-3 h-3 cursor-pointer hover:opacity-70" onClick={() => removeLink(t.id)} />
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

                  {!isPlatform && (
                    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                      <div className="space-y-1">
                        <Label htmlFor="is-shared" className="text-sm font-medium">
                          Visible par les autres utilisateurs
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {isAdmin
                            ? "Marque la pathologie comme partagée. La validation se fait dans la section Admin (création d'une copie publique)."
                            : "Soumet la pathologie au partage. Un administrateur doit ensuite la valider."}
                        </p>
                        {isShared && !isValidated && !isAdmin && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            En attente de validation par un administrateur.
                          </p>
                        )}
                      </div>
                      <Switch
                        id="is-shared"
                        checked={isShared}
                        onCheckedChange={(v) => {
                          setIsShared(v);
                          saveField({ is_shared: v });
                        }}
                      />
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex items-start justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 p-3">
                      <div className="space-y-1">
                        <Label htmlFor="is-visible-non-admin" className="text-sm font-medium flex items-center gap-1.5">
                          <Shield className="w-3 h-3" />
                          Visible pour les non-admins
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Contrôle admin. Désactivé → cette pathologie est masquée à tous les utilisateurs non-admins.
                          Les admins continuent de la voir.
                        </p>
                      </div>
                      <Switch
                        id="is-visible-non-admin"
                        checked={!isHiddenFromList}
                        onCheckedChange={(v) => {
                          const hidden = !v;
                          setIsHiddenFromList(hidden);
                          saveField({ is_hidden_from_list: hidden });
                        }}
                      />
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      className="text-destructive gap-2"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer la pathologie
                    </Button>
                  </div>
                </TabsContent>

                {/* Onglet Traitement kiné */}
                {/* Onglets de sections : liste de blocs (mixte/blocks) ou texte simple */}
                {SECTIONS.map(({ key, label, mode }) => (
                  <TabsContent key={key} value={key} className="mt-4 space-y-2">
                    {mode === "text" ? (
                      key === "mots_cles" ? (
                        <>
                          <Label>{label}</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {motsClesTags.map((tag) => (
                              <Badge key={tag} variant="default" className="gap-1">
                                {tag}
                                <X
                                  className="w-3 h-3 cursor-pointer"
                                  onClick={() => removeObjectif(tag)}
                                />
                              </Badge>
                            ))}
                            {motsClesTags.length === 0 && (
                              <span className="text-xs text-muted-foreground">
                                Aucun objectif sélectionné
                              </span>
                            )}
                          </div>
                          <TagReferenceSelect
                            type="objectif"
                            options={objectifOptions.filter((o) => !motsClesTags.includes(o))}
                            userId={user.id}
                            onSelect={addObjectif}
                            onReferenceChanged={reloadObjectifs}
                            placeholder="Rechercher ou créer un objectif"
                            className="w-full"
                          />
                        </>
                      ) : (
                        <>
                          <Label>{label}</Label>
                          <RichTextEditor
                            value={sections[key]}
                            onChange={(html) => setSection(key, html)}
                            onBlur={saveSection}
                            placeholder={`Saisir ${label.toLowerCase()}…`}
                            minHeight={260}
                          />
                        </>
                      )
                    ) : (
                      <KineEditor
                        items={itemsBySection[key] || []}
                        exercices={availableExercices}
                        readOnly={!canEdit}
                        allowExercice={mode === "mixed"}
                        label={label}
                        onChange={(items) => setSectionItems(key, items)}
                        onSave={(items) => saveSectionItems(key, items)}
                      />
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette pathologie ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {name} » sera déplacée vers la corbeille (récupérable depuis la page Corbeille). Les
                exercices, séances et traitements qui l'utilisent comme tag conserveront le tag tel quel.
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
