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
  TrendingUp, TrendingDown, Pin, BookOpen, Sun, GripVertical, Pencil, ChevronRight,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */
type Debt = { id: number; name: string; type: string; remainingAmount: number; dueDate: string | null; status: string; notes: string };
type Task = { id: number; title: string; priority: string; status: string; dueDate: string | null };
type Note = { id: number; title: string; content: string; color: string; isPinned: boolean; tabId: number | null; sortOrder: number };

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   "text-rose-600 bg-rose-50 border-rose-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low:    "text-slate-500 bg-slate-50 border-slate-200",
};

const SECTION_STYLE = "bg-card rounded-2xl border border-border/60 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow min-h-[320px] md:h-full";
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
  const reorderNotes = async (items: { id: number; sortOrder: number }[]) => {
    setNotes(prev => prev.map(n => {
      const item = items.find(i => i.id === n.id);
      return item ? { ...n, sortOrder: item.sortOrder } : n;
    }));
    await apiFetch("/notes/reorder", { method: "PATCH", body: JSON.stringify(items) });
  };

  if (loading) {
    return (
      <div dir="rtl">
        <PageHeader title="לוח" description="פתקים, תזכורות וחובות" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:h-[calc(100vh-200px)]">
          {[1, 2, 3].map(i => <div key={i} className="bg-muted animate-pulse rounded-2xl min-h-[320px] md:h-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex flex-col md:h-[calc(100vh-80px)]">
      <PageHeader title="לוח" description="פתקים, תזכורות וחובות" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:flex-1 md:min-h-0">
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
        onReorder={reorderNotes}
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
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState("");
  const [amount, setAmount]     = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [type, setType]         = useState<"i_owe" | "owed_to_me">("i_owe");
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // inline double-click editing
  const [inlineId, setInlineId]         = useState<number | null>(null);
  const [inlineName, setInlineName]     = useState("");
  const [inlineAmt, setInlineAmt]       = useState("");
  const [inlineNotes, setInlineNotes]   = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const inlineNameRef  = useRef<HTMLInputElement>(null);
  const inlineAmtRef   = useRef<HTMLInputElement>(null);
  const inlineNotesRef = useRef<HTMLTextAreaElement>(null);

  const activeDebts = debts.filter(d => d.status === "active");

  const startInlineEdit = (d: Debt, focus: "name" | "amt" | "notes") => {
    setInlineId(d.id);
    setInlineName(d.name);
    setInlineAmt(String(d.remainingAmount));
    setInlineNotes(d.notes || "");
    setTimeout(() => {
      if (focus === "name")  inlineNameRef.current?.focus();
      else if (focus === "amt")   inlineAmtRef.current?.focus();
      else inlineNotesRef.current?.focus();
    }, 20);
  };

  const cancelInlineEdit = () => setInlineId(null);

  const isInlineField = () => {
    const a = document.activeElement;
    return a === inlineNameRef.current || a === inlineAmtRef.current || a === inlineNotesRef.current;
  };

  const saveInlineEdit = async (d: Debt) => {
    if (!inlineName.trim()) return cancelInlineEdit();
    setInlineSaving(true);
    try {
      await onUpdate(d.id, {
        name: inlineName.trim(),
        remainingAmount: parseFloat(inlineAmt) || 0,
        notes: inlineNotes,
      });
    } catch { toast({ title: "שגיאה בעדכון", variant: "destructive" }); }
    finally { setInlineSaving(false); setInlineId(null); }
  };

  const handleAdd = async () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0) {
      toast({ title: "שם וסכום נדרשים", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const amt = parseFloat(amount);
      await onAdd({ name: name.trim(), type, totalAmount: amt, remainingAmount: amt, interestRate: 0, status: "active", notes: newNotes.trim() });
      setName(""); setAmount(""); setNewNotes(""); setOpen(false);
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
      {/* ── Header ── */}
      <div className={SECTION_HEAD}>
        <div className={SECTION_TITLE}>
          <div className={ICON_WRAP("bg-rose-100")}>
            <CreditCard className="w-4 h-4 text-rose-600" />
          </div>
          חובות
        </div>
      </div>

      {/* ── Debts list ── */}
      <>
        <div className="px-5 pb-4 flex-1 overflow-y-auto">
          {activeDebts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין חובות פעילים</p>
          ) : (
            <div className="space-y-0.5">
              {activeDebts.map(d => {
                const isInline = inlineId === d.id;
                const blurSave = () => setTimeout(() => { if (!isInlineField()) saveInlineEdit(d); }, 0);
                const blurCancel = () => setTimeout(() => { if (!isInlineField()) cancelInlineEdit(); }, 0);
                return (
                  <div key={d.id}
                    className={cn(
                      "group border-b border-border/30 last:border-0 rounded-lg px-1 -mx-1 transition-colors",
                      isInline ? "bg-muted/40 py-2" : "py-2.5 hover:bg-muted/30"
                    )}>

                    {isInline ? (
                      /* ── inline edit ── */
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", d.type === "i_owe" ? "bg-rose-400" : "bg-emerald-400")} />
                          <input
                            ref={inlineNameRef}
                            value={inlineName}
                            onChange={e => setInlineName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(d); if (e.key === "Escape") cancelInlineEdit(); }}
                            onBlur={blurSave}
                            className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-primary outline-none"
                          />
                          <input
                            ref={inlineAmtRef}
                            value={inlineAmt}
                            onChange={e => setInlineAmt(e.target.value)}
                            type="number" dir="ltr"
                            onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(d); if (e.key === "Escape") cancelInlineEdit(); }}
                            onBlur={blurSave}
                            className={cn(
                              "w-16 text-sm tabular-nums font-semibold bg-transparent border-b border-primary outline-none text-left shrink-0",
                              d.type === "i_owe" ? "text-rose-600" : "text-emerald-600"
                            )}
                          />
                          {inlineSaving
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                            : <button onClick={() => { handleDelete(d.id); cancelInlineEdit(); }}
                                disabled={deletingId === d.id}
                                className="p-0.5 rounded hover:text-rose-600 text-muted-foreground/50 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                          }
                        </div>
                        <textarea
                          ref={inlineNotesRef}
                          value={inlineNotes}
                          onChange={e => setInlineNotes(e.target.value)}
                          placeholder="הערה..."
                          rows={Math.max(1, (inlineNotes.match(/\n/g) || []).length + 1)}
                          onKeyDown={e => { if (e.key === "Escape") cancelInlineEdit(); }}
                          onBlur={blurSave}
                          className="w-full text-xs text-muted-foreground bg-transparent border-b border-border/40 focus:border-primary outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40 pr-4"
                        />
                      </div>
                    ) : (
                      /* ── normal display ── */
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", d.type === "i_owe" ? "bg-rose-400" : "bg-emerald-400")} />
                        <div className="flex-1 min-w-0 cursor-text"
                          onDoubleClick={() => startInlineEdit(d, "name")}>
                          <p className="text-sm truncate">{d.name}</p>
                          {d.notes && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5"
                              onDoubleClick={e => { e.stopPropagation(); startInlineEdit(d, "notes"); }}>
                              {d.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold tabular-nums text-sm shrink-0 cursor-text"
                          onDoubleClick={() => startInlineEdit(d, "amt")}
                          style={{ color: d.type === "i_owe" ? "var(--color-rose-600, #e11d48)" : "var(--color-emerald-600, #059669)" }}>
                          {fmt(d.remainingAmount)}
                        </span>
                        <button
                          onClick={() => handleDelete(d.id)}
                          disabled={deletingId === d.id}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-rose-600 text-muted-foreground/50 transition-all shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
                </div>
                <textarea
                  value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  placeholder="הערה (אופציונלי)..." rows={2}
                  className="w-full text-sm rounded-lg border border-input bg-background px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                <div className="flex gap-2">
                  <button onClick={handleAdd} disabled={saving}
                    className="flex-1 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors text-sm">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "הוסף"}
                  </button>
                  <button onClick={() => { setName(""); setAmount(""); setNewNotes(""); setOpen(false); }}
                    className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-sm">ביטול</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-rose-600 transition-colors w-full">
                <Plus className="w-4 h-4" /> הוסף חוב חדש
              </button>
            )}
          </div>
        </>
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
  const isSavingRef = useRef(false);

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
    if (!editTitle.trim() || isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await onUpdate(id, { title: editTitle.trim() });
      setEditId(null);
    } catch { toast({ title: "שגיאה בעדכון", variant: "destructive" }); }
    finally { isSavingRef.current = false; }
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
                <div className="flex-1 flex items-center gap-1.5 mt-0.5"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}>
                  <input
                    ref={editRef}
                    value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="flex-1 text-sm border-b border-primary bg-transparent outline-none px-0.5"
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(task.id); if (e.key === "Escape") setEditId(null); }}
                    onBlur={() => { if (editTitle.trim()) saveEdit(task.id); }}
                  />
                  <button onMouseDown={e => e.preventDefault()} onClick={() => saveEdit(task.id)} className="p-1 rounded hover:bg-muted">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button onMouseDown={e => e.preventDefault()} onClick={() => setEditId(null)} className="text-xs text-muted-foreground hover:text-foreground px-1">ביטול</button>
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
function NotesCard({ notes, onAdd, onUpdate, onDelete, onReorder }: {
  notes: Note[];
  onAdd: (title: string, content: string) => Promise<void>;
  onUpdate: (id: number, data: Partial<Note>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReorder: (items: { id: number; sortOrder: number }[]) => Promise<void>;
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

  /* ── drag state ── */
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  const [draggedId, setDraggedId]   = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  /* ── view state ── */
  const [viewNote, setViewNote] = useState<Note | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    setLocalNotes([...notes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }));
  }, [notes]);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    didDragRef.current = true;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) setDragOverId(id);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverId(null);
    }
  };
  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const from = localNotes.findIndex(n => n.id === draggedId);
    const to   = localNotes.findIndex(n => n.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...localNotes];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const withOrder = reordered.map((n, i) => ({ ...n, sortOrder: i }));
    setLocalNotes(withOrder);
    setDraggedId(null);
    setDragOverId(null);
    onReorder(withOrder.map(n => ({ id: n.id, sortOrder: n.sortOrder }))).catch(() =>
      toast({ title: "שגיאה בשמירת סדר", variant: "destructive" })
    );
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setTimeout(() => { didDragRef.current = false; }, 100);
  };

  const handleNoteClick = (note: Note) => {
    if (didDragRef.current || editId === note.id) return;
    setViewNote(note);
    openEdit(note);
  };

  const openEdit = (n: Note) => {
    setEditId(n.id); setEditTitle(n.title || ""); setEditContent(n.content || "");
    setTimeout(() => editRef.current?.focus(), 50);
  };
  const saveEdit = async (id: number) => {
    try {
      await onUpdate(id, { title: editTitle, content: editContent });
      setEditId(null);
      if (viewNote?.id === id) {
        setViewNote(v => v ? { ...v, title: editTitle, content: editContent } : v);
      }
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
      {/* ── Header ── */}
      <div className={SECTION_HEAD}>
        {viewNote ? (
          <div className="flex items-center gap-2 w-full min-w-0">
            <button
              onClick={() => { setViewNote(null); setEditId(null); }}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold truncate">
              {viewNote.title || "פתק"}
            </span>
          </div>
        ) : (
          <div className={SECTION_TITLE}>
            <div className={ICON_WRAP("bg-yellow-100")}>
              <StickyNote className="w-4 h-4 text-yellow-600" />
            </div>
            פתקים
          </div>
        )}
      </div>

      {viewNote ? (
        /* ── Inline note edit/view ── */
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {/* Title */}
            <input
              ref={editRef}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="כותרת..."
              className="w-full text-sm font-bold bg-transparent border-b border-border/50 focus:border-primary outline-none pb-1 transition-colors"
            />
            {/* Content */}
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={Math.max(4, (editContent.match(/\n/g) || []).length + 3)}
              placeholder="תוכן הפתק..."
              className="w-full text-sm bg-transparent outline-none resize-none leading-relaxed text-foreground placeholder:text-muted-foreground/50"
            />
            {/* Action buttons — right below the content */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <button
                onClick={() => saveEdit(viewNote.id)}
                className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                שמור
              </button>
              <button
                onClick={() => { setViewNote(null); setEditId(null); }}
                className="text-sm px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                ביטול
              </button>
              <button
                onClick={() => { handleDelete(viewNote.id); setViewNote(null); }}
                disabled={deletingId === viewNote.id}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-rose-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-50 mr-auto">
                {deletingId === viewNote.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
                מחק
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Notes list ── */
        <>
          <div className="px-5 flex-1 pb-4 overflow-y-auto space-y-2">
            {localNotes.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">אין פתקים עדיין</p>
              </div>
            ) : (
              localNotes.map(note => (
                <div key={note.id}
                  draggable={editId !== note.id}
                  onDragStart={e => editId !== note.id && handleDragStart(e, note.id)}
                  onDragOver={e => handleDragOver(e, note.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, note.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "group rounded-xl p-3 border transition-all relative",
                    editId === note.id ? "cursor-default" : "cursor-pointer",
                    draggedId === note.id ? "opacity-40 scale-95" : "",
                    dragOverId === note.id
                      ? "border-primary/60 border-dashed ring-2 ring-primary/20"
                      : "border-border/40 hover:border-border",
                  )}
                  style={{ background: note.color ? `${note.color}40` : "#fef9c340" }}
                  onClick={() => handleNoteClick(note)}>

                  {note.isPinned && (
                    <Pin className="w-3 h-3 text-muted-foreground absolute top-2.5 left-8 rotate-45" />
                  )}

                  {editId === note.id ? (
                    <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
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
                    <>
                      {note.title && <p className="text-sm font-semibold mb-0.5 pr-1 line-clamp-1">{note.title}</p>}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {note.content || <span className="italic">פתק ריק</span>}
                      </p>
                      <div className="absolute top-2 left-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity px-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(note.id); }}
                        disabled={deletingId === note.id}
                        className="absolute top-2 left-6 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-all">
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
                    <button onClick={() => { setNoteTitle(""); setNoteContent(""); setOpen(false); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-xs">ביטול</button>
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
        </>
      )}
    </div>
  );
}
