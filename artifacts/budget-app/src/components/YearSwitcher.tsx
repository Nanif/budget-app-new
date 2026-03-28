import { useState } from "react";
import { useBudgetYear, BudgetYear } from "@/contexts/BudgetYearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Check, ChevronDown, Plus, Calendar, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function YearSwitcher() {
  const { years, activeBid, activeYear, setViewedYear, createYear } = useBudgetYear();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const nextYear = now.getFullYear() + 1;
  const [form, setForm] = useState({
    name: `שנת תקציב ${nextYear}`,
    startDate: `${nextYear}-01-01`,
    endDate: `${nextYear}-12-31`,
    totalBudget: "",
    tithePercentage: "10",
  });

  const handleSelect = (year: BudgetYear) => {
    setViewedYear(year.id);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      toast({ title: "שגיאה", description: "נא למלא את כל השדות", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createYear({
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        totalBudget: form.totalBudget || "0",
        tithePercentage: form.tithePercentage || "10",
        isActive: false,
      });
      toast({ title: "שנת תקציב נוצרה", description: form.name });
      setShowCreate(false);
      setOpen(false);
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
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
              <button
                key={year.id}
                onClick={() => handleSelect(year)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-start",
                  year.id === activeBid
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <Check className={cn("w-4 h-4 shrink-0", year.id === activeBid ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 truncate">{year.name}</span>
                {year.isActive && (
                  <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">פעיל</span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t mt-1.5 pt-1.5">
            <button
              onClick={() => { setOpen(false); setShowCreate(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>צור שנת תקציב חדשה</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>צור שנת תקציב חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם השנה</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder='לדוגמה: שנת תקציב 2026'
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך התחלה</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>תאריך סיום</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תקציב שנתי (₪)</Label>
                <Input
                  type="number"
                  value={form.totalBudget}
                  onChange={e => setForm(f => ({ ...f, totalBudget: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>אחוז מעשר (%)</Label>
                <Input
                  type="number"
                  value={form.tithePercentage}
                  onChange={e => setForm(f => ({ ...f, tithePercentage: e.target.value }))}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>ביטול</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              צור שנה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
