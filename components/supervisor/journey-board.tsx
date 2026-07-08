"use client"

/**
 * Journey Board — kanban of the Gellert WorkFlow2025 phases.
 * PHASE 0 PLACEHOLDER — workstream J-B replaces this component's contents
 * (phase columns, patient cards with phase-relevant stats, click-through).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Route } from "lucide-react"

export function JourneyBoard() {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Route className="h-5 w-5 text-primary" />
          Journey Board
        </CardTitle>
        <CardDescription>The WorkFlow2025 phase board — under construction this session</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          The kanban view of every patient across Intake, Active Navigation, Telenavigation, and
          Exited is being built in this working session.
        </p>
      </CardContent>
    </Card>
  )
}
