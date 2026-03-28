import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatILS, formatILDate } from "@/lib/format";
import { Plus, Edit2, Trash2, HeartHandshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type TitheEntry = {
  id: number; userId: number; budgetYearId: number; amount: number;
  recipient: string; description: string; date: string; isTithe: boolean;
  tithePercent?: number; receiptNumber?: string;
};
type Settings = { tithePercentage: number; incomeBaseForTithe: number };
type Summary = { totalCharity: number; totalIncome: number };

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

export default function Charity() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<TitheEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TitheEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ent, st, sum] = await Promise.all([
        apiFetch("/charity"), apiFetch("/settings"), apiFetch("/dashboard/summary"),
      ]);
      setEntries(ent); setSettings(st); setSummary(sum);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const totalGiven = summary?.totalCharity || 0;
  const incomeBase = settings?.incomeBaseForTithe || summary?.totalIncome || 0;
  const titheTarget = incomeBase * ((settings?.tithePercentage || 10) / 100);
  const progressPercent = titheTarget > 0 ? Math.min(100, (totalGiven / titheTarget) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      amount: Number(formData.get("amount")),
      recipient: formData.get("recipient") as string,
      description: formData.get("description") as string,
      date: formData.get("date") as string,
      isTithe: formData.get("isTithe") === "on",
    };
    try {
      if (editingItem) {
        await apiFetch(`/charity/${editingItem.id}`, { method: "PUT", body: JSON.stringify(data) });
      } else {
        await apiFetch("/charity", { method: "POST", body: JSON.stringify(data) });
      }
      toast({ title: "נשמר בהצלחה" });
      setIsDialogOpen(false);
      await loadData();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("מחיקת רישום צדקה?")) return;
    try {
      await apiFetch(`/charity/${id}`, { method: "DELETE" });
      toast({ title: "נמחק" });
      await loadData();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="צדקה ומעשרות"
        description="מעקב אחר תרומות ומעשר כספים"
        action={
          <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 gap-2">
            <Plus className="w-4 h-4" />הוסף תרומה
          </Button>
        }
      />

      <Card className="border-blue-100 bg-blue-50/30 overflow-hidden shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h3 className="font-bold text-lg text-blue-900">יעד מעשר חודשי</h3>
              <p className="text-sm text-blue-700">לפי {settings?.tithePercentage || 10}% מההכנסות ({formatILS(incomeBase)})</p>
            </div>
            <div className="text-end">
              <span className="text-2xl font-bold text-blue-700">{formatILS(totalGiven)}</span>
              <span className="text-blue-500 mx-2">מתוך</span>
              <span className="text-lg font-medium text-blue-800">{formatILS(titheTarget)}</span>
            </div>
          </div>
          <Progress value={progressPercent} className="h-3 bg-blue-100 [&>div]:bg-blue-600" />
        </CardContent>
      </Card>

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">תאריך</th>
                <th className="px-6 py-4">מוסד/אדם</th>
                <th className="px-6 py-4">תיאור</th>
                <th className="px-6 py-4">סוג</th>
                <th className="px-6 py-4 text-end">סכום</th>
                <th className="px-6 py-4 w-24">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">טוען...</td></tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <HeartHandshake className="w-12 h-12 mb-3 mx-auto text-muted-foreground/30" />
                    <p>לא נמצאו תרומות</p>
                  </td>
                </tr>
              ) : entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">{formatILDate(entry.date)}</td>
                  <td className="px-6 py-4 font-medium">{entry.recipient}</td>
                  <td className="px-6 py-4 text-muted-foreground">{entry.description}</td>
                  <td className="px-6 py-4">
                    {entry.isTithe
                      ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">מעשר</span>
                      : <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">תרומה רגילה</span>}
                  </td>
                  <td className="px-6 py-4 text-end font-bold text-blue-600" dir="ltr">{formatILS(entry.amount)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingItem(entry); setIsDialogOpen(true); }} className="text-muted-foreground hover:text-primary p-1"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(entry.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{editingItem ? "עריכת תרומה" : "הוספת תרומה חדשה"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label>סכום (₪)</Label>
                <Input name="amount" type="number" step="0.01" required defaultValue={editingItem?.amount} className="rounded-xl" dir="ltr" />
              </div>
              <div className="grid gap-2">
                <Label>למי נתרם?</Label>
                <Input name="recipient" required defaultValue={editingItem?.recipient} className="rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label>הערות / תיאור</Label>
                <Input name="description" defaultValue={editingItem?.description} className="rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label>תאריך</Label>
                <Input name="date" type="date" required defaultValue={editingItem?.date?.split('T')[0] || new Date().toISOString().split('T')[0]} className="rounded-xl" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="isTithe" name="isTithe" defaultChecked={editingItem ? editingItem.isTithe : true} className="w-4 h-4 rounded text-blue-600" />
                <Label htmlFor="isTithe" className="cursor-pointer font-medium text-blue-900">זהו כסף מעשר</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">{isSaving ? "שומר..." : "שמור"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
