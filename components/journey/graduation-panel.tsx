"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CalendarClock, Flag, GraduationCap, LogOut, PhoneCall, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { EXIT_PATHWAY_CONFIG, telenavCheckInStatus } from "@/lib/journey"
import { ExitDialog } from "@/components/journey/exit-dialog"
import type { Patient } from "@/lib/types"

const CADENCE_BADGES = {
  ok: { label: "On track", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  due_soon: { label: "Due soon", className: "bg-amber-100 text-amber-700 border-amber-200" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200" },
} as const

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Phase-conditional graduation / telenavigation action card.
 * Active: navigator flags readiness, supervisor confirms graduation.
 * Telenavigation: monthly cadence status, check-in, re-engage.
 * All non-exited phases: exit-dialog trigger. Exited: read-only summary.
 */
export function GraduationPanel({ patient }: { patient: Patient }) {
  const { currentUser } = useRole()
  const { getNavigatorDisplayName, flagGraduationReadiness, confirmGraduation, recordTelenavCheckIn, reengagePatient } = useDemoData()

  const [flagDialogOpen, setFlagDialogOpen] = useState(false)
  const [flagNote, setFlagNote] = useState("")
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)
  const [checkInNote, setCheckInNote] = useState("")
  const [reengageDialogOpen, setReengageDialogOpen] = useState(false)
  const [reengageReason, setReengageReason] = useState("")
  const [exitDialogOpen, setExitDialogOpen] = useState(false)

  const isSupervisor = currentUser?.role === "supervisor"
  const flaggedNotConfirmed = !!patient.graduation && !patient.graduation.confirmedAt
  const cadence = telenavCheckInStatus(patient)

  const handleFlag = () => {
    if (!currentUser || !flagNote.trim()) return
    flagGraduationReadiness(patient.id, currentUser.id, flagNote.trim())
    toast.success("Graduation readiness flagged", {
      description: "The assigned supervisor has been nudged to review.",
    })
    setFlagDialogOpen(false)
    setFlagNote("")
  }

  const handleConfirm = () => {
    if (!currentUser) return
    confirmGraduation(patient.id, currentUser.id, currentUser.name)
    toast.success(`${patient.name} graduated to Telenavigation`, {
      description: "Monthly check-in cadence (30 days) begins today.",
    })
  }

  const handleCheckIn = () => {
    if (!currentUser || !checkInNote.trim()) return
    recordTelenavCheckIn(patient.id, currentUser.id, currentUser.name, checkInNote.trim())
    toast.success("Monthly check-in recorded", { description: "Phone note written to the chart." })
    setCheckInDialogOpen(false)
    setCheckInNote("")
  }

  const handleReengage = () => {
    if (!currentUser || !reengageReason.trim()) return
    reengagePatient(patient.id, currentUser.id, currentUser.name, reengageReason.trim())
    toast.success(`${patient.name} re-engaged into Active Navigation`)
    setReengageDialogOpen(false)
    setReengageReason("")
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Graduation &amp; Program Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {patient.journeyPhase === "intake" && (
          <p className="text-sm text-muted-foreground">
            Graduation actions unlock once the patient completes Intake 2 and enters Active
            Navigation.
          </p>
        )}

        {patient.journeyPhase === "active" && !flaggedNotConfirmed && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              When navigation goals are met, flag graduation readiness for supervisor review.
              Confirmed graduates move to Telenavigation with monthly check-ins.
            </p>
            <Button variant="outline" onClick={() => setFlagDialogOpen(true)} className="gap-2">
              <Flag className="h-4 w-4" />
              Flag Graduation Readiness
            </Button>
          </div>
        )}

        {patient.journeyPhase === "active" && flaggedNotConfirmed && patient.graduation && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">
                  Graduation readiness flagged — awaiting supervisor confirmation
                </p>
              </div>
              <p className="text-xs text-amber-700">
                Flagged by {getNavigatorDisplayName(patient.graduation.readinessFlaggedBy)} on{" "}
                {formatDate(patient.graduation.readinessFlaggedAt)}
              </p>
              {patient.graduation.readinessNote && (
                <p className="text-sm text-amber-800">&ldquo;{patient.graduation.readinessNote}&rdquo;</p>
              )}
            </div>
            {isSupervisor ? (
              <Button onClick={handleConfirm} className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Confirm Graduation → Telenavigation
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only a supervisor can confirm graduation.
              </p>
            )}
          </div>
        )}

        {patient.journeyPhase === "telenavigation" && cadence && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-violet-600" />
                <div>
                  <p className="text-sm font-medium">Next monthly check-in</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(cadence.nextDue)}
                    {cadence.status === "overdue"
                      ? ` — ${Math.abs(cadence.daysUntilDue)} days overdue`
                      : cadence.daysUntilDue === 0
                        ? " — due today"
                        : ` — in ${cadence.daysUntilDue} days`}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={CADENCE_BADGES[cadence.status].className}>
                {CADENCE_BADGES[cadence.status].label}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCheckInDialogOpen(true)} className="gap-2">
                <PhoneCall className="h-4 w-4" />
                Record Monthly Check-in
              </Button>
              <Button variant="outline" onClick={() => setReengageDialogOpen(true)} className="gap-2">
                <Undo2 className="h-4 w-4" />
                Re-engage Patient
              </Button>
            </div>
          </div>
        )}

        {patient.journeyPhase === "exited" && patient.exit && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Exited — {EXIT_PATHWAY_CONFIG[patient.exit.pathway].label}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(patient.exit.exitedAt)} · documented by{" "}
              {getNavigatorDisplayName(patient.exit.documentedBy)}
              {patient.exit.supervisorConfirmedBy &&
                ` · confirmed by ${getNavigatorDisplayName(patient.exit.supervisorConfirmedBy)}`}
            </p>
            {patient.exit.providerNotifiedAt && (
              <p className="text-xs text-muted-foreground">
                Referring provider notified {formatDate(patient.exit.providerNotifiedAt)}
              </p>
            )}
            <p className="text-sm mt-1">{patient.exit.notes}</p>
          </div>
        )}

        {patient.journeyPhase !== "exited" && (
          <div className="border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExitDialogOpen(true)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Exit Program...
            </Button>
          </div>
        )}

        <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Flag Graduation Readiness</DialogTitle>
              <DialogDescription>
                Summarize why {patient.name} is ready to graduate. The assigned supervisor is
                nudged to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="text-sm font-medium">Readiness Note</Label>
              <Textarea
                placeholder="Goals met, PCP established, medications stable..."
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                className="min-h-[90px] resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFlagDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleFlag} disabled={!flagNote.trim()}>
                <Flag className="h-4 w-4 mr-2" />
                Flag Readiness
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Monthly Check-in</DialogTitle>
              <DialogDescription>
                Document the telenavigation check-in call with {patient.name}. A phone note is
                written to the chart and the 30-day cadence clock resets.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="text-sm font-medium">Check-in Summary</Label>
              <Textarea
                placeholder="Patient doing well, medications on track, no new barriers..."
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
                className="min-h-[90px] resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCheckInDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCheckIn} disabled={!checkInNote.trim()}>
                <PhoneCall className="h-4 w-4 mr-2" />
                Record Check-in
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reengageDialogOpen} onOpenChange={setReengageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Re-engage Patient</DialogTitle>
              <DialogDescription>
                Move {patient.name} from Telenavigation back into Active Navigation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="text-sm font-medium">Re-engagement Reason</Label>
              <Textarea
                placeholder="New diagnosis, hospitalization, patient requested support..."
                value={reengageReason}
                onChange={(e) => setReengageReason(e.target.value)}
                className="min-h-[90px] resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReengageDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReengage} disabled={!reengageReason.trim()}>
                <Undo2 className="h-4 w-4 mr-2" />
                Re-engage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ExitDialog patient={patient} open={exitDialogOpen} onOpenChange={setExitDialogOpen} />
      </CardContent>
    </Card>
  )
}
