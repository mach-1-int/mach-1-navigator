"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CalendarClock, CheckCircle2, ClipboardCheck, Send, UserX } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import {
  NO_SHOW_CLOSURE_THRESHOLD,
  intakeChecklistProgress,
  isIntakeVisitComplete,
  pcpDueStatus,
} from "@/lib/journey"
import type { IntakeVisit } from "@/lib/types"

const VISIT_STATUS_BADGES: Record<IntakeVisit["status"], { label: string; className: string }> = {
  not_scheduled: { label: "Not scheduled", className: "bg-slate-100 text-slate-600 border-slate-200" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
}

const PCP_BADGES = {
  ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
  due_soon: "bg-amber-100 text-amber-700 border-amber-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
} as const

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Gellert Intake 1 & 2 protocol: dual checklists with per-item check-off,
 * the PCP-within-7-business-days countdown, and the 3-no-show closure
 * protocol (third no-show auto-exits the patient MIA).
 */
export function IntakeChecklist({ patientId }: { patientId: string }) {
  const { currentUser } = useRole()
  const {
    getPatient,
    getPatientIntake,
    updateIntakeChecklistItem,
    completeIntakeVisit,
    recordIntakeNoShow,
    notifyReferringProvider,
  } = useDemoData()

  const [noShowDialogVisit, setNoShowDialogVisit] = useState<1 | 2 | null>(null)

  const patient = getPatient(patientId)
  const intake = getPatientIntake(patientId)
  if (!patient || !intake || !intake.intake1 || !intake.intake2) return null

  const byId = currentUser?.id ?? "system"
  const byName = currentUser?.name ?? "System"
  const totalNoShows = intake.totalNoShows ?? 0
  const nextNoShowCloses = totalNoShows === NO_SHOW_CLOSURE_THRESHOLD - 1
  const pcp = intake.pcpDueBy ? pcpDueStatus(intake.pcpDueBy) : null
  const intake2Complete = intake.intake2.status === "completed"

  const handleRecordNoShow = (visit: 1 | 2) => {
    recordIntakeNoShow(patientId, visit, byId, byName)
    if (nextNoShowCloses) {
      toast.error(`${patient.name} closed per the 3-no-show protocol (MIA exit)`, {
        description: "Referring provider notification recorded.",
      })
    } else {
      toast.warning(
        `Intake ${visit} no-show recorded (${totalNoShows + 1}/${NO_SHOW_CLOSURE_THRESHOLD})`,
      )
    }
    setNoShowDialogVisit(null)
  }

  const handleCompleteVisit = (visit: 1 | 2) => {
    completeIntakeVisit(patientId, visit, byId, byName)
    toast.success(
      visit === 2
        ? `Intake 2 complete — ${patient.name} is now in Active Navigation`
        : "Intake 1 completed",
    )
  }

  const renderVisit = (visit: 1 | 2, data: IntakeVisit) => {
    const progress = intakeChecklistProgress(data)
    const allDone = isIntakeVisitComplete(data)
    const completed = data.status === "completed"
    const badge = VISIT_STATUS_BADGES[data.status]

    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">Intake {visit}</p>
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
            {data.noShowCount > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {data.noShowCount} no-show{data.noShowCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {progress.done}/{progress.total} items
          </span>
        </div>

        {data.scheduledDate && !completed && (
          <p className="text-xs text-muted-foreground">
            Scheduled for {formatDate(data.scheduledDate)}
          </p>
        )}
        {completed && data.completedDate && (
          <p className="text-xs text-muted-foreground">
            Completed {formatDate(data.completedDate)}
          </p>
        )}

        <div className="space-y-2">
          {data.checklist.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Checkbox
                id={`intake${visit}-${item.key}`}
                checked={item.done}
                disabled={completed || patient.journeyPhase !== "intake"}
                onCheckedChange={(checked) =>
                  updateIntakeChecklistItem(patientId, visit, item.key, checked === true, byId, byName)
                }
              />
              <label
                htmlFor={`intake${visit}-${item.key}`}
                className={cn(
                  "text-sm cursor-pointer",
                  item.done && "text-muted-foreground line-through",
                )}
              >
                {item.label}
              </label>
            </div>
          ))}
        </div>

        {!completed && patient.journeyPhase === "intake" && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={() => handleCompleteVisit(visit)} disabled={!allDone} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {visit === 2 ? "Complete Intake 2 → Active Navigation" : "Complete Intake 1"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (nextNoShowCloses ? setNoShowDialogVisit(visit) : handleRecordNoShow(visit))}
              className="gap-1.5 text-destructive border-destructive/40 hover:text-destructive"
            >
              <UserX className="h-4 w-4" />
              Record No-Show
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Intake Protocol
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {pcp && (
            <Badge variant="outline" className={cn("gap-1", PCP_BADGES[pcp.status])}>
              <CalendarClock className="h-3 w-3" />
              {pcp.status === "overdue"
                ? `PCP deadline missed — due ${formatDate(pcp.dueBy)}`
                : `PCP due ${formatDate(pcp.dueBy)} (${pcp.businessDaysRemaining} business day${pcp.businessDaysRemaining === 1 ? "" : "s"} left)`}
            </Badge>
          )}
          {intake.pcpApptDate && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              PCP appt {formatDate(intake.pcpApptDate)}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              totalNoShows === 0
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : nextNoShowCloses
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-amber-100 text-amber-700 border-amber-200",
            )}
          >
            No-shows: {totalNoShows}/{NO_SHOW_CLOSURE_THRESHOLD}
          </Badge>
        </div>

        {nextNoShowCloses && patient.journeyPhase === "intake" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            One more no-show triggers the closure protocol: the patient is exited MIA and the
            referring provider is notified.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {renderVisit(1, intake.intake1)}
          {renderVisit(2, intake.intake2)}
        </div>

        {intake2Complete && !intake.providerNotifiedAt && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Intake complete — notify the referring provider within 24 hours.
            </p>
            <Button
              size="sm"
              onClick={() => {
                notifyReferringProvider({ patientId }, byId, byName)
                toast.success("Referring provider notified", {
                  description: "Notification stamped on the intake record (audit-logged).",
                })
              }}
              className="gap-1.5 shrink-0"
            >
              <Send className="h-4 w-4" />
              Notify Referring Provider
            </Button>
          </div>
        )}
        {intake2Complete && intake.providerNotifiedAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Referring provider notified {formatDate(intake.providerNotifiedAt)}
          </p>
        )}

        <AlertDialog open={noShowDialogVisit !== null} onOpenChange={(open) => !open && setNoShowDialogVisit(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Third no-show — closure protocol</AlertDialogTitle>
              <AlertDialogDescription>
                This is {patient.name}&apos;s third intake no-show. Recording it invokes the
                documented closure protocol: the patient is exited from the program (MIA pathway)
                and the referring provider is notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => noShowDialogVisit && handleRecordNoShow(noShowDialogVisit)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Record No-Show &amp; Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
