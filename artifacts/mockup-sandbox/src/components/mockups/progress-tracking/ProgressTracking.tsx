import { useState } from "react";

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

const FORM_DEBTS = [
  { name: "יתרת משכנתא" },
  { name: "יתרת הלוואת עוגן" },
  { name: "יתרת הלוואת גליק" },
];

const FORM_SAVINGS = [
  { name: "ק. השתלמות נעמי" },
  { name: "ק. השתלמות יוסי" },
  { name: "פיצויים" },
  { name: "חיסכון" },
  { name: "חיסכון לכל ילד" },
];

export function ProgressTracking() {
  const [expanded, setExpanded] = useState<number[]>([1]);
  const [showForm, setShowForm] = useState(false);
  const [removedDebts, setRemovedDebts] = useState<string[]>([]);
  const [removedSavings, setRemovedSavings] = useState<string[]>([]);
  const [extraDebts, setExtraDebts] = useState<string[]>([]);
  const [extraSavings, setExtraSavings] = useState<string[]>([]);

  const latest = SNAPSHOTS[0];
  const prev = SNAPSHOTS[1];
  const change = latest.netWorth - prev.netWorth;

  const toggleExpand = (id: number) =>
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const visibleDebts = FORM_DEBTS.filter((d) => !removedDebts.includes(d.name));
  const visibleSavings = FORM_SAVINGS.filter((s) => !removedSavings.includes(s.name));
  const hasRemoved = removedDebts.length > 0 || removedSavings.length > 0;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">מעקב התקדמות בפועל</h2>
            <p className="text-sm text-slate-500 mt-0.5">הוסף רישומים תקופתיים כדי לעקוב אחר ההתקדמות הפיננסית שלך</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            הוסף רישום חדש
          </button>
        </div>

        {/* Latest Snapshot Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-sm text-slate-500 mb-1">שווי נקי עדכני</p>
              <p className="text-4xl font-bold text-rose-600 tabular-nums" dir="ltr">
                −{fmt(latest.netWorth)}
              </p>
            </div>
            <div className="text-left bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
              <p className="text-xs text-slate-400 mb-0.5">עדכון אחרון</p>
              <p className="text-sm font-semibold text-slate-700">{latest.date}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium mb-1">חסכונות</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums" dir="ltr">
                +{fmt(latest.totalSavings)}
              </p>
            </div>
            <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
              <p className="text-xs text-rose-600 font-medium mb-1">חובות</p>
              <p className="text-2xl font-bold text-rose-700 tabular-nums" dir="ltr">
                −{fmt(latest.totalDebts)}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-sm font-semibold ${change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              <span>{change >= 0 ? "▲" : "▼"}</span>
              <span dir="ltr">{change >= 0 ? "+" : "−"}{fmt(change)}</span>
            </div>
            <p className="text-sm text-slate-400">
              שינוי מהעדכון הקודם ({prev.date})
            </p>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 text-sm">היסטוריית רישומים</h3>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500">
            <span className="w-6" />
            <span>תאריך</span>
            <span>חובות</span>
            <span>חסכונות</span>
            <span>שווי נקי</span>
          </div>

          {SNAPSHOTS.map((snap, idx) => {
            const isOpen = expanded.includes(snap.id);
            const hasDet = snap.debts.length > 0 || snap.savings.length > 0;
            return (
              <div key={snap.id} className="border-b border-slate-100 last:border-0">
                {/* Row */}
                <div
                  className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 cursor-pointer"
                  onClick={() => hasDet && toggleExpand(snap.id)}
                >
                  <button
                    className={`w-5 h-5 flex items-center justify-center text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    {hasDet ? "▶" : <span className="w-1 h-1 rounded-full bg-slate-300 mx-auto block" />}
                  </button>
                  <span className="text-sm font-medium text-slate-700">{snap.date}</span>
                  <span className="text-sm text-rose-600 tabular-nums" dir="ltr">−{fmt(snap.totalDebts)}</span>
                  <span className="text-sm text-emerald-600 tabular-nums" dir="ltr">+{fmt(snap.totalSavings)}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold tabular-nums ${snap.netWorth >= 0 ? "text-emerald-700" : "text-rose-700"}`} dir="ltr">
                      {snap.netWorth >= 0 ? "+" : "−"}{fmt(snap.netWorth)}
                    </span>
                    {idx > 0 && (
                      <button
                        className="text-xs text-slate-400 hover:text-rose-500 transition-colors px-1"
                        title="מחק"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isOpen && hasDet && (
                  <div className="bg-slate-50 border-t border-slate-100 px-10 py-4 grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-xs font-semibold text-rose-600 mb-2">פירוט חובות בפועל</p>
                      <div className="space-y-1.5">
                        {snap.debts.map((d) => (
                          <div key={d.name} className="flex justify-between text-sm">
                            <span className="text-slate-600">{d.name}</span>
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
                            <span className="text-slate-600">{s.name}</span>
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

        {/* Add Entry Form (Dialog Simulation) */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <h3 className="font-bold text-slate-800">הוספת רישום חדש</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
              </div>

              <div className="px-6 py-5 space-y-6">
                {/* Restore removed */}
                {hasRemoved && (
                  <button
                    onClick={() => { setRemovedDebts([]); setRemovedSavings([]); }}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    שחזר שדות שהוסרו ×
                  </button>
                )}

                {/* Debts */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">חובות בפועל (₪)</p>
                  <div className="space-y-2">
                    {visibleDebts.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <label className="text-xs text-slate-500 absolute -top-2 right-3 bg-white px-1">{d.name}</label>
                          <input
                            type="number"
                            defaultValue={0}
                            className="w-full border border-slate-200 rounded-lg px-3 pt-4 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                        <button
                          onClick={() => setRemovedDebts((r) => [...r, d.name])}
                          className="text-slate-300 hover:text-rose-400 transition-colors text-lg leading-none"
                        >×</button>
                      </div>
                    ))}
                    {extraDebts.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="שם"
                          defaultValue={name}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <input
                          type="number"
                          defaultValue={0}
                          className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => setExtraDebts((e) => e.filter((_, j) => j !== i))}
                          className="text-slate-300 hover:text-rose-400 text-lg leading-none"
                        >×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => setExtraDebts((e) => [...e, ""])}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                    >
                      <span className="text-lg leading-none">+</span> חובות נוספים
                    </button>
                  </div>
                </div>

                {/* Savings */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">חסכונות בפועל (₪)</p>
                  <div className="space-y-2">
                    {visibleSavings.map((s) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <label className="text-xs text-slate-500 absolute -top-2 right-3 bg-white px-1">{s.name}</label>
                          <input
                            type="number"
                            defaultValue={0}
                            className="w-full border border-slate-200 rounded-lg px-3 pt-4 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                        <button
                          onClick={() => setRemovedSavings((r) => [...r, s.name])}
                          className="text-slate-300 hover:text-rose-400 transition-colors text-lg leading-none"
                        >×</button>
                      </div>
                    ))}
                    {extraSavings.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="שם"
                          defaultValue={name}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="number"
                          defaultValue={0}
                          className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => setExtraSavings((e) => e.filter((_, j) => j !== i))}
                          className="text-slate-300 hover:text-rose-400 text-lg leading-none"
                        >×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => setExtraSavings((e) => [...e, ""])}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                    >
                      <span className="text-lg leading-none">+</span> חסכונות נוספים
                    </button>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">תאריך</p>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full"
                  />
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  שמור רישום
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
