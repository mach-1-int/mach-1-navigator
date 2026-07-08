/**
 * Verification: Journey lifecycle (post-conversion) — phase matrix, intake
 * protocol, telenavigation cadence, persistence.
 * Run: npx tsx scripts/verify-journey-lifecycle.ts
 *
 * Workstream J-B blocks 5-7 & 9 of the journey design. Blocks 1-4 & 8
 * (referral matrix, eligibility, outreach, funnel) live in verify-journey.ts.
 * All checks run against RAW seeds (authored at ANCHOR_DATE 2026-01-30).
 */

import {
  PHASE_TRANSITIONS,
  canTransitionPhase,
  getAdverseEventOverlay,
  telenavCheckInStatus,
  pcpDueStatus,
  buildChecklist,
  isIntakeVisitComplete,
  intakeChecklistProgress,
  INTAKE1_CHECKLIST,
  INTAKE2_CHECKLIST,
  NO_SHOW_CLOSURE_THRESHOLD,
  EXIT_PATHWAY_CONFIG,
  JOURNEY_PHASE_CONFIG,
} from "../lib/journey"
import { addBusinessDays, businessDaysBetween } from "../lib/business-days"
import { initialPatients, initialJourneyEvents, initialIntakeRecords } from "../lib/initial-data"
import { createInitialState } from "../lib/store"
import type { AdverseEvent, ExitPathway, JourneyPhase, Patient } from "../lib/types"

const ANCHOR = "2026-01-30" // seeds are authored against this date (lib/date-rebase.ts)
const PHASES: JourneyPhase[] = ["intake", "active", "telenavigation", "exited"]

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

function makePatient(overrides: Partial<Patient>): Patient {
  return {
    id: "pt-test",
    name: "Test Patient",
    dob: "1950-01-01",
    chartNumber: "GH-TEST",
    riskLevel: 1,
    survivalStatus: "active",
    journeyPhase: "active",
    assignedNavigator: "nav1",
    assignedSupervisor: "sup1",
    healthPlan: "Test Plan",
    enrollmentDate: "2025-01-01",
    lastContactDate: ANCHOR,
    medicationCompliance: 100,
    pcpCompliance: true,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    ...overrides,
  }
}

function makeAE(status: AdverseEvent["status"]): AdverseEvent {
  return {
    id: "ae-test",
    patientId: "pt-test",
    type: "fall",
    diagnosis: "Test diagnosis",
    startDate: ANCHOR,
    status,
    rightCareFlag: false,
    followUpStatus: "pending",
  }
}

console.log("Journey Lifecycle – Verification (J-B blocks 5-7 & 9)")
console.log("=====================================================")

// ============================================================================
// BLOCK 5: Phase transition matrix + seed consistency
// ============================================================================

run("Block 5: Phase transition matrix", () => {
  assert(canTransitionPhase("referral", "intake"), "referral -> intake is legal (conversion)")
  assert(canTransitionPhase("intake", "active"), "intake -> active is legal (Intake 2 complete)")
  assert(canTransitionPhase("active", "telenavigation"), "active -> telenavigation is legal (graduation)")
  assert(canTransitionPhase("telenavigation", "active"), "telenavigation -> active is legal (re-engage)")
  assert(
    PHASES.every((phase) => phase === "exited" || canTransitionPhase(phase, "exited")),
    "every non-terminal phase can exit"
  )
  assert(!canTransitionPhase("intake", "telenavigation"), "intake -> telenavigation is illegal (no skipping active)")
  assert(!canTransitionPhase("referral", "active"), "referral -> active is illegal (must pass intake)")
  assert(!canTransitionPhase("active", "intake"), "active -> intake is illegal (no regression)")
  assert(PHASE_TRANSITIONS.exited.length === 0, "exited is terminal")
  assert(!canTransitionPhase("exited", "active"), "exited -> active is illegal")
  assert(
    PHASES.every((phase) => !!JOURNEY_PHASE_CONFIG[phase]?.label),
    "every phase has chip config"
  )
})

