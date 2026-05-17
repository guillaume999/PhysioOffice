import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable combobox: type to filter existing options, or create a new one
 * when no match exists. Calls onSelect with the picked or created value.
 */
export function SearchableCreatableSelect({ options, onSelect, placeholder = "Rechercher...", className }: Props) {
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
            placeholder="Rechercher ou créer..."
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
                  Créer "{query.trim()}"
                </button>
              ) : (
                "Aucun résultat."
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => pick(opt)}>
                  {opt}
                </CommandItem>
              ))}
              {query.trim() && !exactExists && (
                <CommandItem value={`__add__${query}`} onSelect={() => pick(query)}>
                  <Plus className="w-3 h-3 mr-2" />
                  Créer "{query.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
