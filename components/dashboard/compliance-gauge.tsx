"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ComplianceGaugeProps {
  title: string
  value: number
  target: number
  subtitle?: string
  className?: string
}

export function ComplianceGauge({ title, value, target, subtitle, className }: ComplianceGaugeProps) {
  const percentage = Math.min((value / target) * 100, 100)
  const isCompliant = value >= target
  const strokeDasharray = `${percentage * 2.51327} 251.327`

  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-secondary"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              className={cn(
                "transition-all duration-500",
                isCompliant ? "text-primary" : "text-warning"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-card-foreground">{value}%</span>
            <span className="text-xs text-muted-foreground">of {target}%</span>
          </div>
        </div>
        {subtitle && <p className="mt-2 text-center text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
