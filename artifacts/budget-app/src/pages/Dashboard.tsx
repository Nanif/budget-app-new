import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { formatILS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, HeartHandshake, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6', '#10b981', '#ec4899', '#6366f1'];

type Summary = {
  totalIncome: number; totalExpenses: number; totalCharity: number; totalDebts: number;
  totalAssets: number; balance: number; monthlyBudget: number;
  expensesByCategory: { categoryName: string; total: number; color?: string }[];
  recentExpenses: { id: number; amount: number; description: string; date: string; categoryName?: string }[];
  upcomingTasks: { id: number; title: string; priority: string; dueDate?: string; status: string }[];
};

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/dashboard/summary`).then(r => r.json()).then(setSummary).finally(() => setIsLoading(false));
  }, []);

  const pieData = (summary?.expensesByCategory || []).map((item, i) => ({
    name: item.categoryName,
    value: item.total,
    color: item.color || COLORS[i % COLORS.length],
  }));

  const barData = [
    { name: 'הכנסות', amount: summary?.totalIncome || 0, fill: '#10b981' },
    { name: 'הוצאות', amount: summary?.totalExpenses || 0, fill: '#f43f5e' },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="דשבורד תקציבי" description="מבט על של המצב הפיננסי שלך לחודש הנוכחי" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="הכנסות" value={formatILS(summary?.totalIncome)} icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} className="border-emerald-100 bg-emerald-50/30" />
          <StatCard title="הוצאות" value={formatILS(summary?.totalExpenses)} icon={<TrendingDown className="w-5 h-5 text-rose-600" />} className="border-rose-100 bg-rose-50/30" />
          <StatCard title="מעשרות שניתנו" value={formatILS(summary?.totalCharity)} icon={<HeartHandshake className="w-5 h-5 text-blue-600" />} className="border-blue-100 bg-blue-50/30" />
          <StatCard title="יתרה חודשית" value={formatILS(summary?.balance)} icon={<Wallet className="w-5 h-5 text-primary" />} className="border-primary/20 bg-primary/5" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
            <CardTitle className="text-lg font-bold">התפלגות הוצאות לפי קטגוריה</CardTitle>
          </CardHeader>
          <CardContent className="p-6 h-[350px]" dir="ltr">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatILS(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground" dir="rtl">אין נתונים להצגה</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
            <CardTitle className="text-lg font-bold">הכנסות מול הוצאות</CardTitle>
          </CardHeader>
          <CardContent className="p-6 h-[350px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} tickFormatter={(val) => `₪${val}`} />
                <Tooltip formatter={(value: number) => formatILS(value)} cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard title="סה״כ חובות" value={formatILS(summary?.totalDebts)} icon={<CreditCard className="w-5 h-5 text-amber-600" />} />
        <StatCard title="סה״כ נכסים וחסכונות" value={formatILS(summary?.totalAssets)} icon={<PiggyBank className="w-5 h-5 text-indigo-600" />} />
      </div>
    </div>
  );
}
