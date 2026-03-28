import { useState, useEffect } from "react";
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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Category = { id: number; name: string; color: string; icon: string; type: string };
type Expense = {
  id: number; userId: number; budgetYearId: number; categoryId: number | null; fundId: number | null;
  amount: number; description: string; date: string; paymentMethod: string; isRecurring: boolean;
  createdAt: string; updatedAt: string; categoryName?: string; categoryColor?: string; categoryIcon?: string;
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

export default function Expenses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const expenseCategories = categories.filter(c => c.type === "expense" || c.type === "both");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exp, cats] = await Promise.all([apiFetch("/expenses"), apiFetch("/categories")]);
      setExpenses(exp);
      setCategories(cats);
    } catch { toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const filteredExpenses = expenses.filter(e =>
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.categoryName || "").includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const categoryId = formData.get("categoryId");
    const data = {
      amount: Number(formData.get("amount")),
      categoryId: categoryId ? Number(categoryId) : null,
      description: formData.get("description") as string,
      date: formData.get("date") as string,
      paymentMethod: formData.get("paymentMethod") as string || "cash",
      isRecurring: formData.get("isRecurring") === "on",
    };
    try {
      if (editingItem) {
        await apiFetch(`/expenses/${editingItem.id}`, { method: "PUT", body: JSON.stringify(data) });
        toast({ title: "עודכן בהצלחה" });
      } else {
        await apiFetch("/expenses", { method: "POST", body: JSON.stringify(data) });
        toast({ title: "נוצר בהצלחה" });
      }
      setIsDialogOpen(false);
      await loadData();
    } catch {
      toast({ title: "שגיאה", description: "אנא בדוק את הנתונים ונסה שוב.", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק הוצאה זו?")) return;
    try {
      await apiFetch(`/expenses/${id}`, { method: "DELETE" });
      toast({ title: "נמחק בהצלחה" });
      await loadData();
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="הוצאות"
        description="ניהול ומעקב אחר כל ההוצאות שלך"
        action={
          <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 gap-2">
            <Plus className="w-4 h-4" />הוסף הוצאה
          </Button>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="חיפוש הוצאה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="ps-9 bg-background border-border/50 rounded-xl" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">תאריך</th>
                <th className="px-6 py-4">קטגוריה</th>
                <th className="px-6 py-4">תיאור</th>
                <th className="px-6 py-4">אמצעי תשלום</th>
                <th className="px-6 py-4 text-end">סכום</th>
                <th className="px-6 py-4 w-24">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">טוען נתונים...</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center"><Receipt className="w-12 h-12 mb-3 text-muted-foreground/30" /><p>לא נמצאו הוצאות</p></div>
                  </td>
                </tr>
              ) : filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">{formatILDate(expense.date)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expense.categoryName ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium text-white" style={{ backgroundColor: expense.categoryColor || '#94a3b8' }}>
                        {expense.categoryName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">ללא קטגוריה</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-foreground font-medium">{expense.description}</td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {{ cash: 'מזומן', credit: 'כרטיס אשראי', bank: 'העברה בנקאית', other: 'אחר' }[expense.paymentMethod] || expense.paymentMethod}
                  </td>
                  <td className="px-6 py-4 text-end font-bold text-rose-600" dir="ltr">-{formatILS(expense.amount)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingItem(expense); setIsDialogOpen(true); }} className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(expense.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[460px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{editingItem ? "עריכת הוצאה" : "הוספת הוצאה חדשה"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>סכום (₪)</Label>
                  <Input name="amount" type="number" step="0.01" required defaultValue={editingItem?.amount} className="rounded-xl" dir="ltr" />
                </div>
                <div className="grid gap-2">
                  <Label>תאריך</Label>
                  <Input name="date" type="date" required defaultValue={editingItem?.date?.split('T')[0] || new Date().toISOString().split('T')[0]} className="rounded-xl" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>קטגוריה</Label>
                <Select name="categoryId" defaultValue={editingItem?.categoryId?.toString() || ""}>
                  <SelectTrigger className="rounded-xl" dir="rtl"><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {expenseCategories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>תיאור</Label>
                <Input name="description" required defaultValue={editingItem?.description} className="rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label>אמצעי תשלום</Label>
                <Select name="paymentMethod" defaultValue={editingItem?.paymentMethod || "cash"}>
                  <SelectTrigger className="rounded-xl" dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="cash">מזומן</SelectItem>
                    <SelectItem value="credit">כרטיס אשראי</SelectItem>
                    <SelectItem value="bank">העברה בנקאית</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isRecurring" name="isRecurring" defaultChecked={editingItem?.isRecurring} className="w-4 h-4 rounded border-gray-300 text-primary" />
                <Label htmlFor="isRecurring" className="cursor-pointer">הוצאה קבועה (חוזרת)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">ביטול</Button>
              <Button type="submit" disabled={isSaving} className="rounded-xl bg-primary hover:bg-primary/90">{isSaving ? "שומר..." : "שמור"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
