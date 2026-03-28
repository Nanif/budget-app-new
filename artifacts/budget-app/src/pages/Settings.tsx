import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Settings = {
  id: number; userId: number; currency: string; locale: string; userName: string;
  monthlyBudget: number; tithePercentage: number; incomeBaseForTithe: number;
  activeBudgetYearId?: number | null; dateFormat: string; firstDayOfWeek: number;
  showDecimal: boolean; darkMode: boolean;
};

export default function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiFetch("/settings").then(setSettings).finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      userName: formData.get("userName") as string,
      currency: "ILS",
      monthlyBudget: Number(formData.get("monthlyBudget")),
      incomeBaseForTithe: Number(formData.get("incomeBaseForTithe")),
      tithePercentage: Number(formData.get("tithePercentage")),
    };
    try {
      const updated = await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setSettings(updated);
      toast({ title: "ההגדרות נשמרו בהצלחה!" });
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  if (isLoading) return <div className="p-8 text-center">טוען הגדרות...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="הגדרות מערכת" description="התאם אישית את העדפות המערכת שלך" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle>פרטים אישיים</CardTitle>
            <CardDescription>איך תרצה שהמערכת תקרא לך?</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="max-w-md grid gap-2">
              <Label htmlFor="userName">שם תצוגה</Label>
              <Input id="userName" name="userName" defaultValue={settings?.userName} className="rounded-xl" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle>הגדרות תקציב חודשי</CardTitle>
            <CardDescription>יעדי התקציב שלך</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="max-w-md grid gap-2">
              <Label htmlFor="monthlyBudget">יעד תקציב הוצאות חודשי (₪)</Label>
              <Input id="monthlyBudget" name="monthlyBudget" type="number" defaultValue={settings?.monthlyBudget} className="rounded-xl" dir="ltr" />
            </div>
            <div className="max-w-md grid gap-2">
              <Label>מטבע ברירת מחדל</Label>
              <Input value="₪ שקל חדש (ILS)" readOnly disabled className="rounded-xl bg-muted" />
              <p className="text-xs text-muted-foreground">כרגע נתמך שקל חדש (₪) בלבד.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm border-blue-100">
          <CardHeader className="bg-blue-50/50 border-b border-blue-100">
            <CardTitle className="text-blue-900">מעשר כספים</CardTitle>
            <CardDescription className="text-blue-700">הגדרות לחישוב אוטומטי של מעשר</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="max-w-md grid gap-2">
              <Label htmlFor="incomeBaseForTithe">הכנסה חודשית לחישוב מעשר (₪)</Label>
              <Input id="incomeBaseForTithe" name="incomeBaseForTithe" type="number" defaultValue={settings?.incomeBaseForTithe} className="rounded-xl border-blue-200 focus-visible:ring-blue-500" dir="ltr" />
              <p className="text-xs text-muted-foreground">הזן את משכורת הנטו שלך. אם מוגדר 0, יחושב לפי סך ההכנסות הרשומות.</p>
            </div>
            <div className="max-w-md grid gap-2">
              <Label htmlFor="tithePercentage">אחוז הפרשה לצדקה (%)</Label>
              <Input id="tithePercentage" name="tithePercentage" type="number" step="0.1" defaultValue={settings?.tithePercentage} className="rounded-xl border-blue-200 focus-visible:ring-blue-500" dir="ltr" />
              <p className="text-xs text-muted-foreground">בדרך כלל 10% (מעשר) או 20% (חומש).</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isSaving} className="rounded-xl shadow-sm gap-2">
            <Save className="w-4 h-4" />{isSaving ? "שומר..." : "שמור הגדרות"}
          </Button>
        </div>
      </form>
    </div>
  );
}
