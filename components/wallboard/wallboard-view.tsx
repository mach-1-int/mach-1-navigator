"use client"

/**
 * Wallboard (Phase 0 placeholder).
 * Workstream G-9 replaces this with the full-screen dark KPI board
 * (playbook §9.1): navigator units/day leaders, daily billing submitted rate,
 * funnel conversion, open tasks, open escalations, census, telenav overdue.
 * Compose-only — existing lib functions + reactive context, no new math.
 */

import { Monitor } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"

export function WallboardView() {
  const { navigatorTasks, escalations } = useDemoData()
  const openTasks = navigatorTasks.filter((t) => t.status === "open").length
  const openEscalations = escalations.filter((e) => e.status !== "resolved").length

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl bg-slate-950 p-10 text-white">
      <Monitor className="h-10 w-10 text-slate-400" />
      <h2 className="text-3xl font-bold tracking-tight">Wallboard</h2>
      <p className="text-slate-400">Daily KPI board — playbook §9.1</p>
      <div className="flex gap-8 pt-4 text-center">
        <div>
          <div className="text-4xl font-bold">{openTasks}</div>
          <div className="text-sm text-slate-400">open tasks</div>
        </div>
        <div>
          <div className="text-4xl font-bold">{openEscalations}</div>
          <div className="text-sm text-slate-400">open escalations</div>
        </div>
      </div>
      <p className="max-w-md pt-4 text-center text-sm text-slate-500">
        The full board lands in this blitz (workstream G-9): units/day leaders, daily billing
        submitted rate, funnel conversion, census, and telenavigation overdue count.
      </p>
    </div>
  )
}
