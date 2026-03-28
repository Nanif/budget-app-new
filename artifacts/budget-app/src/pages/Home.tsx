import { useState, useEffect } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  Wallet, Coins, Calendar, ShoppingBag, Landmark, HeartHandshake,
  PiggyBank, ArrowUpRight, ArrowLeft, CreditCard,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Fund = {
  id: number; name: string; fundBehavior: string; colorClass: string;
  monthlyAllocation: number; annualAllocation: number; initialBalance: number; isActive: boolean;
};

async function apiFetch(path: string) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) return null;
  return r.json();
}

function fmt(n: number, short = false) {
  if (short && n >= 1000) return `${Math.round(n / 1000)}K ₪`;
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Home() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [walletData, setWalletData] = useState<{ totals: { deposits: number } } | null>(null);
  const [annualSummary, setAnnualSummary] = useState<{ total: number } | null>(null);
  const [largeSummary, setLargeSummary] = useState<{ total: number } | null>(null);
  const [incomeSummary, setIncomeSummary] = useState<{ netIncome: number; totalIncome: number } | null>(null);
  const [titheData, setTitheData] = useState<{ tithes: any[]; tithePercentage: number } | null>(null);
  const [externalSummaries, setExternalSummaries] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = toMonthStr(now);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const allFunds: Fund[] = (await apiFetch("/funds?all=true")) || [];
        const parsedFunds = allFunds.filter(f => f.isActive).map(f => ({
          ...f,
          monthlyAllocation: parseFloat(String(f.monthlyAllocation) || "0"),
          annualAllocation: parseFloat(String(f.annualAllocation) || "0"),
          initialBalance: parseFloat(String(f.initialBalance) || "0"),
        }));
        setFunds(parsedFunds);

        const cashFund = parsedFunds.find(f => f.fundBehavior === "cash_monthly");
        const annualFund = parsedFunds.find(f => f.fundBehavior === "annual_categorized");
        const largeFund = parsedFunds.find(f => f.fundBehavior === "annual_large");
        const externalFunds = parsedFunds.filter(f => f.fundBehavior === "non_budget");

        const [wallet, annual, large, income, tithes, yearData, ...extResults] = await Promise.all([
          cashFund ? apiFetch(`/wallet?month=${currentMonth}&fundId=${cashFund.id}`) : null,
          annualFund ? apiFetch(`/expenses/summary?fundId=${annualFund.id}`) : null,
          largeFund ? apiFetch(`/expenses/summary?fundId=${largeFund.id}`) : null,
          apiFetch("/incomes/summary"),
          apiFetch("/charity"),
          apiFetch("/budget-year"),
          ...externalFunds.map(f => apiFetch(`/expenses/summary?fundId=${f.id}`)),
        ]);

        setWalletData(wallet);
        setAnnualSummary(annual);
        setLargeSummary(large);
        setIncomeSummary(income);

        const extMap: Record<number, number> = {};
        externalFunds.forEach((f, i) => {
          extMap[f.id] = extResults[i]?.total ?? 0;
        });
        setExternalSummaries(extMap);

        if (tithes && yearData) {
          const titheGiven = tithes.filter((t: any) => t.isTithe).reduce((s: number, t: any) => s + parseFloat(String(t.amount) || "0"), 0);
          setTitheData({ tithes: tithes, tithePercentage: parseFloat(String(yearData.tithePercentage) || "10") });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const cashFund = funds.find(f => f.fundBehavior === "cash_monthly");
  const annualFund = funds.find(f => f.fundBehavior === "annual_categorized");
  const largeFund = funds.find(f => f.fundBehavior === "annual_large");
  const externalFunds = funds.filter(f => f.fundBehavior === "non_budget");

  const walletDeposited = walletData?.totals.deposits ?? 0;
  const walletAllocation = cashFund?.monthlyAllocation ?? 0;
  const walletPct = walletAllocation > 0 ? Math.min(100, (walletDeposited / walletAllocation) * 100) : 0;

  const annualSpent = annualSummary?.total ?? 0;
  const annualBudget = annualFund?.annualAllocation ?? 0;
  const annualPct = annualBudget > 0 ? Math.min(100, (annualSpent / annualBudget) * 100) : 0;

  const largeSpent = largeSummary?.total ?? 0;
  const largeBudget = largeFund?.annualAllocation ?? 0;
  const largePct = largeBudget > 0 ? Math.min(100, (largeSpent / largeBudget) * 100) : 0;

  const netIncome = incomeSummary?.netIncome ?? 0;
  const titheTarget = titheData ? netIncome * (titheData.tithePercentage / 100) : 0;
  const titheGiven = titheData ? titheData.tithes.filter((t: any) => t.isTithe).reduce((s: number, t: any) => s + parseFloat(String(t.amount) || "0"), 0) : 0;
  const titheRemaining = titheTarget - titheGiven;

  const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">שלום 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">{monthLabel} — סקירת מצב התקציב</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* קופת שוטף */}
          <Link href={`${BASE}/cash`}>
            <div className={cn("bg-card rounded-2xl border-2 p-5 hover:shadow-md transition-all cursor-pointer group",
              cashFund ? "border-amber-200/60 hover:border-amber-400/60" : "border-border/40"
            )}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold">{cashFund?.name || "קופת שוטף"}</p>
                    <p className="text-xs text-muted-foreground">{monthLabel}</p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {cashFund ? (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">הופקד</span>
                    <span className="font-bold">{fmt(walletDeposited)} / {fmt(walletAllocation)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", walletPct >= 100 ? "bg-amber-500" : "bg-amber-400")}
                      style={{ width: `${walletPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {walletPct >= 100 ? "הגעת ליעד החודשי" : `נותר להפקיד: ${fmt(walletAllocation - walletDeposited)}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">לא הוגדרה קופת שוטף</p>
              )}
            </div>
          </Link>

          {/* מעגל השנה */}
          <Link href={`${BASE}/annual`}>
            <div className={cn("bg-card rounded-2xl border-2 p-5 hover:shadow-md transition-all cursor-pointer group",
              annualFund ? "border-violet-200/60 hover:border-violet-400/60" : "border-border/40"
            )}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-bold">{annualFund?.name || "מעגל השנה"}</p>
                    <p className="text-xs text-muted-foreground">שנתי</p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {annualFund ? (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">הוצא</span>
                    <span className="font-bold">{fmt(annualSpent)} / {fmt(annualBudget)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      annualPct >= 100 ? "bg-rose-500" : annualPct > 80 ? "bg-amber-500" : "bg-violet-500"
                    )} style={{ width: `${annualPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {Math.round(annualPct)}% מהתקציב · נותר {fmt(annualBudget - annualSpent)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">לא הוגדרה קופת מעגל השנה</p>
              )}
            </div>
          </Link>

          {/* הוצאות גדולות */}
          <Link href={`${BASE}/large`}>
            <div className={cn("bg-card rounded-2xl border-2 p-5 hover:shadow-md transition-all cursor-pointer group",
              largeFund ? "border-rose-200/60 hover:border-rose-400/60" : "border-border/40"
            )}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="font-bold">{largeFund?.name || "הוצאות גדולות"}</p>
                    <p className="text-xs text-muted-foreground">שנתי</p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {largeFund ? (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">הוצא</span>
                    <span className="font-bold">{fmt(largeSpent)} / {fmt(largeBudget)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      largePct >= 100 ? "bg-rose-600" : largePct > 80 ? "bg-amber-500" : "bg-rose-400"
                    )} style={{ width: `${largePct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {Math.round(largePct)}% מהתקציב · נותר {fmt(largeBudget - largeSpent)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">לא הוגדרה קופת הוצאות גדולות</p>
              )}
            </div>
          </Link>

          {/* הכנסות */}
          <Link href={`${BASE}/incomes`}>
            <div className="bg-card rounded-2xl border-2 border-emerald-200/60 hover:border-emerald-400/60 p-5 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold">הכנסות</p>
                    <p className="text-xs text-muted-foreground">נטו לאחר ניכויים</p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-display font-bold text-emerald-600">{fmt(netIncome)}</p>
              <p className="text-xs text-muted-foreground mt-1.5">הכנסה נטו צבורה השנה</p>
            </div>
          </Link>

          {/* מעשרות */}
          <Link href={`${BASE}/charity`}>
            <div className="bg-card rounded-2xl border-2 border-violet-200/60 hover:border-violet-400/60 p-5 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <HeartHandshake className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-bold">מעשרות</p>
                    <p className="text-xs text-muted-foreground">{titheData?.tithePercentage ?? 10}% מהכנסה נטו</p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-display font-bold text-violet-600">{fmt(titheGiven)}</p>
                  <p className="text-xs text-muted-foreground mt-1">ניתן מתוך {fmt(titheTarget)}</p>
                </div>
                {titheRemaining > 0 && (
                  <div className="text-left">
                    <p className="text-sm font-bold text-rose-500">{fmt(titheRemaining)}</p>
                    <p className="text-xs text-muted-foreground">נותר לתת</p>
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* קופות חיצוניות */}
          {externalFunds.length > 0 && (
            <Link href={`${BASE}/external`}>
              <div className="bg-card rounded-2xl border-2 border-blue-200/60 hover:border-blue-400/60 p-5 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <PiggyBank className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold">קופות חיצוניות</p>
                      <p className="text-xs text-muted-foreground">{externalFunds.length} קופות</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-1.5">
                  {externalFunds.slice(0, 3).map(f => {
                    const spent = externalSummaries[f.id] ?? 0;
                    const balance = f.initialBalance - spent;
                    return (
                      <div key={f.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: f.colorClass }} />
                          <span>{f.name}</span>
                        </div>
                        <span className={cn("font-semibold tabular-nums", balance < 0 ? "text-rose-600" : "text-emerald-600")}>
                          {fmt(balance)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Link>
          )}

          {/* חובות וחסכונות */}
          <Link href={`${BASE}/debts`}>
            <div className="bg-card rounded-2xl border-2 border-slate-200/60 hover:border-slate-400/60 p-5 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold">חובות וחסכונות</p>
                    <p className="text-xs text-muted-foreground">משכנתא, הלוואות, נכסים</p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-muted-foreground">לחץ לצפייה בפרטים</p>
            </div>
          </Link>

        </div>
      )}

      {/* Quick setup prompt if no funds */}
      {!loading && funds.length === 0 && (
        <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-6 text-center space-y-3">
          <Coins className="w-12 h-12 mx-auto text-primary/40" />
          <h3 className="font-bold text-lg">מתחילים להגדיר את התקציב</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            עבור לעמוד תכנון התקציב כדי להגדיר את הקופות השנתיות והחודשיות שלך
          </p>
          <Link href={`${BASE}/budget`}>
            <button className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> לתכנון תקציב
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
