/**
 * Verification: Gellert Ops Blitz (tasks, documents, escalations, comms, training)
 * Run: npm run verify:ops
 *
 * Phase 0 scaffold blocks: store v14 slices, seed integrity (billing gate
 * seeds), the Patient-Agreement claims gate, task-engine window/idempotency/
 * business-day math, document<->checklist mapping, provider-comm rendering,
 * onboarding curriculum, and engagement cadence.
 *
 * Workstreams G-1..G-9 append their own blocks (scripts/verify-ops-*.ts merge
 * here at integration).
 */

import {
  deriveDueConfirmationTasks,
  taskForCompletedVisit,
  taskForNoShow,
  tasksForAdverseEvent,
  overdueTasks,
  taskId,
  taskKey,
  confirmationWindowForType,
  TASK_TYPE_CONFIG,
} from "../lib/task-engine"
import {
  DOCUMENT_DEFINITIONS,
  documentForChecklistItem,
  checklistItemForDocument,
  isDocumentSatisfied,
  ROI_ATTESTATION_TEXT,
  CONTRACT_ATTESTATION_TEXT,
} from "../lib/document-definitions"
import { renderProviderComm } from "../lib/provider-comms"
import { weeklyContactCounts, cadenceStatus } from "../lib/engagement"
import {
  ONBOARDING_CURRICULUM,
  SHADOW_CHECKLIST,
  onboardingProgress,
  nextMilestone,
  createOnboardingRecord,
} from "../lib/onboarding"
import { addBusinessDays } from "../lib/business-days"
import { generateMonthlyClaims } from "../lib/claims-engine"
import { getPayerConfig } from "../lib/payer-config"
import { createInitialState } from "../lib/store"
import {
  initialPatients,
  initialNavigators,
  initialTimeLogs,
  initialIntakeRecords,
  initialPatientDocuments,
  initialNavigatorTasks,
  initialEscalations,
  initialProviderCommunications,
  initialNavigatorOnboarding,
  initialAppointments,
} from "../lib/initial-data"
import type {
  AdverseEvent,
  Appointment,
  NavigatorTask,
  Patient,
  PatientDocumentType,
  PatientNote,
  TimeLog,
} from "../lib/types"

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

// ============================================================================
// FIXTURES
// ============================================================================

function mkAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt-fixture",
    patientId: "pt-fixture",
    navigatorId: "nav-fixture",
    date: "2026-03-12",
    time: "10:00",
    type: "home_visit",
    status: "scheduled",
    ...overrides,
  }
}

// ============================================================================
// BLOCK 1: STORE v14 + NEW SLICES
// ============================================================================

run("Block 1: Store v14 exposes the ops slices", () => {
  const state = createInitialState()
  assert(state._version >= 14, `store version ${state._version} >= 14`)
  assert(state.navigatorTasks.length === initialNavigatorTasks.length, `navigatorTasks seeded (${state.navigatorTasks.length})`)
  assert(state.patientDocuments.length === initialPatientDocuments.length, `patientDocuments seeded (${state.patientDocuments.length})`)
  assert(state.medReconciliations.length >= 1, "medReconciliations seeded")
  assert(state.escalations.length === initialEscalations.length, `escalations seeded (${state.escalations.length})`)
  assert(state.providerCommunications.length === initialProviderCommunications.length, `providerCommunications seeded (${state.providerCommunications.length})`)
  assert(state.navigatorOnboarding.length === initialNavigatorOnboarding.length, `navigatorOnboarding seeded (${state.navigatorOnboarding.length})`)
})

// ============================================================================
// BLOCK 2: SEED INTEGRITY (billing-gate seeds)
// ============================================================================

