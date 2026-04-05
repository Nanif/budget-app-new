import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, Tag, Plus, Pencil, Trash2, Check, X, Loader2, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCashFund } from "@/hooks/useCashFund";
import { useBudgetYear } from "@/contexts/BudgetYearContext";

/* ── Types ─────────────────────────────────────────────────── */
type AppSettings = {
  id: number; userId: number; currency: string; locale: string; userName: string;
  monthlyBudget: number; tithePercentage: number; incomeBaseForTithe: number;
  activeBudgetYearId?: number | null; dateFormat: string; firstDayOfWeek: number;
  showDecimal: boolean; darkMode: boolean;
};
type Category = {
  id: number; name: string; color: string; type: string; isSystem: boolean; isActive: boolean;
};
type FundSummary = {
  id: number; name: string; fundBehavior: string; monthlyAllocation: number;
};

const COLOR_SWATCHES = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1",
  "#8b5cf6","#a855f7","#ec4899","#f43f5e","#64748b","#94a3b8",
];

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiFetch("/settings").then(setSettings).finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      userName: formData.get("userName") as string,
      currency: "ILS",
      monthlyBudget: Number(formData.get("monthlyBudget")),
      incomeBaseForTithe: Number(formData.get("incomeBaseForTithe")),
      tithePercentage: Number(formData.get("tithePercentage")),
    };
    try {
      const updated = await apiFetch("/settings", { method: "PUT", body: JSON.stringify(data) });
      setSettings(updated);
      toast({ title: "ההגדרות נשמרו בהצלחה!" });
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  if (isLoading) return <div className="p-8 text-center">טוען הגדרות...</div>;

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      <PageHeader title="הגדרות מערכת" description="התאם אישית את העדפות המערכת שלך" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle>פרטים אישיים</CardTitle>
            <CardDescription>איך תרצה שהמערכת תקרא לך?</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="max-w-md grid gap-2">
              <Label htmlFor="userName">שם תצוגה</Label>
              <Input id="userName" name="userName" defaultValue={settings?.userName} className="rounded-xl" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle>הגדרות תקציב חודשי</CardTitle>
            <CardDescription>יעדי התקציב שלך</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="max-w-md grid gap-2">
              <Label htmlFor="monthlyBudget">יעד תקציב הוצאות חודשי (₪)</Label>
              <Input id="monthlyBudget" name="monthlyBudget" type="number" defaultValue={settings?.monthlyBudget} className="rounded-xl" dir="ltr" />
            </div>
            <div className="max-w-md grid gap-2">
              <Label>מטבע ברירת מחדל</Label>
              <Input value="₪ שקל חדש (ILS)" readOnly disabled className="rounded-xl bg-muted" />
              <p className="text-xs text-muted-foreground">כרגע נתמך שקל חדש (₪) בלבד.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm border-blue-100">
          <CardHeader className="bg-blue-50/50 border-b border-blue-100">
            <CardTitle className="text-blue-900">מעשר כספים</CardTitle>
            <CardDescription className="text-blue-700">הגדרות לחישוב אוטומטי של מעשר</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="max-w-md grid gap-2">
              <Label htmlFor="incomeBaseForTithe">הכנסה חודשית לחישוב מעשר (₪)</Label>
              <Input id="incomeBaseForTithe" name="incomeBaseForTithe" type="number" defaultValue={settings?.incomeBaseForTithe} className="rounded-xl border-blue-200 focus-visible:ring-blue-500" dir="ltr" />
              <p className="text-xs text-muted-foreground">הזן את משכורת הנטו שלך. אם מוגדר 0, יחושב לפי סך ההכנסות הרשומות.</p>
            </div>
            <div className="max-w-md grid gap-2">
              <Label htmlFor="tithePercentage">אחוז הפרשה לצדקה (%)</Label>
              <Input id="tithePercentage" name="tithePercentage" type="number" step="0.1" defaultValue={settings?.tithePercentage} className="rounded-xl border-blue-200 focus-visible:ring-blue-500" dir="ltr" />
              <p className="text-xs text-muted-foreground">בדרך כלל 10% (מעשר) או 20% (חומש).</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isSaving} className="rounded-xl shadow-sm gap-2">
            <Save className="w-4 h-4" />{isSaving ? "שומר..." : "שמור הגדרות"}
          </Button>
        </div>
      </form>

      {/* ══ Cash Fund ════════════════════════════════════════════ */}
      <CashFundSection />

      {/* ══ Categories ═══════════════════════════════════════════ */}
      <CategoriesSection />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CASH FUND SECTION
