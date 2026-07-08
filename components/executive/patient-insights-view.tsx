"use client"

/**
 * Patient Insights view — minable clinical population data (condition
 * click-boxes, risk tiers, SDOH barrier prevalence, visit counts).
 * PHASE 0 PLACEHOLDER — workstream B-B replaces this component's contents.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"

export function PatientInsightsView() {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Users className="h-5 w-5 text-primary" />
          Patient Insights
        </CardTitle>
        <CardDescription>Population clinical insights — under construction this session</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Condition click-boxes, risk-tier distribution, SDOH barrier prevalence, and visit-count
          drill-downs are being built in this working session.
        </p>
      </CardContent>
    </Card>
  )
}
