import { useState } from "react";
import { 
  useGetExpenses, 
  useCreateExpense, 
  useUpdateExpense, 
  useDeleteExpense,
  getGetExpensesQueryKey,
  getGetDashboardSummaryQueryKey,
  type Expense 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatILS, formatILDate } from "@/lib/format";
import { Plus, Edit2, Trash2, Search, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["מזון", "תחבורה", "דיור", "בריאות", "חינוך", "בידור", "ביגוד", "חשמל ומים", "טלפון ואינטרנט", "ביטוח", "אחר"];

export default function Expenses() {
  const { data: expenses, isLoading } = useGetExpenses();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const createMut = useCreateExpense({ mutation: { onSuccess: invalidate }});
  const updateMut = useUpdateExpense({ mutation: { onSuccess: invalidate }});
  const deleteMut = useDeleteExpense({ mutation: { onSuccess: invalidate }});

  const filteredExpenses = expenses?.filter(e => 
    e.description.includes(searchTerm) || e.category.includes(searchTerm)
  ) || [];

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: Expense) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("האם אתה בטוח שברצונך למחוק הוצאה זו?")) {
      try {
        await deleteMut.mutateAsync({ id });
        toast({ title: "נמחק בהצלחה", description: "ההוצאה הוסרה מהרשימה." });
      } catch {
        toast({ title: "שגיאה", description: "ארעה שגיאה במחיקה.", variant: "destructive" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      amount: Number(formData.get("amount")),
      category: formData.get("category") as string,
      description: formData.get("description") as string,
      date: formData.get("date") as string,
      isRecurring: formData.get("isRecurring") === "on",
    };

    try {
      if (editingItem) {
        await updateMut.mutateAsync({ id: editingItem.id, data });
        toast({ title: "עודכן בהצלחה" });
      } else {
        await createMut.mutateAsync({ data });
        toast({ title: "נוצר בהצלחה" });
      }
      setIsDialogOpen(false);
    } catch {
      toast({ title: "שגיאה", description: "אנא בדוק את הנתונים ונסה שוב.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="הוצאות" 
        description="ניהול ומעקב אחר כל ההוצאות שלך"
        action={
          <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 gap-2">
            <Plus className="w-4 h-4" />
            הוסף הוצאה
          </Button>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="חיפוש הוצאה..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-9 bg-background border-border/50 rounded-xl"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 rounded-ts-xl">תאריך</th>
                <th className="px-6 py-4">קטגוריה</th>
                <th className="px-6 py-4">תיאור</th>
                <th className="px-6 py-4 text-end">סכום</th>
                <th className="px-6 py-4 rounded-te-xl w-24">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">טוען נתונים...</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Receipt className="w-12 h-12 mb-3 text-muted-foreground/30" />
                      <p>לא נמצאו הוצאות</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">{formatILDate(expense.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium border border-border">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground font-medium">{expense.description}</td>
                    <td className="px-6 py-4 text-end font-bold text-rose-600" dir="ltr">-{formatILS(expense.amount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEdit(expense)} className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(expense.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingItem ? "עריכת הוצאה" : "הוספת הוצאה חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="amount">סכום (₪)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingItem?.amount} className="rounded-xl" dir="ltr" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">קטגוריה</Label>
                <Select name="category" defaultValue={editingItem?.category || CATEGORIES[0]}>
                  <SelectTrigger className="rounded-xl" dir="rtl">
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">תיאור</Label>
                <Input id="description" name="description" required defaultValue={editingItem?.description} className="rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">תאריך</Label>
                <Input id="date" name="date" type="date" required defaultValue={editingItem?.date.split('T')[0] || new Date().toISOString().split('T')[0]} className="rounded-xl" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="isRecurring" name="isRecurring" defaultChecked={editingItem?.isRecurring} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <Label htmlFor="isRecurring" className="cursor-pointer">הוצאה קבועה (חוזרת)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">ביטול</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="rounded-xl bg-primary hover:bg-primary/90">
                {createMut.isPending || updateMut.isPending ? "שומר..." : "שמור"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
