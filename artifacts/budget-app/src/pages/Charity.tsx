import { useState, useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
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
  HeartHandshake, Loader2, Check, AlertTriangle, Filter,
  CalendarDays, ShieldAlert, StickyNote, CircleDollarSign,
  Landmark, Percent, Target, Gift, Info, Receipt,
} from "lucide-react";


/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type TitheEntry = {
  id: number; amount: number; recipient: string; description: string;
  date: string; isTithe: boolean; tithePercent?: number | null; receiptNumber?: string | null;
};
type IncomeSummary = { totalIncome: number; totalDeductions: number; netIncome: number };
type BudgetYear    = { tithePercentage: number | string };
type GroupBy = "none" | "month" | "year" | "type";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const MONTH_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none",  label: "ללא קיבוץ" },
  { value: "month", label: "לפי חודש"  },
  { value: "year",  label: "לפי שנה"   },
  { value: "type",  label: "לפי סוג"   },
];

/* ═══════════════════════════════════════════════════════════
   FORM
═══════════════════════════════════════════════════════════ */
type EntryForm = {
  amount: string; recipient: string; description: string;
  date: string; isTithe: boolean; receiptNumber: string;
};
const EMPTY_FORM: EntryForm = {
  amount: "", recipient: "", description: "",
  date: new Date().toISOString().split("T")[0],
  isTithe: true, receiptNumber: "",
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
function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(k: string) {
  const [y, m] = k.split("-");
  return `${MONTH_HE[parseInt(m) - 1]} ${y}`;
}
function getYear(d: string)  { return String(new Date(d).getFullYear()); }

/* ═══════════════════════════════════════════════════════════
   PROGRESS BAR
═══════════════════════════════════════════════════════════ */
function TitheProgressBar({ given, target }: { given: number; target: number }) {
  if (target <= 0) return null;
  const pct     = Math.min(100, (given / target) * 100);
  const surplus = given > target;
  const labelPct = `${Math.round(pct)}%`;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-600" />
          <p className="font-semibold text-sm">התקדמות מעשרות</p>
          {surplus && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
              עודף!
            </span>
          )}
        </div>
        <p className={cn("text-sm font-bold tabular-nums", surplus ? "text-emerald-600" : "text-violet-600")}>
          {labelPct}
        </p>
      </div>

      {/* Track */}
      <div className="relative h-4 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            surplus ? "bg-emerald-500" : pct >= 80 ? "bg-violet-500" : "bg-violet-400"
          )}
          style={{ width: `${pct}%` }}
        />
        {/* 100% marker */}
        {pct < 100 && (
          <div className="absolute right-0 top-0 h-full w-px bg-border/60" />
        )}
      </div>

      <div className="flex justify-between mt-2.5 text-xs text-muted-foreground">
        <span>{fmt(given)} ניתן</span>
        <span>יעד: {fmt(target)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Charity() {
  const { toast } = useToast();

  /* ── data ────────────────────────────────────────────────── */
  const [entries,       setEntries]       = useState<TitheEntry[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0 });
  const [budgetYear,    setBudgetYear]    = useState<BudgetYear>({ tithePercentage: 10 });
  const [loading,       setLoading]       = useState(true);

  /* ── filters ─────────────────────────────────────────────── */
  const [search,      setSearch]      = useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [typeFilter,  setTypeFilter]  = useState<"all" | "tithe" | "donation">("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter,  setYearFilter]  = useState("all");
  const [groupBy,     setGroupBy]     = useState<GroupBy>("none");

  /* ── dialog ──────────────────────────────────────────────── */
  const [dialog,      setDialog]      = useState(false);
  const [editItem,    setEditItem]    = useState<TitheEntry | null>(null);
  const [form,        setForm]        = useState<EntryForm>({ ...EMPTY_FORM });
  const [touched,     setTouched]     = useState<Set<string>>(new Set());
  const [submitTried, setSubmitTried] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  /* ── collapsed groups ─────────────────────────────────────── */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  /* ── load ─────────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const [tithes, summ, yearData] = await Promise.all([
        apiFetch("/charity"),
        apiFetch("/incomes/summary"),
        apiFetch("/budget-year"),
      ]);
      setEntries(tithes.map((e: any) => ({ ...e, amount: parseFloat(e.amount) })));
      setIncomeSummary(summ);
      setBudgetYear(yearData);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  /* ── KPI calculations ─────────────────────────────────────── */
  const titheRate    = parseFloat(String(budgetYear.tithePercentage)) / 100 || 0.1;
  const netIncome    = incomeSummary.netIncome;
  const titheTarget  = netIncome * titheRate;
  const titheGiven   = entries.filter(e => e.isTithe).reduce((s, e) => s + e.amount, 0);
  const totalGiven   = entries.reduce((s, e) => s + e.amount, 0);
  const remaining    = titheTarget - titheGiven;
  const pct          = titheTarget > 0 ? Math.min(100, (titheGiven / titheTarget) * 100) : 0;

  /* ── unique years ─────────────────────────────────────────── */
  const uniqueYears = useMemo(() =>
    Array.from(new Set(entries.map(e => getYear(e.date)))).sort().reverse(),
  [entries]);

  /* ── filtered ────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (search && !e.recipient.toLowerCase().includes(search.toLowerCase()) &&
          !e.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo   && e.date > dateTo)   return false;
      if (typeFilter === "tithe"    && !e.isTithe)  return false;
      if (typeFilter === "donation" &&  e.isTithe)  return false;
      if (monthFilter !== "all" && String(new Date(e.date).getMonth() + 1) !== monthFilter) return false;
      if (yearFilter  !== "all" && getYear(e.date) !== yearFilter) return false;
      return true;
    });
  }, [entries, search, dateFrom, dateTo, typeFilter, monthFilter, yearFilter]);

  /* ── filtered totals ─────────────────────────────────────── */
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  /* ── grouped ─────────────────────────────────────────────── */
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{
      key: "all", label: "", items: filtered, total: filteredTotal,
    }];
    const map: Record<string, { key: string; label: string; items: TitheEntry[] }> = {};
    for (const e of filtered) {
      let key = "", label = "";
      if (groupBy === "month") { key = monthKey(e.date); label = monthLabel(key); }
      if (groupBy === "year")  { key = getYear(e.date); label = `שנת ${key}`; }
      if (groupBy === "type")  { key = e.isTithe ? "tithe" : "donation"; label = e.isTithe ? "מעשר" : "תרומה"; }
      if (!map[key]) map[key] = { key, label, items: [] };
      map[key].items.push(e);
    }
    return Object.values(map)
      .sort((a, b) => a.label.localeCompare(b.label, "he"))
      .map(g => ({ ...g, total: g.items.reduce((s, e) => s + e.amount, 0) }));
  }, [filtered, groupBy, filteredTotal]);

  const hasFilters = search || dateFrom || dateTo || typeFilter !== "all" ||
    monthFilter !== "all" || yearFilter !== "all";
  const clearFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setTypeFilter("all"); setMonthFilter("all"); setYearFilter("all");
  };

  /* ── dialog helpers ──────────────────────────────────────── */
  const openAdd = (isTithe = true) => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, isTithe });
    setTouched(new Set()); setSubmitTried(false);
    setDialog(true);
  };
  const openEdit = (e: TitheEntry) => {
    setEditItem(e);
    setForm({
      amount: String(e.amount), recipient: e.recipient,
      description: e.description, date: e.date,
      isTithe: e.isTithe, receiptNumber: e.receiptNumber || "",
    });
    setTouched(new Set()); setSubmitTried(false);
    setDialog(true);
  };
  const setField = <K extends keyof EntryForm>(k: K, v: EntryForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setTouched(prev => new Set(prev).add(k));
  };
  const touch = (k: string) => setTouched(prev => new Set(prev).add(k));

  const showErr = (k: string) => submitTried || touched.has(k);
  const errAmount    = showErr("amount")    && (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) ? "יש להזין סכום חיובי" : "";
  const errRecipient = showErr("recipient") && !form.recipient.trim() ? "שם נמען / תיאור הוא שדה חובה" : "";
  const errDate      = showErr("date")      && !form.date             ? "תאריך הוא שדה חובה" : "";
  const isValid      = !errAmount && !errRecipient && !errDate && form.amount && form.recipient.trim() && form.date;

  const saveEntry = async () => {
    setSubmitTried(true);
    if (!isValid) return;
    setSaving(true);
    try {
      const payload: any = {
        amount:        parseFloat(form.amount),
        recipient:     form.recipient.trim(),
        description:   form.description,
        date:          form.date,
        isTithe:       form.isTithe,
        receiptNumber: form.receiptNumber.trim() || null,
      };
      if (editItem) {
        const updated = await apiFetch(`/charity/${editItem.id}`, { method: "PUT", body: JSON.stringify(payload) });
        const parsed  = { ...updated, amount: parseFloat(updated.amount) };
        setEntries(prev => prev.map(e => e.id === editItem.id ? parsed : e));
        toast({ title: "עודכן בהצלחה" });
      } else {
        const created = await apiFetch("/charity", { method: "POST", body: JSON.stringify(payload) });
        const parsed  = { ...created, amount: parseFloat(created.amount) };
        setEntries(prev => [parsed, ...prev]);
        toast({ title: form.isTithe ? "מעשר נרשם" : "תרומה נרשמה" });
      }
      setDialog(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/charity/${deleteId}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== deleteId));
      toast({ title: "נמחק בהצלחה" });
      setDeleteId(null);
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const toggleGroup = (key: string) => setCollapsed(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader title="צדקה ומעשרות" description="מעקב אחר מעשרות ותרומות ביחס להכנסה נטו">
        <div className="flex gap-2">
          <Button
            onClick={() => openAdd(false)}
            variant="outline"
            className="rounded-xl gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            <Gift className="w-4 h-4" /> תרומה
          </Button>
          <Button onClick={() => openAdd(true)} className="rounded-xl gap-1.5 bg-violet-600 hover:bg-violet-700">
            <HeartHandshake className="w-4 h-4" /> מעשר
          </Button>
        </div>
      </PageHeader>

      {/* ══ KPI STRIP ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiCard
          icon={<Landmark className="w-4 h-4" />}
          label="הכנסה נטו (רלוונטית)"
          value={fmt(netIncome)}
          sub="לאחר ניכויי עבודה"
          iconBg="bg-blue-100 text-blue-600"
          valueColor="text-blue-600"
        />
        <KpiCard
          icon={<Percent className="w-4 h-4" />}
          label="אחוז מעשר"
          value={`${parseFloat(String(budgetYear.tithePercentage))}%`}
          sub="כפי שהוגדר בתקציב"
          iconBg="bg-violet-100 text-violet-600"
          valueColor="text-violet-600"
        />
        <KpiCard
          icon={<Target className="w-4 h-4" />}
          label="יעד מעשרות"
          value={fmt(titheTarget)}
          sub={`${pct.toFixed(0)}% הושלם`}
          iconBg="bg-amber-100 text-amber-600"
          valueColor="text-amber-600"
        />
        <KpiCard
          icon={<HeartHandshake className="w-4 h-4" />}
          label="נתרם בפועל"
          value={fmt(titheGiven)}
          sub={`${entries.filter(e => e.isTithe).length} תשלומי מעשר`}
          iconBg="bg-emerald-100 text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KpiCard
          icon={remaining > 0 ? <CircleDollarSign className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          label={remaining > 0 ? "נותר לתת" : "עודף מעשרות"}
          value={fmt(Math.abs(remaining))}
          sub={remaining > 0 ? "עדיין נדרש" : "חרגת מהיעד — כל הכבוד!"}
          iconBg={remaining > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}
          valueColor={remaining > 0 ? "text-rose-600" : "text-emerald-600"}
        />
      </div>

      {/* ══ PROGRESS BAR ═══════════════════════════════════════ */}
      <TitheProgressBar given={titheGiven} target={titheTarget} />

      {/* Info banner when no income */}
      {netIncome === 0 && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          <Info className="w-4 h-4 shrink-0" />
          <span>כדי לחשב יעד מעשרות, הוסף הכנסות בעמוד ההכנסות תחילה.</span>
        </div>
      )}

      {/* ══ FILTER BAR ═════════════════════════════════════════ */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש נמען / תיאור..." className="pr-9 rounded-xl h-9 text-sm" />
          </div>

          {/* Date from */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">מ-</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-xl h-9 text-sm w-[130px]" dir="ltr" />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">עד-</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-xl h-9 text-sm w-[130px]" dir="ltr" />
          </div>

          {/* Type */}
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[130px]">
              <SelectValue placeholder="סוג" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">מעשר + תרומה</SelectItem>
              <SelectItem value="tithe">מעשרות בלבד</SelectItem>
              <SelectItem value="donation">תרומות בלבד</SelectItem>
            </SelectContent>
          </Select>

          {/* Month */}
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[120px]">
              <CalendarDays className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
              <SelectValue placeholder="חודש" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל החודשים</SelectItem>
              {MONTH_HE.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Year */}
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="rounded-xl h-9 text-sm w-[100px]">
              <SelectValue placeholder="שנה" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל השנים</SelectItem>
              {uniqueYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
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

          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200">
              <X className="w-3.5 h-3.5" /> נקה
            </button>
          )}
        </div>

        {/* Active pills */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5">
            {search && <FilterPill label={`חיפוש: "${search}"`} onRemove={() => setSearch("")} />}
            {dateFrom && <FilterPill label={`מ-${dateFrom}`} onRemove={() => setDateFrom("")} />}
            {dateTo   && <FilterPill label={`עד-${dateTo}`}  onRemove={() => setDateTo("")} />}
            {typeFilter !== "all" && <FilterPill label={typeFilter === "tithe" ? "מעשרות" : "תרומות"} onRemove={() => setTypeFilter("all")} />}
            {monthFilter !== "all" && <FilterPill label={MONTH_HE[parseInt(monthFilter) - 1]} onRemove={() => setMonthFilter("all")} />}
            {yearFilter  !== "all" && <FilterPill label={`שנת ${yearFilter}`} onRemove={() => setYearFilter("all")} />}
          </div>
        )}
      </div>

      {/* ══ TABLE ══════════════════════════════════════════════ */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} onAdd={() => openAdd(true)} />
      ) : (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div
            className="grid text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 border-b border-border/50 bg-muted/30"
            style={{ gridTemplateColumns: "100px 1fr 80px 110px 1fr 72px" }}
          >
            <span>תאריך</span>
            <span>תיאור / נמען</span>
            <span>סוג</span>
            <span className="text-left" dir="ltr">סכום</span>
            <span>הערה</span>
            <span className="text-center">פעולות</span>
          </div>

          {/* Rows */}
          <div>
            {groupBy === "none" ? (
              grouped[0]?.items.map(e => (
                <TitheRow key={e.id} entry={e}
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
                    <span className="font-bold text-violet-600 tabular-nums text-sm">{fmt(g.total)}</span>
                  </button>
                  {!collapsed.has(g.key) && g.items.map(e => (
                    <TitheRow key={e.id} entry={e}
                      onEdit={() => openEdit(e)} onDelete={() => setDeleteId(e.id)} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="grid items-center px-4 py-3 border-t border-border/50 bg-muted/20 text-sm"
            style={{ gridTemplateColumns: "100px 1fr 80px 110px 1fr 72px" }}
          >
            <span className="text-muted-foreground font-medium">{filtered.length} רשומות</span>
            <span />
            <span />
            <div dir="ltr">
              <div className="font-bold text-violet-600 tabular-nums">{fmt(filteredTotal)}</div>
              <div className="text-xs text-muted-foreground">סה״כ</div>
            </div>
            <span />
            <span />
          </div>
        </div>
      )}

      {/* ══ ADD / EDIT DIALOG ══════════════════════════════════ */}
      <TitheDialog
        open={dialog}
        onClose={() => setDialog(false)}
        editItem={editItem}
        form={form}
        setField={setField}
        touch={touch}
        errAmount={errAmount}
        errRecipient={errRecipient}
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
        <p className="text-sm text-muted-foreground leading-snug">{label}</p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mr-1", iconBg)}>{icon}</div>
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

function TitheRow({ entry, onEdit, onDelete }: {
  entry: TitheEntry; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div
      className="grid items-center px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors group text-sm"
      style={{ gridTemplateColumns: "100px 1fr 80px 110px 1fr 72px" }}
    >
      {/* תאריך */}
      <span className="text-muted-foreground text-xs tabular-nums">{fmtDate(entry.date)}</span>

      {/* תיאור / נמען */}
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
          entry.isTithe ? "bg-violet-100" : "bg-rose-100"
        )}>
          {entry.isTithe
            ? <HeartHandshake className="w-4 h-4 text-violet-600" />
            : <Gift className="w-4 h-4 text-rose-500" />
          }
        </div>
        <span className="font-medium truncate">{entry.recipient}</span>
        {entry.receiptNumber && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            קבלה #{entry.receiptNumber}
          </span>
        )}
      </div>

      {/* סוג */}
      <span className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full w-fit",
        entry.isTithe
          ? "bg-violet-100 text-violet-700"
          : "bg-rose-100 text-rose-600"
      )}>
        {entry.isTithe ? "מעשר" : "תרומה"}
      </span>

      {/* סכום */}
      <span
        className={cn("font-bold tabular-nums", entry.isTithe ? "text-violet-600" : "text-rose-600")}
        dir="ltr"
      >
        {fmt(entry.amount)}
      </span>

      {/* הערה */}
      <span className="text-muted-foreground text-xs truncate pr-2">
        {entry.description || "—"}
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
      <HeartHandshake className="w-10 h-10 text-muted-foreground/30 mb-3" />
      <p className="font-semibold text-muted-foreground">אין רשומות תרומה</p>
      <p className="text-sm text-muted-foreground/70 mt-1">
        {hasFilters ? "אין תוצאות לפילטרים הנוכחיים" : "הוסף את המעשר הראשון שלך"}
      </p>
      <div className="flex gap-2 mt-4">
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClear} className="rounded-xl gap-1.5">
            <X className="w-3.5 h-3.5" /> נקה פילטרים
          </Button>
        )}
        <Button size="sm" onClick={onAdd} className="rounded-xl gap-1.5 bg-violet-600 hover:bg-violet-700">
          <Plus className="w-3.5 h-3.5" /> מעשר חדש
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TITHE DIALOG — professional modal
═══════════════════════════════════════════════════════════ */
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-rose-600 mt-1 animate-in slide-in-from-top-1 duration-150">
      <ShieldAlert className="w-3 h-3 shrink-0" />{msg}
    </p>
  );
}

