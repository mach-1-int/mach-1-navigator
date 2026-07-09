"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react"
import type { PatientDocument } from "@/lib/types"

interface MedRow {
  name: string
  dose: string
  frequency: string
}

function rowsFromFields(fields: Record<string, unknown>): MedRow[] {
  const rows = fields.medications
  if (Array.isArray(rows)) {
    return rows.map((r) => ({
      name: typeof (r as MedRow)?.name === "string" ? (r as MedRow).name : "",
      dose: typeof (r as MedRow)?.dose === "string" ? (r as MedRow).dose : "",
      frequency: typeof (r as MedRow)?.frequency === "string" ? (r as MedRow).frequency : "",
    }))
  }
  return []
}

/**
 * Structured medication rows for the medication_list document (Intake 1
 * checklist item). This is a document snapshot, not the live medication
 * list — G-5's med-reconciliation-card owns ongoing reconciliation.
 */
export function MedListForm({
  doc,
  onSaveDraft,
  onComplete,
}: {
  doc: PatientDocument
  onSaveDraft: (fields: Record<string, unknown>) => void
  onComplete: (fields: Record<string, unknown>) => void
}) {
  const [rows, setRows] = useState<MedRow[]>(rowsFromFields(doc.fields ?? {}))
  const [note, setNote] = useState(typeof doc.fields?.["reconciliation-note"] === "string" ? (doc.fields["reconciliation-note"] as string) : "")

  const isDone = doc.status === "completed" || doc.status === "signed"
  const canComplete = rows.length > 0 && rows.every((r) => r.name.trim().length > 0)

  const buildFields = (): Record<string, unknown> => ({
    medications: rows,
    "reconciliation-note": note,
  })

  const updateRow = (idx: number, patch: Partial<MedRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm">Medications (name, dose, frequency)</Label>
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={row.name}
                disabled={isDone}
                placeholder="Medication"
                onChange={(e) => updateRow(idx, { name: e.target.value })}
                className="flex-[2]"
              />
              <Input
                value={row.dose}
                disabled={isDone}
                placeholder="Dose"
                onChange={(e) => updateRow(idx, { dose: e.target.value })}
                className="flex-1"
              />
              <Input
                value={row.frequency}
                disabled={isDone}
                placeholder="Frequency"
                onChange={(e) => updateRow(idx, { frequency: e.target.value })}
                className="flex-1"
              />
              {!isDone && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="text-xs text-muted-foreground">No medications added yet.</p>}
        </div>
        {!isDone && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setRows((prev) => [...prev, { name: "", dose: "", frequency: "" }])}
          >
            <Plus className="h-4 w-4" />
            Add Medication
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="med-list-note" className="text-sm">
          Reconciliation note
        </Label>
        <Textarea
          id="med-list-note"
          value={note}
          disabled={isDone}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[70px] resize-none"
        />
      </div>

      {!isDone && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onSaveDraft(buildFields())} className="gap-1.5">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button size="sm" onClick={() => onComplete(buildFields())} disabled={!canComplete} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Complete
          </Button>
        </div>
      )}
    </div>
  )
}
