import { useState, useEffect, useRef } from "react";
import {
  TrendingDown, TrendingUp, Wallet, HeartHandshake,
  Receipt, ArrowUpRight, ArrowDownRight, CircleDollarSign,
  CalendarDays, Tag, StickyNote, RefreshCw, Check, X,
  Loader2, ShieldAlert, ArrowDownLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCashCurrentMonth, defaultDateForMonth } from "@/hooks/useCashCurrentMonth";
import { useBudgetYear } from "@/contexts/BudgetYearContext";

/* ── types ───────────────────────────────────────────────── */
type DialogType = "expense" | "income" | "cash" | "charity" | null;
type Fund     = { id: number; name: string; colorClass: string; fundBehavior: string };
type Category = { id: number; name: string; color: string; fundId: number | null };

const EXPENSE_BEHAVIORS = new Set([
  "expense_monthly", "annual_categorized", "annual_large", "annual", "expense_non_budget",
]);
const CASH_BEHAVIORS = new Set(["cash_monthly"]);

const PAYMENT_METHODS: Record<string, string> = {
  cash: "מזומן", credit: "אשראי", bank_transfer: "העברה בנקאית", check: "צ'ק",
};
const SOURCE_CATEGORIES = [
  { value: "משכורת", label: "משכורת" },
  { value: "פרילנס", label: "פרילנס / עצמאי" },
  { value: "עסק",    label: "עסק" },
  { value: "שכירות", label: "שכירות נכס" },
  { value: "השקעות", label: "השקעות / ריבית" },
  { value: "מתנה",   label: "מתנה / ירושה" },
  { value: "נסיעות", label: "נסיעות (ניכוי)" },
  { value: "ציוד",   label: "ציוד (ניכוי)" },
  { value: "אחר",    label: "אחר" },
];

const today = () => new Date().toISOString().split("T")[0];

/* ── side bar actions ────────────────────────────────────── */
const ACTIONS = [
  { id: "expense" as DialogType, label: "הוצאה",      icon: TrendingDown,   color: "bg-rose-500",    hoverBg: "hover:bg-rose-50",    iconText: "text-rose-600"    },
  { id: "income"  as DialogType, label: "הכנסה",      icon: TrendingUp,     color: "bg-emerald-500", hoverBg: "hover:bg-emerald-50", iconText: "text-emerald-600" },
  { id: "cash"    as DialogType, label: "שוטף- לקחת/לתת",   icon: Wallet,         color: "bg-amber-500",   hoverBg: "hover:bg-amber-50",   iconText: "text-amber-600"   },
  { id: "charity" as DialogType, label: "תרומה",      icon: HeartHandshake, color: "bg-violet-500",  hoverBg: "hover:bg-violet-50",  iconText: "text-violet-600"  },
];

