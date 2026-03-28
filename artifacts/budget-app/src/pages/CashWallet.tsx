import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Wallet, ArrowDownLeft, ArrowUpRight, Loader2, Check, X,
  ChevronLeft, ChevronRight, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Fund = {
  id: number; name: string; colorClass: string; fundBehavior: string;
  monthlyAllocation: number; isActive: boolean;
};
type Tx = {
  id: number; type: string; amount: number; date: string; description: string; fundId: number;
};
type WalletData = {
  transactions: Tx[];
  totals: { deposits: number; withdrawals: number; net: number };
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function CashWallet() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(toMonthStr(now));
  const [fund, setFund] = useState<Fund | null>(null);
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [txType, setTxType] = useState<"deposit" | "withdrawal">("deposit");
  const [form, setForm] = useState({ amount: "", description: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Load the cash_monthly fund
  useEffect(() => {
    (async () => {
      try {
        const funds: Fund[] = await apiFetch("/funds?all=true");
        const cash = funds.find(f => f.fundBehavior === "cash_monthly" && f.isActive);
        if (cash) {
          setFund({
            ...cash,
            monthlyAllocation: parseFloat(String(cash.monthlyAllocation) || "0"),
          });
        }
      } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    })();
  }, []);

  useEffect(() => {
    if (!fund) return;
    load();
  }, [fund, month]);

  const load = async () => {
    if (!fund) return;
    setLoading(true);
    try {
      const d = await apiFetch(`/wallet?month=${month}&fundId=${fund.id}`);
      setData(d);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(toMonthStr(d));
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMonth(toMonthStr(d));
  };

  const openDialog = (type: "deposit" | "withdrawal") => {
    setTxType(type);
    setForm({ amount: "", description: "", date: new Date().toISOString().split("T")[0] });
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
          description: form.description || (txType === "deposit" ? "הפקדה לארנק" : "משיכה מהארנק"),
          date: form.date || new Date().toISOString().split("T")[0],
        }),
      });
      toast({ title: txType === "deposit" ? "הפקדה נרשמה" : "משיכה נרשמה" });
      setDialogOpen(false);
      load();
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/wallet/${deleteId}`, { method: "DELETE" });
      setData(prev => prev ? {
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== deleteId),
        totals: recalcTotals(prev.transactions.filter(t => t.id !== deleteId)),
      } : null);
      toast({ title: "רשומה נמחקה" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  function recalcTotals(txs: Tx[]) {
    const deposits = txs.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
    const withdrawals = txs.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);
    return { deposits, withdrawals, net: deposits - withdrawals };
  }

  const [y, m] = month.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`;
  const allocation = fund?.monthlyAllocation ?? 0;
  const deposited = data?.totals.deposits ?? 0;
  const remaining = Math.max(0, allocation - deposited);
  const overDeposit = deposited > allocation;
  const pct = allocation > 0 ? Math.min(100, (deposited / allocation) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="קופת שוטף" description="מעקב הפקדות ומשיכות מהארנק המזומן החודשי">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-muted border border-border/60 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-muted border border-border/60 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </PageHeader>

      {!fund ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center space-y-3">
            <Wallet className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="font-semibold">לא הוגדרה קופת שוטף</p>
            <p className="text-sm text-muted-foreground">צור קופה מסוג "שוטף (ארנק מזומן)" בעמוד תכנון התקציב</p>
            <Button variant="outline" className="rounded-xl" asChild>
              <a href={`${import.meta.env.BASE_URL}budget`}>לעמוד התקציב</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "הקצאה חודשית", value: fmt(allocation), color: "text-foreground" },
              { label: "הופקד חודש זה", value: fmt(deposited), color: "text-emerald-600" },
              { label: "נותר להפקיד", value: fmt(remaining), color: remaining === 0 ? "text-muted-foreground" : "text-primary" },
              { label: "משיכות חריגות", value: fmt(data?.totals.withdrawals ?? 0), color: "text-rose-500" },
            ].map(s => (
              <div key={s.label} className="bg-card rounded-2xl border border-border/60 p-4 text-center">
                <p className={cn("text-xl font-display font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <Card className="rounded-2xl">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-sm">התקדמות הפקדות</p>
                <p className="text-sm font-bold">{Math.round(pct)}%</p>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", overDeposit ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{fmt(deposited)} הופקד</span>
                <span>יעד: {fmt(allocation)}</span>
              </div>
              {overDeposit && (
                <div className="flex items-center gap-1.5 mt-2 text-amber-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>הופקד יותר מהיעד החודשי</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={() => openDialog("deposit")} className="rounded-xl flex-1 gap-2">
              <ArrowDownLeft className="w-4 h-4" /> הפקדה לארנק
            </Button>
            <Button onClick={() => openDialog("withdrawal")} variant="outline" className="rounded-xl flex-1 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50">
              <ArrowUpRight className="w-4 h-4" /> משיכה חריגה
            </Button>
          </div>

          {/* Transactions */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">רשימת פעולות — {monthLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />)}</div>
              ) : !data?.transactions.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">אין פעולות בחודש זה</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {data.transactions.map(tx => (
                    <div key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        tx.type === "deposit" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      )}>
                        {tx.type === "deposit" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{tx.description || (tx.type === "deposit" ? "הפקדה" : "משיכה")}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("he-IL")}</p>
                      </div>
                      <p className={cn("font-bold tabular-nums", tx.type === "deposit" ? "text-emerald-600" : "text-rose-500")}>
                        {tx.type === "deposit" ? "+" : "−"}{fmt(tx.amount)}
                      </p>
                      <button onClick={() => setDeleteId(tx.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Add Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txType === "deposit"
                ? <><ArrowDownLeft className="w-5 h-5 text-emerald-600" /> הפקדה לארנק</>
                : <><ArrowUpRight className="w-5 h-5 text-rose-600" /> משיכה חריגה</>
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input type="number" dir="ltr" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0" className="rounded-xl text-lg font-bold" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תאריך</Label>
              <Input type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="rounded-xl" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">הערה (אופציונלי)</Label>
              <Input value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder={txType === "deposit" ? "הפקדה לארנק..." : "לאיזה צורך?"}
                className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl flex-1">
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving}
              className={cn("rounded-xl flex-1", txType === "withdrawal" && "bg-rose-600 hover:bg-rose-700")}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחק רשומה?</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
