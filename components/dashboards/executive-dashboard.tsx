"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import { DollarSign, Users, Activity, TrendingUp, AlertTriangle, Clock, UserPlus, CheckCircle2 } from "lucide-react"
import { kpiMetrics, healthPlanRevenue, referralSources, monthlyBillingData, performanceData } from "@/lib/mock-data"
import { useDemoData } from "@/lib/demo-data-context"
import {
  AreaChart,
  Area,
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
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ExecutiveDashboard() {
  const { patients, referrals, navigators, appointments, getLastAssignedPatient, calculateDynamicRevenue } = useDemoData()
  const topPerformers = performanceData.filter((p) => p.tier === "top").slice(0, 5)
  const lowPerformers = performanceData.filter((p) => p.tier === "low")

  const lastAssignedPatient = getLastAssignedPatient()
  const assignedNavigator = lastAssignedPatient
    ? navigators.find(n => n.id === lastAssignedPatient.assignedNavigator)
    : null
  const pendingReferrals = referrals.filter(r => r.status === "pending").length
  const acceptedReferrals = referrals.filter(r => r.status === "accepted").length

  // Calculate live revenue using dynamic payer rates
  const completedAppointments = appointments.filter(apt => apt.status === "completed").length
  const dynamicRevenue = calculateDynamicRevenue()
  const liveRevenue = kpiMetrics.totalRevenue + dynamicRevenue
  
  // Awaiting Intake = pending referrals
  const awaitingIntake = pendingReferrals

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`$${(liveRevenue / 1000).toFixed(0)}K`}
          trend={{ value: kpiMetrics.revenueGrowth, direction: "up" }}
          subtitle={completedAppointments > 0 ? `+$${dynamicRevenue.toLocaleString()} from ${completedAppointments} visits` : "vs last month"}
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="Active Patients"
          value={kpiMetrics.activePatients}
          trend={{ value: 8, direction: "up" }}
          subtitle={`of ${kpiMetrics.totalPatients} total`}
          icon={Users}
        />
        <StatCard
          title="Avg. Engagement"
          value={`${kpiMetrics.avgEngagement} mo`}
          trend={{ value: 5, direction: "up" }}
          subtitle="length of program"
          icon={Activity}
        />
        <StatCard
          title="Awaiting Intake"
          value={awaitingIntake}
          trend={{ value: awaitingIntake < kpiMetrics.patientsAwaitingIntake ? -12 : 0, direction: "down" }}
          subtitle={`${acceptedReferrals} accepted this session`}
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Billing Trend Chart */}
        <Card className="bg-card lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-card-foreground">Daily Billing Units</CardTitle>
            <CardDescription>Units billed vs target this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyBillingData}>
                  <defs>
                    <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="units"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#colorUnits)"
                    name="Units"
                  />
                  <Area
                    type="monotone"
                    dataKey="target"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    fill="none"
                    name="Target"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Health Plan Revenue Pie */}
        <Card className="bg-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-card-foreground">Revenue by Health Plan</CardTitle>
            <CardDescription>PMPM distribution across payers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthPlanRevenue}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="pmpmRevenue"
                    nameKey="planName"
                  >
                    {healthPlanRevenue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${index + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value: number) => [`$${(value / 1000).toFixed(0)}K`, "Revenue"]}
                  />
                  <Legend
                    formatter={(value) => <span className="text-muted-foreground text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Referrers */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Top Referral Sources</CardTitle>
            <CardDescription>Leading referral partners this month</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Source</TableHead>
                  <TableHead className="text-right text-muted-foreground">Referrals</TableHead>
                  <TableHead className="text-right text-muted-foreground">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referralSources.map((source) => (
                  <TableRow key={source.name} className="border-border">
                    <TableCell className="font-medium text-card-foreground">{source.name}</TableCell>
                    <TableCell className="text-right text-card-foreground">{source.count}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={source.trend === "up" ? "default" : source.trend === "down" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {source.trend === "up" ? "+12%" : source.trend === "down" ? "-5%" : "0%"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Performance Tiers */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Navigator Performance</CardTitle>
              <CardDescription>Units by length of service</CardDescription>
            </div>
            {lowPerformers.length > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {lowPerformers.length} Low Performers
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={100}
                    tickFormatter={(value) => value.split(" ")[0]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value: number) => [value, "Units"]}
                  />
                  <Bar dataKey="units" radius={[0, 4, 4, 0]}>
                    {performanceData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.tier === "top"
                            ? "hsl(var(--chart-1))"
                            : entry.tier === "low"
                              ? "hsl(var(--chart-4))"
                              : "hsl(var(--chart-2))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demo Flow Activity */}
      {lastAssignedPatient && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-chart-2/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Recent Enrollment Activity
            </CardTitle>
            <CardDescription>Demo flow in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-card-foreground">{lastAssignedPatient.name}</p>
                <p className="text-sm text-muted-foreground">
                  Enrolled today, assigned to {assignedNavigator?.name || "Navigator"}
                </p>
              </div>
              <div className="text-right">
                <Badge className="bg-primary/10 text-primary">New Patient</Badge>
                <p className="mt-1 text-xs text-muted-foreground">Risk Level: L{lastAssignedPatient.riskLevel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-chart-2 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-card-foreground">
              <UserPlus className="h-4 w-4 text-chart-2" />
              Pending Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{pendingReferrals}</p>
            <p className="text-xs text-muted-foreground">{acceptedReferrals} accepted this session</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-card-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              High-Cost Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{kpiMetrics.highCostPatients}</p>
            <p className="text-xs text-muted-foreground">Require immediate intervention review</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-card-foreground">
              <Activity className="h-4 w-4 text-warning" />
              Current Adverse Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{kpiMetrics.totalAdverseEvents}</p>
            <p className="text-xs text-muted-foreground">{kpiMetrics.currentInpatients} currently inpatient</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-card-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              Avg. Units per Navigator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{kpiMetrics.avgUnitsPerNavigator}</p>
            <p className="text-xs text-muted-foreground">Target: 280 units/month</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