═══════════════════════════════════════════════════════════ */
function CashFundSection() {
  const { activeBid } = useBudgetYear();
  const { cashFundId, setCashFundId } = useCashFund();
  const [funds, setFunds] = useState<FundSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBid) return;
    setLoading(true);
    apiFetch(`/funds?bid=${activeBid}`)
      .then((data: FundSummary[]) => setFunds(data.filter(f => f.fundBehavior === "cash_monthly")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeBid]);

  if (loading || funds.length === 0) return null;

  const activeFund = funds.find(f => f.id === cashFundId) ?? funds[0];

  return (
    <Card className="border-amber-100 shadow-sm">
      <CardHeader className="bg-amber-50/50 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-600" />
          <div>
            <CardTitle className="text-amber-900">קופת שוטף נוכחית</CardTitle>
            <CardDescription className="text-amber-700">בחר איזו קופה תוצג בדשבורד</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          {funds.map(f => (
            <button
              key={f.id}
              onClick={() => setCashFundId(f.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                (cashFundId === f.id || (!cashFundId && activeFund?.id === f.id))
                  ? "border-amber-500 bg-amber-100 text-amber-900"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   CATEGORIES SECTION
═══════════════════════════════════════════════════════════ */
function CategoriesSection() {
  const { toast } = useToast();
  const [cats, setCats]           = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editId, setEditId]       = useState<number | null>(null);
  const [editName, setEditName]   = useState("");
  const [editColor, setEditColor] = useState("#94a3b8");
  const [addOpen, setAddOpen]     = useState(false);
  const [newName, setNewName]     = useState("");
  const [newColor, setNewColor]   = useState("#94a3b8");
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/categories?all=true");
      setCats((data as Category[]).filter(c => c.isActive));
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openEdit = (c: Category) => {
    setEditId(c.id); setEditName(c.name); setEditColor(c.color); setAddOpen(false);
  };
  const cancelEdit = () => { setEditId(null); };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const cat = cats.find(c => c.id === id)!;
      await apiFetch(`/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), color: editColor, type: cat.type, isActive: true }),
      });
      setCats(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim(), color: editColor } : c));
      setEditId(null);
      toast({ title: "קטגוריה עודכנה" });
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await apiFetch("/categories", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), color: newColor, type: "expense", isActive: true, sortOrder: cats.length }),
      });
      setCats(prev => [...prev, created]);
      setNewName(""); setNewColor("#94a3b8"); setAddOpen(false);
      toast({ title: "קטגוריה נוספה" });
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const cat = cats.find(c => c.id === id);
    if (cat?.isSystem) { toast({ title: "לא ניתן למחוק קטגוריה מובנית", variant: "destructive" }); return; }
    setDeletingId(id);
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      setCats(prev => prev.filter(c => c.id !== id));
      toast({ title: "קטגוריה נמחקה" });
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="bg-muted/30 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <div>
              <CardTitle>קטגוריות הוצאות</CardTitle>
              <CardDescription className="mt-0.5">
                קטגוריות משמשות רק לסיווג הוצאות בקופת <span className="font-medium text-violet-600">מעגל השנה</span>
              </CardDescription>
            </div>
          </div>
          <button
            onClick={() => { setAddOpen(p => !p); setEditId(null); setNewName(""); setNewColor("#94a3b8"); }}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> קטגוריה חדשה
          </button>
        </div>
      </CardHeader>

      {/* Add row */}
      {addOpen && (
        <div className="px-5 py-3 border-b border-border/40 bg-muted/20 space-y-3">
          <div className="flex items-center gap-3">
            <Input
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="שם קטגוריה..." className="flex-1 h-8 text-sm rounded-lg"
              autoFocus onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAddOpen(false); }}
            />
            <button onClick={handleAdd} disabled={saving || !newName.trim()}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
        </div>
      )}

      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : cats.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">אין קטגוריות — לחץ "קטגוריה חדשה" להוסיף</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {cats.map(cat => (
              <li key={cat.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-muted/20 transition-colors">
                {editId === cat.id ? (
                  /* Edit mode */
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: editColor }} />
                      <Input
                        value={editName} onChange={e => setEditName(e.target.value)}
                        className="flex-1 h-7 text-sm rounded-lg"
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") handleUpdate(cat.id); if (e.key === "Escape") cancelEdit(); }}
                      />
                      <button onClick={() => handleUpdate(cat.id)} disabled={saving}
                        className="p-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button onClick={cancelEdit} className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className={cn("flex-1 text-sm font-medium", !cat.isActive && "text-muted-foreground line-through")}>
                      {cat.name}
                    </span>
                    {cat.isSystem && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">מובנית</span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!cat.isSystem && (
                        <button onClick={() => handleDelete(cat.id)} disabled={deletingId === cat.id}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                          {deletingId === cat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Color Picker ────────────────────────────────────────── */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_SWATCHES.map(c => (
        <button
          key={c} type="button"
          onClick={() => onChange(c)}
          className={cn(
            "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
            value === c ? "border-foreground scale-110" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
