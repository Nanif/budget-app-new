import { useState, useEffect } from "react";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { useCashCurrentMonth } from "@/hooks/useCashCurrentMonth";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES_HE = ["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];

export function MonthSwitcher() {
  const { activeBid, activeYear } = useBudgetYear();
  const { currentMonth, setCurrentMonth } = useCashCurrentMonth(activeBid);
  const [open, setOpen] = useState(false);

  const minMonth = activeYear?.startDate ? activeYear.startDate.slice(0, 7) : "2000-01";
  const maxMonth = activeYear?.endDate ? activeYear.endDate.slice(0, 7) : "2099-12";

  const minYear = parseInt(minMonth.slice(0, 4), 10);
  const maxYear = parseInt(maxMonth.slice(0, 4), 10);

  const [selYear, setSelYear] = useState(() => parseInt(currentMonth.split("-")[0]));
  useEffect(() => { setSelYear(parseInt(currentMonth.split("-")[0])); }, [currentMonth]);

  const [cmYear, cmMonthNum] = currentMonth.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES_HE[cmMonthNum - 1]} ${cmYear}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/15 transition-colors group">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 text-start text-sm font-medium text-sidebar-foreground truncate">
            {monthLabel}
          </span>
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-64 p-3" sideOffset={6}>
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-1 pb-2">בחירת חודש</p>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setSelYear(y => y - 1)}
            disabled={selYear <= minYear}
            className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold">{selYear}</span>
          <button
            onClick={() => setSelYear(y => y + 1)}
            disabled={selYear >= maxYear}
            className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => {
            const mStr = `${selYear}-${String(i + 1).padStart(2, "0")}`;
            const isSelected = mStr === currentMonth;
            const outOfRange = mStr < minMonth || mStr > maxMonth;
            return (
              <button
                key={mStr}
                onClick={() => { setCurrentMonth(mStr); setOpen(false); }}
                disabled={outOfRange}
                className={cn(
                  "rounded-xl py-2 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 hover:bg-muted text-foreground",
                  outOfRange && "opacity-20 cursor-default",
                )}
              >
                {MONTH_NAMES_HE[i]}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
