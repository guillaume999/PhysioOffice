import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Shield,
  User as UserIcon,
  Dumbbell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { MediaThumb } from "@/components/MediaThumb";
import { ExercicePreviewDialog, type ExercicePreview } from "@/components/exercice/ExercicePreviewDialog";
import { CopyExerciceToSeanceDialog } from "@/components/pathologie/CopyExerciceToSeanceDialog";
import { LinkedTraitementDrawer } from "@/components/pathologie/LinkedTraitementDrawer";
import {
  SECTIONS,
  SectionKey,
  emptySections,
  looksLikeHtml,
  parseDescription,
  parseKineItems,
  parseMotsCles,
  type KineItem,
} from "@/lib/pathologie";

interface TraitementOption {
  id: string;
  nom: string;
  is_platform: boolean;
}

// Affiche du contenu mis en forme (HTML assaini) ou, pour le texte legacy,
// du texte brut en préservant les sauts de ligne.
function RichText({ value }: { value: string }) {
  if (looksLikeHtml(value)) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
      />
    );
  }
  return <p className="text-sm whitespace-pre-wrap break-words">{value}</p>;
}

// Bloc repliable (tiroir) avec titre, pour la vue détail.
function DetailDrawer({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// Rendu lecture seule d'une section en liste de blocs : blocs texte en
// sous-tiroirs (titre + contenu), exercices en cartes (vignette + code + titre
// + tags) ouvrant l'aperçu, comme sur la page Exercices.
function ItemsView({
  items,
  exById,
  onOpenExercice,
}: {
  items: KineItem[];
  exById: Map<string, ExercicePreview>;
  onOpenExercice: (ex: ExercicePreview) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        if (it.type === "text") {
          return (
            <Collapsible key={i} className="rounded-md border">
              <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
                <span className="text-sm font-medium">{it.title?.trim() || "Texte"}</span>
                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <RichText value={it.value} />
              </CollapsibleContent>
            </Collapsible>
          );
        }
        const ex = exById.get(it.id);
        if (!ex) {
          return (
            <div key={i} className="flex items-center gap-1.5 px-1 text-sm">
              <Dumbbell className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="italic text-muted-foreground">Exercice introuvable</span>
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onOpenExercice(ex)}
            className="flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted/50"
          >
            <MediaThumb source={ex} alt={ex.title} className="w-14 h-10 shrink-0" showPlayIcon />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {ex.code && (
                  <Badge variant="outline" className="font-mono text-xs uppercase px-1.5 py-0.5 bg-muted/50">
                    {ex.code}
                  </Badge>
                )}
                <span className="truncate text-sm font-medium">{ex.title}</span>
              </div>
              {ex.pathologie_tags && ex.pathologie_tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {ex.pathologie_tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function PathologieDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [categorie, setCategorie] = useState<string>("");
  const [sections, setSections] = useState<Record<SectionKey, string>>(emptySections);
  const [itemsBySection, setItemsBySection] = useState<Partial<Record<SectionKey, KineItem[]>>>({});
  const [traitement, setTraitement] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const [ownerId, setOwnerId] = useState<string>("");
  const [authorName, setAuthorName] = useState<string>("");
  const isOwner = !!user && !!ownerId && user.id === ownerId;
  const canEdit = isOwner || isAdmin;
  const readOnly = !canEdit;

  const [navOrder, setNavOrder] = useState<string[]>([]);
  useEffect(() => {
    const raw = sessionStorage.getItem("pathologies_nav_ctx");
    if (raw) {
      try {
        const ctx = JSON.parse(raw);
        if (Array.isArray(ctx.orderedIds)) setNavOrder(ctx.orderedIds);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const [linkedTraitements, setLinkedTraitements] = useState<TraitementOption[]>([]);
  const [exById, setExById] = useState<Map<string, ExercicePreview>>(new Map());
  const [previewEx, setPreviewEx] = useState<ExercicePreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyEx, setCopyEx] = useState<ExercicePreview | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const openExercice = (ex: ExercicePreview) => {
    setPreviewEx(ex);
    setPreviewOpen(true);
  };

  const copyExercice = (ex: ExercicePreview) => {
    setPreviewOpen(false);
    setCopyEx(ex);
    setCopyOpen(true);
  };

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
      setTraitement(rec.traitement || "");
      setOwnerId(rec.user || "");
      setAuthorName(rec.author_name || "");
      setIsShared(!!rec.is_shared);
      setIsValidated(!!rec.is_validated);

      // Split sections : texte simple vs liste de blocs (JSON).
      const parsed = parseDescription(rec.description || "");
      const texts = { ...parsed };
      const itemsMap: Partial<Record<SectionKey, KineItem[]>> = {};
      const exIds = new Set<string>();
      for (const s of SECTIONS) {
        if (s.mode !== "text") {
          const its = parseKineItems(parsed[s.key]);
          itemsMap[s.key] = its;
          its.forEach((it) => {
            if (it.type === "exercice") exIds.add(it.id);
          });
          texts[s.key] = "";
        }
      }
      setSections(texts);
      setItemsBySection(itemsMap);

      const linkedIds: string[] = Array.isArray(rec.traitement_types) ? rec.traitement_types : [];
      const exIdList = [...exIds];

      const [traits, exs] = await Promise.all([
        linkedIds.length
          ? pb.collection("traitement_types").getFullList({
              filter: linkedIds.map((tid) => `id = "${tid}"`).join(" || "),
              fields: "id,nom,user",
            })
          : Promise.resolve([] as any[]),
        exIdList.length
          ? pb.collection("exercices").getFullList({
              filter: exIdList.map((eid) => `id = "${eid}"`).join(" || "),
              fields:
                "id,code,title,description,video_url,thumbnail_url,image_url,media_type,pathologie_tags,objectif_tags,user,author_name",
            }).catch(() => [] as any[])
          : Promise.resolve([] as any[]),
      ]);

      setLinkedTraitements(
        linkedIds
          .map((tid) => {
            const t = (traits as any[]).find((x) => x.id === tid);
            if (!t) return null;
            return { id: t.id, nom: t.nom || "Sans nom", is_platform: t.user !== user.id };
          })
          .filter((t): t is TraitementOption => !!t)
      );

      const m = new Map<string, ExercicePreview>();
      for (const e of exs as any[])
        m.set(e.id, {
          id: e.id,
          code: e.code || "",
          title: e.title || "Sans titre",
          description: e.description || null,
          video_url: e.video_url || null,
          thumbnail_url: e.thumbnail_url || null,
          image_url: e.image_url || null,
          media_type: e.media_type || null,
          pathologie_tags: Array.isArray(e.pathologie_tags) ? e.pathologie_tags : [],
          objectif_tags: Array.isArray(e.objectif_tags) ? e.objectif_tags : [],
          author_name: e.author_name || null,
          user_id: e.user || null,
        });
      setExById(m);
    } catch (e) {
      console.error(e);
      toast.error("Pathologie introuvable");
      navigate("/pathologies");
    } finally {
      setLoading(false);
    }
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

  const currentIdx = id ? navOrder.indexOf(id) : -1;
  const prevId = currentIdx > 0 ? navOrder[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < navOrder.length - 1 ? navOrder[currentIdx + 1] : null;

  // Sections à afficher (non vides), dans l'ordre.
  const visibleSections = SECTIONS.filter((s) =>
    s.mode === "text" ? (sections[s.key] || "").trim().length > 0 : (itemsBySection[s.key] || []).length > 0
  );

  const isEmpty =
    visibleSections.length === 0 && !traitement.trim() && linkedTraitements.length === 0;

  return (
    <Layout>
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate("/pathologies")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          {navOrder.length > 1 && currentIdx >= 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!prevId}
                onClick={() => prevId && navigate(`/pathologies/${prevId}`)}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédente
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentIdx + 1} / {navOrder.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextId}
                onClick={() => nextId && navigate(`/pathologies/${nextId}`)}
                className="gap-1"
              >
                Suivante
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle className="text-2xl">{name || "Pathologie"}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {categorie && <Badge variant="secondary">{categorie}</Badge>}
                    {readOnly ? (
                      <Badge variant="outline" className="gap-1.5">
                        <Shield className="w-3 h-3" />
                        Lecture seule {authorName ? `(${authorName})` : ""}
                      </Badge>
                    ) : (
                      isShared && (
                        <Badge variant="outline" className="gap-1.5">
                          {isValidated ? "Partagée" : "En attente de validation"}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Button onClick={() => navigate(`/pathologies/${id}/edit`)} className="gap-2 shrink-0">
                    <Pencil className="w-4 h-4" />
                    Modifier
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleSections.map(({ key, label, mode }) => (
                <DetailDrawer key={key} title={label}>
                  {mode === "text" ? (
                    key === "mots_cles" ? (
                      <div className="flex flex-wrap gap-2">
                        {parseMotsCles(sections[key]).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <RichText value={sections[key]} />
                    )
                  ) : (
                    <ItemsView
                      items={itemsBySection[key] || []}
                      exById={exById}
                      onOpenExercice={openExercice}
                    />
                  )}
                </DetailDrawer>
              ))}

              {traitement.trim() && (
                <DetailDrawer title="Notes">
                  <RichText value={traitement} />
                </DetailDrawer>
              )}

              {linkedTraitements.length > 0 && (
                <DetailDrawer title="Traitements liés">
                  <div className="space-y-2">
                    {linkedTraitements.map((t) => (
                      <LinkedTraitementDrawer
                        key={t.id}
                        id={t.id}
                        nom={t.nom}
                        isPlatform={t.is_platform}
                        onOpenExercice={openExercice}
                      />
                    ))}
                  </div>
                </DetailDrawer>
              )}

              {isEmpty && (
                <p className="text-sm text-muted-foreground italic">
                  Aucune information renseignée.
                  {canEdit && " Cliquez sur « Modifier » pour compléter la fiche."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <ExercicePreviewDialog
          exercice={previewEx}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onCopyToSeance={copyExercice}
        />
        <CopyExerciceToSeanceDialog exercice={copyEx} open={copyOpen} onOpenChange={setCopyOpen} />
      </div>
    </Layout>
  );
}
