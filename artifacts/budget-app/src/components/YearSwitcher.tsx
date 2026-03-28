import { useState } from "react";
import { useBudgetYear, BudgetYear } from "@/contexts/BudgetYearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, ChevronDown, Plus, Calendar, Loader2, Pencil, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function YearSwitcher() {
  const { years, activeBid, activeYear, setViewedYear, createYear, updateYear, deleteYear, activateYear } = useBudgetYear();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── create dialog ───────────────────────────────────────── */
  const [showCreate, setShowCreate] = useState(false);
  const now = new Date();
  const nextYear = now.getFullYear() + 1;
  const [createForm, setCreateForm] = useState({
    name: `שנת תקציב ${nextYear}`,
    startDate: `${nextYear}-01-01`,
    endDate: `${nextYear}-12-31`,
    totalBudget: "",
    tithePercentage: "10",
  });

  /* ── edit dialog ─────────────────────────────────────────── */
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetYear | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", startDate: "", endDate: "",
    totalBudget: "", tithePercentage: "",
  });

  /* ── delete confirm ──────────────────────────────────────── */
  const [deleteTarget, setDeleteTarget] = useState<BudgetYear | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── activate loading ────────────────────────────────────── */
  const [activatingId, setActivatingId] = useState<number | null>(null);

  /* handlers */
  const handleSelect = (year: BudgetYear) => {
    setViewedYear(year.id);
    setOpen(false);
  };

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
        endDate: createForm.endDate,
        totalBudget: createForm.totalBudget || "0",
        tithePercentage: createForm.tithePercentage || "10",
        isActive: false,
      });
      toast({ title: "שנת תקציב נוצרה", description: createForm.name });
      setShowCreate(false);
      setOpen(false);
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (year: BudgetYear, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(year);
    setEditForm({
      name: year.name,
      startDate: year.startDate?.split("T")[0] || "",
      endDate: year.endDate?.split("T")[0] || "",
      totalBudget: String(year.totalBudget || ""),
      tithePercentage: String(year.tithePercentage || "10"),
    });
    setOpen(false);
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!editTarget || !editForm.name) return;
    setSaving(true);
    try {
      await updateYear(editTarget.id, {
        name: editForm.name,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        totalBudget: editForm.totalBudget || "0",
        tithePercentage: editForm.tithePercentage || "10",
        isActive: editTarget.isActive,
        userId: editTarget.userId,
      });
      toast({ title: "שנת תקציב עודכנה", description: editForm.name });
      setShowEdit(false);
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (year: BudgetYear, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(year);
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteYear(deleteTarget.id);
      toast({ title: "שנת תקציב נמחקה", description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleActivate = async (year: BudgetYear, e: React.MouseEvent) => {
    e.stopPropagation();
    if (year.isActive) return;
    setActivatingId(year.id);
    try {
      await activateYear(year.id);
      toast({ title: "שנה הופעלה", description: `${year.name} הוגדרה כשנה הפעילה` });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/15 transition-colors group">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="flex-1 text-start text-sm font-medium text-sidebar-foreground truncate">
              {activeYear?.name || "טוען..."}
            </span>
            <ChevronDown className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          className="w-72 p-1.5"
          sideOffset={6}
        >
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 py-1.5">שנות תקציב</p>
          <div className="space-y-0.5">
            {years.map(year => (
              <div
                key={year.id}
                onClick={() => handleSelect(year)}
                className={cn(
                  "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
                  year.id === activeBid
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", year.id === activeBid ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 truncate text-xs">{year.name}</span>
                {year.isActive && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">פעיל</span>
                )}
                {/* activate */}
                {!year.isActive && (
                  <button
                    onClick={e => handleActivate(year, e)}
                    title="הגדר כשנה פעילה"
                    className="p-1 rounded hover:bg-amber-100 text-muted-foreground hover:text-amber-600 transition-colors"
                  >
                    {activatingId === year.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Star className="w-3 h-3" />}
                  </button>
                )}
                {/* edit */}
                <button
                  onClick={e => openEdit(year, e)}
                  title="עריכה"
                  className="p-1 rounded hover:bg-blue-100 text-muted-foreground hover:text-blue-600 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {/* delete */}
                {years.length > 1 && (
                  <button
                    onClick={e => openDelete(year, e)}
                    title="מחיקה"
                    className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t mt-1.5 pt-1.5">
            <button
              onClick={() => { setOpen(false); setShowCreate(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>צור שנת תקציב חדשה</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* ── Create dialog ─────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>צור שנת תקציב חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם השנה</Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder='לדוגמה: שנת תקציב 2026'
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך התחלה</Label>
                <Input
                  type="date"
                  value={createForm.startDate}
                  onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>תאריך סיום</Label>
                <Input
                  type="date"
                  value={createForm.endDate}
                  onChange={e => setCreateForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תקציב שנתי (₪)</Label>
                <Input
                  type="number"
                  value={createForm.totalBudget}
                  onChange={e => setCreateForm(f => ({ ...f, totalBudget: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>אחוז מעשר (%)</Label>
                <Input
                  type="number"
                  value={createForm.tithePercentage}
                  onChange={e => setCreateForm(f => ({ ...f, tithePercentage: e.target.value }))}
                  min={0} max={100}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>ביטול</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              צור שנה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ───────────────────────────────────────── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת שנת תקציב</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם השנה</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך התחלה</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>תאריך סיום</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תקציב שנתי (₪)</Label>
                <Input
                  type="number"
                  value={editForm.totalBudget}
                  onChange={e => setEditForm(f => ({ ...f, totalBudget: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>אחוז מעשר (%)</Label>
                <Input
                  type="number"
                  value={editForm.tithePercentage}
                  onChange={e => setEditForm(f => ({ ...f, tithePercentage: e.target.value }))}
                  min={0} max={100}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>ביטול</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ────────────────────────────────────── */}
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
