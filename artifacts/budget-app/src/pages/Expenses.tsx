import { useState, useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { useCashFund } from "@/hooks/useCashFund";
import { useCashCurrentMonth } from "@/hooks/useCashCurrentMonth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronRight,
  Receipt, Loader2, Check, AlertTriangle, Filter, TrendingDown,
  Tag, Wallet, CalendarDays, BarChart3, RefreshCw, StickyNote,
  ShieldAlert, CircleDollarSign,
} from "lucide-react";


/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type Expense = {
  id: number; amount: number; description: string; date: string;
  paymentMethod: string; fundId: number | null; categoryId: number | null;
  categoryName?: string | null; categoryColor?: string | null;
  isRecurring?: boolean;
};
type Fund     = { id: number; name: string; colorClass: string; fundBehavior: string };

const EXPENSE_BEHAVIORS = new Set([
  "expense_monthly", "annual_categorized", "annual_large", "annual", "expense_non_budget",
]);
type Category = { id: number; name: string; color: string; icon: string; fundId: number | null };
type GroupBy  = "none" | "fund" | "category" | "month";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const PAYMENT_METHODS: Record<string, string> = {
  cash:          "מזומן",
  credit:        "אשראי",
  bank_transfer: "העברה בנקאית",
  check:         "צ'ק",
};
const MONTH_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none",     label: "ללא קיבוץ" },
  { value: "month",    label: "לפי חודש" },
  { value: "fund",     label: "לפי קופה" },
  { value: "category", label: "לפי קטגוריה" },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}
function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(k: string) {
  const [y, m] = k.split("-");
  return `${MONTH_HE[parseInt(m) - 1]} ${y}`;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }

