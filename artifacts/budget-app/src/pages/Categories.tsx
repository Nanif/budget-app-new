import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  Plus, Pencil, Trash2, Tag, Check, X, Loader2, Eye, EyeOff,
  Search, Filter, Shield,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type Fund = { id: number; name: string; colorClass: string; type: string; isActive: boolean };
type Category = {
  id: number; name: string; type: string; color: string; icon: string;
  fundId: number | null; isSystem: boolean; isActive: boolean; sortOrder: number;
  fundName?: string; fundColor?: string;
};

const CAT_TYPES = [
  { value: "expense", label: "הוצאה" },
  { value: "income", label: "הכנסה" },
  { value: "both", label: "שניהם" },
];

const COLOR_SWATCHES = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1",
  "#8b5cf6","#a855f7","#ec4899","#f43f5e","#64748b","#94a3b8",
];

const TYPE_LABELS: Record<string, string> = { expense: "הוצאה", income: "הכנסה", both: "שניהם" };
const TYPE_COLORS: Record<string, string> = {
  expense: "bg-rose-100 text-rose-700",
  income: "bg-emerald-100 text-emerald-700",
  both: "bg-blue-100 text-blue-700",
};

type FormState = {
  name: string; type: string; color: string; fundId: string; isActive: boolean;
};
const DEFAULT_FORM: FormState = { name: "", type: "expense", color: "#94a3b8", fundId: "", isActive: true };


