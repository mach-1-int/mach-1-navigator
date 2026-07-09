/**
 * Verification: G-2 Documents & e-sign
 * Run: npx tsx scripts/verify-ops-documents.ts
 *
 * Covers: document lifecycle (not_started -> draft -> signed/completed),
 * checklist <-> document mapping + auto-check semantics, the Patient-
 * Agreement billing gate (claims engine), and seed integrity (every active
 * patient has a signed contract + ROI; Rosa untouched; Walter's contract in
 * draft). Blocks 2/3/5 of scripts/verify-gellert-ops.ts already cover most
 * of this from the Phase 0 side — this file re-verifies from the G-2
 * component-integration angle (document-definitions + document-dialog
 * plumbing) and stays standalone so it can run before integration merges it.
 */

import {
  DOCUMENT_DEFINITIONS,
  documentForChecklistItem,
  checklistItemForDocument,
  isDocumentSatisfied,
  ROI_ATTESTATION_TEXT,
  CONTRACT_ATTESTATION_TEXT,
} from "../lib/document-definitions"
import { generateMonthlyClaims } from "../lib/claims-engine"
import { getPayerConfig } from "../lib/payer-config"
import { createInitialState } from "../lib/store"
import {
  initialPatients,
  initialNavigators,
  initialTimeLogs,
  initialIntakeRecords,
  initialPatientDocuments,
} from "../lib/initial-data"
import type { PatientDocument, PatientDocumentType } from "../lib/types"

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

console.log("G-2 Documents & e-sign – Verification")
console.log("======================================")

// ============================================================================
// BLOCK 1: STORE WIRING
// ============================================================================

run("Block 1: patientDocuments slice present on initial state", () => {
  const state = createInitialState()
  assert(Array.isArray(state.patientDocuments), "patientDocuments is an array")
  assert(state.patientDocuments.length === initialPatientDocuments.length, "seed count matches lib/initial-data")
})

// ============================================================================
// BLOCK 2: DOCUMENT LIFECYCLE (draft -> signed / completed)
// ============================================================================

function mkDoc(type: PatientDocumentType, overrides: Partial<PatientDocument> = {}): PatientDocument {
  return {
    id: `doc-fixture-${type}`,
    patientId: "pt-fixture",
    type,
    status: "not_started",
    fields: {},
    createdAt: "2026-03-01T10:00:00-07:00",
    updatedAt: "2026-03-01T10:00:00-07:00",
    ...overrides,
  }
}

run("Block 2: Non-signature document lifecycle (not_started -> draft -> completed)", () => {
  const notStarted = mkDoc("intake_survey")
  assert(!isDocumentSatisfied(notStarted), "not_started does not satisfy its checklist item")

  const draft = { ...notStarted, status: "draft" as const, fields: { "living-situation": "Lives alone" } }
  assert(!isDocumentSatisfied(draft), "draft does not satisfy its checklist item")

  const completed = { ...draft, status: "completed" as const }
  assert(isDocumentSatisfied(completed), "completed satisfies a non-signature document's checklist item")
})

run("Block 2b: Signature document lifecycle (draft -> signed only)", () => {
  const draft = mkDoc("navigation_contract", { status: "draft", fields: { "services-reviewed": true } })
  assert(!isDocumentSatisfied(draft), "draft contract does not satisfy its checklist item")

  const completedButNotSigned = { ...draft, status: "completed" as const }
  assert(!isDocumentSatisfied(completedButNotSigned), "'completed' is not a legal terminal status for a signature doc — only 'signed' satisfies")

  const signed: PatientDocument = {
    ...draft,
    status: "signed",
    signature: {
      signedByName: "Walter Briggs",
      relationship: "patient",
      signedAt: "2026-03-01T11:00:00-07:00",
      attestationText: CONTRACT_ATTESTATION_TEXT,
    },
  }
  assert(isDocumentSatisfied(signed), "signed contract satisfies its checklist item")
  assert(signed.signature!.attestationText === CONTRACT_ATTESTATION_TEXT, "signature carries the verbatim attestation text")
})

// ============================================================================
// BLOCK 3: CHECKLIST <-> DOCUMENT MAPPING (auto-check wiring surface)
// ============================================================================

