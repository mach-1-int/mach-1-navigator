"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Users,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
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
  getReferralsByAcuity,
  getCaseloadDistribution,
  getDashboardSummary,
} from "@/lib/analytics-utils"

/**
 * Executive ROI Dashboard
 *
 * A read-only dashboard that displays program health metrics
 * derived from the store without modifying any data.
 */
export function ROIDashboard() {
  const { patients, referrals, timeLogs, navigators, intakeRecords, activePayerConfig, isHydrated, getNavigatorsWithAttributes } = useDemoData()

  // Live navigator identities with attributes (caseloads reflect assignments
  // made this session, unlike the static seed import this replaced)
  const navigatorsWithAttributes = useMemo(
    () => getNavigatorsWithAttributes(),
    [getNavigatorsWithAttributes]
  )

  // All metrics memoized on the slices they read: getDashboardSummary runs
  // full claims generation, and this consumer re-renders on every mutation
  // in the app-wide context.
  const summary = useMemo(
    () =>
      getDashboardSummary({
        navigators,
        patients,
        timeLogs,
        intakeRecords,
        payerConfig: activePayerConfig,
        navigatorUsers: navigatorsWithAttributes,
      }),
    [navigators, patients, timeLogs, intakeRecords, activePayerConfig, navigatorsWithAttributes]
  )
  const operationalMetrics = useMemo(
    () => getOperationalMetrics(referrals, navigatorsWithAttributes),
    [referrals, navigatorsWithAttributes]
  )
  const acuityDistribution = useMemo(() => getReferralsByAcuity(referrals), [referrals])
  const caseloadBuckets = useMemo(
    () => getCaseloadDistribution(navigatorsWithAttributes),
    [navigatorsWithAttributes]
  )

  // Prepare data for pie chart (acuity distribution)
  const acuityChartData = [
    { name: "High Risk", value: acuityDistribution.highRisk, fill: "hsl(var(--chart-4))" },
    { name: "Medium Risk", value: acuityDistribution.mediumRisk, fill: "hsl(var(--chart-2))" },
    { name: "Low Risk", value: acuityDistribution.lowRisk, fill: "hsl(var(--chart-1))" },
  ].filter((item) => item.value > 0)

  // Prepare data for bar chart (caseload distribution)
  const caseloadChartData = caseloadBuckets.map((bucket) => ({
    name: bucket.label.split(" ")[0], // Just use first word (Empty, Light, etc.)
    fullLabel: bucket.label,
    count: bucket.count,
  }))

  // Loading state
  if (!isHydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Program Health (Live)</h2>
          <p className="text-muted-foreground">
            Real-time operational metrics and program performance
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Activity className="h-3 w-3 animate-pulse text-green-500" />
          Live
        </Badge>
      </div>

      {/* Top Cards - The "Big Numbers" */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Active Patients */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Active Patients
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.totalActivePatients || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enrolled in navigation program
            </p>
          </CardContent>
        </Card>

        {/* Estimated Monthly Revenue */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Est. Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ${summary.estimatedMonthlyRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current billing month, active payer
            </p>
          </CardContent>
        </Card>

        {/* Time-Log Verification Rate */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Time-Log Verification Rate
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {summary.complianceRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Supervisor-verified time logs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-sm font-medium text-muted-foreground">Unassigned Rate</div>
            <div className="text-2xl font-bold">{operationalMetrics.unassignedRate}%</div>
            <p className="text-xs text-muted-foreground">
              {operationalMetrics.unassignedCount} of {operationalMetrics.totalReferrals} referrals
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${operationalMetrics.burnoutRisk > 30 ? 'border-l-red-500' : 'border-l-green-500'}`}>
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
            <p className="text-xs text-muted-foreground">
              Referral received to accepted
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="text-sm font-medium text-muted-foreground">Avg Utilization</div>
            <div className="text-2xl font-bold">{summary.avgCaseloadUtilization}%</div>
            <p className="text-xs text-muted-foreground">
              Across {summary.totalNavigators} navigators
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Referrals by Acuity (Pie Chart) */}
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
                      {acuityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-muted-foreground text-sm">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caseload Distribution (Bar Chart) */}
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
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                      formatter={(value: number) => [value, "Navigators"]}
                      labelFormatter={(label: string) => {
                        const item = caseloadChartData.find((d) => d.name === label)
                        return item?.fullLabel || label
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {caseloadChartData.map((entry, index) => {
                        // Color based on capacity level
                        const colors = [
                          "hsl(var(--chart-1))", // Empty - green
                          "hsl(var(--chart-2))", // Light - blue
                          "hsl(var(--chart-3))", // Moderate - yellow
                          "hsl(var(--chart-2))", // Heavy - orange
                          "hsl(var(--chart-4))", // Full - red
                        ]
                        return <Cell key={`cell-${index}`} fill={colors[index]} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alerts & Attention Items
        </h3>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Navigators Over Capacity */}
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-red-500" />
                Navigators Over Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {operationalMetrics.overCapacityNavigators.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-sm">All navigators within capacity</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {operationalMetrics.overCapacityNavigators.map((nav) => (
                    <Alert key={nav.id} variant="destructive" className="py-2">
                      <AlertTitle className="text-sm font-medium">{nav.name}</AlertTitle>
                      <AlertDescription className="text-xs">
                        {nav.currentCaseload}/{nav.maxCaseload} patients ({nav.utilizationPercent}% capacity)
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Referrals > 48 Hours */}
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Referrals Pending &gt;48 Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {operationalMetrics.stalePendingReferrals.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-sm">No stale referrals</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {operationalMetrics.stalePendingReferrals.slice(0, 5).map((ref) => (
                    <Alert key={ref.id} className="py-2 border-amber-500">
                      <AlertTitle className="text-sm font-medium">{ref.patientName}</AlertTitle>
                      <AlertDescription className="text-xs">
                        Pending for {ref.hoursPending} hours
                      </AlertDescription>
                    </Alert>
                  ))}
                  {operationalMetrics.stalePendingReferrals.length > 5 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      + {operationalMetrics.stalePendingReferrals.length - 5} more stale referrals
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revenue Details Footer */}
      {timeLogs.length === 0 && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">
                No time logs recorded yet. Revenue projection will update as navigators log their time.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
