/**
 * Verification: Store version migration (v12 -> v13) round-trips a legacy
 * fixture through migrateState() and asserts no data loss.
 * Run: npm run verify:migration
 *
 * Guards against a regression to the old behavior, where any _version bump
 * discarded every persisted slice (patients, notes, appointments, ...) and
 * reset the whole store to fresh seed data.
 */

import { migrateState, createInitialState } from "../lib/store"
import type { Patient } from "../lib/types"

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

// A representative v12 fixture: shaped like localStorage state persisted
// before the Gellert blitz (v13) introduced journeyPhase and the new
// journeyEvents/providers/standingFacts/chargeSlips/zones slices. Patients
// here deliberately lack `journeyPhase` since the field didn't exist in v12.
function makeV12Fixture() {
  const activePatient = {
    id: "pt-legacy-active",
    name: "Legacy Active Patient",
    dob: "1955-03-14",
    chartNumber: "GH-2024-1001",
    riskLevel: 2,
    survivalStatus: "active",
    assignedNavigator: "nav1",
    assignedSupervisor: "sup1",
    healthPlan: "Acme Health",
    enrollmentDate: "2024-06-01",
    lastContactDate: "2026-06-20",
    medicationCompliance: 82,
    pcpCompliance: true,
    upcomingAppointments: [],
    medications: [{ id: "med1", name: "Metformin", dosage: "500mg", frequency: "daily" }],
    adverseEvents: [],
    // User-entered fields that must survive migration verbatim.
    address: { street: "123 Elm St", city: "Springfield", state: "IL", zip: "62704" },
    phone: "555-0100",
    email: "legacy.patient@example.com",
    // No journeyPhase - this is the v12 shape.
  }

  const exitedPatient = {
    id: "pt-legacy-inactive",
    name: "Legacy Inactive Patient",
    dob: "1948-11-02",
    chartNumber: "GH-2023-0042",
    riskLevel: 1,
    survivalStatus: "inactive",
    assignedNavigator: "nav2",
    assignedSupervisor: "sup1",
    healthPlan: "Beta Health",
    enrollmentDate: "2023-01-15",
    lastContactDate: "2025-02-01",
    medicationCompliance: 100,
    pcpCompliance: false,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    // No journeyPhase here either.
  }

  return {
    _version: 12,
    patients: [activePatient, exitedPatient],
    navigators: [{ id: "nav1", name: "Navigator One" }],
    appointments: [{ id: "apt1", patientId: "pt-legacy-active", navigatorId: "nav1", date: "2026-07-10", time: "09:00", type: "home_visit", status: "scheduled" }],
    notes: [{ id: "note1", patientId: "pt-legacy-active", authorId: "nav1", content: "User-written clinical note", createdAt: "2026-06-15T10:00:00Z" }],
    // Deliberately no journeyEvents/providers/standingFacts/chargeSlips/zones -
    // these slices didn't exist in v12.
  }
}

run("migrateState backfills journeyPhase without touching other patient fields", () => {
  const fixture = makeV12Fixture()
  const migrated = migrateState(fixture, 12)
  const patients = migrated.patients as (Patient & Record<string, any>)[]

  assert(patients.length === 2, "patient count preserved (2 patients survive migration)")

  const active = patients.find((p) => p.id === "pt-legacy-active")!
  assert(active.journeyPhase === "active", "active, non-exited legacy patient defaults to journeyPhase 'active'")
  assert(active.name === "Legacy Active Patient", "patient name preserved")
  assert(active.medicationCompliance === 82, "medicationCompliance preserved")
  assert(active.medications.length === 1 && active.medications[0].name === "Metformin", "medications array preserved")
  assert(active.email === "legacy.patient@example.com", "user-entered email preserved")
  assert(active.address?.city === "Springfield", "user-entered address preserved")

  const exited = patients.find((p) => p.id === "pt-legacy-inactive")!
  assert(exited.journeyPhase === "exited", "inactive legacy patient derives journeyPhase 'exited'")
  assert(exited.name === "Legacy Inactive Patient", "inactive patient name preserved")
})

run("migrateState preserves unrelated slices untouched", () => {
  const fixture = makeV12Fixture()
  const migrated = migrateState(fixture, 12)

  assert(migrated.navigators.length === 1 && migrated.navigators[0].id === "nav1", "navigators slice untouched")
  assert(migrated.appointments.length === 1 && migrated.appointments[0].id === "apt1", "appointments slice untouched")
  assert(migrated.notes.length === 1 && migrated.notes[0].content === "User-written clinical note", "notes slice untouched (no data loss)")
})

run("migrateState stamps the new version and is idempotent", () => {
  const fixture = makeV12Fixture()
  const migrated = migrateState(fixture, 12)
  assert(migrated._version === 13, `migrated state stamped with CURRENT_VERSION (got ${migrated._version})`)

  // Running the migration again from the (now current) version should be a no-op.
  const reMigrated = migrateState(migrated, migrated._version)
  assert(
    JSON.stringify(reMigrated.patients) === JSON.stringify(migrated.patients),
    "re-running migration from CURRENT_VERSION is a no-op (idempotent)"
  )
})

run("migrateState already-migrated patients (has journeyPhase) are left alone", () => {
  const fixture = makeV12Fixture()
  ;(fixture.patients[0] as any).journeyPhase = "telenavigation"
  const migrated = migrateState(fixture, 12)
  const active = migrated.patients.find((p: any) => p.id === "pt-legacy-active")!
  assert(active.journeyPhase === "telenavigation", "existing journeyPhase value is not overwritten")
})

run("A version bump does not require createInitialState to explode", () => {
  // Sanity check the fixture's assumed CURRENT_VERSION matches the real one,
  // so this test fails loudly (not silently) the next time the version bumps.
  const state = createInitialState()
  assert(state._version === 13, `CURRENT_VERSION is 13; update this fixture/test if it changes (got ${state._version})`)
})

console.log("\n=====================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
