"use client"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CalendarClock, Flag, Route, UserX } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import {
  EXIT_PATHWAY_CONFIG,
  JOURNEY_PHASE_CONFIG,
  NO_SHOW_CLOSURE_THRESHOLD,
  getAdverseEventOverlay,
  intakeChecklistProgress,
  pcpDueStatus,
  telenavCheckInStatus,
} from "@/lib/journey"
import type { JourneyPhase, Patient } from "@/lib/types"

const COLUMNS: Array<{ phase: JourneyPhase; dotClass: string }> = [
  { phase: "intake", dotClass: "bg-blue-500" },
  { phase: "active", dotClass: "bg-emerald-500" },
  { phase: "telenavigation", dotClass: "bg-violet-500" },
  { phase: "exited", dotClass: "bg-slate-400" },
]

const STAT_BADGES = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  due_soon: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
} as const

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

/**
 * Journey Board — the WorkFlow2025 phase map, live. Kanban columns for the
 * four stored phases with the derived adverse-event overlay badged onto
 * cards; each card carries its phase-relevant stat and clicks through to
 * the patient profile.
 */
export function JourneyBoard() {
  const { navigateTo } = useRole()
  const { patients, intakeRecords, getNavigatorDisplayName } = useDemoData()

  const byPhase = (phase: JourneyPhase) =>
    patients
      .filter((p) => p.journeyPhase === phase)
      .sort((a, b) => a.name.localeCompare(b.name))

  const adverseCount = patients.filter((p) => getAdverseEventOverlay(p)).length

  const renderPhaseStat = (patient: Patient) => {
    if (patient.journeyPhase === "intake") {
      const intake = intakeRecords.find((ir) => ir.patientId === patient.id)
      if (!intake?.intake1 || !intake.intake2) return null
      const p1 = intakeChecklistProgress(intake.intake1)
      const p2 = intakeChecklistProgress(intake.intake2)
      const pcp = intake.pcpDueBy ? pcpDueStatus(intake.pcpDueBy) : null
      const totalNoShows = intake.totalNoShows ?? 0
      return (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Intake {p1.done + p2.done}/{p1.total + p2.total}
          </Badge>
          {pcp && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-0.5", STAT_BADGES[pcp.status])}>
              <CalendarClock className="h-2.5 w-2.5" />
              PCP {pcp.status === "overdue" ? "overdue" : `due ${formatDate(pcp.dueBy)}`}
            </Badge>
          )}
          {totalNoShows > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 gap-0.5",
                totalNoShows >= NO_SHOW_CLOSURE_THRESHOLD - 1
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-amber-50 text-amber-700 border-amber-200",
              )}
            >
              <UserX className="h-2.5 w-2.5" />
              {totalNoShows}/{NO_SHOW_CLOSURE_THRESHOLD} no-shows
            </Badge>
          )}
        </div>
      )
    }

    if (patient.journeyPhase === "active") {
      const flagged = !!patient.graduation && !patient.graduation.confirmedAt
      return (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            L{patient.riskLevel} · last contact {formatDate(patient.lastContactDate)}
          </Badge>
          {flagged && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 bg-amber-50 text-amber-700 border-amber-200">
              <Flag className="h-2.5 w-2.5" />
              Graduation flagged
            </Badge>
          )}
        </div>
      )
    }

    if (patient.journeyPhase === "telenavigation") {
      const cadence = telenavCheckInStatus(patient)
      if (!cadence) return null
      return (
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-0.5", STAT_BADGES[cadence.status])}>
          <CalendarClock className="h-2.5 w-2.5" />
          Check-in {cadence.status === "overdue" ? `${Math.abs(cadence.daysUntilDue)}d overdue` : `due ${formatDate(cadence.nextDue)}`}
        </Badge>
      )
    }

    if (patient.exit) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200">
          {EXIT_PATHWAY_CONFIG[patient.exit.pathway].label} · {formatDate(patient.exit.exitedAt)}
        </Badge>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Route className="h-5 w-5 text-primary" />
            Journey Board
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {patients.length} patients across the WorkFlow2025 phases — click a card to open the
              profile.
            </span>
            {adverseCount > 0 && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {adverseCount} in adverse-event response
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(({ phase, dotClass }) => {
          const columnPatients = byPhase(phase)
          return (
            <div key={phase} className="rounded-lg border border-border bg-secondary/30">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", dotClass)} />
                  <p className="text-sm font-medium text-card-foreground">
                    {JOURNEY_PHASE_CONFIG[phase].label}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {columnPatients.length}
                </Badge>
              </div>
              <div className="space-y-2 p-2 max-h-[calc(100vh-320px)] min-h-[120px] overflow-y-auto">
                {columnPatients.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">No patients</p>
                ) : (
                  columnPatients.map((patient) => {
                    const overlay = getAdverseEventOverlay(patient)
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => navigateTo("patient-detail", { patientId: patient.id })}
                        className={cn(
                          "w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/50",
                          overlay ? "border-red-300" : "border-border",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-card-foreground">
                              {patient.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {patient.chartNumber} · {getNavigatorDisplayName(patient.assignedNavigator)}
                            </p>
                          </div>
                          {overlay && (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0"
                              title={`Open adverse event: ${overlay.diagnosis}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                              AE
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">{renderPhaseStat(patient)}</div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