run("Block 5: Seed journey consistency", () => {
  assert(
    initialPatients.every((p) => PHASES.includes(p.journeyPhase)),
    `every seed patient has a valid journeyPhase (${initialPatients.length} patients)`
  )

  for (const patient of initialPatients) {
    const events = initialJourneyEvents
      .filter((e) => e.patientId === patient.id)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    if (events.length === 0) throw new Error(`FAIL: ${patient.id} has no journey events`)

    for (let i = 1; i < events.length; i++) {
      if (new Date(events[i].at).getTime() < new Date(events[i - 1].at).getTime())
        throw new Error(`FAIL: ${patient.id} journey events not chronological`)
      if (events[i].fromPhase !== events[i - 1].toPhase)
        throw new Error(`FAIL: ${patient.id} journey event chain broken at ${events[i].id}`)
    }
    if (events[0].fromPhase !== "referral")
      throw new Error(`FAIL: ${patient.id} journey does not start at referral conversion`)
    if (!events.every((e) => canTransitionPhase(e.fromPhase, e.toPhase)))
      throw new Error(`FAIL: ${patient.id} has an illegal seeded transition`)
    if (events[events.length - 1].toPhase !== patient.journeyPhase)
      throw new Error(`FAIL: ${patient.id} last event toPhase != stored journeyPhase`)
  }
  assert(true, "every patient's event history is chronological, chained, legal, and lands on the stored phase")

  const exited = initialPatients.filter((p) => p.journeyPhase === "exited")
  assert(exited.length >= 1, `at least one seeded exited patient (got ${exited.length})`)
  const validPathways = Object.keys(EXIT_PATHWAY_CONFIG) as ExitPathway[]
  assert(
    exited.every((p) => p.exit && validPathways.includes(p.exit.pathway)),
    "exited patients carry an exit block with a valid pathway"
  )
  assert(
    exited.every((p) => p.survivalStatus === "inactive"),
    "exited patients are survivalStatus inactive (active-roster filters stay correct)"
  )
  assert(
    exited.every((p) => p.exit!.pathway !== "patient_initiated" || !!p.exit!.supervisorConfirmedBy),
    "patient_initiated exits carry supervisorConfirmedBy"
  )
  assert(
    initialPatients.every((p) => p.journeyPhase === "exited" || !p.exit),
    "no non-exited patient carries an exit block"
  )
})

run("Block 5: Adverse-event overlay is derived, never stored", () => {
  const clean = makePatient({})
  assert(getAdverseEventOverlay(clean) === null, "no adverse events -> no overlay")
  assert(
    getAdverseEventOverlay(makePatient({ adverseEvents: [makeAE("currently_inpatient")] }))?.status === "currently_inpatient",
    "currently_inpatient triggers the overlay"
  )
  assert(
    getAdverseEventOverlay(makePatient({ adverseEvents: [makeAE("currently_ed")] })) !== null,
    "currently_ed triggers the overlay"
  )
  assert(
    getAdverseEventOverlay(makePatient({ adverseEvents: [makeAE("monitoring")] })) !== null,
    "monitoring triggers the overlay"
  )
  assert(
    getAdverseEventOverlay(makePatient({ adverseEvents: [makeAE("ended")] })) === null,
    "ended adverse events do NOT trigger the overlay"
  )
  assert(
    !PHASES.includes("adverse_event" as JourneyPhase),
    "adverse event response is not a stored phase"
  )
})

// ============================================================================
// BLOCK 6: Intake protocol (checklists, no-shows, PCP business days)
// ============================================================================

