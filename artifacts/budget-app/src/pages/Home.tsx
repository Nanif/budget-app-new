import { useState, useEffect, useRef } from "react";
import { formatILS } from "@/lib/format";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, ArrowLeft, Activity,
  HeartHandshake, CreditCard, CheckCircle2, Circle, Plus, StickyNote,
  ChevronRight, Pin, AlertTriangle, Check, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

type Summary = {
  totalIncome: number; totalExpenses: number; totalCharity: number;
  totalAssets: number; balance: number;
  upcomingTasks: { id: number; title: string; priority: string; dueDate?: string; status: string }[];
};
type Settings = { userName: string; tithePercentage: number; incomeBaseForTithe: number };
type Debt = { id: number; name: string; type: string; remainingAmount: number; totalAmount: number; status: string };
type Task = { id: number; title: string; priority: string; status: string; dueDate?: string };
type Note = { id: number; tabId: number; title: string; content: string; color: string; isPinned: boolean; updatedAt: string };
type NoteTab = { id: number; name: string; color: string };

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-rose-500", high: "bg-orange-500", medium: "bg-amber-400", low: "bg-emerald-400"
};
const PRIORITY_LABEL: Record<string, string> = { urgent: "דחוף", high: "גבוה", medium: "בינוני", low: "נמוך" };

