"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import type { Escalation, Patient } from "@/lib/types"

const REASON_CONFIG: Record<Escalation["reason"], string> = {
  repeated_no_shows: "Repeated no-shows",
  clinical_risk: "Clinical risk",
  unresolved_sdoh: "Unresolved SDOH barrier",
  safety: "Safety concern",
  other: "Other",
}
const REASONS = Object.keys(REASON_CONFIG) as Escalation["reason"][]

interface EscalationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selects and locks the patient (e.g. raised from a patient-scoped card). */
  patient?: Patient
  /** Roster the picker draws from when no patient is pinned. Defaults to all patients. */
  roster?: Patient[]
}

/**
 * Raise a closed-loop escalation: patient picker (or pinned patient), reason,
 * description. Sends the patient's assigned supervisor a nudge on submit.
 */
export function EscalationDialog({ open, onOpenChange, patient, roster }: EscalationDialogProps) {
  const { currentUser } = useRole()
  const { patients, raiseEscalation } = useDemoData()
  const pickerRoster = roster ?? patients

  const [patientId, setPatientId] = useState(patient?.id ?? "")
  const [reason, setReason] = useState<Escalation["reason"]>("clinical_risk")
  const [description, setDescription] = useState("")

  const selectedPatient = patient ?? pickerRoster.find((p) => p.id === patientId)
  const canSubmit = !!selectedPatient && description.trim().length > 0 && !!currentUser

  const reset = () => {
    setPatientId(patient?.id ?? "")
    setReason("clinical_risk")
    setDescription("")
  }

  const handleSubmit = () => {
    if (!canSubmit || !selectedPatient || !currentUser) return
    raiseEscalation(selectedPatient.id, currentUser.id, reason, description.trim())
    toast.success(`Escalation raised for ${selectedPatient.name}`, {
      description: "The assigned supervisor has been nudged.",
    })
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive" />
            Raise Escalation{patient ? ` — ${patient.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Flags this patient for supervisor review. The assigned supervisor is nudged immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!patient && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {pickerRoster.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Reason</Label>
            <Select value={reason} onValueChange={(v: Escalation["reason"]) => setReason(v)}>
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REASON_CONFIG[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Description</Label>
            <Textarea
              placeholder="Describe the situation and what support is needed (required)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>
            <TriangleAlert className="h-4 w-4 mr-2" />
            Raise Escalation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { REASON_CONFIG }
