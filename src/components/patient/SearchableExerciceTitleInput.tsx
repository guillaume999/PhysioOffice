import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExerciceOption {
  id: string;
  code?: string;
  title: string;
  description?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectExercice?: (ex: ExerciceOption) => void;
  options: ExerciceOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Title input combined with a search popover over the user's existing exercises.
 * Users can type free text or pick an existing exercise from the searchable list.
 */
export function SearchableExerciceTitleInput({
  value,
  onChange,
  onSelectExercice,
  options,
  placeholder = "Nom de l'exercice",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            title="Rechercher dans mes exercices"
          >
            <Search className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Rechercher un exercice..." />
            <CommandList>
              <CommandEmpty>Aucun exercice trouvé.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={`${opt.title} ${opt.code ?? ""}`}
                    onSelect={() => {
                      onSelectExercice?.(opt);
                      onChange(opt.title);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.title ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt.code && (
                      <span className="font-mono text-xs uppercase text-muted-foreground mr-2">
                        {opt.code}
                      </span>
                    )}
                    <span className="truncate">{opt.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
