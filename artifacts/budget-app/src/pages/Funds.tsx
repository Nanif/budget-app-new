import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight,
  Wallet, Check, X, Loader2, GripVertical, Coins, Eye, EyeOff,
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


type Fund = {
  id: number; name: string; type: string; description: string;
  colorClass: string; icon: string; includeInBudget: boolean;
  isCash: boolean; isActive: boolean; displayOrder: number;
  userId: number; budgetYearId: number;
  createdAt: string; updatedAt: string;
};

const FUND_TYPES = [
  { value: "expense", label: "הוצאות" },
  { value: "income", label: "הכנסות" },
  { value: "mixed", label: "מעורב" },
  { value: "savings", label: "חיסכון" },
];

const COLOR_SWATCHES = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1",
  "#8b5cf6","#a855f7","#ec4899","#f43f5e","#64748b","#475569",
];

const FUND_TYPE_COLORS: Record<string, string> = {
  expense: "bg-rose-100 text-rose-700",
  income: "bg-emerald-100 text-emerald-700",
  mixed: "bg-blue-100 text-blue-700",
  savings: "bg-indigo-100 text-indigo-700",
};

const FUND_TYPE_LABELS: Record<string, string> = {
  expense: "הוצאות", income: "הכנסות", mixed: "מעורב", savings: "חיסכון",
};

type FormState = {
  name: string; type: string; description: string; colorClass: string;
  includeInBudget: boolean; isCash: boolean; isActive: boolean;
};

const DEFAULT_FORM: FormState = {
  name: "", type: "expense", description: "", colorClass: "#6366f1",
  includeInBudget: true, isCash: false, isActive: true,
};


