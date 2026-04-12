import { useState, useEffect, useCallback, useRef } from "react";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import {
  CreditCard, CheckSquare, StickyNote,
  Plus, Check, Loader2, Trash2,
  TrendingUp, TrendingDown, Pin, BookOpen, Sun,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */
type Debt = { id: number; name: string; type: string; remainingAmount: number; dueDate: string | null; status: string; notes: string };
type Task = { id: number; title: string; priority: string; status: string; dueDate: string | null };
type Note = { id: number; title: string; content: string; color: string; isPinned: boolean; tabId: number | null };

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   "text-rose-600 bg-rose-50 border-rose-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low:    "text-slate-500 bg-slate-50 border-slate-200",
};

const SECTION_STYLE = "bg-card rounded-2xl border border-border/60 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full";
const SECTION_HEAD  = "flex items-center justify-between px-5 pt-5 pb-3 shrink-0";
const SECTION_TITLE = "flex items-center gap-2 font-display font-bold text-base";
const ICON_WRAP     = (bg: string) => `w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`;

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function Home() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();

  const [debts, setDebts]   = useState<Debt[]>([]);
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [notes, setNotes]   = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dbs, tks, nts] = await Promise.all([
        apiFetch("/debts"),
        apiFetch("/reminders"),
        apiFetch("/notes"),
      ]);
      setDebts(dbs); setTasks(tks); setNotes(nts);
    } catch {
      toast({ title: "שגיאה בטעינה", variant: "destructive" });
    } finally { setLoading(false); }
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* ── Debt operations ── */
  const addDebt = async (payload: any) => {
    const created = await apiFetch("/debts", { method: "POST", body: JSON.stringify(payload) });
    setDebts(prev => [created, ...prev]);
  };
  const updateDebt = async (id: number, data: Partial<Debt>) => {
    const current = debts.find(d => d.id === id)!;
    const updated = await apiFetch(`/debts/${id}`, { method: "PUT", body: JSON.stringify({ ...current, ...data }) });
    setDebts(prev => prev.map(d => d.id === id ? updated : d));
  };
  const deleteDebt = async (id: number) => {
    await apiFetch(`/debts/${id}`, { method: "DELETE" });
    setDebts(prev => prev.filter(d => d.id !== id));
  };

  /* ── Task operations ── */
  const addTask = async (title: string, priority: string) => {
    const created = await apiFetch("/reminders", { method: "POST", body: JSON.stringify({ title, priority, status: "open", description: "" }) });
    setTasks(prev => [created, ...prev]);
  };
  const updateTask = async (id: number, data: Partial<Task>) => {
    const current = tasks.find(t => t.id === id)!;
    const updated = await apiFetch(`/reminders/${id}`, { method: "PUT", body: JSON.stringify({ ...current, ...data }) });
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
  };
  const toggleTask = async (id: number) => {
    const updated = await apiFetch(`/reminders/${id}/toggle`, { method: "PATCH" });
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
  };
  const deleteTask = async (id: number) => {
    await apiFetch(`/reminders/${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  /* ── Note operations ── */
  const addNote = async (title: string, content: string) => {
    const created = await apiFetch("/notes", { method: "POST", body: JSON.stringify({ title, content, tabId: null, color: "#fef9c3", isPinned: false, sortOrder: 0 }) });
    setNotes(prev => [created, ...prev]);
  };
  const updateNote = async (id: number, data: Partial<Note>) => {
    const current = notes.find(n => n.id === id)!;
    const updated = await apiFetch(`/notes/${id}`, { method: "PUT", body: JSON.stringify({ ...current, ...data }) });
    setNotes(prev => prev.map(n => n.id === id ? updated : n));
  };
  const deleteNote = async (id: number) => {
    await apiFetch(`/notes/${id}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  if (loading) {
    return (
      <div dir="rtl">
        <PageHeader title="לוח" description="פתקים, תזכורות וחובות" />
        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {[1, 2, 3].map(i => <div key={i} className="bg-muted animate-pulse rounded-2xl h-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex flex-col h-[calc(100vh-80px)]">
      <PageHeader title="לוח" description="פתקים, תזכורות וחובות" />
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
      <DebtsCard
        debts={debts}
        onAdd={addDebt}
        onUpdate={updateDebt}
        onDelete={deleteDebt}
      />
      <RemindersCard
        tasks={tasks}
        onAdd={addTask}
        onToggle={toggleTask}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />
      <NotesCard
        notes={notes}
        onAdd={addNote}
        onUpdate={updateNote}
        onDelete={deleteNote}
      />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CARD 1: חובות
───────────────────────────────────────────────────────────── */
function DebtsCard({ debts, onAdd, onUpdate, onDelete }: {
  debts: Debt[];
  onAdd: (p: any) => Promise<void>;
  onUpdate: (id: number, data: Partial<Debt>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen]     = useState(false);
  const [name, setName]     = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType]     = useState<"i_owe" | "owed_to_me">("i_owe");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [editId, setEditId]     = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmt, setEditAmt]   = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const activeDebts = debts.filter(d => d.status === "active");

  const openEdit = (d: Debt) => {
    setEditId(d.id); setEditName(d.name); setEditAmt(String(d.remainingAmount));
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await onUpdate(id, { name: editName.trim(), remainingAmount: parseFloat(editAmt) || 0 });
      setEditId(null);
    } catch { toast({ title: "שגיאה בעדכון", variant: "destructive" }); }
  };

  const handleAdd = async () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "שם וסכום נדרשים", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const amt = parseFloat(amount);
      await onAdd({ name: name.trim(), type, totalAmount: amt, remainingAmount: amt, interestRate: 0, status: "active", notes: "" });
      setName(""); setAmount(""); setOpen(false);
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await onDelete(id); }
    catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeletingId(null); }
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

      <div className="px-5 pb-4 flex-1 overflow-y-auto">
        {activeDebts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">אין חובות פעילים</p>
        ) : (
          <div className="space-y-0.5">
            {activeDebts.map(d => (
              <div key={d.id}
                className="group flex items-center gap-2 py-2 border-b border-border/30 last:border-0"
                onDoubleClick={() => editId !== d.id && openEdit(d)}>
                {editId === d.id ? (
                  /* Edit row */
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", d.type === "i_owe" ? "bg-rose-400" : "bg-emerald-400")} />
                    <input
                      ref={editRef}
                      value={editName} onChange={e => setEditName(e.target.value)}
                      className="flex-1 text-sm border-b border-primary bg-transparent outline-none px-0.5"
                      onKeyDown={e => { if (e.key === "Enter") saveEdit(d.id); if (e.key === "Escape") cancelEdit(); }}
                    />
                    <input
                      value={editAmt} onChange={e => setEditAmt(e.target.value)}
                      type="number" dir="ltr"
                      className="w-20 text-sm border-b border-primary bg-transparent outline-none px-0.5 text-left"
                      onKeyDown={e => { if (e.key === "Enter") saveEdit(d.id); if (e.key === "Escape") cancelEdit(); }}
                    />
                    <button onClick={() => saveEdit(d.id)} className="p-1 rounded hover:bg-muted">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-foreground px-1">ביטול</button>
                  </div>
                ) : (
                  /* View row */
                  <>
                    <span className={cn("w-2 h-2 rounded-full shrink-0", d.type === "i_owe" ? "bg-rose-400" : "bg-emerald-400")} />
                    <span className="flex-1 text-sm truncate">{d.name}</span>
                    <span className={cn("font-semibold tabular-nums text-sm", d.type === "i_owe" ? "text-rose-600" : "text-emerald-600")}>
                      {fmt(d.remainingAmount)}
                    </span>
                    <button
                      onClick={() => handleDelete(d.id)} disabled={deletingId === d.id}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-all">
                      {deletingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick-add */}
      <div className="border-t border-border/50 px-4 py-3 shrink-0">
        {open ? (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {[{ v: "i_owe", l: "אני חייב" }, { v: "owed_to_me", l: "חייבים לי" }].map(t => (
                <button key={t.v} onClick={() => setType(t.v as any)}
                  className={cn("flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors",
                    type === t.v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}>
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
              <button onClick={() => { setName(""); setAmount(""); setOpen(false); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-xs">ביטול</button>
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
   CARD 2: תזכורות
───────────────────────────────────────────────────────────── */
function RemindersCard({ tasks, onAdd, onToggle, onUpdate, onDelete }: {
  tasks: Task[];
  onAdd: (title: string, priority: string) => Promise<void>;
  onToggle: (id: number) => Promise<void>;
  onUpdate: (id: number, data: Partial<Task>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen]         = useState(false);
  const [title, setTitle]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [highlightingId, setHighlightingId] = useState<number | null>(null);
  const [editId, setEditId]           = useState<number | null>(null);
  const [editTitle, setEditTitle]     = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const sorted = [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "done" ? 1 : -1;
    const aH = a.priority === "high" ? 0 : 1;
    const bH = b.priority === "high" ? 0 : 1;
    return aH - bH;
  });

  const openEdit = (t: Task) => {
    setEditId(t.id); setEditTitle(t.title);
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const saveEdit = async (id: number) => {
    if (!editTitle.trim()) return;
    try {
      await onUpdate(id, { title: editTitle.trim() });
      setEditId(null);
    } catch { toast({ title: "שגיאה בעדכון", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await onDelete(id); }
    catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  const handleHighlight = async (task: Task) => {
    setHighlightingId(task.id);
    try { await onUpdate(task.id, { priority: task.priority === "high" ? "medium" : "high" }); }
    catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setHighlightingId(null); }
  };

  const handleAdd = async () => {
    if (!title.trim()) { toast({ title: "כותרת נדרשת", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await onAdd(title.trim(), "medium");
      setTitle(""); setOpen(false);
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

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

      <div className="px-5 pb-4 flex-1 overflow-y-auto space-y-0.5">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">אין משימות עדיין</p>
        ) : (
          sorted.map(task => (
            <div key={task.id}
              className={cn(
                "group flex items-start gap-2 py-2 border-b border-border/30 last:border-0 rounded-lg px-1 transition-colors",
                task.status === "done" && "opacity-40",
                task.priority === "high" && task.status !== "done" && "bg-amber-50/70 border-amber-100"
              )}
              onDoubleClick={() => editId !== task.id && openEdit(task)}>

              {editId === task.id ? (
                /* Edit row */
                <div className="flex-1 flex items-center gap-1.5 mt-0.5">
                  <input
                    ref={editRef}
                    value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="flex-1 text-sm border-b border-primary bg-transparent outline-none px-0.5"
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(task.id); if (e.key === "Escape") setEditId(null); }}
                  />
                  <button onClick={() => saveEdit(task.id)} className="p-1 rounded hover:bg-muted">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button onClick={() => setEditId(null)} className="text-xs text-muted-foreground hover:text-foreground px-1">ביטול</button>
                </div>
              ) : (
                /* View row */
                <>
                  {/* Highlight accent bar */}
                  {task.priority === "high" && task.status !== "done" && (
                    <div className="w-1 self-stretch rounded-full bg-amber-400 shrink-0" />
                  )}
                  <p className={cn(
                    "flex-1 text-sm leading-snug",
                    task.status === "done" && "line-through text-muted-foreground",
                    task.priority === "high" && task.status !== "done" && "font-bold text-amber-900"
                  )}>{task.priority === "high" && task.status !== "done" && "⭐ "}{task.title}</p>

                  {/* Actions — visible on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {/* הבלט */}
                    <button onClick={() => handleHighlight(task)} disabled={highlightingId === task.id}
                      title={task.priority === "high" ? "הסר הבלטה" : "הבלט משימה"}
                      className={cn("p-1.5 rounded-lg transition-colors",
                        task.priority === "high"
                          ? "bg-amber-200 text-amber-700 hover:bg-amber-300"
                          : "text-muted-foreground hover:bg-amber-100 hover:text-amber-600")}>
                      {highlightingId === task.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Sun className="w-4 h-4" />}
                    </button>
                    {/* מחיקה */}
                    <button onClick={() => handleDelete(task.id)} disabled={deletingId === task.id}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                      {deletingId === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quick-add */}
      <div className="border-t border-border/50 px-4 py-3 shrink-0">
        {open ? (
          <div className="flex gap-2 items-center">
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="משימה חדשה..." className="rounded-lg h-8 text-sm flex-1" autoFocus
              onKeyDown={e => e.key === "Enter" && handleAdd()} />
            <button onClick={handleAdd} disabled={saving}
              className="p-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => { setTitle(""); setOpen(false); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-xs">ביטול</button>
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
   CARD 3: פתקים
───────────────────────────────────────────────────────────── */
function NotesCard({ notes, onAdd, onUpdate, onDelete }: {
  notes: Note[];
  onAdd: (title: string, content: string) => Promise<void>;
  onUpdate: (id: number, data: Partial<Note>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen]           = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [editId, setEditId]         = useState<number | null>(null);
  const [editTitle, setEditTitle]   = useState("");
  const [editContent, setEditContent] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return 0;
  });

  const openEdit = (n: Note) => {
    setEditId(n.id); setEditTitle(n.title || ""); setEditContent(n.content || "");
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const saveEdit = async (id: number) => {
    try {
      await onUpdate(id, { title: editTitle, content: editContent });
      setEditId(null);
    } catch { toast({ title: "שגיאה בעדכון", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await onDelete(id); }
    catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  const handleAdd = async () => {
    if (!noteContent.trim()) { toast({ title: "תוכן הפתק נדרש", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await onAdd(noteTitle.trim(), noteContent.trim());
      setNoteTitle(""); setNoteContent(""); setOpen(false);
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
      </div>

      <div className="px-5 flex-1 pb-4 overflow-y-auto space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">אין פתקים עדיין</p>
          </div>
        ) : (
          sorted.map(note => (
            <div key={note.id}
              className="group rounded-xl p-3 border border-border/40 hover:border-border transition-colors relative cursor-default"
              style={{ background: note.color ? `${note.color}40` : "#fef9c340" }}
              onDoubleClick={() => editId !== note.id && openEdit(note)}>

              {note.isPinned && editId !== note.id && (
                <Pin className="w-3 h-3 text-muted-foreground absolute top-2.5 left-2.5 rotate-45" />
              )}

              {editId === note.id ? (
                /* Edit mode */
                <div className="space-y-1.5">
                  <input
                    ref={editRef}
                    value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    placeholder="כותרת..."
                    className="w-full text-sm font-semibold bg-transparent border-b border-primary outline-none pb-0.5"
                    onKeyDown={e => e.key === "Escape" && setEditId(null)}
                  />
                  <textarea
                    value={editContent} onChange={e => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full text-xs bg-transparent border border-primary/30 rounded-lg px-2 py-1.5 outline-none resize-none focus:border-primary"
                    onKeyDown={e => { if (e.key === "Escape") setEditId(null); }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => saveEdit(note.id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                      שמור
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="text-xs px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  {note.title && <p className="text-sm font-semibold mb-0.5 pr-1 line-clamp-1">{note.title}</p>}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {note.content || <span className="italic">פתק ריק</span>}
                  </p>
                  {/* Delete — visible on hover */}
                  <button
                    onClick={() => handleDelete(note.id)} disabled={deletingId === note.id}
                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-all">
                    {deletingId === note.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quick-add */}
      <div className="border-t border-border/50 px-4 py-3 shrink-0">
        {open ? (
          <div className="space-y-2">
            <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
              placeholder="כותרת (אופציונלי)..." className="rounded-lg h-8 text-sm" autoFocus />
            <div className="flex gap-2 items-start">
              <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)}
                placeholder="תוכן הפתק..." rows={2}
                className="flex-1 text-sm rounded-lg border border-input bg-background px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
              <div className="flex flex-col gap-1.5">
                <button onClick={handleAdd} disabled={saving}
                  className="p-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { setNoteTitle(""); setNoteContent(""); setOpen(false); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-xs">ביטול</button>
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
