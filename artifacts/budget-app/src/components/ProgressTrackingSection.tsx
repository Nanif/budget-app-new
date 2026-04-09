import { useState, useEffect } from "react";
import { Plus, ChevronRight, Trash2, X, Calendar, TrendingUp, TrendingDown, Scale, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ─── Types ──────────────────────────────────────────────── */
type NwItem = { name: string; amount: number };
type NwRecord = {
  id: number;
  recordedAt: string;
  items: { debts: NwItem[]; savings: NwItem[] };
  totalDebts: number;
  totalSavings: number;
  netWorth: number;
};
type AssetRecord = { id: number; name: string; type: string; currentAmount: number };

const LIABILITY_TYPES = ["mortgage","bank_loan","private_loan","credit_balance","other_liability"];
const isLiability = (t: string) => LIABILITY_TYPES.includes(t);

/* ─── Formatter ──────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Math.abs(n));

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/* ─── FormItem ───────────────────────────────────────────── */
function FormItem({
  label, value, onRemove, onChange,
}: {
  label: string; value: string;
  onRemove: () => void; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <label className="text-[11px] text-muted-foreground absolute -top-2 right-3 bg-card px-1 z-10 leading-none">
          {label}
        </label>
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-border rounded-xl px-3 pt-4 pb-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
          dir="ltr"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/40 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-50"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Extra item (name + amount) ─────────────────────────── */
function ExtraItem({
  name, amount, onRemove, onChangeName, onChangeAmount,
}: {
  name: string; amount: string;
  onRemove: () => void;
  onChangeName: (v: string) => void;
  onChangeAmount: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="שם"
        value={name}
        onChange={e => onChangeName(e.target.value)}
        className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <input
        type="number"
        min="0"
        placeholder="0"
        value={amount}
        onChange={e => onChangeAmount(e.target.value)}
        className="w-28 border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
        dir="ltr"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/40 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-50"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Add Record Form (Dialog) ───────────────────────────── */
function AddRecordDialog({
  open, onClose, assets, onSave, latestRecord,
}: {
  open: boolean;
  onClose: () => void;
  assets: AssetRecord[];
  latestRecord?: NwRecord | null;
  onSave: (recordedAt: string, items: { debts: NwItem[]; savings: NwItem[] }) => Promise<void>;
}) {
  const liabilities = assets.filter(a => isLiability(a.type));
  const savings     = assets.filter(a => !isLiability(a.type));

  const [debtValues,    setDebtValues]    = useState<Record<number, string>>({});
  const [savingValues,  setSavingValues]  = useState<Record<number, string>>({});
  const [removedDebts,  setRemovedDebts]  = useState<number[]>([]);
  const [removedSavings,setRemovedSavings]= useState<number[]>([]);
  const [extraDebts,    setExtraDebts]    = useState<{name:string;amount:string}[]>([]);
  const [extraSavings,  setExtraSavings]  = useState<{name:string;amount:string}[]>([]);
  const [date,          setDate]          = useState(new Date().toISOString().split("T")[0]);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    if (!open) return;
    if (latestRecord) {
      // הסתר את שורות הנכסים הבסיסיים — הצג רק את הפריטים מהרישום האחרון
      setRemovedDebts(liabilities.map(a => a.id));
      setRemovedSavings(savings.map(a => a.id));
      setExtraDebts(latestRecord.items.debts.map(d => ({ name: d.name, amount: "" })));
      setExtraSavings(latestRecord.items.savings.map(s => ({ name: s.name, amount: "" })));
    } else {
      // אין רישום קודם — הצג נכסים עם שדות ריקים
      const dv: Record<number,string> = {};
      liabilities.forEach(a => { dv[a.id] = ""; });
      setDebtValues(dv);
      const sv: Record<number,string> = {};
      savings.forEach(a => { sv[a.id] = ""; });
      setSavingValues(sv);
      setRemovedDebts([]);
      setRemovedSavings([]);
      setExtraDebts([]);
      setExtraSavings([]);
    }
    setDate(new Date().toISOString().split("T")[0]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      const debts: NwItem[] = [
        ...liabilities
          .filter(a => !removedDebts.includes(a.id))
          .map(a => ({ name: a.name, amount: parseFloat(debtValues[a.id] || "0") || 0 })),
        ...extraDebts.filter(e => e.name.trim()).map(e => ({ name: e.name.trim(), amount: parseFloat(e.amount) || 0 })),
      ];
      const savingItems: NwItem[] = [
        ...savings
          .filter(a => !removedSavings.includes(a.id))
          .map(a => ({ name: a.name, amount: parseFloat(savingValues[a.id] || "0") || 0 })),
        ...extraSavings.filter(e => e.name.trim()).map(e => ({ name: e.name.trim(), amount: parseFloat(e.amount) || 0 })),
      ];
      await onSave(date, { debts, savings: savingItems });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border/60" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 sticky top-0 bg-card z-10">
          <h3 className="font-bold text-foreground">הוספת רישום חדש</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Debts */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-500" /> התחייבויות (₪)
            </p>
            <div className="space-y-2.5">
              {liabilities.filter(a => !removedDebts.includes(a.id)).map(a => (
                <FormItem
                  key={a.id}
                  label={a.name}
                  value={debtValues[a.id] ?? "0"}
                  onChange={v => setDebtValues(prev => ({ ...prev, [a.id]: v }))}
                  onRemove={() => setRemovedDebts(r => [...r, a.id])}
                />
              ))}
              {extraDebts.map((item, i) => (
                <ExtraItem
                  key={i}
                  name={item.name}
                  amount={item.amount}
                  onChangeName={v => setExtraDebts(e => e.map((x,j) => j===i ? {...x,name:v} : x))}
                  onChangeAmount={v => setExtraDebts(e => e.map((x,j) => j===i ? {...x,amount:v} : x))}
                  onRemove={() => setExtraDebts(e => e.filter((_,j) => j!==i))}
                />
              ))}
              <button
                type="button"
                onClick={() => setExtraDebts(e => [...e, {name:"",amount:""}])}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mt-1"
              >
                <Plus className="w-4 h-4" /> התחייבות נוספת
              </button>
            </div>
          </div>

          {/* Savings */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> חסכונות (₪)
            </p>
            <div className="space-y-2.5">
              {savings.filter(a => !removedSavings.includes(a.id)).map(a => (
                <FormItem
                  key={a.id}
                  label={a.name}
                  value={savingValues[a.id] ?? "0"}
                  onChange={v => setSavingValues(prev => ({ ...prev, [a.id]: v }))}
                  onRemove={() => setRemovedSavings(r => [...r, a.id])}
                />
              ))}
              {extraSavings.map((item, i) => (
                <ExtraItem
                  key={i}
                  name={item.name}
                  amount={item.amount}
                  onChangeName={v => setExtraSavings(e => e.map((x,j) => j===i ? {...x,name:v} : x))}
                  onChangeAmount={v => setExtraSavings(e => e.map((x,j) => j===i ? {...x,amount:v} : x))}
                  onRemove={() => setExtraSavings(e => e.filter((_,j) => j!==i))}
                />
              ))}
              <button
                type="button"
                onClick={() => setExtraSavings(e => [...e, {name:"",amount:""}])}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mt-1"
              >
                <Plus className="w-4 h-4" /> חיסכון נוסף
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" /> תאריך
            </p>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
            />
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-medium py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            שמור רישום
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Section ───────────────────────────────────────── */
export function ProgressTrackingSection({ assets }: { assets: AssetRecord[] }) {
  const { toast } = useToast();
  const [records,   setRecords]   = useState<NwRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<number[]>([]);
  const [showForm,  setShowForm]  = useState(false);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/net-worth-records");
      setRecords(data);
      if (data.length > 0) setExpanded([data[0].id]);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (id: number) =>
    setExpanded(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id]);

  const handleSave = async (recordedAt: string, items: { debts: NwItem[]; savings: NwItem[] }) => {
    const created = await apiFetch("/net-worth-records", {
      method: "POST",
      body: JSON.stringify({ recordedAt, items }),
    });
    setRecords(prev => [created, ...prev]);
    setExpanded(e => [created.id, ...e]);
    toast({ title: "רישום נשמר" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/net-worth-records/${deleteId}`, { method: "DELETE" });
      setRecords(prev => prev.filter(r => r.id !== deleteId));
      toast({ title: "נמחק" });
      setDeleteId(null);
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  const latest = records[0];
  const prev   = records[1];
  const change = latest && prev ? latest.netWorth - prev.netWorth : null;

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> הוסף רישום חדש
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border/40 rounded-2xl text-center cursor-pointer hover:border-primary/30 hover:bg-muted/10 transition-all"
          onClick={() => setShowForm(true)}
        >
          <Scale className="w-10 h-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">אין רישומים עדיין</p>
          <p className="text-xs text-muted-foreground/60 mt-1">לחץ כדי להוסיף את הרישום הראשון</p>
        </div>
      ) : (
        <>
          {/* ── Latest snapshot card ─────────────────────────── */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">שווי נקי עדכני</p>
                <p className={cn(
                  "text-3xl font-display font-bold tabular-nums",
                  latest.netWorth >= 0 ? "text-emerald-600" : "text-rose-600"
                )} dir="ltr">
                  {latest.netWorth >= 0 ? "+" : "−"}{fmt(latest.netWorth)}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl px-3 py-2 border border-border/40 text-start">
                <p className="text-xs text-muted-foreground mb-0.5">עדכון אחרון</p>
                <p className="text-sm font-semibold">{fmtDate(latest.recordedAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-xs text-emerald-600 font-medium mb-1">חסכונות</p>
                <p className="text-xl font-bold text-emerald-700 tabular-nums" dir="ltr">
                  +{fmt(latest.totalSavings)}
                </p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                <p className="text-xs text-rose-600 font-medium mb-1">התחייבויות</p>
                <p className="text-xl font-bold text-rose-700 tabular-nums" dir="ltr">
                  −{fmt(latest.totalDebts)}
                </p>
              </div>
            </div>

            {change !== null && (
              <div className="border-t border-border/50 pt-3 flex items-center gap-2">
                <span className={cn(
                  "text-sm font-semibold flex items-center gap-1",
                  change >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {change >= 0 ? "▲" : "▼"}
                  <span dir="ltr">{change >= 0 ? "+" : "−"}{fmt(Math.abs(change))}</span>
                </span>
                <p className="text-xs text-muted-foreground">
                  שינוי מהעדכון הקודם ({fmtDate(prev.recordedAt)})
                </p>
              </div>
            )}
          </div>

          {/* ── History table ─────────────────────────────────── */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <p className="font-semibold text-sm">היסטוריית רישומים</p>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[24px_1fr_108px_108px_120px_32px] gap-2 px-5 py-2 bg-muted/30 border-b border-border/40 text-xs font-medium text-muted-foreground">
              <span />
              <span>תאריך</span>
              <span className="text-center">התחייבויות</span>
              <span className="text-center">חסכונות</span>
              <span className="text-center">שווי נקי</span>
              <span />
            </div>

            {records.map((rec, idx) => {
              const isOpen  = expanded.includes(rec.id);
              const hasDet  = rec.items.debts.length > 0 || rec.items.savings.length > 0;
              const recChange = idx < records.length - 1
                ? rec.netWorth - records[idx + 1].netWorth
                : null;

              return (
                <div key={rec.id} className="border-b border-border/40 last:border-0">
                  <div
                    className="grid grid-cols-[24px_1fr_108px_108px_120px_32px] gap-2 px-5 py-3.5 items-center hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => hasDet && toggleExpand(rec.id)}
                  >
                    <div className={cn(
                      "w-5 h-5 flex items-center justify-center text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}>
                      {hasDet
                        ? <ChevronRight className="w-4 h-4" />
                        : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 block mx-auto" />
                      }
                    </div>

                    <div>
                      <span className="text-sm font-medium">{fmtDate(rec.recordedAt)}</span>
                      {recChange !== null && (
                        <span className={cn(
                          "text-[10px] font-medium mr-2",
                          recChange >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {recChange >= 0 ? "▲" : "▼"} {fmt(Math.abs(recChange))}
                        </span>
                      )}
                    </div>

                    <span className="text-sm text-rose-600 tabular-nums text-center block" dir="ltr">
                      −{fmt(rec.totalDebts)}
                    </span>
                    <span className="text-sm text-emerald-600 tabular-nums text-center block" dir="ltr">
                      +{fmt(rec.totalSavings)}
                    </span>

                    <span className={cn(
                      "text-sm font-bold tabular-nums text-center block",
                      rec.netWorth >= 0 ? "text-emerald-700" : "text-rose-700"
                    )} dir="ltr">
                      {rec.netWorth >= 0 ? "+" : "−"}{fmt(rec.netWorth)}
                    </span>

                    {idx === 0 ? (
                      <button
                        className="text-muted-foreground/40 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50 justify-self-center"
                        title="מחק"
                        onClick={e => { e.stopPropagation(); setDeleteId(rec.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isOpen && hasDet && (
                    <div className="bg-muted/10 border-t border-border/30 px-10 py-4 grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-xs font-semibold text-rose-600 mb-2.5 flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5" /> פירוט התחייבויות
                        </p>
                        <div className="space-y-2">
                          {rec.items.debts.map((d, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{d.name}</span>
                              <span className="text-rose-600 tabular-nums font-medium" dir="ltr">
                                −{fmt(d.amount)}
                              </span>
                            </div>
                          ))}
                          {rec.items.debts.length > 0 && (
                            <div className="flex justify-between text-sm border-t border-border/40 pt-1.5 mt-1.5">
                              <span className="text-xs font-semibold text-muted-foreground">סה"כ</span>
                              <span className="text-rose-700 tabular-nums font-bold text-xs" dir="ltr">
                                −{fmt(rec.totalDebts)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 mb-2.5 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" /> פירוט חסכונות
                        </p>
                        <div className="space-y-2">
                          {rec.items.savings.map((s, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{s.name}</span>
                              <span className="text-emerald-600 tabular-nums font-medium" dir="ltr">
                                +{fmt(s.amount)}
                              </span>
                            </div>
                          ))}
                          {rec.items.savings.length > 0 && (
                            <div className="flex justify-between text-sm border-t border-border/40 pt-1.5 mt-1.5">
                              <span className="text-xs font-semibold text-muted-foreground">סה"כ</span>
                              <span className="text-emerald-700 tabular-nums font-bold text-xs" dir="ltr">
                                +{fmt(rec.totalSavings)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Add dialog ────────────────────────────────────────── */}
      <AddRecordDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        assets={assets}
        latestRecord={records[0] ?? null}
        onSave={handleSave}
      />

      {/* ── Delete confirm ────────────────────────────────────── */}
      <AlertDialog open={deleteId !== null} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> מחיקת רישום
            </AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את הרישום? פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Trash2 className="w-4 h-4 ml-1" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
