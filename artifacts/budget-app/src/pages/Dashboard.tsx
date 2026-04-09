import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useCashCurrentMonth } from "@/hooks/useCashCurrentMonth";
import { useCashFund } from "@/hooks/useCashFund";
import {
  HeartHandshake, ArrowLeft, Plus, Check, Loader2,
  Wallet, ArrowDownLeft, ArrowUpRight, ChevronDown, Sparkles, X,
  ChevronRight, ChevronLeft, TrendingUp, Scale, TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Legend,
} from "recharts";

/* ── Types ─────────────────────────────────────────────────── */
type MonthlyEntry  = { month: string; entryType: string; total: number };
type IncomeSummary = { totalIncome: number; totalDeductions: number; netIncome: number; monthly: MonthlyEntry[] };
type BudgetYear    = { tithePercentage: number; totalBudget: number; startDate: string; endDate: string };
type Tithe         = { id: number; amount: number; recipient: string; isTithe: boolean; date: string };
type WalletTotals  = { deposits: number; withdrawals: number; net: number };
type WalletTx      = { id: number; type: "deposit" | "withdrawal"; amount: number; date: string; description: string };
type RecentTx      = { id: number; label: string; amount: number; date: string; sign: "+" | "-" };
type FundSummary   = {
  id: number; name: string; colorClass: string; fundBehavior: string; description: string;
  monthlyAllocation: number; annualAllocation: number; initialBalance: number;
  budgetAmount: number; actualAmount: number; remaining: number;
  usagePercent: number; status: "ok" | "warning" | "over"; hasTxn: boolean;
};
type NwRecord = { id: number; recordedAt: string; totalSavings: number; totalDebts: number; netWorth: number; };

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

