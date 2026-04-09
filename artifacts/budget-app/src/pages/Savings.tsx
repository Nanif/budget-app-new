import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { ProgressTrackingSection } from "@/components/ProgressTrackingSection";

type AssetRecord = {
  id: number; name: string; type: string; category: string;
  currentAmount: number; targetAmount?: number | null;
  institution?: string | null; accountNumber?: string | null;
  notes: string; isActive: boolean; currency: string;
};

export default function NetWorth() {
  const { toast } = useToast();
  const { activeBid } = useBudgetYear();
  const [records, setRecords] = useState<AssetRecord[]>([]);

  useEffect(() => {
    apiFetch("/savings")
      .then(data => setRecords(data.map((r: any) => ({
        ...r,
        currentAmount: parseFloat(r.currentAmount),
        targetAmount:  r.targetAmount ? parseFloat(r.targetAmount) : null,
      }))))
      .catch(() => toast({ title: "שגיאה בטעינה", variant: "destructive" }));
  }, [activeBid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div dir="rtl">
      <PageHeader title="נכסים והתחייבויות" />
      <div className="mt-5">
        <ProgressTrackingSection assets={records} />
      </div>
    </div>
  );
}