export default function Categories() {
  const { toast } = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showInactive, setShowInactive] = useState(false);
  const [filterFund, setFilterFund] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [catData, fundData] = await Promise.all([
        apiFetch("/categories?all=true"),
        apiFetch("/funds?all=true"),
      ]);
      setCats(catData); setFunds(fundData);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditCat(null); setForm(DEFAULT_FORM); setFormErrors({}); setDialogOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditCat(c);
    setForm({ name: c.name, type: c.type, color: c.color, fundId: c.fundId ? String(c.fundId) : "", isActive: c.isActive });
    setFormErrors({}); setDialogOpen(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "שם הקטגוריה הוא שדה חובה";
    if (form.name.trim().length > 50) errs.name = "שם ארוך מדי";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(), type: form.type, color: form.color,
        isActive: form.isActive, sortOrder: editCat?.sortOrder ?? cats.length,
      };
      if (form.fundId) payload.fundId = parseInt(form.fundId);

      if (editCat) {
        const updated = await apiFetch(`/categories/${editCat.id}`, { method: "PUT", body: JSON.stringify(payload) });
        // Re-enrich with fund info
        const fund = funds.find(f => f.id === updated.fundId);
        setCats(prev => prev.map(c => c.id === editCat.id ? { ...updated, fundName: fund?.name, fundColor: fund?.colorClass } : c));
        toast({ title: "קטגוריה עודכנה בהצלחה" });
      } else {
        const created = await apiFetch("/categories", { method: "POST", body: JSON.stringify(payload) });
        const fund = funds.find(f => f.id === created.fundId);
        setCats(prev => [...prev, { ...created, fundName: fund?.name, fundColor: fund?.colorClass }]);
        toast({ title: "קטגוריה נוצרה בהצלחה" });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleToggle = async (cat: Category) => {
    if (cat.isSystem) { toast({ title: "לא ניתן לשנות קטגוריה מובנית", variant: "destructive" }); return; }
    try {
      const updated = await apiFetch(`/categories/${cat.id}/toggle`, { method: "PATCH" });
      setCats(prev => prev.map(c => c.id === cat.id ? { ...c, isActive: updated.isActive } : c));
      toast({ title: updated.isActive ? "קטגוריה הופעלה" : "קטגוריה הושהתה" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/categories/${deleteId}`, { method: "DELETE" });
      setCats(prev => prev.map(c => c.id === deleteId ? { ...c, isActive: false } : c));
      toast({ title: "קטגוריה הושהתה" });
    } catch (e: any) {
      const msg = JSON.parse(e.message || "{}").error || "שגיאה";
      toast({ title: msg, variant: "destructive" });
    } finally { setDeleteId(null); }
  };

  const filtered = useMemo(() => cats.filter(c => {
    if (!showInactive && !c.isActive) return false;
    if (filterFund !== "all" && (filterFund === "none" ? c.fundId !== null : c.fundId !== parseInt(filterFund))) return false;
    if (filterType !== "all" && c.type !== filterType) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.sortOrder - b.sortOrder), [cats, showInactive, filterFund, filterType, search]);

  // Group by fund for display
  const grouped = useMemo(() => {
    const groups: Record<string, { label: string; color: string; cats: Category[] }> = {};
    for (const c of filtered) {
      const key = c.fundId ? String(c.fundId) : "none";
      if (!groups[key]) {
        groups[key] = {
          label: c.fundId ? (c.fundName || "קופה") : "ללא קופה",
          color: c.fundId ? (c.fundColor || "#94a3b8") : "#94a3b8",
          cats: [],
        };
      }
      groups[key].cats.push(c);
    }
    return groups;
  }, [filtered]);

  const useGrouped = filterFund === "all" && !search;

  return (
    <div className="space-y-6">
      <PageHeader title="ניהול קטגוריות" description="ארגן קטגוריות הוצאות והכנסות ושייך אותן לקופות">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowInactive(p => !p)}
            className={cn("flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-all",
              showInactive ? "bg-muted border-border" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showInactive ? "הסתר מושהות" : "הצג מושהות"}
          </button>
          <Button onClick={openCreate} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> קטגוריה חדשה
          </Button>
        </div>
      </PageHeader>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "סה\"כ", value: cats.length, color: "text-foreground" },
          { label: "פעילות", value: cats.filter(c => c.isActive).length, color: "text-emerald-600" },
          { label: "הוצאות", value: cats.filter(c => c.type === "expense").length, color: "text-rose-600" },
          { label: "הכנסות", value: cats.filter(c => c.type === "income").length, color: "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-muted/40 rounded-2xl p-4 text-center border border-border/50">
            <p className={cn("text-2xl font-display font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-muted/30 rounded-2xl p-4 border border-border/40">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חפש קטגוריה..." className="rounded-xl pr-9 h-9 text-sm" />
        </div>
        <Select value={filterFund} onValueChange={setFilterFund}>
          <SelectTrigger className="rounded-xl h-9 text-sm w-auto min-w-[140px]">
            <Filter className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
            <SelectValue placeholder="כל הקופות" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="all">כל הקופות</SelectItem>
            <SelectItem value="none">ללא קופה</SelectItem>
            {funds.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="rounded-xl h-9 text-sm w-auto min-w-[120px]">
            <SelectValue placeholder="כל הסוגים" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="all">כל הסוגים</SelectItem>
            {CAT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="py-12 text-center space-y-2">
            <Tag className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">לא נמצאו קטגוריות</p>
            <Button onClick={openCreate} variant="outline" size="sm" className="rounded-xl gap-2 mt-2">
              <Plus className="w-4 h-4" /> הוסף קטגוריה
            </Button>
          </CardContent>
        </Card>
      ) : useGrouped ? (
        /* Grouped by fund */
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, group]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-3 h-3 rounded-full" style={{ background: group.color }} />
                <h3 className="font-semibold text-sm text-muted-foreground">{group.label}</h3>
                <span className="text-xs text-muted-foreground">({group.cats.length})</span>
              </div>
              <div className="space-y-1.5">
                {group.cats.map(cat => <CategoryRow key={cat.id} cat={cat} onEdit={openEdit} onToggle={handleToggle} onDelete={setDeleteId} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat list */
        <div className="space-y-1.5">
          {filtered.map(cat => <CategoryRow key={cat.id} cat={cat} onEdit={openEdit} onToggle={handleToggle} onDelete={setDeleteId} />)}
        </div>
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editCat ? "עריכת קטגוריה" : "קטגוריה חדשה"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="cname" className="font-semibold">שם הקטגוריה <span className="text-rose-500">*</span></Label>
              <Input id="cname" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder='למשל: מזון, דלק, ביגוד...'
                className={cn("rounded-xl", formErrors.name && "border-rose-400 focus-visible:ring-rose-400")} />
              {formErrors.name && <p className="text-xs text-rose-500">{formErrors.name}</p>}
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="font-semibold">סוג</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {CAT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Fund association */}
            <div className="space-y-1.5">
              <Label className="font-semibold">שייך לקופה (אופציונלי)</Label>
              <Select value={form.fundId || "none"} onValueChange={v => setForm(p => ({ ...p, fundId: v === "none" ? "" : v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="ללא קופה" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">ללא קופה</SelectItem>
                  {funds.filter(f => f.isActive).map(f => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: f.colorClass }} />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label className="font-semibold">צבע</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map(color => (
                  <button key={color} type="button" onClick={() => setForm(p => ({ ...p, color }))}
                    className={cn("w-8 h-8 rounded-lg transition-all hover:scale-110",
                      form.color === color && "ring-2 ring-offset-2 ring-foreground scale-110"
                    )}
                    style={{ background: color }}>
                    {form.color === color && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-8 h-8 rounded-lg shrink-0 border border-border" style={{ background: form.color }} />
                <Input value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  placeholder="#94a3b8" className="rounded-xl flex-1 text-sm font-mono" dir="ltr" />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
              <Label className="font-semibold cursor-pointer">קטגוריה פעילה</Label>
              <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  form.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                )}>
                {form.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {form.isActive ? "פעיל" : "מושהה"}
              </button>
            </div>

            {/* Preview */}
            <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">תצוגה מקדימה</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ background: form.color || "#94a3b8" }}>
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{form.name || "שם הקטגוריה"}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TYPE_COLORS[form.type] || "bg-gray-100")}>
                      {TYPE_LABELS[form.type] || ""}
                    </span>
                    {form.fundId && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {funds.find(f => String(f.id) === form.fundId)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl flex-1">
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
              {editCat ? "שמור שינויים" : "צור קטגוריה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ───────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>להשהות קטגוריה?</AlertDialogTitle>
            <AlertDialogDescription>
              הקטגוריה תסומן כמושהית. קטגוריות מובנות לא ניתן למחוק.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700">
              השהה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── CategoryRow sub-component ──────────────────────────────────── */
function CategoryRow({ cat, onEdit, onToggle, onDelete }: {
  cat: Category;
  onEdit: (c: Category) => void;
  onToggle: (c: Category) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className={cn(
      "rounded-xl border px-4 py-3 flex items-center gap-3 transition-all group",
      cat.isActive
        ? "bg-card border-border/50 hover:border-border hover:shadow-sm"
        : "bg-muted/20 border-border/20 opacity-55"
    )}>
      {/* Color swatch */}
      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs shadow-sm"
        style={{ background: cat.color || "#94a3b8" }}>
        <Tag className="w-3.5 h-3.5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <p className={cn("font-medium text-sm", !cat.isActive && "line-through text-muted-foreground")}>
          {cat.name}
        </p>
        {cat.isSystem && (
          <span title="קטגוריה מובנית" className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-0.5">
            <Shield className="w-2.5 h-2.5" /> מובנית
          </span>
        )}
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", TYPE_COLORS[cat.type] || "bg-gray-100 text-gray-600")}>
          {TYPE_LABELS[cat.type] || cat.type}
        </span>
        {cat.fundName && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
            style={{ background: `${cat.fundColor}22`, color: cat.fundColor }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cat.fundColor }} />
            {cat.fundName}
          </span>
        )}
        {!cat.isActive && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">מושהה</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!cat.isSystem && (
          <button onClick={() => onToggle(cat)} title={cat.isActive ? "השהה" : "הפעל"}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            {cat.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        <button onClick={() => onEdit(cat)} title="ערוך"
          className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {!cat.isSystem && (
          <button onClick={() => onDelete(cat.id)} title="מחק"
            className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