run("Block 6: Intake checklist completion rules", () => {
  assert(INTAKE1_CHECKLIST.length === 8, "Intake 1 template has 8 items")
  assert(INTAKE2_CHECKLIST.length === 3, "Intake 2 template has 3 items")

  const fresh = buildChecklist(INTAKE1_CHECKLIST)
  assert(fresh.every((i) => !i.done && !i.doneAt && !i.doneBy), "buildChecklist starts all-undone")

  const visit = { status: "scheduled" as const, noShowCount: 0, checklist: fresh }
  assert(!isIntakeVisitComplete(visit), "visit with undone items is not complete")
  const oneShort = { ...visit, checklist: fresh.map((i, idx) => ({ ...i, done: idx > 0 })) }
  assert(!isIntakeVisitComplete(oneShort), "visit with ONE undone item is not complete")
  const allDone = { ...visit, checklist: fresh.map((i) => ({ ...i, done: true })) }
  assert(isIntakeVisitComplete(allDone), "visit with every item done is complete")
  assert(!isIntakeVisitComplete({ ...visit, checklist: [] }), "empty checklist never counts as complete")
  const progress = intakeChecklistProgress(oneShort)
  assert(progress.done === 7 && progress.total === 8, "checklist progress computes 7/8")
})

run("Block 6: 3-no-show closure protocol seeds", () => {
  assert(NO_SHOW_CLOSURE_THRESHOLD === 3, "closure threshold is 3 no-shows")
  const tension = initialIntakeRecords.find((ir) => ir.patientId === "pt-journey-intake2")
  assert(!!tension, "pt-journey-intake2 has an intake record")
  assert(
    tension!.totalNoShows === NO_SHOW_CLOSURE_THRESHOLD - 1,
    "seeded live-tension patient sits at 2/3 no-shows (one more closes)"
  )
  assert(tension!.intake1?.status === "completed", "tension patient's Intake 1 is completed")
  assert(
    tension!.intake1!.checklist.every((i) => i.done) && isIntakeVisitComplete(tension!.intake1!),
    "completed Intake 1 passes its own completion rule"
  )
  assert(tension!.intake2?.status === "scheduled", "tension patient's Intake 2 is scheduled")

  const fresh = initialIntakeRecords.find((ir) => ir.patientId === "pt-journey-intake1")
  assert(!!fresh?.intake1 && fresh.intake1.checklist.every((i) => !i.done), "fresh intake patient's checklist is untouched")
  const template1Keys = INTAKE1_CHECKLIST.map((i) => i.key).join(",")
  assert(
    fresh!.intake1!.checklist.map((i) => i.key).join(",") === template1Keys,
    "seeded Intake 1 checklist matches the template keys in order"
  )
  const template2Keys = INTAKE2_CHECKLIST.map((i) => i.key).join(",")
  assert(
    fresh!.intake2!.checklist.map((i) => i.key).join(",") === template2Keys,
    "seeded Intake 2 checklist matches the template keys in order"
  )
})

run("Block 6: Business-day math (PCP within 7 business days)", () => {
  assert(addBusinessDays("2026-01-30", 7) === "2026-02-10", "Friday 2026-01-30 + 7 business days = 2026-02-10")
  assert(addBusinessDays("2026-01-28", 7) === "2026-02-06", "Wednesday + 7 business days skips both weekends")
  assert(addBusinessDays("2026-01-31", 1) === "2026-02-02", "Saturday start rolls to Monday")
  assert(businessDaysBetween("2026-01-30", "2026-02-10") === 7, "businessDaysBetween inverts addBusinessDays")
  assert(businessDaysBetween("2026-02-10", "2026-01-30") === -7, "businessDaysBetween is negative backwards")
  assert(businessDaysBetween("2026-01-30", "2026-01-30") === 0, "same day = 0 business days")

  const r1 = initialIntakeRecords.find((ir) => ir.patientId === "pt-journey-intake1")!
  assert(r1.pcpDueBy === addBusinessDays(r1.date, 7), "pt-journey-intake1 pcpDueBy = conversion + 7 business days")
  const r2 = initialIntakeRecords.find((ir) => ir.patientId === "pt-journey-intake2")!
  assert(r2.pcpDueBy === addBusinessDays(r2.date, 7), "pt-journey-intake2 pcpDueBy = conversion + 7 business days")

  assert(pcpDueStatus(r1.pcpDueBy!, ANCHOR).status !== "overdue", "fresh intake patient's PCP deadline still open at anchor")
  assert(pcpDueStatus(r2.pcpDueBy!, ANCHOR).status === "overdue", "tension patient's PCP deadline is past at anchor")
  assert(pcpDueStatus("2026-02-10", "2026-02-06").businessDaysRemaining === 2, "countdown counts business days only")
})

