import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import {
  CreditCard, CheckSquare, StickyNote,
  ArrowLeft, Plus, Check, Circle, AlertCircle, Pin,
  TrendingUp, TrendingDown, Loader2,
  BookOpen,
} from "lucide-react";


/* ── Types ─────────────────────────────────────────────────── */
type Debt    = { id: number; name: string; type: string; remainingAmount: number; dueDate: string | null; status: string };
type Task    = { id: number; title: string; priority: string; status: string; dueDate: string | null };
type NoteTab = { id: number; name: string; color: string };
type Note    = { id: number; title: string; content: string; color: string; isPinned: boolean; tabId: number | null; tabName: string | null };

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

const SECTION_STYLE = "bg-card rounded-2xl border border-border/60 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow";
const SECTION_HEAD  = "flex items-center justify-between px-5 pt-5 pb-3";
const SECTION_TITLE = "flex items-center gap-2 font-display font-bold text-base";
const ICON_WRAP     = (bg: string) => `w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`;
const GO_LINK       = "flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors";

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function Home() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();

  /* global data */
  const [debts, setDebts]     = useState<Debt[]>([]);
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [tabs, setTabs]       = useState<NoteTab[]>([]);
  const [notes, setNotes]     = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dbs, tks, nbs, nts] = await Promise.all([
        apiFetch("/debts"),
        apiFetch("/reminders"),
        apiFetch("/note-tabs"),
        apiFetch("/notes"),
      ]);
      setDebts(dbs);
      setTasks(tks);
      setTabs(nbs);
      setNotes(nts);
    } catch {
      toast({ title: "שגיאה בטעינה", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">שלום 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{monthLabel} — סקירת מצב</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-72 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ══════════════════════════════════════════════════
              CARD 1 — חובות
          ══════════════════════════════════════════════════ */}
          <DebtsCard
            debts={debts}
            onAdd={async (payload) => {
              const created = await apiFetch("/debts", { method: "POST", body: JSON.stringify(payload) });
              setDebts(prev => [created, ...prev]);
            }}
          />

          {/* ══════════════════════════════════════════════════
              CARD 2 — תזכורות
          ══════════════════════════════════════════════════ */}
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

          {/* ══════════════════════════════════════════════════
              CARD 3 — פתקים
          ══════════════════════════════════════════════════ */}
          <NotesCard
            tabs={tabs}
            notes={notes}
            onAdd={async (title, content, tabId) => {
              const created = await apiFetch("/notes", {
                method: "POST",
                body: JSON.stringify({ title, content, tabId, color: "#fef9c3", isPinned: false, sortOrder: 0 }),
              });
              setNotes(prev => [{ ...created, tabName: tabs.find(t => t.id === tabId)?.name ?? null }, ...prev]);
            }}
          />

        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CARD 1: חובות
───────────────────────────────────────────────────────────── */
function DebtsCard({ debts, onAdd }: { debts: Debt[]; onAdd: (p: any) => Promise<void> }) {
  const { toast } = useToast();
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType]   = useState<"i_owe" | "owed_to_me">("i_owe");
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
        <Link href={`/debts`}>
          <span className={GO_LINK}>לכל החובות <ArrowLeft className="w-3 h-3" /></span>
        </Link>
      </div>

      <div className="px-5 pb-4 space-y-4 flex-1">
        {/* Totals */}
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

        {/* Short list */}
        {activeDebts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">אין חובות פעילים</p>
        ) : (
          <div className="space-y-1.5">
            {activeDebts.slice(0, 4).map(d => (
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
            {activeDebts.length > 4 && (
              <p className="text-xs text-muted-foreground text-center">ועוד {activeDebts.length - 4}...</p>
            )}
          </div>
        )}
      </div>

      {/* Quick-add */}
      <div className="border-t border-border/50 px-4 py-3">
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

/* ─────────────────────────────────────────────────────────────
   CARD 3: תזכורות
───────────────────────────────────────────────────────────── */
function RemindersCard({ tasks, onToggle, onAdd }: {
  tasks: Task[]; onToggle: (id: number) => Promise<void>; onAdd: (title: string, priority: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen]       = useState(false);
  const [title, setTitle]     = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving]   = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const openTasks   = tasks.filter(t => t.status !== "done");
  const high        = openTasks.filter(t => t.priority === "high");
  const others      = openTasks.filter(t => t.priority !== "high");
  const doneTasks   = tasks.filter(t => t.status === "done").slice(0, 2);

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
        <Link href={`/reminders`}>
          <span className={GO_LINK}>לכל המשימות <ArrowLeft className="w-3 h-3" /></span>
        </Link>
      </div>

      <div className="px-5 pb-4 space-y-3 flex-1">
        {/* Summary counts */}
        <div className="flex items-center gap-3 text-sm">
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
            {/* High priority first */}
            {high.length > 0 && (
              <div className="mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">דחוף</p>
                {high.slice(0, 3).map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
            {/* Others */}
            {others.slice(0, high.length >= 2 ? 1 : 3).map(t => <TaskRow key={t.id} task={t} />)}
            {/* Done */}
            {doneTasks.length > 0 && openTasks.length < 3 && (
              <div className="mt-1">
                {doneTasks.map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick-add */}
      <div className="border-t border-border/50 px-4 py-3">
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

/* ─────────────────────────────────────────────────────────────
   CARD 4: פתקים
───────────────────────────────────────────────────────────── */
function NotesCard({ tabs, notes, onAdd }: {
  tabs: NoteTab[]; notes: Note[]; onAdd: (title: string, content: string, tabId: number | null) => Promise<void>;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [open, setOpen]           = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving]       = useState(false);

  /* auto-select first tab */
  useEffect(() => {
    if (tabs.length > 0 && activeTab === null) setActiveTab(tabs[0].id);
  }, [tabs]);

  const visibleNotes = activeTab !== null
    ? notes.filter(n => n.tabId === activeTab)
    : notes.filter(n => n.tabId === null);

  const pinned  = visibleNotes.filter(n => n.isPinned);
  const regular = visibleNotes.filter(n => !n.isPinned);
  const all     = [...pinned, ...regular].slice(0, 5);

  const handleAdd = async () => {
    if (!noteContent.trim()) { toast({ title: "תוכן הפתק נדרש", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await onAdd(noteTitle.trim(), noteContent.trim(), activeTab);
      setNoteTitle(""); setNoteContent(""); setOpen(false);
      toast({ title: "פתק נוצר ✓" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className={SECTION_STYLE}>
      <div className={SECTION_HEAD}>
        <div className={SECTION_TITLE}>
          <div className={ICON_WRAP("bg-yellow-100")}>
            <StickyNote className="w-4 h-4 text-yellow-600" />
          </div>
          פתקים
        </div>
        <Link href={`/notes`}>
          <span className={GO_LINK}>לכל הפתקים <ArrowLeft className="w-3 h-3" /></span>
        </Link>
      </div>

      <div className="px-5 flex-1 space-y-3 pb-4">
        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all",
                  activeTab === tab.id
                    ? "border-transparent text-white shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/30"
                )}
                style={activeTab === tab.id ? { background: tab.color || "#6366f1" } : {}}>
                <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                  style={{ background: tab.color || "#94a3b8", opacity: activeTab === tab.id ? 0 : 1 }} />
                {tab.name}
              </button>
            ))}
          </div>
        )}

        {/* Notes list */}
        {all.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">אין פתקים בטאב זה</p>
          </div>
        ) : (
          <div className="space-y-2">
            {all.map(note => (
              <div key={note.id}
                className="rounded-xl p-3 border border-border/40 hover:border-border transition-colors relative"
                style={{ background: note.color ? `${note.color}40` : "#fef9c340" }}>
                {note.isPinned && (
                  <Pin className="w-3 h-3 text-muted-foreground absolute top-2.5 left-2.5 rotate-45" />
                )}
                {note.title && (
                  <p className="text-sm font-semibold mb-0.5 pr-1 line-clamp-1">{note.title}</p>
                )}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {note.content || <span className="italic">פתק ריק</span>}
                </p>
              </div>
            ))}
            {visibleNotes.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">ועוד {visibleNotes.length - 5} פתקים...</p>
            )}
          </div>
        )}
      </div>

      {/* Quick-add */}
      <div className="border-t border-border/50 px-4 py-3">
        {open ? (
          <div className="space-y-2">
            <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
              placeholder="כותרת (אופציונלי)..." className="rounded-lg h-8 text-sm" autoFocus />
            <div className="flex gap-2 items-start">
              <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)}
                placeholder="תוכן הפתק..."
                rows={2}
                className="flex-1 text-sm rounded-lg border border-input bg-background px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
              <div className="flex flex-col gap-1.5">
                <button onClick={handleAdd} disabled={saving}
                  className="p-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-xs">ביטול</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-yellow-600 transition-colors w-full">
            <Plus className="w-4 h-4" /> כתוב פתק חדש
          </button>
        )}
      </div>
    </div>
  );
}
