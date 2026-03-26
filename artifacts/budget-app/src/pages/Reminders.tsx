import { useState } from "react";
import { 
  useGetReminders, 
  useCreateReminder, 
  useUpdateReminder, 
  useDeleteReminder,
  useToggleReminder,
  getGetRemindersQueryKey,
  getGetDashboardSummaryQueryKey,
  type Reminder 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Reminders() {
  const { data: reminders, isLoading } = useGetReminders();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetRemindersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const createMut = useCreateReminder({ mutation: { onSuccess: invalidate }});
  const deleteMut = useDeleteReminder({ mutation: { onSuccess: invalidate }});
  const toggleMut = useToggleReminder({ mutation: { onSuccess: invalidate }});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string || "",
      dueDate: formData.get("dueDate") as string || null,
      priority: formData.get("priority") as "low" | "medium" | "high",
      isCompleted: false,
    };
    await createMut.mutateAsync({ data });
    setIsDialogOpen(false);
  };

  const sortedReminders = reminders?.slice().sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    // Priority weight: high=3, medium=2, low=1
    const pWeight = { high: 3, medium: 2, low: 1 };
    if (pWeight[a.priority] !== pWeight[b.priority]) return pWeight[b.priority] - pWeight[a.priority];
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader 
        title="משימות ותזכורות" 
        action={
          <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl shadow-lg gap-2">
            <Plus className="w-4 h-4" />
            משימה חדשה
          </Button>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">טוען משימות...</div>
        ) : (
          <div className="divide-y divide-border/50">
            {sortedReminders?.map((rem) => (
              <div key={rem.id} className={cn("p-4 sm:px-6 flex items-start sm:items-center gap-4 hover:bg-muted/30 transition-colors group", rem.isCompleted && "opacity-60")}>
                <button 
                  onClick={() => toggleMut.mutate({ id: rem.id })}
                  className={cn("mt-1 sm:mt-0 shrink-0 transition-colors", rem.isCompleted ? "text-primary" : "text-muted-foreground hover:text-primary")}
                >
                  {rem.isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <p className={cn("font-semibold text-lg transition-all", rem.isCompleted && "line-through text-muted-foreground")}>{rem.title}</p>
                  {rem.description && <p className="text-sm text-muted-foreground mt-0.5">{rem.description}</p>}
                  
                  <div className="flex items-center gap-3 mt-2 text-xs font-medium">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full",
                      rem.priority === 'high' ? "bg-rose-100 text-rose-700" :
                      rem.priority === 'medium' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      דחיפות {rem.priority === 'high' ? "גבוהה" : rem.priority === 'medium' ? "בינונית" : "נמוכה"}
                    </span>
                    {rem.dueDate && (
                      <span className="text-muted-foreground">תאריך יעד: {new Date(rem.dueDate).toLocaleDateString('he-IL')}</span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => { if(confirm("למחוק משימה?")) deleteMut.mutate({ id: rem.id }); }}
                  className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-destructive/10"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            {sortedReminders?.length === 0 && (
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
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>תאריך יעד (אופציונלי)</Label>
                  <Input name="dueDate" type="date" className="rounded-xl" />
                </div>
              </div>
            </div>
            <DialogFooter><Button type="submit" className="rounded-xl w-full">שמור</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
