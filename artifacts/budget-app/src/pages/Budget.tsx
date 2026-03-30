import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  Pencil, Check, X, Loader2, Plus, Wallet, Settings2,
  TrendingUp, TrendingDown, AlertTriangle, ArrowLeft,
  Minus, CalendarDays, CircleDollarSign, Trash2,
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
type BudgetYear = { id: number; name: string; totalBudget: number; tithePercentage: number };
type Fund = {
  id: number; name: string; fundBehavior: string; colorClass: string;
  monthlyAllocation: number; annualAllocation: number; initialBalance: number;
  includeInBudget: boolean; isActive: boolean; displayOrder: number; isDefault: boolean;
};
type MonthEntry = { month: string; entryType: string; total: number };
type IncomeSummary = { totalIncome: number; totalDeductions: number; netIncome: number; monthly: MonthEntry[] };
type FundSpend = { fundId: number | null; total: number };

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const BEHAVIOR_LABELS: Record<string, string> = {
  fixed_monthly:      "קבועות",
  cash_monthly:       "שוטף",
  annual_categorized: "מעגל השנה",
  annual_large:       "הוצאות גדולות",
  non_budget:         "חיצוני",
};
const BEHAVIOR_BADGE: Record<string, string> = {
  fixed_monthly:      "bg-slate-100 text-slate-700",
  cash_monthly:       "bg-amber-100 text-amber-700",
  annual_categorized: "bg-violet-100 text-violet-700",
  annual_large:       "bg-rose-100 text-rose-700",
  non_budget:         "bg-gray-100 text-gray-500",
};
const BEHAVIOR_OPTIONS = [
  { value: "fixed_monthly",      label: "קבועות (חודשי)",        desc: "הוצאות קבועות חודשיות — הגדרת מסגרת" },
  { value: "cash_monthly",       label: "שוטף (ארנק מזומן)",      desc: "ארנק מזומן — מעקב הפקדות חודשיות" },
  { value: "annual_categorized", label: "מעגל השנה (שנתי)",       desc: "הוצאות שנתיות עם קטגוריות" },
  { value: "annual_large",       label: "הוצאות גדולות (שנתי)",   desc: "רכישות גדולות — תיעוד כל הוצאה" },
  { value: "non_budget",         label: "מחוץ לתקציב",            desc: "קופה עם יתרה עצמאית (בונוס, עודפים)" },
];
const COLOR_SWATCHES = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1",
  "#8b5cf6","#a855f7","#ec4899","#f43f5e","#64748b","#475569",
];
/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function fmt(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1000)
    return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K ₪`;
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}
function isMonthlyFund(b: string) { return b === "fixed_monthly" || b === "cash_monthly"; }
function fundBudget(f: Fund) {
  return isMonthlyFund(f.fundBehavior)
    ? f.monthlyAllocation * 12
    : (f.annualAllocation || f.initialBalance || 0);
}
function utilStatus(pct: number): "ok" | "warn" | "over" {
  if (pct >= 100) return "over";
  if (pct >= 80)  return "warn";
  return "ok";
}
function parseFunds(raw: any[]): Fund[] {
  return raw.map(f => ({
    ...f,
    monthlyAllocation: parseFloat(f.monthlyAllocation || "0"),
    annualAllocation:  parseFloat(f.annualAllocation  || "0"),
    initialBalance:    parseFloat(f.initialBalance    || "0"),
  }));
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Budget() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();

  /* ── data ────────────────────────────────────────────────── */
  const [year,     setYear]     = useState<BudgetYear | null>(null);
  const [funds,    setFunds]    = useState<Fund[]>([]);
  const [income,   setIncome]   = useState<IncomeSummary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0, monthly: [] });
  const [spends,   setSpends]   = useState<FundSpend[]>([]);
  const [totalExp, setTotalExp] = useState(0);
  const [loading,  setLoading]  = useState(true);

  /* ── year edit ───────────────────────────────────────────── */
  const [yearEdit,   setYearEdit]   = useState(false);
  const [yearForm,   setYearForm]   = useState({ name: "", totalBudget: "", tithePercentage: "" });
  const [yearSaving, setYearSaving] = useState(false);

  /* ── fund dialog ─────────────────────────────────────────── */
  const [fundDialog,  setFundDialog]  = useState(false);
  const [editFund,    setEditFund]    = useState<Fund | null>(null);
  const [fundForm,    setFundForm]    = useState({
    name: "", fundBehavior: "annual_large", colorClass: "#6366f1",
    monthlyAllocation: "", annualAllocation: "", initialBalance: "",
    includeInBudget: true, description: "",
  });
  const [fundSaving, setFundSaving] = useState(false);

  /* ── fund delete ─────────────────────────────────────────── */
  const [deleteFund,    setDeleteFund]    = useState<Fund | null>(null);
  const [fundDeleting,  setFundDeleting]  = useState(false);

  /* ── load ────────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const [y, f, inc, sp, exp] = await Promise.all([
        apiFetch("/budget-year"),
        apiFetch("/funds?all=true"),
        apiFetch("/incomes/summary"),
        apiFetch("/expenses/by-fund"),
        apiFetch("/expenses/summary"),
      ]);
      setYear(y);
      setFunds(parseFunds(f));
      setIncome(inc);
      setSpends(sp);
      setTotalExp(exp.total ?? 0);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── derived ─────────────────────────────────────────────── */
  const spendMap = useMemo(() => {
    const m: Record<number, number> = {};
    spends.forEach(s => { if (s.fundId) m[s.fundId] = s.total; });
    return m;
  }, [spends]);

  const activeFunds    = funds.filter(f => f.isActive);
  const monthlyFunds   = activeFunds.filter(f => f.fundBehavior === "fixed_monthly" || f.fundBehavior === "cash_monthly");
  const annualFunds    = activeFunds.filter(f => f.fundBehavior === "annual_categorized" || f.fundBehavior === "annual_large");
  const nonBudgetFunds = activeFunds.filter(f => f.fundBehavior === "non_budget");
  const budgetFunds    = activeFunds.filter(f => f.includeInBudget);
  const totalBudget    = budgetFunds.reduce((s, f) => s + fundBudget(f), 0);
  const gap            = income.netIncome - totalExp;

  /* ── year edit helpers ───────────────────────────────────── */
  const openYearEdit = () => {
    if (!year) return;
    setYearForm({ name: year.name, totalBudget: String(year.totalBudget), tithePercentage: String(year.tithePercentage) });
    setYearEdit(true);
  };
  const saveYear = async () => {
    setYearSaving(true);
    try {
      const updated = await apiFetch("/budget-year", {
        method: "PUT",
        body: JSON.stringify({
          name: yearForm.name,
          totalBudget: parseFloat(yearForm.totalBudget) || 0,
          tithePercentage: parseFloat(yearForm.tithePercentage) || 0,
        }),
      });
      setYear(updated); setYearEdit(false);
      toast({ title: "הגדרות שנה עודכנו" });
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setYearSaving(false); }
  };

  /* ── fund dialog helpers ─────────────────────────────────── */
  const openCreateFund = () => {
    setEditFund(null);
    setFundForm({ name: "", fundBehavior: "annual_large", colorClass: "#6366f1", monthlyAllocation: "", annualAllocation: "", initialBalance: "", includeInBudget: true, description: "" });
    setFundDialog(true);
  };
  const openEditFund = (f: Fund) => {
    setEditFund(f);
    setFundForm({
      name: f.name, fundBehavior: f.fundBehavior, colorClass: f.colorClass,
      monthlyAllocation: f.monthlyAllocation > 0 ? String(f.monthlyAllocation) : "",
      annualAllocation:  f.annualAllocation  > 0 ? String(f.annualAllocation)  : "",
      initialBalance:    f.initialBalance    > 0 ? String(f.initialBalance)    : "",
      includeInBudget: f.includeInBudget, description: "",
    });
    setFundDialog(true);
  };
  const saveFund = async () => {
    if (!fundForm.name.trim()) { toast({ title: "שם הקופה נדרש", variant: "destructive" }); return; }
    setFundSaving(true);
    try {
      const monthly = isMonthlyFund(fundForm.fundBehavior);
      const payload = {
        name: fundForm.name.trim(),
        fundBehavior: fundForm.fundBehavior,
        colorClass: fundForm.colorClass,
        description: fundForm.description,
        includeInBudget: fundForm.fundBehavior !== "non_budget",
        monthlyAllocation: monthly ? (parseFloat(fundForm.monthlyAllocation) || 0) : 0,
        annualAllocation: !monthly
          ? (parseFloat(fundForm.annualAllocation) || parseFloat(fundForm.initialBalance) || 0)
          : (parseFloat(fundForm.monthlyAllocation) || 0) * 12,
        initialBalance: parseFloat(fundForm.initialBalance) || 0,
        isActive: true,
        displayOrder: editFund?.displayOrder ?? funds.length,
      };
      if (editFund) {
        const u = await apiFetch(`/funds/${editFund.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setFunds(prev => prev.map(f => f.id === editFund.id ? parseFunds([u])[0] : f));
        toast({ title: "קופה עודכנה" });
      } else {
        const c = await apiFetch("/funds", { method: "POST", body: JSON.stringify(payload) });
        setFunds(prev => [...prev, parseFunds([c])[0]]);
        toast({ title: "קופה נוצרה" });
      }
      setFundDialog(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setFundSaving(false); }
  };

  const handleDeleteFund = async () => {
    if (!deleteFund) return;
    setFundDeleting(true);
    try {
      await apiFetch(`/funds/${deleteFund.id}`, { method: "DELETE" });
      setFunds(prev => prev.filter(f => f.id !== deleteFund.id));
      toast({ title: "קופה הוסרה", description: deleteFund.name });
      setDeleteFund(null);
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setFundDeleting(false); }
  };

  /* ── anomalies ───────────────────────────────────────────── */
  const anomalies = budgetFunds
    .map(f => ({ f, budget: fundBudget(f), spent: spendMap[f.id] ?? 0 }))
    .filter(({ budget, spent }) => budget > 0 && spent / budget >= 0.9)
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="מסגרת התקציב"
        description={year?.name || "שנת תקציב נוכחית"}
      >
        <Button variant="outline" onClick={openYearEdit} className="rounded-xl gap-1.5">
          <Settings2 className="w-4 h-4" /> הגדרות שנה
        </Button>
        <Button onClick={openCreateFund} className="rounded-xl gap-1.5">
          <Plus className="w-4 h-4" /> קופה חדשה
        </Button>
      </PageHeader>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* ══ Annual Summary ═══════════════════════════════════ */}
          <AnnualSummary
            totalBudget={totalBudget}
            totalExpenses={totalExp}
            totalIncome={income.netIncome}
            fundsCount={budgetFunds.length}
            year={year}
            onEditYear={openYearEdit}
          />

          {/* ══ Anomalies ════════════════════════════════════════ */}
          {anomalies.length > 0 && (
            <AnomalySection anomalies={anomalies} onEdit={f => openEditFund(f)} />
          )}

          {/* ══ חודשי ════════════════════════════════════════════ */}
          <FundSection
            title="חודשי"
            funds={monthlyFunds}
            spendMap={spendMap}
            onEdit={openEditFund}
            onDelete={f => setDeleteFund(f)}
            onAdd={openCreateFund}
          />

          {/* ══ שנתי ═════════════════════════════════════════════ */}
          <FundSection
            title="שנתי"
            funds={annualFunds}
            spendMap={spendMap}
            onEdit={openEditFund}
            onDelete={f => setDeleteFund(f)}
            onAdd={openCreateFund}
          />

          {/* ══ מחוץ לתקציב ══════════════════════════════════════ */}
          {nonBudgetFunds.length > 0 && (
            <FundSection
              title="מחוץ לתקציב"
              funds={nonBudgetFunds}
              spendMap={spendMap}
              onEdit={openEditFund}
              onDelete={f => setDeleteFund(f)}
              onAdd={openCreateFund}
              dimmed
            />
          )}
        </>
      )}

      {/* ══ Year Edit Dialog ═════════════════════════════════════ */}
      <Dialog open={yearEdit} onOpenChange={setYearEdit}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">הגדרות שנת תקציב</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">שם השנה</Label>
              <Input value={yearForm.name} onChange={e => setYearForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">יעד תקציב ידני (₪)</Label>
              <Input type="number" dir="ltr" value={yearForm.totalBudget}
                onChange={e => setYearForm(p => ({ ...p, totalBudget: e.target.value }))}
                placeholder="0" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">אחוז מעשרות (%)</Label>
              <Input type="number" dir="ltr" value={yearForm.tithePercentage}
                onChange={e => setYearForm(p => ({ ...p, tithePercentage: e.target.value }))}
                placeholder="10" className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setYearEdit(false)} className="rounded-xl flex-1">
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={saveYear} disabled={yearSaving} className="rounded-xl flex-1">
              {yearSaving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Delete Fund AlertDialog ══════════════════════════════ */}
      <AlertDialog open={!!deleteFund} onOpenChange={o => !o && setDeleteFund(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת קופה</AlertDialogTitle>
            <AlertDialogDescription>
              האם להסיר את הקופה "{deleteFund?.name}"?<br />
              הקופה תוסר מהתצוגה אך הנתונים ההיסטוריים יישמרו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFund}
              disabled={fundDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
            >
              {fundDeleting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              הסר קופה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══ Fund Dialog ══════════════════════════════════════════ */}
      <Dialog open={fundDialog} onOpenChange={setFundDialog}>
        <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editFund ? "עריכת קופה" : "קופה חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="font-semibold flex items-center gap-2">
                שם הקופה *
                {editFund?.isDefault && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-normal">קבועה — לא ניתן לשינוי</span>
                )}
              </Label>
              <Input value={fundForm.name} onChange={e => setFundForm(p => ({ ...p, name: e.target.value }))}
                placeholder='למשל: שוטף, מעגל השנה...' className="rounded-xl"
                disabled={!!editFund?.isDefault} />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">סוג הקופה *</Label>
              <div className="space-y-1.5">
                {BEHAVIOR_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => !editFund?.isDefault && setFundForm(p => ({ ...p, fundBehavior: opt.value }))}
                    className={cn("w-full text-right px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3",
                      fundForm.fundBehavior === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                      editFund?.isDefault && "opacity-60 cursor-not-allowed pointer-events-none"
                    )}>
                    <div className={cn("w-3 h-3 rounded-full mt-1 shrink-0",
                      fundForm.fundBehavior === opt.value ? "bg-primary" : "bg-muted")} />
                    <div>
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">
                {isMonthlyFund(fundForm.fundBehavior) ? "הקצאה חודשית (₪)" :
                  fundForm.fundBehavior === "non_budget" ? "יתרה התחלתית (₪)" : "הקצאה שנתית (₪)"}
              </Label>
              <Input type="number" dir="ltr"
                value={isMonthlyFund(fundForm.fundBehavior) ? fundForm.monthlyAllocation :
                  fundForm.fundBehavior === "non_budget" ? fundForm.initialBalance : fundForm.annualAllocation}
                onChange={e => {
                  const v = e.target.value;
                  if (isMonthlyFund(fundForm.fundBehavior))       setFundForm(p => ({ ...p, monthlyAllocation: v }));
                  else if (fundForm.fundBehavior === "non_budget") setFundForm(p => ({ ...p, initialBalance: v }));
                  else                                             setFundForm(p => ({ ...p, annualAllocation: v }));
                }}
                placeholder="0" className="rounded-xl" />
              {isMonthlyFund(fundForm.fundBehavior) && fundForm.monthlyAllocation && (
                <p className="text-xs text-muted-foreground">שנתי: {fmt((parseFloat(fundForm.monthlyAllocation) || 0) * 12)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">צבע</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map(color => (
                  <button key={color} type="button" onClick={() => setFundForm(p => ({ ...p, colorClass: color }))}
                    className={cn("w-7 h-7 rounded-lg transition-all hover:scale-110",
                      fundForm.colorClass === color && "ring-2 ring-offset-2 ring-foreground scale-110"
                    )}
                    style={{ background: color }}>
                    {fundForm.colorClass === color && <Check className="w-3.5 h-3.5 text-white mx-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFundDialog(false)} className="rounded-xl flex-1">
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={saveFund} disabled={fundSaving} className="rounded-xl flex-1">
              {fundSaving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              {editFund ? "שמור" : "צור קופה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   KPI STRIP
═══════════════════════════════════════════════════════════ */
function KPIStrip({ totalBudget, totalIncome, totalExpenses, gap }: {
  totalBudget: number; totalIncome: number; totalExpenses: number; gap: number;
}) {
  const kpis = [
    {
      label: "תקציב שנתי",
      value: fmt(totalBudget),
      sub:   "סכום כל הקופות",
      icon:  <CircleDollarSign className="w-5 h-5" />,
      bg:    "bg-primary/10 text-primary",
      accent: "text-primary",
    },
    {
      label: "הכנסות בפועל",
      value: fmt(totalIncome),
      sub:   "הכנסה נטו השנה",
      icon:  <TrendingUp className="w-5 h-5" />,
      bg:    "bg-emerald-100 text-emerald-600",
      accent: "text-emerald-600",
    },
    {
      label: "הוצאות בפועל",
      value: fmt(totalExpenses),
      sub:   totalBudget > 0 ? `${Math.round((totalExpenses / totalBudget) * 100)}% מהתקציב` : "—",
      icon:  <TrendingDown className="w-5 h-5" />,
      bg:    "bg-rose-100 text-rose-500",
      accent: "text-rose-600",
    },
    {
      label: gap >= 0 ? "פער חיובי" : "גירעון",
      value: fmt(Math.abs(gap)),
      sub:   gap >= 0 ? "הכנסה עולה על הוצאה" : "הוצאה עולה על הכנסה",
      icon:  gap >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />,
      bg:    gap >= 0 ? "bg-teal-100 text-teal-600" : "bg-orange-100 text-orange-600",
      accent: gap >= 0 ? "text-teal-600" : "text-orange-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {kpis.map(k => (
        <div key={k.label} className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-muted-foreground font-medium">{k.label}</p>
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", k.bg)}>
              {k.icon}
            </div>
          </div>
          <p className={cn("text-2xl font-display font-bold", k.accent)}>{k.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INCOME CHART (SVG bar chart)
═══════════════════════════════════════════════════════════ */
function IncomeChart({ data }: { data: { label: string; income: number; key: string }[] }) {
  const maxVal = Math.max(...data.map(d => d.income), 1);
  const H = 140; // chart height px
  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold">הכנסות לפי חודש</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {now.getFullYear()}
        </span>
      </div>

      {/* SVG bar chart */}
      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${12 * 44} ${H + 24}`} preserveAspectRatio="none"
          className="overflow-visible">
          {/* grid lines */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f}
              x1={0} y1={H - H * f} x2={12 * 44} y2={H - H * f}
              stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,3" />
          ))}
          {/* bars */}
          {data.map((d, i) => {
            const barH  = maxVal > 0 ? (d.income / maxVal) * H : 0;
            const x     = i * 44 + 8;
            const w     = 28;
            const isCur = d.key === curMonthKey;
            const hasData = d.income > 0;
            return (
              <g key={d.key}>
                <rect
                  x={x} y={H - barH} width={w} height={Math.max(barH, 2)}
                  rx="5" ry="5"
                  fill={isCur ? "#0d9488" : hasData ? "#99f6e4" : "#f1f5f9"}
                  className="transition-all"
                />
                {hasData && (
                  <text x={x + w / 2} y={H - barH - 5} textAnchor="middle"
                    className="text-[9px] fill-muted-foreground font-medium" fontSize="9">
                    {d.income >= 1000 ? `${Math.round(d.income / 1000)}K` : d.income}
                  </text>
                )}
                <text x={x + w / 2} y={H + 16} textAnchor="middle"
                  className="fill-muted-foreground font-medium" fontSize="10"
                  fontWeight={isCur ? "700" : "400"}
                  fill={isCur ? "#0d9488" : "#94a3b8"}>
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-teal-500 inline-block" />
          חודש נוכחי
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-teal-200 inline-block" />
          חודשים קודמים
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANNUAL SUMMARY
═══════════════════════════════════════════════════════════ */
function AnnualSummary({ totalBudget, totalExpenses, totalIncome, fundsCount, year, onEditYear }: {
  totalBudget: number; totalExpenses: number; totalIncome: number;
  fundsCount: number; year: BudgetYear | null; onEditYear: () => void;
}) {
  const utilizationPct = totalBudget > 0 ? Math.min(100, (totalExpenses / totalBudget) * 100) : 0;
  const coveragePct    = totalBudget > 0 ? Math.min(200, (totalIncome / totalBudget) * 100) : 0;

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold">סיכום שנתי</h3>
        </div>
        <button onClick={onEditYear}
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          <Settings2 className="w-3 h-3" /> עדכן
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">שנה</span>
          <span className="font-semibold">{year?.name || "—"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">קופות פעילות</span>
          <span className="font-semibold">{fundsCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">מעשרות</span>
          <span className="font-semibold">{year?.tithePercentage ?? 10}%</span>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-border/40">
        {/* Utilization */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">ניצול תקציב</span>
            <span className={cn("font-semibold",
              utilizationPct >= 100 ? "text-rose-600" : utilizationPct >= 80 ? "text-amber-600" : "text-emerald-600"
            )}>{Math.round(utilizationPct)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              utilizationPct >= 100 ? "bg-rose-500" : utilizationPct >= 80 ? "bg-amber-500" : "bg-emerald-500"
            )} style={{ width: `${Math.min(100, utilizationPct)}%` }} />
          </div>
        </div>
        {/* Coverage */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">כיסוי הכנסה</span>
            <span className={cn("font-semibold", coveragePct >= 100 ? "text-emerald-600" : "text-rose-600")}>
              {Math.round(coveragePct)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              coveragePct >= 100 ? "bg-emerald-500" : "bg-rose-400"
            )} style={{ width: `${Math.min(100, coveragePct)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANOMALY SECTION
═══════════════════════════════════════════════════════════ */
function AnomalySection({ anomalies, onEdit }: {
  anomalies: { f: Fund; budget: number; spent: number }[];
  onEdit: (f: Fund) => void;
}) {
  return (
    <section className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-orange-600" />
        <h2 className="font-display font-bold text-orange-800">חריגות וסיכונים</h2>
        <span className="bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full font-semibold">
          {anomalies.length}
        </span>
      </div>
      <div className="space-y-2">
        {anomalies.map(({ f, budget, spent }) => {
          const pct  = budget > 0 ? (spent / budget) * 100 : 0;
          const over = pct >= 100;
          return (
            <div key={f.id}
              className={cn("flex items-center justify-between rounded-xl px-4 py-3 border",
                over ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
              )}>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.colorClass }} />
                <div>
                  <p className="font-semibold text-sm">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(spent)} / {fmt(budget)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-bold", over ? "text-rose-600" : "text-amber-600")}>
                  {Math.round(pct)}%
                </span>
                <button onClick={() => onEdit(f)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FUND CARD
═══════════════════════════════════════════════════════════ */
function FundCard({ fund, spent, onEdit, onDelete, dimmed = false }: {
  fund: Fund; spent: number; onEdit: () => void; onDelete: () => void; dimmed?: boolean;
}) {
  const budget    = fundBudget(fund);
  const remaining = budget - spent;
  const pct       = budget > 0 ? Math.min(150, (spent / budget) * 100) : 0;
  const status    = utilStatus(pct);
  const monthly   = isMonthlyFund(fund.fundBehavior);

  const barColor = status === "over" ? "#ef4444" : status === "warn" ? "#f59e0b" : fund.colorClass;
  const statusLabel = status === "over" ? "חריגה" : status === "warn" ? "קרוב לגבול" : "תקין";
  const statusBg    = status === "over" ? "bg-rose-100 text-rose-700" : status === "warn" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";

  /* route to detail page */
  const detailPath = fund.fundBehavior === "cash_monthly"        ? `/cash`
    : fund.fundBehavior === "fixed_monthly"       ? `/fixed`
    : fund.fundBehavior === "annual_categorized"  ? `/annual`
    : fund.fundBehavior === "annual_large"         ? `/large`
    : fund.fundBehavior === "non_budget"           ? `/external`
    : `/budget`;

  return (
    <div className={cn(
      "bg-card rounded-2xl border border-border/60 p-4 flex flex-col gap-3 hover:shadow-md transition-all group",
      dimmed && "opacity-70"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: `${fund.colorClass}22`, border: `1.5px solid ${fund.colorClass}55` }}>
            <Wallet className="w-4 h-4" style={{ color: fund.colorClass }} />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{fund.name}</p>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", BEHAVIOR_BADGE[fund.fundBehavior] || "bg-gray-100 text-gray-500")}>
              {BEHAVIOR_LABELS[fund.fundBehavior] || fund.fundBehavior}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!fund.isDefault && (
            <button onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <Link href={detailPath}>
            <span className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors block">
              <ArrowLeft className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-muted/40 rounded-xl py-2 px-1">
          <p className="text-[10px] text-muted-foreground">תקציב</p>
          <p className="text-xs font-bold mt-0.5">{fmt(budget, true)}</p>
          {monthly && <p className="text-[9px] text-muted-foreground">{fmt(fund.monthlyAllocation, true)}/חודש</p>}
        </div>
        <div className="bg-muted/40 rounded-xl py-2 px-1">
          <p className="text-[10px] text-muted-foreground">בוצע</p>
          <p className={cn("text-xs font-bold mt-0.5", spent > 0 ? "text-foreground" : "text-muted-foreground")}>{fmt(spent, true)}</p>
        </div>
        <div className={cn("rounded-xl py-2 px-1", remaining >= 0 ? "bg-muted/40" : "bg-rose-50")}>
          <p className="text-[10px] text-muted-foreground">{remaining >= 0 ? "נותר" : "חריגה"}</p>
          <p className={cn("text-xs font-bold mt-0.5", remaining < 0 ? "text-rose-600" : remaining === 0 ? "text-amber-600" : "")}>
            {fmt(Math.abs(remaining), true)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", statusBg)}>
            {statusLabel}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FUND SECTION
═══════════════════════════════════════════════════════════ */
function FundSection({ title, funds, spendMap, onEdit, onDelete, onAdd, dimmed = false }: {
  title: string; funds: Fund[]; spendMap: Record<number, number>;
  onEdit: (f: Fund) => void; onDelete: (f: Fund) => void;
  onAdd: () => void; dimmed?: boolean;
}) {
  const sorted = [...funds].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className={cn("font-display font-bold text-lg", dimmed && "text-muted-foreground")}>{title}</h2>
        <span className="text-sm text-muted-foreground">{funds.length} קופות</span>
      </div>
      {sorted.length === 0 ? (
        <EmptyFunds onAdd={onAdd} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map(fund => (
            <FundCard
              key={fund.id}
              fund={fund}
              spent={spendMap[fund.id] ?? 0}
              onEdit={() => onEdit(fund)}
              onDelete={() => onDelete(fund)}
              dimmed={dimmed}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════ */
function EmptyFunds({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-14 border-2 border-dashed border-border rounded-2xl">
      <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/25" />
      <p className="font-semibold text-muted-foreground mb-1">אין קופות בתקציב</p>
      <p className="text-sm text-muted-foreground mb-4">הוסף קופה ראשונה כדי להתחיל לנהל את התקציב</p>
      <Button onClick={onAdd} variant="outline" className="rounded-xl gap-1.5">
        <Plus className="w-4 h-4" /> קופה חדשה
      </Button>
    </div>
  );
}
