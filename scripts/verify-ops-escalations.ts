/**
 * Verification: G-4 Clinical response (adverse-event tasks + escalations)
 * Run: npx tsx scripts/verify-ops-escalations.ts
 *
 * Standalone harness — demo-data-context.tsx's escalation/task reducers are
 * inline useCallback closures (no exported pure functions), so the lifecycle
 * legality checks below mirror those reducers' exact semantics as read from
 * source (raiseEscalation / acknowledgeEscalation / resolveEscalation) rather
 * than importing React. tasksForAdverseEvent and seed-integrity blocks import
 * the real lib modules directly.
 */

import { tasksForAdverseEvent, taskId, taskKey, TASK_TYPE_CONFIG } from "../lib/task-engine"
import { addBusinessDays } from "../lib/business-days"
import {
  initialPatients,
  initialAdverseEvents,
  initialNavigatorTasks,
  initialEscalations,
  initialSupervisors,
} from "../lib/initial-data"
import type { AdverseEvent, Escalation, Message, Patient } from "../lib/types"

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
// REDUCER MIRRORS (lib/demo-data-context.tsx semantics, exercised headlessly)
// ============================================================================

let idCounter = 0
function generateId(): string {
  idCounter++
  return `test-id-${idCounter}`
}

/** Mirrors raiseEscalation: creates the escalation + a nudge Message to the assigned supervisor. */
function raiseEscalation(
  patient: Patient,
  navigatorId: string,
  navigatorName: string,
  supervisorName: string,
  reason: Escalation["reason"],
  description: string
): { escalation: Escalation; nudge: Message } {
  const now = new Date().toISOString()
  const escalation: Escalation = {
    id: generateId(),
    patientId: patient.id,
    navigatorId,
    reason,
    description,
    raisedAt: now,
    status: "open",
  }
  const nudge: Message = {
    id: generateId(),
    senderId: navigatorId,
    senderName: navigatorName,
    senderRole: "navigator",
    receiverId: patient.assignedSupervisor,
    receiverName: supervisorName,
    receiverRole: "supervisor",
    content: `Escalation raised for ${patient.name} (${reason.replace(/_/g, " ")}): ${description}`,
    timestamp: now,
    readStatus: false,
    type: "nudge",
    patientId: patient.id,
    patientName: patient.name,
  }
  return { escalation, nudge }
}

/** Mirrors acknowledgeEscalation: open -> acknowledged only (no-op otherwise). */
function acknowledgeEscalation(escalation: Escalation, by: string): Escalation {
  if (escalation.status !== "open") return escalation
  return { ...escalation, status: "acknowledged", acknowledgedBy: by, acknowledgedAt: new Date().toISOString() }
}

/** Mirrors resolveEscalation: open|acknowledged -> resolved; back-stamps ack when raised straight from open. */
function resolveEscalation(escalation: Escalation, by: string, resolutionNote: string): Escalation {
  if (escalation.status === "resolved") return escalation
  const now = new Date().toISOString()
  return {
    ...escalation,
    status: "resolved",
    acknowledgedBy: escalation.acknowledgedBy ?? by,
    acknowledgedAt: escalation.acknowledgedAt ?? now,
    resolvedBy: by,
    resolvedAt: now,
    resolutionNote,
  }
}

// ============================================================================
// BLOCK 1: ESCALATION LIFECYCLE LEGALITY
// ============================================================================

run("Block 1: Escalation lifecycle — legal forward transitions", () => {
  const base: Escalation = {
    id: "esc-x",
    patientId: "pt-x",
    navigatorId: "nav-x",
    reason: "clinical_risk",
    description: "test",
    raisedAt: "2026-03-01T10:00:00Z",
    status: "open",
  }

  const acknowledged = acknowledgeEscalation(base, "sup-1")
  assert(acknowledged.status === "acknowledged", "open -> acknowledged")
  assert(acknowledged.acknowledgedBy === "sup-1" && !!acknowledged.acknowledgedAt, "acknowledge stamps by/at")

  const resolved = resolveEscalation(acknowledged, "sup-1", "Resolved via community referral")
  assert(resolved.status === "resolved", "acknowledged -> resolved")
  assert(resolved.resolvedBy === "sup-1" && resolved.resolutionNote === "Resolved via community referral", "resolve stamps by/note")
  assert(resolved.acknowledgedBy === "sup-1" && resolved.acknowledgedAt === acknowledged.acknowledgedAt, "prior acknowledgment preserved, not overwritten")
})