export default function Home() {
  const { toast } = useToast();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteTabs, setNoteTabs] = useState<NoteTab[]>([]);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick-add states
  const [quickTaskInput, setQuickTaskInput] = useState("");
  const [quickTaskSaving, setQuickTaskSaving] = useState(false);
  const [quickCharityAmount, setQuickCharityAmount] = useState("");
  const [quickCharityRecipient, setQuickCharityRecipient] = useState("");
  const [charitySaving, setCharitySaving] = useState(false);
  const [showCharityForm, setShowCharityForm] = useState(false);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [sum, st, db, tk, nt, ntb] = await Promise.all([
        apiFetch("/dashboard/summary"),
        apiFetch("/settings"),
        apiFetch("/debts"),
        apiFetch("/reminders"),
        apiFetch("/notes"),
        apiFetch("/note-tabs"),
      ]);
      setSummary(sum); setSettings(st);
      setDebts(db); setTasks(tk); setNotes(nt); setNoteTabs(ntb);
      if (ntb.length > 0 && activeTab === null) setActiveTab(ntb[0].id);
    } catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // Derived data
  const incomeBase = settings?.incomeBaseForTithe || summary?.totalIncome || 0;
  const titheTarget = incomeBase * ((settings?.tithePercentage || 10) / 100);
  const titheGiven = summary?.totalCharity || 0;
  const titheRemaining = Math.max(0, titheTarget - titheGiven);
  const titheProgress = titheTarget > 0 ? Math.min(100, (titheGiven / titheTarget) * 100) : 0;

  const activeDebts = debts.filter(d => d.status === "active");
  const iOwe = activeDebts.filter(d => d.type === "i_owe");
  const owedToMe = activeDebts.filter(d => d.type === "owed_to_me");
  const iOweTotalRem = iOwe.reduce((a, d) => a + parseFloat(String(d.remainingAmount)), 0);
  const owedToMeTotalRem = owedToMe.reduce((a, d) => a + parseFloat(String(d.remainingAmount)), 0);

  const openTasks = tasks.filter(t => t.status !== "done").sort((a, b) =>
    (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0)
  );
  const importantTasks = openTasks.filter(t => t.priority === "urgent" || t.priority === "high");
  const regularTasks = openTasks.filter(t => t.priority === "medium" || t.priority === "low");

  const tabNotes = notes.filter(n => n.tabId === activeTab).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleQuickTask = async () => {
    if (!quickTaskInput.trim()) return;
    setQuickTaskSaving(true);
    try {
      const created = await apiFetch("/reminders", { method: "POST", body: JSON.stringify({ title: quickTaskInput.trim(), priority: "medium", status: "open" }) });
      setTasks(prev => [created, ...prev]);
      setQuickTaskInput("");
      toast({ title: "משימה נוספה" });
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setQuickTaskSaving(false); }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      const updated = await apiFetch(`/reminders/${task.id}/toggle`, { method: "PATCH" });
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  const handleQuickCharity = async () => {
    if (!quickCharityAmount || !quickCharityRecipient) return;
    setCharitySaving(true);
    try {
      await apiFetch("/charity", { method: "POST", body: JSON.stringify({
        amount: Number(quickCharityAmount), recipient: quickCharityRecipient,
        description: "", date: new Date().toISOString().split("T")[0], isTithe: true,
      })});
      toast({ title: "תרומה נרשמה!" });
      setQuickCharityAmount(""); setQuickCharityRecipient(""); setShowCharityForm(false);
      const sum = await apiFetch("/dashboard/summary");
      setSummary(sum);
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setCharitySaving(false); }
  };

  const userName = settings?.userName || "אורח";

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("animate-pulse bg-muted rounded-xl", className)} />
  );

  return (
    <div className="space-y-6">
      {/* ─── Hero Banner ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-7 md:p-10 shadow-xl shadow-primary/20">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="text-primary-foreground/70 text-sm font-medium mb-1">
              {new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">שלום, {userName}! 👋</h1>
            <p className="text-primary-foreground/80 text-sm md:text-base">מה המצב הפיננסי שלך היום?</p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center min-w-[100px]">
              <p className="text-xs text-primary-foreground/60 mb-0.5">הכנסות</p>
              <p className="font-bold font-display text-lg" dir="ltr">{isLoading ? "..." : formatILS(summary?.totalIncome)}</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center min-w-[100px]">
              <p className="text-xs text-primary-foreground/60 mb-0.5">הוצאות</p>
              <p className="font-bold font-display text-lg" dir="ltr">{isLoading ? "..." : formatILS(summary?.totalExpenses)}</p>
            </div>
            <div className={cn("border rounded-2xl px-4 py-3 text-center min-w-[100px]",
              (summary?.balance ?? 0) >= 0 ? "bg-emerald-500/20 border-emerald-400/30" : "bg-rose-500/20 border-rose-400/30"
            )}>
              <p className="text-xs text-primary-foreground/60 mb-0.5">יתרה</p>
              <p className="font-bold font-display text-lg" dir="ltr">{isLoading ? "..." : formatILS(summary?.balance)}</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex flex-wrap gap-3 mt-6">
          <Link href="/expenses" className="px-5 py-2.5 rounded-xl bg-white text-primary text-sm font-bold shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> הוסף הוצאה
          </Link>
          <Link href="/incomes" className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 transition-all inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> הוסף הכנסה
          </Link>
          <Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 transition-all inline-flex items-center gap-2">
            <Activity className="w-4 h-4" /> דשבורד מלא
          </Link>
        </div>
      </div>

      {/* ─── 4 Widget Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── 1. מעשרות ─────────────────────────────────────────────── */}
        <Card className="border-blue-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-l from-blue-50 to-card border-b border-blue-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/30">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-blue-900 text-sm">מעשרות</h2>
                <p className="text-xs text-blue-500">{settings?.tithePercentage || 10}% מההכנסות</p>
              </div>
            </div>
            <Link href="/charity" className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline">
              הכל <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-5 space-y-4">
            {isLoading ? (
              <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-3" /><Skeleton className="h-10" /></div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-blue-500 font-medium mb-1">בסיס הכנסה</p>
                    <p className="font-bold text-blue-800 text-sm" dir="ltr">{formatILS(incomeBase)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-emerald-600 font-medium mb-1">נתרם</p>
                    <p className="font-bold text-emerald-700 text-sm" dir="ltr">{formatILS(titheGiven)}</p>
                  </div>
                  <div className={cn("rounded-xl p-3 text-center", titheRemaining > 0 ? "bg-amber-50" : "bg-emerald-50")}>
                    <p className={cn("text-[10px] font-medium mb-1", titheRemaining > 0 ? "text-amber-600" : "text-emerald-600")}>נותר</p>
                    <p className={cn("font-bold text-sm", titheRemaining > 0 ? "text-amber-700" : "text-emerald-700")} dir="ltr">
                      {titheRemaining > 0 ? formatILS(titheRemaining) : "✓ הושלם"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>התקדמות מעשר</span>
                    <span className="font-medium text-blue-700">{titheProgress.toFixed(0)}% מתוך {formatILS(titheTarget)}</span>
                  </div>
                  <Progress value={titheProgress} className="h-2.5 bg-blue-100 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-blue-400 [&>div]:rounded-full" />
                </div>

                {showCharityForm ? (
                  <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-100 space-y-2">
                    <div className="flex gap-2">
                      <Input value={quickCharityAmount} onChange={e => setQuickCharityAmount(e.target.value)}
                        placeholder="סכום (₪)" type="number" className="rounded-lg text-sm h-8 border-blue-200 flex-1" dir="ltr" />
                      <Input value={quickCharityRecipient} onChange={e => setQuickCharityRecipient(e.target.value)}
                        placeholder="למי?" className="rounded-lg text-sm h-8 border-blue-200 flex-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleQuickCharity} disabled={charitySaving} size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-8 text-xs flex-1">
                        {charitySaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        <span className="mr-1">שמור</span>
                      </Button>
                      <Button onClick={() => setShowCharityForm(false)} size="sm" variant="ghost" className="rounded-lg h-8 text-xs">ביטול</Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowCharityForm(true)}
                    className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 text-xs font-medium border border-dashed border-blue-200 rounded-xl py-2 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> רשום תרומה מהירה
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── 2. חובות ──────────────────────────────────────────────── */}
        <Card className="border-amber-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-l from-amber-50 to-card border-b border-amber-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/30">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-amber-900 text-sm">חובות והלוואות</h2>
                <p className="text-xs text-amber-500">{activeDebts.length} רשומות פעילות</p>
              </div>
            </div>
            <Link href="/debts" className="text-xs font-medium text-amber-600 hover:text-amber-800 flex items-center gap-1 hover:underline">
              הכל <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-5 space-y-4">
            {isLoading ? (
              <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-24" /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                    <p className="text-xs text-rose-500 font-medium mb-1 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> אני חייב
                    </p>
                    <p className="font-bold text-rose-700 text-xl" dir="ltr">{formatILS(iOweTotalRem)}</p>
                    <p className="text-[10px] text-rose-400 mt-0.5">{iOwe.length} הלוואות</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> חייבים לי
                    </p>
                    <p className="font-bold text-emerald-700 text-xl" dir="ltr">{formatILS(owedToMeTotalRem)}</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">{owedToMe.length} הלוואות</p>
                  </div>
                </div>

                {activeDebts.length > 0 ? (
                  <div className="space-y-2">
                    {activeDebts.slice(0, 3).map(debt => {
                      const paidPercent = debt.totalAmount > 0 ? Math.max(0, 100 - (parseFloat(String(debt.remainingAmount)) / parseFloat(String(debt.totalAmount)) * 100)) : 0;
                      return (
                        <div key={debt.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/50">
                          <div className={cn("w-2 h-8 rounded-full shrink-0", debt.type === "i_owe" ? "bg-rose-400" : "bg-emerald-400")} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{debt.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full", debt.type === "i_owe" ? "bg-rose-400" : "bg-emerald-400")} style={{ width: `${paidPercent}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{paidPercent.toFixed(0)}%</span>
                            </div>
                          </div>
                          <span className={cn("font-bold text-sm shrink-0", debt.type === "i_owe" ? "text-rose-600" : "text-emerald-600")} dir="ltr">
                            {formatILS(parseFloat(String(debt.remainingAmount)))}
                          </span>
                        </div>
                      );
                    })}
                    {activeDebts.length > 3 && (
                      <Link href="/debts" className="block text-center text-xs text-muted-foreground hover:text-primary py-1">
                        +{activeDebts.length - 3} נוספים
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p>אין חובות פעילים</p>
                  </div>
                )}

                <Link href="/debts" className="flex items-center justify-center gap-2 text-amber-600 hover:text-amber-800 text-xs font-medium border border-dashed border-amber-200 rounded-xl py-2 hover:border-amber-400 hover:bg-amber-50 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> הוסף חוב / הלוואה
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── 3. תזכורות ────────────────────────────────────────────── */}
        <Card className="border-violet-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-l from-violet-50 to-card border-b border-violet-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm shadow-violet-600/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-violet-900 text-sm">משימות ותזכורות</h2>
                <p className="text-xs text-violet-500">{openTasks.length} פתוחות</p>
              </div>
            </div>
            <Link href="/reminders" className="text-xs font-medium text-violet-600 hover:text-violet-800 flex items-center gap-1 hover:underline">
              הכל <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <CardContent className="p-5 space-y-4">
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
            ) : (
              <>
                {/* Quick Add */}
                <div className="flex gap-2">
                  <Input
                    value={quickTaskInput}
                    onChange={e => setQuickTaskInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleQuickTask()}
                    placeholder="הוסף משימה חדשה..."
                    className="rounded-xl text-sm h-9 border-violet-200 focus-visible:ring-violet-400"
                  />
                  <Button onClick={handleQuickTask} disabled={quickTaskSaving || !quickTaskInput.trim()} size="sm"
                    className="rounded-xl h-9 bg-violet-600 hover:bg-violet-700 text-white px-3 shrink-0">
                    {quickTaskSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>

                {openTasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                    <p className="font-medium text-emerald-600">הכל נקי! אין משימות.</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[260px] overflow-y-auto">
                    {/* Important tasks */}
                    {importantTasks.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> דחוף / גבוה עדיפות
                        </p>
                        {importantTasks.slice(0, 3).map(task => (
                          <TaskRow key={task.id} task={task} onToggle={() => handleToggleTask(task)} />
                        ))}
                      </div>
                    )}
                    {/* Regular tasks */}
                    {regularTasks.length > 0 && (
                      <div>
                        {importantTasks.length > 0 && (
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 mt-3">שאר המשימות</p>
                        )}
                        {regularTasks.slice(0, 4).map(task => (
                          <TaskRow key={task.id} task={task} onToggle={() => handleToggleTask(task)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── 4. פתקים ──────────────────────────────────────────────── */}
        <Card className="border-amber-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-l from-yellow-50 to-card border-b border-yellow-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-white flex items-center justify-center shadow-sm shadow-amber-400/30">
                <StickyNote className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-amber-900 text-sm">פתקים</h2>
                <p className="text-xs text-amber-500">{notes.length} פתקים שמורים</p>
              </div>
            </div>
            <Link href="/notes" className="text-xs font-medium text-amber-600 hover:text-amber-800 flex items-center gap-1 hover:underline">
              הכל <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {/* Tabs */}
          {noteTabs.length > 0 && (
            <div className="flex gap-1 px-4 pt-3 border-b border-border/40 overflow-x-auto">
              {noteTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-t-lg border border-b-0 transition-all shrink-0",
                    activeTab === tab.id
                      ? "bg-card border-border/50 text-foreground shadow-sm"
                      : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          )}

          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-12" /></div>
            ) : tabNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <StickyNote className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                <p>אין פתקים בטאב זה</p>
                <Link href="/notes" className="text-xs text-primary hover:underline mt-1 inline-block">צור פתק חדש</Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {tabNotes.slice(0, 4).map(note => (
                  <Link href="/notes" key={note.id}
                    className={cn("block rounded-xl p-3 border hover:shadow-sm transition-all cursor-pointer group", note.color || "bg-amber-50 text-amber-900 border-amber-100")}>
                    <div className="flex items-start gap-2">
                      {note.isPinned && <Pin className="w-3 h-3 shrink-0 mt-0.5 opacity-50" />}
                      <div className="flex-1 min-w-0">
                        {note.title && <p className="font-semibold text-sm truncate">{note.title}</p>}
                        <p className="text-xs leading-relaxed opacity-80 line-clamp-2 whitespace-pre-wrap">{note.content}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 shrink-0 -rotate-180 mt-0.5" />
                    </div>
                    <p className="text-[10px] opacity-40 mt-1.5">{new Date(note.updatedAt).toLocaleDateString("he-IL")}</p>
                  </Link>
                ))}
                {tabNotes.length > 4 && (
                  <Link href="/notes" className="block text-center text-xs text-muted-foreground hover:text-primary py-1">
                    +{tabNotes.length - 4} פתקים נוספים
                  </Link>
                )}
              </div>
            )}

            <Link href="/notes"
              className="mt-3 flex items-center justify-center gap-2 text-amber-600 hover:text-amber-800 text-xs font-medium border border-dashed border-amber-200 rounded-xl py-2 hover:border-amber-400 hover:bg-amber-50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> הוסף פתק חדש
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── TaskRow sub-component ──────────────────────────────────────── */
function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const PRIORITY_COLOR: Record<string, string> = {
    urgent: "bg-rose-500", high: "bg-orange-400", medium: "bg-amber-400", low: "bg-emerald-400"
  };
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors group">
      <button onClick={onToggle} className="shrink-0 text-muted-foreground hover:text-violet-600 transition-colors">
        {task.status === "done" ? <CheckCircle2 className="w-4 h-4 text-violet-500" /> : <Circle className="w-4 h-4" />}
      </button>
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_COLOR[task.priority] || "bg-gray-300")} />
      <p className={cn("text-sm flex-1 truncate", task.status === "done" && "line-through text-muted-foreground")}>
        {task.title}
      </p>
      {task.dueDate && (
        <span className="text-[10px] text-muted-foreground shrink-0 hidden group-hover:block">
          {new Date(task.dueDate).toLocaleDateString("he-IL")}
        </span>
      )}
    </div>
  );
}
