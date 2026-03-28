import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, Landmark, ArrowUpRight, ArrowDownRight, Check, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Income = { id: number; amount: number; source: string; description: string; date: string; entryType: string };
type Summary = { totalIncome: number; totalDeductions: number; netIncome: number };

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

type FormState = { amount: string; source: string; description: string; date: string; entryType: string };
const DEFAULT_FORM: FormState = { amount: "", source: "", description: "", date: "", entryType: "income" };

export default function Incomes() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<Income[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "income" | "work_deduction">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Income | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [all, summ] = await Promise.all([apiFetch("/incomes"), apiFetch("/incomes/summary")]);
      setEntries(all);
      setSummary(summ);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = (type = "income") => {
    setEditEntry(null);
    setForm({ ...DEFAULT_FORM, entryType: type, date: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };
  const openEdit = (e: Income) => {
    setEditEntry(e);
    setForm({ amount: String(e.amount), source: e.source, description: e.description, date: e.date, entryType: e.entryType });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: "הכנס סכום תקין", variant: "destructive" }); return; }
    if (!form.source.trim()) { toast({ title: "מקור נדרש", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { amount: parseFloat(form.amount), source: form.source.trim(), description: form.description, date: form.date || new Date().toISOString().split("T")[0], entryType: form.entryType };
      if (editEntry) {
        const updated = await apiFetch(`/incomes/${editEntry.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setEntries(prev => prev.map(e => e.id === editEntry.id ? updated : e));
        toast({ title: "עודכן" });
      } else {
        const created = await apiFetch("/incomes", { method: "POST", body: JSON.stringify(payload) });
        setEntries(prev => [created, ...prev]);
        toast({ title: form.entryType === "income" ? "הכנסה נרשמה" : "ניכוי נרשם" });
      }
      const summ = await apiFetch("/incomes/summary");
      setSummary(summ);
      setDialogOpen(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/incomes/${deleteId}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== deleteId));
      const summ = await apiFetch("/incomes/summary");
      setSummary(summ);
      toast({ title: "נמחק" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const filtered = tab === "all" ? entries : entries.filter(e => e.entryType === tab);

  return (
    <div className="space-y-6">
      <PageHeader title="הכנסות" description="תיעוד הכנסות וניכויי הוצאות עבודה — חישוב הכנסה נטו">
        <div className="flex gap-2">
          <Button onClick={() => openCreate("work_deduction")} variant="outline"
            className="rounded-xl gap-2 border-rose-200 text-rose-600 hover:bg-rose-50">
            <ArrowDownRight className="w-4 h-4" /> ניכוי הוצאות עבודה
          </Button>
          <Button onClick={() => openCreate("income")} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> הכנסה חדשה
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: ArrowUpRight, color: "text-emerald-600", bg: "bg-emerald-50/50 border-emerald-200/50", label: 'סה"כ הכנסות', value: summary.totalIncome },
          { icon: ArrowDownRight, color: "text-rose-600", bg: "bg-rose-50/50 border-rose-200/50", label: "ניכויי עבודה", value: summary.totalDeductions },
          { icon: Landmark, color: "text-primary", bg: "bg-primary/5 border-primary/20", label: "הכנסה נטו", value: summary.netIncome },
        ].map(s => (
          <Card key={s.label} className={cn("rounded-2xl", s.bg)}>
            <CardContent className="pt-5 text-center">
              <s.icon className={cn("w-6 h-6 mx-auto mb-2", s.color)} />
              <p className={cn("text-2xl font-display font-bold", s.color)}>{fmt(s.value)}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        {[{ key: "all", label: "הכל" }, { key: "income", label: "הכנסות" }, { key: "work_deduction", label: "ניכויים" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              tab === t.key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-2xl">
          <Landmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">אין רשומות</p>
          <Button onClick={() => openCreate()} variant="outline" size="sm" className="mt-3 rounded-xl gap-1.5">
            <Plus className="w-3.5 h-3.5" /> הוסף ראשון
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/60 hover:border-border transition-all group">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                entry.entryType === "income" ? "bg-emerald-100" : "bg-rose-100"
              )}>
                {entry.entryType === "income" ? <ArrowUpRight className="w-5 h-5 text-emerald-600" /> : <ArrowDownRight className="w-5 h-5 text-rose-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{entry.source}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("he-IL")}</p>
                  {entry.description && <p className="text-xs text-muted-foreground truncate">· {entry.description}</p>}
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                    entry.entryType === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  )}>
                    {entry.entryType === "income" ? "הכנסה" : "ניכוי"}
                  </span>
                </div>
              </div>
              <p className={cn("text-lg font-display font-bold tabular-nums",
                entry.entryType === "income" ? "text-emerald-600" : "text-rose-600"
              )}>
                {entry.entryType === "income" ? "+" : "−"}{fmt(entry.amount)}
              </p>
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
          <DialogHeader>
            <DialogTitle>
              {form.entryType === "income" ? (editEntry ? "עריכת הכנסה" : "הכנסה חדשה") : (editEntry ? "עריכת ניכוי" : "ניכוי הוצאות עבודה")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              {[{ value: "income", label: "הכנסה", cls: "bg-emerald-600 hover:bg-emerald-700" }, { value: "work_deduction", label: "ניכוי", cls: "bg-rose-600 hover:bg-rose-700" }].map(t => (
                <button key={t.value} type="button" onClick={() => setForm(p => ({ ...p, entryType: t.value }))}
                  className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
                    form.entryType === t.value ? `${t.cls} text-white` : "bg-muted text-muted-foreground"
                  )}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">{form.entryType === "income" ? "מקור הכנסה *" : "תיאור הניכוי *"}</Label>
              <Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                placeholder={form.entryType === "income" ? "משכורת, עבודה..." : "נסיעות, ציוד..."} className="rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input type="number" dir="ltr" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="rounded-xl text-lg font-bold" />
            </div>
            <div className="grid grid-cols-1 gap-3">
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
          <AlertDialogHeader><AlertDialogTitle>מחק רשומה?</AlertDialogTitle><AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
