/**
 * Verify: Schedule Conflict Validation
 *
 * Run with: npm run verify:schedule-conflicts
 *
 * Characterization coverage for validateScheduleEvent (lib/schedule-validation.ts),
 * recorded against its behavior before the four "Check N" blocks (direct
 * overlap + travel buffer, double booking, high-safety-risk duration/load)
 * were extracted into checkSameDayConflicts/checkDoubleBooking/
 * checkHighSafetyRisk helpers. Locks in: which conflict type/severity fires
 * for each scenario, that direct overlap skips the travel check for that
 * event, and that the allowDoubleBooking/checkHighRiskConflicts options and
 * CANCELLED/different-day/different-navigator filters behave unchanged.
 */

import { validateScheduleEvent } from "../lib/schedule-validation"
import type { ScheduleEvent } from "../lib/types"

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function run(title: string, fn: () => void) {
  console.log(`\n--- ${title} ---`)
  try {
    fn()
  } catch (err) {
    failed++
    console.error(`  ✗ threw: ${err instanceof Error ? err.message : err}`)
  }
}

const loc = (zipCode: string, name = "Loc") => ({ name, address: "123 St", zipCode })

function ev(overrides: Partial<ScheduleEvent> & Pick<ScheduleEvent, "startTime" | "endTime">): ScheduleEvent {
  return {
    id: "ev-base",
    patientId: "pt-1",
    patientName: "Pat",
    navigatorId: "nav-1",
    navigatorName: "Nav",
    type: "NAVIGATOR_VISIT",
    title: "Visit",
    location: loc("85001"),
    isHighSafetyRisk: false,
    status: "SCHEDULED",
    ...overrides,
  }
}

