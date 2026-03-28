import { useState, useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown,
  Landmark, PiggyBank, Car, Building2, BarChart3, CreditCard,
  Loader2, Check, ShieldAlert, StickyNote, AlertTriangle, X,
  CircleDollarSign, ArrowUpRight, ArrowDownRight, Scale, Wallet,
  ChevronDown, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API  = `${BASE}/api`;

/* ═══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
═══════════════════════════════════════════════════════════ */
type AssetRecord = {
  id: number; name: string; type: string; category: string;
  currentAmount: number; targetAmount?: number | null;
  institution?: string | null; accountNumber?: string | null;
  notes: string; isActive: boolean; currency: string;
};

/* Asset types — positive net-worth contributors */
const ASSET_TYPES: { value: string; label: string; Icon: React.ElementType; color: string; bg: string }[] = [
  { value: "savings",      label: "חיסכון / פיקדון",    Icon: PiggyBank,   color: "text-emerald-600", bg: "bg-emerald-100" },
  { value: "investment",   label: "השקעה / קופת גמל",  Icon: BarChart3,   color: "text-teal-600",    bg: "bg-teal-100"    },
  { value: "real_estate",  label: "נדל\"ן / דירה",      Icon: Building2,   color: "text-blue-600",    bg: "bg-blue-100"    },
  { value: "vehicle",      label: "רכב",                Icon: Car,         color: "text-sky-600",     bg: "bg-sky-100"     },
  { value: "other_asset",  label: "נכס אחר",             Icon: Wallet,      color: "text-indigo-600",  bg: "bg-indigo-100"  },
];

/* Liability types — reduce net worth */
const LIABILITY_TYPES: { value: string; label: string; Icon: React.ElementType; color: string; bg: string }[] = [
  { value: "mortgage",         label: "משכנתא",              Icon: Building2,   color: "text-rose-700",  bg: "bg-rose-100"   },
  { value: "bank_loan",        label: "הלוואה בנקאית",       Icon: Landmark,    color: "text-rose-600",  bg: "bg-rose-100"   },
  { value: "private_loan",     label: "הלוואה פרטית",        Icon: CreditCard,  color: "text-orange-600",bg: "bg-orange-100" },
  { value: "credit_balance",   label: "יתרת אשראי / חוב",   Icon: CreditCard,  color: "text-amber-600", bg: "bg-amber-100"  },
  { value: "other_liability",  label: "התחייבות אחרת",       Icon: Scale,       color: "text-red-600",   bg: "bg-red-100"    },
];

const ALL_TYPES = [...ASSET_TYPES, ...LIABILITY_TYPES];

function getTypeInfo(type: string) {
  return ALL_TYPES.find(t => t.value === type) ?? {
    value: type, label: type, Icon: Wallet, color: "text-muted-foreground", bg: "bg-muted"
  };
}

function isLiability(type: string) {
  return LIABILITY_TYPES.some(t => t.value === type);
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

function fmt(n: number, showSign = false) {
  const abs = new Intl.NumberFormat("he-IL", {
    style: "currency", currency: "ILS", maximumFractionDigits: 0,
  }).format(Math.abs(n));
  if (!showSign) return abs;
  return n >= 0 ? `+${abs}` : `−${abs}`;
}

/* ═══════════════════════════════════════════════════════════
   FORM
═══════════════════════════════════════════════════════════ */
type Side = "asset" | "liability";

type EntryForm = {
  side: Side; name: string; type: string; institution: string;
  currentAmount: string; targetAmount: string; notes: string;
};

const EMPTY_FORM: EntryForm = {
  side: "asset", name: "", type: "savings", institution: "",
  currentAmount: "", targetAmount: "", notes: "",
};

/* ═══════════════════════════════════════════════════════════
   NET WORTH BAR
═══════════════════════════════════════════════════════════ */
function NetWorthBar({ totalAssets, totalLiabilities }: { totalAssets: number; totalLiabilities: number }) {
  const total = totalAssets + totalLiabilities;
  const assetPct = total > 0 ? (totalAssets / total) * 100 : 100;
  const liabPct  = total > 0 ? (totalLiabilities / total) * 100 : 0;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> מאזן נכסים / חובות
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />נכסים</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />חובות</span>
        </div>
      </div>
      <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
        <div
          className="bg-emerald-500 transition-all duration-700 rounded-r-full"
          style={{ width: `${assetPct}%` }}
        />
        {liabPct > 0 && (
          <div
            className="bg-rose-500 transition-all duration-700 rounded-l-full"
            style={{ width: `${liabPct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span className="text-emerald-600 font-medium">{fmt(totalAssets)} ({assetPct.toFixed(0)}%)</span>
        <span className="text-rose-600 font-medium">{fmt(totalLiabilities)} ({liabPct.toFixed(0)}%)</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ITEM CARD
═══════════════════════════════════════════════════════════ */
function ItemCard({ item, onEdit, onDelete }: {
  item: AssetRecord; onEdit: () => void; onDelete: () => void;
}) {
  const info     = getTypeInfo(item.type);
  const liab     = isLiability(item.type);
  const Icon     = info.Icon;
  const paidAmt  = item.targetAmount ? item.targetAmount - item.currentAmount : null;
  const paidPct  = (item.targetAmount && paidAmt !== null) ? Math.max(0, Math.min(100, (paidAmt / item.targetAmount) * 100)) : null;
  const progress = (!liab && item.targetAmount) ? Math.min(100, (item.currentAmount / item.targetAmount) * 100) : null;

  return (
    <div className={cn(
      "bg-card rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all group relative",
      liab ? "border-rose-200/70 hover:border-rose-300" : "border-border/60 hover:border-primary/30"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", info.bg)}>
            <Icon className={cn("w-5 h-5", info.color)} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{item.name}</p>
            <p className={cn("text-xs font-medium", info.color)}>{info.label}</p>
            {item.institution && (
              <p className="text-xs text-muted-foreground truncate">{item.institution}</p>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity shrink-0">
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Amount */}
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-0.5">
          {liab ? "יתרה לתשלום" : "שווי נוכחי"}
        </p>
        <p className={cn(
          "text-2xl font-display font-bold tabular-nums",
          liab ? "text-rose-600" : "text-emerald-600"
        )} dir="ltr">
          {liab ? "−" : "+"}{fmt(item.currentAmount)}
        </p>
      </div>

      {/* Progress — liability: how much paid */}
      {liab && item.targetAmount && paidPct !== null && (
        <div className="bg-rose-50/50 border border-rose-200/50 rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">סכום מקורי: {fmt(item.targetAmount)}</span>
            <span className="text-emerald-600 font-medium">שולם {paidPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-rose-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      )}

      {/* Progress — asset: savings target */}
      {!liab && progress !== null && item.targetAmount && (
        <div className="bg-muted/30 border border-border/50 rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">יעד: {fmt(item.targetAmount)}</span>
            <span className="text-primary font-medium">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <p className="text-xs text-muted-foreground mt-2 truncate flex items-center gap-1">
          <StickyNote className="w-3 h-3 shrink-0" />{item.notes}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION
═══════════════════════════════════════════════════════════ */
function Section({
  title, total, items, color, onAdd, onEdit, onDelete, Icon, addLabel,
}: {
  title: string; total: number; items: AssetRecord[]; color: string;
  onAdd: () => void; onEdit: (item: AssetRecord) => void;
  onDelete: (item: AssetRecord) => void; Icon: React.ElementType; addLabel: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex-1 min-w-0">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 group"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown  className="w-4 h-4 text-muted-foreground" />
          }
          <Icon className={cn("w-4 h-4", color)} />
          <span className="font-bold">{title}</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{items.length}</span>
        </button>
        <div className="flex items-center gap-3">
          <span className={cn("font-bold text-lg tabular-nums", color)}>{fmt(total)}</span>
          <Button size="sm" onClick={onAdd} variant="outline" className="rounded-xl h-8 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />{addLabel}
          </Button>
        </div>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {items.length === 0 ? (
            <div
              className="col-span-full flex flex-col items-center justify-center py-10 border-2 border-dashed border-border/40 rounded-2xl text-center cursor-pointer hover:border-primary/30 hover:bg-muted/10 transition-all"
              onClick={onAdd}
            >
              <Icon className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">אין {title.toLowerCase()} רשומים</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">לחץ כדי להוסיף</p>
            </div>
          ) : (
            items.map(item => (
              <ItemCard key={item.id} item={item}
                onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DIALOG
═══════════════════════════════════════════════════════════ */
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-rose-600 mt-1 animate-in slide-in-from-top-1">
      <ShieldAlert className="w-3 h-3 shrink-0" />{msg}
    </p>
  );
}

function EntryDialog({
  open, onClose, editItem, form, setField, touch,
  errName, errAmount, saving, onSave,
}: {
  open: boolean; onClose: () => void; editItem: AssetRecord | null;
  form: EntryForm;
  setField: <K extends keyof EntryForm>(k: K, v: EntryForm[K]) => void;
  touch: (k: string) => void;
  errName: string; errAmount: string;
  saving: boolean; onSave: () => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => amountRef.current?.focus(), 80); }, [open]);

  const isLiab   = form.side === "liability";
  const typeList  = isLiab ? LIABILITY_TYPES : ASSET_TYPES;
  const accentCls = isLiab ? "bg-rose-600"   : "bg-emerald-600";
  const ringCls   = isLiab ? "focus-visible:ring-rose-300" : "focus-visible:ring-emerald-300";
  const Icon      = isLiab ? TrendingDown     : TrendingUp;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl border border-border/60" dir="rtl">

        {/* Header */}
        <div className={cn(
          "flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40",
          isLiab ? "bg-gradient-to-l from-rose-50/60 to-white" : "bg-gradient-to-l from-emerald-50/60 to-white"
        )}>
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0", accentCls)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold leading-tight">
              {editItem ? (isLiab ? "עריכת חוב" : "עריכת נכס") : (isLiab ? "חוב חדש" : "נכס חדש")}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLiab ? "הלוואה, משכנתא או התחייבות פיננסית" : "חיסכון, השקעה, נדל\"ן או נכס קבוע"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Side toggle */}
          {!editItem && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-2xl">
              {([
                { v: "asset",     label: "נכס",  Icon: TrendingUp,   cls: "bg-emerald-600" },
                { v: "liability", label: "חוב",  Icon: TrendingDown, cls: "bg-rose-600"    },
              ] as const).map(t => (
                <button key={t.v} type="button"
                  onClick={() => {
                    setField("side", t.v);
                    setField("type", t.v === "asset" ? "savings" : "mortgage");
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all",
                    form.side === t.v ? `${t.cls} text-white shadow-sm` : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <t.Icon className="w-4 h-4" />{t.label}
                </button>
              ))}
            </div>
          )}

          {/* Type */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">סוג {isLiab ? "חוב" : "נכס"}</Label>
            <Select value={form.type} onValueChange={v => setField("type", v)}>
              <SelectTrigger className={cn("rounded-2xl", ringCls)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {typeList.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              שם <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={e => setField("name", e.target.value)}
              onBlur={() => touch("name")}
              placeholder={isLiab ? "לדוגמה: משכנתא בנק הפועלים..." : "לדוגמה: פיקדון מזרחי..."}
              className={cn("rounded-2xl", errName ? "border-rose-400 bg-rose-50/40" : ringCls)}
            />
            <FieldError msg={errName} />
          </div>

          {/* Current amount */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              <CircleDollarSign className={cn("w-3.5 h-3.5", isLiab ? "text-rose-600" : "text-emerald-600")} />
              {isLiab ? "יתרה לתשלום (₪)" : "שווי נוכחי (₪)"}
              <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground select-none">₪</span>
              <Input
                ref={amountRef}
                type="number" dir="ltr" min="0" step="0.01"
                value={form.currentAmount}
                onChange={e => setField("currentAmount", e.target.value)}
                onBlur={() => touch("currentAmount")}
                placeholder="0"
                className={cn(
                  "pr-9 text-2xl font-bold h-14 rounded-2xl tabular-nums text-left",
                  errAmount ? "border-rose-400 focus-visible:ring-rose-300 bg-rose-50/40" : ringCls
                )}
              />
            </div>
            <FieldError msg={errAmount} />
          </div>

          {/* Target amount */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              {isLiab ? "סכום ההלוואה המקורי (₪)" : "יעד חיסכון (₪)"}
              <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
            </Label>
            <Input
              type="number" dir="ltr" min="0" step="0.01"
              value={form.targetAmount}
              onChange={e => setField("targetAmount", e.target.value)}
              placeholder="0"
              className={cn("rounded-2xl", ringCls)}
            />
            {isLiab && form.targetAmount && form.currentAmount && (
              <p className="text-xs text-muted-foreground mt-1">
                שולם: {fmt(Math.max(0, parseFloat(form.targetAmount) - parseFloat(form.currentAmount)))}
                {" "}({Math.max(0, Math.min(100, ((parseFloat(form.targetAmount) - parseFloat(form.currentAmount)) / parseFloat(form.targetAmount)) * 100)).toFixed(0)}%)
              </p>
            )}
          </div>

          {/* Institution */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              {isLiab ? "מוסד מלווה" : "מוסד / בנק"}
              <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
            </Label>
            <Input
              value={form.institution}
              onChange={e => setField("institution", e.target.value)}
              placeholder={isLiab ? "לדוגמה: בנק הפועלים..." : "לדוגמה: בנק לאומי..."}
              className={cn("rounded-2xl", ringCls)}
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1">
              <StickyNote className={cn("w-3.5 h-3.5", isLiab ? "text-rose-600" : "text-emerald-600")} />
              הערות
              <span className="text-xs font-normal text-muted-foreground mr-1">(אופציונלי)</span>
            </Label>
            <textarea
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              placeholder={isLiab ? "תשלום חודשי, תנאים..." : "הערות נוספות..."}
              rows={2}
              className={cn(
                "w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm resize-none",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                isLiab ? "focus-visible:ring-rose-300" : "focus-visible:ring-emerald-300"
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="outline" onClick={onClose} className="rounded-2xl flex-1 h-10">
            <X className="w-4 h-4 ml-1.5" /> ביטול
          </Button>
          <Button
            onClick={onSave} disabled={saving}
            className={cn(
              "rounded-2xl flex-1 h-10 text-white shadow-sm",
              isLiab ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" /> : <Check className="w-4 h-4 ml-1.5" />}
            {editItem ? "שמור שינויים" : (isLiab ? "הוסף חוב" : "הוסף נכס")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function NetWorth() {
  const { toast } = useToast();

  const [records,  setRecords]  = useState<AssetRecord[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [dialog,      setDialog]      = useState(false);
  const [editItem,    setEditItem]    = useState<AssetRecord | null>(null);
  const [form,        setForm]        = useState<EntryForm>({ ...EMPTY_FORM });
  const [touched,     setTouched]     = useState<Set<string>>(new Set());
  const [submitTried, setSubmitTried] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleteItem,  setDeleteItem]  = useState<AssetRecord | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/savings");
      setRecords(data.map((r: any) => ({
        ...r,
        currentAmount: parseFloat(r.currentAmount),
        targetAmount:  r.targetAmount ? parseFloat(r.targetAmount) : null,
      })));
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  /* ── computed ─────────────────────────────────────────────── */
  const assets      = useMemo(() => records.filter(r => !isLiability(r.type)), [records]);
  const liabilities = useMemo(() => records.filter(r => isLiability(r.type)),  [records]);

  const totalAssets      = useMemo(() => assets.reduce((s, r) => s + r.currentAmount, 0),      [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((s, r) => s + r.currentAmount, 0), [liabilities]);
  const netWorth         = totalAssets - totalLiabilities;

  /* ── dialog helpers ──────────────────────────────────────── */
  const openAdd = (side: Side = "asset") => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, side, type: side === "asset" ? "savings" : "mortgage" });
    setTouched(new Set()); setSubmitTried(false);
    setDialog(true);
  };
  const openEdit = (item: AssetRecord) => {
    setEditItem(item);
    setForm({
      side:          isLiability(item.type) ? "liability" : "asset",
      name:          item.name,
      type:          item.type,
      institution:   item.institution || "",
      currentAmount: String(item.currentAmount),
      targetAmount:  item.targetAmount ? String(item.targetAmount) : "",
      notes:         item.notes || "",
    });
    setTouched(new Set()); setSubmitTried(false);
    setDialog(true);
  };
  const setField = <K extends keyof EntryForm>(k: K, v: EntryForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setTouched(prev => new Set(prev).add(k));
  };
  const touch = (k: string) => setTouched(prev => new Set(prev).add(k));

  const showErr   = (k: string) => submitTried || touched.has(k);
  const errName   = showErr("name")          && !form.name.trim()                                          ? "שם הוא שדה חובה" : "";
  const errAmount = showErr("currentAmount") && (!form.currentAmount || parseFloat(form.currentAmount) < 0) ? "יש להזין סכום" : "";
  const isValid   = !errName && !errAmount && form.name.trim() && form.currentAmount;

  const saveEntry = async () => {
    setSubmitTried(true);
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        name:          form.name.trim(),
        type:          form.type,
        category:      isLiability(form.type) ? "חוב" : "נכס",
        institution:   form.institution.trim() || null,
        currentAmount: parseFloat(form.currentAmount),
        targetAmount:  form.targetAmount.trim() ? parseFloat(form.targetAmount) : null,
        notes:         form.notes,
        isActive:      true,
        currency:      "ILS",
      };
      if (editItem) {
        const updated = await apiFetch(`/savings/${editItem.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setRecords(prev => prev.map(r => r.id === editItem.id ? {
          ...updated,
          currentAmount: parseFloat(updated.currentAmount),
          targetAmount:  updated.targetAmount ? parseFloat(updated.targetAmount) : null,
        } : r));
        toast({ title: "עודכן בהצלחה" });
      } else {
        const created = await apiFetch("/savings", { method: "POST", body: JSON.stringify(payload) });
        setRecords(prev => [{
          ...created,
          currentAmount: parseFloat(created.currentAmount),
          targetAmount:  created.targetAmount ? parseFloat(created.targetAmount) : null,
        }, ...prev]);
        toast({ title: isLiability(form.type) ? "חוב נוסף" : "נכס נוסף" });
      }
      setDialog(false);
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await apiFetch(`/savings/${deleteItem.id}`, { method: "DELETE" });
      setRecords(prev => prev.filter(r => r.id !== deleteItem.id));
      toast({ title: "נמחק בהצלחה" });
      setDeleteItem(null);
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader title="חובות ונכסים" description="מעקב שווי נטו — נכסים מינוס התחייבויות">
        <div className="flex gap-2">
          <Button onClick={() => openAdd("liability")} variant="outline"
            className="rounded-xl gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50">
            <ArrowDownRight className="w-4 h-4" /> הוסף חוב
          </Button>
          <Button onClick={() => openAdd("asset")} className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <ArrowUpRight className="w-4 h-4" /> הוסף נכס
          </Button>
        </div>
      </PageHeader>

      {/* ══ KPI STRIP ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="סך נכסים"
          value={fmt(totalAssets)}
          sub={`${assets.length} פריטים`}
          iconBg="bg-emerald-100 text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KpiCard
          icon={<TrendingDown className="w-4 h-4" />}
          label="סך חובות"
          value={fmt(totalLiabilities)}
          sub={`${liabilities.length} פריטים`}
          iconBg="bg-rose-100 text-rose-600"
          valueColor="text-rose-600"
        />
        <KpiCard
          icon={<Scale className="w-4 h-4" />}
          label="שווי נטו"
          value={fmt(Math.abs(netWorth))}
          valuePrefix={netWorth >= 0 ? "+" : "−"}
          sub={netWorth >= 0 ? "מצב חיובי" : "חובות עולים על נכסים"}
          iconBg={netWorth >= 0 ? "bg-teal-100 text-teal-600" : "bg-amber-100 text-amber-600"}
          valueColor={netWorth >= 0 ? "text-teal-600" : "text-amber-600"}
          large
        />
        <KpiCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="יחס חובות לנכסים"
          value={totalAssets > 0 ? `${((totalLiabilities / totalAssets) * 100).toFixed(0)}%` : "—"}
          sub="מתחת ל-40% — טוב"
          iconBg="bg-violet-100 text-violet-600"
          valueColor={totalAssets > 0 && (totalLiabilities / totalAssets) > 0.4 ? "text-amber-600" : "text-violet-600"}
        />
      </div>

      {/* ══ NET WORTH BAR ═══════════════════════════════════════ */}
      <NetWorthBar totalAssets={totalAssets} totalLiabilities={totalLiabilities} />

      {/* ══ TWO SECTIONS ═══════════════════════════════════════ */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <Section
            title="נכסים" total={totalAssets} items={assets}
            color="text-emerald-600" Icon={TrendingUp} addLabel="נכס"
            onAdd={() => openAdd("asset")}
            onEdit={openEdit}
            onDelete={setDeleteItem}
          />
          <Section
            title="חובות והתחייבויות" total={totalLiabilities} items={liabilities}
            color="text-rose-600" Icon={TrendingDown} addLabel="חוב"
            onAdd={() => openAdd("liability")}
            onEdit={openEdit}
            onDelete={setDeleteItem}
          />
        </div>
      )}

      {/* ══ DIALOG ══════════════════════════════════════════════ */}
      <EntryDialog
        open={dialog}
        onClose={() => setDialog(false)}
        editItem={editItem}
        form={form}
        setField={setField}
        touch={touch}
        errName={errName}
        errAmount={errAmount}
        saving={saving}
        onSave={saveEntry}
      />

      {/* ══ DELETE CONFIRM ═════════════════════════════════════ */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" /> מחיקת {deleteItem && isLiability(deleteItem.type) ? "חוב" : "נכס"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            האם אתה בטוח שברצונך למחוק את <strong>{deleteItem?.name}</strong>? פעולה זו אינה ניתנת לביטול.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)} className="rounded-xl flex-1">ביטול</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="rounded-xl flex-1">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Trash2 className="w-4 h-4 ml-1" />}
              מחק
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   KPI CARD (local)
═══════════════════════════════════════════════════════════ */
function KpiCard({ icon, label, value, sub, iconBg, valueColor, valuePrefix, large }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  iconBg: string; valueColor?: string; valuePrefix?: string; large?: boolean;
}) {
  return (
    <div className={cn(
      "bg-card rounded-2xl border border-border/60 p-4 shadow-sm",
      large && "ring-2 ring-primary/10"
    )}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", iconBg)}>{icon}</div>
      </div>
      <p className={cn("font-display font-bold tabular-nums", large ? "text-2xl" : "text-xl", valueColor)}>
        {valuePrefix}{value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
