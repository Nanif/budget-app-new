import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronRight,
  Receipt, Loader2, Check, AlertTriangle, Filter, TrendingDown,
  Tag, Wallet, CalendarDays, BarChart3,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API  = `${BASE}/api`;

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type Expense = {
  id: number; amount: number; description: string; date: string;
  paymentMethod: string; fundId: number | null; categoryId: number | null;
  categoryName?: string | null; categoryColor?: string | null;
};
type Fund     = { id: number; name: string; colorClass: string; fundBehavior: string };
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
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}
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

const EMPTY_FORM = {
  description: "", amount: "", date: todayStr(),
  paymentMethod: "cash", fundId: "", categoryId: "",
};

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Expenses() {
  const { toast } = useToast();

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
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
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
        apiFetch("/funds?all=true"),
        apiFetch("/categories"),
      ]);
      setExpenses(exp.map((e: any) => ({ ...e, amount: parseFloat(e.amount) })));
      setFunds(fnd);
      setCategories(cats);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

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
    setDialog(true);
  };
  const openEdit = (e: Expense) => {
    setEditItem(e);
    setForm({
      description: e.description, amount: String(e.amount),
      date: e.date, paymentMethod: e.paymentMethod,
      fundId: e.fundId ? String(e.fundId) : "",
      categoryId: e.categoryId ? String(e.categoryId) : "",
    });
    setDialog(true);
  };
  const saveExpense = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: "סכום נדרש", variant: "destructive" }); return;
    }
    if (!form.date) { toast({ title: "תאריך נדרש", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        amount: parseFloat(form.amount),
        description: form.description || "",
        date: form.date,
        paymentMethod: form.paymentMethod,
        fundId: form.fundId ? parseInt(form.fundId) : null,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      };
      if (editItem) {
        const updated = await apiFetch(`/expenses/${editItem.id}`, { method: "PUT", body: JSON.stringify(payload) });
        const parsed  = { ...updated, amount: parseFloat(updated.amount) };
        setExpenses(prev => prev.map(e => e.id === editItem.id ? parsed : e));
        toast({ title: "הוצאה עודכנה" });
      } else {
        const created = await apiFetch("/expenses", { method: "POST", body: JSON.stringify(payload) });
        const parsed  = { ...created, amount: parseFloat(created.amount) };
        setExpenses(prev => [parsed, ...prev]);
        toast({ title: "הוצאה נוספה" });
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

  /* ── available categories filtered by fund ───────────────── */
  const availableCats = useMemo(() => {
    if (!form.fundId) return categories;
    const fid = parseInt(form.fundId);
    return categories.filter(c => !c.fundId || c.fundId === fid);
  }, [categories, form.fundId]);

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
              {funds.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
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
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editItem ? "עריכת הוצאה" : "הוצאה חדשה"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="font-semibold">סכום (₪) *</Label>
              <Input type="number" dir="ltr" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0" className="rounded-xl text-lg font-bold" autoFocus />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="font-semibold">תיאור</Label>
              <Input value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="תיאור ההוצאה..." className="rounded-xl" />
            </div>

            {/* Date + Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">תאריך *</Label>
                <Input type="date" dir="ltr" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">אמצעי תשלום</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
                  <SelectTrigger className="rounded-xl">
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
            <div className="space-y-1.5">
              <Label className="font-semibold">קופה</Label>
              <Select value={form.fundId || "none"} onValueChange={v => setForm(p => ({ ...p, fundId: v === "none" ? "" : v, categoryId: "" }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="בחר קופה..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">ללא קופה</SelectItem>
                  {funds.filter(f => f.fundBehavior !== "non_budget").map(f => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: f.colorClass }} />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="font-semibold">קטגוריה</Label>
              <Select value={form.categoryId || "none"} onValueChange={v => setForm(p => ({ ...p, categoryId: v === "none" ? "" : v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="בחר קטגוריה..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">ללא קטגוריה</SelectItem>
                  {availableCats.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(false)} className="rounded-xl flex-1">
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={saveExpense} disabled={saving} className="rounded-xl flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              {editItem ? "שמור" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
