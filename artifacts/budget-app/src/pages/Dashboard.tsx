import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { formatILS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, HeartHandshake, CreditCard,
  AlertTriangle, ChevronLeft, Coins, Target, ArrowLeft, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type MonthlyPoint = { month: string; monthNum: number; income: number; expenses: number; budget: number };
type CategoryBreakdown = { categoryName: string; categoryColor: string; total: number };
type FundStatus = {
  id: number; name: string; color: string; icon: string;
  budgetAmount: number; actualAmount: number; remaining: number;
  usagePercent: number; status: "ok" | "warning" | "over";
};
type AnnualData = {
  year: number; annualBudget: number; totalIncome: number; totalExpenses: number;
  totalCharity: number; annualBalance: number; savingsRate: number;
  monthlyData: MonthlyPoint[];
  categoryBreakdown: CategoryBreakdown[];
  fundStatus: FundStatus[];
  anomalies: CategoryBreakdown[];
};

const STATUS_COLORS = { ok: "bg-emerald-500", warning: "bg-amber-500", over: "bg-rose-500" };
const STATUS_TEXT = { ok: "תקין", warning: "קרוב לחריגה", over: "חריגה!" };
const STATUS_BG = { ok: "bg-emerald-50 border-emerald-100", warning: "bg-amber-50 border-amber-100", over: "bg-rose-50 border-rose-100" };
const STATUS_LABEL_COLOR = { ok: "text-emerald-700", warning: "text-amber-700", over: "text-rose-700" };
const PIE_COLORS = ["#0d9488","#0ea5e9","#f59e0b","#f43f5e","#8b5cf6","#10b981","#ec4899","#6366f1","#84cc16","#f97316"];

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-muted rounded-2xl", className)} />
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border/50 rounded-xl shadow-lg p-3 text-sm" dir="rtl">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold" dir="ltr">{formatILS(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState<AnnualData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear] = useState(new Date().getFullYear());
  const [activeFundIdx, setActiveFundIdx] = useState<number | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API}/dashboard/annual?year=${selectedYear}`)
      .then(r => r.json()).then(setData).finally(() => setIsLoading(false));
  }, [selectedYear]);

  const kpiCards = [
    {
      title: "תקציב שנתי", value: data?.annualBudget,
      icon: <Target className="w-5 h-5" />, color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-100", iconBg: "bg-indigo-100",
      sub: "תקציב מתוכנן לשנה",
    },
    {
      title: "הכנסות בפועל", value: data?.totalIncome,
      icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-100", iconBg: "bg-emerald-100",
      sub: data ? `${data.savingsRate}% שיעור חיסכון` : "",
    },
    {
      title: "הוצאות בפועל", value: data?.totalExpenses,
      icon: <TrendingDown className="w-5 h-5" />, color: "text-rose-600",
      bg: "bg-rose-50 border-rose-100", iconBg: "bg-rose-100",
      sub: data?.annualBudget
        ? `${Math.round((data.totalExpenses / data.annualBudget) * 100)}% מהתקציב`
        : "מסך ההוצאות השנתיות",
    },
    {
      title: "פער / איזון", value: data?.annualBalance,
      icon: <Wallet className="w-5 h-5" />,
      color: (data?.annualBalance ?? 0) >= 0 ? "text-primary" : "text-rose-600",
      bg: (data?.annualBalance ?? 0) >= 0 ? "bg-primary/5 border-primary/20" : "bg-rose-50 border-rose-100",
      iconBg: (data?.annualBalance ?? 0) >= 0 ? "bg-primary/10" : "bg-rose-100",
      sub: (data?.annualBalance ?? 0) >= 0 ? "מצב חיובי" : "חריגה מהתקציב",
    },
  ];

  const hasMonthlyData = data?.monthlyData.some(m => m.income > 0 || m.expenses > 0);
  const hasFunds = (data?.fundStatus.length ?? 0) > 0;
  const hasCategories = (data?.categoryBreakdown.length ?? 0) > 0;

  const pieData = (data?.categoryBreakdown || []).slice(0, 8).map((c, i) => ({
    name: c.categoryName, value: c.total, color: c.categoryColor || PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-8">
      <PageHeader title={`דשבורד תקציבי ${selectedYear}`} description="תמונת מצב שנתית מלאה של הכנסות, הוצאות וקופות" />

      {/* ─── KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {isLoading
          ? [1,2,3,4].map(i => <Skeleton key={i} className="h-36" />)
          : kpiCards.map((kpi, i) => (
            <div key={i} className={cn("rounded-2xl border p-5 space-y-3 hover:shadow-md transition-shadow", kpi.bg)}>
              <div className="flex items-center justify-between">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", kpi.iconBg, kpi.color)}>
                  {kpi.icon}
                </div>
                <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", kpi.iconBg, kpi.color)}>
                  {selectedYear}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{kpi.title}</p>
                <p className={cn("text-2xl font-display font-bold mt-0.5", kpi.color)} dir="ltr">
                  {formatILS(kpi.value)}
                </p>
              </div>
              {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
            </div>
          ))}
      </div>

      {/* ─── Monthly Chart ───────────────────────────────────────── */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="border-b border-border/50 bg-muted/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">הכנסות והוצאות לפי חודש</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">מגמה שנתית — {selectedYear}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"/> הכנסות</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-400 inline-block"/> הוצאות</span>
            {data?.annualBudget ? <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-dashed border-dashed border-indigo-400 border-t-2 inline-block w-5"/> תקציב</span> : null}
          </div>
        </CardHeader>
        <CardContent className="p-6 h-[300px]" dir="ltr">
          {isLoading ? <Skeleton className="h-full" /> : !hasMonthlyData ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2" dir="rtl">
              <BarChart3 className="w-10 h-10 opacity-30" />
              <p className="text-sm">אין נתוני גרף לשנה זו עדיין</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" name="הכנסות" stroke="#10b981" strokeWidth={2.5} fill="url(#incomeGrad)" dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
                <Area type="monotone" dataKey="expenses" name="הוצאות" stroke="#f43f5e" strokeWidth={2.5} fill="url(#expenseGrad)" dot={false} activeDot={{ r: 5, fill: "#f43f5e" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ─── Fund Status + Category Pie ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fund Status Overview — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">מצב קופות</h2>
              <p className="text-sm text-muted-foreground">ניצול תקציב לפי קופה</p>
            </div>
            <Link href="/savings" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
              ניהול קופות <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : !hasFunds ? (
            <Card className="border-dashed border-2 border-muted-foreground/20">
              <CardContent className="p-8 text-center text-muted-foreground space-y-3">
                <Coins className="w-12 h-12 mx-auto opacity-30" />
                <p className="font-medium">לא הוגדרו קופות עדיין</p>
                <p className="text-sm">הגדר קופות תקציביות כדי לעקוב אחר ביצועים</p>
                <Link href="/savings" className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline">
                  צור קופה ראשונה <ChevronLeft className="w-4 h-4" />
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data!.fundStatus.map((fund, i) => (
                <button key={fund.id} className={cn(
                  "w-full text-right rounded-2xl border p-4 hover:shadow-md transition-all",
                  activeFundIdx === i ? "ring-2 ring-primary/30 shadow-md" : "hover:border-border",
                  STATUS_BG[fund.status]
                )} onClick={() => setActiveFundIdx(activeFundIdx === i ? null : i)}>
                  <div className="flex items-center gap-4">
                    {/* Color indicator */}
                    <div className="w-1.5 h-12 rounded-full shrink-0" style={{ background: fund.color }} />

                    {/* Fund name & badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="font-bold text-sm truncate">{fund.name}</p>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", STATUS_LABEL_COLOR[fund.status],
                          fund.status === "ok" ? "bg-emerald-100" : fund.status === "warning" ? "bg-amber-100" : "bg-rose-100"
                        )}>{STATUS_TEXT[fund.status]}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white/80 rounded-full overflow-hidden border border-black/5">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", STATUS_COLORS[fund.status])}
                            style={{ width: `${fund.usagePercent}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-bold w-10 text-left shrink-0", STATUS_LABEL_COLOR[fund.status])}>
                          {fund.usagePercent}%
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-5 shrink-0 text-left">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">תקציב</p>
                        <p className="text-sm font-bold text-foreground" dir="ltr">{formatILS(fund.budgetAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">בוצע</p>
                        <p className="text-sm font-bold text-foreground" dir="ltr">{formatILS(fund.actualAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">נותר</p>
                        <p className={cn("text-sm font-bold", fund.remaining >= 0 ? "text-emerald-600" : "text-rose-600")} dir="ltr">
                          {fund.remaining >= 0 ? formatILS(fund.remaining) : `-${formatILS(Math.abs(fund.remaining))}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {activeFundIdx === i && (
                    <div className="mt-3 pt-3 border-t border-black/5 flex justify-between items-center text-xs text-muted-foreground">
                      <span>
                        {fund.budgetAmount > 0
                          ? `נוצלו ${formatILS(fund.actualAmount)} מתוך ${formatILS(fund.budgetAmount)}`
                          : "לא הוגדר תקציב לקופה זו"}
                      </span>
                      <Link href="/savings" className="text-primary font-medium hover:underline flex items-center gap-0.5">
                        פירוט מלא <ArrowLeft className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category Pie — 1/3 width */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">התפלגות הוצאות</h2>
            <p className="text-sm text-muted-foreground">לפי קטגוריה — שנתי</p>
          </div>
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 h-[290px]" dir="ltr">
              {isLoading ? <Skeleton className="h-full" /> : !hasCategories ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm" dir="rtl">אין נתונים</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="42%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatILS(v)} contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} formatter={(value) => <span dir="rtl">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Fund Cards Grid ──────────────────────────────────────── */}
      {!isLoading && hasFunds && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">כרטיסי קופות</h2>
            <p className="text-sm text-muted-foreground">מבט מפורט על כל קופה</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data!.fundStatus.map(fund => {
              const pct = fund.usagePercent;
              const isOver = fund.status === "over";
              return (
                <div key={fund.id} className={cn(
                  "rounded-2xl border p-5 space-y-4 hover:shadow-lg transition-all group cursor-pointer",
                  STATUS_BG[fund.status]
                )}>
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm text-base"
                        style={{ background: fund.color }}>
                        <Coins className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{fund.name}</p>
                        <span className={cn("text-[10px] font-bold", STATUS_LABEL_COLOR[fund.status])}>
                          {STATUS_TEXT[fund.status]}
                        </span>
                      </div>
                    </div>
                    <span className={cn("text-lg font-display font-black", STATUS_LABEL_COLOR[fund.status])}>
                      {pct}%
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="h-2.5 bg-white/70 rounded-full overflow-hidden border border-black/5">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", STATUS_COLORS[fund.status])}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      { label: "תקציב", value: fund.budgetAmount, color: "text-foreground" },
                      { label: "בוצע", value: fund.actualAmount, color: "text-foreground" },
                      { label: "נותר", value: Math.abs(fund.remaining), color: isOver ? "text-rose-600" : "text-emerald-600" },
                    ].map(m => (
                      <div key={m.label} className="bg-white/50 rounded-lg py-2 px-1">
                        <p className="text-[9px] text-muted-foreground font-medium">{m.label}</p>
                        <p className={cn("text-xs font-bold mt-0.5", m.color)} dir="ltr">{formatILS(m.value)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Action */}
                  <Link href="/savings" className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors group-hover:text-primary">
                    פתח פירוט <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Annual Summary + Anomalies ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Annual Summary */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-primary" /> סיכום שנתי {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-0 divide-y divide-border/50">
            {isLoading ? <Skeleton className="h-48" /> : [
              { label: "סך הכנסות", value: data!.totalIncome, color: "text-emerald-600", icon: <TrendingUp className="w-4 h-4" /> },
              { label: "סך הוצאות", value: data!.totalExpenses, color: "text-rose-600", icon: <TrendingDown className="w-4 h-4" /> },
              { label: "מעשרות ותרומות", value: data!.totalCharity, color: "text-blue-600", icon: <HeartHandshake className="w-4 h-4" /> },
              { label: "תקציב שנתי", value: data!.annualBudget, color: "text-indigo-600", icon: <Target className="w-4 h-4" /> },
              { label: "פער / איזון", value: data!.annualBalance, color: data!.annualBalance >= 0 ? "text-emerald-700" : "text-rose-700", icon: <Wallet className="w-4 h-4" />, bold: true },
            ].map((row, i) => (
              <div key={i} className={cn("flex items-center justify-between py-3", row.bold && "bg-muted/30 rounded-lg px-2 -mx-2 mt-1")}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={row.color}>{row.icon}</span>
                  <span className={row.bold ? "font-bold text-foreground" : ""}>{row.label}</span>
                </div>
                <span className={cn("font-bold", row.color, row.bold && "text-lg")} dir="ltr">
                  {formatILS(row.value)}
                </span>
              </div>
            ))}
            {!isLoading && (
              <div className="pt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">שיעור חיסכון</span>
                  <span className={cn("font-bold", (data?.savingsRate ?? 0) >= 20 ? "text-emerald-600" : (data?.savingsRate ?? 0) >= 0 ? "text-amber-600" : "text-rose-600")}>
                    {data?.savingsRate}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", (data?.savingsRate ?? 0) >= 20 ? "bg-emerald-500" : (data?.savingsRate ?? 0) >= 0 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${Math.min(100, Math.max(0, data?.savingsRate ?? 0))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">יעד מומלץ: 20%+</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anomalies */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> זיהוי חריגות
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">קטגוריות עם הוצאות גבוהות מהממוצע</p>
          </CardHeader>
          <CardContent className="p-5">
            {isLoading ? <Skeleton className="h-48" /> :
              !data?.anomalies.length ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <TrendingDown className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-emerald-700">אין חריגות!</p>
                  <p className="text-sm text-muted-foreground">ההוצאות מאוזנות בין הקטגוריות</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.anomalies.map((a, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.categoryColor }} />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{a.categoryName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: "75%" }} />
                          </div>
                          <span className="text-[10px] text-amber-600 font-bold">גבוה</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-rose-600 text-sm" dir="ltr">{formatILS(a.total)}</p>
                        <p className="text-[10px] text-muted-foreground">השנה</p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground text-center">
                      חריגות מוצגות עבור קטגוריות ב-150%+ מעל הממוצע
                    </p>
                  </div>
                </div>
              )
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
