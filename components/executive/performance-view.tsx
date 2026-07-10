"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClipboardList } from "lucide-react"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { useDemoData } from "@/lib/demo-data-context"
import { computeNavigatorProductivity } from "@/lib/navigator-productivity"
import { computePlaybookKpis, type PlaybookKpi } from "@/lib/playbook-kpis"
import { computeWindshieldTime } from "@/lib/zones"
import { geo } from "@/lib/geo"
import { cn } from "@/lib/utils"

const TREND_WINDOW_DAYS = 14

function KpiCard({ kpi }: { kpi: PlaybookKpi }) {
  if (kpi.status === "placeholder") {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-4">
          <div className="text-sm font-medium text-muted-foreground">{kpi.label}</div>
          <div className="mt-1 text-lg font-semibold text-muted-foreground/70">
            Signal not yet captured
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Depends on: {kpi.dependency}</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="bg-card">
      <CardContent className="pt-4">
        <div className="text-sm font-medium text-muted-foreground">{kpi.label}</div>
        <div className="mt-1 text-2xl font-bold text-card-foreground">
          {kpi.unit === "$" && typeof kpi.value === "number"
            ? `$${kpi.value.toLocaleString()}`
            : kpi.value}
          {kpi.unit === "%" ? "%" : ""}
        </div>
        {kpi.detail && <p className="mt-1 text-xs text-muted-foreground">{kpi.detail}</p>}
      </CardContent>
    </Card>
  )
}

export function PerformanceView() {
  const {
    navigators,
    patients,
    referrals,
    timeLogs,
    chargeSlips,
    appointments,
    adverseEvents,
    intakeRecords,
    payers,
    activePayerConfig,
    signedContractPatientIds,
    navigatorTasks,
    notes,
    isHydrated,
  } = useDemoData()

  const productivity = useMemo(
    () =>
      computeNavigatorProductivity(
        navigators,
        timeLogs,
        chargeSlips,
        activePayerConfig,
        TREND_WINDOW_DAYS
      ).sort((a, b) => b.attainmentPct - a.attainmentPct),
    [navigators, timeLogs, chargeSlips, activePayerConfig]
  )

  const kpis = useMemo(
    () =>
      computePlaybookKpis({
        referrals,
        patients,
        navigators,
        timeLogs,
        chargeSlips,
        appointments,
        adverseEvents,
        payerConfig: activePayerConfig,
        intakeRecords,
        payers,
        signedContractPatientIds,
        navigatorTasks,
        notes,
      }),
    [referrals, patients, navigators, timeLogs, chargeSlips, appointments, adverseEvents, activePayerConfig, intakeRecords, payers, signedContractPatientIds, navigatorTasks, notes]
  )

  const windshieldByNavigator = useMemo(() => {
    const byNav = new Map<string, { totalMinutes: number; days: number }>()
    for (const day of computeWindshieldTime(appointments, patients, geo)) {
      const entry = byNav.get(day.navigatorId) ?? { totalMinutes: 0, days: 0 }
      entry.totalMinutes += day.driveMinutes
      entry.days += 1
      byNav.set(day.navigatorId, entry)
    }
    return byNav
  }, [appointments, patients])

  if (!isHydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading performance data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Operating Playbook §5 KPIs</h2>
          <p className="text-sm text-muted-foreground">
            Live from the same data navigators work in — dimmed cards name the exact signal not
            yet captured
          </p>
        </div>
        <Badge variant="outline">One NPI · {navigators.length} navigators reported individually</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <ClipboardList className="h-5 w-5 text-primary" />
            Navigator Productivity — daily units (charge slips)
          </CardTitle>
          <CardDescription>
            The always-available face sheet: units/day vs level targets (L1 16 · L2 18 · L3 20),{" "}
            {TREND_WINDOW_DAYS}-day window
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Navigator</TableHead>
                <TableHead className="text-center text-muted-foreground">Level</TableHead>
                <TableHead className="text-center text-muted-foreground">Avg units/day</TableHead>
                <TableHead className="text-center text-muted-foreground">Target</TableHead>
                <TableHead className="text-muted-foreground">Attainment</TableHead>
                <TableHead className="text-center text-muted-foreground">Day-close %</TableHead>
                <TableHead className="text-muted-foreground">{TREND_WINDOW_DAYS}-day trend</TableHead>
                <TableHead className="text-center text-muted-foreground">
                  Windshield time (unbillable)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productivity.map((nav) => {
                const windshield = windshieldByNavigator.get(nav.navigatorId)
                const avgDriveMinutes =
                  windshield && windshield.days > 0
                    ? Math.round(windshield.totalMinutes / windshield.days)
                    : null
                return (
                  <TableRow key={nav.navigatorId} className="border-border">
                    <TableCell className="font-medium text-card-foreground">{nav.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">L{nav.level}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-card-foreground">
                      {nav.trend.length > 0 ? nav.avgUnitsPerDay : "—"}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {nav.targetUnitsPerDay}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(nav.attainmentPct, 100)}
                          className={cn("h-2 w-24", nav.attainmentPct < 80 && "[&>div]:bg-warning")}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            nav.attainmentPct < 80 ? "text-warning" : "text-card-foreground"
                          )}
                        >
                          {nav.attainmentPct}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "text-sm",
                          nav.dayCloseRate < 70 ? "text-warning" : "text-card-foreground"
                        )}
                      >
                        {nav.dayCloseRate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {nav.trend.length > 1 ? (
                        <div className="h-10 w-28">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={nav.trend}>
                              <Line
                                type="monotone"
                                dataKey="units"
                                stroke="hsl(var(--chart-1))"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {avgDriveMinutes !== null ? `${avgDriveMinutes} min/day` : "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
