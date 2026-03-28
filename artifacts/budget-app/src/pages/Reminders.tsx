import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Task = {
  id: number; userId: number; title: string; description: string;
  priority: string; status: string; dueDate?: string | null;
  completedAt?: string | null; createdAt: string; updatedAt: string;
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export default function Reminders() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    try { setTasks(await apiFetch("/reminders")); }
    catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadTasks(); }, []);

  const sortedTasks = tasks.slice().sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
  });

  const handleToggle = async (task: Task) => {
    try {
      await apiFetch(`/reminders/${task.id}/toggle`, { method: "PATCH" });
      await loadTasks();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("למחוק משימה?")) return;
    try {
      await apiFetch(`/reminders/${id}`, { method: "DELETE" });
      toast({ title: "נמחק" });
      await loadTasks();
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string || "",
      dueDate: formData.get("dueDate") as string || null,
      priority: formData.get("priority") as string,
      status: "open",
    };
    try {
      await apiFetch("/reminders", { method: "POST", body: JSON.stringify(data) });
      toast({ title: "משימה נוצרה" });
      setIsDialogOpen(false);
      await loadTasks();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const priorityLabel: Record<string, string> = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחוף" };
  const priorityColor: Record<string, string> = { low: "bg-emerald-100 text-emerald-700", medium: "bg-amber-100 text-amber-700", high: "bg-rose-100 text-rose-700", urgent: "bg-rose-200 text-rose-900" };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="משימות ותזכורות"
        action={
          <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl shadow-lg gap-2">
            <Plus className="w-4 h-4" />משימה חדשה
          </Button>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">טוען משימות...</div>
        ) : (
          <div className="divide-y divide-border/50">
            {sortedTasks.map((task) => (
              <div key={task.id} className={cn("p-4 sm:px-6 flex items-start sm:items-center gap-4 hover:bg-muted/30 transition-colors group", task.status === 'done' && "opacity-60")}>
                <button onClick={() => handleToggle(task)} className={cn("mt-1 sm:mt-0 shrink-0 transition-colors", task.status === 'done' ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                  {task.status === 'done' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-semibold text-lg transition-all", task.status === 'done' && "line-through text-muted-foreground")}>{task.title}</p>
                  {task.description && <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs font-medium">
                    <span className={cn("px-2 py-0.5 rounded-full", priorityColor[task.priority] || "bg-gray-100 text-gray-700")}>
                      {priorityLabel[task.priority] || task.priority}
                    </span>
                    {task.dueDate && <span className="text-muted-foreground">תאריך יעד: {new Date(task.dueDate).toLocaleDateString('he-IL')}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(task.id)} className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-destructive/10">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            {sortedTasks.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">אין משימות. הכל נקי! ✨</div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>משימה חדשה</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>כותרת</Label>
                <Input name="title" required className="rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label>פרטים נוספים (אופציונלי)</Label>
                <Input name="description" className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>דחיפות</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="low">נמוכה</SelectItem>
                      <SelectItem value="medium">בינונית</SelectItem>
                      <SelectItem value="high">גבוהה</SelectItem>
                      <SelectItem value="urgent">דחוף</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>תאריך יעד (אופציונלי)</Label>
                  <Input name="dueDate" type="date" className="rounded-xl" />
                </div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={isSaving} className="rounded-xl w-full">{isSaving ? "שומר..." : "שמור"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
