"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/dashboard/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrendingUp, UserPlus, Filter, Building2 } from "lucide-react"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
import { useDemoData } from "@/lib/demo-data-context"
import { computeFunnel, computeSourceScorecard } from "@/lib/referral-funnel"
import { isTerminalReferralStatus, referralStatusMeta } from "@/lib/referral-pipeline"

const ST_JOES = "St. Joseph's Hospital"

export function ReferralFunnelView() {
  const { referrals } = useDemoData()
  const funnel = useMemo(() => computeFunnel(referrals), [referrals])
  const scorecard = useMemo(() => computeSourceScorecard(referrals), [referrals])

  const chartData = funnel.stages.map(({ status, count }) => ({
    status,
    name: referralStatusMeta(status).label,
    count,
    terminal: isTerminalReferralStatus(status) && status !== "converted",
  }))

  return (
    <div className="space-y-6">
      {/* Headline tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Referral → Intake Conversion"
          value={`${funnel.conversionRate}%`}
          subtitle={`${funnel.converted} of ${funnel.total} referrals converted`}
          icon={TrendingUp}
          variant={funnel.conversionRate >= 20 ? "success" : "warning"}
        />
        <StatCard
          title="Total Referrals"
          value={funnel.total}
          subtitle="all sources, all time"
          icon={UserPlus}
        />
        <StatCard
          title="In Pipeline"
          value={funnel.inPipeline}
          subtitle="working toward intake"
          icon={Filter}
        />
        <StatCard
          title="Closed Without Conversion"
          value={funnel.closedWithoutConversion}
          subtitle="ineligible / unreachable / declined"
          icon={Building2}
        />
      </div>

      {/* Funnel stage bar */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Pipeline by Stage</CardTitle>
          <CardDescription>Current count of referrals at each pipeline stage (closes shown muted)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  width={150}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value: number) => [value, "Referrals"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={entry.terminal ? "hsl(var(--muted-foreground) / 0.35)" : "hsl(var(--chart-1))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Source scorecard */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Source Scorecard</CardTitle>
          <CardDescription>
            Conversion performance per referral source — the data Gellert can finally show referrers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Source</TableHead>
                <TableHead className="text-center text-muted-foreground">Received</TableHead>
                <TableHead className="text-center text-muted-foreground">In Progress</TableHead>
                <TableHead className="text-center text-muted-foreground">Ineligible</TableHead>
                <TableHead className="text-center text-muted-foreground">Unreachable</TableHead>
                <TableHead className="text-center text-muted-foreground">Declined</TableHead>
                <TableHead className="text-center text-muted-foreground">Converted</TableHead>
                <TableHead className="text-center text-muted-foreground">Conversion</TableHead>
                <TableHead className="text-right text-muted-foreground">Avg Days to Accept</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scorecard.map((row) => {
                const isTopSource = row.source === ST_JOES
                return (
                  <TableRow
                    key={row.source}
                    className={cn("border-border", isTopSource && "bg-primary/5")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-card-foreground">{row.source}</span>
                        {isTopSource && (
                          <Badge className="bg-primary/10 text-primary text-xs" variant="outline">
                            Top Source
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-card-foreground">{row.received}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.inProgress}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.ineligible}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.unreachable}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.declined}</TableCell>
                    <TableCell className="text-center font-medium text-card-foreground">{row.converted}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "font-semibold",
                          row.conversionRate >= 25
                            ? "text-emerald-600"
                            : row.conversionRate > 0
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        )}
                      >
                        {row.conversionRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.avgDaysToConversion !== null ? `${row.avgDaysToConversion}d` : "—"}
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

/** Compact funnel card for the executive dashboard */
export function ReferralFunnelCompact() {
  const { referrals } = useDemoData()
  const funnel = useMemo(() => computeFunnel(referrals), [referrals])
  const maxCount = Math.max(1, ...funnel.stages.map((s) => s.count))

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Referral Funnel</CardTitle>
            <CardDescription>Pipeline snapshot across all sources</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-card-foreground">{funnel.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">conversion</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {funnel.stages.map(({ status, count }) => {
          const meta = referralStatusMeta(status)
          const terminal = isTerminalReferralStatus(status) && status !== "converted"
          return (
            <div key={status} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-xs text-muted-foreground truncate">{meta.label}</span>
              <div className="flex-1 h-3 rounded-sm bg-muted/40 overflow-hidden">
                <div
                  className={cn("h-full rounded-sm", terminal ? "bg-muted-foreground/35" : "bg-primary")}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-medium text-card-foreground">{count}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