run("Block 1b: Resolving straight from open BACK-STAMPS acknowledgment (frozen contract, not rejected)", () => {
  const openEsc: Escalation = {
    id: "esc-y",
    patientId: "pt-x",
    navigatorId: "nav-x",
    reason: "safety",
    description: "test",
    raisedAt: "2026-03-01T10:00:00Z",
    status: "open",
  }
  const resolved = resolveEscalation(openEsc, "sup-2", "Handled directly")
  assert(resolved.status === "resolved", "open -> resolved is legal (not rejected)")
  assert(resolved.acknowledgedBy === "sup-2", "back-stamped acknowledgedBy = resolver")
  assert(resolved.acknowledgedAt === resolved.resolvedAt, "back-stamped acknowledgedAt = resolution timestamp")
})

run("Block 1c: No backward transitions / no-ops on illegal calls", () => {
  const acknowledgedEsc: Escalation = {
    id: "esc-z",
    patientId: "pt-x",
    navigatorId: "nav-x",
    reason: "other",
    description: "test",
    raisedAt: "2026-03-01T10:00:00Z",
    status: "acknowledged",
    acknowledgedBy: "sup-1",
    acknowledgedAt: "2026-03-01T11:00:00Z",
  }
  // acknowledge() on an already-acknowledged escalation is a no-op (guard: status !== "open")
  const reacknowledged = acknowledgeEscalation(acknowledgedEsc, "sup-2")
  assert(reacknowledged === acknowledgedEsc, "acknowledging a non-open escalation is a no-op (guard holds)")

  const resolvedEsc: Escalation = { ...acknowledgedEsc, status: "resolved", resolvedBy: "sup-1", resolvedAt: "2026-03-01T12:00:00Z", resolutionNote: "done" }
  // resolve() on an already-resolved escalation is a no-op (guard: status === "resolved" -> return unchanged)
  const reresolved = resolveEscalation(resolvedEsc, "sup-3", "different note")
  assert(reresolved === resolvedEsc, "re-resolving a resolved escalation is a no-op (guard holds)")

  // acknowledge() never legally reaches "resolved", and resolve() never legally reaches back to "open"/"acknowledged"
  assert(acknowledgeEscalation(resolvedEsc, "sup-4").status === "resolved", "acknowledge cannot move a resolved escalation backward")
})

// ============================================================================
// BLOCK 2: RAISE CREATES A NUDGE MESSAGE TO THE ASSIGNED SUPERVISOR
// ============================================================================

run("Block 2: raiseEscalation creates a nudge Message to the patient's assigned supervisor", () => {
  const patient = initialPatients.find((p) => p.id === "pt5") as Patient
  assert(!!patient, "pt5 (Frank Anderson) exists in seeds")

  const { escalation, nudge } = raiseEscalation(
    patient,
    "nav3",
    "Maria Santos",
    "Test Supervisor",
    "unresolved_sdoh",
    "Utility shutoff risk to insulin storage"
  )

  assert(escalation.status === "open" && escalation.patientId === patient.id, "new escalation opens for the patient")
  assert(nudge.type === "nudge", "a Message of type 'nudge' is created")
  assert(nudge.receiverId === patient.assignedSupervisor, "nudge addressed to the patient's assigned supervisor")
  assert(nudge.senderId === "nav3" && nudge.senderRole === "navigator", "nudge sent by the raising navigator")
  assert(nudge.patientId === patient.id && nudge.patientName === patient.name, "nudge carries patient context")
  assert(nudge.content.includes("unresolved sdoh") && nudge.content.includes("Utility shutoff"), "nudge content names the reason + description")
})

// ============================================================================
// BLOCK 3: tasksForAdverseEvent SET CORRECTNESS
// ============================================================================