run("Block 3: documentForChecklistItem / checklistItemForDocument round-trip for all 6 mapped types", () => {
  const types: PatientDocumentType[] = [
    "roi",
    "navigation_contract",
    "intake_survey",
    "medication_list",
    "patient_photo",
    "onboarding_packet",
  ]
  for (const type of types) {
    const mapping = checklistItemForDocument(type)
    assert(documentForChecklistItem(mapping.key) === type, `${type} <-> ${mapping.key} round-trips`)
    assert(DOCUMENT_DEFINITIONS[type].fields.length > 0, `${type} has renderable field definitions`)
  }
  assert(documentForChecklistItem("risk_screening") === null, "unmapped checklist items (e.g. risk_screening) fall back to plain checkbox")
  assert(documentForChecklistItem("pcp_scheduled") === null, "pcp_scheduled has no mapped document (manual-only)")
})

// ============================================================================
// BLOCK 4: BILLING GATE (engine wired Phase 0 — re-verified from G-2 angle)
// ============================================================================

run("Block 4: Patient without a signed contract fails claim validation; seeded actives pass", () => {
  const medicaid = getPayerConfig("medicaid-bh")

  const signedSet = new Set(
    initialPatientDocuments
      .filter((d) => d.type === "navigation_contract" && d.status === "signed")
      .map((d) => d.patientId),
  )

  // All seeded active patients pass when the full seeded set is supplied.
  const gated = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords, signedSet)
  const gateFailures = gated.filter((c) => c.validationErrors?.includes("Patient Agreement not signed"))
  assert(gateFailures.length === 0, "no seeded active patient fails the Patient-Agreement gate")

  // Excluding a patient with real time logs from the set trips the gate.
  const patientWithClaims = initialTimeLogs.find((l) => signedSet.has(l.patientId))?.patientId
  assert(!!patientWithClaims, "fixture: at least one signed patient has time logs")
  const excluded = new Set(signedSet)
  excluded.delete(patientWithClaims!)
  const blocked = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords, excluded)
  const blockedClaims = blocked.filter((c) => c.patientId === patientWithClaims)
  assert(blockedClaims.length > 0, "excluded patient still produces claims (to be gated, not dropped)")
  assert(
    blockedClaims.every((c) => c.status === "NEEDS_ATTENTION" && c.validationErrors?.includes("Patient Agreement not signed")),
    "excluded patient's claims carry the 'Patient Agreement not signed' validation error",
  )
})

// ============================================================================
// BLOCK 5: SEED INTEGRITY
// ============================================================================

run("Block 5: Seed integrity — active patients signed, Rosa untouched, Walter draft", () => {
  const hasSigned = (patientId: string, type: PatientDocumentType) =>
    initialPatientDocuments.some((d) => d.patientId === patientId && d.type === type && d.status === "signed")

  const activePatients = initialPatients.filter((p) => p.survivalStatus === "active" && p.journeyPhase !== "intake")
  assert(activePatients.length >= 8, `${activePatients.length} active post-intake patients seeded`)
  for (const p of activePatients) {
    assert(hasSigned(p.id, "navigation_contract"), `${p.name}: signed navigation_contract`)
    assert(hasSigned(p.id, "roi"), `${p.name}: signed roi`)
  }

  const rosaDocs = initialPatientDocuments.filter((d) => d.patientId === "pt-journey-intake1")
  assert(rosaDocs.length === 6, "Rosa Delgado has all 6 document types seeded")
  assert(rosaDocs.every((d) => d.status === "not_started"), "Rosa Delgado: all documents not_started (fresh conversion)")

  const walterContract = initialPatientDocuments.find((d) => d.patientId === "pt-journey-intake2" && d.type === "navigation_contract")
  assert(walterContract?.status === "draft", "Walter Briggs: navigation_contract is a signable draft (live demo beat)")
  assert(!isDocumentSatisfied(walterContract!), "Walter's draft contract does not yet satisfy the checklist item")

  const walterRoi = initialPatientDocuments.find((d) => d.patientId === "pt-journey-intake2" && d.type === "roi")
  assert(walterRoi?.status === "signed" && walterRoi.signature?.attestationText === ROI_ATTESTATION_TEXT, "Walter's ROI already signed with the verbatim attestation")
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
