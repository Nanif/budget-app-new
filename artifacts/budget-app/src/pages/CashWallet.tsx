import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { useCashCurrentMonth, defaultDateForMonth } from "@/hooks/useCashCurrentMonth";
import {
  ArrowDownLeft, ArrowUpRight, Loader2, Wallet,
  ChevronLeft, ChevronRight, AlertCircle, List, Check, Trash2, Pin,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Fund = {
  id: number; name: string; colorClass: string; fundBehavior: string;
  monthlyAllocation: number; isActive: boolean;
};
type Tx = {
  id: number; type: "deposit" | "withdrawal"; amount: number;
  date: string; description: string; fundId: number;
};
type WalletData = {
  transactions: Tx[];
  totals: { deposits: number; withdrawals: number; net: number };
};
type MonthRow = { month: string; deposits: number; withdrawals: number };

const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const toMonthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const mlabel = (s: string) => { const [y, m] = s.split("-"); return `${MONTH_NAMES[+m - 1]} ${y}`; };

function KpiCard({
  label, value, sub, color, accent,
}: { label: string; value: string; sub?: string; color: string; accent?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/60 p-4 bg-card space-y-1", accent)}>
      <p className={cn("text-xl font-display font-bold tabular-nums leading-tight", color)}>{value}</p>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

function TxRow({
  tx, showMonthYear, onDelete,
}: { tx: Tx; showMonthYear?: boolean; onDelete: (id: number) => void }) {
  const d = new Date(tx.date);
  const isDeposit = tx.type === "deposit";
  return (
    <tr className="group border-b border-border/40 last:border-0 hover:bg-muted/40 transition-colors">
      <td className="py-3 px-4 text-sm text-right tabular-nums whitespace-nowrap">
        {d.toLocaleDateString("he-IL")}
      </td>
      <td className="py-3 px-4 text-sm text-right max-w-[220px]">
        <span className="flex items-center gap-2">
          <span className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0",
            isDeposit ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
          )}>
            {isDeposit ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          </span>
          <span className="truncate">{tx.description || (isDeposit ? "ניתן" : "נלקח")}</span>
        </span>
      </td>
      <td className={cn("py-3 px-4 text-sm font-bold tabular-nums text-right",
        isDeposit ? "text-emerald-600" : "text-rose-500"
      )}>
        {isDeposit ? "+" : "−"}{fmt(tx.amount)}
      </td>
      {showMonthYear && (
        <>
          <td className="py-3 px-4 text-sm text-right text-muted-foreground">
            {MONTH_NAMES[d.getMonth()]}
          </td>
          <td className="py-3 px-4 text-sm text-right text-muted-foreground tabular-nums">
            {d.getFullYear()}
          </td>
        </>
      )}
      <td className="py-3 px-4 text-right">
        <button
          onClick={() => onDelete(tx.id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function TxTable({
  transactions, showMonthYear, onDelete,
}: { transactions: Tx[]; showMonthYear?: boolean; onDelete: (id: number) => void }) {
  if (!transactions.length) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">אין תנועות</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full" dir="rtl">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">תאריך</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">תיאור</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">סכום</th>
            {showMonthYear && (
              <>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">חודש</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">שנה</th>
              </>
            )}
            <th className="py-2.5 px-4 w-12" />
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <TxRow key={tx.id} tx={tx} showMonthYear={showMonthYear} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearMonthGrid({
  yearSummary, monthlyAlloc, year, selectedMonth, currentMonth, onSelectMonth,
}: {
  yearSummary: MonthRow[];
  monthlyAlloc: number;
  year: number;
  selectedMonth: string;
  currentMonth: string;
  onSelectMonth: (m: string) => void;
}) {
  const now = new Date();
  return (
    <div className="overflow-x-auto">
      <table className="w-full" dir="rtl">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">חודש</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">יעד</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">ניתן</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">נלקח</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right">יתרה</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-right w-24">התקדמות</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => {
            const mNum = i + 1;
            const mStr = `${year}-${String(mNum).padStart(2, "0")}`;
            const row = yearSummary.find(r => r.month === mStr);
            const deposits = row?.deposits ?? 0;
            const withdrawals = row?.withdrawals ?? 0;
            const balance = deposits - withdrawals;
            const pct = monthlyAlloc > 0 ? Math.min(100, (deposits / monthlyAlloc) * 100) : 0;
            const isFuture = year > now.getFullYear() || (year === now.getFullYear() && mNum > now.getMonth() + 1);
            const isSelected = mStr === selectedMonth;
            const isCurrentMonth = mStr === currentMonth;
            return (
              <tr
                key={mStr}
                onClick={() => onSelectMonth(mStr)}
                className={cn(
                  "border-b border-border/40 last:border-0 cursor-pointer transition-colors",
                  isSelected ? "bg-primary/8 font-medium" : "hover:bg-muted/40",
                  isFuture && "opacity-40",
                )}
              >
                <td className="py-3 px-4 text-sm text-right">
                  <span className="flex items-center gap-2">
                    {isCurrentMonth && <Pin className="w-3 h-3 text-emerald-600 shrink-0" />}
                    {MONTH_NAMES[i]}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-right tabular-nums text-muted-foreground">
                  {fmt(monthlyAlloc)}
                </td>
                <td className={cn("py-3 px-4 text-sm text-right tabular-nums font-medium",
                  deposits > 0 ? "text-emerald-600" : "text-muted-foreground"
                )}>
                  {deposits > 0 ? fmt(deposits) : "—"}
                </td>
                <td className={cn("py-3 px-4 text-sm text-right tabular-nums",
                  withdrawals > 0 ? "text-rose-500" : "text-muted-foreground"
                )}>
                  {withdrawals > 0 ? fmt(withdrawals) : "—"}
                </td>
                <td className={cn("py-3 px-4 text-sm text-right tabular-nums font-semibold",
                  balance > 0 ? "text-primary" : balance < 0 ? "text-rose-600" : "text-muted-foreground"
                )}>
                  {deposits > 0 || withdrawals > 0 ? fmt(balance) : "—"}
                </td>
                <td className="py-3 px-4">
                  {!isFuture && monthlyAlloc > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full",
                            pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : "bg-amber-400"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground w-8 text-left tabular-nums">
                        {Math.round(pct)}%
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-border bg-muted/30">
          <tr>
            <td className="py-3 px-4 text-sm font-bold text-right">סה"כ</td>
            <td className="py-3 px-4 text-sm font-bold text-right tabular-nums">{fmt(monthlyAlloc * 12)}</td>
            <td className="py-3 px-4 text-sm font-bold text-right tabular-nums text-emerald-600">
              {fmt(yearSummary.reduce((s, r) => s + r.deposits, 0))}
            </td>
            <td className="py-3 px-4 text-sm font-bold text-right tabular-nums text-rose-500">
              {fmt(yearSummary.reduce((s, r) => s + r.withdrawals, 0))}
            </td>
            <td className="py-3 px-4 text-sm font-bold text-right tabular-nums text-primary">
              {fmt(yearSummary.reduce((s, r) => s + r.deposits - r.withdrawals, 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function CashWallet() {
  const { toast } = useToast();
  const { activeYear } = useBudgetYear();
  const now = new Date();

  const { currentMonth, setCurrentMonth } = useCashCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const [fund, setFund] = useState<Fund | null>(null);
  const [monthData, setMonthData] = useState<WalletData | null>(null);
  const [yearSummary, setYearSummary] = useState<MonthRow[]>([]);
  const [allTx, setAllTx] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTxOpen, setAllTxOpen] = useState(false);
  const [allTxLoading, setAllTxLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [txType, setTxType] = useState<"deposit" | "withdrawal">("deposit");
  const [form, setForm] = useState({ amount: "", description: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const budgetYear = (() => {
    if (!activeYear) return now.getFullYear();
    const m = activeYear.startDate?.match(/(\d{4})/);
    return m ? parseInt(m[1]) : now.getFullYear();
  })();

  useEffect(() => {
    (async () => {
      try {
        const funds: Fund[] = await apiFetch("/funds?all=true");
        const cash = funds.find(f => f.fundBehavior === "cash_monthly" && f.isActive);
        if (cash) {
          setFund({ ...cash, monthlyAllocation: parseFloat(String(cash.monthlyAllocation) || "0") });
        }
      } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    })();
  }, [activeYear?.id]);

  useEffect(() => {
    if (!fund) return;
    loadMonth();
  }, [fund, month]);

  useEffect(() => {
    if (!fund) return;
    loadYearSummary();
  }, [fund, budgetYear]);

  const loadMonth = async () => {
    if (!fund) return;
    setLoading(true);
    try {
      const d = await apiFetch(`/wallet?month=${month}&fundId=${fund.id}`);
      setMonthData(d);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const loadYearSummary = async () => {
    if (!fund) return;
    try {
      const rows: { month: string; type: string; total: number }[] =
        await apiFetch(`/wallet/summary?year=${budgetYear}`);
      const map: Record<string, MonthRow> = {};
      for (const r of rows) {
        if (!map[r.month]) map[r.month] = { month: r.month, deposits: 0, withdrawals: 0 };
        if (r.type === "deposit") map[r.month].deposits = r.total;
        else map[r.month].withdrawals = r.total;
      }
      setYearSummary(Object.values(map));
    } catch { }
  };

  const openAllTx = async () => {
    setAllTxOpen(true);
    setAllTxLoading(true);
    try {
      const d = await apiFetch(`/wallet?fundId=${fund!.id}`);
      setAllTx(d.transactions);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setAllTxLoading(false); }
  };

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(toMonthStr(new Date(y, m - 2, 1)));
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(toMonthStr(new Date(y, m, 1)));
  };

  const openDialog = (type: "deposit" | "withdrawal") => {
    setTxType(type);
    setForm({ amount: "", description: "", date: defaultDateForMonth(currentMonth) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!fund) return;
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: "הכנס סכום תקין", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await apiFetch("/wallet", {
        method: "POST",
        body: JSON.stringify({
          fundId: fund.id,
          type: txType,
          amount: parseFloat(form.amount),
          description: form.description || (txType === "deposit" ? "ניתן" : "נלקח"),
          date: form.date || new Date().toISOString().split("T")[0],
        }),
      });
      toast({ title: txType === "deposit" ? "ניתן נרשם ✓" : "נלקח נרשם ✓" });
      setDialogOpen(false);
      await Promise.all([loadMonth(), loadYearSummary()]);
      setAllTx([]);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/wallet/${id}`, { method: "DELETE" });
      toast({ title: "נמחק" });
      setAllTx(prev => prev.filter(t => t.id !== id));
      setMonthData(prev => {
        if (!prev) return null;
        const txs = prev.transactions.filter(t => t.id !== id);
        const deposits = txs.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
        const withdrawals = txs.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);
        return { transactions: txs, totals: { deposits, withdrawals, net: deposits - withdrawals } };
      });
      await loadYearSummary();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const monthlyAlloc = fund?.monthlyAllocation ?? 0;
  const annualBudget = monthlyAlloc * 12;
  const [selYear, selMonth] = month.split("-").map(Number);
  const selMonthLabel = `${MONTH_NAMES[selMonth - 1]} ${selYear}`;

  const yearDeposits = yearSummary.reduce((s, r) => s + r.deposits, 0);
  const yearWithdrawals = yearSummary.reduce((s, r) => s + r.withdrawals, 0);
  const balanceInFund = yearDeposits - yearWithdrawals;

  const monthsElapsed = budgetYear < now.getFullYear() ? 12
    : budgetYear > now.getFullYear() ? 0
    : now.getMonth() + 1;
  const shouldHaveDeposited = monthsElapsed * monthlyAlloc;
  const transferGap = shouldHaveDeposited - yearDeposits;

  const monthDeposits = monthData?.totals.deposits ?? 0;
  const monthWithdrawals = monthData?.totals.withdrawals ?? 0;
  const monthBalance = monthDeposits - monthWithdrawals;
  const monthRemaining = Math.max(0, monthlyAlloc - monthDeposits);
  const monthPct = monthlyAlloc > 0 ? Math.min(100, (monthDeposits / monthlyAlloc) * 100) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title={fund ? `קופת שוטף — ${fund.name}` : "קופת שוטף"}
        description="מעטפת מזומן — ניתן, נלקח ומעקב שנתי"
      >
        <div className="flex gap-2">
          <Button
            onClick={() => openDialog("deposit")}
            className="rounded-xl gap-1.5 h-9 text-sm"
            disabled={!fund}
          >
            <ArrowDownLeft className="w-4 h-4" /> ניתן
          </Button>
          <Button
            onClick={() => openDialog("withdrawal")}
            variant="outline"
            className="rounded-xl gap-1.5 h-9 text-sm border-rose-200 text-rose-600 hover:bg-rose-50"
            disabled={!fund}
          >
            <ArrowUpRight className="w-4 h-4" /> נלקח
          </Button>
        </div>
      </PageHeader>

      {!fund ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-14 text-center space-y-3">
            <Wallet className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="font-semibold">לא הוגדרה קופת שוטף</p>
            <p className="text-sm text-muted-foreground">צור קופה מסוג "שוטף (ארנק מזומן)" בעמוד תכנון התקציב</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Annual KPI bar ─────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard
              label="תקציב שנתי"
              value={fmt(annualBudget)}
              sub={`${fmt(monthlyAlloc)} / חודש`}
              color="text-foreground"
            />
            <KpiCard
              label="ניתן השנה"
              value={fmt(yearDeposits)}
              sub={annualBudget > 0 ? `${Math.round((yearDeposits / annualBudget) * 100)}% מהיעד` : undefined}
              color="text-emerald-600"
            />
            <KpiCard
              label="שאמור לתת"
              value={fmt(shouldHaveDeposited)}
              sub={`עד חודש ${monthsElapsed} (${MONTH_NAMES[monthsElapsed - 1] ?? "—"})`}
              color="text-blue-600"
            />
            <KpiCard
              label={transferGap > 0 ? "נותר לתת" : "ניתן כנדרש ✓"}
              value={fmt(Math.abs(transferGap))}
              sub={transferGap > 0 ? "פיגור ביחס ליעד" : transferGap < 0 ? "ניתן יותר מהיעד" : "עמידה מלאה"}
              color={transferGap > 0 ? "text-amber-600" : "text-emerald-600"}
            />
            <KpiCard
              label="יתרה בקופה"
              value={fmt(balanceInFund)}
              sub={yearWithdrawals > 0 ? `${fmt(yearWithdrawals)} נלקח` : "טרם נלקח"}
              color={balanceInFund >= 0 ? "text-primary" : "text-rose-600"}
            />
          </div>

          {/* ── Monthly view ───────────────────────────────────── */}
          <div className="grid md:grid-cols-[280px_1fr] gap-4">

            {/* Month status card */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-semibold">{selMonthLabel}</p>
                    {month === currentMonth ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium mt-0.5">
                        <Pin className="w-2.5 h-2.5" /> חודש נוכחי
                      </span>
                    ) : (
                      <button
                        onClick={() => { setCurrentMonth(month); }}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-0.5"
                      >
                        <Pin className="w-2.5 h-2.5" /> הגדר כחודש נוכחי
                      </button>
                    )}
                  </div>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted-foreground">ניתן מהיעד</span>
                    <span className="text-xs font-bold tabular-nums">{Math.round(monthPct)}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500",
                        monthPct >= 100 ? "bg-emerald-500" : monthPct >= 60 ? "bg-primary" : "bg-amber-400"
                      )}
                      style={{ width: `${monthPct}%` }}
                    />
                  </div>
                </div>

                {/* Stats list */}
                <div className="space-y-3 text-sm">
                  {[
                    { label: "יעד חודשי", val: fmt(monthlyAlloc), cls: "text-foreground" },
                    { label: "ניתן", val: fmt(monthDeposits), cls: "text-emerald-600" },
                    { label: "נותר לתת", val: fmt(monthRemaining), cls: monthRemaining > 0 ? "text-amber-600" : "text-muted-foreground" },
                    { label: "נלקח", val: fmt(monthWithdrawals), cls: "text-rose-500" },
                    { label: "יתרה חודש", val: fmt(monthBalance), cls: monthBalance >= 0 ? "text-primary font-bold" : "text-rose-600 font-bold" },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className={cn("tabular-nums font-medium", s.cls)}>{s.val}</span>
                    </div>
                  ))}
                </div>

                {monthDeposits > monthlyAlloc && monthlyAlloc > 0 && (
                  <div className="flex items-start gap-1.5 text-amber-600 text-xs bg-amber-50 rounded-xl p-2.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>ניתן יותר מהיעד החודשי</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly transactions */}
            <Card className="rounded-2xl overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">תנועות — {selMonthLabel}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openAllTx}
                  className="rounded-xl gap-1.5 text-xs h-7 px-2.5"
                >
                  <List className="w-3.5 h-3.5" /> כל התנועות
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-11 bg-muted animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <TxTable
                    transactions={monthData?.transactions ?? []}
                    onDelete={id => setDeleteId(id)}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Annual summary grid ─────────────────────────────── */}
          <Card className="rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-sm">סיכום חודשי שנתי — {budgetYear}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <YearMonthGrid
                yearSummary={yearSummary}
                monthlyAlloc={monthlyAlloc}
                year={budgetYear}
                selectedMonth={month}
                currentMonth={currentMonth}
                onSelectMonth={setMonth}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* ── All Transactions Modal ──────────────────────────────── */}
      <Dialog open={allTxOpen} onOpenChange={setAllTxOpen}>
        <DialogContent className="max-w-2xl rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="w-5 h-5 text-primary" />
              כל תנועות הקופה
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto border border-border/60 rounded-xl">
            {allTxLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-11 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : (
              <TxTable
                transactions={allTx}
                showMonthYear
                onDelete={id => setDeleteId(id)}
              />
            )}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground pt-1 border-t border-border/40">
            <span>{allTx.length} תנועות</span>
            <span className="flex gap-4">
              <span className="text-emerald-600 font-medium">
                ניתן: {fmt(allTx.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0))}
              </span>
              <span className="text-rose-500 font-medium">
                נלקח: {fmt(allTx.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0))}
              </span>
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Transaction Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txType === "deposit"
                ? <><ArrowDownLeft className="w-5 h-5 text-emerald-600" /> ניתן לקופה</>
                : <><ArrowUpRight className="w-5 h-5 text-rose-600" /> נלקח מהקופה</>
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="rounded-xl text-lg font-bold"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תאריך</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תיאור (אופציונלי)</Label>
              <Input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder={txType === "deposit" ? "ניתן לקופה..." : "לאיזה צורך?"}
                className="rounded-xl"
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </div>

            {/* Quick hint */}
            {txType === "deposit" && monthRemaining > 0 && (
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, amount: String(monthRemaining) }))}
                className="w-full text-xs text-primary bg-primary/8 rounded-xl py-2 hover:bg-primary/14 transition-colors"
              >
                מלא יעד חודשי: {fmt(monthRemaining)}
              </button>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl flex-1">
              ביטול
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn("rounded-xl flex-1", txType === "withdrawal" && "bg-rose-600 hover:bg-rose-700")}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ──────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחק תנועה?</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteId!)}
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
