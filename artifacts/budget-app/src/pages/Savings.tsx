import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatILS } from "@/lib/format";
import { Plus, Edit2, Trash2, PiggyBank, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Asset = {
  id: number; userId: number; name: string; type: string; category: string;
  currentAmount: number; targetAmount?: number | null; currency: string;
  isActive: boolean; notes?: string; createdAt: string; updatedAt: string;
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

export default function Savings() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Asset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadAssets = async () => {
    setIsLoading(true);
    try { setAssets(await apiFetch("/savings")); }
    catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadAssets(); }, []);

  const totalAssets = assets.reduce((acc, a) => acc + a.currentAmount, 0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const targetVal = formData.get("targetAmount");
    const data = {
      name: formData.get("name") as string,
      category: formData.get("category") as string || "כללי",
      type: formData.get("type") as string,
      currentAmount: Number(formData.get("currentAmount")),
      targetAmount: targetVal && String(targetVal).trim() !== "" ? Number(targetVal) : null,
      notes: formData.get("notes") as string || "",
    };
    try {
      if (editingItem) {
        await apiFetch(`/savings/${editingItem.id}`, { method: "PUT", body: JSON.stringify(data) });
        toast({ title: "עודכן בהצלחה" });
      } else {
        await apiFetch("/savings", { method: "POST", body: JSON.stringify(data) });
        toast({ title: "נוצר בהצלחה" });
      }
      setIsDialogOpen(false);
      await loadAssets();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const typeLabel: Record<string, string> = { savings: 'חיסכון', investment: 'השקעה', asset: 'נכס קבוע' };

  return (
    <div className="space-y-6">
      <PageHeader
        title="חסכונות ונכסים"
        description={`סך כל הנכסים והחסכונות: ${formatILS(totalAssets)}`}
        action={
          <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 gap-2">
            <Plus className="w-4 h-4" />הוסף חיסכון/נכס
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="h-40 bg-muted rounded-2xl animate-pulse" />
        ) : assets.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card rounded-2xl border border-border/50">
            <PiggyBank className="w-12 h-12 mb-3 mx-auto text-muted-foreground/30" />
            <p>אין נכסים וחסכונות. הוסף את הראשון!</p>
          </div>
        ) : assets.map((asset) => {
          const progress = asset.targetAmount ? Math.min(100, (asset.currentAmount / asset.targetAmount) * 100) : 0;
          return (
            <div key={asset.id} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <PiggyBank className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{asset.name}</h3>
                    <p className="text-xs text-muted-foreground">{typeLabel[asset.type] || asset.type} • {asset.category}</p>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button onClick={() => { setEditingItem(asset); setIsDialogOpen(true); }} className="p-1 text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={async () => { if (confirm("למחוק?")) { await apiFetch(`/savings/${asset.id}`, { method: "DELETE" }); await loadAssets(); } }} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="text-2xl font-display font-bold text-foreground mb-4" dir="ltr">{formatILS(asset.currentAmount)}</div>

              {asset.targetAmount && (
                <div className="space-y-2 bg-muted/30 p-3 rounded-xl border border-border/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> יעד: {formatILS(asset.targetAmount)}</span>
                    <span className="font-medium text-indigo-600">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{editingItem ? "עריכת נכס" : "הוספת נכס"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>שם החיסכון/נכס</Label>
                <Input name="name" required defaultValue={editingItem?.name} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>סוג</Label>
                  <Select name="type" defaultValue={editingItem?.type || "savings"}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="savings">חיסכון רגיל</SelectItem>
                      <SelectItem value="investment">השקעה / קופת גמל</SelectItem>
                      <SelectItem value="asset">נכס קבוע (נדלן, רכב)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>קטגוריה</Label>
                  <Input name="category" defaultValue={editingItem?.category || 'כללי'} className="rounded-xl" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>שווי/יתרה נוכחית (₪)</Label>
                <Input name="currentAmount" type="number" required defaultValue={editingItem?.currentAmount} className="rounded-xl" dir="ltr" />
              </div>
              <div className="grid gap-2">
                <Label>סכום יעד (אופציונלי)</Label>
                <Input name="targetAmount" type="number" defaultValue={editingItem?.targetAmount ?? ''} className="rounded-xl" dir="ltr" />
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 w-full rounded-xl">{isSaving ? "שומר..." : "שמור"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
