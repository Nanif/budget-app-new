import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useCashCurrentMonth } from "@/hooks/useCashCurrentMonth";
import {
  HeartHandshake,
  ArrowLeft, Plus, Check, Loader2, Wallet, ArrowDownLeft, ArrowUpRight, ChevronDown,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */
type IncomeSummary   = { totalIncome: number; totalDeductions: number; netIncome: number };
type BudgetYear      = { tithePercentage: number };
type Tithe           = { id: number; amount: number; recipient: string; isTithe: boolean; date: string };
type WalletTotals    = { deposits: number; withdrawals: number; net: number };
type WalletTx        = { id: number; type: "deposit" | "withdrawal"; amount: number; date: string; description: string };
type RecentTx        = { id: number; label: string; amount: number; date: string; sign: "+" | "-" };
type FundSummary   = {
  id: number; name: string; colorClass: string; fundBehavior: string; description: string;
  monthlyAllocation: number; annualAllocation: number; initialBalance: number;
  budgetAmount: number; actualAmount: number; remaining: number;
  usagePercent: number; status: "ok" | "warning" | "over"; hasTxn: boolean;
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
  const { currentMonth } = useCashCurrentMonth();

  const [income, setIncome]         = useState<IncomeSummary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0 });
  const [budgetYear, setBudgetYear] = useState<BudgetYear>({ tithePercentage: 10 });
  const [tithes, setTithes]         = useState<Tithe[]>([]);
  const [funds, setFunds]           = useState<FundSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [walletTotals, setWalletTotals]         = useState<WalletTotals | null>(null);
  const [walletTransactions, setWalletTxs]     = useState<WalletTx[]>([]);
  const [cashFund, setCashFund]                 = useState<FundSummary | null>(null);

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

  /* fetch wallet data for current month once funds are loaded */
  useEffect(() => {
    const cf = funds.find(f => f.fundBehavior === "cash_monthly");
    setCashFund(cf ?? null);
    if (!cf) return;
    apiFetch(`/wallet?month=${currentMonth}&fundId=${cf.id}`)
      .then((d: { totals: WalletTotals; transactions: WalletTx[] }) => {
        setWalletTotals(d.totals);
        setWalletTxs(d.transactions ?? []);
      })
      .catch(() => {});
  }, [funds, currentMonth]);

  const titheTarget = income.netIncome * (budgetYear.tithePercentage / 100);
  const titheGiven  = tithes.filter(t => t.isTithe).reduce((s, t) => s + t.amount, 0);
  const titheLeft   = titheTarget - titheGiven;
  const tithePct    = titheTarget > 0 ? Math.min(100, (titheGiven / titheTarget) * 100) : 0;

  const MONTHLY_BEH    = new Set(["fixed_monthly", "expense_monthly", "cash_monthly"]);
  const NON_BUDGET_BEH = new Set(["non_budget", "fixed_non_budget", "expense_non_budget"]);
  /* Behaviors with no transaction capability (ללא תנועות) — excluded from dashboard */
  const NO_TXN_BEH     = new Set(["fixed_monthly", "fixed_non_budget", "fixed_annual"]);

  const activeFunds    = funds.filter(f => !NO_TXN_BEH.has(f.fundBehavior));
  const monthlyFunds   = activeFunds.filter(f => MONTHLY_BEH.has(f.fundBehavior) && f.fundBehavior !== "cash_monthly");
  const annualFunds    = activeFunds.filter(f => !MONTHLY_BEH.has(f.fundBehavior) && !NON_BUDGET_BEH.has(f.fundBehavior));
  const nonBudgetFunds = activeFunds.filter(f => NON_BUDGET_BEH.has(f.fundBehavior));

  if (loading) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="h-[calc(100vh-80px)]">
          <div className="bg-muted animate-pulse rounded-2xl h-full" />
        </div>
      </div>
    );
  }

  const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const [cmYear, cmMonth] = currentMonth.split("-").map(Number);
  const currentMonthLabel = `${MONTH_NAMES[cmMonth - 1]} ${cmYear}`;

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

      {/* ══ קופת שוטף — חודש נוכחי ══════════════════════════════ */}
      {cashFund && (
        <div className="max-w-lg">
          <WalletMonthCard
            fundName={cashFund.name}
            monthLabel={currentMonthLabel}
            monthlyTarget={cashFund.monthlyAllocation}
            totals={walletTotals}
            transactions={walletTransactions}
          />
        </div>
      )}

      {/* ══ קופות ════════════════════════════════════════════= */}
      {funds.length > 0 && (
        <div className="space-y-5 pb-6">
          <FundGroup title="קופות חודשיות" funds={monthlyFunds} activeBid={activeBid} />
          <FundGroup title="קופות שנתיות" funds={annualFunds} activeBid={activeBid} />
          <FundGroup title="קופות מחוץ לתקציב" funds={nonBudgetFunds} activeBid={activeBid} />
        </div>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD: קופת שוטף — חודש נוכחי
═══════════════════════════════════════════════════════════ */
function WalletMonthCard({ fundName, monthLabel, monthlyTarget, totals, transactions }: {
  fundName: string;
  monthLabel: string;
  monthlyTarget: number;
  totals: WalletTotals | null;
  transactions: WalletTx[];
}) {
  const [expanded, setExpanded] = useState(false);

  const deposits    = totals?.deposits    ?? 0;
  const withdrawals = totals?.withdrawals ?? 0;
  const net         = deposits - withdrawals;
  const remaining   = Math.max(0, monthlyTarget - net);
  const pct         = monthlyTarget > 0 ? Math.min(100, (net / monthlyTarget) * 100) : 0;
  const over        = net >= monthlyTarget && monthlyTarget > 0;

  const recent = transactions.slice(0, 8);

  return (
    <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header — clickable */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 pt-4 pb-3 text-start hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="font-semibold text-sm">{fundName}</span>
          {transactions.length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-medium">
              {transactions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{monthLabel}</span>
          <Link href="/cash" onClick={e => e.stopPropagation()}>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-amber-600 transition-colors">
              לקופה <ArrowLeft className="w-3 h-3" />
            </span>
          </Link>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")} />
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>
            <span className="text-emerald-600 font-medium">{fmt(deposits)}</span>
            {withdrawals > 0 && <span className="text-rose-500"> − {fmt(withdrawals)}</span>}
            {" = "}
            <span className="font-semibold text-foreground">{fmt(net)} ניתן</span>
          </span>
          <span className="font-medium">{Math.round(pct)}% מתוך {fmt(monthlyTarget)}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500",
            over ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-amber-400"
          )} style={{ width: `${Math.max(0, pct)}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/50 border-t border-border/50 text-center">
        <div className="py-3 px-2">
          <ArrowDownLeft className="w-3 h-3 mx-auto mb-0.5 text-emerald-500" />
          <p className="text-[10px] text-muted-foreground mb-0.5">ניתן</p>
          <p className="text-sm font-bold tabular-nums text-emerald-600">{fmt(deposits)}</p>
        </div>
        <div className="py-3 px-2">
          <ArrowUpRight className="w-3 h-3 mx-auto mb-0.5 text-rose-400" />
          <p className="text-[10px] text-muted-foreground mb-0.5">נלקח</p>
          <p className="text-sm font-bold tabular-nums text-rose-500">−{fmt(withdrawals)}</p>
        </div>
        <div className="py-3 px-2">
          <Wallet className="w-3 h-3 mx-auto mb-0.5 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground mb-0.5">{over ? "כוסה ✓" : "נותר לתת"}</p>
          <p className={cn("text-sm font-bold tabular-nums",
            over ? "text-emerald-600" : remaining > 0 ? "text-amber-600" : "text-muted-foreground"
          )}>{fmt(remaining)}</p>
        </div>
      </div>

      {/* Transactions list — shown when expanded */}
      {expanded && (
        <div className="border-t border-border/50">
          {recent.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">אין תנועות בחודש זה</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {recent.map(tx => (
                <li key={tx.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {tx.type === "deposit"
                      ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <ArrowUpRight  className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    }
                    <span className="truncate text-xs text-muted-foreground">
                      {tx.description || (tx.type === "deposit" ? "הפקדה" : "משיכה")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("text-xs font-medium tabular-nums",
                      tx.type === "deposit" ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {tx.type === "deposit" ? "+" : "−"}{fmt(tx.amount)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
  const [expanded, setExpanded]   = useState(false);

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
          {tithes.length > 0 && !expanded && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {tithes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/charity">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-violet-600 transition-colors">
              לכל הצדקות <ArrowLeft className="w-3 h-3" />
            </span>
          </Link>
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", expanded && "rotate-180")} />
          </button>
        </div>
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

      {/* Tithe list + Add row — visible only when expanded */}
      {expanded && (
        <>
          {tithes.length > 0 && (
            <div className="border-t border-border/50 px-5 py-2">
              {tithes.slice(0, 6).map(t => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <span className="text-xs text-muted-foreground truncate">{t.recipient}</span>
                  <span className="text-xs font-semibold text-violet-600 tabular-nums mr-2">{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
          )}

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
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FUND GROUP + FUND CARD
═══════════════════════════════════════════════════════════ */
function FundGroup({ title, funds, activeBid }: { title: string; funds: FundSummary[]; activeBid: number }) {
  if (funds.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">{title}</h3>
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

  const [expanded, setExpanded]   = useState(false);
  const [txns, setTxns]           = useState<RecentTx[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txFetched, setTxFetched] = useState(false);

  const barColor =
    fund.status === "over"    ? "bg-rose-500" :
    fund.status === "warning" ? "bg-amber-500" :
    "bg-emerald-500";

  const remainColor =
    fund.remaining < 0       ? "text-rose-600" :
    fund.remaining === 0     ? "text-muted-foreground" :
    "text-emerald-600";

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !txFetched) {
      setTxLoading(true);
      try {
        if (WALLET_BEHAVIORS.has(fund.fundBehavior)) {
          const d = await apiFetch(`/wallet?fundId=${fund.id}`);
          const raw: WalletTx[] = d.transactions ?? [];
          setTxns(raw.slice(0, 8).map(t => ({
            id: t.id,
            label: t.description || (t.type === "deposit" ? "הפקדה" : "משיכה"),
            amount: t.amount,
            date: t.date,
            sign: t.type === "deposit" ? "+" : "-",
          })));
        } else {
          const raw = await apiFetch(`/expenses?fundId=${fund.id}&bid=${activeBid}`);
          setTxns((raw as any[]).slice(0, 8).map((e: any) => ({
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
    <div className="bg-card border border-border/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Clickable body */}
      <button onClick={handleToggle} className="p-4 flex flex-col gap-3 text-start w-full hover:bg-muted/20 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fund.colorClass }} />
            <span className="font-semibold text-sm truncate">{fund.name}</span>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200", expanded && "rotate-180")} />
        </div>

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
            <span className={cn("font-bold tabular-nums", remainColor)}>{fmt(fund.remaining)}</span>
          </div>
        </div>

        {fund.budgetAmount > 0 && (
          <div className="w-full">
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
      </button>

      {/* Transactions — shown when expanded */}
      {expanded && (
        <div className="border-t border-border/50">
          {txLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          ) : txns.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground py-3">אין תנועות</p>
          ) : (
            <ul className="divide-y divide-border/30">
              {txns.map(tx => (
                <li key={tx.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="truncate text-muted-foreground flex-1 ml-2">{tx.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("font-medium tabular-nums",
                      tx.sign === "+" ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {tx.sign}{fmt(tx.amount)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