run("Block 2: Every active post-intake patient has a signed contract + ROI", () => {
  const signedOfType = (patientId: string, type: PatientDocumentType) =>
    initialPatientDocuments.some((d) => d.patientId === patientId && d.type === type && d.status === "signed")

  const gated = initialPatients.filter((p) => p.survivalStatus === "active" && p.journeyPhase !== "intake")
  assert(gated.length >= 8, `${gated.length} active post-intake patients in seeds`)
  for (const patient of gated) {
    assert(signedOfType(patient.id, "navigation_contract"), `${patient.name}: navigation contract signed`)
    assert(signedOfType(patient.id, "roi"), `${patient.name}: ROI signed`)
  }

  // Tension states: Rosa untouched; Walter's contract is a signable DRAFT
  const rosaDocs = initialPatientDocuments.filter((d) => d.patientId === "pt-journey-intake1")
  assert(rosaDocs.length === 6 && rosaDocs.every((d) => d.status === "not_started"), "Rosa Delgado: all 6 documents not_started")
  const walterContract = initialPatientDocuments.find(
    (d) => d.patientId === "pt-journey-intake2" && d.type === "navigation_contract"
  )
  assert(walterContract?.status === "draft", "Walter Briggs: navigation contract in draft (live demo beat)")

  // Signed documents carry the exact attestation language
  const signedContracts = initialPatientDocuments.filter((d) => d.type === "navigation_contract" && d.status === "signed")
  assert(
    signedContracts.every((d) => d.signature?.attestationText === CONTRACT_ATTESTATION_TEXT),
    "signed contracts carry the verbatim service-agreement attestation"
  )
  const signedRois = initialPatientDocuments.filter((d) => d.type === "roi" && d.status === "signed")
  assert(
    signedRois.every((d) => d.signature?.attestationText === ROI_ATTESTATION_TEXT),
    "signed ROIs carry the verbatim HIPAA release attestation"
  )
})

// ============================================================================
// BLOCK 3: PATIENT-AGREEMENT BILLING GATE (claims engine)
// ============================================================================

run("Block 3: Claims gate — 'Patient Agreement not signed'", () => {
  const medicaid = getPayerConfig("medicaid-bh")

  // Legacy behavior: no set passed -> no gate errors anywhere
  const rawClaims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  assert(
    rawClaims.every((c) => !c.validationErrors?.includes("Patient Agreement not signed")),
    "no gate errors when the set is omitted (verify-harness compatibility)"
  )

  // Full seeded set -> identical statuses to the raw run (seeds keep billing green)
  const signedSet = new Set(
    initialPatientDocuments.filter((d) => d.type === "navigation_contract" && d.status === "signed").map((d) => d.patientId)
  )
  const gatedClaims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords, signedSet)
  assert(gatedClaims.length === rawClaims.length, "gated run produces the same claim set")
  for (const claim of gatedClaims) {
    const raw = rawClaims.find((c) => c.id === claim.id)
    assert(!!raw && raw.status === claim.status, `claim ${claim.id} status unchanged by the seeded gate (${claim.status})`)
  }

  // Remove pt1 from the set -> its claims fail with the gate error
  const withoutPt1 = new Set(signedSet)
  withoutPt1.delete("pt1")
  const blocked = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords, withoutPt1)
  const pt1Claims = blocked.filter((c) => c.patientId === "pt1")
  assert(pt1Claims.length > 0, "pt1 has claims to gate")
  assert(
    pt1Claims.every((c) => c.status === "NEEDS_ATTENTION" && c.validationErrors?.includes("Patient Agreement not signed")),
    "unsigned patient's claims fail with 'Patient Agreement not signed'"
  )
})

// ============================================================================
// BLOCK 4: TASK ENGINE — windows, idempotency, business days
// ============================================================================

