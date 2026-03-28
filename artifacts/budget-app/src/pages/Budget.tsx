import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Pencil, Check, X, Loader2, Plus, Wallet, Coins,
  CalendarDays, TrendingUp, Settings2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type BudgetYear = {
  id: number; name: string; totalBudget: number; tithePercentage: number; notes: string;
};
type Fund = {
  id: number; name: string; fundBehavior: string; colorClass: string;
  monthlyAllocation: number; annualAllocation: number; initialBalance: number;
  includeInBudget: boolean; isActive: boolean; displayOrder: number;
};

const BEHAVIOR_LABELS: Record<string, string> = {
  fixed_monthly: "קבועות (חודשי)",
  cash_monthly: "שוטף (ארנק מזומן)",
  annual_categorized: "מעגל השנה (שנתי)",
  annual_large: "הוצאות גדולות (שנתי)",
  non_budget: "מחוץ לתקציב",
};
const BEHAVIOR_COLORS: Record<string, string> = {
  fixed_monthly: "bg-slate-100 text-slate-700",
  cash_monthly: "bg-amber-100 text-amber-700",
  annual_categorized: "bg-violet-100 text-violet-700",
  annual_large: "bg-rose-100 text-rose-700",
  non_budget: "bg-gray-100 text-gray-500",
};

const BEHAVIOR_OPTIONS = [
  { value: "fixed_monthly", label: "קבועות (חודשי)", desc: "הוצאות קבועות חודשיות — רק להגדרת מסגרת" },
  { value: "cash_monthly", label: "שוטף (ארנק מזומן)", desc: "ארנק מזומן — מעקב הפקדות חודשיות" },
  { value: "annual_categorized", label: "מעגל השנה (שנתי)", desc: "הוצאות שנתיות עם קטגוריות" },
  { value: "annual_large", label: "הוצאות גדולות (שנתי)", desc: "רכישות גדולות — תיעוד כל הוצאה" },
  { value: "non_budget", label: "מחוץ לתקציב", desc: "קופה עם יתרה עצמאית (בונוס, עודפים)" },
];

const COLOR_SWATCHES = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1",
  "#8b5cf6","#a855f7","#ec4899","#f43f5e","#64748b","#475569",
];

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

