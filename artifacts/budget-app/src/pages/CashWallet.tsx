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
  List, Check, Trash2, Pin, ChevronLeft, ChevronRight,
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

const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];


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

function MonthPicker({
  year, selectedMonth, currentMonth, onSelectMonth, onSetCurrentMonth,
}: {
  year: number;
  selectedMonth: string;
  currentMonth: string;
  onSelectMonth: (m: string) => void;
  onSetCurrentMonth: (m: string) => void;
}) {
  const now = new Date();
  const [selYear, selMon] = selectedMonth.split("-").map(Number);

  const prevMonth = () => {
    const d = new Date(selYear, selMon - 2, 1);
    onSelectMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(selYear, selMon, 1);
    onSelectMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const isCurrentSelected = selectedMonth === currentMonth;
  const selLabel = `${MONTH_NAMES[selMon - 1]} ${selYear}`;

  return (
    <div className="space-y-4 p-4" dir="rtl">
      {/* Month chips grid */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }, (_, i) => {
          const mNum = i + 1;
          const mStr = `${year}-${String(mNum).padStart(2, "0")}`;
          const isSelected = mStr === selectedMonth;
          const isCurrent = mStr === currentMonth;
          const isFuture = year > now.getFullYear() ||
            (year === now.getFullYear() && mNum > now.getMonth() + 1);
          return (
            <button
              key={mStr}
              onClick={() => onSelectMonth(mStr)}
              className={cn(
                "relative rounded-xl py-2.5 px-3 text-sm font-medium transition-all",
                "flex flex-col items-center gap-0.5",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 hover:bg-muted text-foreground",
                isFuture && !isSelected && "opacity-40",
              )}
            >
              <span>{MONTH_NAMES[i]}</span>
              {isCurrent && (
                <span className={cn(
                  "flex items-center gap-0.5 text-[10px] font-semibold",
                  isSelected ? "text-primary-foreground/80" : "text-emerald-600"
                )}>
                  <Pin className="w-2.5 h-2.5" /> נוכחי
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation row */}
      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <button
          onClick={prevMonth}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
        >
          <ChevronRight className="w-4 h-4" />
          חודש קודם
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold">{selLabel}</p>
          {isCurrentSelected ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <Pin className="w-2.5 h-2.5" /> חודש נוכחי
            </span>
          ) : (
            <button
              onClick={() => onSetCurrentMonth(selectedMonth)}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors mt-0.5"
            >
              <Pin className="w-2.5 h-2.5" /> הגדר כחודש נוכחי
            </button>
          )}
        </div>

        <button
          onClick={nextMonth}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
        >
          חודש הבא
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function CashWallet() {
  const { toast } = useToast();
  const { activeYear, activeBid } = useBudgetYear();
  const now = new Date();

  const { currentMonth, setCurrentMonth } = useCashCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const [fund, setFund] = useState<Fund | null>(null);
  const [monthData, setMonthData] = useState<WalletData | null>(null);
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

  const loadMonth = async () => {
    if (!fund) return;
    setLoading(true);
    try {
      const d = await apiFetch(`/wallet?month=${month}&fundId=${fund.id}&bid=${activeBid}`);
      setMonthData(d);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const openAllTx = async () => {
    setAllTxOpen(true);
    setAllTxLoading(true);
    try {
      const d = await apiFetch(`/wallet?fundId=${fund!.id}&bid=${activeBid}`);
      setAllTx(d.transactions);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setAllTxLoading(false); }
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
      await apiFetch(`/wallet?bid=${activeBid}`, {
        method: "POST",
        body: JSON.stringify({
          fundId: fund.id,
          type: txType,
          amount: parseFloat(form.amount),
          description: form.description || (txType === "deposit" ? "ניתן" : "נלקח"),
          date: form.date || new Date().toISOString().split("T")[0],
          activeMonth: currentMonth,
        }),
      });
      toast({ title: txType === "deposit" ? "ניתן נרשם ✓" : "נלקח נרשם ✓" });
      setDialogOpen(false);
      await loadMonth();
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
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const [selYear, selMonth] = month.split("-").map(Number);
  const selMonthLabel = `${MONTH_NAMES[selMonth - 1]} ${selYear}`;

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
          {/* ── Month picker ────────────────────────────────────── */}
          <Card className="rounded-2xl overflow-hidden">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">חודשי שנת תקציב {budgetYear}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MonthPicker
                year={budgetYear}
                selectedMonth={month}
                currentMonth={currentMonth}
                onSelectMonth={setMonth}
                onSetCurrentMonth={setCurrentMonth}
              />
            </CardContent>
          </Card>

          {/* ── Transactions list ───────────────────────────────── */}
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