/* form splits "description" → name + notes, and adds isRecurring */
type ExpenseForm = {
  name: string; notes: string; amount: string; date: string;
  paymentMethod: string; fundId: string; categoryId: string; isRecurring: boolean;
  takenFromCash: boolean;
};
function formToPayload(f: ExpenseForm) {
  return {
    description: f.name + (f.notes.trim() ? "\n\n" + f.notes.trim() : ""),
    amount:       parseFloat(f.amount),
    date:         f.date,
    paymentMethod: f.paymentMethod,
    fundId:       f.fundId ? parseInt(f.fundId) : null,
    categoryId:   f.categoryId ? parseInt(f.categoryId) : null,
    isRecurring:  f.isRecurring,
  };
}
function expenseToForm(e: Expense): ExpenseForm {
  const [name, ...rest] = (e.description || "").split("\n\n");
  return {
    name: name || "", notes: rest.join("\n\n"),
    amount: String(e.amount), date: e.date,
    paymentMethod: e.paymentMethod,
    fundId: e.fundId ? String(e.fundId) : "",
    categoryId: e.categoryId ? String(e.categoryId) : "",
    isRecurring: e.isRecurring ?? false,
    takenFromCash: false,
  };
}
const EMPTY_FORM: ExpenseForm = {
  name: "", notes: "", amount: "", date: todayStr(),
  paymentMethod: "credit", fundId: "", categoryId: "", isRecurring: false,
  takenFromCash: false,
};

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Expenses() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();
  const { cashFundId } = useCashFund();
  const { currentMonth } = useCashCurrentMonth(activeBid);

  /* ── data ────────────────────────────────────────────────── */
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [funds,      setFunds]      = useState<Fund[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);

  /* ── filters ─────────────────────────────────────────────── */
  const [search,    setSearch]    = useState("");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [fundFilter,  setFundFilter]  = useState("all");
  const [catFilter,   setCatFilter]   = useState("all");
  const [groupBy,     setGroupBy]     = useState<GroupBy>("none");

  /* ── dialog ──────────────────────────────────────────────── */
  const [dialog,      setDialog]      = useState(false);
  const [editItem,    setEditItem]    = useState<Expense | null>(null);
  const [form,        setForm]        = useState<ExpenseForm>({ ...EMPTY_FORM });
  const [touched,     setTouched]     = useState<Set<string>>(new Set());
  const [submitTried, setSubmitTried] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  /* ── collapsed groups ────────────────────────────────────── */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  /* ── load ────────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const [exp, fnd, cats] = await Promise.all([
        apiFetch("/expenses"),
        apiFetch("/funds"),
        apiFetch("/categories"),
      ]);
      setExpenses(exp.map((e: any) => ({ ...e, amount: parseFloat(e.amount) })));
      setFunds(fnd);
      setCategories(cats);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── lookup maps ─────────────────────────────────────────── */
  const fundMap = useMemo(() => Object.fromEntries(funds.map(f => [f.id, f])), [funds]);
  const catMap  = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);

  /* ── filtered data ───────────────────────────────────────── */
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (search && !e.description.toLowerCase().includes(search.toLowerCase()) &&
          !(e.categoryName || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo   && e.date > dateTo)   return false;
      if (fundFilter !== "all" && e.fundId !== parseInt(fundFilter)) return false;
      if (catFilter  !== "all" && e.categoryId !== parseInt(catFilter)) return false;
      return true;
    });
  }, [expenses, search, dateFrom, dateTo, fundFilter, catFilter]);

  /* ── KPIs ────────────────────────────────────────────────── */
  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const avgAmount   = filtered.length > 0 ? totalAmount / filtered.length : 0;
  const now         = new Date();
  const curMonth    = monthKey(todayStr());
  const prevMonth   = (() => { const d = new Date(now); d.setMonth(d.getMonth() - 1); return monthKey(d.toISOString().split("T")[0]); })();
  const thisMonthTotal = expenses.filter(e => monthKey(e.date) === curMonth).reduce((s, e) => s + e.amount, 0);
  const lastMonthTotal = expenses.filter(e => monthKey(e.date) === prevMonth).reduce((s, e) => s + e.amount, 0);
  const monthDelta  = thisMonthTotal - lastMonthTotal;

  /* ── grouped data ────────────────────────────────────────── */
  const grouped: { key: string; label: string; color?: string; items: Expense[]; total: number }[] = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", items: filtered, total: totalAmount }];
    const map: Record<string, { key: string; label: string; color?: string; items: Expense[] }> = {};
    for (const e of filtered) {
      let key = "", label = "", color: string | undefined;
      if (groupBy === "fund") {
        const f = e.fundId ? fundMap[e.fundId] : null;
        key = String(e.fundId ?? 0); label = f?.name ?? "ללא קופה"; color = f?.colorClass;
      } else if (groupBy === "category") {
        const c = e.categoryId ? catMap[e.categoryId] : null;
        key = String(e.categoryId ?? 0); label = c?.name ?? "ללא קטגוריה"; color = c?.color;
      } else {
        key = monthKey(e.date); label = monthLabel(key);
      }
      if (!map[key]) map[key] = { key, label, color, items: [] };
      map[key].items.push(e);
    }
    return Object.values(map)
      .sort((a, b) => a.label.localeCompare(b.label, "he"))
      .map(g => ({ ...g, total: g.items.reduce((s, e) => s + e.amount, 0) }));
  }, [filtered, groupBy, fundMap, catMap, totalAmount]);

  const hasFilters = search || dateFrom || dateTo || fundFilter !== "all" || catFilter !== "all";
  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); setFundFilter("all"); setCatFilter("all"); };

  /* ── dialog helpers ──────────────────────────────────────── */
  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setTouched(new Set());
    setSubmitTried(false);
    setDialog(true);
  };
  const openEdit = (e: Expense) => {
    setEditItem(e);
    setForm(expenseToForm(e));
    setTouched(new Set());
    setSubmitTried(false);
    setDialog(true);
  };
  const setField = <K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      /* reset category when fund changes */
      if (k === "fundId") next.categoryId = "";
      return next;
    });
    setTouched(prev => new Set(prev).add(k));
  };
  const touch = (k: string) => setTouched(prev => new Set(prev).add(k));

  /* inline error helpers */
  const showErr = (k: string) => submitTried || touched.has(k);
  const errName   = showErr("name")   && !form.name.trim()          ? "שם ההוצאה הוא שדה חובה" : "";
  const errAmount = showErr("amount") && (
    !form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0
  ) ? "יש להזין סכום חיובי" : "";
  const errFund   = showErr("fundId") && !form.fundId               ? "יש לבחור קופה" : "";
  const errDate   = showErr("date")   && !form.date                 ? "תאריך הוא שדה חובה" : "";
  const isValid   = !errName && !errAmount && !errFund && !errDate && form.name.trim() && form.amount && form.fundId && form.date;

  const saveExpense = async () => {
    setSubmitTried(true);
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editItem) {
        const updated = await apiFetch(`/expenses/${editItem.id}`, { method: "PUT", body: JSON.stringify(payload) });
        const parsed  = { ...updated, amount: parseFloat(updated.amount) };
        setExpenses(prev => prev.map(e => e.id === editItem.id ? parsed : e));
        toast({ title: "הוצאה עודכנה" });
      } else {
        const created = await apiFetch("/expenses", { method: "POST", body: JSON.stringify(payload) });
        const parsed  = { ...created, amount: parseFloat(created.amount) };
        setExpenses(prev => [parsed, ...prev]);
        /* also record withdrawal from cash fund if checked */
        if (form.takenFromCash && cashFundId) {
          await apiFetch(`/wallet?bid=${activeBid}`, {
            method: "POST",
            body: JSON.stringify({
              fundId:      cashFundId,
              type:        "withdrawal",
              amount:      parseFloat(form.amount),
              description: form.name.trim(),
              date:        form.date,
              activeMonth: currentMonth,
            }),
          });
        }
        toast({ title: form.takenFromCash && cashFundId ? "הוצאה נוספה + נלקח מקופת שוטף" : "הוצאה נוספה" });
      }
      setDialog(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/expenses/${deleteId}`, { method: "DELETE" });
      setExpenses(prev => prev.filter(e => e.id !== deleteId));
      toast({ title: "הוצאה נמחקה" });
      setDeleteId(null);
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const toggleGroup = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /* ── expense-eligible funds only ─────────────────────────── */
  const expenseFunds = useMemo(() => funds.filter(f => EXPENSE_BEHAVIORS.has(f.fundBehavior)), [funds]);

  /* ── available categories: only for annual_categorized funds ─ */
  const availableCats = useMemo(() => {
    if (!form.fundId) return [];
    const selectedFund = funds.find(f => f.id === parseInt(form.fundId));
    if (selectedFund?.fundBehavior !== "annual_categorized") return [];
    return categories;
  }, [categories, funds, form.fundId]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader title="הוצאות" description="מעקב ורישום הוצאות לפי קופה וקטגוריה">
        <Button onClick={openAdd} className="rounded-xl gap-1.5">
          <Plus className="w-4 h-4" /> הוסף הוצאה
        </Button>
      </PageHeader>

      {/* ══ KPI STRIP ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          icon={<Receipt className="w-4 h-4" />}
          label="סה״כ הוצאות"
          value={fmt(totalAmount)}
          sub={`${filtered.length} רשומות`}
          iconBg="bg-rose-100 text-rose-600"
          valueColor="text-rose-600"
        />
        <KpiCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="ממוצע להוצאה"
          value={fmt(avgAmount)}
          sub="ממוצע לכל רשומה"
          iconBg="bg-orange-100 text-orange-600"
          valueColor="text-orange-600"
        />
        <KpiCard
          icon={<CalendarDays className="w-4 h-4" />}
          label="חודש נוכחי"
          value={fmt(thisMonthTotal)}
          sub={`${monthLabel(curMonth)}`}
          iconBg="bg-blue-100 text-blue-600"
          valueColor="text-blue-600"
        />
        <KpiCard
          icon={<TrendingDown className="w-4 h-4" />}
          label={monthDelta >= 0 ? "עלייה מחודש קודם" : "ירידה מחודש קודם"}
          value={fmt(Math.abs(monthDelta))}
          sub={`${monthLabel(prevMonth)}: ${fmt(lastMonthTotal)}`}
          iconBg={monthDelta >= 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}
          valueColor={monthDelta >= 0 ? "text-rose-600" : "text-emerald-600"}
        />
      </div>

      {/* ══ FILTER BAR ═════════════════════════════════════════ */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש תיאור..." className="pr-9 rounded-xl h-9 text-sm" />
          </div>

          {/* Date from */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">מ-</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-xl h-9 text-sm w-[130px]" dir="ltr" />
          </div>

          {/* Date to */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">עד-</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-xl h-9 text-sm w-[130px]" dir="ltr" />
          </div>

          {/* Fund filter */}
          <Select value={fundFilter} onValueChange={setFundFilter}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[140px]">
              <Wallet className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
              <SelectValue placeholder="כל הקופות" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל הקופות</SelectItem>
              {expenseFunds.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[140px]">
              <Tag className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
              <SelectValue placeholder="כל הקטגוריות" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל הקטגוריות</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Group by */}
          <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[150px]">
              <Filter className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
              <SelectValue placeholder="קיבוץ" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200">
              <X className="w-3.5 h-3.5" /> נקה פילטרים
            </button>
          )}
        </div>

        {/* Active filter pills */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5">
            {search && <FilterPill label={`חיפוש: "${search}"`} onRemove={() => setSearch("")} />}
            {dateFrom && <FilterPill label={`מ-${dateFrom}`} onRemove={() => setDateFrom("")} />}
            {dateTo   && <FilterPill label={`עד-${dateTo}`}   onRemove={() => setDateTo("")} />}
            {fundFilter !== "all" && <FilterPill label={fundMap[parseInt(fundFilter)]?.name ?? "קופה"} onRemove={() => setFundFilter("all")} />}
            {catFilter !== "all"  && <FilterPill label={catMap[parseInt(catFilter)]?.name  ?? "קטגוריה"} onRemove={() => setCatFilter("all")} />}
          </div>
        )}
      </div>

      {/* ══ TABLE ══════════════════════════════════════════════ */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} onAdd={openAdd} />
      ) : (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 border-b border-border/50 bg-muted/30"
            style={{ gridTemplateColumns: "110px 1fr 130px 130px 100px 1fr 80px" }}>
            <span>תאריך</span>
            <span>תיאור</span>
            <span>קטגוריה</span>
            <span>קופה</span>
            <span className="text-left" dir="ltr">סכום</span>
            <span>אמצעי תשלום</span>
            <span className="text-center">פעולות</span>
          </div>

          {/* Grouped sections or flat list */}
          <div>
            {groupBy === "none" ? (
              grouped[0]?.items.map(e => (
                <ExpenseRow key={e.id} expense={e} fundMap={fundMap} catMap={catMap}
                  onEdit={() => openEdit(e)} onDelete={() => setDeleteId(e.id)} />
              ))
            ) : (
              grouped.map(g => (
                <div key={g.key}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(g.key)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/40 hover:bg-muted/60 transition-colors text-right">
                    <div className="flex items-center gap-2.5">
                      {collapsed.has(g.key)
                        ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown  className="w-4 h-4 text-muted-foreground" />
                      }
                      {g.color && (
                        <span className="w-3 h-3 rounded-full inline-block shrink-0"
                          style={{ background: g.color }} />
                      )}
                      <span className="font-semibold text-sm">{g.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {g.items.length} הוצאות
                      </span>
                    </div>
                    <span className="font-bold text-rose-600 tabular-nums text-sm">{fmt(g.total)}</span>
                  </button>

                  {/* Group rows */}
                  {!collapsed.has(g.key) && g.items.map(e => (
                    <ExpenseRow key={e.id} expense={e} fundMap={fundMap} catMap={catMap}
                      onEdit={() => openEdit(e)} onDelete={() => setDeleteId(e.id)} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Table footer — total */}
          <div className="grid items-center px-4 py-3 border-t border-border/50 bg-muted/20 font-semibold text-sm"
            style={{ gridTemplateColumns: "110px 1fr 130px 130px 100px 1fr 80px" }}>
            <span className="text-muted-foreground">{filtered.length} רשומות</span>
            <span />
            <span />
            <span className="font-bold">סה״כ</span>
            <span className="font-bold text-rose-600 tabular-nums" dir="ltr">{fmt(totalAmount)}</span>
            <span />
            <span />
          </div>
        </div>
      )}

      {/* ══ ADD / EDIT DIALOG ══════════════════════════════════ */}
      <ExpenseDialog
        open={dialog}
        onClose={() => setDialog(false)}
        editItem={editItem}
        form={form}
        setField={setField}
        touch={touch}
        funds={expenseFunds}
        availableCats={availableCats}
        errName={errName}
        errAmount={errAmount}
        errFund={errFund}
        errDate={errDate}
        saving={saving}
        onSave={saveExpense}
        cashFundName={cashFundId ? (funds.find(f => f.id === cashFundId)?.name ?? "קופת שוטף") : null}
      />

      {/* ══ DELETE CONFIRM ══════════════════════════════════════ */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" /> מחיקת הוצאה
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            האם אתה בטוח שברצונך למחוק הוצאה זו? פעולה זו אינה ניתנת לביטול.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl flex-1">ביטול</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="rounded-xl flex-1">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Trash2 className="w-4 h-4 ml-1" />}
              מחק
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXPENSE DIALOG — professional modal
═══════════════════════════════════════════════════════════ */
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-rose-600 mt-1 animate-in slide-in-from-top-1 duration-150">
      <ShieldAlert className="w-3 h-3 shrink-0" />{msg}
    </p>
  );
}

function ExpenseDialog({
  open, onClose, editItem, form, setField, touch,
  funds, availableCats,
  errName, errAmount, errFund, errDate,
  saving, onSave, cashFundName,
}: {
  open: boolean; onClose: () => void;
  editItem: Expense | null;
  form: ExpenseForm;
  setField: <K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) => void;
  touch: (k: string) => void;
  funds: Fund[]; availableCats: Category[];
  errName: string; errAmount: string; errFund: string; errDate: string;
  saving: boolean; onSave: () => void;
  cashFundName: string | null;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  /* auto-focus amount when dialog opens */
  useEffect(() => {
    if (open) setTimeout(() => amountRef.current?.focus(), 80);
  }, [open]);

  const isEdit = !!editItem;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl border border-border/60"
        dir="rtl"
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40 bg-gradient-to-l from-teal-50/60 to-white">
          <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center shadow-sm shrink-0">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-foreground leading-tight">
              {isEdit ? "עריכת הוצאה" : "הוצאה חדשה"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEdit ? "ערוך את פרטי ההוצאה הקיימת" : "מלא את הפרטים להוספת הוצאה חדשה"}
            </p>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Amount — large, prominent */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-teal-600" />
              סכום
              <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground select-none">₪</span>
              <Input
                ref={amountRef}
                type="number"
                dir="ltr"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => setField("amount", e.target.value)}
                onBlur={() => touch("amount")}
                placeholder="0.00"
                className={cn(
                  "pr-9 text-2xl font-bold h-14 rounded-2xl tabular-nums text-left",
                  errAmount ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "border-border focus-visible:ring-teal-300"
                )}
              />
            </div>
            <FieldError msg={errAmount} />
          </div>

          {/* Name */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              שם ההוצאה
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={e => setField("name", e.target.value)}
              onBlur={() => touch("name")}
              placeholder="לדוגמה: קנייה בסופרמרקט..."
              className={cn(
                "rounded-2xl",
                errName ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-teal-300"
              )}
            />
            <FieldError msg={errName} />
          </div>

          {/* Date + Payment — row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
                תאריך
                <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="date"
                dir="ltr"
                value={form.date}
                onChange={e => setField("date", e.target.value)}
                onBlur={() => touch("date")}
                className={cn(
                  "rounded-2xl",
                  errDate ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : "focus-visible:ring-teal-300"
                )}
              />
              <FieldError msg={errDate} />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">אמצעי תשלום</Label>
              <Select value={form.paymentMethod} onValueChange={v => setField("paymentMethod", v)}>
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
              קופה
              <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={form.fundId || "__none__"}
              onValueChange={v => setField("fundId", v === "__none__" ? "" : v)}
            >
              <SelectTrigger
                className={cn(
                  "rounded-2xl",
                  errFund ? "border-rose-400 focus:ring-rose-300 bg-rose-50/40" : "focus:ring-teal-300"
                )}
                onBlur={() => touch("fundId")}
              >
                <SelectValue placeholder="בחר קופה..." />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {funds.map(f => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.colorClass }} />
                      {f.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError msg={errFund} />
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-teal-600" />
              קטגוריה
              <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
            </Label>
            <Select
              value={form.categoryId || "__none__"}
              onValueChange={v => setField("categoryId", v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="rounded-2xl focus:ring-teal-300">
                <SelectValue placeholder={form.fundId ? "בחר קטגוריה..." : "בחר קופה תחילה"} />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">ללא קטגוריה</span>
                </SelectItem>
                {availableCats.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.fundId && availableCats.length === 0 && (
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
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              placeholder="הערות נוספות..."
              rows={2}
              className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Recurring checkbox */}
          <label className="flex items-center gap-3 cursor-pointer group select-none">
            <span
              onClick={() => setField("isRecurring", !form.isRecurring)}
              className={cn(
                "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                form.isRecurring
                  ? "bg-teal-600 border-teal-600"
                  : "border-border group-hover:border-teal-400"
              )}
            >
              {form.isRecurring && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <div>
              <span className="text-sm font-medium flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                הוצאה חוזרת / קבועה
              </span>
              <p className="text-xs text-muted-foreground">סמן אם הוצאה זו מתרחשת באופן קבוע</p>
            </div>
          </label>

          {/* Taken from cash fund — only for new expenses */}
          {!isEdit && cashFundName && (
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <span
                onClick={() => setField("takenFromCash", !form.takenFromCash)}
                className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                  form.takenFromCash
                    ? "bg-amber-500 border-amber-500"
                    : "border-border group-hover:border-amber-400"
                )}
              >
                {form.takenFromCash && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <div>
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-500" />
                  נלקח מקופת שוטף
                </span>
                <p className="text-xs text-muted-foreground">
                  תירשם תנועת "נלקח" בקופה <span className="font-medium text-foreground">{cashFundName}</span>
                </p>
              </div>
            </label>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-2xl flex-1 h-10"
          >
            <X className="w-4 h-4 ml-1.5" /> ביטול
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="rounded-2xl flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
              : <Check className="w-4 h-4 ml-1.5" />
            }
            {isEdit ? "שמור שינויים" : "הוסף הוצאה"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════ */

function KpiCard({ icon, label, value, sub, iconBg, valueColor }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  iconBg: string; valueColor?: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", iconBg)}>{icon}</div>
      </div>
      <p className={cn("text-xl font-display font-bold tabular-nums", valueColor)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/20">
      {label}
      <button onClick={onRemove} className="hover:text-rose-600 transition-colors"><X className="w-3 h-3" /></button>
    </span>
  );
}

function ExpenseRow({ expense, fundMap, catMap, onEdit, onDelete }: {
  expense: Expense;
  fundMap: Record<number, Fund>;
  catMap:  Record<number, Category>;
  onEdit:  () => void;
  onDelete: () => void;
}) {
  const fund = expense.fundId ? fundMap[expense.fundId] : null;
  const cat  = expense.categoryId ? catMap[expense.categoryId] : null;
  const catName  = expense.categoryName || cat?.name;
  const catColor = expense.categoryColor || cat?.color;

  return (
    <div className="grid items-center px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors group text-sm"
      style={{ gridTemplateColumns: "110px 1fr 130px 130px 100px 1fr 80px" }}>

      {/* Date */}
      <span className="text-muted-foreground text-xs font-medium">{fmtDate(expense.date)}</span>

      {/* Description */}
      <span className="font-medium truncate pr-2">
        {expense.description || <span className="text-muted-foreground italic">ללא תיאור</span>}
      </span>

      {/* Category */}
      <span>
        {catName ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
            style={{ background: `${catColor}22`, color: catColor || "#6366f1", border: `1px solid ${catColor}44` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor || "#6366f1" }} />
            {catName}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </span>

      {/* Fund */}
      <span>
        {fund ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: fund.colorClass }} />
            <span className="truncate">{fund.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </span>

      {/* Amount */}
      <span className="font-bold text-rose-600 tabular-nums" dir="ltr">{fmt(expense.amount)}</span>

      {/* Payment method */}
      <span className="text-muted-foreground text-xs">
        {PAYMENT_METHODS[expense.paymentMethod] || expense.paymentMethod}
      </span>

      {/* Actions */}
      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear, onAdd }: {
  hasFilters: boolean; onClear: () => void; onAdd: () => void;
}) {
  return (
    <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
      <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
      {hasFilters ? (
        <>
          <p className="font-semibold text-muted-foreground">לא נמצאו הוצאות תואמות</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">נסה לשנות את הפילטרים</p>
          <Button variant="outline" onClick={onClear} className="rounded-xl gap-1.5">
            <X className="w-4 h-4" /> נקה פילטרים
          </Button>
        </>
      ) : (
        <>
          <p className="font-semibold text-muted-foreground">אין הוצאות עדיין</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">הוסף הוצאה ראשונה כדי להתחיל</p>
          <Button onClick={onAdd} className="rounded-xl gap-1.5">
            <Plus className="w-4 h-4" /> הוסף הוצאה
          </Button>
        </>
      )}
    </div>
  );
}
