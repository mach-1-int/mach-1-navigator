"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { DOCUMENT_DEFINITIONS } from "@/lib/document-definitions"
import type { PatientDocument } from "@/lib/types"
import { RoiForm } from "./roi-form"
import { ContractForm } from "./contract-form"
import { SurveyForm } from "./survey-form"
import { MedListForm } from "./med-list-form"
import { PhotoCapture } from "./photo-capture"
import { OnboardingPacketForm } from "./onboarding-packet-form"

type Relationship = NonNullable<PatientDocument["signature"]>["relationship"]

/**
 * Router dialog: renders the per-type form for a PatientDocument and wires
 * its actions to the frozen context (savePatientDocument / completePatientDocument
 * / signPatientDocument). One dialog instance per open document, mounted by
 * the intake checklist's "Open document" affordance.
 */
export function DocumentDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: PatientDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { currentUser } = useRole()
  const { savePatientDocument, completePatientDocument, signPatientDocument } = useDemoData()

  if (!doc) return null
  const def = DOCUMENT_DEFINITIONS[doc.type]
  const byId = currentUser?.id ?? "system"

  const handleSaveDraft = (fields: Record<string, unknown>, photoDataUrl?: string) => {
    const status = doc.status === "not_started" ? "draft" : doc.status
    savePatientDocument({ ...doc, fields, status, photoDataUrl: photoDataUrl ?? doc.photoDataUrl })
    toast.success(`${def.title} draft saved`)
  }

  const handleComplete = (fields: Record<string, unknown>, photoDataUrl?: string) => {
    savePatientDocument({ ...doc, fields, photoDataUrl: photoDataUrl ?? doc.photoDataUrl })
    completePatientDocument(doc.id, byId)
    toast.success(`${def.title} completed`)
    onOpenChange(false)
  }

  const handleSign = (fields: Record<string, unknown>, signedByName: string, relationship: Relationship) => {
    savePatientDocument({ ...doc, fields })
    signPatientDocument(
      doc.id,
      { signedByName, relationship, signedAt: new Date().toISOString(), attestationText: def.attestationText ?? "" },
      byId,
    )
    toast.success(`${def.title} signed by ${signedByName}`, {
      description: doc.type === "navigation_contract" ? "Billing gate open for this patient." : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{def.title}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>

        {doc.type === "roi" && <RoiForm doc={doc} onSaveDraft={handleSaveDraft} onSign={handleSign} />}
        {doc.type === "navigation_contract" && <ContractForm doc={doc} onSaveDraft={handleSaveDraft} onSign={handleSign} />}
        {doc.type === "intake_survey" && <SurveyForm doc={doc} onSaveDraft={handleSaveDraft} onComplete={handleComplete} />}
        {doc.type === "medication_list" && <MedListForm doc={doc} onSaveDraft={handleSaveDraft} onComplete={handleComplete} />}
        {doc.type === "patient_photo" && <PhotoCapture doc={doc} onSaveDraft={handleSaveDraft} onComplete={handleComplete} />}
        {doc.type === "onboarding_packet" && <OnboardingPacketForm doc={doc} onSaveDraft={handleSaveDraft} onComplete={handleComplete} />}
      </DialogContent>
    </Dialog>
  )
}
