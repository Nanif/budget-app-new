import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  Plus, Trash2, Pencil, Tag, Check, X, Loader2, Search, Filter,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type Fund = { id: number; name: string; colorClass: string; fundBehavior: string; annualAllocation: number; isActive: boolean };
type Category = { id: number; name: string; color: string; isActive: boolean };
type Expense = { id: number; amount: number; description: string; date: string; categoryId: number | null; fundId: number | null; categoryName?: string; categoryColor?: string };


function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

export default function AnnualExpenses() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();
  const [fund, setFund] = useState<Fund | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ total: number; byCategory: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [form, setForm] = useState({ amount: "", description: "", date: "", categoryId: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [funds, cats] = await Promise.all([
          apiFetch("/funds?all=true"),
          apiFetch("/categories?all=true"),
        ]);
        const f = funds.find((f: Fund) => f.fundBehavior === "annual_categorized" && f.isActive);
        const activeCats = cats.filter((c: Category) => c.isActive);
        setFund(f ? { ...f, annualAllocation: parseFloat(String(f.annualAllocation) || "0") } : null);
        setCategories(activeCats);
        if (f) await loadExpenses(f.id);
      } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
      finally { setLoading(false); }
    })();
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExpenses = async (fundId: number) => {
    const [exps, summ] = await Promise.all([
      apiFetch(`/expenses?fundId=${fundId}`),
      apiFetch(`/expenses/summary?fundId=${fundId}`),
    ]);
    setExpenses(exps);
    setSummary(summ);
  };

  const openCreate = () => {
    setEditExp(null);
    setForm({ amount: "", description: "", date: new Date().toISOString().split("T")[0], categoryId: "" });
    setDialogOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditExp(e);
    setForm({ amount: String(e.amount), description: e.description, date: e.date, categoryId: e.categoryId ? String(e.categoryId) : "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!fund) return;
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: "הכנס סכום תקין", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date || new Date().toISOString().split("T")[0],
        fundId: fund.id,
        paymentMethod: "credit",
      };
      if (form.categoryId) payload.categoryId = parseInt(form.categoryId);

      let saved: Expense;
      if (editExp) {
        saved = await apiFetch(`/expenses/${editExp.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setExpenses(prev => prev.map(e => e.id === editExp.id ? { ...saved, categoryName: categories.find(c => c.id === saved.categoryId)?.name, categoryColor: categories.find(c => c.id === saved.categoryId)?.color } : e));
      } else {
        saved = await apiFetch("/expenses", { method: "POST", body: JSON.stringify(payload) });
        setExpenses(prev => [{ ...saved, categoryName: categories.find(c => c.id === saved.categoryId)?.name, categoryColor: categories.find(c => c.id === saved.categoryId)?.color }, ...prev]);
      }
      // Refresh summary
      const summ = await apiFetch(`/expenses/summary?fundId=${fund.id}`);
      setSummary(summ);
      toast({ title: editExp ? "הוצאה עודכנה" : "הוצאה נרשמה" });
      setDialogOpen(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId || !fund) return;
    try {
      await apiFetch(`/expenses/${deleteId}`, { method: "DELETE" });
      setExpenses(prev => prev.filter(e => e.id !== deleteId));
      const summ = await apiFetch(`/expenses/summary?fundId=${fund.id}`);
      setSummary(summ);
      toast({ title: "הוצאה נמחקה" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const filtered = useMemo(() => expenses.filter(e => {
    if (filterCat !== "all" && String(e.categoryId) !== filterCat) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [expenses, filterCat, search]);

  const budget = fund?.annualAllocation ?? 0;
  const spent = summary?.total ?? 0;
  const remaining = budget - spent;
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="מעגל השנה" description="הוצאות שנתיות מתועדות לפי קטגוריות">
        <Button onClick={openCreate} className="rounded-xl gap-2" disabled={!fund}>
          <Plus className="w-4 h-4" /> הוצאה חדשה
        </Button>
      </PageHeader>

      {!fund && !loading ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center space-y-3">
            <Tag className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="font-semibold">לא הוגדרה קופת מעגל השנה</p>
            <p className="text-sm text-muted-foreground">צור קופה מסוג "מעגל השנה" בעמוד תכנון התקציב</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Budget progress */}
          <Card className="rounded-2xl">
            <CardContent className="pt-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">תקציב שנתי</p>
                  <p className="text-xl font-display font-bold mt-1">{fmt(budget)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">הוצא עד כה</p>
                  <p className="text-xl font-display font-bold text-rose-600 mt-1">{fmt(spent)}</p>
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
              <p className="text-xs text-muted-foreground mt-1.5 text-center">{Math.round(pct)}% מהתקציב השנתי</p>
            </CardContent>
          </Card>

          {/* Category breakdown */}
          {summary && summary.byCategory.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">פילוח לפי קטגוריה</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...summary.byCategory].sort((a, b) => b.total - a.total).map((cat, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.categoryColor || "#94a3b8" }} />
                      <p className="text-sm flex-1">{cat.categoryName || "ללא קטגוריה"}</p>
                      <p className="text-sm font-semibold tabular-nums">{fmt(cat.total)}</p>
                      <p className="text-xs text-muted-foreground w-10 text-left">
                        {spent > 0 ? Math.round((cat.total / spent) * 100) : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters + list */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="חפש הוצאה..." className="rounded-xl pr-9 h-9 text-sm" />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="rounded-xl h-9 text-sm w-auto min-w-[130px]">
                <Filter className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
                <SelectValue placeholder="כל הקטגוריות" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                <SelectItem value="null">ללא קטגוריה</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-2xl">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{expenses.length === 0 ? "אין הוצאות עדיין" : "לא נמצאו הוצאות"}</p>
              {expenses.length === 0 && (
                <Button onClick={openCreate} variant="outline" size="sm" className="mt-3 rounded-xl gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> הוסף הוצאה ראשונה
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(exp => (
                <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-all group">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: exp.categoryColor || "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exp.description || "הוצאה"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{new Date(exp.date).toLocaleDateString("he-IL")}</p>
                      {exp.categoryName && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{exp.categoryName}</span>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-sm tabular-nums text-rose-600">{fmt(exp.amount)}</p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(exp)} className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(exp.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editExp ? "עריכת הוצאה" : "הוצאה חדשה — מעגל השנה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input type="number" dir="ltr" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0" className="rounded-xl text-lg font-bold" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">קטגוריה</Label>
              <Select value={form.categoryId || "none"} onValueChange={v => setForm(p => ({ ...p, categoryId: v === "none" ? "" : v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="ללא קטגוריה" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">ללא קטגוריה</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תיאור</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="מה נקנה?" className="rounded-xl" />
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
            <AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
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
