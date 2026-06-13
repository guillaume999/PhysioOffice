import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import {
  Plus,
  Dumbbell,
  X,
  Shield,
  User as UserIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { RichTextEditor } from "@/components/pathologie/RichTextEditor";
import type { KineItem } from "@/lib/pathologie";

export interface ExerciceOption {
  id: string;
  title: string;
  is_platform: boolean;
}

interface KineEditorProps {
  items: KineItem[];
  exercices: ExerciceOption[];
  readOnly: boolean;
  // Autorise l'ajout de références à des exercices (sinon blocs texte seuls).
  allowExercice?: boolean;
  // Libellé optionnel affiché en en-tête (sinon seul le compteur s'affiche).
  label?: string;
  // Mise à jour d'état (frappe) — ne persiste pas.
  onChange: (items: KineItem[]) => void;
  // Persiste les éléments (ajout / retrait / déplacement / perte de focus).
  onSave: (items: KineItem[]) => void;
}

// Éditeur de section en liste : suite ordonnée de blocs texte (tiroirs titre +
// contenu mis en forme) et, si autorisé, de références à des exercices types.
export function KineEditor({
  items,
  exercices,
  readOnly,
  allowExercice = true,
  label,
  onChange,
  onSave,
}: KineEditorProps) {
  const exById = useMemo(() => {
    const m = new Map<string, ExerciceOption>();
    for (const e of exercices) m.set(e.id, e);
    return m;
  }, [exercices]);

  const mineEx = exercices.filter((e) => !e.is_platform);
  const platEx = exercices.filter((e) => e.is_platform);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);

  const addText = () => onChange([...items, { type: "text", title: "", value: "" }]);

  const setText = (i: number, html: string) =>
    onChange(items.map((x, idx) => (idx === i && x.type === "text" ? { ...x, value: html } : x)));

  const setTitle = (i: number, title: string) =>
    onChange(items.map((x, idx) => (idx === i && x.type === "text" ? { ...x, title } : x)));

  const remove = (i: number) => onSave(items.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onSave(next);
  };

  const addExercice = (exId: string) => {
    onSave([...items, { type: "exercice", id: exId }]);
    setPickerOpen(false);
  };

  const MoveControls = ({ i }: { i: number }) => (
    <div className="flex flex-col">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        disabled={i === 0}
        onClick={() => move(i, -1)}
        aria-label="Monter"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        disabled={i === items.length - 1}
        onClick={() => move(i, 1)}
        aria-label="Descendre"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          {label}
          {items.length > 0 && (
            <Badge variant="outline" className="text-[10px] py-0">
              {items.length}
            </Badge>
          )}
        </Label>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 gap-1" onClick={addText}>
              <Plus className="w-3.5 h-3.5" />
              Texte
            </Button>
            {allowExercice && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 gap-1">
                  <Dumbbell className="w-3.5 h-3.5" />
                  Exercice
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Rechercher un exercice…" />
                  <CommandList>
                    <CommandEmpty>Aucun exercice disponible.</CommandEmpty>
                    {mineEx.length > 0 && (
                      <CommandGroup heading="Mes exercices">
                        {mineEx.map((e) => (
                          <CommandItem key={e.id} value={`mine ${e.title} ${e.id}`} onSelect={() => addExercice(e.id)}>
                            <UserIcon className="w-3 h-3 mr-2 text-muted-foreground" />
                            <span className="flex-1">{e.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {platEx.length > 0 && (
                      <CommandGroup heading="Plateforme">
                        {platEx.map((e) => (
                          <CommandItem key={e.id} value={`platform ${e.title} ${e.id}`} onSelect={() => addExercice(e.id)}>
                            <Shield className="w-3 h-3 mr-2 text-primary" />
                            <span className="flex-1">{e.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            )}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <span className="text-sm text-muted-foreground italic">Vide</span>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) =>
            it.type === "text" ? (
              <Collapsible key={i} defaultOpen={!(it.value || "").trim()} className="rounded-md border">
                <div className="flex items-center gap-1 p-1.5">
                  {!readOnly && <MoveControls i={i} />}
                  <Input
                    value={it.title || ""}
                    onChange={(e) => setTitle(i, e.target.value)}
                    onBlur={() => onSave(items)}
                    placeholder="Titre…"
                    disabled={readOnly}
                    className="h-7 flex-1 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
                  />
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="group h-6 w-6 shrink-0">
                      <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground"
                      onClick={() => setPendingRemove(i)}
                      aria-label="Retirer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <CollapsibleContent className="px-1.5 pb-1.5">
                  <RichTextEditor
                    value={it.value}
                    readOnly={readOnly}
                    placeholder="Saisir le texte…"
                    minHeight={90}
                    onChange={(html) => setText(i, html)}
                    onBlur={() => onSave(items)}
                  />
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <div key={i} className="flex items-center gap-2">
                {!readOnly && <MoveControls i={i} />}
                <div className="flex flex-1 items-center gap-1.5 rounded-md border bg-muted/30 p-2 text-sm">
                  <Dumbbell className="w-3.5 h-3.5 text-primary shrink-0" />
                  {exById.get(it.id)?.title ?? <span className="italic text-muted-foreground">Exercice introuvable</span>}
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground"
                    onClick={() => remove(i)}
                    aria-label="Retirer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )
          )}
        </div>
      )}

      <AlertDialog open={pendingRemove !== null} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRemove !== null && items[pendingRemove]?.type === "exercice"
                ? "Retirer cet exercice ?"
                : "Supprimer ce bloc texte ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove !== null && items[pendingRemove]?.type === "exercice"
                ? "L'exercice sera retiré de la section Traitement kiné. L'exercice de la bibliothèque n'est pas supprimé."
                : "Le contenu de ce bloc texte sera définitivement supprimé."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemove !== null) remove(pendingRemove);
                setPendingRemove(null);
              }}
            >
              {pendingRemove !== null && items[pendingRemove]?.type === "exercice" ? "Retirer" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
