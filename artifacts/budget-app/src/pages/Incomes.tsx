import { useState } from "react";
import { 
  useGetIncomes, 
  useCreateIncome, 
  useUpdateIncome, 
  useDeleteIncome,
  getGetIncomesQueryKey,
  getGetDashboardSummaryQueryKey,
  type Income 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatILS, formatILDate } from "@/lib/format";
import { Plus, Edit2, Trash2, Search, Landmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SOURCES = ["משכורת", "עסק עצמאי", "השקעות", "שכר דירה", "מתנות", "אחר"];

export default function Incomes() {
  const { data: incomes, isLoading } = useGetIncomes();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Income | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetIncomesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const createMut = useCreateIncome({ mutation: { onSuccess: invalidate }});
  const updateMut = useUpdateIncome({ mutation: { onSuccess: invalidate }});
  const deleteMut = useDeleteIncome({ mutation: { onSuccess: invalidate }});

  const filteredIncomes = incomes?.filter(i => 
    i.description.includes(searchTerm) || i.source.includes(searchTerm)
  ) || [];

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: Income) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("האם אתה בטוח שברצונך למחוק הכנסה זו?")) {
      try {
        await deleteMut.mutateAsync({ id });
        toast({ title: "נמחק בהצלחה" });
      } catch {
        toast({ title: "שגיאה", variant: "destructive" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      amount: Number(formData.get("amount")),
      source: formData.get("source") as string,
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
      toast({ title: "שגיאה", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="הכנסות" 
        description="מעקב אחר כל מקורות ההכנסה שלך"
        action={
          <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 gap-2">
            <Plus className="w-4 h-4" />
            הוסף הכנסה
          </Button>
        }
      />

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
          <div className="relative w-full max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="חיפוש הכנסה..." 
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
                <th className="px-6 py-4">תאריך</th>
                <th className="px-6 py-4">מקור</th>
                <th className="px-6 py-4">תיאור</th>
                <th className="px-6 py-4 text-end">סכום</th>
                <th className="px-6 py-4 w-24">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">טוען...</td></tr>
              ) : filteredIncomes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Landmark className="w-12 h-12 mb-3 text-muted-foreground/30" />
                      <p>לא נמצאו הכנסות</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncomes.map((income) => (
                  <tr key={income.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">{formatILDate(income.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium border border-border">
                        {income.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground font-medium">{income.description}</td>
                    <td className="px-6 py-4 text-end font-bold text-emerald-600" dir="ltr">+{formatILS(income.amount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEdit(income)} className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(income.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors">
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
              <DialogTitle>{editingItem ? "עריכת הכנסה" : "הוספת הכנסה חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="amount">סכום (₪)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingItem?.amount} className="rounded-xl" dir="ltr" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source">מקור</Label>
                <Select name="source" defaultValue={editingItem?.source || SOURCES[0]}>
                  <SelectTrigger className="rounded-xl" dir="rtl">
                    <SelectValue placeholder="בחר מקור" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {SOURCES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <input type="checkbox" id="isRecurring" name="isRecurring" defaultChecked={editingItem?.isRecurring} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600" />
                <Label htmlFor="isRecurring" className="cursor-pointer">הכנסה קבועה (חוזרת)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">ביטול</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                {createMut.isPending || updateMut.isPending ? "שומר..." : "שמור"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