// ============================================================================
// BLOCK 7: Telenavigation cadence
// ============================================================================

run("Block 7: Telenav check-in cadence math", () => {
  const telenav = (lastCheckInAt?: string) =>
    makePatient({
      journeyPhase: "telenavigation",
      telenavigation: { startedAt: "2025-12-24", cadenceDays: 30, lastCheckInAt },
    })

  const s = telenavCheckInStatus(telenav("2025-12-26"), ANCHOR)
  assert(s !== null, "telenavigation patient gets a cadence status")
  assert(s!.nextDue === "2026-01-25", "nextDue = lastCheckInAt + 30 days")
  assert(s!.status === "overdue" && s!.daysUntilDue === -5, "5 days past due -> overdue")

  const fromStart = telenavCheckInStatus(telenav(undefined), ANCHOR)
  assert(fromStart!.nextDue === "2026-01-23", "no check-in yet -> cadence runs from startedAt")

  assert(telenavCheckInStatus(telenav("2026-01-28"), ANCHOR)!.status === "ok", "next due >7 days out -> ok")
  assert(telenavCheckInStatus(telenav("2026-01-05"), ANCHOR)!.status === "due_soon", "due within 7 days -> due_soon")
  assert(telenavCheckInStatus(telenav("2025-12-31"), ANCHOR)!.status === "due_soon", "due today -> due_soon (not overdue)")
  assert(telenavCheckInStatus(telenav("2025-12-30"), ANCHOR)!.status === "overdue", "one day past -> overdue")

  assert(telenavCheckInStatus(makePatient({ journeyPhase: "active" }), ANCHOR) === null, "active patient has no cadence status")
  assert(
    telenavCheckInStatus(makePatient({ journeyPhase: "telenavigation" }), ANCHOR) === null,
    "telenavigation phase without a telenavigation block is null-safe"
  )
})

run("Block 7: Seeded telenav patient is overdue on load", () => {
  const helen = initialPatients.find((p) => p.id === "pt4")
  assert(!!helen && helen.journeyPhase === "telenavigation", "pt4 (Helen Garcia) is the seeded telenavigation patient")
  const status = telenavCheckInStatus(helen!, ANCHOR)
  assert(status !== null && status.status === "overdue", `pt4 derives OVERDUE at anchor date (${status?.daysUntilDue} days)`)
  assert(
    helen!.telenavigation!.cadenceDays === 30,
    "pt4 runs the monthly (30-day) cadence"
  )
  const graduationEvent = initialJourneyEvents.find(
    (e) => e.patientId === "pt4" && e.toPhase === "telenavigation"
  )
  assert(!!graduationEvent && graduationEvent.fromPhase === "active", "pt4's graduation event is active -> telenavigation")
})

// ============================================================================
// BLOCK 9: Persistence regression
// ============================================================================

run("Block 9: Store persistence carries journey slices", () => {
  const state = createInitialState()
  assert(Array.isArray(state.journeyEvents), "createInitialState exposes journeyEvents")
  assert(
    state.journeyEvents.length === initialJourneyEvents.length,
    `journeyEvents fully seeded (${state.journeyEvents.length} events)`
  )
  assert(state._version === 13, `store version lock: _version === 13 (got ${state._version})`)
  assert(
    state.patients.every((p) => PHASES.includes(p.journeyPhase)),
    "rebased store patients keep valid journey phases"
  )
  assert(
    state.journeyEvents.every((e) => canTransitionPhase(e.fromPhase, e.toPhase)),
    "rebased journeyEvents all remain legal transitions"
  )
})

console.log("\n=====================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