run("Block 4: Confirmation window derivation + idempotency", () => {
  const appt = mkAppointment() // 2026-03-12 10:00

  // Only the 48h window has opened
  const at48h = deriveDueConfirmationTasks([appt], [], new Date("2026-03-10T11:00:00"))
  assert(at48h.length === 1 && at48h[0].type === "confirmation_48h", "48h window opens 48h before the appointment")
  assert(at48h[0].id === taskId("confirmation_48h", appt.id), "deterministic task id")

  // Day-of morning: all three windows have opened
  const dayOf = deriveDueConfirmationTasks([appt], [], new Date("2026-03-12T08:30:00"))
  assert(dayOf.length === 3, "all three windows open by the appointment morning")
  assert(dayOf.some((t) => t.type === "confirmation_day_of"), "day-of task generated from 08:00 local")

  // A confirmed window is never regenerated
  const confirmed = mkAppointment({ confirmations: [{ window: "48h", at: "2026-03-10T10:05:00-07:00", by: "nav-fixture", outcome: "confirmed" }] })
  const afterConfirm = deriveDueConfirmationTasks([confirmed], [], new Date("2026-03-12T08:30:00"))
  assert(afterConfirm.length === 2 && !afterConfirm.some((t) => t.type === "confirmation_48h"), "already-confirmed windows are skipped")

  // Existing tasks in ANY status suppress regeneration (idempotency)
  const dismissed: NavigatorTask = { ...dayOf[1], status: "dismissed" }
  const rerun = deriveDueConfirmationTasks([appt], [dismissed, ...at48h], new Date("2026-03-12T08:30:00"))
  assert(rerun.length === 1, "existing tasks (any status) suppress regeneration")
  assert(taskKey(dismissed) === `${dismissed.type}:${appt.id}`, "idempotency key = (type, appointmentId)")

  // Past appointments never generate confirmations
  const past = deriveDueConfirmationTasks([appt], [], new Date("2026-03-12T10:30:00"))
  assert(past.length === 0, "appointments already started/past generate nothing")
})

run("Block 4b: Outcome + adverse-event tasks (business-day PCP due)", () => {
  const noShow = taskForNoShow(mkAppointment({ status: "no_show" }))
  assert(noShow.type === "no_show_recovery" && new Date(noShow.dueAt).getHours() === 18, "no-show recovery due same day 6:00 PM local")

  const followup = taskForCompletedVisit(mkAppointment({ status: "completed" }))
  assert(
    followup.type === "post_visit_followup" &&
      new Date(followup.dueAt).getTime() === new Date("2026-03-12T10:00:00").getTime() + 24 * 3600 * 1000,
    "post-visit follow-up due +24h"
  )

  const patient = initialPatients.find((p) => p.id === "pt5") as Patient
  const endedEvent: AdverseEvent = {
    id: "ae-fixture", patientId: "pt5", type: "fall", diagnosis: "Fall",
    startDate: "2026-01-20", endDate: "2026-01-22", status: "ended",
    rightCareFlag: true, followUpStatus: "completed",
  }
  const aeTasks = tasksForAdverseEvent(endedEvent, patient)
  assert(aeTasks.length === 4, "ended adverse event yields the full 4-task response set")
  const pcp = aeTasks.find((t) => t.type === "post_discharge_pcp")
  assert(
    !!pcp && pcp.dueAt.startsWith(addBusinessDays("2026-01-22", 7)),
    `post-discharge PCP due addBusinessDays(endDate, 7) = ${addBusinessDays("2026-01-22", 7)}`
  )
  assert(aeTasks.every((t) => t.navigatorId === patient.assignedNavigator), "AE tasks assigned to the patient's navigator")

  const openEvent: AdverseEvent = { ...endedEvent, id: "ae-open", endDate: undefined, status: "monitoring" }
  assert(tasksForAdverseEvent(openEvent, patient).length === 1, "non-ended event yields only the post-event contact")

  // Overdue is DATE-based: same-day tasks are never instantly red
  const now = new Date("2026-03-12T12:00:00")
  const dueEarlierToday: NavigatorTask = { ...noShow, id: "t-today", dueAt: "2026-03-12T08:00:00", status: "open" }
  const dueYesterday: NavigatorTask = { ...noShow, id: "t-yesterday", dueAt: "2026-03-11T18:00:00", status: "open" }
  const done: NavigatorTask = { ...noShow, id: "t-done", dueAt: "2026-03-01T18:00:00", status: "done" }
  const overdue = overdueTasks([dueEarlierToday, dueYesterday, done], now)
  assert(overdue.length === 1 && overdue[0].id === "t-yesterday", "overdue = OPEN with a due DATE before today")

  // Config completeness
  assert(
    (Object.keys(TASK_TYPE_CONFIG).length === 9) && Object.values(TASK_TYPE_CONFIG).every((c) => !!c.label && !!c.color && !!c.icon),
    "TASK_TYPE_CONFIG covers all 9 task types with label/icon/color"
  )
  assert(confirmationWindowForType("confirmation_24h") === "24h" && confirmationWindowForType("no_show_recovery") === null,
    "confirmationWindowForType maps confirmation types only")
})