function TitheDialog({
  open, onClose, editItem, form, setField, touch,
  errAmount, errRecipient, errDate, saving, onSave,
}: {
  open: boolean; onClose: () => void; editItem: TitheEntry | null;
  form: EntryForm;
  setField: <K extends keyof EntryForm>(k: K, v: EntryForm[K]) => void;
  touch: (k: string) => void;
  errAmount: string; errRecipient: string; errDate: string;
  saving: boolean; onSave: () => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => amountRef.current?.focus(), 80);
  }, [open]);

  const isEdit   = !!editItem;
  const isTithe  = form.isTithe;
  const accentCls = isTithe ? "bg-violet-600" : "bg-rose-600";
  const ringCls   = isTithe ? "focus-visible:ring-violet-300" : "focus-visible:ring-rose-300";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl border border-border/60"
        dir="rtl"
      >
        {/* Header */}
        <div className={cn(
          "flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40",
          isTithe
            ? "bg-gradient-to-l from-violet-50/60 to-white"
            : "bg-gradient-to-l from-rose-50/60 to-white"
        )}>
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0", accentCls)}>
            {isTithe ? <HeartHandshake className="w-5 h-5 text-white" /> : <Gift className="w-5 h-5 text-white" />}
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-foreground leading-tight">
              {isEdit
                ? (isTithe ? "עריכת מעשר" : "עריכת תרומה")
                : (isTithe ? "מעשר חדש"   : "תרומה חדשה")
              }
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTithe ? "רישום תשלום מעשר" : "רישום תרומה כללית"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-2xl">
            {([
              { v: true,  label: "מעשר",  Icon: HeartHandshake, cls: "bg-violet-600" },
              { v: false, label: "תרומה", Icon: Gift,            cls: "bg-rose-600"  },
            ] as const).map(t => (
              <button
                key={String(t.v)}
                type="button"
                onClick={() => setField("isTithe", t.v)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all",
                  form.isTithe === t.v
                    ? `${t.cls} text-white shadow-sm`
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.Icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <CircleDollarSign className={cn("w-3.5 h-3.5", isTithe ? "text-violet-600" : "text-rose-600")} />
              סכום <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground select-none">₪</span>
              <Input
                ref={amountRef}
                type="number" dir="ltr" min="0" step="0.01"
                value={form.amount}
                onChange={e => setField("amount", e.target.value)}
                onBlur={() => touch("amount")}
                placeholder="0.00"
                className={cn(
                  "pr-9 text-2xl font-bold h-14 rounded-2xl tabular-nums text-left",
                  errAmount ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : ringCls
                )}
              />
            </div>
            <FieldError msg={errAmount} />
          </div>

          {/* Recipient */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              {isTithe ? "נמען / ארגון" : "תיאור התרומה"}
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.recipient}
              onChange={e => setField("recipient", e.target.value)}
              onBlur={() => touch("recipient")}
              placeholder={isTithe ? "שם הארגון או האדם..." : "לדוגמה: עמותה, צדקה..."}
              className={cn(
                "rounded-2xl",
                errRecipient ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : ringCls
              )}
            />
            <FieldError msg={errRecipient} />
          </div>

          {/* Date */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <CalendarDays className={cn("w-3.5 h-3.5", isTithe ? "text-violet-600" : "text-rose-600")} />
              תאריך <span className="text-rose-500">*</span>
            </Label>
            <Input
              type="date" dir="ltr"
              value={form.date}
              onChange={e => setField("date", e.target.value)}
              onBlur={() => touch("date")}
              className={cn(
                "rounded-2xl max-w-[200px]",
                errDate ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : ringCls
              )}
            />
            <FieldError msg={errDate} />
          </div>

          {/* Receipt number */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <Receipt className={cn("w-3.5 h-3.5", isTithe ? "text-violet-600" : "text-rose-600")} />
              מספר קבלה
              <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
            </Label>
            <Input
              value={form.receiptNumber}
              onChange={e => setField("receiptNumber", e.target.value)}
              placeholder="מספר קבלה לתיעוד..."
              className={cn("rounded-2xl", ringCls)}
              dir="ltr"
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1.5">
              <StickyNote className={cn("w-3.5 h-3.5", isTithe ? "text-violet-600" : "text-rose-600")} />
              הערה
              <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
            </Label>
            <textarea
              value={form.description}
              onChange={e => setField("description", e.target.value)}
              placeholder="הערות נוספות..."
              rows={2}
              className={cn(
                "w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground resize-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                isTithe ? "focus-visible:ring-violet-300" : "focus-visible:ring-rose-300"
              )}
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
              isTithe ? "bg-violet-600 hover:bg-violet-700" : "bg-rose-600 hover:bg-rose-700"
            )}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
              : <Check className="w-4 h-4 ml-1.5" />
            }
            {isEdit ? "שמור שינויים" : (isTithe ? "שמור מעשר" : "שמור תרומה")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
