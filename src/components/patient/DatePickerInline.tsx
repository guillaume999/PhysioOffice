import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DatePickerInlineProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (value: string) => void;
  className?: string;
  title?: string;
  placeholder?: string;
}

export function DatePickerInline({
  value,
  onChange,
  className,
  title,
  placeholder = "Date",
}: DatePickerInlineProps) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const date = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          title={title}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "justify-start text-left font-normal gap-2 px-2",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {date ? format(date, "dd/MM/yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            else onChange("");
            setOpen(false);
          }}
          initialFocus
          locale={fr}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
