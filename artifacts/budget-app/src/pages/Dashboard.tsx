import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import {
  HeartHandshake,
  ArrowLeft, Plus, Check, Loader2,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */
type IncomeSummary = { totalIncome: number; totalDeductions: number; netIncome: number };
type BudgetYear    = { tithePercentage: number };
type Tithe         = { id: number; amount: number; recipient: string; isTithe: boolean; date: string };
type FundSummary   = {
  id: number; name: string; colorClass: string; fundBehavior: string; description: string;
  monthlyAllocation: number; annualAllocation: number; initialBalance: number;
  budgetAmount: number; actualAmount: number; remaining: number;
  usagePercent: number; status: "ok" | "warning" | "over";
};

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}


const SECTION_STYLE = "bg-card rounded-2xl border border-border/60 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full";
const SECTION_HEAD  = "flex items-center justify-between px-5 pt-5 pb-3 shrink-0";
const SECTION_TITLE = "flex items-center gap-2 font-display font-bold text-base";
const ICON_WRAP     = (bg: string) => `w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`;
const GO_LINK       = "flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors";

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();

  const [income, setIncome]         = useState<IncomeSummary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0 });
  const [budgetYear, setBudgetYear] = useState<BudgetYear>({ tithePercentage: 10 });
  const [tithes, setTithes]         = useState<Tithe[]>([]);
  const [funds, setFunds]           = useState<FundSummary[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, by, tth, fnd] = await Promise.all([
        apiFetch("/incomes/summary"),
        apiFetch("/budget-year"),
        apiFetch("/charity"),
        apiFetch("/funds/summary"),
      ]);
      setIncome(inc);
      setBudgetYear(by);
      setTithes(tth);
      setFunds(fnd);
    } catch {
      toast({ title: "שגיאה בטעינה", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const titheTarget = income.netIncome * (budgetYear.tithePercentage / 100);
  const titheGiven  = tithes.filter(t => t.isTithe).reduce((s, t) => s + t.amount, 0);
  const titheLeft   = titheTarget - titheGiven;
  const tithePct    = titheTarget > 0 ? Math.min(100, (titheGiven / titheTarget) * 100) : 0;

  const monthlyFunds   = funds.filter(f => f.fundBehavior === "fixed_monthly" || f.fundBehavior === "cash_monthly");
  const annualFunds    = funds.filter(f => f.fundBehavior === "annual_categorized" || f.fundBehavior === "annual_large");
  const nonBudgetFunds = funds.filter(f => f.fundBehavior === "non_budget");

  if (loading) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="h-[calc(100vh-80px)]">
          <div className="bg-muted animate-pulse rounded-2xl h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">

      {/* ══ מעשרות ══════════════════════════════════════════════ */}
      <div className="max-w-lg">
        <TitheCard
          income={income}
          budgetYear={budgetYear}
          tithes={tithes}
          titheTarget={titheTarget}
          titheGiven={titheGiven}
          titheLeft={titheLeft}
          tithePct={tithePct}
          onAdd={async (payload) => {
            const created = await apiFetch("/charity", { method: "POST", body: JSON.stringify(payload) });
            setTithes(prev => [{ ...created, amount: parseFloat(String(created.amount)) }, ...prev]);
          }}
        />
      </div>

      {/* ══ קופות ════════════════════════════════════════════= */}
      {funds.length > 0 && (
        <div className="space-y-5 pb-6">
          <FundGroup title="קופות חודשיות" funds={monthlyFunds} />
          <FundGroup title="קופות שנתיות" funds={annualFunds} />
          <FundGroup title="קופות מחוץ לתקציב" funds={nonBudgetFunds} />
        </div>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD: מעשרות
═══════════════════════════════════════════════════════════ */
function TitheCard({ income, budgetYear, tithes, titheTarget, titheGiven, titheLeft, tithePct, onAdd }: {
  income: IncomeSummary; budgetYear: BudgetYear;
  tithes: Tithe[]; titheTarget: number; titheGiven: number; titheLeft: number; tithePct: number;
  onAdd: (p: any) => Promise<void>;
}) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [open, setOpen]           = useState(false);

  const handleAdd = async () => {
    if (!recipient.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "נמען וסכום נדרשים", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await onAdd({ recipient: recipient.trim(), amount: parseFloat(amount), isTithe: true, date: new Date().toISOString().split("T")[0], description: "" });
      setRecipient(""); setAmount(""); setOpen(false);
      toast({ title: "מעשר נרשם ✓" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const over = titheLeft <= 0;

  return (
    <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center">
            <HeartHandshake className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <span className="font-semibold text-sm">מעשרות</span>
        </div>
        <Link href="/charity">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-violet-600 transition-colors">
            לכל הצדקות <ArrowLeft className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>{fmt(titheGiven)} נתרם</span>
          <span className="font-medium">{Math.round(tithePct)}% מתוך {fmt(titheTarget)}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500",
            over ? "bg-emerald-500" : tithePct >= 80 ? "bg-violet-500" : "bg-violet-400"
          )} style={{ width: `${tithePct}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/50 border-t border-border/50 text-center">
        {[
          { label: "הכנסה נטו", value: fmt(income.netIncome), color: "text-foreground" },
          { label: `יעד ${budgetYear.tithePercentage}%`, value: fmt(titheTarget), color: "text-violet-600" },
          { label: over ? "עודף" : "נותר", value: fmt(Math.abs(titheLeft)), color: over ? "text-emerald-600" : "text-rose-500" },
        ].map(s => (
          <div key={s.label} className="py-3 px-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">{s.label}</p>
            <p className={cn("text-sm font-bold tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tithe list */}
      {tithes.length > 0 && (
        <div className="border-t border-border/50 px-5 py-2">
          {tithes.slice(0, 4).map(t => (
            <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
              <span className="text-xs text-muted-foreground truncate">{t.recipient}</span>
              <span className="text-xs font-semibold text-violet-600 tabular-nums mr-2">{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="border-t border-border/50 px-4 py-2.5">
        {open ? (
          <div className="flex gap-2 items-center">
            <Input value={recipient} onChange={e => setRecipient(e.target.value)}
              placeholder="נמען..." className="rounded-lg h-7 text-xs flex-1" autoFocus />
            <Input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" placeholder="₪" dir="ltr" className="rounded-lg h-7 text-xs w-16" />
            <button onClick={handleAdd} disabled={saving}
              className="p-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            <button onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">ביטול</button>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-600 transition-colors">
            <Plus className="w-3.5 h-3.5" /> רשום מעשר חדש
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FUND GROUP + FUND CARD
═══════════════════════════════════════════════════════════ */
function FundGroup({ title, funds }: { title: string; funds: FundSummary[] }) {
  if (funds.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {funds.map(fund => <FundCard key={fund.id} fund={fund} />)}
      </div>
    </div>
  );
}

function FundCard({ fund }: { fund: FundSummary }) {
  const isMonthly   = fund.fundBehavior === "fixed_monthly" || fund.fundBehavior === "cash_monthly";
  const isNonBudget = fund.fundBehavior === "non_budget";

  const barColor =
    fund.status === "over"    ? "bg-rose-500" :
    fund.status === "warning" ? "bg-amber-500" :
    "bg-emerald-500";

  const remainColor =
    fund.remaining < 0       ? "text-rose-600" :
    fund.remaining === 0     ? "text-muted-foreground" :
    "text-emerald-600";

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fund.colorClass }} />
        <span className="font-semibold text-sm truncate">{fund.name}</span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{isNonBudget ? "יתרת פתיחה" : isMonthly ? "תקציב שנתי" : "תקציב"}</span>
          <span className="font-medium tabular-nums">{fmt(fund.budgetAmount)}</span>
        </div>
        {isMonthly && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">חודשי</span>
            <span className="font-medium tabular-nums">{fmt(fund.monthlyAllocation)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">הוצאות בפועל</span>
          <span className="font-medium tabular-nums">{fmt(fund.actualAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-border/40 pt-1.5">
          <span className="text-muted-foreground">{isNonBudget ? "יתרה" : "נותר"}</span>
          <span className={cn("font-bold tabular-nums", remainColor)}>{fmt(fund.remaining)}</span>
        </div>
      </div>

      {fund.budgetAmount > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{fund.usagePercent}%</span>
            {fund.status === "over" && <span className="text-rose-500 font-medium">חריגה!</span>}
            {fund.status === "warning" && <span className="text-amber-500 font-medium">קרוב לגבול</span>}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${fund.usagePercent}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
