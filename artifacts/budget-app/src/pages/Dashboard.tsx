import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import {
  HeartHandshake, CreditCard, CheckSquare,
  ArrowLeft, Plus, Check, Circle, AlertCircle,
  TrendingUp, TrendingDown, Loader2,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */
type IncomeSummary = { totalIncome: number; totalDeductions: number; netIncome: number };
type BudgetYear    = { tithePercentage: number };
type Tithe         = { id: number; amount: number; recipient: string; isTithe: boolean; date: string };
type Debt          = { id: number; name: string; type: string; remainingAmount: number; dueDate: string | null; status: string };
type Task          = { id: number; title: string; priority: string; status: string; dueDate: string | null };
type FundSummary   = {
  id: number; name: string; colorClass: string; fundBehavior: string; description: string;
  monthlyAllocation: number; annualAllocation: number; initialBalance: number;
  budgetAmount: number; actualAmount: number; remaining: number;
  usagePercent: number; status: "ok" | "warning" | "over";
};

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

const PRIORITY_LABEL: Record<string, string> = { high: "דחוף", medium: "רגיל", low: "נמוך" };
const PRIORITY_COLOR: Record<string, string> = {
  high:   "text-rose-600 bg-rose-50 border-rose-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low:    "text-slate-500 bg-slate-50 border-slate-200",
};

const SECTION_STYLE = "bg-card rounded-2xl border border-border/60 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full";
const SECTION_HEAD  = "flex items-center justify-between px-5 pt-5 pb-3 shrink-0";
const SECTION_TITLE = "flex items-center gap-2 font-display font-bold text-base";
const ICON_WRAP     = (bg: string) => `w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`;
const GO_LINK       = "flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors";

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();

  const [income, setIncome]         = useState<IncomeSummary>({ totalIncome: 0, totalDeductions: 0, netIncome: 0 });
  const [budgetYear, setBudgetYear] = useState<BudgetYear>({ tithePercentage: 10 });
  const [tithes, setTithes]         = useState<Tithe[]>([]);
  const [debts, setDebts]           = useState<Debt[]>([]);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [funds, setFunds]           = useState<FundSummary[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, by, tth, dbs, tks, fnd] = await Promise.all([
        apiFetch("/incomes/summary"),
        apiFetch("/budget-year"),
        apiFetch("/charity"),
        apiFetch("/debts"),
        apiFetch("/reminders"),
        apiFetch("/funds/summary"),
      ]);
      setIncome(inc);
      setBudgetYear(by);
      setTithes(tth);
      setDebts(dbs);
      setTasks(tks);
      setFunds(fnd);
    } catch {
      toast({ title: "שגיאה בטעינה", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const titheTarget = income.netIncome * (budgetYear.tithePercentage / 100);
  const titheGiven  = tithes.filter(t => t.isTithe).reduce((s, t) => s + t.amount, 0);
  const titheLeft   = titheTarget - titheGiven;
  const tithePct    = titheTarget > 0 ? Math.min(100, (titheGiven / titheTarget) * 100) : 0;

  const monthlyFunds   = funds.filter(f => f.fundBehavior === "fixed_monthly" || f.fundBehavior === "cash_monthly");
  const annualFunds    = funds.filter(f => f.fundBehavior === "annual_categorized" || f.fundBehavior === "annual_large");
  const nonBudgetFunds = funds.filter(f => f.fundBehavior === "non_budget");

  if (loading) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-80px)]">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-muted animate-pulse rounded-2xl h-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">

      {/* ══ 3 כרטיסים ראשיים ══════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-80px)]">
        <TitheCard
          income={income}
          budgetYear={budgetYear}
          tithes={tithes}
          titheTarget={titheTarget}
          titheGiven={titheGiven}
          titheLeft={titheLeft}
          tithePct={tithePct}
          onAdd={async (payload) => {
            const created = await apiFetch("/charity", { method: "POST", body: JSON.stringify(payload) });
            setTithes(prev => [{ ...created, amount: parseFloat(String(created.amount)) }, ...prev]);
          }}
        />
        <RemindersCard
          tasks={tasks}
          onToggle={async (id) => {
            const updated = await apiFetch(`/reminders/${id}/toggle`, { method: "PATCH" });
            setTasks(prev => prev.map(t => t.id === id ? updated : t));
          }}
          onAdd={async (title, priority) => {
            const created = await apiFetch("/reminders", {
              method: "POST",
              body: JSON.stringify({ title, priority, status: "open", description: "" }),
            });
            setTasks(prev => [created, ...prev]);
          }}
        />
        <DebtsCard
          debts={debts}
          onAdd={async (payload) => {
            const created = await apiFetch("/debts", { method: "POST", body: JSON.stringify(payload) });
            setDebts(prev => [created, ...prev]);
          }}
        />
      </div>

      {/* ══ קופות ════════════════════════════════════════════= */}
      {funds.length > 0 && (
        <div className="space-y-5 pb-6">
          <FundGroup title="קופות חודשיות" funds={monthlyFunds} />
          <FundGroup title="קופות שנתיות" funds={annualFunds} />
          <FundGroup title="קופות מחוץ לתקציב" funds={nonBudgetFunds} />
        </div>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD: מעשרות
═══════════════════════════════════════════════════════════ */
function TitheCard({ income, budgetYear, tithes, titheTarget, titheGiven, titheLeft, tithePct, onAdd }: {
  income: IncomeSummary; budgetYear: BudgetYear;
  tithes: Tithe[]; titheTarget: number; titheGiven: number; titheLeft: number; tithePct: number;
  onAdd: (p: any) => Promise<void>;
}) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [open, setOpen]           = useState(false);

  const handleAdd = async () => {
    if (!recipient.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "נמען וסכום נדרשים", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await onAdd({ recipient: recipient.trim(), amount: parseFloat(amount), isTithe: true, date: new Date().toISOString().split("T")[0], description: "" });
      setRecipient(""); setAmount(""); setOpen(false);
      toast({ title: "מעשר נרשם ✓" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className={SECTION_STYLE}>
      <div className={SECTION_HEAD}>
        <div className={SECTION_TITLE}>
          <div className={ICON_WRAP("bg-violet-100")}>
            <HeartHandshake className="w-4 h-4 text-violet-600" />
          </div>
          מעשרות
        </div>
        <Link href="/charity">
          <span className={GO_LINK}>לכל הצדקות <ArrowLeft className="w-3 h-3" /></span>
        </Link>
      </div>

      <div className="px-5 pb-4 space-y-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "הכנסה נטו", value: fmt(income.netIncome), color: "text-foreground" },
            { label: `יעד (${budgetYear.tithePercentage}%)`, value: fmt(titheTarget), color: "text-violet-600" },
            { label: "נתרם", value: fmt(titheGiven), color: "text-emerald-600" },
            { label: titheLeft > 0 ? "נותר לתת" : "עודף", value: fmt(Math.abs(titheLeft)), color: titheLeft > 0 ? "text-rose-500" : "text-emerald-600" },
          ].map(s => (
            <div key={s.label} className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("font-bold mt-0.5", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>התקדמות</span>
            <span className="font-semibold">{Math.round(tithePct)}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", tithePct >= 100 ? "bg-emerald-500" : "bg-violet-500")}
              style={{ width: `${tithePct}%` }} />
          </div>
        </div>

        {tithes.length > 0 && (
          <div className="space-y-1.5">
            {tithes.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground truncate">{t.recipient}</span>
                <span className="font-semibold text-violet-600 tabular-nums mr-2">{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {tithes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">אין רשומות מעשר עדיין</p>
        )}
      </div>

      <div className="border-t border-border/50 px-4 py-3 shrink-0">
        {open ? (
          <div className="flex gap-2 items-center">
            <Input value={recipient} onChange={e => setRecipient(e.target.value)}
              placeholder="נמען..." className="rounded-lg h-8 text-sm flex-1" autoFocus />
            <Input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" placeholder="₪" dir="ltr" className="rounded-lg h-8 text-sm w-20" />
            <button onClick={handleAdd} disabled={saving}
              className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <span className="text-xs">ביטול</span>
            </button>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-violet-600 transition-colors w-full">
            <Plus className="w-4 h-4" /> רשום מעשר חדש
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD: חובות
═══════════════════════════════════════════════════════════ */
function DebtsCard({ debts, onAdd }: { debts: Debt[]; onAdd: (p: any) => Promise<void> }) {
  const { toast } = useToast();
  const [open, setOpen]     = useState(false);
  const [name, setName]     = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType]     = useState<"i_owe" | "owed_to_me">("i_owe");
  const [saving, setSaving] = useState(false);

  const activeDebts = debts.filter(d => d.status === "active");
  const iOwe        = activeDebts.filter(d => d.type === "i_owe");
  const owedToMe    = activeDebts.filter(d => d.type === "owed_to_me");
  const totalIOwe   = iOwe.reduce((s, d) => s + d.remainingAmount, 0);
  const totalOwed   = owedToMe.reduce((s, d) => s + d.remainingAmount, 0);

  const handleAdd = async () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "שם וסכום נדרשים", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const amt = parseFloat(amount);
      await onAdd({ name: name.trim(), type, totalAmount: amt, remainingAmount: amt, interestRate: 0, status: "active", notes: "" });
      setName(""); setAmount(""); setOpen(false);
      toast({ title: "חוב נרשם ✓" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className={SECTION_STYLE}>
      <div className={SECTION_HEAD}>
        <div className={SECTION_TITLE}>
          <div className={ICON_WRAP("bg-rose-100")}>
            <CreditCard className="w-4 h-4 text-rose-600" />
          </div>
          חובות
        </div>
      </div>

      <div className="px-5 pb-4 space-y-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              <p className="text-xs text-rose-700 font-medium">אני חייב</p>
            </div>
            <p className="font-bold text-rose-600 text-lg">{fmt(totalIOwe)}</p>
            <p className="text-xs text-muted-foreground">{iOwe.length} חובות</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-xs text-emerald-700 font-medium">חייבים לי</p>
            </div>
            <p className="font-bold text-emerald-600 text-lg">{fmt(totalOwed)}</p>
            <p className="text-xs text-muted-foreground">{owedToMe.length} חובות</p>
          </div>
        </div>

        {activeDebts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">אין חובות פעילים</p>
        ) : (
          <div className="space-y-1.5">
            {activeDebts.map(d => (
              <div key={d.id} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", d.type === "i_owe" ? "bg-rose-400" : "bg-emerald-400")} />
                  <span className="truncate max-w-[130px]">{d.name}</span>
                </div>
                <span className={cn("font-semibold tabular-nums", d.type === "i_owe" ? "text-rose-600" : "text-emerald-600")}>
                  {fmt(d.remainingAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/50 px-4 py-3 shrink-0">
        {open ? (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {[{ v: "i_owe", l: "אני חייב" }, { v: "owed_to_me", l: "חייבים לי" }].map(t => (
                <button key={t.v} onClick={() => setType(t.v as any)}
                  className={cn("flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors",
                    type === t.v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                  )}>
                  {t.l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="שם..." className="rounded-lg h-8 text-sm flex-1" autoFocus />
              <Input value={amount} onChange={e => setAmount(e.target.value)}
                type="number" placeholder="₪" dir="ltr" className="rounded-lg h-8 text-sm w-20" />
              <button onClick={handleAdd} disabled={saving}
                className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-xs">ביטול</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-rose-600 transition-colors w-full">
            <Plus className="w-4 h-4" /> הוסף חוב חדש
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD: תזכורות
═══════════════════════════════════════════════════════════ */
function RemindersCard({ tasks, onToggle, onAdd }: {
  tasks: Task[]; onToggle: (id: number) => Promise<void>; onAdd: (title: string, priority: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen]         = useState(false);
  const [title, setTitle]       = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving]     = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const openTasks = tasks.filter(t => t.status !== "done");
  const high      = openTasks.filter(t => t.priority === "high");
  const others    = openTasks.filter(t => t.priority !== "high");
  const doneTasks = tasks.filter(t => t.status === "done");

  const handleToggle = async (id: number) => {
    setToggling(id);
    try { await onToggle(id); }
    catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setToggling(null); }
  };

  const handleAdd = async () => {
    if (!title.trim()) { toast({ title: "כותרת נדרשת", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await onAdd(title.trim(), priority);
      setTitle(""); setOpen(false);
      toast({ title: "משימה נוצרה ✓" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const TaskRow = ({ task }: { task: Task }) => (
    <div className={cn("flex items-start gap-2.5 py-1.5 border-b border-border/30 last:border-0",
      task.status === "done" && "opacity-50"
    )}>
      <button onClick={() => handleToggle(task.id)} disabled={toggling === task.id}
        className="mt-0.5 shrink-0 transition-colors">
        {toggling === task.id
          ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          : task.status === "done"
            ? <Check className="w-4 h-4 text-emerald-500" />
            : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", task.status === "done" && "line-through")}>{task.title}</p>
        {task.dueDate && (
          <p className="text-xs text-muted-foreground mt-0.5">{new Date(task.dueDate).toLocaleDateString("he-IL")}</p>
        )}
      </div>
      {task.priority !== "medium" && (
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium border shrink-0 mt-0.5", PRIORITY_COLOR[task.priority])}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      )}
    </div>
  );

  return (
    <div className={SECTION_STYLE}>
      <div className={SECTION_HEAD}>
        <div className={SECTION_TITLE}>
          <div className={ICON_WRAP("bg-amber-100")}>
            <CheckSquare className="w-4 h-4 text-amber-600" />
          </div>
          תזכורות ומשימות
        </div>
      </div>

      <div className="px-5 pb-4 space-y-3 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 text-sm shrink-0">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span className="font-semibold text-rose-600">{high.length}</span>
            <span className="text-muted-foreground">דחופות</span>
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Circle className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold">{others.length}</span>
            <span className="text-muted-foreground">שאר</span>
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-semibold">{tasks.filter(t => t.status === "done").length}</span>
            <span className="text-muted-foreground">הושלמו</span>
          </span>
        </div>

        {openTasks.length === 0 && doneTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">אין משימות עדיין</p>
        ) : (
          <div>
            {high.length > 0 && (
              <div className="mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">דחוף</p>
                {high.map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
            {others.map(t => <TaskRow key={t.id} task={t} />)}
            {doneTasks.length > 0 && openTasks.length < 5 && (
              <div className="mt-1">
                {doneTasks.map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/50 px-4 py-3 shrink-0">
        {open ? (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {[{ v: "high", l: "דחוף" }, { v: "medium", l: "רגיל" }, { v: "low", l: "נמוך" }].map(p => (
                <button key={p.v} onClick={() => setPriority(p.v)}
                  className={cn("flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors",
                    priority === p.v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                  )}>
                  {p.l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="משימה חדשה..." className="rounded-lg h-8 text-sm flex-1" autoFocus
                onKeyDown={e => e.key === "Enter" && handleAdd()} />
              <button onClick={handleAdd} disabled={saving}
                className="p-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-xs">ביטול</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-amber-600 transition-colors w-full">
            <Plus className="w-4 h-4" /> הוסף משימה
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FUND GROUP + FUND CARD
═══════════════════════════════════════════════════════════ */
function FundGroup({ title, funds }: { title: string; funds: FundSummary[] }) {
  if (funds.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {funds.map(fund => <FundCard key={fund.id} fund={fund} />)}
      </div>
    </div>
  );
}

function FundCard({ fund }: { fund: FundSummary }) {
  const isMonthly   = fund.fundBehavior === "fixed_monthly" || fund.fundBehavior === "cash_monthly";
  const isNonBudget = fund.fundBehavior === "non_budget";

  const barColor =
    fund.status === "over"    ? "bg-rose-500" :
    fund.status === "warning" ? "bg-amber-500" :
    "bg-emerald-500";

  const remainColor =
    fund.remaining < 0       ? "text-rose-600" :
    fund.remaining === 0     ? "text-muted-foreground" :
    "text-emerald-600";

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fund.colorClass }} />
        <span className="font-semibold text-sm truncate">{fund.name}</span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{isNonBudget ? "יתרת פתיחה" : isMonthly ? "תקציב שנתי" : "תקציב"}</span>
          <span className="font-medium tabular-nums">{fmt(fund.budgetAmount)}</span>
        </div>
        {isMonthly && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">חודשי</span>
            <span className="font-medium tabular-nums">{fmt(fund.monthlyAllocation)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">הוצאות בפועל</span>
          <span className="font-medium tabular-nums">{fmt(fund.actualAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-border/40 pt-1.5">
          <span className="text-muted-foreground">{isNonBudget ? "יתרה" : "נותר"}</span>
          <span className={cn("font-bold tabular-nums", remainColor)}>{fmt(fund.remaining)}</span>
        </div>
      </div>

      {fund.budgetAmount > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{fund.usagePercent}%</span>
            {fund.status === "over" && <span className="text-rose-500 font-medium">חריגה!</span>}
            {fund.status === "warning" && <span className="text-amber-500 font-medium">קרוב לגבול</span>}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${fund.usagePercent}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