export default function Funds() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFund, setEditFund] = useState<Fund | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    try { setFunds(await apiFetch("/funds?all=true")); }
    catch { toast({ title: "שגיאה בטעינת קופות", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { load(); }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditFund(null); setForm(DEFAULT_FORM); setFormErrors({}); setDialogOpen(true);
  };
  const openEdit = (f: Fund) => {
    setEditFund(f);
    setForm({
      name: f.name, type: f.type, description: f.description || "",
      colorClass: f.colorClass, includeInBudget: f.includeInBudget,
      isCash: f.isCash, isActive: f.isActive,
    });
    setFormErrors({}); setDialogOpen(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "שם הקופה הוא שדה חובה";
    if (form.name.trim().length > 50) errs.name = "שם ארוך מדי (מקסימום 50 תווים)";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, displayOrder: editFund?.displayOrder ?? funds.length };
      if (editFund) {
        const updated = await apiFetch(`/funds/${editFund.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setFunds(prev => prev.map(f => f.id === editFund.id ? updated : f));
        toast({ title: "קופה עודכנה בהצלחה" });
      } else {
        const created = await apiFetch("/funds", { method: "POST", body: JSON.stringify(payload) });
        setFunds(prev => [...prev, created]);
        toast({ title: "קופה נוצרה בהצלחה" });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleToggle = async (fund: Fund) => {
    try {
      const updated = await apiFetch(`/funds/${fund.id}/toggle`, { method: "PATCH" });
      setFunds(prev => prev.map(f => f.id === fund.id ? updated : f));
      toast({ title: updated.isActive ? "קופה הופעלה" : "קופה הושהתה" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/funds/${deleteId}`, { method: "DELETE" });
      setFunds(prev => prev.map(f => f.id === deleteId ? { ...f, isActive: false } : f));
      toast({ title: "קופה הושהתה" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const handleMove = async (fund: Fund, direction: "up" | "down") => {
    const active = [...funds].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = active.findIndex(f => f.id === fund.id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === active.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newOrder = [...active];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    const orderedIds = newOrder.map(f => f.id);
    try {
      const updated: Fund[] = await apiFetch("/funds/reorder", { method: "PATCH", body: JSON.stringify({ orderedIds }) });
      setFunds(updated);
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  const displayedFunds = funds
    .filter(f => showInactive || f.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const activeFunds = funds.filter(f => f.isActive);
  const inactiveFunds = funds.filter(f => !f.isActive);

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-medium",
        checked ? "bg-primary/5 border-primary/30 text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-primary/20"
      )}>
      {checked ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="ניהול קופות" description="הגדר קופות תקציביות לארגון ההכנסות וההוצאות שלך">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowInactive(p => !p)}
            className={cn("flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-all",
              showInactive ? "bg-muted border-border" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showInactive ? "הסתר מושהות" : "הצג מושהות"}
          </button>
          <Button onClick={openCreate} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> קופה חדשה
          </Button>
        </div>
      </PageHeader>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "סה\"כ קופות", value: funds.length, color: "text-foreground" },
          { label: "קופות פעילות", value: activeFunds.length, color: "text-emerald-600" },
          { label: "קופות מושהות", value: inactiveFunds.length, color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-muted/40 rounded-2xl p-4 text-center border border-border/50">
            <p className={cn("text-2xl font-display font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Funds list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : displayedFunds.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="py-14 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Coins className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-lg">אין קופות עדיין</p>
            <p className="text-sm text-muted-foreground">צור קופה ראשונה כדי להתחיל לארגן את התקציב</p>
            <Button onClick={openCreate} variant="outline" className="rounded-xl gap-2 mt-2">
              <Plus className="w-4 h-4" /> צור קופה ראשונה
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayedFunds.map((fund, idx) => (
            <div key={fund.id}
              className={cn("rounded-2xl border p-4 flex items-center gap-4 transition-all group",
                fund.isActive
                  ? "bg-card border-border/60 hover:border-border hover:shadow-sm"
                  : "bg-muted/30 border-border/30 opacity-60"
              )}>
              {/* Drag handle / order */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => handleMove(fund, "up")} disabled={idx === 0}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <GripVertical className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                <button onClick={() => handleMove(fund, "down")} disabled={idx === displayedFunds.length - 1}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Color dot + Name */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white shadow-sm"
                  style={{ background: fund.colorClass || "#6366f1" }}>
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn("font-semibold text-base", !fund.isActive && "line-through text-muted-foreground")}>
                      {fund.name}
                    </p>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", FUND_TYPE_COLORS[fund.type] || "bg-gray-100 text-gray-600")}>
                      {FUND_TYPE_LABELS[fund.type] || fund.type}
                    </span>
                    {fund.isCash && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">מזומן</span>
                    )}
                    {!fund.includeInBudget && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">מחוץ לתקציב</span>
                    )}
                    {!fund.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">מושהה</span>
                    )}
                  </div>
                  {fund.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{fund.description}</p>
                  )}
                </div>
              </div>

              {/* Order badge */}
              <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-xs font-bold text-muted-foreground shrink-0">
                {fund.displayOrder + 1}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleToggle(fund)} title={fund.isActive ? "השהה" : "הפעל"}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  {fund.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(fund)} title="ערוך"
                  className="p-2 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteId(fund.id)} title="מחק"
                  className="p-2 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editFund ? "עריכת קופה" : "קופה חדשה"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fname" className="font-semibold">שם הקופה <span className="text-rose-500">*</span></Label>
              <Input id="fname" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder='למשל: קופת מזון, קופת חינוך...'
                className={cn("rounded-xl", formErrors.name && "border-rose-400 focus-visible:ring-rose-400")} />
              {formErrors.name && <p className="text-xs text-rose-500">{formErrors.name}</p>}
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="font-semibold">סוג קופה</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {FUND_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="fdesc" className="font-semibold">תיאור (אופציונלי)</Label>
              <Input id="fdesc" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="תיאור קצר..." className="rounded-xl" />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label className="font-semibold">צבע קופה</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map(color => (
                  <button key={color} type="button" onClick={() => setForm(p => ({ ...p, colorClass: color }))}
                    className={cn("w-8 h-8 rounded-lg transition-all hover:scale-110",
                      form.colorClass === color && "ring-2 ring-offset-2 ring-foreground scale-110"
                    )}
                    style={{ background: color }}>
                    {form.colorClass === color && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-8 h-8 rounded-lg shrink-0 border border-border" style={{ background: form.colorClass }} />
                <Input value={form.colorClass} onChange={e => setForm(p => ({ ...p, colorClass: e.target.value }))}
                  placeholder="#6366f1" className="rounded-xl flex-1 text-sm font-mono" dir="ltr" />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <Label className="font-semibold">הגדרות נוספות</Label>
              <div className="flex flex-wrap gap-2">
                <Toggle checked={form.includeInBudget} onChange={v => setForm(p => ({ ...p, includeInBudget: v }))}
                  label="כלול בתקציב" />
                <Toggle checked={form.isCash} onChange={v => setForm(p => ({ ...p, isCash: v }))}
                  label="קופת מזומן" />
                <Toggle checked={form.isActive} onChange={v => setForm(p => ({ ...p, isActive: v }))}
                  label="פעיל" />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">תצוגה מקדימה</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ background: form.colorClass || "#6366f1" }}>
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">{form.name || "שם הקופה"}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", FUND_TYPE_COLORS[form.type] || "bg-gray-100")}>
                      {FUND_TYPE_LABELS[form.type] || ""}
                    </span>
                    {form.isCash && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">מזומן</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl flex-1">
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              {editFund ? "שמור שינויים" : "צור קופה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ───────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>להשהות קופה?</AlertDialogTitle>
            <AlertDialogDescription>
              הקופה תסומן כמושהית ולא תופיע ברשימות. ניתן להפעילה שוב בכל עת.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">
              השהה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
