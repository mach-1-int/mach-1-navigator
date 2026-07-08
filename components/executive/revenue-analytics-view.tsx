"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, TrendingUp, AlertTriangle, Clock, Sparkles, Users } from "lucide-react"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { useDemoData } from "@/lib/demo-data-context"
import {
  getOperationalMetrics,
  getCaseloadDistribution,
  getReferralsByAcuity,
} from "@/lib/analytics-utils"
import type { ClaimRecord } from "@/lib/types"

const AGING_BUCKETS = [
  { label: "0–7 days", min: 0, max: 7 },
  { label: "8–30 days", min: 8, max: 30 },
  { label: "31+ days", min: 31, max: Number.POSITIVE_INFINITY },
]

function computeArAging(outstanding: ClaimRecord[]) {
  const now = Date.now()
  return AGING_BUCKETS.map((bucket) => {
    const records = outstanding.filter((r) => {
      const days = Math.floor((now - Date.parse(r.exportedAt)) / 86400000)
      return days >= bucket.min && days <= bucket.max
    })
    return {
      bucket: bucket.label,
      amount: Math.round(records.reduce((sum, r) => sum + r.billedAmount, 0)),
      count: records.length,
    }
  })
}

const PAYER_MIX_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--popover-foreground))",
}

export function RevenueAnalyticsView() {
  const {
    claimRecords,
    payers,
    referrals,
    getNavigatorDisplayName,
    getNavigatorsWithAttributes,
    isHydrated,
  } = useDemoData()

  const ledger = useMemo(() => claimRecords.filter((r) => !r.voided), [claimRecords])

  const financials = useMemo(() => {
    const paid = ledger.filter((r) => r.status === "PAID")
    const denied = ledger.filter((r) => r.status === "DENIED")
    const adjudicated = paid.length + denied.length
    const outstanding = ledger.filter((r) => r.status !== "PAID" && r.status !== "DENIED")
    const totalBilled = ledger.reduce((sum, r) => sum + r.billedAmount, 0)
    const totalCollected = paid.reduce((sum, r) => sum + (r.remittance?.paidAmount ?? 0), 0)
    return {
      paid,
      denied,
      adjudicated,
      outstanding,
      totalBilled: Math.round(totalBilled),
      totalCollected: Math.round(totalCollected),
      outstandingBilled: Math.round(outstanding.reduce((sum, r) => sum + r.billedAmount, 0)),
      denialRate: adjudicated > 0 ? Math.round((denied.length / adjudicated) * 100) : 0,
      collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
    }
  }, [ledger])

  const arAging = useMemo(() => computeArAging(financials.outstanding), [financials.outstanding])

  const payerMix = useMemo(() => {
    const byPayer = new Map<string, number>()
    for (const record of ledger) {
      byPayer.set(record.payerId, (byPayer.get(record.payerId) ?? 0) + record.billedAmount)
    }
    return [...byPayer.entries()]
      .map(([payerId, amount]) => ({
        name: payers.find((p) => p.id === payerId)?.name ?? payerId,
        amount: Math.round(amount),
      }))
      .sort((a, b) => b.amount - a.amount)
      .map((entry, index) => ({ ...entry, fill: PAYER_MIX_COLORS[index % PAYER_MIX_COLORS.length] }))
  }, [ledger, payers])

  const unitsByNavigator = useMemo(() => {
    if (ledger.length === 0) return { month: null as string | null, rows: [] as { name: string; units: number }[] }
    const month = ledger.reduce((max, r) => (r.snapshot.month > max ? r.snapshot.month : max), ledger[0].snapshot.month)
    const byNav = new Map<string, number>()
    for (const record of ledger) {
      if (record.snapshot.month !== month) continue
      byNav.set(
        record.snapshot.navigatorId,
        (byNav.get(record.snapshot.navigatorId) ?? 0) +
          record.snapshot.primaryUnits +
          record.snapshot.addOnUnits
      )
    }
    const rows = [...byNav.entries()]
      .map(([navigatorId, units]) => ({ name: getNavigatorDisplayName(navigatorId), units }))
      .sort((a, b) => b.units - a.units)
    return { month, rows }
  }, [ledger, getNavigatorDisplayName])

  const dapRecovery = useMemo(() => {
    let recovered = 0
    let claims = 0
    for (const record of financials.paid) {
      if (!record.remittance?.carcCodes.includes("144")) continue
      const overage = record.remittance.paidAmount - record.billedAmount
      if (overage > 0) {
        recovered += overage
        claims += 1
      }
    }
    return { recovered: Math.round(recovered * 100) / 100, claims }
  }, [financials.paid])

  const navigatorsWithAttributes = useMemo(
    () => getNavigatorsWithAttributes(),
    [getNavigatorsWithAttributes]
  )
  const operationalMetrics = useMemo(
    () => getOperationalMetrics(referrals, navigatorsWithAttributes),
    [referrals, navigatorsWithAttributes]
  )
  const caseloadChartData = useMemo(
    () =>
      getCaseloadDistribution(navigatorsWithAttributes).map((bucket) => ({
        name: bucket.label.split(" ")[0],
        fullLabel: bucket.label,
        count: bucket.count,
      })),
    [navigatorsWithAttributes]
  )
  const acuityChartData = useMemo(() => {
    const acuity = getReferralsByAcuity(referrals)
    return [
      { name: "High Risk", value: acuity.highRisk, fill: "hsl(var(--chart-4))" },
      { name: "Medium Risk", value: acuity.mediumRisk, fill: "hsl(var(--chart-2))" },
      { name: "Low Risk", value: acuity.lowRisk, fill: "hsl(var(--chart-1))" },
    ].filter((item) => item.value > 0)
  }, [referrals])

  if (!isHydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading revenue analytics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Financial stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Billed (Ledger)"
          value={`$${financials.totalBilled.toLocaleString()}`}
          subtitle={`${ledger.length} exported claims`}
          icon={DollarSign}
        />
        <StatCard
          title="Collected"
          value={`$${financials.totalCollected.toLocaleString()}`}
          subtitle={`${financials.collectionRate}% of billed · ${financials.paid.length} paid claims`}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Denial Rate"
          value={`${financials.denialRate}%`}
          subtitle={`${financials.denied.length} of ${financials.adjudicated} adjudicated claims`}
          icon={AlertTriangle}
          variant={financials.denialRate > 10 ? "destructive" : "default"}
        />
        <StatCard
          title="Outstanding A/R"
          value={`$${financials.outstandingBilled.toLocaleString()}`}
          subtitle={`${financials.outstanding.length} claims awaiting adjudication`}
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* DAP incentive callout */}
      <Card className={dapRecovery.claims > 0 ? "border-l-4 border-l-primary bg-card" : "border-dashed bg-muted/30"}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            DAP Incentive Recovered (CARC 144)
          </CardTitle>
          <CardDescription>
            UHC 1% Differential Adjustment Payments posted above billed — the payments AMD misfiles
            as denials
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dapRecovery.claims > 0 ? (
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold text-primary">
                ${dapRecovery.recovered.toLocaleString()}
              </p>
              <Badge variant="outline">
                {dapRecovery.claims} claim{dapRecovery.claims === 1 ? "" : "s"} paid above billed
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No CARC-144 incentive adjustments posted yet — import a UHC DAP remittance in the
              claims ledger to see recovered incentive revenue here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* A/R aging + payer mix */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">A/R Aging</CardTitle>
            <CardDescription>Outstanding billed amounts by days since export</CardDescription>
          </CardHeader>
          <CardContent>
            {financials.outstanding.length === 0 ? (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No outstanding claims — ledger is fully adjudicated
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={arAging}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, _name: string, item: { payload?: { count?: number } }) => [
                        `$${value.toLocaleString()} · ${item.payload?.count ?? 0} claims`,
                        "Outstanding",
                      ]}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      <Cell fill="hsl(var(--chart-1))" />
                      <Cell fill="hsl(var(--chart-3))" />
                      <Cell fill="hsl(var(--chart-4))" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Payer Mix</CardTitle>
            <CardDescription>Billed amounts by payer across the claims ledger</CardDescription>
          </CardHeader>
          <CardContent>
            {payerMix.length === 0 ? (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No exported claims yet
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payerMix}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="amount"
                      nameKey="name"
                    >
                      {payerMix.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Billed"]}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-sm text-muted-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Units by navigator (claim units) */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">
            Units by Navigator — claim units{unitsByNavigator.month ? ` (${unitsByNavigator.month})` : ""}
          </CardTitle>
          <CardDescription>
            Monthly claim units from the exported ledger — aggregated differently from the daily
            units (charge slips) on the Performance view
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unitsByNavigator.rows.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No exported claims yet — export claims from the Revenue Cycle Manager
            </div>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={unitsByNavigator.rows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={100}
                    tickFormatter={(value: string) => value.split(" ")[0]}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, "Claim units"]}
                  />
                  <Bar dataKey="units" radius={[0, 4, 4, 0]} fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Program health (absorbed from the ROI dashboard) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Program Health</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="text-sm font-medium text-muted-foreground">Unassigned Rate</div>
              <div className="text-2xl font-bold">{operationalMetrics.unassignedRate}%</div>
              <p className="text-xs text-muted-foreground">
                {operationalMetrics.unassignedCount} of {operationalMetrics.totalReferrals} referrals in pipeline
              </p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${operationalMetrics.burnoutRisk > 30 ? "border-l-red-500" : "border-l-green-500"}`}>
            <CardContent className="pt-4">
              <div className="text-sm font-medium text-muted-foreground">Burnout Risk</div>
              <div className="text-2xl font-bold">{operationalMetrics.burnoutRisk}%</div>
              <p className="text-xs text-muted-foreground">
                {operationalMetrics.navigatorsAtRisk} navigators &gt;90% capacity
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="text-sm font-medium text-muted-foreground">Avg Turnaround</div>
              <div className="text-2xl font-bold">
                {operationalMetrics.avgTurnaroundDays !== null
                  ? `${operationalMetrics.avgTurnaroundDays} days`
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground">Referral received to accepted</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Caseload Distribution</CardTitle>
              <CardDescription>Navigator capacity utilization breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {caseloadChartData.every((d) => d.count === 0) ? (
                <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                  No navigator data available
                </div>
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={caseloadChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [value, "Navigators"]}
                        labelFormatter={(label: string) =>
                          caseloadChartData.find((d) => d.name === label)?.fullLabel || label
                        }
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {caseloadChartData.map((entry, index) => {
                          const colors = [
                            "hsl(var(--chart-1))",
                            "hsl(var(--chart-2))",
                            "hsl(var(--chart-3))",
                            "hsl(var(--chart-2))",
                            "hsl(var(--chart-4))",
                          ]
                          return <Cell key={entry.name} fill={colors[index]} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Referrals by Acuity</CardTitle>
              <CardDescription>Distribution of risk levels across referrals</CardDescription>
            </CardHeader>
            <CardContent>
              {acuityChartData.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                  No referral data available
                </div>
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={acuityChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {acuityChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend
                        formatter={(value) => (
                          <span className="text-sm text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
