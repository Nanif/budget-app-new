import { useState } from "react";
import { Plus, ChevronRight, Trash2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Math.abs(n));

const SNAPSHOTS = [
  {
    id: 1,
    date: "14.01.2026",
    totalDebts: 979294,
    totalSavings: 252043,
    netWorth: -727251,
    debts: [
      { name: "משכנתא", amount: 908144 },
      { name: "הלוואת עוגן", amount: 15500 },
      { name: "הלוואת גליק", amount: 20650 },
      { name: "הלוואה הראל", amount: 35000 },
    ],
    savings: [
      { name: "ק. השתלמות נעמי", amount: 109028 },
      { name: "ק. השתלמות יוסי", amount: 42688 },
      { name: "פיצויים", amount: 93215 },
      { name: "חיסכון", amount: 2962 },
      { name: "חיסכון לכל ילד", amount: 4150 },
    ],
  },
  {
    id: 2,
    date: "27.11.2025",
    totalDebts: 953757,
    totalSavings: 215138,
    netWorth: -738619,
    debts: [
      { name: "משכנתא", amount: 915675 },
      { name: "הלוואת עוגן", amount: 16500 },
      { name: "הלוואת גליק", amount: 21582 },
    ],
    savings: [
      { name: "ק. השתלמות נעמי", amount: 78666 },
      { name: "ק. השתלמות יוסי", amount: 37255 },
      { name: "פיצויים", amount: 92528 },
      { name: "חיסכון", amount: 3004 },
      { name: "חיסכון לכל ילד", amount: 3685 },
    ],
  },
  {
    id: 3,
    date: "01.07.2025",
    totalDebts: 976356,
    totalSavings: 173865,
    netWorth: -802491,
    debts: [],
    savings: [],
  },
  {
    id: 4,
    date: "12.02.2024",
    totalDebts: 1045780,
    totalSavings: 90125,
    netWorth: -955655,
    debts: [],
    savings: [],
  },
];

const BASE_DEBTS = [
  "יתרת משכנתא",
  "יתרת הלוואת עוגן",
  "יתרת הלוואת גליק",
];

const BASE_SAVINGS = [
  "ק. השתלמות נעמי",
  "ק. השתלמות יוסי",
  "פיצויים",
  "חיסכון",
  "חיסכון לכל ילד",
];

