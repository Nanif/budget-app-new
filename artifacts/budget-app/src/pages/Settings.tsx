import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, Tag, Plus, Pencil, Trash2, Check, X, Loader2, Wallet, Star, CalendarRange } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCashFund } from "@/hooks/useCashFund";
import { useBudgetYear, BudgetYear } from "@/contexts/BudgetYearContext";

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

      {/* ══ Budget Years ═════════════════════════════════════════ */}
      <BudgetYearsSection />

      {/* ══ Cash Fund ════════════════════════════════════════════ */}
      <CashFundSection />

      {/* ══ Categories ═══════════════════════════════════════════ */}
      <CategoriesSection />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BUDGET YEARS SECTION
═══════════════════════════════════════════════════════════ */
function BudgetYearsSection() {
  const { toast } = useToast();
  const { years, createYear, updateYear, deleteYear, activateYear } = useBudgetYear();

  const [saving, setSaving]       = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);

  /* create */
  const [showCreate, setShowCreate] = useState(false);
  const nextYear = new Date().getFullYear() + 1;
  const [createForm, setCreateForm] = useState({
    name: `שנת תקציב ${nextYear}`,
    startDate: `${nextYear}-01-01`,
    endDate:   `${nextYear}-12-31`,
    totalBudget: "",
    tithePercentage: "10",
  });

  const handleCreate = async () => {
    if (!createForm.name || !createForm.startDate || !createForm.endDate) {
      toast({ title: "שגיאה", description: "נא למלא את כל השדות", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createYear({
        name: createForm.name,
        startDate: createForm.startDate,
        endDate:   createForm.endDate,
        totalBudget: createForm.totalBudget || "0",
        tithePercentage: createForm.tithePercentage || "10",
        isActive: false,
      });
      toast({ title: "שנת תקציב נוצרה", description: createForm.name });
      setShowCreate(false);
      setCreateForm({ name: `שנת תקציב ${nextYear}`, startDate: `${nextYear}-01-01`, endDate: `${nextYear}-12-31`, totalBudget: "", tithePercentage: "10" });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  /* edit */
  const [editTarget, setEditTarget] = useState<BudgetYear | null>(null);
  const [editForm, setEditForm] = useState({ name: "", startDate: "", endDate: "", totalBudget: "", tithePercentage: "" });

  const openEdit = (year: BudgetYear) => {
    setEditTarget(year);
    setEditForm({
      name: year.name,
      startDate: year.startDate?.split("T")[0] || "",
      endDate:   year.endDate?.split("T")[0] || "",
      totalBudget: String(year.totalBudget || ""),
      tithePercentage: String(year.tithePercentage || "10"),
    });
  };

  const handleEdit = async () => {
    if (!editTarget || !editForm.name) return;
    setSaving(true);
    try {
      await updateYear(editTarget.id, {
        name: editForm.name,
        startDate: editForm.startDate,
        endDate:   editForm.endDate,
        totalBudget: editForm.totalBudget || "0",
        tithePercentage: editForm.tithePercentage || "10",
        isActive: editTarget.isActive,
        userId: editTarget.userId,
      });
      toast({ title: "שנת תקציב עודכנה", description: editForm.name });
      setEditTarget(null);
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  /* delete */
  const [deleteTarget, setDeleteTarget] = useState<BudgetYear | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteYear(deleteTarget.id);
      toast({ title: "שנת תקציב נמחקה", description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  /* activate */
  const handleActivate = async (year: BudgetYear) => {
    if (year.isActive) return;
    setActivatingId(year.id);
    try {
      await activateYear(year.id);
      toast({ title: "שנה הופעלה", description: `${year.name} הוגדרה כשנה הפעילה` });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setActivatingId(null); }
  };

  const YearFormFields = ({ form, setForm }: { form: typeof createForm; setForm: React.Dispatch<React.SetStateAction<typeof createForm>> }) => (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>שם השנה</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="לדוגמה: שנת תקציב 2027" className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>תאריך התחלה</Label>
          <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>תאריך סיום</Label>
          <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>תקציב שנתי (₪)</Label>
          <Input type="number" value={form.totalBudget} onChange={e => setForm(f => ({ ...f, totalBudget: e.target.value }))} placeholder="0" className="rounded-xl" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>אחוז מעשר (%)</Label>
          <Input type="number" value={form.tithePercentage} onChange={e => setForm(f => ({ ...f, tithePercentage: e.target.value }))} min={0} max={100} className="rounded-xl" dir="ltr" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/30 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-primary" />
              <div>
                <CardTitle>שנות תקציב</CardTitle>
                <CardDescription className="mt-0.5">נהל, ערוך ומחק שנות תקציב</CardDescription>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> שנה חדשה
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/40">
            {years.map(year => (
              <li key={year.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{year.name}</span>
                    {year.isActive && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">פעיל</span>
                    )}
                  </div>
                  {(year.startDate || year.endDate) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {year.startDate?.split("T")[0]} — {year.endDate?.split("T")[0]}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!year.isActive && (
                    <button
                      onClick={() => handleActivate(year)}
                      title="הגדר כשנה פעילה"
                      className="p-1.5 rounded-lg hover:bg-amber-100 text-muted-foreground hover:text-amber-600 transition-colors"
                    >
                      {activatingId === year.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Star className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(year)}
                    title="עריכה"
                    className="p-1.5 rounded-lg hover:bg-blue-100 text-muted-foreground hover:text-blue-600 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {years.length > 1 && (
                    <button
                      onClick={() => setDeleteTarget(year)}
                      title="מחיקה"
                      className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>צור שנת תקציב חדשה</DialogTitle>
          </DialogHeader>
          <YearFormFields form={createForm} setForm={setCreateForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>ביטול</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              צור שנה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת שנת תקציב</DialogTitle>
          </DialogHeader>
          <YearFormFields form={editForm} setForm={setEditForm as any} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>ביטול</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת שנת תקציב</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את "{deleteTarget?.name}"?<br />
              פעולה זו תמחק את כל הנתונים המשויכים לשנה זו ולא ניתן לשחזרם.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} disabled={deletingId === cat.id}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                        {deletingId === cat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
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
