"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ClipboardList, Plus, X, History } from "lucide-react"
import { toast } from "sonner"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { generateId } from "@/lib/store"
import type { Medication, MedReconciliationEvent } from "@/lib/types"

const ACTION_BADGES: Record<MedReconciliationEvent["changes"][number]["action"], { label: string; className: string }> = {
  added: { label: "Added", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  removed: { label: "Removed", className: "bg-red-100 text-red-700 border-red-200" },
  dose_changed: { label: "Dose changed", className: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmed", className: "bg-slate-100 text-slate-700 border-slate-200" },
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function medLabel(m: Medication): string {
  return `${m.name} ${m.dosage}`.trim()
}

/**
 * Editable working copy of the med row (no id yet for new rows until saved).
 */
interface DraftMed extends Medication {
  isNew?: boolean
}

export function diffMedications(
  previous: Medication[],
  current: DraftMed[]
): MedReconciliationEvent["changes"] {
  const changes: MedReconciliationEvent["changes"] = []
  const prevByName = new Map(previous.map((m) => [m.name.trim().toLowerCase(), m]))
  const currentNames = new Set(current.map((m) => m.name.trim().toLowerCase()))

  for (const med of current) {
    const key = med.name.trim().toLowerCase()
    if (!key) continue
    const prior = prevByName.get(key)
    if (!prior) {
      changes.push({ medication: medLabel(med), action: "added" })
    } else if (prior.dosage !== med.dosage || prior.frequency !== med.frequency) {
      changes.push({ medication: medLabel(med), action: "dose_changed" })
    } else {
      changes.push({ medication: medLabel(med), action: "confirmed" })
    }
  }

  for (const prior of previous) {
    const key = prior.name.trim().toLowerCase()
    if (!currentNames.has(key)) {
      changes.push({ medication: medLabel(prior), action: "removed" })
    }
  }

  return changes
}

/**
 * Editable current-medication reconciliation workflow: edit the live list,
 * diff it against the last reconciliation snapshot (or the starting seed
 * list if none exists yet), and record the reconciliation event. Below,
 * the history of past reconciliations for this patient.
 */
export function MedReconciliationCard({ patientId }: { patientId: string }) {
  const { currentUser } = useRole()
  const { patients, medReconciliations, updatePatientMedications, recordMedReconciliation } = useDemoData()

  const patient = patients.find((p) => p.id === patientId)
  const history = useMemo(
    () =>
      medReconciliations
        .filter((e) => e.patientId === patientId)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [medReconciliations, patientId]
  )
  const lastEvent = history[0]

  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<DraftMed[]>([])
  const [note, setNote] = useState("")

  const pendingChanges = useMemo(() => {
    const previousSnapshot = lastEvent ? lastEvent.medications : patient?.medications ?? []
    return diffMedications(previousSnapshot, draft.filter((r) => r.name.trim()))
  }, [lastEvent, patient, draft])

  if (!patient) return null

  const openDialog = () => {
    setDraft(patient.medications.map((m) => ({ ...m })))
    setNote("")
    setDialogOpen(true)
  }

  const updateRow = (id: string, field: "name" | "dosage" | "frequency", value: string) => {
    setDraft((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const addRow = () => {
    setDraft((rows) => [
      ...rows,
      {
        id: generateId(),
        name: "",
        dosage: "",
        frequency: "",
        nextRefillDate: new Date().toISOString().slice(0, 10),
        compliance: true,
        isNew: true,
      },
    ])
  }

  const removeRow = (id: string) => {
    setDraft((rows) => rows.filter((r) => r.id !== id))
  }

  const handleRecord = () => {
    if (!currentUser) return
    const cleanMeds: Medication[] = draft
      .filter((r) => r.name.trim())
      .map((r) => ({ id: r.id, name: r.name, dosage: r.dosage, frequency: r.frequency, nextRefillDate: r.nextRefillDate, compliance: r.compliance }))

    updatePatientMedications(patientId, cleanMeds, currentUser.id)
    recordMedReconciliation(patientId, pendingChanges, note.trim() || undefined, currentUser.id, currentUser.name)

    toast.success("Medication reconciliation recorded", {
      description: `${pendingChanges.length} change${pendingChanges.length === 1 ? "" : "s"} logged for ${patient.name}.`,
    })
    setDialogOpen(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Medication Reconciliation
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button size="sm" onClick={openDialog}>
              Record reconciliation
            </Button>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Record medication reconciliation</DialogTitle>
                <DialogDescription>
                  Edit the current medication list to match what the patient is actually taking, then record the
                  reconciliation. Changes are diffed against{" "}
                  {lastEvent ? `the ${formatDateTime(lastEvent.at)} reconciliation` : "the starting medication list"}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {draft.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-end p-2 rounded-md bg-muted/40">
                    <div className="col-span-5 space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(row.id, "name", e.target.value)}
                        placeholder="Medication name"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs text-muted-foreground">Dose</Label>
                      <Input
                        value={row.dosage}
                        onChange={(e) => updateRow(row.id, "dosage", e.target.value)}
                        placeholder="e.g. 10mg"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs text-muted-foreground">Frequency</Label>
                      <Input
                        value={row.frequency}
                        onChange={(e) => updateRow(row.id, "frequency", e.target.value)}
                        placeholder="e.g. Once daily"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(row.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add medication
                </Button>
              </div>

              {pendingChanges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pendingChanges.map((c, i) => (
                    <Badge key={i} variant="outline" className={`text-xs ${ACTION_BADGES[c.action].className}`}>
                      {c.medication} · {ACTION_BADGES[c.action].label}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="space-y-1 pt-1">
                <Label className="text-xs text-muted-foreground">Note (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Reconciled against discharge summary; dosage changes confirmed with PCP."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRecord} disabled={pendingChanges.length === 0}>
                  Record reconciliation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No reconciliations recorded yet</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Reconciliation history
            </div>
            {history.map((event, idx) => (
              <div key={event.id}>
                {idx > 0 && <Separator className="my-3" />}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{formatDateTime(event.at)}</span>
                    <span className="text-xs text-muted-foreground">by {event.byName}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {event.changes.map((c, i) => (
                      <Badge key={i} variant="outline" className={`text-xs ${ACTION_BADGES[c.action].className}`}>
                        {c.medication} · {ACTION_BADGES[c.action].label}
                      </Badge>
                    ))}
                  </div>
                  {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