/* ── Modal ──────────────────────────────────────────────────── */
function TxModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { toast } = useToast();
  const { activeBid, activeYear } = useBudgetYear();
  const { currentMonth, setCurrentMonth } = useCashCurrentMonth(activeBid);
  const { cashFundId } = useCashFund();

  const [income, setIncome]         = useState<IncomeSummary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0, monthly: [] });
  const [budgetYear, setBudgetYear] = useState<BudgetYear>({ tithePercentage: 10, totalBudget: 0, startDate: "", endDate: "" });
  const [tithes, setTithes]         = useState<Tithe[]>([]);
  const [funds, setFunds]           = useState<FundSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [walletTotals, setWalletTotals]     = useState<WalletTotals | null>(null);
  const [walletTransactions, setWalletTxs] = useState<WalletTx[]>([]);
  const [cashFund, setCashFund]             = useState<FundSummary | null>(null);
  const [nwRecords, setNwRecords]           = useState<NwRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, by, tth, fnd, nwr] = await Promise.all([
        apiFetch("/incomes/summary"),
        apiFetch("/budget-year"),
        apiFetch("/charity"),
        apiFetch("/funds/summary"),
        apiFetch("/net-worth-records"),
      ]);
      setIncome(inc);
      setBudgetYear(by);
      setTithes(tth);
      setFunds(fnd);
      setNwRecords(nwr);
    } catch {
      toast({ title: "שגיאה בטעינה", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const cashMonthlyFunds = funds.filter(f => f.fundBehavior === "cash_monthly");
    const cf = cashFundId
      ? (cashMonthlyFunds.find(f => f.id === cashFundId) ?? cashMonthlyFunds[0] ?? null)
      : (cashMonthlyFunds[0] ?? null);
    setCashFund(cf ?? null);
    if (!cf) return;
    apiFetch(`/wallet?month=${currentMonth}&fundId=${cf.id}&bid=${activeBid}`)
      .then((d: { totals: WalletTotals; transactions: WalletTx[] }) => {
        setWalletTotals(d.totals);
        setWalletTxs(d.transactions ?? []);
      })
      .catch(() => {});
  }, [funds, currentMonth, cashFundId, activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  const titheTarget = income.netIncome * (budgetYear.tithePercentage / 100);
  const titheGiven  = tithes.filter(t => t.isTithe).reduce((s, t) => s + t.amount, 0);
  const titheLeft   = titheTarget - titheGiven;
  const tithePct    = titheTarget > 0 ? Math.min(100, (titheGiven / titheTarget) * 100) : 0;

  const MONTHLY_BEH    = new Set(["fixed_monthly", "expense_monthly", "cash_monthly"]);
  const NON_BUDGET_BEH = new Set(["non_budget", "fixed_non_budget", "expense_non_budget"]);
  const NO_TXN_BEH     = new Set(["fixed_monthly", "fixed_non_budget", "fixed_annual"]);

  const activeFunds    = funds.filter(f => !NO_TXN_BEH.has(f.fundBehavior));
  const monthlyFunds   = activeFunds.filter(f => MONTHLY_BEH.has(f.fundBehavior) && f.fundBehavior !== "cash_monthly");
  const annualFunds    = activeFunds.filter(f => !MONTHLY_BEH.has(f.fundBehavior) && !NON_BUDGET_BEH.has(f.fundBehavior));
  const nonBudgetFunds = activeFunds.filter(f => NON_BUDGET_BEH.has(f.fundBehavior));

  if (loading) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div className="h-80 bg-muted animate-pulse rounded-3xl" />
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-44 bg-muted animate-pulse rounded-3xl" />)}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">

      {/* ══ שורה עליונה: מעשרות/שוטף + גרף ══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

        {/* מעשרות — קופת שוטף (מוערם) */}
        <div className="space-y-4">
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
          {cashFund && (
            <WalletMonthCard
              fundName={cashFund.name}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              minMonth={activeYear?.startDate ? activeYear.startDate.slice(0, 7) : undefined}
              maxMonth={activeYear?.endDate ? activeYear.endDate.slice(0, 7) : undefined}
              monthlyTarget={cashFund.monthlyAllocation}
              totals={walletTotals}
              transactions={walletTransactions}
            />
          )}
        </div>

        {/* גרף התקדמות הכנסות + שווי נטו */}
        <div className="space-y-4">
          <IncomeProgressChart
            income={income}
            budgetYear={budgetYear}
            funds={funds}
          />
          <NetWorthSummaryCard records={nwRecords} />
        </div>
      </div>

      {/* ══ קופות ════════════════════════════════════════════= */}
      {funds.length > 0 && (
        <div className="space-y-7 pb-6">
          <FundGroup title="קופות חודשיות" funds={monthlyFunds} activeBid={activeBid} accent="blue" />
          <FundGroup title="קופות שנתיות"  funds={annualFunds}  activeBid={activeBid} accent="teal" />
          <FundGroup title="מחוץ לתקציב"   funds={nonBudgetFunds} activeBid={activeBid} accent="slate" />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHART: התקדמות הכנסות שנתית
═══════════════════════════════════════════════════════════ */
const MONTH_NAMES_SHORT = ["ינו","פבר","מרץ","אפר","מאי","יוני","יולי","אוג","ספט","אוק","נוב","דצמ"];

const NON_BUDGET_CHART = new Set(["non_budget", "fixed_non_budget", "expense_non_budget"]);

function IncomeProgressChart({ income, budgetYear, funds }: {
  income: IncomeSummary;
  budgetYear: BudgetYear;
  funds: FundSummary[];
}) {
  const { startDate, endDate } = budgetYear;

  const fundsBudget = funds
    .filter(f => !NON_BUDGET_CHART.has(f.fundBehavior))
    .reduce((s, f) => s + (f.budgetAmount ?? 0), 0);

  const tithePct    = budgetYear.tithePercentage ?? 0;
  const totalBudget = tithePct > 0 && tithePct < 100
    ? fundsBudget / (1 - tithePct / 100)
    : fundsBudget;

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  })();

  const months: string[] = (() => {
    if (!startDate || !endDate) return [];
    const result: string[] = [];
    const start = new Date(startDate);
    const end   = new Date(endDate);
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      result.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  })();

  const numMonths = months.length || 12;
  const monthlyTarget = totalBudget / numMonths;

  const netByMonth: Record<string, number> = {};
  for (const e of income.monthly) {
    if (!netByMonth[e.month]) netByMonth[e.month] = 0;
    if (e.entryType === "income") netByMonth[e.month] += e.total;
    else if (e.entryType === "work_deduction") netByMonth[e.month] -= e.total;
  }

  const todayDate     = new Date();
  const todayDay      = todayDate.getDate();
  const todayDaysInM  = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const todayProgress = todayDay / todayDaysInM;

  let cumExpected = 0;
  let cumActual   = 0;
  const data: any[]   = [];
  let todayX: number | null = null;
  let todayGap: number | null = null;

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const prevCumExpected = cumExpected;
    cumExpected += monthlyTarget;

    if (m < todayStr) {
      cumActual += (netByMonth[m] ?? 0);
      data.push({ x: i + 1, צפוי: Math.round(cumExpected), בפועל: Math.round(cumActual), isToday: false });
    } else if (m === todayStr) {
      cumActual += (netByMonth[m] ?? 0);
      const tX        = i + todayProgress;
      const tExpected = Math.round(prevCumExpected + monthlyTarget * todayProgress);
      todayX   = tX;
      todayGap = Math.round(cumActual) - tExpected;
      data.push({ x: tX, צפוי: tExpected, בפועל: Math.round(cumActual), isToday: true });
      data.push({ x: i + 1, צפוי: Math.round(cumExpected), בפועל: null, isToday: false });
    } else {
      data.push({ x: i + 1, צפוי: Math.round(cumExpected), בפועל: null, isToday: false });
    }
  }

  const gap = todayGap;

  const fmtY = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
    return String(v);
  };

  if (!totalBudget || months.length === 0) {
    return (
      <div className="rounded-3xl border border-border/50 shadow-sm bg-card flex items-center justify-center h-64 text-muted-foreground text-sm">
        הגדר מסגרת תקציב כדי לראות את גרף ההתקדמות
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/50 shadow-sm bg-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-50 to-teal-100 dark:from-emerald-950/40 dark:to-teal-900/30 px-5 pt-5 pb-4 border-b border-emerald-100 dark:border-emerald-800/30">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-800/40 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">התקדמות הכנסות שנתית</span>
            </div>
            <p className="text-emerald-600 dark:text-emerald-400 text-xs">
              יעד שנתי (כולל מעשרות): {fmt(Math.round(totalBudget))} · ממוצע חודשי: {fmt(Math.round(monthlyTarget))}
            </p>
          </div>
          {gap !== null && (
            <div className="text-left">
              <p className={cn("text-xl font-bold tabular-nums", gap >= 0 ? "text-emerald-600" : "text-rose-500")}>
                {gap >= 0 ? "+" : ""}{fmt(gap)}
              </p>
              <p className="text-emerald-500 dark:text-emerald-400 text-xs mt-0.5 text-left">
                {gap >= 0 ? "קדימה מהיעד ✓" : "מאחור מהיעד"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 pt-5" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, months.length]}
              ticks={months.map((_, i) => i + 0.5)}
              tickFormatter={(v: number) => {
                const idx = Math.round(v - 0.5);
                if (idx < 0 || idx >= months.length) return "";
                const [, mo] = months[idx].split("-").map(Number);
                return MONTH_NAMES_SHORT[mo - 1];
              }}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtY}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={48}
              orientation="right"
            />
            <Tooltip
              formatter={(value: number, name: string) => [fmt(value), name]}
              labelFormatter={() => ""}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
                direction: "rtl",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8, direction: "rtl" }}
              iconType="plainline"
            />
            {todayX !== null && (
              <ReferenceLine
                x={todayX}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 2"
                opacity={0.5}
                label={{ value: "היום", position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="צפוי"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="בפועל"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={(props: any) => {
                if (!props.payload.isToday) return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} />;
                return <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill="#10b981" stroke="#fff" strokeWidth={2} />;
              }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
  const [addOpen, setAddOpen]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAdd = async () => {
    if (!recipient.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "נמען וסכום נדרשים", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await onAdd({ recipient: recipient.trim(), amount: parseFloat(amount), isTithe: true, date: new Date().toISOString().split("T")[0], description: "" });
      setRecipient(""); setAmount(""); setAddOpen(false);
      toast({ title: "מעשר נרשם ✓" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const over = titheLeft <= 0;

  return (
    <>
      <div className="rounded-3xl overflow-hidden border border-border/50 shadow-sm bg-card flex flex-col">
        {/* Soft gradient header */}
        <div className="bg-gradient-to-l from-violet-50 to-purple-100 dark:from-violet-950/40 dark:to-purple-900/30 px-5 pt-5 pb-4 relative overflow-hidden border-b border-violet-100 dark:border-violet-800/30">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-800/40 flex items-center justify-center">
                  <HeartHandshake className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="font-semibold text-sm text-violet-900 dark:text-violet-100">מעשרות</span>
              </div>
              <p className="text-violet-900 dark:text-violet-100 text-2xl font-bold tabular-nums tracking-tight">{fmt(titheGiven)}</p>
              <p className="text-violet-500 dark:text-violet-400 text-xs mt-0.5">נתרם מתוך {fmt(titheTarget)}</p>
            </div>
            <div className="text-left">
              <p className={cn("text-2xl font-bold tabular-nums", over ? "text-emerald-600" : "text-rose-500")}>
                {fmt(Math.abs(titheLeft))}
              </p>
              <p className="text-violet-500 dark:text-violet-400 text-xs mt-0.5 text-left">{over ? "עודף ✓" : "נותר לתת"}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-violet-500 dark:text-violet-400 text-[11px] mb-1.5">
              <span>{Math.round(tithePct)}% הושלם</span>
              <span>יעד {budgetYear.tithePercentage}% מהכנסה</span>
            </div>
            <div className="h-2 bg-violet-200/60 dark:bg-violet-800/40 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", over ? "bg-emerald-500" : "bg-violet-500")}
                style={{ width: `${tithePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/40 border-b border-border/40">
          {[
            { label: "הכנסה נטו", value: fmt(income.netIncome), cls: "text-foreground" },
            { label: `יעד ${budgetYear.tithePercentage}%`, value: fmt(titheTarget), cls: "text-violet-600" },
            { label: over ? "עודף" : "נותר", value: fmt(Math.abs(titheLeft)), cls: over ? "text-emerald-600" : "text-rose-500" },
          ].map(s => (
            <div key={s.label} className="py-3 px-2 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">{s.label}</p>
              <p className={cn("text-sm font-bold tabular-nums", s.cls)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <Link href="/charity">
            <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-600 transition-colors">
              לכל הצדקות <ArrowLeft className="w-3 h-3" />
            </span>
          </Link>
          {tithes.length > 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-600 transition-colors"
            >
              {tithes.length} תרומות
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <TxModal title="תרומות ומעשרות" onClose={() => { setModalOpen(false); setAddOpen(false); }}>
          {tithes.length > 0 && (
            <div className="px-4 py-2">
              {tithes.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <span className="text-sm text-muted-foreground truncate">{t.recipient}</span>
                  <span className="text-sm font-semibold text-violet-600 tabular-nums mr-2">{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border/40 px-4 py-3">
            {addOpen ? (
              <div className="flex gap-2 items-center">
                <Input value={recipient} onChange={e => setRecipient(e.target.value)}
                  placeholder="נמען..." className="rounded-lg h-8 text-xs flex-1" autoFocus />
                <Input value={amount} onChange={e => setAmount(e.target.value)}
                  type="number" placeholder="₪" dir="ltr" className="rounded-lg h-8 text-xs w-20" />
                <button onClick={handleAdd} disabled={saving}
                  className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setAddOpen(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">ביטול</button>
              </div>
            ) : (
              <button onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-violet-600 transition-colors">
                <Plus className="w-3.5 h-3.5" /> רשום מעשר חדש
              </button>
            )}
          </div>
        </TxModal>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MONTH PICKER POPOVER
═══════════════════════════════════════════════════════════ */
const MONTH_NAMES_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function MonthPickerPopover({ anchorRef, currentMonth, minMonth, maxMonth, onSelect, onClose }: {
  anchorRef: { current: HTMLButtonElement | null } | null;
  currentMonth: string; minMonth?: string; maxMonth?: string;
  onSelect: (m: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selYear, setSelYear] = useState(() => parseInt(currentMonth.split("-")[0]));
  const [style, setStyle] = useState<React.CSSProperties>({ position: "fixed", top: 0, left: 0, width: 280, zIndex: 9999 });

  // Determine allowed range — clamp maxMonth to today
  const todayStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; })();
  const effectiveMin = minMonth ?? "2000-01";
  const effectiveMax = maxMonth ? (maxMonth < todayStr ? maxMonth : todayStr) : todayStr;
  const minYear = parseInt(effectiveMin.slice(0, 4), 10);
  const maxYear = parseInt(effectiveMax.slice(0, 4), 10);

  useEffect(() => {
    const btn = anchorRef?.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setStyle({ position: "fixed", top: rect.bottom + 4, right: window.innerWidth - rect.right, width: Math.max(rect.width, 280), zIndex: 9999 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = anchorRef?.current;
      if (ref.current && !ref.current.contains(e.target as Node) &&
          (!btn || !btn.contains(e.target as Node))) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  return createPortal(
    <div ref={ref} style={style} className="bg-card border border-border/60 rounded-2xl shadow-xl p-4" dir="rtl">
      {/* Year nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setSelYear(y => y - 1)}
          disabled={selYear <= minYear}
          className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold">{selYear}</span>
        <button
          onClick={() => setSelYear(y => y + 1)}
          disabled={selYear >= maxYear}
          className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      {/* Month chips */}
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => {
          const mStr = `${selYear}-${String(i + 1).padStart(2, "0")}`;
          const isSelected = mStr === currentMonth;
          const outOfRange = mStr < effectiveMin || mStr > effectiveMax;
          return (
            <button key={mStr} onClick={() => { onSelect(mStr); onClose(); }}
              disabled={outOfRange}
              className={cn(
                "rounded-xl py-2 text-xs font-medium transition-all",
                isSelected ? "bg-amber-500 text-white shadow-sm" : "bg-muted/60 hover:bg-muted text-foreground",
                outOfRange && "opacity-20 cursor-default",
              )}
            >
              {MONTH_NAMES_HE[i]}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD: קופת שוטף — חודש נוכחי
═══════════════════════════════════════════════════════════ */
function WalletMonthCard({ fundName, currentMonth, onChangeMonth, minMonth, maxMonth, monthlyTarget, totals, transactions }: {
  fundName: string; currentMonth: string; onChangeMonth: (m: string) => void;
  minMonth?: string; maxMonth?: string;
  monthlyTarget: number; totals: WalletTotals | null; transactions: WalletTx[];
}) {
  const [modalOpen, setModalOpen]       = useState(false);
  const [pickerOpen, setPickerOpen]     = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const [cmYear, cmMonthNum] = currentMonth.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES_HE[cmMonthNum - 1]} ${cmYear}`;

  const deposits    = totals?.deposits    ?? 0;
  const withdrawals = totals?.withdrawals ?? 0;
  const net         = deposits - withdrawals;
  const remaining   = Math.max(0, monthlyTarget - net);
  const pct         = monthlyTarget > 0 ? Math.min(100, (net / monthlyTarget) * 100) : 0;
  const over        = net >= monthlyTarget && monthlyTarget > 0;

  return (
    <>
      <div className="rounded-3xl overflow-hidden border border-border/50 shadow-sm bg-card flex flex-col">
        {/* Soft gradient header */}
        <div className="bg-gradient-to-l from-amber-50 to-orange-100 dark:from-amber-950/40 dark:to-orange-900/30 px-5 pt-5 pb-4 relative overflow-hidden border-b border-amber-100 dark:border-amber-800/30">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">{fundName}</span>
              </div>
              <p className="text-amber-900 dark:text-amber-100 text-2xl font-bold tabular-nums tracking-tight">{fmt(net)}</p>
              <p className="text-amber-500 dark:text-amber-400 text-xs mt-0.5">ניתן החודש</p>
            </div>
            <div className="text-left">
              <p className={cn("text-2xl font-bold tabular-nums", over ? "text-emerald-600" : "text-amber-700 dark:text-amber-300")}>
                {fmt(remaining)}
              </p>
              <p className="text-amber-500 dark:text-amber-400 text-xs mt-0.5 text-left">{over ? "כוסה ✓" : "נותר לתת"}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 relative">
            <div className="flex justify-between text-amber-500 dark:text-amber-400 text-[11px] mb-1.5">
              <span>{Math.round(pct)}% הושלם</span>
              <button
                ref={btnRef}
                onClick={() => setPickerOpen(p => !p)}
                className="bg-amber-200/60 dark:bg-amber-800/40 hover:bg-amber-300/60 dark:hover:bg-amber-700/40 rounded-full px-2 py-0.5 text-amber-700 dark:text-amber-300 transition-colors flex items-center gap-1"
              >
                {monthLabel}
                <ChevronDown className={cn("w-3 h-3 transition-transform", pickerOpen && "rotate-180")} />
              </button>
            </div>
            <div className="h-2 bg-amber-200/60 dark:bg-amber-800/40 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", over ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${Math.max(0, pct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/40 border-b border-border/40">
          <div className="py-3 px-2 text-center">
            <Wallet className="w-3 h-3 mx-auto mb-0.5 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground mb-0.5">תקציב</p>
            <p className="text-sm font-bold tabular-nums">{fmt(monthlyTarget)}</p>
          </div>
          <div className="py-3 px-2 text-center">
            <ArrowDownLeft className="w-3 h-3 mx-auto mb-0.5 text-emerald-500" />
            <p className="text-[10px] text-muted-foreground mb-0.5">ניתן</p>
            <p className="text-sm font-bold tabular-nums text-emerald-600">{fmt(net)}</p>
          </div>
          <div className="py-3 px-2 text-center">
            <ArrowUpRight className="w-3 h-3 mx-auto mb-0.5 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground mb-0.5">{over ? "כוסה ✓" : "נותר לתת"}</p>
            <p className={cn("text-sm font-bold tabular-nums",
              over ? "text-emerald-600" : remaining > 0 ? "text-amber-600" : "text-muted-foreground"
            )}>{fmt(remaining)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span />
          {transactions.length > 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-600 transition-colors"
            >
              תנועות
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <TxModal title={`תנועות — ${fundName}`} onClose={() => setModalOpen(false)}>
          {transactions.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">אין תנועות בחודש זה</p>
          ) : (
            <ul className="divide-y divide-border/30">
              {transactions.slice(0, 20).map(tx => (
                <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {tx.type === "deposit"
                      ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <ArrowUpRight  className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    }
                    <span className="truncate text-sm text-muted-foreground">
                      {tx.description || (tx.type === "deposit" ? "ניתן" : "נלקח")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("text-sm font-medium tabular-nums",
                      tx.type === "deposit" ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {tx.type === "deposit" ? "+" : "−"}{fmt(tx.amount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TxModal>
      )}
      {pickerOpen && (
        <MonthPickerPopover
          anchorRef={btnRef}
          currentMonth={currentMonth}
          minMonth={minMonth}
          maxMonth={maxMonth}
          onSelect={onChangeMonth}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   FUND GROUP + FUND CARD
═══════════════════════════════════════════════════════════ */
const ACCENT_STYLES: Record<string, { dot: string }> = {
  blue:  { dot: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  teal:  { dot: "bg-teal-500/10 text-teal-700 dark:text-teal-400" },
  slate: { dot: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
};

function FundGroup({ title, funds, activeBid, accent }: {
  title: string; funds: FundSummary[]; activeBid: number; accent: string;
}) {
  if (funds.length === 0) return null;
  const a = ACCENT_STYLES[accent] ?? ACCENT_STYLES.teal;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3 px-0.5">
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full", a.dot)}>
          <Sparkles className="w-3 h-3" />
          {title}
        </span>
        <div className="flex-1 h-px bg-border/40" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {funds.map(fund => <FundCard key={fund.id} fund={fund} activeBid={activeBid} />)}
      </div>
    </div>
  );
}

const WALLET_BEHAVIORS = new Set(["cash_monthly", "cash_annual", "non_budget"]);

function FundCard({ fund, activeBid }: { fund: FundSummary; activeBid: number }) {
  const isMonthly   = fund.fundBehavior === "fixed_monthly" || fund.fundBehavior === "cash_monthly";
  const isNonBudget = fund.fundBehavior === "non_budget";

  const [modalOpen, setModalOpen] = useState(false);
  const [txns, setTxns]           = useState<RecentTx[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txFetched, setTxFetched] = useState(false);

  const statusConfig = {
    over:    { bar: "bg-rose-500",    remaining: "text-rose-600",    ring: "border-rose-200 dark:border-rose-800" },
    warning: { bar: "bg-amber-500",   remaining: "text-amber-600",   ring: "border-amber-200 dark:border-amber-800" },
    ok:      { bar: "bg-emerald-500", remaining: "text-emerald-600", ring: "border-border/60" },
  }[fund.status];

  const handleOpen = async () => {
    setModalOpen(true);
    if (!txFetched) {
      setTxLoading(true);
      try {
        if (WALLET_BEHAVIORS.has(fund.fundBehavior)) {
          const d = await apiFetch(`/wallet?fundId=${fund.id}&bid=${activeBid}`);
          const raw: WalletTx[] = d.transactions ?? [];
          setTxns(raw.slice(0, 20).map(t => ({
            id: t.id,
            label: t.description || (t.type === "deposit" ? "ניתן" : "נלקח"),
            amount: t.amount,
            date: t.date,
            sign: t.type === "deposit" ? "+" : "-",
          })));
        } else {
          const raw = await apiFetch(`/expenses?fundId=${fund.id}&bid=${activeBid}`);
          setTxns((raw as any[]).slice(0, 20).map((e: any) => ({
            id: e.id,
            label: e.description || e.categoryName || "הוצאה",
            amount: parseFloat(String(e.amount)),
            date: e.date,
            sign: "-",
          })));
        }
        setTxFetched(true);
      } catch { /* silent */ }
      finally { setTxLoading(false); }
    }
  };

  return (
    <>
      <div className={cn(
        "bg-card border rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden",
        statusConfig.ring,
      )}>
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: fund.colorClass }} />

        {/* Clickable body */}
        <button onClick={handleOpen} className="p-4 flex flex-col gap-3 text-start w-full hover:bg-muted/20 transition-colors flex-1">
          {/* Name row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: fund.colorClass }} />
              <span className="font-semibold text-sm truncate">{fund.name}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </div>

          {/* Numbers */}
          <div className="space-y-1.5 text-xs w-full">
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
              <span className={cn("font-bold tabular-nums", statusConfig.remaining)}>{fmt(fund.remaining)}</span>
            </div>
          </div>

          {/* Progress bar */}
          {fund.budgetAmount > 0 && (
            <div className="w-full">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{fund.usagePercent}%</span>
                {fund.status === "over"    && <span className="text-rose-500 font-semibold">חריגה!</span>}
                {fund.status === "warning" && <span className="text-amber-500 font-semibold">קרוב לגבול</span>}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", statusConfig.bar)}
                  style={{ width: `${fund.usagePercent}%` }} />
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <TxModal title={`תנועות — ${fund.name}`} onClose={() => setModalOpen(false)}>
          {txLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : txns.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">אין תנועות</p>
          ) : (
            <ul className="divide-y divide-border/30">
              {txns.map(tx => (
                <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <span className="truncate text-sm text-muted-foreground flex-1 ml-3">{tx.label}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("text-sm font-medium tabular-nums",
                      tx.sign === "+" ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {tx.sign}{fmt(tx.amount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TxModal>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD: שווי נטו עדכני
═══════════════════════════════════════════════════════════ */
function NetWorthSummaryCard({ records }: { records: NwRecord[] }) {
  if (records.length === 0) return null;

  const latest  = records[0];
  const prev    = records[1] ?? null;
  const delta   = prev !== null ? latest.netWorth - prev.netWorth : null;
  const isPos   = latest.netWorth >= 0;
  const deltaPos = delta !== null && delta >= 0;

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  return (
    <div className="rounded-3xl overflow-hidden border border-border/50 shadow-sm bg-card flex flex-col">
      <div className={cn(
        "px-5 pt-5 pb-4 relative overflow-hidden border-b",
        isPos
          ? "bg-gradient-to-l from-teal-50 to-emerald-100 border-teal-100 dark:from-teal-950/40 dark:to-emerald-900/30 dark:border-teal-800/30"
          : "bg-gradient-to-l from-amber-50 to-orange-100 border-amber-100 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-800/30"
      )}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center",
                isPos ? "bg-teal-100 dark:bg-teal-800/40" : "bg-amber-100 dark:bg-amber-800/40"
              )}>
                <Scale className={cn("w-4 h-4", isPos ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400")} />
              </div>
              <span className={cn("font-semibold text-sm", isPos ? "text-teal-900 dark:text-teal-100" : "text-amber-900 dark:text-amber-100")}>
                שווי נטו
              </span>
            </div>
            <p className={cn("text-2xl font-bold tabular-nums tracking-tight",
              isPos ? "text-teal-900 dark:text-teal-100" : "text-amber-900 dark:text-amber-100"
            )} dir="ltr">
              {isPos ? "+" : "−"}{fmt(Math.abs(latest.netWorth))}
            </p>
            <p className={cn("text-xs mt-0.5", isPos ? "text-teal-500 dark:text-teal-400" : "text-amber-500 dark:text-amber-400")}>
              נכון ל-{fmtDate(latest.recordedAt)}
            </p>
          </div>
          {delta !== null && (
            <div className="text-left">
              <div className={cn("flex items-center gap-1 text-sm font-bold tabular-nums",
                deltaPos ? "text-emerald-600" : "text-rose-500"
              )}>
                {deltaPos
                  ? <TrendingUp className="w-4 h-4" />
                  : <TrendingDown className="w-4 h-4" />
                }
                <span dir="ltr">{deltaPos ? "+" : "−"}{fmt(Math.abs(delta))}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 text-left">
                מהרישום הקודם
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-border/40 border-b border-border/40">
        <div className="py-3 px-4 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">סך נכסים</p>
          <p className="text-sm font-bold tabular-nums text-emerald-600">{fmt(latest.totalSavings)}</p>
        </div>
        <div className="py-3 px-4 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">סך חובות</p>
          <p className="text-sm font-bold tabular-nums text-rose-500">{fmt(latest.totalDebts)}</p>
        </div>
      </div>

      <div className="px-4 py-2.5">
        <Link href="/savings">
          <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-600 transition-colors">
            מעקב התקדמות בפועל <ArrowLeft className="w-3 h-3" />
          </span>
        </Link>
      </div>
    </div>
  );
}
