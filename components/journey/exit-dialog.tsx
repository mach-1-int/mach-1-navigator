"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LogOut, Send } from "lucide-react"
import { toast } from "sonner"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { EXIT_PATHWAY_CONFIG } from "@/lib/journey"
import type { ExitPathway, Patient } from "@/lib/types"

const PATHWAYS = Object.keys(EXIT_PATHWAY_CONFIG) as ExitPathway[]

interface ExitDialogProps {
  patient: Patient
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Program-exit documentation dialog: the five documented exit pathways,
 * required notes, supervisor confirmation for patient-initiated exits, and
 * the referring-provider notification confirmation.
 */
export function ExitDialog({ patient, open, onOpenChange }: ExitDialogProps) {
  const { currentUser } = useRole()
  const { supervisors, exitProgram } = useDemoData()

  const [pathway, setPathway] = useState<ExitPathway>("patient_initiated")
  const [notes, setNotes] = useState("")
  const [supervisorConfirmed, setSupervisorConfirmed] = useState(false)
  const [confirmingSupervisorId, setConfirmingSupervisorId] = useState(
    patient.assignedSupervisor || supervisors[0]?.id || "",
  )

  const needsSupervisorConfirmation = pathway === "patient_initiated"
  const canSubmit =
    notes.trim().length > 0 &&
    (!needsSupervisorConfirmation || (supervisorConfirmed && !!confirmingSupervisorId))

  const handleExit = () => {
    if (!canSubmit || !currentUser) return
    exitProgram(patient.id, {
      pathway,
      exitedAt: new Date().toISOString(),
      documentedBy: currentUser.id,
      supervisorConfirmedBy: needsSupervisorConfirmation ? confirmingSupervisorId : undefined,
      notes: notes.trim(),
    })
    toast.success(`${patient.name} exited the program (${EXIT_PATHWAY_CONFIG[pathway].label})`, {
      description: "Referring provider notification recorded.",
    })
    onOpenChange(false)
    setNotes("")
    setSupervisorConfirmed(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-destructive" />
            Exit Program — {patient.name}
          </DialogTitle>
          <DialogDescription>
            Document the exit through one of the five program pathways. Exits are terminal; the
            referring provider is notified automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Exit Pathway</Label>
            <RadioGroup value={pathway} onValueChange={(v: ExitPathway) => setPathway(v)}>
              {PATHWAYS.map((p) => (
                <div key={p} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value={p} id={`exit-${p}`} className="mt-0.5" />
                  <div className="min-w-0">
                    <Label htmlFor={`exit-${p}`} className="text-sm font-medium cursor-pointer">
                      {EXIT_PATHWAY_CONFIG[p].label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {EXIT_PATHWAY_CONFIG[p].description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {needsSupervisorConfirmation && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="supervisor-confirm"
                  checked={supervisorConfirmed}
                  onCheckedChange={(checked) => setSupervisorConfirmed(checked === true)}
                />
                <Label htmlFor="supervisor-confirm" className="text-sm cursor-pointer">
                  A supervisor has reviewed and confirmed this patient-initiated exit
                </Label>
              </div>
              <Select value={confirmingSupervisorId} onValueChange={setConfirmingSupervisorId}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Confirming supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Exit Documentation</Label>
            <Textarea
              placeholder="Document the circumstances of the exit (required)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[90px] resize-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Send className="h-3.5 w-3.5" />
            The referring provider will be notified of this exit (audit-logged).
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleExit} disabled={!canSubmit}>
            <LogOut className="h-4 w-4 mr-2" />
            Confirm Exit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
