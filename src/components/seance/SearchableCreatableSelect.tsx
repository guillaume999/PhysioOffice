import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  options: string[];
  onSelect: (value: string) => void;
  onEdit?: (value: string) => void;
  onDelete?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableCreatableSelect({ options, onSelect, onEdit, onDelete, placeholder = "Rechercher...", className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const pick = (v: string) => {
    const t = v.trim();
    if (!t) return;
    onSelect(t);
    setQuery("");
    setOpen(false);
  };

  const exactExists = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("justify-between font-normal text-muted-foreground", className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3 h-3" />
            {placeholder}
          </span>
          <ChevronsUpDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Rechercher ou creer..."
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim() && !exactExists) {
                e.preventDefault();
                pick(query);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? (
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-sm px-2 py-1.5 hover:bg-accent rounded"
                  onClick={() => pick(query)}
                >
                  <Plus className="w-3 h-3" />
                  Creer "{query.trim()}"
                </button>
              ) : (
                "Aucun resultat."
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => pick(opt)} className="group">
                  <span className="flex-1 truncate">{opt}</span>
                  {(onEdit || onDelete) && (
                    <span className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                      {onEdit && (
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted"
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onEdit(opt); }}
                          title="Renommer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted text-destructive"
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete(opt); }}
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  )}
                </CommandItem>
              ))}
              {query.trim() && !exactExists && (
                <CommandItem value={`__add__${query}`} onSelect={() => pick(query)}>
                  <Plus className="w-3 h-3 mr-2" />
                  Creer "{query.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
