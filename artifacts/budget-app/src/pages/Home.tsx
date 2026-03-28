import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { formatILS } from "@/lib/format";
import { Wallet, TrendingUp, PiggyBank, ArrowRight, Activity, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Summary = {
  totalIncome: number; totalExpenses: number; totalCharity: number; totalDebts: number;
  totalAssets: number; balance: number; monthlyBudget: number;
  recentExpenses: { id: number; amount: number; description: string; date: string; categoryName?: string; categoryColor?: string }[];
  upcomingTasks: { id: number; title: string; priority: string; dueDate?: string; status: string }[];
};

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<{ userName?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/dashboard/summary`).then(r => r.json()),
      fetch(`${API}/settings`).then(r => r.json()),
    ]).then(([s, st]) => { setSummary(s); setSettings(st); }).finally(() => setIsLoading(false));
  }, []);

  const userName = settings?.userName || "אורח";

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 md:p-12 shadow-xl shadow-primary/20">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">שלום, {userName}! 👋</h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 leading-relaxed">
            ברוך הבא למערכת ניהול התקציב שלך. קבל תמונת מצב מלאה על הכסף שלך, תכנן קדימה והשג את היעדים הכלכליים שלך.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/expenses" className="px-6 py-3 rounded-xl bg-white text-primary font-bold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2">
              הוסף הוצאה <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard" className="px-6 py-3 rounded-xl bg-primary-foreground/10 text-white font-bold hover:bg-primary-foreground/20 backdrop-blur-sm transition-all duration-200 inline-flex items-center gap-2 border border-white/10">
              צפה בדשבורד <Activity className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-300 border-border/50">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4"><TrendingUp className="w-6 h-6" /></div>
            <h3 className="font-bold text-lg mb-1">הכנסות החודש</h3>
            <p className="text-3xl font-display font-bold text-foreground">{isLoading ? "..." : formatILS(summary?.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300 border-border/50">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4"><Wallet className="w-6 h-6" /></div>
            <h3 className="font-bold text-lg mb-1">הוצאות החודש</h3>
            <p className="text-3xl font-display font-bold text-foreground">{isLoading ? "..." : formatILS(summary?.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300 border-border/50 bg-gradient-to-br from-card to-secondary">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4"><PiggyBank className="w-6 h-6" /></div>
            <h3 className="font-bold text-lg mb-1">יתרה נוכחית</h3>
            <p className="text-3xl font-display font-bold text-foreground">{isLoading ? "..." : formatILS(summary?.balance)}</p>
            {summary?.balance !== undefined && (
              <p className={cn("text-sm mt-2 font-medium", summary.balance >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {summary.balance >= 0 ? "מצבך מעולה! המשך כך." : "שים לב, אתה בחריגה החודש."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/30">
            <h3 className="font-bold text-lg">תזכורות קרובות</h3>
            <Link href="/reminders" className="text-sm font-medium text-primary hover:underline">הכל</Link>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">טוען...</div>
            ) : summary?.upcomingTasks?.length ? (
              <div className="divide-y divide-border/50">
                {summary.upcomingTasks.slice(0, 4).map(task => (
                  <div key={task.id} className="p-4 px-6 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                    <div className={cn("w-3 h-3 rounded-full shrink-0",
                      task.priority === 'urgent' || task.priority === 'high' ? "bg-rose-500" :
                      task.priority === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium truncate", task.status === 'done' && "line-through text-muted-foreground")}>{task.title}</p>
                      {task.dueDate && <p className="text-xs text-muted-foreground mt-0.5">{new Date(task.dueDate).toLocaleDateString('he-IL')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">אין תזכורות קרובות</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/30">
            <h3 className="font-bold text-lg">הוצאות אחרונות</h3>
            <Link href="/expenses" className="text-sm font-medium text-primary hover:underline">הכל</Link>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">טוען...</div>
            ) : summary?.recentExpenses?.length ? (
              <div className="divide-y divide-border/50">
                {summary.recentExpenses.slice(0, 4).map(exp => (
                  <div key={exp.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: exp.categoryColor || '#94a3b8' }}>
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{exp.description || exp.categoryName || "הוצאה"}</p>
                        <p className="text-xs text-muted-foreground">{new Date(exp.date).toLocaleDateString('he-IL')} • {exp.categoryName || "ללא קטגוריה"}</p>
                      </div>
                    </div>
                    <span className="font-bold text-rose-600" dir="ltr">-{formatILS(exp.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">אין הוצאות לאחרונה</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
