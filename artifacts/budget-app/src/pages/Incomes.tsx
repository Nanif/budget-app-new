import { useState, useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
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
  Landmark, Loader2, Check, AlertTriangle, Filter,
  TrendingUp, TrendingDown, CalendarDays, BarChart3,
  ArrowUpRight, ArrowDownRight, ShieldAlert, StickyNote,
  CircleDollarSign, RefreshCw,
} from "lucide-react";
import { RecurringPanel } from "@/components/RecurringPanel";


/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type Income = {
  id: number; amount: number; description: string;
  date: string; entryType: "income" | "work_deduction";
};
type GroupBy = "none" | "month" | "type";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const MONTH_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none",  label: "ללא קיבוץ" },
  { value: "month", label: "לפי חודש" },
  { value: "type",  label: "לפי סוג" },
];

/* ═══════════════════════════════════════════════════════════
   FORM
═══════════════════════════════════════════════════════════ */
type IncomeForm = {
  name: string; notes: string;
  amount: string; date: string; entryType: "income" | "work_deduction";
};
/* DB mapping: description = "name\n\nnotes" */
function formToPayload(f: IncomeForm) {
  return {
    description: f.name.trim() + (f.notes.trim() ? "\n\n" + f.notes.trim() : ""),
    amount:      parseFloat(f.amount),
    date:        f.date,
    entryType:   f.entryType,
  };
}
function incomeToForm(e: Income): IncomeForm {
  const [name, ...rest] = e.description.split("\n\n");
  return {
    name:      name || "",
    notes:     rest.join("\n\n"),
    amount:    String(e.amount),
    date:      e.date,
    entryType: e.entryType,
  };
}
function parseIncomeName(description: string) {
  return description.split("\n\n")[0] || "";
}
function parseIncomeNotes(description: string) {
  const parts = description.split("\n\n");
  return parts.slice(1).join("\n\n");
}
const EMPTY_FORM: IncomeForm = {
  name: "", notes: "",
  amount: "", date: new Date().toISOString().split("T")[0],
  entryType: "income",
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(k: string) {
  const [y, m] = k.split("-");
  return `${MONTH_HE[parseInt(m) - 1]} ${y}`;
}
function getMonth(d: string) { return String(new Date(d).getMonth() + 1); }
function getYear(d: string)  { return String(new Date(d).getFullYear()); }

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Incomes() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();

  /* ── data ────────────────────────────────────────────────── */
  const [entries,  setEntries]  = useState<Income[]>([]);
  const [loading,  setLoading]  = useState(true);

  /* ── filters ─────────────────────────────────────────────── */
  const [search,      setSearch]      = useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [typeFilter,  setTypeFilter]  = useState<"all" | "income" | "work_deduction">("all");
  const [groupBy,     setGroupBy]     = useState<GroupBy>("none");

  /* ── dialog ──────────────────────────────────────────────── */
  const [dialog,      setDialog]      = useState(false);
  const [editItem,    setEditItem]    = useState<Income | null>(null);
  const [form,        setForm]        = useState<IncomeForm>({ ...EMPTY_FORM });
  const [touched,     setTouched]     = useState<Set<string>>(new Set());
  const [submitTried, setSubmitTried] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  /* ── collapsed groups ─────────────────────────────────────── */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  /* ── recurring panel ──────────────────────────────────────── */
  const [recurringOpen, setRecurringOpen] = useState(false);

  /* ── load ─────────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/incomes");
      setEntries(data.map((e: any) => ({ ...e, amount: parseFloat(e.amount) })));
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── filtered ────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo   && e.date > dateTo)   return false;
      if (monthFilter !== "all" && getMonth(e.date) !== monthFilter) return false;
      if (typeFilter  !== "all" && e.entryType !== typeFilter) return false;
      return true;
    });
  }, [entries, search, dateFrom, dateTo, monthFilter, typeFilter]);

  /* ── KPIs ─────────────────────────────────────────────────── */
  const now = new Date();
  const curMonthKey = monthKey(todayStr());
  const curYear = String(now.getFullYear());

  const incomeOnly   = entries.filter(e => e.entryType === "income");
  const totalIncome  = incomeOnly.reduce((s, e) => s + e.amount, 0);

  const monthsWithIncome = new Set(incomeOnly.map(e => monthKey(e.date))).size;
  const avgMonthly = monthsWithIncome > 0 ? totalIncome / monthsWithIncome : 0;

  const thisMonthIncome = incomeOnly
    .filter(e => monthKey(e.date) === curMonthKey)
    .reduce((s, e) => s + e.amount, 0);

  const ytdIncome = incomeOnly
    .filter(e => getYear(e.date) === curYear)
    .reduce((s, e) => s + e.amount, 0);

  /* ── grouped ─────────────────────────────────────────────── */
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", color: undefined, items: filtered, total: filtered.reduce((s, e) => s + (e.entryType === "income" ? e.amount : -e.amount), 0) }];
    const map: Record<string, { key: string; label: string; color?: string; items: Income[] }> = {};
    for (const e of filtered) {
      let key = "", label = "";
      if (groupBy === "month") { key = monthKey(e.date); label = monthLabel(key); }
      if (groupBy === "type")  { key = e.entryType; label = e.entryType === "income" ? "הכנסות" : "ניכויים"; }
      if (!map[key]) map[key] = { key, label, items: [] };
      map[key].items.push(e);
    }
    return Object.values(map)
      .sort((a, b) => a.label.localeCompare(b.label, "he"))
      .map(g => ({ ...g, color: undefined, total: g.items.reduce((s, e) => s + (e.entryType === "income" ? e.amount : -e.amount), 0) }));
  }, [filtered, groupBy]);

  const hasFilters = search || dateFrom || dateTo || monthFilter !== "all" || typeFilter !== "all";
  const clearFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setMonthFilter("all"); setTypeFilter("all");
  };

  /* ── dialog helpers ──────────────────────────────────────── */
  const openAdd = (type: "income" | "work_deduction" = "income") => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, entryType: type });
    setTouched(new Set()); setSubmitTried(false);
    setDialog(true);
  };
  const openEdit = (e: Income) => {
    setEditItem(e);
    setForm(incomeToForm(e));
    setTouched(new Set()); setSubmitTried(false);
    setDialog(true);
  };
  const setField = <K extends keyof IncomeForm>(k: K, v: IncomeForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setTouched(prev => new Set(prev).add(k));
  };
  const touch = (k: string) => setTouched(prev => new Set(prev).add(k));

  const showErr = (k: string) => submitTried || touched.has(k);
  const errName   = showErr("name")   && !form.name.trim()          ? "שם ההכנסה הוא שדה חובה" : "";
  const errAmount = showErr("amount") && (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) ? "יש להזין סכום חיובי" : "";
  const errDate   = showErr("date")   && !form.date                 ? "תאריך הוא שדה חובה" : "";
  const isValid   = !errName && !errAmount && !errDate && form.name.trim() && form.amount && form.date;

  const saveEntry = async () => {
    setSubmitTried(true);
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editItem) {
        const updated = await apiFetch(`/incomes/${editItem.id}`, { method: "PUT", body: JSON.stringify(payload) });
        const parsed  = { ...updated, amount: parseFloat(updated.amount) };
        setEntries(prev => prev.map(e => e.id === editItem.id ? parsed : e));
        toast({ title: "הכנסה עודכנה" });
      } else {
        const created = await apiFetch("/incomes", { method: "POST", body: JSON.stringify(payload) });
        const parsed  = { ...created, amount: parseFloat(created.amount) };
        setEntries(prev => [parsed, ...prev]);
        toast({ title: form.entryType === "income" ? "הכנסה נוספה" : "ניכוי נוסף" });
      }
      setDialog(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/incomes/${deleteId}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== deleteId));
      toast({ title: "נמחק בהצלחה" });
      setDeleteId(null);
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const toggleGroup = (key: string) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  /* ── total row ───────────────────────────────────────────── */
  const filteredIncomeTotal = filtered.filter(e => e.entryType === "income").reduce((s, e) => s + e.amount, 0);
  const filteredDeductTotal = filtered.filter(e => e.entryType === "work_deduction").reduce((s, e) => s + e.amount, 0);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader title="הכנסות" description="תיעוד ומעקב הכנסות וניכויי הוצאות עבודה">
        <div className="flex gap-2">
          <Button
            onClick={() => setRecurringOpen(true)}
            variant="outline"
            className="rounded-xl gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <RefreshCw className="w-4 h-4" /> פעולות קבועות
          </Button>
          <Button
            onClick={() => openAdd("work_deduction")}
            variant="outline"
            className="rounded-xl gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            <ArrowDownRight className="w-4 h-4" /> ניכוי עבודה
          </Button>
          <Button onClick={() => openAdd("income")} className="rounded-xl gap-1.5">
            <Plus className="w-4 h-4" /> הכנסה חדשה
          </Button>
        </div>
      </PageHeader>

      {/* ══ KPI STRIP ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          icon={<Landmark className="w-4 h-4" />}
          label='סה"כ הכנסות'
          value={fmt(totalIncome)}
          sub={`${incomeOnly.length} רשומות`}
          iconBg="bg-emerald-100 text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KpiCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="ממוצע חודשי"
          value={fmt(avgMonthly)}
          sub={`על פני ${monthsWithIncome} חודשים`}
          iconBg="bg-teal-100 text-teal-600"
          valueColor="text-teal-600"
        />
        <KpiCard
          icon={<CalendarDays className="w-4 h-4" />}
          label="הכנסות החודש"
          value={fmt(thisMonthIncome)}
          sub={monthLabel(curMonthKey)}
          iconBg="bg-blue-100 text-blue-600"
          valueColor="text-blue-600"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="שנה עד כה"
          value={fmt(ytdIncome)}
          sub={`שנת ${curYear}`}
          iconBg="bg-violet-100 text-violet-600"
          valueColor="text-violet-600"
        />
      </div>

      {/* ══ FILTER BAR ═════════════════════════════════════════ */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש שם..." className="pr-9 rounded-xl h-9 text-sm" />
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

          {/* Month filter */}
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[120px]">
              <CalendarDays className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
              <SelectValue placeholder="חודש" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל החודשים</SelectItem>
              {MONTH_HE.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[120px]">
              <SelectValue placeholder="סוג" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="income">הכנסות</SelectItem>
              <SelectItem value="work_deduction">ניכויים</SelectItem>
            </SelectContent>
          </Select>

          {/* Group by */}
          <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[145px]">
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
              <X className="w-3.5 h-3.5" /> נקה
            </button>
          )}
        </div>

        {/* Active filter pills */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5">
            {search       && <FilterPill label={`חיפוש: "${search}"`}          onRemove={() => setSearch("")} />}
            {dateFrom     && <FilterPill label={`מ-${dateFrom}`}               onRemove={() => setDateFrom("")} />}
            {dateTo       && <FilterPill label={`עד-${dateTo}`}                onRemove={() => setDateTo("")} />}
            {monthFilter !== "all" && <FilterPill label={MONTH_HE[parseInt(monthFilter) - 1]} onRemove={() => setMonthFilter("all")} />}
            {typeFilter   !== "all" && <FilterPill label={typeFilter === "income" ? "הכנסות" : "ניכויים"} onRemove={() => setTypeFilter("all")} />}
          </div>
        )}
      </div>

      {/* ══ TABLE ══════════════════════════════════════════════ */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} onAdd={() => openAdd()} />
      ) : (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div
            className="grid text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 border-b border-border/50 bg-muted/30"
            style={{ gridTemplateColumns: "100px 1fr 80px 60px 110px 1fr 72px", columnGap: "16px" }}
          >
            <span>תאריך</span>
            <span>שם</span>
            <span>חודש</span>
            <span>שנה</span>
            <span className="text-left" dir="ltr">סכום</span>
            <span>הערה</span>
            <span className="text-center">פעולות</span>
          </div>

          {/* Rows */}
          <div>
            {groupBy === "none" ? (
              grouped[0]?.items.map(e => (
                <IncomeRow key={e.id} entry={e}
                  onEdit={() => openEdit(e)} onDelete={() => setDeleteId(e.id)} />
              ))
            ) : (
              grouped.map(g => (
                <div key={g.key}>
                  <button
                    onClick={() => toggleGroup(g.key)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/40 hover:bg-muted/60 transition-colors text-right"
                  >
                    <div className="flex items-center gap-2.5">
                      {collapsed.has(g.key)
                        ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown  className="w-4 h-4 text-muted-foreground" />
                      }
                      <span className="font-semibold text-sm">{g.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {g.items.length} רשומות
                      </span>
                    </div>
                    <span className={cn(
                      "font-bold tabular-nums text-sm",
                      g.total >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {g.total >= 0 ? "+" : ""}{fmt(g.total)}
                    </span>
                  </button>
                  {!collapsed.has(g.key) && g.items.map(e => (
                    <IncomeRow key={e.id} entry={e}
                      onEdit={() => openEdit(e)} onDelete={() => setDeleteId(e.id)} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="grid items-center px-4 py-3 border-t border-border/50 bg-muted/20 text-sm"
            style={{ gridTemplateColumns: "100px 1fr 120px 80px 60px 110px 1fr 72px", columnGap: "16px" }}
          >
            <span className="text-muted-foreground font-medium">{filtered.length} רשומות</span>
            <span />
            <span />
            <span />
            <span className="font-bold text-xs text-muted-foreground">סה״כ</span>
            <div dir="ltr">
              <div className="text-emerald-600 font-bold tabular-nums">+{fmt(filteredIncomeTotal)}</div>
              {filteredDeductTotal > 0 && (
                <div className="text-rose-600 font-semibold tabular-nums text-xs">−{fmt(filteredDeductTotal)}</div>
              )}
            </div>
            <span />
            <span />
          </div>
        </div>
      )}

      {/* ══ ADD / EDIT DIALOG ══════════════════════════════════ */}
      <IncomeDialog
        open={dialog}
        onClose={() => setDialog(false)}
        editItem={editItem}
        form={form}
        setField={setField}
        touch={touch}
        errName={errName}
        errAmount={errAmount}
        errDate={errDate}
        saving={saving}
        onSave={saveEntry}
      />

      {/* ══ DELETE CONFIRM ══════════════════════════════════════ */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" /> מחיקת רשומה
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            האם אתה בטוח שברצונך למחוק רשומה זו? פעולה זו אינה ניתנת לביטול.
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

      {/* ══ RECURRING PANEL ════════════════════════════════════ */}
      <RecurringPanel
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        type="income"
        onApplied={load}
      />
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

function IncomeRow({ entry, onEdit, onDelete }: {
  entry: Income; onEdit: () => void; onDelete: () => void;
}) {
  const isIncome = entry.entryType === "income";
  const name  = parseIncomeName(entry.description);
  const notes = parseIncomeNotes(entry.description);
  const d     = new Date(entry.date);
  return (
    <div
      className="grid items-center px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors group text-sm"
      style={{ gridTemplateColumns: "100px 1fr 80px 60px 110px 1fr 72px", columnGap: "16px" }}
    >
      {/* תאריך */}
      <span className="text-muted-foreground text-xs tabular-nums">{fmtDate(entry.date)}</span>

      {/* שם */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          "w-1.5 h-6 rounded-full shrink-0",
          isIncome ? "bg-emerald-400" : "bg-rose-400"
        )} />
        <span className="font-medium truncate">{name}</span>
        {!isIncome && (
          <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">ניכוי</span>
        )}
      </div>

      {/* חודש */}
      <span className="text-muted-foreground text-xs">{MONTH_HE[d.getMonth()]}</span>

      {/* שנה */}
      <span className="text-muted-foreground text-xs tabular-nums">{d.getFullYear()}</span>

      {/* סכום */}
      <span
        className={cn("font-bold tabular-nums", isIncome ? "text-emerald-600" : "text-rose-600")}
        dir="ltr"
      >
        {isIncome ? "+" : "−"}{fmt(entry.amount)}
      </span>

      {/* הערה */}
      <span className="text-muted-foreground text-xs truncate pr-2">
        {notes || "—"}
      </span>

      {/* פעולות */}
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

function EmptyState({ hasFilters, onClear, onAdd }: { hasFilters: boolean; onClear: () => void; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">
      <Landmark className="w-10 h-10 text-muted-foreground/30 mb-3" />
      <p className="font-semibold text-muted-foreground">אין רשומות הכנסה</p>
      <p className="text-sm text-muted-foreground/70 mt-1">
        {hasFilters ? "אין תוצאות לפילטרים הנוכחיים" : "הוסף את ההכנסה הראשונה שלך"}
      </p>
      <div className="flex gap-2 mt-4">
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClear} className="rounded-xl gap-1.5">
            <X className="w-3.5 h-3.5" /> נקה פילטרים
          </Button>
        )}
        <Button size="sm" onClick={onAdd} className="rounded-xl gap-1.5">
          <Plus className="w-3.5 h-3.5" /> הכנסה חדשה
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INCOME DIALOG
═══════════════════════════════════════════════════════════ */
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-rose-600 mt-1 animate-in slide-in-from-top-1 duration-150">
      <ShieldAlert className="w-3 h-3 shrink-0" />{msg}
    </p>
  );
}

function IncomeDialog({
  open, onClose, editItem, form, setField, touch,
  errName, errAmount, errDate, saving, onSave,
}: {
  open: boolean; onClose: () => void; editItem: Income | null;
  form: IncomeForm;
  setField: <K extends keyof IncomeForm>(k: K, v: IncomeForm[K]) => void;
  touch: (k: string) => void;
  errName: string; errAmount: string; errDate: string;
  saving: boolean; onSave: () => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => amountRef.current?.focus(), 80);
  }, [open]);

  const isEdit   = !!editItem;
  const isIncome = form.entryType === "income";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl border border-border/60" dir="rtl">

        {/* Header */}
        <div className={cn(
          "flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40",
          isIncome
            ? "bg-gradient-to-l from-emerald-50/60 to-white"
            : "bg-gradient-to-l from-rose-50/60 to-white"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0",
            isIncome ? "bg-emerald-600" : "bg-rose-600"
          )}>
            {isIncome
              ? <ArrowUpRight className="w-5 h-5 text-white" />
              : <ArrowDownRight className="w-5 h-5 text-white" />
            }
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-foreground leading-tight">
              {isEdit
                ? (isIncome ? "עריכת הכנסה" : "עריכת ניכוי")
                : (isIncome ? "הכנסה חדשה"  : "ניכוי הוצאות עבודה")
              }
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIncome ? "רשום הכנסה לתיעוד ומעקב" : "ניכוי מפחית את ההכנסה החייבת"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-2xl">
            {([
              { v: "income",         label: "הכנסה",  cls: "bg-emerald-600" },
              { v: "work_deduction", label: "ניכוי",  cls: "bg-rose-600" },
            ] as const).map(t => (
              <button
                key={t.v}
                type="button"
                onClick={() => setField("entryType", t.v)}
                className={cn(
                  "py-2 rounded-xl text-sm font-semibold transition-all",
                  form.entryType === t.v
                    ? `${t.cls} text-white shadow-sm`
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {form.entryType === t.v && <span className="ml-1">✓ </span>}
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-emerald-600" />
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
                  errAmount
                    ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40"
                    : "focus-visible:ring-emerald-300"
                )}
              />
            </div>
            <FieldError msg={errAmount} />
          </div>

          {/* Name */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              שם ההכנסה
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={e => setField("name", e.target.value)}
              onBlur={() => touch("name")}
              placeholder={isIncome ? "לדוגמה: משכורת מרץ 2026..." : "לדוגמה: נסיעות לעבודה..."}
              className={cn(
                "rounded-2xl",
                errName
                  ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40"
                  : "focus-visible:ring-emerald-300"
              )}
            />
            <FieldError msg={errName} />
          </div>

          {/* Date */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
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
                "rounded-2xl max-w-[200px]",
                errDate
                  ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40"
                  : "focus-visible:ring-emerald-300"
              )}
            />
            <FieldError msg={errDate} />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <StickyNote className="w-3.5 h-3.5 text-emerald-600" />
              הערה
              <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
            </Label>
            <textarea
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              placeholder="הערות נוספות..."
              rows={2}
              className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="outline" onClick={onClose} className="rounded-2xl flex-1 h-10">
            <X className="w-4 h-4 ml-1.5" /> ביטול
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className={cn(
              "rounded-2xl flex-1 h-10 text-white shadow-sm",
              isIncome ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            )}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
              : <Check className="w-4 h-4 ml-1.5" />
            }
            {isEdit ? "שמור שינויים" : (isIncome ? "הוסף הכנסה" : "הוסף ניכוי")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
