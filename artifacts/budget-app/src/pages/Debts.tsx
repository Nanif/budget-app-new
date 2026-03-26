import { useState } from "react";
import { 
  useGetDebts, 
  useCreateDebt, 
  useUpdateDebt, 
  useDeleteDebt,
  getGetDebtsQueryKey,
  getGetDashboardSummaryQueryKey,
  type Debt 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatILS, formatILDate } from "@/lib/format";
import { Plus, Edit2, Trash2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Debts() {
  const { data: debts, isLoading } = useGetDebts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Debt | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDebtsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const createMut = useCreateDebt({ mutation: { onSuccess: invalidate }});
  const updateMut = useUpdateDebt({ mutation: { onSuccess: invalidate }});
  const deleteMut = useDeleteDebt({ mutation: { onSuccess: invalidate }});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      type: formData.get("type") as "owed_to_me" | "i_owe",
      totalAmount: Number(formData.get("totalAmount")),
      remainingAmount: Number(formData.get("remainingAmount")),
      dueDate: formData.get("dueDate") as string || null,
      status: formData.get("status") as "active" | "paid",
      notes: formData.get("notes") as string || "",
    };

    if (editingItem) {
      await updateMut.mutateAsync({ id: editingItem.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    setIsDialogOpen(false);
    toast({ title: "נשמר בהצלחה" });
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="חובות והלוואות" 
        description="מעקב אחר כספים שאתה חייב וכספים שחייבים לך"
        action={
          <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }} className="rounded-xl shadow-lg gap-2">
            <Plus className="w-4 h-4" />
            הוסף חוב
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="h-48 bg-muted rounded-2xl animate-pulse" />
        ) : debts?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card rounded-2xl border border-border/50">
            <CreditCard className="w-12 h-12 mb-3 mx-auto text-muted-foreground/30" />
            <p>אין חובות פעילים במערכת</p>
          </div>
        ) : (
          debts?.map((debt) => (
            <div key={debt.id} className={cn(
              "rounded-2xl p-6 border shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md group",
              debt.status === 'paid' ? "bg-muted/30 border-border opacity-70" :
              debt.type === 'i_owe' ? "bg-rose-50/50 border-rose-100" : "bg-emerald-50/50 border-emerald-100"
            )}>
              <div className="absolute top-4 end-4 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                <button onClick={() => { setEditingItem(debt); setIsDialogOpen(true); }} className="p-1.5 bg-white rounded-md shadow-sm text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => { if(confirm("למחוק חוב זה?")) deleteMut.mutate({ id: debt.id }); }} className="p-1.5 bg-white rounded-md shadow-sm text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded",
                    debt.type === 'i_owe' ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {debt.type === 'i_owe' ? "אני חייב ל..." : "חייבים לי"}
                  </span>
                  {debt.status === 'paid' && <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">שולם במלואו</span>}
                </div>
                <h3 className="text-xl font-bold text-foreground">{debt.name}</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">נותר לשלם</span>
                    <span className="font-bold" dir="ltr">{formatILS(debt.remainingAmount)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full", debt.type === 'i_owe' ? "bg-rose-500" : "bg-emerald-500")}
                      style={{ width: `${Math.max(0, 100 - (debt.remainingAmount / debt.totalAmount * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                    <span>מתוך {formatILS(debt.totalAmount)}</span>
                    {debt.dueDate && <span>עד: {formatILDate(debt.dueDate)}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingItem ? "עריכת חוב" : "הוספת חוב חדש"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">שם הגורם</Label>
                <Input id="name" name="name" required defaultValue={editingItem?.name} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">סוג</Label>
                  <Select name="type" defaultValue={editingItem?.type || "i_owe"}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="i_owe">אני חייב</SelectItem>
                      <SelectItem value="owed_to_me">חייבים לי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">סטטוס</Label>
                  <Select name="status" defaultValue={editingItem?.status || "active"}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="active">פעיל</SelectItem>
                      <SelectItem value="paid">שולם סופית</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="totalAmount">סכום כולל (₪)</Label>
                  <Input id="totalAmount" name="totalAmount" type="number" required defaultValue={editingItem?.totalAmount} className="rounded-xl" dir="ltr" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="remainingAmount">יתרה לתשלום (₪)</Label>
                  <Input id="remainingAmount" name="remainingAmount" type="number" required defaultValue={editingItem?.remainingAmount} className="rounded-xl" dir="ltr" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">תאריך יעד (אופציונלי)</Label>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={editingItem?.dueDate?.split('T')[0] || ''} className="rounded-xl" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="rounded-xl w-full">שמור</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