run("Block 4c: Seeded tasks reference real entities and use engine ids", () => {
  const apptIds = new Set(initialAppointments.map((a) => a.id))
  const patientIds = new Set(initialPatients.map((p) => p.id))
  for (const task of initialNavigatorTasks) {
    assert(patientIds.has(task.patientId), `task ${task.id} references a seeded patient`)
    if (task.appointmentId) {
      assert(apptIds.has(task.appointmentId), `task ${task.id} references a seeded appointment`)
      assert(task.id === taskId(task.type, task.appointmentId), `task ${task.id} uses the deterministic id scheme`)
    }
  }
  const open = initialNavigatorTasks.filter((t) => t.status === "open")
  assert(open.length >= 5, `${open.length} open tasks on load (confirmations, follow-up, recovery, PCP countdown)`)
})

// ============================================================================
// BLOCK 5: DOCUMENT <-> CHECKLIST MAPPING
// ============================================================================

run("Block 5: Document definitions and checklist mapping", () => {
  const types: PatientDocumentType[] = ["roi", "navigation_contract", "intake_survey", "medication_list", "patient_photo", "onboarding_packet"]
  for (const type of types) {
    const def = DOCUMENT_DEFINITIONS[type]
    assert(!!def && def.fields.length > 0, `${type}: definition with fields`)
    const mapping = checklistItemForDocument(type)
    assert(documentForChecklistItem(mapping.key) === type, `${type} <-> ${mapping.key} round-trips`)
  }
  assert(documentForChecklistItem("health_history") === null, "unmapped checklist items return null (manual checkbox)")
  assert(DOCUMENT_DEFINITIONS.roi.requiresSignature && DOCUMENT_DEFINITIONS.navigation_contract.requiresSignature,
    "roi + navigation_contract require signature")
  assert(DOCUMENT_DEFINITIONS.roi.attestationText!.includes("insurance company") && DOCUMENT_DEFINITIONS.roi.attestationText!.includes("pharmacy"),
    "ROI attestation names the insurance company and pharmacy (playbook §5.1)")
  assert(DOCUMENT_DEFINITIONS.navigation_contract.attestationText!.includes("zero-tolerance"),
    "contract attestation includes the zero-tolerance acknowledgment")

  const draftContract = initialPatientDocuments.find((d) => d.id === "doc-pt-journey-intake2-navigation_contract")!
  assert(!isDocumentSatisfied(draftContract), "a draft contract does not satisfy its checklist item")
  const signedContract = initialPatientDocuments.find((d) => d.id === "doc-pt1-navigation_contract")!
  assert(isDocumentSatisfied(signedContract), "a signed contract satisfies its checklist item")
  const completedSurvey = initialPatientDocuments.find((d) => d.id === "doc-pt1-intake_survey")!
  assert(isDocumentSatisfied(completedSurvey), "a completed (non-signature) document satisfies its item")
})

// ============================================================================
// BLOCK 6: PROVIDER COMMUNICATION RENDERING
// ============================================================================

run("Block 6: renderProviderComm carries the required elements", () => {
  const intake = renderProviderComm("intake_notification", {
    patientName: "Test Patient",
    referringProvider: "Dr. Ref",
    intakeCompletedDate: "January 30",
    pcpAppointmentDate: "February 5",
    clinicalSummary: "CHF (I50.9)",
  })
  assert(intake.body.includes("January 30") && intake.body.includes("February 5"), "intake: completion date + PCP date")
  assert(intake.body.includes("CHF (I50.9)"), "intake: relevant clinical info")
  assert(intake.subject.startsWith("secmsg:"), "subjects use the secmsg HIPAA convention")

  const exit = renderProviderComm("exit_notification", { patientName: "Test Patient", exitReason: "patient_initiated", exitDate: "2026-01-18" })
  assert(exit.body.includes("patient_initiated") && exit.body.includes("2026-01-18"), "exit: reason + date")
  assert(exit.body.toLowerCase().includes("closed"), "exit: record closure language")

  const unreachable = renderProviderComm("unreachable_notification", { patientName: "Test Patient", outreachAttempts: 7, closedDate: "December 30" })
  assert(unreachable.body.includes("7 documented outreach attempts"), "unreachable: attempt count")

  const ineligible = renderProviderComm("ineligible_notification", { patientName: "Test Patient", ineligibilityReason: "insurance", closedDate: "January 13" })
  assert(ineligible.body.includes("insurance"), "ineligible: reason")

  assert(initialProviderCommunications.every((c) => c.simulated === true), "seeded communications are honestly simulated")
})

