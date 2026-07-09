"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Save } from "lucide-react"
import { DocumentField, requiredFieldsSatisfied } from "./document-fields"
import { SignaturePanel } from "./signature-panel"
import { DOCUMENT_DEFINITIONS } from "@/lib/document-definitions"
import type { PatientDocument } from "@/lib/types"

type Relationship = NonNullable<PatientDocument["signature"]>["relationship"]

/**
 * Navigation contract (Patient Agreement) — the billing gate document
 * (playbook §4: no billable navigation time before this is signed).
 */
export function ContractForm({
  doc,
  onSaveDraft,
  onSign,
}: {
  doc: PatientDocument
  onSaveDraft: (fields: Record<string, unknown>) => void
  onSign: (fields: Record<string, unknown>, signedByName: string, relationship: Relationship) => void
}) {
  const def = DOCUMENT_DEFINITIONS.navigation_contract
  const [fields, setFields] = useState<Record<string, unknown>>(doc.fields ?? {})
  const [signedByName, setSignedByName] = useState(doc.signature?.signedByName ?? "")
  const [relationship, setRelationship] = useState<Relationship>(doc.signature?.relationship ?? "patient")

  const isSigned = doc.status === "signed"
  const canSign = requiredFieldsSatisfied(def.fields, fields) && signedByName.trim().length > 0

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Billing gate: navigation time cannot bill for this patient until this agreement is signed.
      </div>

      <div className="space-y-3">
        {def.fields.map((f) => (
          <DocumentField
            key={f.id}
            field={f}
            value={fields[f.id]}
            disabled={isSigned}
            onChange={(v) => setFields((prev) => ({ ...prev, [f.id]: v }))}
          />
        ))}
      </div>

      <SignaturePanel
        attestationText={def.attestationText ?? ""}
        signedByName={signedByName}
        onSignedByNameChange={setSignedByName}
        relationship={relationship}
        onRelationshipChange={setRelationship}
        disabled={isSigned}
      />

      {!isSigned && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onSaveDraft(fields)} className="gap-1.5">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button size="sm" onClick={() => onSign(fields, signedByName.trim(), relationship)} disabled={!canSign} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Sign Agreement
          </Button>
        </div>
      )}
      {isSigned && doc.signature && (
        <p className="text-xs text-muted-foreground">
          Signed by {doc.signature.signedByName} ({doc.signature.relationship}) on{" "}
          {new Date(doc.signature.signedAt).toLocaleString("en-US")} — billing gate open.
        </p>
      )}
    </div>
  )
}
