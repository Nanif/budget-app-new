import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Check, Loader2, X, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
type RecurringType = "income" | "tithe";

type Template = {
  id: number;
  type: RecurringType;
  name: string;
  amount: number;
  entryType: "income" | "work_deduction";
  notes: string;
  displayOrder: number;
};

type ApplyItem = Template & { applyAmount: string; applyDate: string; selected: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  type: RecurringType;
  onApplied: () => void;
};

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
function fmt(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency", currency: "ILS", maximumFractionDigits: 0,
  }).format(n);
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/* ═══════════════════════════════════════════════════
   FORM FOR ADD / EDIT
═══════════════════════════════════════════════════ */
type TemplateForm = {
  name: string; amount: string;
  entryType: "income" | "work_deduction"; notes: string;
};
const EMPTY_FORM: TemplateForm = { name: "", amount: "", entryType: "income", notes: "" };

function TemplateFormRow({
  form, onChange, onSave, onCancel, saving, type,
}: {
  form: TemplateForm;
  onChange: (f: TemplateForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  type: RecurringType;
}) {
  const [tried, setTried] = useState(false);
  const errName   = tried && !form.name.trim() ? "שם חובה" : "";
  const errAmount = tried && (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) ? "סכום חיובי" : "";
  const valid = form.name.trim() && form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0;

  const handleSave = () => { setTried(true); if (valid) onSave(); };

  return (
    <div className="bg-muted/40 border border-border/60 rounded-xl p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">שם</Label>
          <Input
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder={type === "income" ? "שם ההכנסה" : "שם הנמען"}
            className={cn("h-8 text-sm rounded-lg", errName && "border-rose-400")}
          />
          {errName && <p className="text-xs text-rose-500 mt-0.5">{errName}</p>}
        </div>
        <div>
          <Label className="text-xs mb-1 block">סכום (₪)</Label>
          <Input
            type="number" min={0}
            value={form.amount}
            onChange={e => onChange({ ...form, amount: e.target.value })}
            placeholder="0"
            className={cn("h-8 text-sm rounded-lg", errAmount && "border-rose-400")}
            dir="ltr"
          />
          {errAmount && <p className="text-xs text-rose-500 mt-0.5">{errAmount}</p>}
        </div>
      </div>

      {type === "income" && (
        <div>
          <Label className="text-xs mb-1 block">סוג</Label>
          <Select value={form.entryType} onValueChange={v => onChange({ ...form, entryType: v as any })}>
            <SelectTrigger className="h-8 text-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="income">הכנסה</SelectItem>
              <SelectItem value="work_deduction">ניכוי עבודה</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label className="text-xs mb-1 block">הערה (אופציונלי)</Label>
        <Input
          value={form.notes}
          onChange={e => onChange({ ...form, notes: e.target.value })}
          placeholder="הערה..."
          className="h-8 text-sm rounded-lg"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs rounded-lg px-2.5">
          ביטול
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs rounded-lg px-3 gap-1">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          שמור
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   APPLY STEP
═══════════════════════════════════════════════════ */
function ApplyStep({
  items, onBack, onApply, applying,
}: {
  items: ApplyItem[];
  onBack: () => void;
  onApply: (items: ApplyItem[]) => void;
  applying: boolean;
}) {
  const [list, setList] = useState<ApplyItem[]>(items);

  const toggle = (id: number) =>
    setList(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));

  const setAmount = (id: number, v: string) =>
    setList(prev => prev.map(i => i.id === id ? { ...i, applyAmount: v } : i));

  const setDate = (id: number, v: string) =>
    setList(prev => prev.map(i => i.id === id ? { ...i, applyDate: v } : i));

  const selected = list.filter(i => i.selected);
  const canApply = selected.length > 0 && selected.every(
    i => i.applyAmount && !isNaN(parseFloat(i.applyAmount)) && parseFloat(i.applyAmount) > 0 && i.applyDate
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">בחר פעולות להחלה</p>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onBack}>
          <ChevronUp className="w-3.5 h-3.5" /> חזור
        </Button>
      </div>

      <div className="space-y-2">
        {list.map(item => (
          <div
            key={item.id}
            className={cn(
              "border rounded-xl p-3 transition-colors",
              item.selected
                ? "border-emerald-400 bg-emerald-50"
                : "border-border/60 bg-card opacity-60"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => toggle(item.id)}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                  item.selected ? "bg-emerald-500 border-emerald-500" : "border-border"
                )}
              >
                {item.selected && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className="font-medium text-sm flex-1">{item.name}</span>
              <span className="text-xs text-muted-foreground">{fmt(item.amount)}</span>
            </div>

            {item.selected && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <Label className="text-xs mb-1 block">סכום (₪)</Label>
                  <Input
                    type="number" min={0} dir="ltr"
                    value={item.applyAmount}
                    onChange={e => setAmount(item.id, e.target.value)}
                    className="h-7 text-sm rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">תאריך</Label>
                  <Input
                    type="date" dir="ltr"
                    value={item.applyDate}
                    onChange={e => setDate(item.id, e.target.value)}
                    className="h-7 text-sm rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selected.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">יש לסמן לפחות פעולה אחת</p>
      )}

      <Button
        onClick={() => onApply(list)}
        disabled={!canApply || applying}
        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
      >
        {applying
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Check className="w-4 h-4" />
        }
        החל {selected.length > 0 ? `${selected.length} פעולות` : "פעולות"}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export function RecurringPanel({ open, onClose, type, onApplied }: Props) {
  const { toast } = useToast();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading,   setLoading]   = useState(false);

  const [showAdd,   setShowAdd]   = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [form,      setForm]      = useState<TemplateForm>({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const [applyMode, setApplyMode] = useState(false);
  const [applying,  setApplying]  = useState(false);
  const [applyItems, setApplyItems] = useState<ApplyItem[]>([]);

  const title = type === "income" ? "פעולות קבועות – הכנסות" : "פעולות קבועות – תרומות";

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/recurring-templates?type=${type}`);
      setTemplates(data.map((t: any) => ({ ...t, amount: parseFloat(t.amount) })));
    } catch {
      toast({ title: "שגיאה בטעינה", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowAdd(true);
  };

  const openEdit = (t: Template) => {
    setEditId(t.id);
    setForm({ name: t.name, amount: String(t.amount), entryType: t.entryType, notes: t.notes });
    setShowAdd(true);
  };

  const cancelForm = () => { setShowAdd(false); setEditId(null); };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const payload = {
        type,
        name: form.name.trim(),
        amount: parseFloat(form.amount),
        entryType: form.entryType,
        notes: form.notes.trim(),
      };
      if (editId !== null) {
        const updated = await apiFetch(`/recurring-templates/${editId}`, {
          method: "PUT", body: JSON.stringify(payload),
        });
        setTemplates(prev => prev.map(t => t.id === editId
          ? { ...updated, amount: parseFloat(updated.amount) } : t));
        toast({ title: "עודכן בהצלחה" });
      } else {
        const created = await apiFetch("/recurring-templates", {
          method: "POST", body: JSON.stringify(payload),
        });
        setTemplates(prev => [...prev, { ...created, amount: parseFloat(created.amount) }]);
        toast({ title: "נוסף בהצלחה" });
      }
      setShowAdd(false); setEditId(null);
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    setDeleting(true);
    try {
      await apiFetch(`/recurring-templates/${id}`, { method: "DELETE" });
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast({ title: "נמחק" });
      setDeleteId(null);
    } catch {
      toast({ title: "שגיאה במחיקה", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const startApply = () => {
    if (templates.length === 0) return;
    const today = todayStr();
    setApplyItems(templates.map(t => ({
      ...t,
      applyAmount: String(t.amount),
      applyDate: today,
      selected: true,
    })));
    setApplyMode(true);
  };

  const handleApply = async (items: ApplyItem[]) => {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) return;
    setApplying(true);
    try {
      const payload = {
        type,
        items: selected.map(i => ({
          templateId: i.id,
          name: i.name,
          notes: i.notes,
          amount: parseFloat(i.applyAmount),
          date: i.applyDate,
          entryType: i.entryType,
        })),
      };
      const result = await apiFetch("/recurring-templates/apply", {
        method: "POST", body: JSON.stringify(payload),
      });
      toast({ title: `${result.count} פעולות הוחלו בהצלחה` });
      setApplyMode(false);
      onApplied();
    } catch {
      toast({ title: "שגיאה בהחלה", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { onClose(); setApplyMode(false); setShowAdd(false); } }}>
      <SheetContent side="left" className="w-[380px] sm:w-[420px] p-0 flex flex-col" dir="rtl">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">{title}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── APPLY MODE ─────────────────────────────── */}
          {applyMode ? (
            <ApplyStep
              items={applyItems}
              onBack={() => setApplyMode(false)}
              onApply={handleApply}
              applying={applying}
            />
          ) : (
            <>
              {/* ── ACTION BAR ───────────────────────────── */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openAdd}
                  disabled={showAdd}
                  className="flex-1 gap-1.5 rounded-xl h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> הוסף פעולה
                </Button>
                <Button
                  size="sm"
                  onClick={startApply}
                  disabled={templates.length === 0 || showAdd}
                  className="flex-1 gap-1.5 rounded-xl h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> החל לחודש
                </Button>
              </div>

              {/* ── ADD / EDIT FORM ──────────────────────── */}
              {showAdd && (
                <TemplateFormRow
                  form={form}
                  onChange={setForm}
                  onSave={saveTemplate}
                  onCancel={cancelForm}
                  saving={saving}
                  type={type}
                />
              )}

              {/* ── LIST ─────────────────────────────────── */}
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>אין פעולות קבועות עדיין</p>
                  <p className="text-xs mt-1">לחץ "הוסף פעולה" כדי להתחיל</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 bg-card border border-border/60 rounded-xl px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{t.name}</p>
                          {type === "income" && t.entryType === "work_deduction" && (
                            <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                              ניכוי
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground tabular-nums">{fmt(t.amount)}</p>
                        {t.notes && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{t.notes}</p>
                        )}
                      </div>

                      {/* Delete confirm inline */}
                      {deleteId === t.id ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-rose-600">למחוק?</span>
                          <button
                            onClick={() => deleteTemplate(t.id)}
                            disabled={deleting}
                            className="p-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-600"
                          >
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setDeleteId(null)}
                            className="p-1 rounded hover:bg-muted"
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { openEdit(t); }}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(t.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
