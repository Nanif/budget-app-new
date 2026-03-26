import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | ReactNode;
  icon?: ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, description, trend, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {icon && <div className="text-primary/80 bg-primary/10 p-2 rounded-lg">{icon}</div>}
        </div>
        
        <div className="mt-4 flex items-baseline gap-2">
          <h3 className="text-3xl font-display font-bold text-foreground">{value}</h3>
          
          {trend && (
            <span className={cn(
              "text-sm font-medium px-2 py-0.5 rounded-full flex items-center",
              trend.isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            )}>
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
            </span>
          )}
        </div>
        
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
