/**
 * Verification script for schedule-validation.ts helpers
 * Run: npm run verify:schedule
 */

import {
  getEventDateISO,
  getAvailableSlots,
  getPatientSchedule,
  getNavigatorDailySchedule,
  calculateScheduledHours,
} from "../lib/schedule-validation"
import type { ScheduleEvent } from "../lib/types"

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

function makeEvent(overrides: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: "evt-1",
    navigatorId: "nav-1",
    navigatorName: "Test Navigator",
    patientId: "pt-1",
    patientName: "Test Patient",
    title: "Visit",
    type: "NAVIGATOR_VISIT",
    startTime: "2026-03-15T14:00:00Z",
    endTime: "2026-03-15T15:00:00Z",
    status: "SCHEDULED",
    location: { name: "Test Clinic", address: "123 Main St", zipCode: "85001" },
    isHighSafetyRisk: false,
    ...overrides,
  }
}

console.log("Schedule Validation Helpers – Verification")
console.log("============================================")

run("getEventDateISO: extracts YYYY-MM-DD from an ISO startTime", () => {
  assert(getEventDateISO("2026-03-15T14:00:00Z") === "2026-03-15", "Mid-day UTC timestamp maps to its own date")
  assert(getEventDateISO("2026-01-01T00:00:00Z") === "2026-01-01", "Midnight UTC timestamp maps to its own date")
  assert(getEventDateISO("2026-12-31T23:59:59Z") === "2026-12-31", "End-of-year timestamp maps to its own date")
})

run("getAvailableSlots: filters events to the exact requested date via getEventDateISO", () => {
  const events = [
    makeEvent({ id: "same-day", startTime: "2026-03-15T10:00:00Z", endTime: "2026-03-15T11:00:00Z" }),
    makeEvent({ id: "other-day", startTime: "2026-03-16T10:00:00Z", endTime: "2026-03-16T11:00:00Z" }),
  ]
  const slots = getAvailableSlots("nav-1", "2026-03-15", events)
  const overlapsSameDayEvent = slots.some(
    (s) => s.start < new Date("2026-03-15T11:00:00Z") && s.end > new Date("2026-03-15T10:00:00Z")
  )
  assert(!overlapsSameDayEvent, "No slot overlaps the same-day event")
  assert(slots.length > 0, "Slots are generated for the requested date")
})

run("getPatientSchedule: startDate/endDate bounds use getEventDateISO", () => {
  const events = [
    makeEvent({ id: "in-range", startTime: "2026-03-15T14:00:00Z", endTime: "2026-03-15T15:00:00Z" }),
    makeEvent({ id: "before-range", startTime: "2026-03-01T14:00:00Z", endTime: "2026-03-01T15:00:00Z" }),
    makeEvent({ id: "after-range", startTime: "2026-04-01T14:00:00Z", endTime: "2026-04-01T15:00:00Z" }),
  ]
  const result = getPatientSchedule("pt-1", events, { startDate: "2026-03-10", endDate: "2026-03-20" })
  assert(result.length === 1 && result[0].id === "in-range", "Only the in-range event is returned")
})

run("getNavigatorDailySchedule: matches events on the exact date", () => {
  const events = [
    makeEvent({ id: "match", startTime: "2026-03-15T09:00:00Z", endTime: "2026-03-15T10:00:00Z" }),
    makeEvent({ id: "no-match", startTime: "2026-03-14T09:00:00Z", endTime: "2026-03-14T10:00:00Z" }),
  ]
  const result = getNavigatorDailySchedule("nav-1", "2026-03-15", events)
  assert(result.length === 1 && result[0].id === "match", "Only events on the requested day are returned")
})

run("calculateScheduledHours: sums minutes for events within the date range", () => {
  const events = [
    makeEvent({ id: "in-range", startTime: "2026-03-15T09:00:00Z", endTime: "2026-03-15T10:30:00Z" }),
    makeEvent({ id: "outside-range", startTime: "2026-05-01T09:00:00Z", endTime: "2026-05-01T11:00:00Z" }),
  ]
  const result = calculateScheduledHours("nav-1", events, "2026-03-01", "2026-03-31")
  assert(result.eventCount === 1, "Only the in-range event is counted")
  assert(result.totalMinutes === 90, "Total minutes reflects only the in-range event (90 min)")
})

console.log("\n============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
