import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, Wallet, Check, X, Loader2, PiggyBank } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";


type Fund = { id: number; name: string; colorClass: string; fundBehavior: string; initialBalance: number; isActive: boolean; annualAllocation: number };
type Expense = { id: number; amount: number; description: string; date: string; fundId: number | null };


function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

export default function ExternalFunds() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [expenses, setExpenses] = useState<Record<number, Expense[]>>({});
  const [totals, setTotals] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedFund, setSelectedFund] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [form, setForm] = useState({ amount: "", description: "", date: "", fundId: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const all: Fund[] = await apiFetch("/funds?all=true");
        const external = all.filter(f => f.fundBehavior === "non_budget" && f.isActive)
          .map(f => ({ ...f, initialBalance: parseFloat(String(f.initialBalance) || "0") }));
        setFunds(external);
        if (external.length > 0) setSelectedFund(external[0].id);
        // Load expenses for each fund
        const expMap: Record<number, Expense[]> = {};
        const totMap: Record<number, number> = {};
        await Promise.all(external.map(async f => {
          const exps = await apiFetch(`/expenses?fundId=${f.id}`);
          expMap[f.id] = exps;
          totMap[f.id] = exps.reduce((s: number, e: Expense) => s + e.amount, 0);
        }));
        setExpenses(expMap);
        setTotals(totMap);
      } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
      finally { setLoading(false); }
    })();
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = (fundId: number) => {
    setEditExp(null);
    setForm({ amount: "", description: "", date: new Date().toISOString().split("T")[0], fundId: String(fundId) });
    setDialogOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditExp(e);
    setForm({ amount: String(e.amount), description: e.description, date: e.date, fundId: String(e.fundId) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: "הכנס סכום תקין", variant: "destructive" }); return; }
    const fid = parseInt(form.fundId);
    setSaving(true);
    try {
      const payload = { amount: parseFloat(form.amount), description: form.description, date: form.date || new Date().toISOString().split("T")[0], fundId: fid, paymentMethod: "cash" };
      if (editExp) {
        const updated = await apiFetch(`/expenses/${editExp.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setExpenses(prev => ({ ...prev, [fid]: prev[fid].map(e => e.id === editExp.id ? updated : e) }));
        setTotals(prev => ({ ...prev, [fid]: prev[fid] - editExp.amount + updated.amount }));
        toast({ title: "עודכן" });
      } else {
        const created = await apiFetch("/expenses", { method: "POST", body: JSON.stringify(payload) });
        setExpenses(prev => ({ ...prev, [fid]: [created, ...(prev[fid] || [])] }));
        setTotals(prev => ({ ...prev, [fid]: (prev[fid] || 0) + created.amount }));
        toast({ title: "הוצאה נרשמה" });
      }
      setDialogOpen(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    let fid: number | undefined;
    let amount = 0;
    for (const [k, exps] of Object.entries(expenses)) {
      const found = exps.find(e => e.id === deleteId);
      if (found) { fid = parseInt(k); amount = found.amount; break; }
    }
    try {
      await apiFetch(`/expenses/${deleteId}`, { method: "DELETE" });
      if (fid !== undefined) {
        setExpenses(prev => ({ ...prev, [fid!]: prev[fid!].filter(e => e.id !== deleteId) }));
        setTotals(prev => ({ ...prev, [fid!]: prev[fid!] - amount }));
      }
      toast({ title: "נמחק" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const activeFund = funds.find(f => f.id === selectedFund);

  return (
    <div className="space-y-6">
      <PageHeader title="קופות חיצוניות" description="קופות מחוץ לתקציב השנתי — יתרה מתרוקנת לפי שימוש">
        {activeFund && (
          <Button onClick={() => openCreate(activeFund.id)} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> הוצאה חדשה
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : funds.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center space-y-3">
            <PiggyBank className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="font-semibold">אין קופות חיצוניות</p>
            <p className="text-sm text-muted-foreground">צור קופה מסוג "מחוץ לתקציב" בעמוד תכנון התקציב</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Fund selector tabs */}
          {funds.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {funds.map(f => (
                <button key={f.id} onClick={() => setSelectedFund(f.id)}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium text-sm transition-all",
                    selectedFund === f.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  )}>
                  <span className="w-2 h-2 rounded-full" style={{ background: f.colorClass }} />
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Fund overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {funds.filter(f => !selectedFund || f.id === selectedFund || funds.length <= 2).map(f => {
              const spent = totals[f.id] ?? 0;
              const balance = f.initialBalance - spent;
              const pct = f.initialBalance > 0 ? Math.min(100, (spent / f.initialBalance) * 100) : 0;
              return (
                <div key={f.id} onClick={() => setSelectedFund(f.id)}
                  className={cn("bg-card rounded-2xl border-2 p-5 cursor-pointer transition-all",
                    selectedFund === f.id ? "border-primary" : "border-border/60 hover:border-border"
                  )}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ background: f.colorClass }}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">קופה חיצונית</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">יתרה התחלתית</p>
                      <p className="font-bold mt-0.5">{fmt(f.initialBalance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">הוצא</p>
                      <p className="font-bold text-rose-600 mt-0.5">{fmt(spent)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">נותר</p>
                      <p className={cn("font-bold mt-0.5", balance < 0 ? "text-rose-600" : "text-emerald-600")}>{fmt(balance)}</p>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", pct >= 100 ? "bg-rose-500" : "bg-primary")}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expenses list for selected fund */}
          {activeFund && (
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  הוצאות מ{activeFund.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!expenses[activeFund.id] || expenses[activeFund.id].length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">אין הוצאות עדיין</p>
                    <Button onClick={() => openCreate(activeFund.id)} variant="outline" size="sm" className="mt-3 rounded-xl gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> הוסף הוצאה
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {expenses[activeFund.id].map(exp => (
                      <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{exp.description || "הוצאה"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(exp.date).toLocaleDateString("he-IL")}</p>
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
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader><DialogTitle>{editExp ? "עריכת הוצאה" : "הוצאה חדשה"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {funds.length > 1 && (
              <div className="space-y-1.5">
                <Label className="font-semibold">קופה</Label>
                <Select value={form.fundId} onValueChange={v => setForm(p => ({ ...p, fundId: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {funds.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-semibold">תיאור *</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="מה נקנה?" className="rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input type="number" dir="ltr" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="rounded-xl text-lg font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תאריך</Label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="rounded-xl" dir="ltr" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl flex-1"><X className="w-4 h-4 ml-1" /> ביטול</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />} שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>מחק הוצאה?</AlertDialogTitle><AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
