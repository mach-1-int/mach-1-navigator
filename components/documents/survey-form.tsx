"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Save } from "lucide-react"
import { DocumentField, requiredFieldsSatisfied } from "./document-fields"
import { DOCUMENT_DEFINITIONS } from "@/lib/document-definitions"
import type { PatientDocument } from "@/lib/types"

export function SurveyForm({
  doc,
  onSaveDraft,
  onComplete,
}: {
  doc: PatientDocument
  onSaveDraft: (fields: Record<string, unknown>) => void
  onComplete: (fields: Record<string, unknown>) => void
}) {
  const def = DOCUMENT_DEFINITIONS.intake_survey
  const [fields, setFields] = useState<Record<string, unknown>>(doc.fields ?? {})
  const isDone = doc.status === "completed" || doc.status === "signed"
  const canComplete = requiredFieldsSatisfied(def.fields, fields)

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {def.fields.map((f) => (
          <DocumentField
            key={f.id}
            field={f}
            value={fields[f.id]}
            disabled={isDone}
            onChange={(v) => setFields((prev) => ({ ...prev, [f.id]: v }))}
          />
        ))}
      </div>

      {!isDone && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onSaveDraft(fields)} className="gap-1.5">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button size="sm" onClick={() => onComplete(fields)} disabled={!canComplete} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Complete Survey
          </Button>
        </div>
      )}
    </div>
  )
}
