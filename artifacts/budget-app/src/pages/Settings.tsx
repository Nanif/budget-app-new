import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const updateMut = useUpdateSettings({ 
    mutation: { 
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "ההגדרות נשמרו בהצלחה!" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateMut.mutate({
      data: {
        userName: formData.get("userName") as string,
        currency: formData.get("currency") as string,
        monthlyBudget: Number(formData.get("monthlyBudget")),
        incomeForTithe: Number(formData.get("incomeForTithe")),
        tithePercentage: Number(formData.get("tithePercentage")),
      }
    });
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
              <Label htmlFor="currency">מטבע ברירת מחדל</Label>
              <Input id="currency" name="currency" defaultValue={settings?.currency || 'ILS'} readOnly disabled className="rounded-xl bg-muted" />
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
              <Label htmlFor="incomeForTithe">הכנסה חודשית לחישוב מעשר (₪)</Label>
              <Input id="incomeForTithe" name="incomeForTithe" type="number" defaultValue={settings?.incomeForTithe} className="rounded-xl border-blue-200 focus-visible:ring-blue-500" dir="ltr" />
              <p className="text-xs text-muted-foreground">הזן את משכורת הנטו שלך אם תרצה חישוב מעשר קבוע. אם מוגדר 0, המערכת תחשב לפי סך ההכנסות הרשומות בחודש.</p>
            </div>
            <div className="max-w-md grid gap-2">
              <Label htmlFor="tithePercentage">אחוז הפרשה לצדקה (%)</Label>
              <Input id="tithePercentage" name="tithePercentage" type="number" defaultValue={settings?.tithePercentage} className="rounded-xl border-blue-200 focus-visible:ring-blue-500" dir="ltr" />
              <p className="text-xs text-muted-foreground">בדרך כלל 10% (מעשר) או 20% (חומש).</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={updateMut.isPending} className="rounded-xl px-8 py-6 text-lg font-bold shadow-lg gap-2">
            <Save className="w-5 h-5" />
            {updateMut.isPending ? "שומר..." : "שמור הגדרות"}
          </Button>
        </div>
      </form>
    </div>
  );
}
