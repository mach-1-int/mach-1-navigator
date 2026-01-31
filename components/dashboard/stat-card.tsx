import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    direction: "up" | "down" | "stable"
  }
  icon?: LucideIcon
  variant?: "default" | "success" | "warning" | "destructive"
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const variantStyles = {
    default: "border-border",
    success: "border-l-4 border-l-primary",
    warning: "border-l-4 border-l-warning",
    destructive: "border-l-4 border-l-destructive",
  }

  return (
    <Card className={cn("bg-card", variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-card-foreground">{value}</div>
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "flex items-center text-xs font-medium",
                trend.direction === "up" && "text-primary",
                trend.direction === "down" && "text-destructive",
                trend.direction === "stable" && "text-muted-foreground"
              )}
            >
              {trend.direction === "up" && <TrendingUp className="mr-1 h-3 w-3" />}
              {trend.direction === "down" && <TrendingDown className="mr-1 h-3 w-3" />}
              {trend.direction === "stable" && <Minus className="mr-1 h-3 w-3" />}
              {trend.value > 0 ? "+" : ""}{trend.value}%
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
