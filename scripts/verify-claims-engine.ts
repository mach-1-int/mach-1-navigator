/**
 * Characterization test: generateMonthlyClaims
 *
 * Run with: npm run verify:claims-engine
 *
 * Pins down the current per-patient-per-month claim-generation behavior of
 * generateMonthlyClaims (lib/claims-engine.ts) — billing code selection
 * (H-code vs G-code), unit calculation, diagnosis code merging, validation
 * errors, status derivation, and sort order — so the internal refactor that
 * split it into per-concern helpers (selectBillingCodes, collectDiagnosisCodes,
 * appendUnverifiedTimeError, determineClaimStatus, buildClaimForGroup) can be
 * verified to leave every output field unchanged.
 */

import { generateMonthlyClaims } from "../lib/claims-engine"
import { PAYER_CONFIGS } from "../lib/payer-config"
import { localCurrentMonth } from "../lib/date-rebase"
import type { IntakeRecord, Patient, TimeLog } from "../lib/types"
import { createVerifyHarness } from "./verify-harness"

const { assert, run, printSummary } = createVerifyHarness()

const MEDICAID = PAYER_CONFIGS["medicaid-bh"]
const MEDICARE_PIN = PAYER_CONFIGS["medicare-pin"]
const MEDICARE_CHI = PAYER_CONFIGS["medicare-chi"]

const currentMonth = localCurrentMonth()
const priorMonth = "2020-01" // deliberately far in the past, never the current month

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "pt-1",
    name: "Maria Garcia",
    dob: "1957-06-14",
    chartNumber: "GH-2026-0001",
    riskLevel: 2,
    survivalStatus: "active",
    assignedNavigator: "nav-1",
    assignedSupervisor: "sup-1",
    healthPlan: "Mercy Care",
    enrollmentDate: "2026-01-01",
    lastContactDate: "2026-01-01",
    medicationCompliance: 0,
    pcpCompliance: false,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    icdCodes: ["E11.9"],
    memberId: "MC601124873",
    payerId: "mercy-care",
    ...overrides,
  }
}

function makeIntake(overrides: Partial<IntakeRecord> = {}): IntakeRecord {
  return {
    id: "intake-1",
    patientId: "pt-1",
    date: "2025-06-01",
    initiatingVisitDate: "2025-06-01",
    consentObtained: true,
    serviceType: "PIN",
    acuity: { clinical: 1, psychosocial: 1, barriers: 1, literacy: 1, totalScore: 4, level: "Moderate" },
    identifiedBarriers: [],
    primaryNavigatorId: "nav-1",
    ...overrides,
  }
}

function makeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: "log-1",
    patientId: "pt-1",
    date: `${priorMonth}-15`,
    startTime: `${priorMonth}-15T09:00:00Z`,
    endTime: `${priorMonth}-15T10:00:00Z`,
    durationMinutes: 60,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-1",
    verified: true,
    billingPeriod: priorMonth,
    ...overrides,
  }
}

console.log("Characterization: Claims Engine (generateMonthlyClaims)")
console.log("========================================================")

run("Medicaid Rule-of-Eights: dominant H-code, no add-on code, VALIDATED", () => {
  const patient = makePatient()
  const intake = makeIntake()
  const logs = [
    makeLog({ id: "l1", durationMinutes: 20, activityType: "HOME_VISIT" }),
    makeLog({ id: "l2", durationMinutes: 10, activityType: "PEER_SUPPORT" }),
  ]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICAID, [intake])

  assert(claim.primaryCode === "H2015", `dominant activity (HOME_VISIT, 20 min) wins H-code (got "${claim.primaryCode}")`)
  assert(claim.addOnCode === undefined, "no add-on code for Rule-of-Eights billing")
  assert(claim.totalMinutes === 30, `totalMinutes sums all logs (got ${claim.totalMinutes})`)
  assert(claim.primaryUnits === 2, `30 min = 2 units of 15-min Rule-of-Eights (floor((30+7)/15)) (got ${claim.primaryUnits})`)
  assert(claim.addOnUnits === 0, "addOnUnits is 0 for Medicaid")
  assert(claim.status === "VALIDATED", `status VALIDATED for a past month with no errors (got "${claim.status}")`)
  assert(claim.validationErrors === undefined, "no validation errors")
  assert(claim.month === priorMonth, `month taken from billingPeriod (got "${claim.month}")`)
})

