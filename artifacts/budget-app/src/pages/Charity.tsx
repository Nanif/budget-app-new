import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, HeartHandshake, Check, X, Loader2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Tithe = { id: number; amount: number; recipient: string; description: string; date: string; isTithe: boolean };
type Summary = { totalIncome: number; totalDeductions: number; netIncome: number };
type BudgetYear = { tithePercentage: number };

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

type FormState = { amount: string; recipient: string; description: string; date: string; isTithe: boolean };
const DEFAULT_FORM: FormState = { amount: "", recipient: "", description: "", date: "", isTithe: true };

export default function Charity() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<Tithe[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<Summary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0 });
  const [budgetYear, setBudgetYear] = useState<BudgetYear>({ tithePercentage: 10 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Tithe | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tithes, summ, yearData] = await Promise.all([
        apiFetch("/charity"),
        apiFetch("/incomes/summary"),
        apiFetch("/budget-year"),
      ]);
      setEntries(tithes);
      setIncomeSummary(summ);
      setBudgetYear(yearData);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditEntry(null);
    setForm({ ...DEFAULT_FORM, date: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };
  const openEdit = (e: Tithe) => {
    setEditEntry(e);
    setForm({ amount: String(e.amount), recipient: e.recipient, description: e.description, date: e.date, isTithe: e.isTithe });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: "הכנס סכום תקין", variant: "destructive" }); return; }
    if (!form.recipient.trim()) { toast({ title: "נמען נדרש", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { amount: parseFloat(form.amount), recipient: form.recipient.trim(), description: form.description, date: form.date || new Date().toISOString().split("T")[0], isTithe: form.isTithe };
      if (editEntry) {
        const updated = await apiFetch(`/charity/${editEntry.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setEntries(prev => prev.map(e => e.id === editEntry.id ? updated : e));
        toast({ title: "עודכן" });
      } else {
        const created = await apiFetch("/charity", { method: "POST", body: JSON.stringify(payload) });
        setEntries(prev => [created, ...prev]);
        toast({ title: "תרומה נרשמה" });
      }
      setDialogOpen(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/charity/${deleteId}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== deleteId));
      toast({ title: "נמחק" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const titheRate = (budgetYear.tithePercentage || 10) / 100;
  const netIncome = incomeSummary.netIncome;
  const titheTarget = netIncome * titheRate;
  const totalGiven = entries.filter(e => e.isTithe).reduce((s, e) => s + e.amount, 0);
  const totalDonation = entries.reduce((s, e) => s + e.amount, 0);
  const remaining = titheTarget - totalGiven;
  const pct = titheTarget > 0 ? Math.min(100, (totalGiven / titheTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="צדקה ומעשרות" description="מעקב אחר תרומות ומעשרות ביחס להכנסה נטו">
        <Button onClick={openCreate} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> תרומה חדשה
        </Button>
      </PageHeader>

      {/* Tithe status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "הכנסה נטו", value: fmt(netIncome), color: "text-foreground" },
          { label: `יעד מעשרות (${budgetYear.tithePercentage}%)`, value: fmt(titheTarget), color: "text-primary" },
          { label: "ניתן עד כה", value: fmt(totalGiven), color: "text-emerald-600" },
          { label: remaining > 0 ? "נותר לתת" : "עודף", value: fmt(Math.abs(remaining)), color: remaining > 0 ? "text-rose-500" : "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border/60 p-4 text-center">
            <p className={cn("text-xl font-display font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {titheTarget > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="pt-5">
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-sm">התקדמות מעשרות</p>
              <p className="text-sm font-bold">{Math.round(pct)}%</p>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-primary")}
                style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{fmt(totalGiven)} ניתן</span>
              <span>יעד: {fmt(titheTarget)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {netIncome === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          <Info className="w-4 h-4 shrink-0" />
          <span>כדי לחשב יעד מעשרות, הוסף הכנסות בעמוד ההכנסות תחילה.</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-2xl">
          <HeartHandshake className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">אין תרומות רשומות</p>
          <Button onClick={openCreate} variant="outline" size="sm" className="mt-3 rounded-xl gap-1.5">
            <Plus className="w-3.5 h-3.5" /> הוסף תרומה ראשונה
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/60 hover:border-border transition-all group">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <HeartHandshake className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{entry.recipient}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("he-IL")}</p>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                    entry.isTithe ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"
                  )}>
                    {entry.isTithe ? "מעשר" : "תרומה"}
                  </span>
                  {entry.description && <p className="text-xs text-muted-foreground truncate">· {entry.description}</p>}
                </div>
              </div>
              <p className="text-lg font-display font-bold text-rose-600 tabular-nums">{fmt(entry.amount)}</p>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(entry)} className="p-2 rounded-xl hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteId(entry.id)} className="p-2 rounded-xl hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader><DialogTitle>{editEntry ? "עריכת תרומה" : "תרומה חדשה"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              {[{ value: true, label: "מעשר", cls: "bg-violet-600 hover:bg-violet-700" }, { value: false, label: "תרומה", cls: "bg-rose-600 hover:bg-rose-700" }].map(t => (
                <button key={String(t.value)} type="button" onClick={() => setForm(p => ({ ...p, isTithe: t.value }))}
                  className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
                    form.isTithe === t.value ? `${t.cls} text-white` : "bg-muted text-muted-foreground"
                  )}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">נמען *</Label>
              <Input value={form.recipient} onChange={e => setForm(p => ({ ...p, recipient: e.target.value }))}
                placeholder="שם הארגון או האדם..." className="rounded-xl" autoFocus />
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
            <div className="space-y-1.5">
              <Label className="font-semibold">הערה</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="פרטים נוספים..." className="rounded-xl" />
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
          <AlertDialogHeader><AlertDialogTitle>מחק תרומה?</AlertDialogTitle><AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
