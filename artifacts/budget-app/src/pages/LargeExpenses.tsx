import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, ShoppingBag, Check, X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type Fund = { id: number; name: string; colorClass: string; fundBehavior: string; annualAllocation: number; isActive: boolean };
type Expense = { id: number; amount: number; description: string; date: string; fundId: number | null };


function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

export default function LargeExpenses() {
  const { toast } = useToast();
  const [fund, setFund] = useState<Fund | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [form, setForm] = useState({ amount: "", description: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const funds: Fund[] = await apiFetch("/funds?all=true");
        const f = funds.find(f => f.fundBehavior === "annual_large" && f.isActive);
        setFund(f ? { ...f, annualAllocation: parseFloat(String(f.annualAllocation) || "0") } : null);
        if (f) await loadExpenses(f.id);
      } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadExpenses = async (fundId: number) => {
    const [exps, summ] = await Promise.all([
      apiFetch(`/expenses?fundId=${fundId}`),
      apiFetch(`/expenses/summary?fundId=${fundId}`),
    ]);
    setExpenses(exps);
    setTotal(summ.total);
  };

  const openCreate = () => {
    setEditExp(null);
    setForm({ amount: "", description: "", date: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditExp(e);
    setForm({ amount: String(e.amount), description: e.description, date: e.date });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!fund) return;
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: "הכנס סכום תקין", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date || new Date().toISOString().split("T")[0],
        fundId: fund.id,
        paymentMethod: "credit",
      };
      if (editExp) {
        const updated = await apiFetch(`/expenses/${editExp.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setExpenses(prev => prev.map(e => e.id === editExp.id ? updated : e));
        setTotal(prev => prev - editExp.amount + updated.amount);
      } else {
        const created = await apiFetch("/expenses", { method: "POST", body: JSON.stringify(payload) });
        setExpenses(prev => [created, ...prev]);
        setTotal(prev => prev + created.amount);
      }
      toast({ title: editExp ? "הוצאה עודכנה" : "הוצאה נרשמה" });
      setDialogOpen(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const exp = expenses.find(e => e.id === deleteId);
    try {
      await apiFetch(`/expenses/${deleteId}`, { method: "DELETE" });
      setExpenses(prev => prev.filter(e => e.id !== deleteId));
      if (exp) setTotal(prev => prev - exp.amount);
      toast({ title: "הוצאה נמחקה" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const budget = fund?.annualAllocation ?? 0;
  const remaining = budget - total;
  const pct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="הוצאות גדולות" description="רכישות גדולות וחריגות — תיעוד ומעקב כנגד תקציב שנתי">
        <Button onClick={openCreate} className="rounded-xl gap-2" disabled={!fund}>
          <Plus className="w-4 h-4" /> הוצאה חדשה
        </Button>
      </PageHeader>

      {!fund && !loading ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center space-y-3">
            <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="font-semibold">לא הוגדרה קופת הוצאות גדולות</p>
            <p className="text-sm text-muted-foreground">צור קופה מסוג "הוצאות גדולות" בעמוד תכנון התקציב</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress card */}
          <Card className="rounded-2xl">
            <CardContent className="pt-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">תקציב שנתי</p>
                  <p className="text-xl font-display font-bold mt-1">{fmt(budget)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">הוצא</p>
                  <p className="text-xl font-display font-bold text-rose-600 mt-1">{fmt(total)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">נותר</p>
                  <p className={cn("text-xl font-display font-bold mt-1", remaining < 0 ? "text-rose-600" : "text-emerald-600")}>
                    {fmt(remaining)}
                  </p>
                </div>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-center">{Math.round(pct)}% מהתקציב</p>
            </CardContent>
          </Card>

          {/* List */}
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-2xl">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">אין הוצאות גדולות עדיין</p>
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-3 rounded-xl gap-1.5">
                <Plus className="w-3.5 h-3.5" /> הוסף הוצאה
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/60 hover:border-border transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{exp.description || "הוצאה גדולה"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(exp.date).toLocaleDateString("he-IL")}</p>
                  </div>
                  <p className="text-lg font-display font-bold text-rose-600 tabular-nums">{fmt(exp.amount)}</p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(exp)} className="p-2 rounded-xl hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(exp.id)} className="p-2 rounded-xl hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editExp ? "עריכת הוצאה" : "הוצאה גדולה חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">תיאור *</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder='למשל: טלוויזיה חדשה, רהיטים...' className="rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input type="number" dir="ltr" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0" className="rounded-xl text-lg font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תאריך</Label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="rounded-xl" dir="ltr" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl flex-1">
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחק הוצאה?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