// =============================================================================
run("No existing events: no conflicts", () => {
  const result = validateScheduleEvent(ev({ startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00" }), [])
  assert(result.isValid && result.conflicts.length === 0, "clean schedule is valid with zero conflicts")
})

// =============================================================================
run("Direct overlap: ERROR, and skips the travel check for that event", () => {
  const result = validateScheduleEvent(
    ev({ startTime: "2026-07-08T10:30:00", endTime: "2026-07-08T11:30:00", patientId: "pt-2" }),
    [ev({ id: "existing-1", startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", title: "Existing Visit" })]
  )
  assert(!result.isValid, "direct overlap invalidates the schedule")
  assert(
    result.conflicts.length === 1 && result.conflicts[0].type === "OVERLAP" && result.conflicts[0].severity === "ERROR",
    `exactly one OVERLAP/ERROR conflict, no travel warning also fires (got ${JSON.stringify(result.conflicts)})`
  )
  assert(
    result.conflicts[0].message === 'Time conflict with "Existing Visit" (10:00 AM - 11:00 AM)',
    "overlap message names the conflicting event and its time window"
  )
})

// =============================================================================
run("Insufficient travel buffer, both directions", () => {
  const after = validateScheduleEvent(
    ev({ startTime: "2026-07-08T11:05:00", endTime: "2026-07-08T11:35:00", location: loc("85351"), patientId: "pt-2" }),
    [ev({ id: "existing-1", startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", location: loc("85001") })]
  )
  assert(after.isValid, "insufficient travel is a WARNING, not an ERROR")
  assert(
    after.conflicts.length === 1 && after.conflicts[0].type === "INSUFFICIENT_TRAVEL",
    `warns when the new event follows too soon after an existing one (got ${JSON.stringify(after.conflicts)})`
  )

  const before = validateScheduleEvent(
    ev({ startTime: "2026-07-08T09:00:00", endTime: "2026-07-08T09:30:00", location: loc("85351"), patientId: "pt-2" }),
    [ev({ id: "existing-1", startTime: "2026-07-08T09:35:00", endTime: "2026-07-08T10:35:00", location: loc("85001") })]
  )
  assert(
    before.conflicts.length === 1 && before.conflicts[0].type === "INSUFFICIENT_TRAVEL",
    `warns when the new event precedes too soon before an existing one (got ${JSON.stringify(before.conflicts)})`
  )
})

run("Sufficient travel buffer: no warning", () => {
  const result = validateScheduleEvent(
    ev({ startTime: "2026-07-08T14:00:00", endTime: "2026-07-08T14:30:00", location: loc("85351"), patientId: "pt-2" }),
    [ev({ id: "existing-1", startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", location: loc("85001") })]
  )
  assert(result.conflicts.length === 0, "ample gap between events produces no conflicts")
})

// =============================================================================
run("Double booking: same patient, different navigators, overlapping times", () => {
  const result = validateScheduleEvent(
    ev({ startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", navigatorId: "nav-2", patientId: "pt-1" }),
    [
      ev({
        id: "existing-1",
        navigatorId: "nav-1",
        patientId: "pt-1",
        startTime: "2026-07-08T10:15:00",
        endTime: "2026-07-08T11:15:00",
        title: "Other Nav Visit",
      }),
    ]
  )
  assert(!result.isValid, "double booking invalidates the schedule")
  assert(
    result.conflicts.length === 1 && result.conflicts[0].type === "DOUBLE_BOOKING",
    `flags DOUBLE_BOOKING (got ${JSON.stringify(result.conflicts)})`
  )
})

run("allowDoubleBooking: true suppresses the double-booking check", () => {
  const result = validateScheduleEvent(
    ev({ startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", navigatorId: "nav-2", patientId: "pt-1" }),
    [ev({ id: "existing-1", navigatorId: "nav-1", patientId: "pt-1", startTime: "2026-07-08T10:15:00", endTime: "2026-07-08T11:15:00" })],
    { allowDoubleBooking: true }
  )
  assert(result.isValid && result.conflicts.length === 0, "no DOUBLE_BOOKING conflict when the option is set")
})

// =============================================================================
run("High-safety-risk: short duration warns", () => {
  const result = validateScheduleEvent(
    ev({ startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T10:20:00", isHighSafetyRisk: true, patientId: "pt-9" }),
    []
  )
  assert(
    result.conflicts.length === 1 && result.conflicts[0].type === "SAFETY_RISK",
    `warns when a high-risk appointment is under 45 min (got ${JSON.stringify(result.conflicts)})`
  )
})

run("High-safety-risk: 3+ high-risk events same day warns", () => {
  const result = validateScheduleEvent(
    ev({ startTime: "2026-07-08T15:00:00", endTime: "2026-07-08T16:00:00", isHighSafetyRisk: true, patientId: "pt-9" }),
    [
      ev({ id: "e1", startTime: "2026-07-08T08:00:00", endTime: "2026-07-08T09:00:00", isHighSafetyRisk: true, patientId: "pt-a" }),
      ev({ id: "e2", startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", isHighSafetyRisk: true, patientId: "pt-b" }),
      ev({ id: "e3", startTime: "2026-07-08T12:00:00", endTime: "2026-07-08T13:00:00", isHighSafetyRisk: true, patientId: "pt-c" }),
    ]
  )
  assert(
    result.conflicts.length === 1 &&
      result.conflicts[0].type === "SAFETY_RISK" &&
      result.conflicts[0].message === "Navigator already has 3 high-risk appointments this day",
    `warns about navigator high-risk daily load (got ${JSON.stringify(result.conflicts)})`
  )
})

run("checkHighRiskConflicts: false suppresses safety-risk checks entirely", () => {
  const result = validateScheduleEvent(
    ev({ startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T10:20:00", isHighSafetyRisk: true, patientId: "pt-9" }),
    [],
    { checkHighRiskConflicts: false }
  )
  assert(result.conflicts.length === 0, "no SAFETY_RISK conflicts when the option is disabled")
})

// =============================================================================
run("Filters: CANCELLED, different day, and different navigator are ignored", () => {
  const cancelled = validateScheduleEvent(
    ev({ startTime: "2026-07-08T10:30:00", endTime: "2026-07-08T11:30:00", patientId: "pt-2" }),
    [ev({ id: "existing-1", startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", status: "CANCELLED" })]
  )
  assert(cancelled.conflicts.length === 0, "a CANCELLED event never produces a conflict")

  const differentDay = validateScheduleEvent(
    ev({ startTime: "2026-07-09T10:30:00", endTime: "2026-07-09T11:30:00", patientId: "pt-2" }),
    [ev({ id: "existing-1", startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00" })]
  )
  assert(differentDay.conflicts.length === 0, "an event on a different day is never compared")

  const differentNavigator = validateScheduleEvent(
    ev({
      startTime: "2026-07-08T11:05:00",
      endTime: "2026-07-08T11:35:00",
      location: loc("85351"),
      navigatorId: "nav-other",
      patientId: "pt-2",
    }),
    [ev({ id: "existing-1", navigatorId: "nav-1", startTime: "2026-07-08T10:00:00", endTime: "2026-07-08T11:00:00", location: loc("85001") })]
  )
  assert(differentNavigator.conflicts.length === 0, "a different navigator's event never triggers a travel-buffer check")
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
