"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Users, ChevronRight, TrendingUp, TrendingDown, Minus, MapPin } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { calculateDurationMinutes } from "@/lib/store"
import { computeZoneCoverage } from "@/lib/zones"
import { cn } from "@/lib/utils"

function onboardingStatusBadge(navigatorId: string, navigatorOnboarding: ReturnType<typeof useDemoData>["navigatorOnboarding"], now: number) {
  const record = navigatorOnboarding.find(r => r.navigatorId === navigatorId)
  if (!record) return null
  const daysInProgram = Math.max(0, Math.floor((now - new Date(record.startDate).getTime()) / (1000 * 60 * 60 * 24)))
  switch (record.status) {
    case "certified":
      return { label: "Certified", className: "bg-emerald-100 text-emerald-700", daysInProgram }
    case "lead":
      return { label: "Lead", className: "bg-blue-100 text-blue-700", daysInProgram }
    default:
      return { label: "Developmental", className: "bg-amber-100 text-amber-700", daysInProgram }
  }
}

export function NavigatorDirectory() {
  const { navigators, patients, appointments, timeLogs, users, zones, navigatorOnboarding, getNudgesForNavigator } = useDemoData()
  const { navigateTo, currentUser } = useRole()
  // Stable "now" for days-in-program math (Date.now() is impure during render)
  const [now] = useState(() => Date.now())

  // Filter navigators under the current supervisor
  const teamNavigators = navigators.filter(nav => nav.supervisorId === currentUser?.id)

  // Per-zone census vs assigned navigators (Mitch's weekly manual join, live)
  const zoneCoverage = computeZoneCoverage(zones, patients, navigators, users)

  const zoneForNavigator = (navigatorId: string) => {
    const zoneId = users.find(u => u.id === navigatorId)?.attributes?.zoneId
    return zoneId ? zones.find(z => z.id === zoneId) : undefined
  }

  // Calculate additional metrics for each navigator
  const navigatorMetrics = teamNavigators.map(nav => {
    const navPatients = patients.filter(p => p.assignedNavigator === nav.id)
    const avgCompliance = navPatients.length > 0
      ? Math.round(navPatients.reduce((sum, p) => sum + p.medicationCompliance, 0) / navPatients.length)
      : 0
    const pendingMessages = getNudgesForNavigator(nav.id).filter(m => !m.readStatus).length

    // Average visit time: mean duration of completed EVV-verified appointments,
    // falling back to the navigator's logged time entries
    const completedVisits = appointments.filter(a =>
      a.navigatorId === nav.id && a.status === "completed" && a.checkInTime && a.checkOutTime
    )
    const navTimeLogs = timeLogs.filter(log => log.navigatorId === nav.id)
    const avgVisitTime = completedVisits.length > 0
      ? Math.round(completedVisits.reduce((sum, a) => sum + calculateDurationMinutes(a.checkInTime!, a.checkOutTime!), 0) / completedVisits.length)
      : navTimeLogs.length > 0
        ? Math.round(navTimeLogs.reduce((sum, log) => sum + log.durationMinutes, 0) / navTimeLogs.length)
        : null

    // Determine load status
    const loadStatus = nav.patientCount > 50 ? "high" : nav.patientCount > 35 ? "medium" : "low"
    
    return {
      ...nav,
      avgCompliance,
      avgVisitTime,
      loadStatus,
      pendingMessages,
      patientList: navPatients
    }
  })

  // Team-wide average visit time (only navigators with visit data)
  const navigatorsWithVisitTime = navigatorMetrics.filter(n => n.avgVisitTime !== null)
  const teamAvgVisitTime = navigatorsWithVisitTime.length > 0
    ? Math.round(navigatorsWithVisitTime.reduce((sum, n) => sum + (n.avgVisitTime ?? 0), 0) / navigatorsWithVisitTime.length)
    : null

  const getLoadBadge = (status: string) => {
    switch (status) {
      case "high":
        return { label: "High Load", className: "bg-red-100 text-red-700" }
      case "medium":
        return { label: "Moderate", className: "bg-amber-100 text-amber-700" }
      default:
        return { label: "Optimal", className: "bg-emerald-100 text-emerald-700" }
    }
  }

  const getComplianceTrend = (compliance: number) => {
    if (compliance >= 95) return { icon: TrendingUp, color: "text-emerald-600" }
    if (compliance >= 85) return { icon: Minus, color: "text-amber-600" }
    return { icon: TrendingDown, color: "text-red-600" }
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{teamNavigators.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {Math.round(navigatorMetrics.reduce((sum, n) => sum + n.avgCompliance, 0) / navigatorMetrics.length)}%
                </p>
                <p className="text-sm text-muted-foreground">Avg Compliance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {navigatorMetrics.reduce((sum, n) => sum + n.patientCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {teamAvgVisitTime !== null ? `${teamAvgVisitTime} min` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Avg Visit Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigator Table */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Navigator Directory</CardTitle>
          <CardDescription>Click a row to view detailed navigator profile</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Navigator</TableHead>
                <TableHead className="text-center text-muted-foreground">Zone</TableHead>
                <TableHead className="text-center text-muted-foreground">Current Load</TableHead>
                <TableHead className="text-center text-muted-foreground">Compliance %</TableHead>
                <TableHead className="text-center text-muted-foreground">Avg Visit Time</TableHead>
                <TableHead className="text-center text-muted-foreground">MTD Units</TableHead>
                <TableHead className="text-center text-muted-foreground">Onboarding</TableHead>
                <TableHead className="text-center text-muted-foreground">Messages</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {navigatorMetrics.map((navigator) => {
                const loadBadge = getLoadBadge(navigator.loadStatus)
                const trend = getComplianceTrend(navigator.avgCompliance)
                const TrendIcon = trend.icon
                const zone = zoneForNavigator(navigator.id)
                const onboarding = onboardingStatusBadge(navigator.id, navigatorOnboarding, now)

                return (
                  <TableRow 
                    key={navigator.id} 
                    className="border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => navigateTo("navigator-detail", { navigatorId: navigator.id })}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium text-card-foreground">
                          {navigator.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground">{navigator.name}</p>
                          <p className="text-xs text-muted-foreground">{navigator.lengthOfService} months experience</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {zone ? (
                        <Badge variant="outline" className="gap-1.5 font-normal">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: zone.color }}
                          />
                          {zone.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium text-card-foreground">{navigator.patientCount} patients</span>
                        <Badge variant="secondary" className={loadBadge.className}>
                          {loadBadge.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress 
                          value={navigator.avgCompliance} 
                          className={cn("h-2 w-20", navigator.avgCompliance < 85 && "[&>div]:bg-warning")}
                        />
                        <span className={cn("text-sm font-medium", navigator.avgCompliance < 85 ? "text-warning" : "text-card-foreground")}>
                          {navigator.avgCompliance}%
                        </span>
                        <TrendIcon className={cn("h-4 w-4", trend.color)} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-card-foreground">
                      {navigator.avgVisitTime !== null ? `${navigator.avgVisitTime} min` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-medium",
                        navigator.mtdUnits < 200 ? "text-destructive" : "text-card-foreground"
                      )}>
                        {navigator.mtdUnits}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {onboarding ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="secondary" className={onboarding.className}>
                            {onboarding.label}
                          </Badge>
                          {onboarding.label === "Developmental" && (
                            <span className="text-xs text-muted-foreground">{onboarding.daysInProgram}d in program</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {navigator.pendingMessages > 0 ? (
                        <Badge variant="destructive">{navigator.pendingMessages}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Zone Coverage - per-zone census vs assigned navigators */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Zone Coverage
          </CardTitle>
          <CardDescription>Active patients vs assigned navigators per coverage zone</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Zone</TableHead>
                <TableHead className="text-center text-muted-foreground">Active Patients</TableHead>
                <TableHead className="text-center text-muted-foreground">Navigators</TableHead>
                <TableHead className="text-center text-muted-foreground">Patients / Navigator</TableHead>
                <TableHead className="text-center text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zoneCoverage.map(({ zone, activePatients, assignedNavigators, patientsPerNavigator, uncovered }) => (
                <TableRow key={zone.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: zone.color }}
                      />
                      <div>
                        <p className="font-medium text-card-foreground">{zone.name}</p>
                        {zone.description && (
                          <p className="text-xs text-muted-foreground">{zone.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium text-card-foreground">{activePatients}</TableCell>
                  <TableCell className="text-center font-medium text-card-foreground">{assignedNavigators}</TableCell>
                  <TableCell className="text-center text-card-foreground">
                    {patientsPerNavigator !== null ? patientsPerNavigator : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {uncovered ? (
                      <Badge variant="secondary" className="bg-red-100 text-red-700">Uncovered</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Covered</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
