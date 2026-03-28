import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  Plus, Pencil, Trash2, Loader2, ListChecks,
  TrendingUp, TrendingDown, CalendarDays, BadgeCheck,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type Fund = {
  id: number; name: string; monthlyAllocation: number; annualAllocation: number;
  colorClass: string;
};
type FixedItem = {
  id: number; fundId: number; name: string; monthlyAmount: number; notes: string;
  displayOrder: number;
};
type ApiResponse = { fund: Fund | null; items: FixedItem[]; totals: { monthly: number; annual: number } };

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

const EMPTY_FORM = { name: "", monthlyAmount: "", notes: "" };

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function FixedExpenses() {
  const { activeBid } = useBudgetYear();
  const { toast } = useToast();

  const [loading,  setLoading]  = useState(true);
  const [fund,     setFund]     = useState<Fund | null>(null);
  const [items,    setItems]    = useState<FixedItem[]>([]);
  const [totals,   setTotals]   = useState({ monthly: 0, annual: 0 });

  /* ── dialog state ─────────────────────────────────────── */
  const [dialog,   setDialog]   = useState(false);
  const [editItem, setEditItem] = useState<FixedItem | null>(null);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);

  /* ── delete state ─────────────────────────────────────── */
  const [deleteItem,  setDeleteItem]  = useState<FixedItem | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  /* ── load ─────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const data: ApiResponse = await apiFetch("/fixed-items");
      setFund(data.fund);
      setItems(data.items);
      setTotals(data.totals);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeBid]);

  /* ── open dialog ──────────────────────────────────────── */
  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialog(true);
  };

  const openEdit = (item: FixedItem) => {
    setEditItem(item);
    setForm({ name: item.name, monthlyAmount: String(item.monthlyAmount), notes: item.notes });
    setDialog(true);
  };

  /* ── save ─────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "נא להזין שם רכיב", variant: "destructive" }); return; }
    if (!fund) return;
    setSaving(true);
    try {
      if (editItem) {
        const updated: FixedItem = await apiFetch(`/fixed-items/${editItem.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.name.trim(), monthlyAmount: parseFloat(form.monthlyAmount) || 0, notes: form.notes }),
        });
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      } else {
        const created: FixedItem = await apiFetch("/fixed-items", {
          method: "POST",
          body: JSON.stringify({ name: form.name.trim(), monthlyAmount: parseFloat(form.monthlyAmount) || 0, notes: form.notes, fundId: fund.id }),
        });
        setItems(prev => [...prev, created]);
      }
      setDialog(false);
      toast({ title: editItem ? "רכיב עודכן" : "רכיב נוסף" });
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ── delete ───────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await apiFetch(`/fixed-items/${deleteItem.id}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== deleteItem.id));
      setDeleteItem(null);
      toast({ title: "רכיב נמחק" });
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  /* re-derive totals whenever items change */
  useEffect(() => {
    const monthly = items.reduce((s, i) => s + i.monthlyAmount, 0);
    setTotals({ monthly, annual: monthly * 12 });
  }, [items]);

  const diff = fund ? totals.monthly - fund.monthlyAllocation : 0;

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="קבועות" subtitle="ניתוח רכיבי ההוצאות הקבועות" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!fund) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="קבועות" subtitle="ניתוח רכיבי ההוצאות הקבועות" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <ListChecks className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg">אין קופת קבועות מוגדרת</p>
            <p className="text-sm text-muted-foreground mt-1">
              צור קופה מסוג "קבועות (חודשי)" בעמוד תכנון התקציב
            </p>
          </div>
          <Button variant="outline" onClick={() => window.history.back()}>חזור לתכנון</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={fund.name}
        subtitle="ניתוח ופירוט רכיבי ההוצאות הקבועות החודשיות"
        action={
          <Button onClick={openCreate} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" />
            רכיב חדש
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6" dir="rtl">

        {/* ══ Summary cards ═══════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="תקציב מתוכנן"
            value={fmt(fund.monthlyAllocation)}
            sub="/חודש"
            icon={<BadgeCheck className="w-5 h-5" />}
            color="text-primary"
            bg="bg-primary/10"
          />
          <SummaryCard
            label="סה״כ חודשי"
            value={fmt(totals.monthly)}
            sub={`${items.length} רכיבים`}
            icon={<CalendarDays className="w-5 h-5" />}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <SummaryCard
            label="סה״כ שנתי"
            value={fmt(totals.annual)}
            sub={`× 12 חודשים`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
          <SummaryCard
            label={diff > 0 ? "חריגה מהתקציב" : diff < 0 ? "חיסכון מהתקציב" : "מאוזן"}
            value={fmt(Math.abs(diff))}
            sub={diff > 0 ? "מעל התקציב" : diff < 0 ? "מתחת לתקציב" : "בדיוק לפי התקציב"}
            icon={<TrendingDown className="w-5 h-5" />}
            color={diff > 0 ? "text-rose-600" : diff < 0 ? "text-emerald-600" : "text-muted-foreground"}
            bg={diff > 0 ? "bg-rose-50" : diff < 0 ? "bg-emerald-50" : "bg-muted/40"}
          />
        </div>

        {/* ══ Items table ═════════════════════════════════════ */}
        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/30">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              רכיבי הקבועות
            </h2>
            <span className="text-xs text-muted-foreground">{items.length} רכיבים</span>
          </div>

          {items.length === 0 ? (
            <EmptyItems onAdd={openCreate} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-right px-5 py-2.5 font-medium text-muted-foreground text-xs w-8">#</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">שם רכיב</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">סכום חודשי</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">סכום שנתי</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">הערה</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs w-20">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors group"
                    >
                      <td className="px-5 py-3 text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{item.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-foreground tabular-nums">{fmt(item.monthlyAmount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground tabular-nums">{fmt(item.monthlyAmount * 12)}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {item.notes ? (
                          <span className="text-muted-foreground text-xs leading-snug">{item.notes}</span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="עריכה"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteItem(item)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors"
                            title="מחיקה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t border-border/60">
                    <td colSpan={2} className="px-5 py-3">
                      <span className="font-bold text-sm">סיכום</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-primary tabular-nums">{fmt(totals.monthly)}</span>
                      <span className="text-xs text-muted-foreground mr-1">/חודש</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-emerald-600 tabular-nums">{fmt(totals.annual)}</span>
                      <span className="text-xs text-muted-foreground mr-1">/שנה</span>
                    </td>
                    <td colSpan={2} className="px-4 py-3">
                      {diff !== 0 && (
                        <span className={cn("text-xs font-medium", diff > 0 ? "text-rose-600" : "text-emerald-600")}>
                          {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))} {diff > 0 ? "מעל" : "מתחת ל"}התקציב
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ══ Add/Edit Dialog ══════════════════════════════════════ */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editItem ? "עריכת רכיב" : "רכיב קבועות חדש"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fi-name">שם הרכיב *</Label>
              <Input
                id="fi-name"
                placeholder="לדוגמה: שכירות, ביטוח, סלולר..."
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="rounded-xl"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fi-amount">סכום חודשי (₪)</Label>
              <Input
                id="fi-amount"
                type="number"
                placeholder="0"
                min={0}
                value={form.monthlyAmount}
                onChange={e => setForm(p => ({ ...p, monthlyAmount: e.target.value }))}
                className="rounded-xl"
              />
              {form.monthlyAmount && parseFloat(form.monthlyAmount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  שנתי: {fmt(parseFloat(form.monthlyAmount) * 12)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fi-notes">הערה</Label>
              <Input
                id="fi-notes"
                placeholder="הערה אופציונלית..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(false)} className="rounded-xl">ביטול</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {editItem ? "שמור שינויים" : "הוסף רכיב"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Delete AlertDialog ══════════════════════════════════ */}
      <AlertDialog open={!!deleteItem} onOpenChange={o => !o && setDeleteItem(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת רכיב</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את הרכיב "{deleteItem?.name}"?<br />
              פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
            >
              {deleting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════ */
function SummaryCard({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg)}>
          <span className={color}>{icon}</span>
        </div>
      </div>
      <p className={cn("text-2xl font-black tabular-nums", color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function EmptyItems({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
        <ListChecks className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold">אין רכיבים עדיין</p>
        <p className="text-sm text-muted-foreground mt-1">הוסף רכיבי קבועות כמו שכירות, ביטוחים, מנויים...</p>
      </div>
      <Button size="sm" onClick={onAdd} className="gap-2 rounded-xl mt-1">
        <Plus className="w-4 h-4" />
        הוסף רכיב ראשון
      </Button>
    </div>
  );
}
