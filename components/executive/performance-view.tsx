"use client"

/**
 * Performance view — navigator productivity vs Gellert level targets (16/18/20
 * units/day) + Playbook KPI board.
 * PHASE 0 PLACEHOLDER — workstream B-B replaces this component's contents.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity } from "lucide-react"

export function PerformanceView() {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Activity className="h-5 w-5 text-primary" />
          Performance Metrics
        </CardTitle>
        <CardDescription>Navigator productivity and Playbook KPIs — under construction this session</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Per-navigator daily units against level-based targets, day-close rates, and the
          Operating Playbook KPI board are being built in this working session.
        </p>
      </CardContent>
    </Card>
  )
}