run("Medicare PIN G-code: base + add-on units, memberId/diagnosis pass validation", () => {
  const patient = makePatient()
  const intake = makeIntake()
  const logs = [makeLog({ id: "l1", durationMinutes: 90, serviceType: "PIN" })]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])

  assert(claim.primaryCode === "G0023", `Medicare PIN base code (got "${claim.primaryCode}")`)
  assert(claim.addOnCode === "G0024", `add-on code present when addOnUnits > 0 (got "${claim.addOnCode}")`)
  assert(claim.primaryUnits === 1, "1 base unit for >= 60 min")
  assert(claim.addOnUnits === 1, `1 add-on unit for 30 extra minutes (got ${claim.addOnUnits})`)
  assert(claim.status === "VALIDATED", `status VALIDATED (got "${claim.status}")`)
})

run("Add-on code omitted when addOnUnits is 0 even though the payer config has one", () => {
  const patient = makePatient()
  const intake = makeIntake()
  const logs = [makeLog({ id: "l1", durationMinutes: 60, serviceType: "PIN" })]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])

  assert(claim.addOnUnits === 0, "0 add-on units for exactly 60 minutes")
  assert(claim.addOnCode === undefined, `addOnCode omitted when addOnUnits is 0 (got "${claim.addOnCode}")`)
})

run("Insufficient time + missing consent + missing member ID -> NEEDS_ATTENTION with all errors", () => {
  const patient = makePatient({ memberId: undefined })
  const intake = makeIntake({ consentObtained: false })
  const logs = [makeLog({ id: "l1", durationMinutes: 10, serviceType: "PIN" })]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])

  assert(claim.status === "NEEDS_ATTENTION", `status NEEDS_ATTENTION (got "${claim.status}")`)
  assert(!!claim.validationErrors, "validationErrors populated")
  assert(
    claim.validationErrors!.some((e) => e.includes("Insufficient Time")),
    `insufficient time error present (got ${JSON.stringify(claim.validationErrors)})`
  )
  assert(claim.validationErrors!.includes("Missing Member ID"), "missing member ID error present")
  assert(claim.validationErrors!.includes("Patient consent not documented"), "missing consent error present")
  assert(claim.memberId === `UNK-${patient.id.toUpperCase()}`, `memberId falls back to UNK- placeholder (got "${claim.memberId}")`)
})

run("Unverified minutes force NEEDS_ATTENTION even when otherwise valid", () => {
  const patient = makePatient()
  const intake = makeIntake()
  const logs = [
    makeLog({ id: "l1", durationMinutes: 60, verified: true }),
    makeLog({ id: "l2", durationMinutes: 30, verified: false }),
  ]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])

  assert(claim.status === "NEEDS_ATTENTION", `status NEEDS_ATTENTION despite otherwise-valid claim (got "${claim.status}")`)
  assert(
    claim.validationErrors!.includes("Unverified time (30 min) — supervisor review required"),
    `unverified-time error present (got ${JSON.stringify(claim.validationErrors)})`
  )
})

run("CHI claim without an SDOH Z-code is flagged; adding one clears it", () => {
  const patientNoZ = makePatient({ icdCodes: ["I10"] })
  const intakeNoZ = makeIntake({ serviceType: "CHI", identifiedBarriers: [] })
  const logsNoZ = [makeLog({ id: "l1", durationMinutes: 60, serviceType: "CHI" })]
  const [claimNoZ] = generateMonthlyClaims([], [patientNoZ], logsNoZ, MEDICARE_CHI, [intakeNoZ])
  assert(
    claimNoZ.validationErrors!.includes("CHI claim requires at least one SDOH Z-code"),
    `CHI without Z-code is flagged (got ${JSON.stringify(claimNoZ.validationErrors)})`
  )

  const intakeWithZ = makeIntake({
    serviceType: "CHI",
    identifiedBarriers: [{ code: "Z59.0", description: "Homelessness", category: "Housing" }],
  })
  const logsWithZ = [makeLog({ id: "l2", durationMinutes: 60, serviceType: "CHI" })]
  const [claimWithZ] = generateMonthlyClaims([], [patientNoZ], logsWithZ, MEDICARE_CHI, [intakeWithZ])
  assert(
    !(claimWithZ.validationErrors ?? []).includes("CHI claim requires at least one SDOH Z-code"),
    "CHI Z-code error clears once a barrier is identified"
  )
  assert(claimWithZ.diagnosisCodes.includes("Z59.0"), "intake barrier Z-code merged into diagnosisCodes")
})