export default function Budget() {
  const { toast } = useToast();
  const [year, setYear] = useState<BudgetYear | null>(null);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);

  // Year edit state
  const [yearEdit, setYearEdit] = useState(false);
  const [yearForm, setYearForm] = useState({ name: "", totalBudget: "", tithePercentage: "" });
  const [yearSaving, setYearSaving] = useState(false);

  // Fund dialog
  const [fundDialog, setFundDialog] = useState(false);
  const [editFund, setEditFund] = useState<Fund | null>(null);
  const [fundForm, setFundForm] = useState({
    name: "", fundBehavior: "annual_large", colorClass: "#6366f1",
    monthlyAllocation: "", annualAllocation: "", initialBalance: "",
    includeInBudget: true, description: "",
  });
  const [fundSaving, setFundSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [y, f] = await Promise.all([
        apiFetch("/budget-year"),
        apiFetch("/funds?all=true"),
      ]);
      setYear(y);
      setFunds(f.map((f: any) => ({
        ...f,
        monthlyAllocation: parseFloat(f.monthlyAllocation || "0"),
        annualAllocation: parseFloat(f.annualAllocation || "0"),
        initialBalance: parseFloat(f.initialBalance || "0"),
      })));
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

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
      annualAllocation: f.annualAllocation > 0 ? String(f.annualAllocation) : "",
      initialBalance: f.initialBalance > 0 ? String(f.initialBalance) : "",
      includeInBudget: f.includeInBudget, description: "",
    });
    setFundDialog(true);
  };

  const isMonthly = (b: string) => b === "fixed_monthly" || b === "cash_monthly";

  const saveFund = async () => {
    if (!fundForm.name.trim()) { toast({ title: "שם הקופה נדרש", variant: "destructive" }); return; }
    setFundSaving(true);
    try {
      const monthly = isMonthly(fundForm.fundBehavior);
      const payload = {
        name: fundForm.name.trim(),
        fundBehavior: fundForm.fundBehavior,
        colorClass: fundForm.colorClass,
        description: fundForm.description,
        includeInBudget: fundForm.fundBehavior !== "non_budget",
        monthlyAllocation: monthly ? (parseFloat(fundForm.monthlyAllocation) || 0) : 0,
        annualAllocation: !monthly ? (parseFloat(fundForm.annualAllocation) || parseFloat(fundForm.initialBalance) || 0) : (parseFloat(fundForm.monthlyAllocation) || 0) * 12,
        initialBalance: parseFloat(fundForm.initialBalance) || 0,
        isActive: true,
        displayOrder: editFund?.displayOrder ?? funds.length,
      };
      if (editFund) {
        const updated = await apiFetch(`/funds/${editFund.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setFunds(prev => prev.map(f => f.id === editFund.id ? { ...updated, monthlyAllocation: parseFloat(updated.monthlyAllocation || "0"), annualAllocation: parseFloat(updated.annualAllocation || "0"), initialBalance: parseFloat(updated.initialBalance || "0") } : f));
        toast({ title: "קופה עודכנה" });
      } else {
        const created = await apiFetch("/funds", { method: "POST", body: JSON.stringify(payload) });
        setFunds(prev => [...prev, { ...created, monthlyAllocation: parseFloat(created.monthlyAllocation || "0"), annualAllocation: parseFloat(created.annualAllocation || "0"), initialBalance: parseFloat(created.initialBalance || "0") }]);
        toast({ title: "קופה נוצרה" });
      }
      setFundDialog(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setFundSaving(false); }
  };

  // Compute totals
  const budgetFunds = funds.filter(f => f.isActive && f.includeInBudget);
  const computedBudget = budgetFunds.reduce((sum, f) => {
    if (isMonthly(f.fundBehavior)) return sum + f.monthlyAllocation * 12;
    return sum + f.annualAllocation;
  }, 0);

  const manualBudget = year?.totalBudget ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="תכנון תקציב שנתי" description="הגדר את מסגרת התקציב לשנה, חלק לקופות וקבע אחוז מעשרות">
        <Button onClick={openCreateFund} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> קופה חדשה
        </Button>
      </PageHeader>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : (
        <>
          {/* ── Budget Year Card ───────────────────────────────── */}
          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-primary/0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  {year?.name || "שנת תקציב"}
                </CardTitle>
                {!yearEdit && (
                  <Button variant="ghost" size="sm" onClick={openYearEdit} className="rounded-xl gap-1.5">
                    <Settings2 className="w-4 h-4" /> עדכן הגדרות
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {yearEdit ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">שם השנה</Label>
                    <Input value={yearForm.name} onChange={e => setYearForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">יעד תקציב ידני (₪)</Label>
                    <Input type="number" value={yearForm.totalBudget}
                      onChange={e => setYearForm(p => ({ ...p, totalBudget: e.target.value }))}
                      placeholder="0" className="rounded-xl" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">אחוז מעשרות (%)</Label>
                    <Input type="number" value={yearForm.tithePercentage}
                      onChange={e => setYearForm(p => ({ ...p, tithePercentage: e.target.value }))}
                      placeholder="10" className="rounded-xl" dir="ltr" />
                  </div>
                  <div className="flex gap-2 md:col-span-3">
                    <Button onClick={saveYear} disabled={yearSaving} className="rounded-xl gap-1.5">
                      {yearSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} שמור
                    </Button>
                    <Button variant="outline" onClick={() => setYearEdit(false)} className="rounded-xl gap-1.5">
                      <X className="w-4 h-4" /> ביטול
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-6 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">תקציב שנתי מחושב</p>
                    <p className="text-2xl font-display font-bold text-primary mt-1">{fmt(computedBudget)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">סכום קופות פעילות</p>
                  </div>
                  {manualBudget > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">יעד ידני</p>
                      <p className="text-2xl font-display font-bold mt-1">{fmt(manualBudget)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">אחוז מעשרות</p>
                    <p className="text-2xl font-display font-bold mt-1">{year?.tithePercentage ?? 10}%</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Budget Funds ───────────────────────────────────── */}
          <div>
            <h2 className="font-display font-bold text-lg mb-3 px-1">קופות בתקציב</h2>
            <div className="space-y-2">
              {funds.filter(f => f.isActive && f.includeInBudget).sort((a,b) => a.displayOrder - b.displayOrder).map(fund => (
                <FundBudgetRow key={fund.id} fund={fund} onEdit={() => openEditFund(fund)} />
              ))}
              {funds.filter(f => f.isActive && f.includeInBudget).length === 0 && (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-2xl">
                  <Coins className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">אין קופות עדיין</p>
                  <Button onClick={openCreateFund} variant="outline" size="sm" className="mt-3 rounded-xl gap-1.5">
                    <Plus className="w-4 h-4" /> הוסף קופה ראשונה
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ── Non-budget funds ──────────────────────────────── */}
          {funds.filter(f => f.isActive && !f.includeInBudget).length > 0 && (
            <div>
              <h2 className="font-display font-bold text-lg mb-3 px-1 text-muted-foreground">קופות מחוץ לתקציב</h2>
              <div className="space-y-2">
                {funds.filter(f => f.isActive && !f.includeInBudget).sort((a,b) => a.displayOrder - b.displayOrder).map(fund => (
                  <FundBudgetRow key={fund.id} fund={fund} onEdit={() => openEditFund(fund)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Fund Dialog ───────────────────────────────────────── */}
      <Dialog open={fundDialog} onOpenChange={setFundDialog}>
        <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editFund ? "עריכת קופה" : "קופה חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="font-semibold">שם הקופה *</Label>
              <Input value={fundForm.name} onChange={e => setFundForm(p => ({ ...p, name: e.target.value }))}
                placeholder='למשל: שוטף, מעגל השנה...' className="rounded-xl" />
            </div>

            {/* Behavior */}
            <div className="space-y-2">
              <Label className="font-semibold">סוג הקופה *</Label>
              <div className="space-y-1.5">
                {BEHAVIOR_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setFundForm(p => ({ ...p, fundBehavior: opt.value }))}
                    className={cn("w-full text-right px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3",
                      fundForm.fundBehavior === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
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

            {/* Allocation amount */}
            <div className="space-y-1.5">
              <Label className="font-semibold">
                {isMonthly(fundForm.fundBehavior) ? "הקצאה חודשית (₪)" :
                  fundForm.fundBehavior === "non_budget" ? "יתרה התחלתית (₪)" : "הקצאה שנתית (₪)"}
              </Label>
              <Input type="number" dir="ltr"
                value={isMonthly(fundForm.fundBehavior) ? fundForm.monthlyAllocation :
                  fundForm.fundBehavior === "non_budget" ? fundForm.initialBalance : fundForm.annualAllocation}
                onChange={e => {
                  const v = e.target.value;
                  if (isMonthly(fundForm.fundBehavior)) setFundForm(p => ({ ...p, monthlyAllocation: v }));
                  else if (fundForm.fundBehavior === "non_budget") setFundForm(p => ({ ...p, initialBalance: v }));
                  else setFundForm(p => ({ ...p, annualAllocation: v }));
                }}
                placeholder="0" className="rounded-xl" />
              {isMonthly(fundForm.fundBehavior) && fundForm.monthlyAllocation && (
                <p className="text-xs text-muted-foreground">
                  שנתי: {fmt((parseFloat(fundForm.monthlyAllocation) || 0) * 12)}
                </p>
              )}
            </div>

            {/* Color */}
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

function FundBudgetRow({ fund, onEdit }: { fund: Fund; onEdit: () => void }) {
  const isMonthly = fund.fundBehavior === "fixed_monthly" || fund.fundBehavior === "cash_monthly";
  const annualAmount = isMonthly ? fund.monthlyAllocation * 12 : (fund.annualAllocation || fund.initialBalance);
  const monthlyAmount = isMonthly ? fund.monthlyAllocation : 0;

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-4 hover:border-border transition-all group">
      <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white shadow-sm"
        style={{ background: fund.colorClass }}>
        <Wallet className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold">{fund.name}</p>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", BEHAVIOR_COLORS[fund.fundBehavior] || "bg-gray-100 text-gray-600")}>
            {BEHAVIOR_LABELS[fund.fundBehavior] || fund.fundBehavior}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1">
          {monthlyAmount > 0 && (
            <p className="text-sm text-muted-foreground">{fmt(monthlyAmount)} / חודש</p>
          )}
          <p className="text-sm font-semibold text-primary">{fmt(annualAmount)} / שנה</p>
        </div>
      </div>
      <button onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-all">
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}