/* ── field error ──────────────────────────────────────────── */
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-rose-600 mt-1 animate-in slide-in-from-top-1 duration-150">
      <ShieldAlert className="w-3 h-3 shrink-0" />{msg}
    </p>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export function QuickActions() {
  const { toast } = useToast();
  const { currentMonth } = useCashCurrentMonth();
  const { activeBid } = useBudgetYear();
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [saving, setSaving] = useState(false);

  /* shared data */
  const [funds,      setFunds]      = useState<Fund[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiFetch("/funds").then(setFunds).catch(() => {});
    apiFetch("/categories").then(setCategories).catch(() => {});
  }, []);

  const expenseFunds = funds.filter(f => EXPENSE_BEHAVIORS.has(f.fundBehavior));
  const cashFunds    = funds.filter(f => CASH_BEHAVIORS.has(f.fundBehavior));

  const close = () => setActiveDialog(null);

  /* ═══════════════════════════════════════════════════════
     EXPENSE FORM
  ═══════════════════════════════════════════════════════ */
  type ExpenseForm = {
    name: string; notes: string; amount: string; date: string;
    paymentMethod: string; fundId: string; categoryId: string; isRecurring: boolean;
  };
  const EXPENSE_EMPTY: ExpenseForm = {
    name: "", notes: "", amount: "", date: today(),
    paymentMethod: "credit", fundId: "", categoryId: "", isRecurring: false,
  };
  const [ef, setEf] = useState<ExpenseForm>(EXPENSE_EMPTY);
  const [eTouched, setETouched] = useState<Partial<Record<keyof ExpenseForm, boolean>>>({});
  const eAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeDialog === "expense") {
      setEf(EXPENSE_EMPTY); setETouched({});
      setTimeout(() => eAmountRef.current?.focus(), 80);
    }
  }, [activeDialog === "expense"]);

  const efSet = <K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) => setEf(p => ({ ...p, [k]: v }));
  const efTouch = (k: string) => setETouched(p => ({ ...p, [k]: true }));

  const efAvailCats = categories.filter(c =>
    ef.fundId ? (c.fundId === parseInt(ef.fundId)) : false
  );

  const errEName   = eTouched.name   && !ef.name.trim()              ? "שם ההוצאה נדרש"      : "";
  const errEAmount = eTouched.amount && (!ef.amount || parseFloat(ef.amount) <= 0) ? "הכנס סכום תקין" : "";
  const errEFund   = eTouched.fundId && !ef.fundId                    ? "בחר קופה"            : "";
  const errEDate   = eTouched.date   && !ef.date                      ? "בחר תאריך"           : "";

  const saveExpense = async () => {
    setETouched({ name: true, amount: true, fundId: true, date: true });
    if (!ef.name.trim() || !ef.amount || parseFloat(ef.amount) <= 0 || !ef.fundId || !ef.date) return;
    setSaving(true);
    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          description:   ef.name.trim() + (ef.notes.trim() ? "\n\n" + ef.notes.trim() : ""),
          amount:        parseFloat(ef.amount),
          date:          ef.date,
          paymentMethod: ef.paymentMethod,
          fundId:        parseInt(ef.fundId),
          categoryId:    ef.categoryId ? parseInt(ef.categoryId) : null,
          isRecurring:   ef.isRecurring,
        }),
      });
      toast({ title: "הוצאה נרשמה ✓" });
      close();
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ═══════════════════════════════════════════════════════
     INCOME FORM
  ═══════════════════════════════════════════════════════ */
  type IncomeForm = {
    name: string; source: string; notes: string;
    amount: string; date: string; entryType: "income" | "work_deduction";
  };
  const INCOME_EMPTY: IncomeForm = {
    name: "", source: "", notes: "", amount: "",
    date: today(), entryType: "income",
  };
  const [inf, setInf] = useState<IncomeForm>(INCOME_EMPTY);
  const [inTouched, setInTouched] = useState<Partial<Record<keyof IncomeForm, boolean>>>({});
  const inAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeDialog === "income") {
      setInf(INCOME_EMPTY); setInTouched({});
      setTimeout(() => inAmountRef.current?.focus(), 80);
    }
  }, [activeDialog === "income"]);

  const infSet = <K extends keyof IncomeForm>(k: K, v: IncomeForm[K]) => setInf(p => ({ ...p, [k]: v }));
  const infTouch = (k: string) => setInTouched(p => ({ ...p, [k]: true }));

  const errInName   = inTouched.name   && !inf.name.trim()             ? "שם ההכנסה נדרש" : "";
  const errInAmount = inTouched.amount && (!inf.amount || parseFloat(inf.amount) <= 0) ? "הכנס סכום תקין" : "";
  const errInDate   = inTouched.date   && !inf.date                    ? "בחר תאריך"      : "";

  const saveIncome = async () => {
    setInTouched({ name: true, amount: true, date: true });
    if (!inf.name.trim() || !inf.amount || parseFloat(inf.amount) <= 0 || !inf.date) return;
    setSaving(true);
    try {
      await apiFetch("/incomes", {
        method: "POST",
        body: JSON.stringify({
          source:      inf.name.trim(),
          description: inf.source + (inf.notes.trim() ? "|" + inf.notes.trim() : ""),
          amount:      parseFloat(inf.amount),
          date:        inf.date,
          entryType:   inf.entryType,
        }),
      });
      toast({ title: "הכנסה נרשמה ✓" });
      close();
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ═══════════════════════════════════════════════════════
     CASH FORM
  ═══════════════════════════════════════════════════════ */
  const defaultCashFundId = cashFunds[0]?.id ? String(cashFunds[0].id) : "";
  const [cf, setCf] = useState({
    type: "deposit" as "deposit" | "withdrawal",
    amount: "", description: "", fundId: "", date: defaultDateForMonth(currentMonth),
  });
  const cashAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cf.fundId && defaultCashFundId) setCf(p => ({ ...p, fundId: defaultCashFundId }));
  }, [defaultCashFundId]);
  useEffect(() => {
    setCf(p => ({ ...p, date: defaultDateForMonth(currentMonth) }));
  }, [currentMonth]);
  useEffect(() => {
    if (activeDialog === "cash") {
      setCf(p => ({ ...p, amount: "", description: "" }));
      setTimeout(() => cashAmountRef.current?.focus(), 80);
    }
  }, [activeDialog === "cash"]);

  const saveCash = async () => {
    if (!cf.amount || parseFloat(cf.amount) <= 0) {
      toast({ title: "הכנס סכום תקין", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await apiFetch(`/wallet?bid=${activeBid}`, {
        method: "POST",
        body: JSON.stringify({
          fundId:      cf.fundId ? parseInt(cf.fundId) : null,
          type:        cf.type,
          amount:      parseFloat(cf.amount),
          description: cf.description.trim() || (cf.type === "deposit" ? "ניתן" : "נלקח"),
          date:        cf.date || today(),
          activeMonth: currentMonth,
        }),
      });
      toast({ title: cf.type === "deposit" ? "ניתן נרשם ✓" : "נלקח נרשם ✓" });
      close();
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ═══════════════════════════════════════════════════════
     CHARITY FORM
  ═══════════════════════════════════════════════════════ */
  type CharityForm = {
    amount: string; recipient: string; description: string;
    date: string; isTithe: boolean; receiptNumber: string;
  };
  const CHARITY_EMPTY: CharityForm = {
    amount: "", recipient: "", description: "",
    date: today(), isTithe: true, receiptNumber: "",
  };
  const [chf, setChf] = useState<CharityForm>(CHARITY_EMPTY);
  const [chTouched, setChTouched] = useState<Partial<Record<keyof CharityForm, boolean>>>({});
  const chAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeDialog === "charity") {
      setChf(CHARITY_EMPTY); setChTouched({});
      setTimeout(() => chAmountRef.current?.focus(), 80);
    }
  }, [activeDialog === "charity"]);

  const chfSet = <K extends keyof CharityForm>(k: K, v: CharityForm[K]) => setChf(p => ({ ...p, [k]: v }));
  const chfTouch = (k: string) => setChTouched(p => ({ ...p, [k]: true }));

  const errChAmount    = chTouched.amount    && (!chf.amount || parseFloat(chf.amount) <= 0)   ? "הכנס סכום תקין"   : "";
  const errChRecipient = chTouched.recipient && !chf.recipient.trim()                           ? "נמען / תיאור נדרש" : "";
  const errChDate      = chTouched.date      && !chf.date                                       ? "בחר תאריך"        : "";

  const saveCharity = async () => {
    setChTouched({ amount: true, recipient: true, date: true });
    if (!chf.recipient.trim() || !chf.amount || parseFloat(chf.amount) <= 0 || !chf.date) return;
    setSaving(true);
    try {
      await apiFetch("/charity", {
        method: "POST",
        body: JSON.stringify({
          recipient:     chf.recipient.trim(),
          amount:        parseFloat(chf.amount),
          date:          chf.date,
          isTithe:       chf.isTithe,
          description:   chf.description.trim(),
          receiptNumber: chf.receiptNumber.trim() || null,
        }),
      });
      toast({ title: "תרומה נרשמה ✓" });
      close();
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Side bar — fixed left ─────────────────────────── */}
      <div
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5 p-2 bg-card/95 backdrop-blur-sm border border-border/60 rounded-r-2xl shadow-lg"
        dir="rtl"
      >
        {ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => setActiveDialog(action.id)}
              className={cn(
                "flex flex-col items-center gap-1 w-14 py-2.5 rounded-xl transition-all active:scale-95 group",
                action.hoverBg
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110",
                action.color
              )}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className={cn("text-[10px] font-semibold leading-tight transition-colors", action.iconText)}>
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════
          EXPENSE DIALOG — exact same as Expenses page
      ══════════════════════════════════════════════════════ */}
      <Dialog open={activeDialog === "expense"} onOpenChange={v => !v && close()}>
        <DialogContent
          className="max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl border border-border/60"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40 bg-gradient-to-l from-teal-50/60 to-white">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                הוצאה חדשה
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">מלא את הפרטים להוספת הוצאה חדשה</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Amount */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <CircleDollarSign className="w-3.5 h-3.5 text-teal-600" />
                סכום <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground select-none">₪</span>
                <Input
                  ref={eAmountRef}
                  type="number" dir="ltr" min="0" step="0.01"
                  value={ef.amount}
                  onChange={e => efSet("amount", e.target.value)}
                  onBlur={() => efTouch("amount")}
                  placeholder="0.00"
                  className={cn(
                    "pr-9 text-2xl font-bold h-14 rounded-2xl tabular-nums text-left",
                    errEAmount ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-teal-300"
                  )}
                />
              </div>
              <FieldError msg={errEAmount} />
            </div>

            {/* Name */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                שם ההוצאה <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={ef.name}
                onChange={e => efSet("name", e.target.value)}
                onBlur={() => efTouch("name")}
                placeholder="לדוגמה: קנייה בסופרמרקט..."
                className={cn("rounded-2xl", errEName ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-teal-300")}
              />
              <FieldError msg={errEName} />
            </div>

            {/* Date + Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
                  תאריך <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date" dir="ltr"
                  value={ef.date}
                  onChange={e => efSet("date", e.target.value)}
                  onBlur={() => efTouch("date")}
                  className={cn("rounded-2xl", errEDate ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-teal-300")}
                />
                <FieldError msg={errEDate} />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">אמצעי תשלום</Label>
                <Select value={ef.paymentMethod} onValueChange={v => efSet("paymentMethod", v)}>
                  <SelectTrigger className="rounded-2xl focus:ring-teal-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fund */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <Wallet className="w-3.5 h-3.5 text-teal-600" />
                קופה <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={ef.fundId || "__none__"}
                onValueChange={v => efSet("fundId", v === "__none__" ? "" : v)}
              >
                <SelectTrigger
                  className={cn("rounded-2xl", errEFund ? "border-rose-400 focus:ring-rose-300 bg-rose-50/40" : "focus:ring-teal-300")}
                  onBlur={() => efTouch("fundId")}
                >
                  <SelectValue placeholder="בחר קופה..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {expenseFunds.map(f => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.colorClass }} />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={errEFund} />
            </div>

            {/* Category */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-teal-600" />
                קטגוריה
                <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
              </Label>
              <Select
                value={ef.categoryId || "__none__"}
                onValueChange={v => efSet("categoryId", v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="rounded-2xl focus:ring-teal-300">
                  <SelectValue placeholder={ef.fundId ? "בחר קטגוריה..." : "בחר קופה תחילה"} />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">ללא קטגוריה</span>
                  </SelectItem>
                  {efAvailCats.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ef.fundId && efAvailCats.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">אין קטגוריות לקופה זו</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <StickyNote className="w-3.5 h-3.5 text-teal-600" />
                הערות
                <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
              </Label>
              <textarea
                value={ef.notes}
                onChange={e => efSet("notes", e.target.value)}
                placeholder="הערות נוספות..."
                rows={2}
                className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Recurring */}
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <span
                onClick={() => efSet("isRecurring", !ef.isRecurring)}
                className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                  ef.isRecurring ? "bg-teal-600 border-teal-600" : "border-border group-hover:border-teal-400"
                )}
              >
                {ef.isRecurring && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <div>
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                  הוצאה חוזרת / קבועה
                </span>
                <p className="text-xs text-muted-foreground">סמן אם הוצאה זו מתרחשת באופן קבוע</p>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="outline" onClick={close} className="rounded-2xl flex-1 h-10">
              <X className="w-4 h-4 ml-1.5" /> ביטול
            </Button>
            <Button
              onClick={saveExpense} disabled={saving}
              className="rounded-2xl flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" /> : <Check className="w-4 h-4 ml-1.5" />}
              הוסף הוצאה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════
          INCOME DIALOG — exact same as Incomes page
      ══════════════════════════════════════════════════════ */}
      <Dialog open={activeDialog === "income"} onOpenChange={v => !v && close()}>
        <DialogContent
          className="max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl border border-border/60"
          dir="rtl"
        >
          {/* Header */}
          <div className={cn(
            "flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40",
            inf.entryType === "income"
              ? "bg-gradient-to-l from-emerald-50/60 to-white"
              : "bg-gradient-to-l from-rose-50/60 to-white"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0",
              inf.entryType === "income" ? "bg-emerald-600" : "bg-rose-600"
            )}>
              {inf.entryType === "income"
                ? <ArrowUpRight className="w-5 h-5 text-white" />
                : <ArrowDownRight className="w-5 h-5 text-white" />
              }
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                {inf.entryType === "income" ? "הכנסה חדשה" : "ניכוי הוצאות עבודה"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {inf.entryType === "income" ? "רשום הכנסה לתיעוד ומעקב" : "ניכוי מפחית את ההכנסה החייבת"}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-2xl">
              {([
                { v: "income"        as const, label: "הכנסה", cls: "bg-emerald-600" },
                { v: "work_deduction"as const, label: "ניכוי",  cls: "bg-rose-600"   },
              ]).map(t => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => infSet("entryType", t.v)}
                  className={cn(
                    "py-2 rounded-xl text-sm font-semibold transition-all",
                    inf.entryType === t.v ? `${t.cls} text-white shadow-sm` : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {inf.entryType === t.v && <span className="ml-1">✓ </span>}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <CircleDollarSign className="w-3.5 h-3.5 text-emerald-600" />
                סכום <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground select-none">₪</span>
                <Input
                  ref={inAmountRef}
                  type="number" dir="ltr" min="0" step="0.01"
                  value={inf.amount}
                  onChange={e => infSet("amount", e.target.value)}
                  onBlur={() => infTouch("amount")}
                  placeholder="0.00"
                  className={cn(
                    "pr-9 text-2xl font-bold h-14 rounded-2xl tabular-nums text-left",
                    errInAmount ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-emerald-300"
                  )}
                />
              </div>
              <FieldError msg={errInAmount} />
            </div>

            {/* Name */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                שם ההכנסה <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={inf.name}
                onChange={e => infSet("name", e.target.value)}
                onBlur={() => infTouch("name")}
                placeholder={inf.entryType === "income" ? "לדוגמה: משכורת מרץ 2026..." : "לדוגמה: נסיעות לעבודה..."}
                className={cn("rounded-2xl", errInName ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-emerald-300")}
              />
              <FieldError msg={errInName} />
            </div>

            {/* Date */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                תאריך <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="date" dir="ltr"
                value={inf.date}
                onChange={e => infSet("date", e.target.value)}
                onBlur={() => infTouch("date")}
                className={cn("rounded-2xl max-w-[200px]", errInDate ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-emerald-300")}
              />
              <FieldError msg={errInDate} />
            </div>

            {/* Source category */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                מקור הכנסה
                <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
              </Label>
              <Select
                value={inf.source || "__none__"}
                onValueChange={v => infSet("source", v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="rounded-2xl focus:ring-emerald-300">
                  <SelectValue placeholder="בחר מקור..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">ללא מיון</span>
                  </SelectItem>
                  {SOURCE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <StickyNote className="w-3.5 h-3.5 text-emerald-600" />
                הערה
                <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
              </Label>
              <textarea
                value={inf.notes}
                onChange={e => infSet("notes", e.target.value)}
                placeholder="הערות נוספות..."
                rows={2}
                className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="outline" onClick={close} className="rounded-2xl flex-1 h-10">
              <X className="w-4 h-4 ml-1.5" /> ביטול
            </Button>
            <Button
              onClick={saveIncome} disabled={saving}
              className={cn(
                "rounded-2xl flex-1 h-10 text-white shadow-sm",
                inf.entryType === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" /> : <Check className="w-4 h-4 ml-1.5" />}
              {inf.entryType === "income" ? "הוסף הכנסה" : "הוסף ניכוי"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════
          CASH DIALOG — exact same as CashWallet page
      ══════════════════════════════════════════════════════ */}
      <Dialog open={activeDialog === "cash"} onOpenChange={v => !v && close()}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <div className="flex items-center gap-2 pt-2 pb-1">
            {cf.type === "deposit"
              ? <><ArrowDownLeft className="w-5 h-5 text-emerald-600" /><DialogTitle>ניתן לקופה</DialogTitle></>
              : <><ArrowUpRight className="w-5 h-5 text-rose-600" /><DialogTitle>נלקח מהקופה</DialogTitle></>
            }
          </div>
          <div className="space-y-4 py-1">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-2xl">
              {([
                { v: "deposit"    as const, label: "ניתן", cls: "bg-emerald-600" },
                { v: "withdrawal" as const, label: "נלקח", cls: "bg-rose-600"   },
              ]).map(t => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setCf(p => ({ ...p, type: t.v }))}
                  className={cn(
                    "py-2 rounded-xl text-sm font-semibold transition-all",
                    cf.type === t.v ? `${t.cls} text-white shadow-sm` : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input
                ref={cashAmountRef}
                type="number" dir="ltr"
                value={cf.amount}
                onChange={e => setCf(p => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="rounded-xl text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תאריך</Label>
              <Input
                type="date" dir="ltr"
                value={cf.date}
                onChange={e => setCf(p => ({ ...p, date: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">תיאור (אופציונלי)</Label>
              <Input
                value={cf.description}
                onChange={e => setCf(p => ({ ...p, description: e.target.value }))}
                placeholder={cf.type === "deposit" ? "ניתן לקופה..." : "לאיזה צורך?"}
                className="rounded-xl"
                onKeyDown={e => e.key === "Enter" && saveCash()}
              />
            </div>
            {cashFunds.length > 1 && (
              <div className="space-y-1.5">
                <Label className="font-semibold">קופה</Label>
                <Select value={cf.fundId} onValueChange={v => setCf(p => ({ ...p, fundId: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="בחר קופה..." />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {cashFunds.map(f => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={close} className="rounded-xl flex-1">ביטול</Button>
            <Button
              onClick={saveCash} disabled={saving}
              className={cn("rounded-xl flex-1", cf.type === "withdrawal" && "bg-rose-600 hover:bg-rose-700")}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              שמור
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════
          CHARITY DIALOG — exact same as Charity page
      ══════════════════════════════════════════════════════ */}
      <Dialog open={activeDialog === "charity"} onOpenChange={v => !v && close()}>
        <DialogContent
          className="max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl border border-border/60"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40 bg-gradient-to-l from-violet-50/60 to-white">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 bg-violet-600">
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">תרומה חדשה</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">רישום תרומה</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

            {/* Amount */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <CircleDollarSign className="w-3.5 h-3.5 text-violet-600" />
                סכום <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground select-none">₪</span>
                <Input
                  ref={chAmountRef}
                  type="number" dir="ltr" min="0" step="0.01"
                  value={chf.amount}
                  onChange={e => chfSet("amount", e.target.value)}
                  onBlur={() => chfTouch("amount")}
                  placeholder="0.00"
                  className={cn(
                    "pr-9 text-2xl font-bold h-14 rounded-2xl tabular-nums text-left",
                    errChAmount ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-violet-300"
                  )}
                />
              </div>
              <FieldError msg={errChAmount} />
            </div>

            {/* Recipient */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                נמען / ארגון <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={chf.recipient}
                onChange={e => chfSet("recipient", e.target.value)}
                onBlur={() => chfTouch("recipient")}
                placeholder="שם הארגון או האדם..."
                className={cn(
                  "rounded-2xl",
                  errChRecipient ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-violet-300"
                )}
              />
              <FieldError msg={errChRecipient} />
            </div>

            {/* Date */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-violet-600" />
                תאריך <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="date" dir="ltr"
                value={chf.date}
                onChange={e => chfSet("date", e.target.value)}
                onBlur={() => chfTouch("date")}
                className={cn(
                  "rounded-2xl max-w-[200px]",
                  errChDate ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-violet-300"
                )}
              />
              <FieldError msg={errChDate} />
            </div>

            {/* Receipt number */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <Receipt className="w-3.5 h-3.5 text-violet-600" />
                מספר קבלה
                <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
              </Label>
              <Input
                value={chf.receiptNumber}
                onChange={e => chfSet("receiptNumber", e.target.value)}
                placeholder="מספר קבלה לתיעוד..."
                className="rounded-2xl focus-visible:ring-violet-300"
                dir="ltr"
              />
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <StickyNote className="w-3.5 h-3.5 text-violet-600" />
                הערה
                <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
              </Label>
              <textarea
                value={chf.description}
                onChange={e => chfSet("description", e.target.value)}
                placeholder="הערות נוספות..."
                rows={2}
                className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm resize-none ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-300"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="outline" onClick={close} className="rounded-2xl flex-1 h-10">
              <X className="w-4 h-4 ml-1.5" /> ביטול
            </Button>
            <Button
              onClick={saveCharity} disabled={saving}
              className="rounded-2xl flex-1 h-10 text-white shadow-sm bg-violet-600 hover:bg-violet-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" /> : <Check className="w-4 h-4 ml-1.5" />}
              שמור תרומה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
