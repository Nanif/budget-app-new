import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, CheckCircle2, Circle, Pencil, Calendar, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type Task = {
  id: number; userId: number; title: string; description: string;
  priority: string; status: string; dueDate?: string | null;
  completedAt?: string | null; createdAt: string; updatedAt: string;
};

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const PRIORITY_LABEL: Record<string, string>  = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחוף" };
const PRIORITY_COLOR: Record<string, string>  = {
  low:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100   text-amber-700   border-amber-200",
  high:   "bg-rose-100    text-rose-700    border-rose-200",
  urgent: "bg-rose-200    text-rose-900    border-rose-300",
};
const PRIORITY_ICON: Record<string, React.ReactNode> = {
  low:    <Clock className="w-3 h-3" />,
  medium: <Clock className="w-3 h-3" />,
  high:   <AlertTriangle className="w-3 h-3" />,
  urgent: <AlertTriangle className="w-3 h-3" />,
};

const DEFAULT_FORM = { title: "", description: "", dueDate: "", priority: "medium", status: "open" };

export default function Reminders() {
  const { toast } = useToast();
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const [editItem,     setEditItem]     = useState<Task | null>(null);
  const [deleteId,     setDeleteId]     = useState<number | null>(null);
  const [form,         setForm]         = useState(DEFAULT_FORM);

  useEffect(() => {
    setIsLoading(true);
    apiFetch("/reminders")
      .then(setTasks)
      .catch(() => toast({ title: "שגיאה בטעינה", variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, []);

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
  });

  const openAdd = () => { setEditItem(null); setForm(DEFAULT_FORM); setIsDialogOpen(true); };
  const openEdit = (task: Task) => {
    setEditItem(task);
    setForm({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
      priority: task.priority,
      status: task.status,
    });
    setIsDialogOpen(true);
  };

  const handleToggle = async (task: Task) => {
    try {
      const updated = await apiFetch(`/reminders/${task.id}/toggle`, { method: "PATCH" });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updated } : t));
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/reminders/${deleteId}`, { method: "DELETE" });
      setTasks(prev => prev.filter(t => t.id !== deleteId));
      toast({ title: "המשימה נמחקה" });
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeleteId(null); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setIsSaving(true);
    const data = {
      title:       form.title.trim(),
      description: form.description.trim(),
      dueDate:     form.dueDate || null,
      priority:    form.priority,
      status:      editItem ? form.status : "open",
    };
    try {
      if (editItem) {
        const updated = await apiFetch(`/reminders/${editItem.id}`, { method: "PUT", body: JSON.stringify(data) });
        setTasks(prev => prev.map(t => t.id === editItem.id ? { ...t, ...updated } : t));
        toast({ title: "המשימה עודכנה" });
      } else {
        const created = await apiFetch("/reminders", { method: "POST", body: JSON.stringify(data) });
        setTasks(prev => [created, ...prev]);
        toast({ title: "משימה חדשה נוצרה" });
      }
      setIsDialogOpen(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const open = sortedTasks.filter(t => t.status !== "done");
  const done = sortedTasks.filter(t => t.status === "done");

  const TaskRow = ({ task }: { task: Task }) => (
    <div className={cn("px-5 py-4 flex items-start gap-4 hover:bg-muted/30 transition-colors group", task.status === "done" && "opacity-60")}>
      <button
        onClick={() => handleToggle(task)}
        className={cn("mt-0.5 shrink-0 transition-colors", task.status === "done" ? "text-primary" : "text-muted-foreground hover:text-primary")}
        title={task.status === "done" ? "סמן כפתוח" : "סמן כהושלם"}
      >
        {task.status === "done" ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold text-base leading-tight", task.status === "done" && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", PRIORITY_COLOR[task.priority] || "bg-gray-100 text-gray-700 border-gray-200")}>
            {PRIORITY_ICON[task.priority]}
            {PRIORITY_LABEL[task.priority] || task.priority}
          </span>
          {task.dueDate && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {new Date(task.dueDate).toLocaleDateString("he-IL")}
            </span>
          )}
          {task.status === "done" && task.completedAt && (
            <span className="text-xs text-emerald-600 font-medium">
              הושלם {new Date(task.completedAt).toLocaleDateString("he-IL")}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => openEdit(task)} className="p-2 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors" title="עריכה">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => setDeleteId(task.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="מחיקה">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const Section = ({ label, icon, items }: { label: string; icon: React.ReactNode; items: Task[] }) => (
    <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
      <div className="px-5 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>
      <div className="divide-y divide-border/50">
        {items.map(task => <TaskRow key={task.id} task={task} />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="משימות ותזכורות"
        description={tasks.length > 0 ? `${open.length} פתוחות · ${done.length} הושלמו` : undefined}
        action={
          <Button onClick={openAdd} className="rounded-xl shadow-sm gap-2">
            <Plus className="w-4 h-4" />משימה חדשה
          </Button>
        }
      />

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center text-muted-foreground animate-pulse">
          טוען משימות...
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/50 p-16 text-center">
          <CheckCircle2 className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">אין משימות</p>
          <p className="text-sm text-muted-foreground/60 mt-1">לחץ "משימה חדשה" כדי להתחיל</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <Section label="פתוחות" icon={<Circle className="w-4 h-4 text-muted-foreground" />} items={open} />
          )}
          {done.length > 0 && (
            <div className="opacity-75">
              <Section label="הושלמו" icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} items={done} />
            </div>
          )}
        </>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={o => { if (!o) setIsDialogOpen(false); }}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editItem ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>כותרת *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="שם המשימה..."
                  required
                  className="rounded-xl"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label>פרטים נוספים</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="תיאור, הערות..."
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>
              <div className={cn("grid gap-4", editItem ? "grid-cols-2" : "grid-cols-2")}>
                <div className="grid gap-2">
                  <Label>דחיפות</Label>
                  <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="low">נמוכה</SelectItem>
                      <SelectItem value="medium">בינונית</SelectItem>
                      <SelectItem value="high">גבוהה</SelectItem>
                      <SelectItem value="urgent">דחוף</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editItem ? (
                  <div className="grid gap-2">
                    <Label>סטטוס</Label>
                    <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="open">פתוח</SelectItem>
                        <SelectItem value="in_progress">בתהליך</SelectItem>
                        <SelectItem value="done">הושלם</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label>תאריך יעד</Label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>
              {editItem && (
                <div className="grid gap-2">
                  <Label>תאריך יעד</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={isSaving} className="rounded-xl">
                {isSaving ? "שומר..." : editItem ? "שמור שינויים" : "הוסף משימה"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת משימה</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את המשימה? לא ניתן לשחזר פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