run("Block 3: tasksForAdverseEvent — 4-task set + business-day PCP due", () => {
  const patient = initialPatients.find((p) => p.id === "pt5") as Patient
  const endedEvent: AdverseEvent = {
    id: "ae-fixture-g4",
    patientId: "pt5",
    type: "fall",
    diagnosis: "Fall at home",
    startDate: "2026-01-20",
    endDate: "2026-01-22",
    status: "ended",
    rightCareFlag: true,
    followUpStatus: "completed",
  }

  const tasks = tasksForAdverseEvent(endedEvent, patient)
  assert(tasks.length === 4, `ended event yields exactly 4 tasks (got ${tasks.length})`)

  const types = tasks.map((t) => t.type).sort()
  assert(
    JSON.stringify(types) === JSON.stringify(["post_discharge_med_rec", "post_discharge_pcp", "post_event_contact", "risk_reduction_education"].sort()),
    "task set = post_event_contact, post_discharge_pcp, post_discharge_med_rec, risk_reduction_education"
  )

  const pcpTask = tasks.find((t) => t.type === "post_discharge_pcp")!
  const expectedDue = addBusinessDays(endedEvent.endDate!, 7)
  assert(pcpTask.dueAt.startsWith(expectedDue), `PCP task due = addBusinessDays(endDate, 7) = ${expectedDue} (got ${pcpTask.dueAt})`)
  assert(tasks.every((t) => t.adverseEventId === endedEvent.id), "every task references the adverse event")
  assert(tasks.every((t) => t.navigatorId === patient.assignedNavigator), "every task assigned to the patient's navigator")
  assert(tasks.every((t) => t.id === taskId(t.type, endedEvent.id)), "deterministic ids -> idempotent regeneration")

  const notEnded: AdverseEvent = { ...endedEvent, id: "ae-fixture-g4-open", endDate: undefined, status: "monitoring" }
  const openTasks = tasksForAdverseEvent(notEnded, patient)
  assert(openTasks.length === 1 && openTasks[0].type === "post_event_contact", "non-ended event yields only post_event_contact")

  assert(Object.keys(TASK_TYPE_CONFIG).length === 9, "TASK_TYPE_CONFIG covers all 9 task types")
})

// ============================================================================
// BLOCK 4: SEED INTEGRITY
// ============================================================================

run("Block 4: Seed integrity — open pt5 escalation + ae2 task set", () => {
  const openEsc = initialEscalations.find((e) => e.patientId === "pt5" && e.status === "open")
  assert(!!openEsc, "an open escalation exists for pt5 (Frank Anderson)")
  assert(openEsc!.reason === "unresolved_sdoh", "seeded open escalation reason = unresolved_sdoh")

  const resolvedEsc = initialEscalations.find((e) => e.status === "resolved")
  assert(!!resolvedEsc, "a resolved historical escalation exists")
  assert(!!resolvedEsc!.resolvedBy && !!resolvedEsc!.resolvedAt && !!resolvedEsc!.resolutionNote, "resolved escalation carries resolver/timestamp/note")
  assert(!!resolvedEsc!.acknowledgedBy && !!resolvedEsc!.acknowledgedAt, "resolved escalation carries an acknowledgment stamp")

  const supervisorIds = new Set(initialSupervisors.map((s) => s.id))
  for (const esc of initialEscalations) {
    const patient = initialPatients.find((p) => p.id === esc.patientId)
    assert(!!patient, `escalation ${esc.id} references a seeded patient`)
    assert(supervisorIds.has(patient!.assignedSupervisor), `escalation ${esc.id}'s patient has a real assigned supervisor`)
  }

  const ae2 = initialAdverseEvents.find((ae) => ae.id === "ae2") as AdverseEvent
  assert(!!ae2 && ae2.status === "ended" && ae2.patientId === "pt5", "ae2 is pt5's ended fall event")

  const ae2Tasks = initialNavigatorTasks.filter((t) => t.adverseEventId === "ae2")
  assert(ae2Tasks.length === 4, `ae2 has its full 4-task response set seeded (got ${ae2Tasks.length})`)
  const ae2PcpTask = ae2Tasks.find((t) => t.type === "post_discharge_pcp")
  assert(!!ae2PcpTask, "ae2 seed set includes post_discharge_pcp")
  const expectedPcpDue = addBusinessDays(ae2.endDate!, 7)
  assert(ae2PcpTask!.dueAt.startsWith(expectedPcpDue), `seeded ae2 PCP task due matches addBusinessDays(endDate, 7) = ${expectedPcpDue}`)

  const patient = initialPatients.find((p) => p.id === "pt5") as Patient
  const computedAe2Tasks = tasksForAdverseEvent(ae2, patient)
  const computedKeys = new Set(computedAe2Tasks.map((t) => taskKey(t)))
  for (const seeded of ae2Tasks) {
    assert(computedKeys.has(taskKey(seeded)), `seeded task ${seeded.id} matches an engine-derivable key (idempotent regeneration would not duplicate it)`)
  }
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
