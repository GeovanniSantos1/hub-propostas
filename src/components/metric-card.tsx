import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react"

interface MetricCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  trend?: number
  className?: string
}

export function MetricCard({
  icon: Icon,
  value,
  label,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("gap-0", className)}>
      <CardContent className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-bold tracking-tight text-card-foreground">
            {value}
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
          {trend !== undefined && (
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend >= 0
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400"
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {trend >= 0 ? "+" : ""}
              {trend}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
