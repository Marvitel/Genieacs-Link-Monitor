import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = "text-primary" }: StatCardProps) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</span>
            <span className="text-2xl font-bold tracking-tight">{value}</span>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
            {trend && (
              <span className={`text-xs font-medium ${trend.positive ? "text-emerald-500" : "text-red-500"}`}>
                {trend.positive ? "+" : ""}{trend.value}% vs ontem
              </span>
            )}
          </div>
          <div className={`p-2.5 rounded-md bg-primary/10 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