export function ProgressTrackingMockup() {
  const [expanded, setExpanded] = useState<number[]>([1]);
  const [showForm, setShowForm] = useState(false);
  const [removedDebts, setRemovedDebts] = useState<string[]>([]);
  const [removedSavings, setRemovedSavings] = useState<string[]>([]);
  const [extraDebts, setExtraDebts] = useState<{ name: string; amount: string }[]>([]);
  const [extraSavings, setExtraSavings] = useState<{ name: string; amount: string }[]>([]);

  const latest = SNAPSHOTS[0];
  const prev = SNAPSHOTS[1];
  const change = latest.netWorth - prev.netWorth;

  const toggleExpand = (id: number) =>
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const visibleDebts = BASE_DEBTS.filter((d) => !removedDebts.includes(d));
  const visibleSavings = BASE_SAVINGS.filter((s) => !removedSavings.includes(s));
  const hasRemoved = removedDebts.length > 0 || removedSavings.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-foreground">מעקב התקדמות בפועל</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            הוסף רישומים תקופתיים כדי לעקוב אחר ההתקדמות הפיננסית שלך
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          הוסף רישום חדש
        </button>
      </div>

      {/* Latest Snapshot Card */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">שווי נקי עדכני</p>
            <p className="text-3xl font-display font-bold text-rose-600 tabular-nums" dir="ltr">
              −{fmt(latest.netWorth)}
            </p>
          </div>
          <div className="text-start bg-muted/40 rounded-xl px-3 py-2 border border-border/40">
            <p className="text-xs text-muted-foreground mb-0.5">עדכון אחרון</p>
            <p className="text-sm font-semibold">{latest.date}</p>
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
            <p className="text-xs text-rose-600 font-medium mb-1">חובות</p>
            <p className="text-xl font-bold text-rose-700 tabular-nums" dir="ltr">
              −{fmt(latest.totalDebts)}
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 flex items-center gap-2">
          <span className={cn(
            "text-sm font-semibold flex items-center gap-1",
            change >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            {change >= 0 ? "▲" : "▼"}
            <span dir="ltr">{change >= 0 ? "+" : "−"}{fmt(change)}</span>
          </span>
          <p className="text-xs text-muted-foreground">
            שינוי מהעדכון הקודם ({prev.date})
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50">
          <p className="font-semibold text-sm">היסטוריית רישומים</p>
        </div>

        <div className="grid grid-cols-[28px_1fr_1fr_1fr_auto] gap-3 px-5 py-2 bg-muted/30 border-b border-border/40 text-xs font-medium text-muted-foreground">
          <span />
          <span>תאריך</span>
          <span>חובות</span>
          <span>חסכונות</span>
          <span>שווי נקי</span>
        </div>

        {SNAPSHOTS.map((snap, idx) => {
          const isOpen = expanded.includes(snap.id);
          const hasDet = snap.debts.length > 0 || snap.savings.length > 0;
          return (
            <div key={snap.id} className="border-b border-border/40 last:border-0">
              <div
                className="grid grid-cols-[28px_1fr_1fr_1fr_auto] gap-3 px-5 py-3 items-center hover:bg-muted/20 cursor-pointer transition-colors"
                onClick={() => hasDet && toggleExpand(snap.id)}
              >
                <div className={cn(
                  "w-5 h-5 flex items-center justify-center text-muted-foreground transition-transform",
                  isOpen && "rotate-90"
                )}>
                  {hasDet
                    ? <ChevronRight className="w-4 h-4" />
                    : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 block mx-auto" />
                  }
                </div>
                <span className="text-sm font-medium">{snap.date}</span>
                <span className="text-sm text-rose-600 tabular-nums" dir="ltr">−{fmt(snap.totalDebts)}</span>
                <span className="text-sm text-emerald-600 tabular-nums" dir="ltr">+{fmt(snap.totalSavings)}</span>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    snap.netWorth >= 0 ? "text-emerald-700" : "text-rose-700"
                  )} dir="ltr">
                    {snap.netWorth >= 0 ? "+" : "−"}{fmt(snap.netWorth)}
                  </span>
                  {idx > 0 && (
                    <button
                      className="text-muted-foreground hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50"
                      title="מחק"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {isOpen && hasDet && (
                <div className="bg-muted/20 border-t border-border/40 px-10 py-4 grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-semibold text-rose-600 mb-2">פירוט חובות בפועל</p>
                    <div className="space-y-1.5">
                      {snap.debts.map((d) => (
                        <div key={d.name} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{d.name}</span>
                          <span className="text-rose-600 tabular-nums font-medium" dir="ltr">−{fmt(d.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 mb-2">פירוט חסכונות בפועל</p>
                    <div className="space-y-1.5">
                      {snap.savings.map((s) => (
                        <div key={s.name} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{s.name}</span>
                          <span className="text-emerald-600 tabular-nums font-medium" dir="ltr">+{fmt(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border/60" dir="rtl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 sticky top-0 bg-card z-10">
              <h3 className="font-bold text-foreground">הוספת רישום חדש</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {hasRemoved && (
                <button
                  onClick={() => { setRemovedDebts([]); setRemovedSavings([]); }}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  שחזר שדות שהוסרו
                </button>
              )}

              {/* Debts */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">חובות בפועל (₪)</p>
                <div className="space-y-2">
                  {visibleDebts.map((d) => (
                    <div key={d} className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <label className="text-xs text-muted-foreground absolute -top-2 right-3 bg-card px-1 z-10">{d}</label>
                        <input
                          type="number"
                          defaultValue={0}
                          className="w-full border border-border rounded-lg px-3 pt-4 pb-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <button
                        onClick={() => setRemovedDebts((r) => [...r, d])}
                        className="text-muted-foreground/50 hover:text-rose-400 transition-colors p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {extraDebts.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="שם"
                        defaultValue={item.name}
                        className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        type="number"
                        defaultValue={0}
                        className="w-28 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                      />
                      <button
                        onClick={() => setExtraDebts((e) => e.filter((_, j) => j !== i))}
                        className="text-muted-foreground/50 hover:text-rose-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setExtraDebts((e) => [...e, { name: "", amount: "" }])}
                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mt-1"
                  >
                    <Plus className="w-4 h-4" /> חובות נוספים
                  </button>
                </div>
              </div>

              {/* Savings */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">חסכונות בפועל (₪)</p>
                <div className="space-y-2">
                  {visibleSavings.map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <label className="text-xs text-muted-foreground absolute -top-2 right-3 bg-card px-1 z-10">{s}</label>
                        <input
                          type="number"
                          defaultValue={0}
                          className="w-full border border-border rounded-lg px-3 pt-4 pb-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <button
                        onClick={() => setRemovedSavings((r) => [...r, s])}
                        className="text-muted-foreground/50 hover:text-rose-400 transition-colors p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {extraSavings.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="שם"
                        defaultValue={item.name}
                        className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                      />
                      <input
                        type="number"
                        defaultValue={0}
                        className="w-28 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                      />
                      <button
                        onClick={() => setExtraSavings((e) => e.filter((_, j) => j !== i))}
                        className="text-muted-foreground/50 hover:text-rose-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setExtraSavings((e) => [...e, { name: "", amount: "" }])}
                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mt-1"
                  >
                    <Plus className="w-4 h-4" /> חסכונות נוספים
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">תאריך</p>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
                />
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setShowForm(false)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                שמור רישום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