run("Diagnosis codes merge icdCodes + primaryDiagnosis-embedded ICD + intake Z-codes, deduplicated", () => {
  const patient = makePatient({
    icdCodes: ["C50.9", "C50.9"], // duplicate on purpose
    primaryDiagnosis: "Breast Cancer (C50.9)", // same code embedded in free text
  })
  const intake = makeIntake({
    identifiedBarriers: [{ code: "Z59.0", description: "Homelessness", category: "Housing" }],
  })
  const logs = [makeLog({ id: "l1", durationMinutes: 60 })]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])

  assert(
    JSON.stringify([...claim.diagnosisCodes].sort()) === JSON.stringify(["C50.9", "Z59.0"]),
    `diagnosisCodes deduplicated and merged (got ${JSON.stringify(claim.diagnosisCodes)})`
  )
})

run("Current-month claim with no errors is DRAFT, not VALIDATED", () => {
  const patient = makePatient()
  // initiatingVisitDate must be within 12 months of the claim month's cutoff,
  // so this scenario isolates the DRAFT/VALIDATED distinction from the
  // separate 12-month re-initiation validation error.
  const intake = makeIntake({ initiatingVisitDate: `${currentMonth}-01` })
  const logs = [makeLog({ id: "l1", durationMinutes: 60, date: `${currentMonth}-05`, billingPeriod: currentMonth })]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])

  assert(claim.month === currentMonth, `claim month is the current month (got "${claim.month}")`)
  assert(claim.status === "DRAFT", `status DRAFT for the current month (got "${claim.status}")`)
})

run("Multiple patient/month groups: sorted by month desc, then patient name asc", () => {
  const alice = makePatient({ id: "pt-a", name: "Alice Adams", memberId: "MEM-A" })
  const bob = makePatient({ id: "pt-b", name: "Bob Brown", memberId: "MEM-B" })
  const intakeA = makeIntake({ patientId: "pt-a" })
  const intakeB = makeIntake({ patientId: "pt-b" })
  const logs = [
    makeLog({ id: "l1", patientId: "pt-b", durationMinutes: 60, date: "2020-02-01", billingPeriod: "2020-02" }),
    makeLog({ id: "l2", patientId: "pt-a", durationMinutes: 60, date: "2020-02-01", billingPeriod: "2020-02" }),
    makeLog({ id: "l3", patientId: "pt-a", durationMinutes: 60, date: "2020-01-01", billingPeriod: "2020-01" }),
  ]
  const claims = generateMonthlyClaims([], [alice, bob], logs, MEDICARE_PIN, [intakeA, intakeB])

  assert(claims.length === 3, `3 patient/month groups produced (got ${claims.length})`)
  assert(
    claims.map((c) => `${c.month}:${c.patientName}`).join(",") === "2020-02:Alice Adams,2020-02:Bob Brown,2020-01:Alice Adams",
    `sort order is month desc then patient name asc (got ${JSON.stringify(claims.map((c) => `${c.month}:${c.patientName}`))})`
  )
})

run("Unknown patient (no matching Patient record) still produces a claim with placeholder fields", () => {
  const logs = [makeLog({ id: "l1", patientId: "pt-ghost", durationMinutes: 60 })]
  const [claim] = generateMonthlyClaims([], [], logs, MEDICARE_PIN, [])

  assert(claim.patientName === "Unknown Patient", `patientName placeholder (got "${claim.patientName}")`)
  assert(claim.memberId === "UNK-PT-GHOST", `memberId placeholder (got "${claim.memberId}")`)
  assert(claim.status === "NEEDS_ATTENTION", "unknown patient always NEEDS_ATTENTION")
  assert(claim.validationErrors!.includes("Patient record not found"), "patient-not-found error present")
})

printSummary(56)
