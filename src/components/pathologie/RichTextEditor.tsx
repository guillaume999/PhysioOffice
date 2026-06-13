import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, RemoveFormatting } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
}

// Éditeur de texte mis en forme, sans dépendance externe ni popup.
// Basé sur un contentEditable + document.execCommand. Émet du HTML ; la
// désinfection (DOMPurify) est faite côté sauvegarde/affichage.
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  readOnly = false,
  minHeight = 160,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);

  // Synchronise le contenu (uncontrolled) sans casser le curseur : on ne
  // réécrit le DOM que si l'éditeur n'a PAS le focus (montage, réordonnancement,
  // reset externe). Pendant la frappe (focus), on laisse le DOM tel quel.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
    setEmpty(!el.textContent?.trim());
  }, [value]);

  const emit = () => {
    const html = ref.current?.innerHTML || "";
    setEmpty(!ref.current?.textContent?.trim());
    onChange(html);
  };

  const exec = (cmd: string, arg?: string) => {
    if (readOnly) return;
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const btn =
    "h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground";

  return (
    <div className="rounded-md border">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
          <button type="button" className={btn} aria-label="Gras" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={btn} aria-label="Italique" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={btn} aria-label="Souligné" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}>
            <Underline className="w-3.5 h-3.5" />
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" className={btn} aria-label="Liste à puces" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
            <List className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={btn} aria-label="Liste numérotée" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" className={btn} aria-label="Effacer la mise en forme" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}>
            <RemoveFormatting className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={onBlur}
        data-placeholder={placeholder}
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none px-3 py-2 focus:outline-none",
          empty &&
            "before:content-[attr(data-placeholder)] before:text-muted-foreground before:pointer-events-none before:block"
        )}
        style={{ minHeight }}
      />
    </div>
  );
}