// ============================================================================
// BLOCK 7: ONBOARDING CURRICULUM + SEED CONSISTENCY
// ============================================================================

run("Block 7: Onboarding curriculum, progress math, level consistency", () => {
  assert(ONBOARDING_CURRICULUM.length === 8, "curriculum has the 8 playbook §10.1 milestones")
  assert(SHADOW_CHECKLIST.length >= 5, "shadowing checklist populated")

  const fresh = createOnboardingRecord("nav-x", "2026-03-01")
  assert(onboardingProgress(fresh).completed === 0 && onboardingProgress(fresh).percent === 0, "fresh record starts at 0%")
  assert(nextMilestone(fresh)?.key === "orientation_week1", "next milestone of a fresh record is Week-1 orientation")

  const nav2Record = initialNavigatorOnboarding.find((r) => r.navigatorId === "nav2")!
  assert(onboardingProgress(nav2Record).percent === 100, "nav2 (lead) record is 100% complete")
  assert(nextMilestone(nav2Record) === null, "completed records have no next milestone")

  const sixty = initialNavigatorOnboarding.find((r) => r.navigatorId === "nav7")!
  assert(nextMilestone(sixty)?.key === "review_60", "nav7 record sits at the 60-day review")

  // Status stays consistent with Navigator.level (developmental=1, lead=3)
  for (const record of initialNavigatorOnboarding) {
    const nav = initialNavigators.find((n) => n.id === record.navigatorId)!
    if (record.status === "developmental") assert(nav.level === 1, `${nav.name}: developmental record on a level-1 navigator`)
    if (record.status === "lead") assert(nav.level === 3, `${nav.name}: lead record on a level-3 navigator`)
  }
})

// ============================================================================
// BLOCK 8: ENGAGEMENT CADENCE
// ============================================================================

run("Block 8: weeklyContactCounts + cadenceStatus", () => {
  const now = new Date("2026-03-12T12:00:00") // Thursday; week starts Mon 2026-03-09
  const note = (id: string, createdAt: string): PatientNote => ({
    id, patientId: "pt-x", authorId: "nav-x", authorName: "Nav", authorRole: "navigator",
    content: "contact", type: "phone", createdAt,
  })
  const log = (id: string, date: string): TimeLog => ({
    id, patientId: "pt-x", date, startTime: `${date}T09:00:00`, endTime: `${date}T09:30:00`,
    durationMinutes: 30, modality: "Phone", serviceType: "CHI", navigatorId: "nav-x", verified: true,
  })
  const completedAppt = mkAppointment({ id: "apt-x", patientId: "pt-x", date: "2026-03-10", status: "completed" })

  const counts = weeklyContactCounts(
    "pt-x",
    [note("n1", "2026-03-09T10:00:00"), note("n2", "2026-03-04T10:00:00")],
    [log("l1", "2026-03-10")],
    [completedAppt],
    2,
    now
  )
  assert(counts.length === 2, "returns one bucket per requested week")
  assert(counts[0].weekStart === "2026-03-02" && counts[0].count === 1, "prior week: 1 contact day")
  assert(counts[1].weekStart === "2026-03-09" && counts[1].count === 2, "current week: 2 distinct contact days (log + appt same day dedupe)")
  assert(cadenceStatus(counts) === "multiple", "2+ contact days this week = multiple")
  assert(cadenceStatus([{ weekStart: "2026-03-09", count: 1 }]) === "single", "1 contact day = single")
  assert(cadenceStatus([{ weekStart: "2026-03-09", count: 0 }]) === "none", "0 contact days = none")

  // Supervision notes are not patient contacts
  const supNote = { ...note("n3", "2026-03-09T10:00:00"), type: "supervision" as const }
  const noContact = weeklyContactCounts("pt-x", [supNote], [], [], 1, now)
  assert(noContact[0].count === 0, "supervision notes don't count as patient contact")
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
