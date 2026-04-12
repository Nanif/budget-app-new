import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarRange, Check, ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Year = { id: number; name: string };

type Props = {
  years: Year[];
  active: boolean;
  selectedIds: number[];
  onToggle: () => void;
  onSelectIds: (ids: number[]) => void;
};

export function AllYearsToggle({ years, active, selectedIds, onToggle, onSelectIds }: Props) {
  const [open, setOpen] = useState(false);
  const allSelected = selectedIds.length === years.length;

  const toggleYear = (id: number) => {
    onSelectIds(
      selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]
    );
  };

  /* ── inactive state: single button ─────────────────────── */
  if (!active) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="h-9 gap-1.5 rounded-xl"
      >
        <CalendarRange className="w-3.5 h-3.5" />
        כל השנים
      </Button>
    );
  }

  /* ── active state: two separate buttons ─────────────────── */
  const yearsLabel = allSelected
    ? "כל השנים"
    : `${selectedIds.length} שנים`;

  return (
    <div className="flex items-center gap-1.5">
      {/* Return button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="h-9 gap-1.5 rounded-xl border-primary/40 text-primary hover:bg-primary/5 hover:border-primary/60"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        תקציב נוכחי
      </Button>

      {/* Year picker dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 gap-1.5 rounded-xl"
          >
            <CalendarRange className="w-3.5 h-3.5" />
            {yearsLabel}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start" dir="rtl">
          <div className="flex items-center justify-between px-1.5 pb-2 border-b border-border/50 mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground">בחר שנים להצגה</span>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => onSelectIds(allSelected ? [] : years.map(y => y.id))}
            >
              {allSelected ? "בטל הכל" : "בחר הכל"}
            </button>
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {years.map(year => {
              const sel = selectedIds.includes(year.id);
              return (
                <button
                  key={year.id}
                  onClick={() => toggleYear(year.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm"
                >
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    sel ? "bg-primary border-primary" : "border-muted-foreground/40"
                  )}>
                    {sel && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="flex-1 text-right truncate">{year.name}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
