"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ComplianceGauge } from "@/components/dashboard/compliance-gauge"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Users, AlertTriangle, Activity, CheckCircle2, XCircle, Clock, PhoneCall, CalendarX2, HeartPulse } from "lucide-react"
import { PROGRAM_TARGETS } from "@/lib/executive-metrics"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { ReferralQueue } from "@/components/dashboards/referral-queue"
import { attemptsRemaining, outreachSla } from "@/lib/referral-pipeline"
import { cn } from "@/lib/utils"

export function SupervisorDashboard() {
  const { patients, navigators, adverseEvents, referrals, intakeRecords } = useDemoData()
  const { currentUser } = useRole()
  const teamNavigators = navigators.filter((nav) => nav.supervisorId === currentUser?.id)
  const teamPatients = patients.filter((p) => teamNavigators.some((n) => n.id === p.assignedNavigator))
  const avgMedicationCompliance = Math.round(
    teamNavigators.reduce((sum, n) => sum + n.medicationCompliance, 0) / teamNavigators.length
  )
  const avgPcpCompliance = Math.round(
    teamNavigators.reduce((sum, n) => sum + n.pcpCompliance, 0) / teamNavigators.length
  )
  const teamAdverseEvents = adverseEvents.filter((ae) =>
    teamPatients.some((p) => p.id === ae.patientId)
  )
  const activeEvents = teamAdverseEvents.filter((ae) => ae.status !== "ended")

  const patientsOutOfCompliance = teamPatients.filter((p) => !p.pcpCompliance)
  const highRiskPatients = teamPatients.filter((p) => p.riskLevel === 3)

  // Pipeline health: the three protocol clocks a supervisor can actually miss
  const slaBreached = referrals.filter(
    (r) => r.status === "accepted" && outreachSla(r).status === "breached"
  )
  const nearingMaxAttempts = referrals.filter(
    (r) => r.status === "outreach" && attemptsRemaining(r) <= 2
  )
  const twoNoShowIntakes = intakeRecords
    .filter((ir) => (ir.totalNoShows ?? 0) >= 2)
    .map((ir) => ({ record: ir, patient: patients.find((p) => p.id === ir.patientId) }))
    .filter(({ patient }) => patient && patient.journeyPhase === "intake")

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Team Size"
          value={teamNavigators.length}
          subtitle="navigators under supervision"
          icon={Users}
        />
        <StatCard
          title="Total Patients"
          value={teamPatients.length}
          subtitle="across all navigators"
          icon={Users}
        />
        <StatCard
          title="Active Adverse Events"
          value={activeEvents.length}
          subtitle={`${teamAdverseEvents.length} total this month`}
          icon={AlertTriangle}
          variant={activeEvents.length > 3 ? "destructive" : "default"}
        />
        <StatCard
          title="High Risk Patients"
          value={highRiskPatients.length}
          subtitle="Level 3 risk status"
          icon={Activity}
          variant={highRiskPatients.length > 2 ? "warning" : "default"}
        />
      </div>

      {/* Pipeline Health */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <HeartPulse className="h-5 w-5 text-primary" />
            Pipeline Health
          </CardTitle>
          <CardDescription>Protocol clocks at risk across referrals and intakes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div
              className={cn(
                "rounded-lg border p-4",
                slaBreached.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border"
              )}
            >
              <div className="flex items-center gap-2">
                <Clock className={cn("h-4 w-4", slaBreached.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                <p className="text-sm font-medium text-card-foreground">48h Contact SLA Breached</p>
              </div>
              <p className="text-2xl font-bold text-card-foreground mt-2">{slaBreached.length}</p>
              <p className="text-xs text-muted-foreground truncate">
                {slaBreached.length > 0
                  ? slaBreached.map((r) => r.patientName).join(", ")
                  : "All accepted referrals contacted on time"}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-4",
                nearingMaxAttempts.length > 0 ? "border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"
              )}
            >
              <div className="flex items-center gap-2">
                <PhoneCall className={cn("h-4 w-4", nearingMaxAttempts.length > 0 ? "text-amber-600" : "text-muted-foreground")} />
                <p className="text-sm font-medium text-card-foreground">Nearing 7-Attempt Limit</p>
              </div>
              <p className="text-2xl font-bold text-card-foreground mt-2">{nearingMaxAttempts.length}</p>
              <p className="text-xs text-muted-foreground truncate">
                {nearingMaxAttempts.length > 0
                  ? nearingMaxAttempts.map((r) => `${r.patientName} (${r.outreachAttempts.length}/7)`).join(", ")
                  : "No outreach nearing auto-close"}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-4",
                twoNoShowIntakes.length > 0 ? "border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"
              )}
            >
              <div className="flex items-center gap-2">
                <CalendarX2 className={cn("h-4 w-4", twoNoShowIntakes.length > 0 ? "text-amber-600" : "text-muted-foreground")} />
                <p className="text-sm font-medium text-card-foreground">Intakes at 2 No-Shows</p>
              </div>
              <p className="text-2xl font-bold text-card-foreground mt-2">{twoNoShowIntakes.length}</p>
              <p className="text-xs text-muted-foreground truncate">
                {twoNoShowIntakes.length > 0
                  ? `${twoNoShowIntakes.map(({ patient }) => patient?.name).join(", ")} — next no-show triggers closure`
                  : "No intakes near the 3-no-show protocol"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Queue */}
      <ReferralQueue />

      {/* Compliance Gauges */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ComplianceGauge
          title="Medication Compliance"
          value={avgMedicationCompliance}
          target={PROGRAM_TARGETS.medicationCompliance}
          subtitle="Team average"
        />
        <ComplianceGauge
          title="PCP Compliance"
          value={avgPcpCompliance}
          target={PROGRAM_TARGETS.pcpCompliance}
          subtitle="Post-hospitalization"
        />
        <Card className="bg-card sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-card-foreground">Out of PCP Compliance</CardTitle>
            <CardDescription>Patients requiring follow-up after ED/hospitalization</CardDescription>
          </CardHeader>
          <CardContent>
            {patientsOutOfCompliance.length === 0 ? (
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span>All patients in compliance</span>
              </div>
            ) : (
              <div className="space-y-3">
                {patientsOutOfCompliance.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                    <div>
                      <p className="font-medium text-card-foreground">{patient.name}</p>
                      <p className="text-sm text-muted-foreground">Chart: {patient.chartNumber}</p>
                    </div>
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Needs F/U
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigator Scorecards */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Navigator Scorecards</CardTitle>
          <CardDescription>Performance metrics for your team</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Navigator</TableHead>
                <TableHead className="text-center text-muted-foreground">MTD Units</TableHead>
                <TableHead className="text-center text-muted-foreground">Patients</TableHead>
                <TableHead className="text-center text-muted-foreground">Med Compliance</TableHead>
                <TableHead className="text-center text-muted-foreground">Adverse Events</TableHead>
                <TableHead className="text-center text-muted-foreground">Cancellations</TableHead>
                <TableHead className="text-center text-muted-foreground">High-Five %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamNavigators.map((navigator) => {
                const isLowPerformer = navigator.monthlyUnits < 220
                const hasComplianceIssue = navigator.medicationCompliance < PROGRAM_TARGETS.medicationCompliance
                return (
                  <TableRow key={navigator.id} className={cn("border-border", isLowPerformer && "bg-destructive/5")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium text-card-foreground">
                          {navigator.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground">{navigator.name}</p>
                          <p className="text-xs text-muted-foreground">{navigator.lengthOfService} months</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("font-medium", isLowPerformer ? "text-destructive" : "text-card-foreground")}>
                        {navigator.mtdUnits}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-card-foreground">{navigator.patientCount}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress
                          value={navigator.medicationCompliance}
                          className={cn("h-2 w-16", hasComplianceIssue && "[&>div]:bg-warning")}
                        />
                        <span className={cn("text-sm", hasComplianceIssue ? "text-warning" : "text-card-foreground")}>
                          {navigator.medicationCompliance}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={navigator.adverseEventCount > 3 ? "destructive" : "secondary"}>
                        {navigator.adverseEventCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={navigator.cancellations > 4 ? "destructive" : "secondary"}>
                        {navigator.cancellations}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("font-medium", navigator.highFivePercentage >= 85 ? "text-primary" : "text-warning")}>
                        {navigator.highFivePercentage}%
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adverse Events Tracking */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Adverse Event Tracking</CardTitle>
          <CardDescription>Current and recent patient events</CardDescription>
        </CardHeader>
        <CardContent>
          {teamAdverseEvents.length === 0 ? (
            <p className="text-center text-muted-foreground">No adverse events to display</p>
          ) : (
            <div className="space-y-3">
              {teamAdverseEvents.map((event) => {
                const patient = patients.find((p) => p.id === event.patientId)
                const statusConfig = {
                  currently_inpatient: { label: "Inpatient", color: "destructive" as const, icon: AlertTriangle },
                  currently_ed: { label: "In ED", color: "destructive" as const, icon: AlertTriangle },
                  monitoring: { label: "Monitoring", color: "default" as const, icon: Clock },
                  ended: { label: "Resolved", color: "secondary" as const, icon: CheckCircle2 },
                }
                const status = statusConfig[event.status]
                const StatusIcon = status.icon

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-4",
                      event.status === "ended" ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          event.status === "ended" ? "bg-secondary" : "bg-destructive/10"
                        )}
                      >
                        <StatusIcon
                          className={cn("h-5 w-5", event.status === "ended" ? "text-muted-foreground" : "text-destructive")}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">{patient?.name || "Unknown Patient"}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.type.replace("_", " ")} - {event.diagnosis}
                        </p>
                        <p className="text-xs text-muted-foreground">Started: {event.startDate}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={status.color}>{status.label}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Right Care:</span>
                        {event.rightCareFlag ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
