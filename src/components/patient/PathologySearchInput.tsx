import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Search } from "lucide-react";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Multi-select pathology picker with search. Users can pick existing pathologies
 * from their library or add a new one by typing and pressing Enter / clicking add.
 */
export function PathologySearchInput({
  selected,
  onChange,
  options,
  placeholder = "Rechercher ou ajouter une pathologie...",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const addPatho = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange([...selected, v]);
    setQuery("");
  };

  const removePatho = (value: string) => {
    onChange(selected.filter((p) => p !== value));
  };

  const availableOptions = options.filter((o) => !selected.includes(o));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1">
              {p}
              {!disabled && (
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => removePatho(p)}
                />
              )}
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="w-full justify-start text-muted-foreground font-normal"
          >
            <Search className="w-3 h-3 mr-2" />
            {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput
              placeholder="Rechercher une pathologie..."
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  e.preventDefault();
                  addPatho(query);
                  setOpen(false);
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {query.trim() ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full text-sm px-2 py-1.5 hover:bg-accent rounded"
                    onClick={() => {
                      addPatho(query);
                      setOpen(false);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Ajouter "{query.trim()}"
                  </button>
                ) : (
                  "Aucune pathologie trouvée."
                )}
              </CommandEmpty>
              <CommandGroup>
                {availableOptions.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      addPatho(opt);
                      setOpen(false);
                    }}
                  >
                    {opt}
                  </CommandItem>
                ))}
                {query.trim() && !availableOptions.some(o => o.toLowerCase() === query.trim().toLowerCase()) && !selected.some(s => s.toLowerCase() === query.trim().toLowerCase()) && (
                  <CommandItem
                    value={`__add__${query}`}
                    onSelect={() => {
                      addPatho(query);
                      setOpen(false);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-2" />
                    Ajouter "{query.trim()}"
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
