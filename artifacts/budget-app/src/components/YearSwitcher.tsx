import { useState } from "react";
import { useBudgetYear, BudgetYear } from "@/contexts/BudgetYearContext";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, Calendar, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function YearSwitcher() {
  const { years, activeBid, activeYear, setViewedYear, activateYear } = useBudgetYear();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handleSelect = async (year: BudgetYear) => {
    if (year.id === activeBid) { setOpen(false); return; }
    setLoadingId(year.id);
    try {
      await activateYear(year.id);
      setViewedYear(year.id);
    } catch {
      toast({ title: "שגיאה במעבר שנה", variant: "destructive" });
    } finally {
      setLoadingId(null);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/15 transition-colors group">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 text-start text-sm font-medium text-sidebar-foreground truncate">
            {activeYear?.name || "טוען..."}
          </span>
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-64 p-1.5"
        sideOffset={6}
      >
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 py-1.5">שנות תקציב</p>
        <div className="space-y-0.5">
          {years.map(year => (
            <div
              key={year.id}
              onClick={() => handleSelect(year)}
              className={cn(
                "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
                year.id === activeBid
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              )}
            >
              {loadingId === year.id
                ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                : <Check className={cn("w-3.5 h-3.5 shrink-0", year.id === activeBid ? "opacity-100" : "opacity-0")} />
              }
              <span className="flex-1 truncate text-xs">{year.name}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
