"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ShieldAlert, Send } from "lucide-react"
import { toast } from "sonner"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { renderProviderComm, type ProviderCommContext } from "@/lib/provider-comms"
import type { ProviderCommunication, Referral } from "@/lib/types"

const COMM_TYPE_LABELS: Record<ProviderCommunication["type"], string> = {
  intake_notification: "Intake Notification",
  exit_notification: "Exit Notification",
  ineligible_notification: "Ineligible Notification",
  unreachable_notification: "Unreachable Notification",
}

interface ProviderCommDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ProviderCommunication["type"]
  entity: { referralId?: string; patientId?: string }
  /** Referral, when available, seeds the render context (referring provider, facility, etc.). */
  referral?: Referral
  /** Called after a successful (simulated) send. */
  onSent?: () => void
}

/**
 * Preview -> edit -> send (simulated) for a referring-provider communication.
 * Renders the playbook §3.3 template via renderProviderComm, lets the
 * supervisor edit the subject/body before sending, and always sends the
 * (possibly-edited) text as an override through notifyReferringProvider so
 * the stored ProviderCommunication reflects exactly what was reviewed.
 *
 * The editable form is only mounted while open, keyed by the target entity —
 * that gives it fresh subject/body state per open without an effect-driven
 * resync.
 */
export function ProviderCommDialog({ open, onOpenChange, type, entity, referral, onSent }: ProviderCommDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <ProviderCommDialogForm
            key={`${type}:${entity.referralId ?? ""}:${entity.patientId ?? ""}`}
            type={type}
            entity={entity}
            referral={referral}
            onCancel={() => onOpenChange(false)}
            onSent={() => {
              onOpenChange(false)
              onSent?.()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProviderCommDialogForm({
  type,
  entity,
  referral,
  onCancel,
  onSent,
}: {
  type: ProviderCommunication["type"]
  entity: { referralId?: string; patientId?: string }
  referral?: Referral
  onCancel: () => void
  onSent: () => void
}) {
  const { patients, intakeRecords, notifyReferringProvider } = useDemoData()
  const { currentUser } = useRole()

  const patient = entity.patientId
    ? patients.find((p) => p.id === entity.patientId)
    : referral?.patientId
      ? patients.find((p) => p.id === referral.patientId)
      : undefined
  const intake = patient ? intakeRecords.find((ir) => ir.patientId === patient.id) : undefined

  const ctx: ProviderCommContext = useMemo(
    () => ({
      patientName: referral?.patientName ?? patient?.name ?? "the patient",
      referringProvider: referral?.rawData?.PV1?.referringPhysician,
      facilityName: referral?.rawData?.PV1?.facilityName ?? referral?.source ?? patient?.referralSource,
      intakeCompletedDate: intake?.date,
      pcpAppointmentDate: intake?.pcpApptDate,
      clinicalSummary: patient?.primaryDiagnosis ?? referral?.diagnosis,
      exitReason: patient?.exit?.pathway,
      exitDate: patient?.exit?.exitedAt?.slice(0, 10),
      ineligibilityReason: referral?.eligibility?.ineligibilityReason,
      outreachAttempts: referral?.outreachAttempts.length,
      closedDate: referral?.closedAt?.slice(0, 10),
    }),
    [referral, patient, intake]
  )

  const rendered = useMemo(() => renderProviderComm(type, ctx), [type, ctx])
  const [subject, setSubject] = useState(rendered.subject)
  const [body, setBody] = useState(rendered.body)
  const [sending, setSending] = useState(false)

  const handleSend = () => {
    if (!currentUser) return
    setSending(true)
    notifyReferringProvider(entity, currentUser.id, currentUser.name, type, {
      subject: subject.trim(),
      body: body.trim(),
    })
    setSending(false)
    toast.success("Provider notification sent (simulated)", {
      description: `${COMM_TYPE_LABELS[type]} recorded for ${ctx.patientName}.`,
    })
    onSent()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          {COMM_TYPE_LABELS[type]} — {ctx.patientName}
        </DialogTitle>
        <DialogDescription>
          Review and edit before sending. The rendered template follows playbook §3.3.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 p-3">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Simulated — no real message leaves the system; Direct/fax integration slots in later.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pcd-subject">Subject</Label>
          <Input id="pcd-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pcd-body">Message</Label>
          <Textarea
            id="pcd-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[280px] font-mono text-xs"
          />
        </div>
      </div>

      <DialogFooter>
        <Badge variant="outline" className="mr-auto text-xs text-muted-foreground">
          {referral ? "Referral" : "Patient"} record
        </Badge>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} className="gap-2">
          <Send className="h-4 w-4" />
          Send (simulated)
        </Button>
      </DialogFooter>
    </>
  )
}
