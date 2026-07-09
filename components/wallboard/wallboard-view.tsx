"use client"

/**
 * Wallboard — Full-screen Daily KPI Board (playbook §9.1).
 * Workstream G-9: compose-only implementation using existing lib functions + reactive context.
 */

import { useMemo } from "react"
import { useDemoData } from "@/lib/demo-data-context"
import { computeNavigatorProductivity } from "@/lib/navigator-productivity"
import { dailyBillingSubmittedRate } from "@/lib/charge-slips"
import { computeFunnel } from "@/lib/referral-funnel"
import { computeCensus } from "@/lib/executive-metrics"
import { telenavCheckInStatus } from "@/lib/journey"

export function WallboardView() {
  const {
    navigators,
    timeLogs,
    chargeSlips,
    activePayerConfig,
    patients,
    referrals,
    navigatorTasks,
    escalations,
  } = useDemoData()

  const kpis = useMemo(() => {
    if (!activePayerConfig) return null

    // 1. Units today (top navigators) — top 3 by avgUnitsPerDay
    const productivity = computeNavigatorProductivity(navigators, timeLogs, chargeSlips, activePayerConfig, 1)
    const topNavigators = productivity
      .sort((a, b) => b.avgUnitsPerDay - a.avgUnitsPerDay)
      .slice(0, 3)

    // 2. Day-close rate (30d)
    const dayCloseRate = dailyBillingSubmittedRate(chargeSlips, timeLogs, 30)

    // 3. Referral conversion
    const funnel = computeFunnel(referrals)
    const conversionRate = funnel.conversionRate

    // 4. Open tasks
    const openTasksCount = navigatorTasks.filter((t) => t.status === "open").length

    // 5. Open escalations
    const openEscalationsCount = escalations.filter((e) => e.status !== "resolved").length

    // 6. Active census
    const census = computeCensus(patients)
    const activeCensus = census.active

    // 7. Telenav check-ins overdue
    const telenavOverdue = patients.filter((p) => {
      const status = telenavCheckInStatus(p)
      return status && status.status === "overdue"
    }).length

    return {
      topNavigators,
      dayCloseRate,
      conversionRate,
      openTasksCount,
      openEscalationsCount,
      activeCensus,
      telenavOverdue,
    }
  }, [navigators, timeLogs, chargeSlips, activePayerConfig, patients, referrals, navigatorTasks, escalations])

  if (!kpis) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-6xl font-bold tracking-tight mb-2">Daily KPI Board</h1>
        <p className="text-slate-400">Real-time operational metrics</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Tile 1: Units today (top navigators) */}
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="text-sm uppercase tracking-widest text-slate-400 mb-4">Units Today</div>
          <div className="space-y-3">
            {kpis.topNavigators.map((nav) => (
              <div key={nav.navigatorId} className="flex justify-between items-baseline">
                <span className="text-slate-300">{nav.name}</span>
                <span className="text-4xl font-bold">{nav.avgUnitsPerDay}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tile 2: Day-close rate (30d) */}
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="text-sm uppercase tracking-widest text-slate-400 mb-4">Day-Close Rate (30d)</div>
          <div className="text-6xl font-bold">{kpis.dayCloseRate}%</div>
        </div>

        {/* Tile 3: Referral conversion */}
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="text-sm uppercase tracking-widest text-slate-400 mb-4">Referral Conversion</div>
          <div className="text-6xl font-bold">{kpis.conversionRate}%</div>
        </div>

        {/* Tile 4: Open tasks */}
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="text-sm uppercase tracking-widest text-slate-400 mb-4">Open Tasks</div>
          <div className="text-6xl font-bold">{kpis.openTasksCount}</div>
        </div>

        {/* Tile 5: Open escalations */}
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="text-sm uppercase tracking-widest text-slate-400 mb-4">Open Escalations</div>
          <div className="text-6xl font-bold">{kpis.openEscalationsCount}</div>
        </div>

        {/* Tile 6: Active census */}
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="text-sm uppercase tracking-widest text-slate-400 mb-4">Active Census</div>
          <div className="text-6xl font-bold">{kpis.activeCensus}</div>
        </div>

        {/* Tile 7: Telenav check-ins overdue */}
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="text-sm uppercase tracking-widest text-slate-400 mb-4">Telenav Overdue</div>
          <div className="text-6xl font-bold">{kpis.telenavOverdue}</div>
        </div>
      </div>

      {/* Footer caption */}
      <div className="text-center text-slate-500 text-sm mt-12">
        Daily KPI board — Gellert playbook §9.1 · live from demo data
      </div>
    </div>
  )
}
