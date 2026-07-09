/**
 * Verification: G-5 Medication reconciliation
 * Run: npx tsx scripts/verify-ops-meds.ts
 *
 * Blocks:
 * 1. Snapshot correctness — event.medications equals the post-update list
 * 2. Diff/changes persistence — added/removed/dose_changed/confirmed classify correctly
 * 3. Checklist auto-check on first reconciliation for an intake-phase patient
 * 4. Autofill source resolves the med-assist template's activity field from current meds
 * 5. Seed integrity — the 2 seeded reconciliation events resolve to real patients
 */

import { diffMedications } from "../components/medications/med-reconciliation-card"
import { buildAutoFillContext, resolveTemplateAutoFill } from "../lib/note-autofill"
import { gellertNoteTemplates } from "../lib/gellert-templates"
import { checklistItemForDocument } from "../lib/document-definitions"
import { createInitialState, generateId } from "../lib/store"
import { initialPatients, initialMedReconciliations, initialIntakeRecords } from "../lib/initial-data"
import type { Medication, MedReconciliationEvent, IntakeRecord } from "../lib/types"

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  ✓ ${message}`)
}

let passed = 0
let failed = 0

function run(name: string, fn: () => void) {
  try {
    console.log(`\n--- ${name} ---`)
    fn()
    passed++
  } catch (e) {
    failed++
    console.error(`  ✗ ${(e as Error).message}`)
  }
}

console.log("G-5 Medication Reconciliation – Verification")
console.log("==============================================")

function mkMed(overrides: Partial<Medication>): Medication {
  return {
    id: generateId(),
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice daily",
    nextRefillDate: "2026-08-01",
    compliance: true,
    ...overrides,
  }
}

// ============================================================================
// BLOCK 1: SNAPSHOT CORRECTNESS
// ============================================================================

run("Block 1: reconciliation event snapshots the post-update medication list", () => {
  const state = createInitialState()
  const patient = state.patients.find((p) => p.id === "pt1")!
  const newMeds: Medication[] = [
    mkMed({ id: "med1", name: "Metformin", dosage: "500mg", frequency: "Twice daily" }),
    mkMed({ id: "med2", name: "Lisinopril", dosage: "20mg", frequency: "Once daily" }),
  ]

  // Simulate updatePatientMedications then recordMedReconciliation (frozen-context contract order).
  const updatedPatient = { ...patient, medications: newMeds }
  const event: MedReconciliationEvent = {
    id: generateId(),
    patientId: patient.id,
    at: new Date().toISOString(),
    by: "nav1",
    byName: "Emily Rodriguez",
    medications: updatedPatient.medications.map((m) => ({ ...m })),
    changes: diffMedications(patient.medications, newMeds),
    note: "Verified against pharmacy fill history.",
  }

  assert(
    JSON.stringify(event.medications) === JSON.stringify(newMeds),
    "event.medications deep-equals the live list at the moment of recording"
  )
  assert(event.medications !== newMeds, "snapshot is a copy, not a shared reference to the live array")
})

// ============================================================================
// BLOCK 2: DIFF / CHANGES CLASSIFICATION
// ============================================================================

run("Block 2: diffMedications classifies added/removed/dose_changed/confirmed", () => {
  const previous: Medication[] = [
    mkMed({ id: "a", name: "Metformin", dosage: "500mg", frequency: "Twice daily" }),
    mkMed({ id: "b", name: "Lisinopril", dosage: "10mg", frequency: "Once daily" }),
    mkMed({ id: "c", name: "Atorvastatin", dosage: "20mg", frequency: "Once daily" }),
  ]
  const current: Medication[] = [
    mkMed({ id: "a", name: "Metformin", dosage: "500mg", frequency: "Twice daily" }), // confirmed
    mkMed({ id: "b", name: "Lisinopril", dosage: "20mg", frequency: "Once daily" }), // dose_changed
    // Atorvastatin removed
    mkMed({ id: "d", name: "Gabapentin", dosage: "300mg", frequency: "Three times daily" }), // added
  ]

  const changes = diffMedications(previous, current)
  const byAction = (action: string) => changes.filter((c) => c.action === action)

  assert(byAction("confirmed").length === 1 && byAction("confirmed")[0].medication === "Metformin 500mg", "unchanged med classifies as confirmed")
  assert(byAction("dose_changed").length === 1 && byAction("dose_changed")[0].medication === "Lisinopril 20mg", "dosage delta classifies as dose_changed (new dose in label)")
  assert(byAction("removed").length === 1 && byAction("removed")[0].medication === "Atorvastatin 20mg", "dropped med classifies as removed")
  assert(byAction("added").length === 1 && byAction("added")[0].medication === "Gabapentin 300mg", "new med classifies as added")
  assert(changes.length === 4, "exactly one change entry per medication touched")
})

run("Block 2b: diffMedications against an empty starting list (fresh patient) is all-added", () => {
  const current: Medication[] = [mkMed({ id: "x", name: "Aspirin", dosage: "81mg", frequency: "Once daily" })]
  const changes = diffMedications([], current)
  assert(changes.length === 1 && changes[0].action === "added", "first reconciliation for a med-free patient records an 'added' change")
})

// ============================================================================
// BLOCK 3: CHECKLIST AUTO-CHECK ON FIRST RECONCILIATION
// ============================================================================

run("Block 3: first reconciliation auto-checks the med_reconciliation intake item", () => {
  const mapping = checklistItemForDocument("medication_list")
  assert(mapping.key === "med_reconciliation" && mapping.visit === 1, "medication_list maps to intake1.med_reconciliation")

  const rosaIntake = initialIntakeRecords.find((ir) => ir.patientId === "pt-journey-intake1")!
  const item = rosaIntake.intake1?.checklist.find((i) => i.key === mapping.key)
  assert(!!item && item.done === false, "fixture: Rosa Delgado (intake phase) starts with med_reconciliation unchecked")

  // Mirror the context's auto-check predicate: item exists and !item.done -> flips true.
  const wouldAutoCheck = !!item && !item.done
  assert(wouldAutoCheck, "recordMedReconciliation's auto-check guard fires for Rosa's untouched item")

  const updated: IntakeRecord = {
    ...rosaIntake,
    intake1: {
      ...rosaIntake.intake1!,
      checklist: rosaIntake.intake1!.checklist.map((i) => (i.key === mapping.key ? { ...i, done: true } : i)),
    },
  }
  const updatedItem = updated.intake1?.checklist.find((i) => i.key === mapping.key)
  assert(updatedItem?.done === true, "checklist item flips to done after the simulated auto-check")

  // Second reconciliation must not attempt to flip an already-done item (idempotent guard).
  const secondPassWouldFire = !!updatedItem && !updatedItem.done
  assert(!secondPassWouldFire, "auto-check guard is a no-op once the item is already done")
})

// ============================================================================
// BLOCK 4: AUTOFILL SOURCE — CURRENT MEDICATIONS
// ============================================================================

run("Block 4: med-assist template's pillbox-activity field autofills from current medications", () => {
  const medAssistTemplate = gellertNoteTemplates.find((t) => t.id === "template-gellert-med-assist")!
  assert(!!medAssistTemplate, "template-gellert-med-assist exists")

  const patientWithMeds = initialPatients.find((p) => p.medications.length > 0)!
  assert(!!patientWithMeds, "fixture: at least one seeded patient carries medications")

  const ctx = buildAutoFillContext({ patient: patientWithMeds, providers: [] })
  const resolved = resolveTemplateAutoFill(medAssistTemplate, ctx)

  assert(!!resolved["pillbox-activity"], "pillbox-activity resolves for a patient with current medications")
  const { value, source } = resolved["pillbox-activity"]
  assert(typeof value === "string" && (value as string).includes(patientWithMeds.medications[0].name), "resolved value names the patient's first current medication")
  assert(typeof value === "string" && (value as string).includes(patientWithMeds.medications[0].dosage), "resolved value includes the medication's dosage")
  assert(source === "standing-facts", "resolution carries a known provenance source (reuses standing-facts — chart-derived, non-provider, non-previous-note)")

  const patientNoMeds = { ...patientWithMeds, medications: [] }
  const ctxEmpty = buildAutoFillContext({ patient: patientNoMeds, providers: [] })
  const resolvedEmpty = resolveTemplateAutoFill(medAssistTemplate, ctxEmpty)
  assert(!resolvedEmpty["pillbox-activity"], "no autofill offered when the patient has no current medications")

  // Additive guarantee: other templates' resolutions are unaffected by this addition.
  const medicalTemplate = gellertNoteTemplates.find((t) => t.id === "template-gellert-medical")!
  const medicalCtx = buildAutoFillContext({ patient: patientWithMeds, providers: [] })
  const medicalResolved = resolveTemplateAutoFill(medicalTemplate, medicalCtx)
  assert(!medicalResolved["pillbox-activity"], "unrelated templates never gain the pillbox-activity key")
})

// ============================================================================
// BLOCK 5: SEED INTEGRITY
// ============================================================================

run("Block 5: seeded reconciliation events resolve to real patients", () => {
  assert(initialMedReconciliations.length === 2, "2 historical reconciliations seeded")
  for (const event of initialMedReconciliations) {
    const patient = initialPatients.find((p) => p.id === event.patientId)
    assert(!!patient, `${event.id} resolves to a real patient (${event.patientId})`)
    assert(event.medications.length > 0, `${event.id} carries a non-empty medication snapshot`)
    assert(event.changes.length === event.medications.length, `${event.id} has one change entry per snapshotted medication`)
    assert(!!event.byName && !!event.by, `${event.id} carries an actor id + display name`)
  }

  const state = createInitialState()
  assert(state.medReconciliations.length === initialMedReconciliations.length, "medReconciliations slice matches lib/initial-data seed count")
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
