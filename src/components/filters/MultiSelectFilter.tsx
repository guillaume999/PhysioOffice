import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, ListFilter, X } from "lucide-react";

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export function MultiSelectFilter({ label, options, selected, onToggle, onClear }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={selected.length > 0 ? "default" : "outline"}
          size="sm"
          className="h-10 gap-1.5"
        >
          <ListFilter className="w-4 h-4" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 text-xs">
              {selected.length}
            </Badge>
          )}
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Filtrer ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Aucun résultat</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => onToggle(option)}
                  >
                    <div
                      className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    {option}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onClear(); setOpen(false); }}
              className="w-full h-8 text-muted-foreground"
            >
              Effacer la sélection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Badges des tags actifs, supprimables d'un clic. */
export function ActiveFilterBadges({
  pathoFilter,
  objectifFilter,
  onTogglePatho,
  onToggleObjectif,
}: {
  pathoFilter: string[];
  objectifFilter: string[];
  onTogglePatho: (tag: string) => void;
  onToggleObjectif: (tag: string) => void;
}) {
  if (pathoFilter.length === 0 && objectifFilter.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pathoFilter.map((tag) => (
        <Badge key={`p-${tag}`} variant="secondary" className="gap-1">
          {tag}
          <X className="w-3 h-3 cursor-pointer" onClick={() => onTogglePatho(tag)} />
        </Badge>
      ))}
      {objectifFilter.map((tag) => (
        <Badge key={`o-${tag}`} variant="default" className="gap-1">
          {tag}
          <X className="w-3 h-3 cursor-pointer" onClick={() => onToggleObjectif(tag)} />
        </Badge>
      ))}
    </div>
  );
}
