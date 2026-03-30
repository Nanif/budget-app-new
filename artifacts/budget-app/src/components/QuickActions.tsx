import { useState, useEffect } from "react";
import { Plus, X, TrendingDown, TrendingUp, Wallet, HeartHandshake } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type DialogType = "expense" | "income" | "cash" | "charity" | null;

type Fund     = { id: number; name: string; fundBehavior: string };
type Category = { id: number; name: string; fundId: number | null };

const EXPENSE_BEHAVIORS = new Set([
  "expense_monthly", "annual_categorized", "annual_large", "annual", "expense_non_budget",
]);
const CASH_BEHAVIORS = new Set(["cash_monthly", "non_budget", "cash_annual"]);

const today = () => new Date().toISOString().split("T")[0];

/* ── Speed-dial action definitions ──────────────────────────────── */
const ACTIONS = [
  { id: "expense" as DialogType, label: "הוצאה",       icon: TrendingDown,   bg: "bg-rose-500   hover:bg-rose-600",   ring: "ring-rose-300"   },
  { id: "income"  as DialogType, label: "הכנסה",       icon: TrendingUp,     bg: "bg-emerald-500 hover:bg-emerald-600", ring: "ring-emerald-300" },
  { id: "cash"    as DialogType, label: "לקחת / לתת",  icon: Wallet,         bg: "bg-amber-500  hover:bg-amber-600",  ring: "ring-amber-300"  },
  { id: "charity" as DialogType, label: "תרומה",       icon: HeartHandshake, bg: "bg-violet-500 hover:bg-violet-600", ring: "ring-violet-300" },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export function QuickActions() {
  const { toast } = useToast();
  const [open,        setOpen]        = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [saving,      setSaving]      = useState(false);

  /* shared data */
  const [funds,      setFunds]      = useState<Fund[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiFetch("/funds").then(setFunds).catch(() => {});
    apiFetch("/categories").then(setCategories).catch(() => {});
  }, []);

  /* derived fund lists */
  const expenseFunds = funds.filter(f => EXPENSE_BEHAVIORS.has(f.fundBehavior));
  const cashFunds    = funds.filter(f => CASH_BEHAVIORS.has(f.fundBehavior));

  const openDialog = (type: DialogType) => {
    setOpen(false);
    setActiveDialog(type);
  };

  const closeDialog = () => setActiveDialog(null);

  /* ── expense form ────────────────────────────────────────────── */
  const [expense, setExpense] = useState({ name: "", amount: "", fundId: "", categoryId: "", date: today() });
  const availableCats = categories.filter(c =>
    !expense.fundId || c.fundId === parseInt(expense.fundId) || c.fundId === null
  );

  const submitExpense = async () => {
    if (!expense.name.trim() || !expense.amount || !expense.fundId) return;
    setSaving(true);
    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          name:       expense.name.trim(),
          amount:     parseFloat(expense.amount),
          fundId:     parseInt(expense.fundId),
          categoryId: expense.categoryId ? parseInt(expense.categoryId) : null,
          date:       expense.date,
          notes:      "",
        }),
      });
      toast({ title: "הוצאה נרשמה ✓" });
      setExpense({ name: "", amount: "", fundId: "", categoryId: "", date: today() });
      closeDialog();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ── income form ─────────────────────────────────────────────── */
  const [income, setIncome] = useState({ source: "", amount: "", date: today(), entryType: "income" });

  const submitIncome = async () => {
    if (!income.source.trim() || !income.amount) return;
    setSaving(true);
    try {
      await apiFetch("/incomes", {
        method: "POST",
        body: JSON.stringify({
          source:      income.source.trim(),
          amount:      parseFloat(income.amount),
          date:        income.date,
          entryType:   income.entryType,
          description: "",
        }),
      });
      toast({ title: "הכנסה נרשמה ✓" });
      setIncome({ source: "", amount: "", date: today(), entryType: "income" });
      closeDialog();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ── cash form ───────────────────────────────────────────────── */
  const defaultCashFund = cashFunds[0]?.id ? String(cashFunds[0].id) : "";
  const [cash, setCash] = useState({ type: "deposit" as "deposit"|"withdrawal", amount: "", description: "", fundId: "", date: today() });
  useEffect(() => {
    if (!cash.fundId && defaultCashFund) setCash(p => ({ ...p, fundId: defaultCashFund }));
  }, [defaultCashFund]);

  const submitCash = async () => {
    if (!cash.amount) return;
    setSaving(true);
    try {
      await apiFetch("/wallet", {
        method: "POST",
        body: JSON.stringify({
          type:        cash.type,
          amount:      parseFloat(cash.amount),
          description: cash.description.trim() || (cash.type === "deposit" ? "הפקדה" : "משיכה"),
          fundId:      cash.fundId ? parseInt(cash.fundId) : null,
          date:        cash.date,
        }),
      });
      toast({ title: cash.type === "deposit" ? "הפקדה נרשמה ✓" : "משיכה נרשמה ✓" });
      setCash({ type: "deposit", amount: "", description: "", fundId: defaultCashFund, date: today() });
      closeDialog();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ── charity form ────────────────────────────────────────────── */
  const [charity, setCharity] = useState({ recipient: "", amount: "", date: today(), isTithe: true });

  const submitCharity = async () => {
    if (!charity.recipient.trim() || !charity.amount) return;
    setSaving(true);
    try {
      await apiFetch("/charity", {
        method: "POST",
        body: JSON.stringify({
          recipient:   charity.recipient.trim(),
          amount:      parseFloat(charity.amount),
          date:        charity.date,
          isTithe:     charity.isTithe,
          description: "",
        }),
      });
      toast({ title: "תרומה נרשמה ✓" });
      setCharity({ recipient: "", amount: "", date: today(), isTithe: true });
      closeDialog();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      {/* ── Speed-dial FAB ──────────────────────────────────────── */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col-reverse items-start gap-3">
        {/* Action buttons — visible when open */}
        {ACTIONS.map((action, i) => {
          const Icon = action.icon;
          return (
            <div
              key={action.id}
              className={cn(
                "flex items-center gap-2 transition-all duration-200",
                open
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-4 pointer-events-none"
              )}
              style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
            >
              <span className="bg-card border border-border shadow-sm text-sm font-medium px-2.5 py-1 rounded-lg whitespace-nowrap">
                {action.label}
              </span>
              <button
                onClick={() => openDialog(action.id)}
                className={cn(
                  "w-10 h-10 rounded-full text-white shadow-md flex items-center justify-center",
                  "ring-2 ring-white transition-transform active:scale-95",
                  action.bg
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {/* Main FAB */}
        <button
          onClick={() => setOpen(p => !p)}
          className={cn(
            "w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white",
            "transition-all duration-300 active:scale-95",
            open
              ? "bg-gray-600 hover:bg-gray-700 rotate-45"
              : "bg-teal-600 hover:bg-teal-700 rotate-0"
          )}
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Dialog: הוצאה ───────────────────────────────────────── */}
      <Dialog open={activeDialog === "expense"} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              הוצאה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">שם / תיאור</label>
                <Input
                  placeholder="לדוגמה: קניות"
                  value={expense.name}
                  onChange={e => setExpense(p => ({ ...p, name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">סכום ₪</label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={expense.amount}
                  onChange={e => setExpense(p => ({ ...p, amount: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">קופה</label>
              <Select
                value={expense.fundId}
                onValueChange={v => setExpense(p => ({ ...p, fundId: v, categoryId: "" }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="בחר קופה..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseFunds.map(f => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableCats.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">קטגוריה (אופציונלי)</label>
                <Select
                  value={expense.categoryId || "__none__"}
                  onValueChange={v => setExpense(p => ({ ...p, categoryId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="ללא קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא קטגוריה</SelectItem>
                    {availableCats.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">תאריך</label>
              <Input
                type="date" value={expense.date}
                onChange={e => setExpense(p => ({ ...p, date: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <Button
              onClick={submitExpense} disabled={saving || !expense.name.trim() || !expense.amount || !expense.fundId}
              className="w-full h-9 bg-rose-500 hover:bg-rose-600 text-white"
            >
              {saving ? "שומר..." : "שמור הוצאה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: הכנסה ───────────────────────────────────────── */}
      <Dialog open={activeDialog === "income"} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              הכנסה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">מקור</label>
                <Input
                  placeholder="לדוגמה: משכורת"
                  value={income.source}
                  onChange={e => setIncome(p => ({ ...p, source: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">סכום ₪</label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={income.amount}
                  onChange={e => setIncome(p => ({ ...p, amount: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">סוג</label>
              <div className="flex rounded-lg overflow-hidden border border-border text-sm">
                {[
                  { value: "income",          label: "הכנסה רגילה" },
                  { value: "work_deduction",  label: "ניכוי עבודה" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setIncome(p => ({ ...p, entryType: opt.value }))}
                    className={cn(
                      "flex-1 py-1.5 text-center transition-colors",
                      income.entryType === opt.value
                        ? "bg-emerald-500 text-white font-medium"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">תאריך</label>
              <Input
                type="date" value={income.date}
                onChange={e => setIncome(p => ({ ...p, date: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <Button
              onClick={submitIncome} disabled={saving || !income.source.trim() || !income.amount}
              className="w-full h-9 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {saving ? "שומר..." : "שמור הכנסה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: לקחת / לתת ──────────────────────────────────── */}
      <Dialog open={activeDialog === "cash"} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wallet className="w-4 h-4 text-amber-500" />
              לקחת / לתת מהקופה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {/* Toggle: לקחת / לתת */}
            <div className="flex rounded-lg overflow-hidden border border-border text-sm">
              {[
                { value: "withdrawal", label: "לקחת", color: "bg-rose-500" },
                { value: "deposit",    label: "לתת",  color: "bg-emerald-500" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCash(p => ({ ...p, type: opt.value as any }))}
                  className={cn(
                    "flex-1 py-2 text-center font-medium transition-colors",
                    cash.type === opt.value
                      ? `${opt.color} text-white`
                      : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">סכום ₪</label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={cash.amount}
                  onChange={e => setCash(p => ({ ...p, amount: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">תאריך</label>
                <Input
                  type="date" value={cash.date}
                  onChange={e => setCash(p => ({ ...p, date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {cashFunds.length > 1 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">קופה</label>
                <Select value={cash.fundId} onValueChange={v => setCash(p => ({ ...p, fundId: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="בחר קופה..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cashFunds.map(f => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">תיאור (אופציונלי)</label>
              <Input
                placeholder={cash.type === "deposit" ? "לדוגמה: שכר" : "לדוגמה: קניות"}
                value={cash.description}
                onChange={e => setCash(p => ({ ...p, description: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <Button
              onClick={submitCash} disabled={saving || !cash.amount}
              className={cn(
                "w-full h-9 text-white",
                cash.type === "withdrawal"
                  ? "bg-rose-500 hover:bg-rose-600"
                  : "bg-emerald-500 hover:bg-emerald-600"
              )}
            >
              {saving ? "שומר..." : cash.type === "withdrawal" ? "שמור משיכה" : "שמור הפקדה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: תרומה ───────────────────────────────────────── */}
      <Dialog open={activeDialog === "charity"} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HeartHandshake className="w-4 h-4 text-violet-500" />
              רישום תרומה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">סוג</label>
              <div className="flex rounded-lg overflow-hidden border border-border text-sm">
                {[
                  { value: true,  label: "מעשר" },
                  { value: false, label: "צדקה" },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setCharity(p => ({ ...p, isTithe: opt.value }))}
                    className={cn(
                      "flex-1 py-1.5 text-center transition-colors",
                      charity.isTithe === opt.value
                        ? "bg-violet-500 text-white font-medium"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">נמען</label>
                <Input
                  placeholder="לדוגמה: עמותה"
                  value={charity.recipient}
                  onChange={e => setCharity(p => ({ ...p, recipient: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">סכום ₪</label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={charity.amount}
                  onChange={e => setCharity(p => ({ ...p, amount: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">תאריך</label>
              <Input
                type="date" value={charity.date}
                onChange={e => setCharity(p => ({ ...p, date: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <Button
              onClick={submitCharity} disabled={saving || !charity.recipient.trim() || !charity.amount}
              className="w-full h-9 bg-violet-500 hover:bg-violet-600 text-white"
            >
              {saving ? "שומר..." : "שמור תרומה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
