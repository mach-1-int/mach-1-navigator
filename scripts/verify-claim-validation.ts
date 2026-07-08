/**
 * Characterization test: validateClaimData (lib/claims-engine.ts)
 *
 * Run with: npm run verify:claim-validation
 *
 * validateClaimData was the highest-complexity non-test, non-React-component
 * function in the codebase (cyclomatic complexity 16, per an ESLint
 * `complexity` scan) after the earlier parseHL7v2/loadState/parse835/
 * generateMonthlyClaims/validateScheduleEvent/buildFieldSegment rounds. It
 * was split into one check function per validation rule (checkMinimumTime,
 * checkMemberId, checkDiagnosisCodes, checkConsent, checkInitiatingVisit,
 * checkChiZCode, checkPayerAssignment); validateClaimData itself now just
 * runs them in order and filters out the ones that pass (complexity 16 -> 2).
 *
 * validateClaimData is module-private, so these exercise it through
 * generateMonthlyClaims (the sole caller) and assert on
 * claim.validationErrors. scripts/verify-claims-engine.ts already covers
 * "patient not found", insufficient time, missing member ID, missing
 * consent, unverified time, and the CHI Z-code check; this file fills in
 * the remaining checks — missing diagnosis codes, the initiating-visit-date
 * checks, missing payer assignment — plus the exact multi-error ordering,
 * so the extraction can't silently reorder or drop a check.
 */

import { generateMonthlyClaims } from "../lib/claims-engine"
import { PAYER_CONFIGS } from "../lib/payer-config"
import type { IntakeRecord, Patient, TimeLog } from "../lib/types"

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

const MEDICARE_PIN = PAYER_CONFIGS["medicare-pin"]

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
    date: "2020-06-01",
    initiatingVisitDate: "2020-06-01",
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
    date: "2020-07-15",
    startTime: "2020-07-15T09:00:00Z",
    endTime: "2020-07-15T10:00:00Z",
    durationMinutes: 60,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-1",
    verified: true,
    billingPeriod: "2020-07",
    ...overrides,
  }
}

console.log("Characterization: Claim validation (validateClaimData via generateMonthlyClaims)")
console.log("=================================================================================")

run("Missing diagnosis codes: no icdCodes and no primaryDiagnosis flags; either one alone satisfies", () => {
  const noDx = makePatient({ icdCodes: [], primaryDiagnosis: undefined })
  const [claimNoDx] = generateMonthlyClaims([], [noDx], [makeLog()], MEDICARE_PIN, [makeIntake()])
  assert(
    claimNoDx.validationErrors!.includes("Missing diagnosis codes (ICD-10)"),
    `missing-diagnosis error present (got ${JSON.stringify(claimNoDx.validationErrors)})`
  )

  const withPrimaryOnly = makePatient({ icdCodes: [], primaryDiagnosis: "Type 2 Diabetes" })
  const [claimPrimary] = generateMonthlyClaims([], [withPrimaryOnly], [makeLog()], MEDICARE_PIN, [makeIntake()])
  assert(
    !(claimPrimary.validationErrors ?? []).includes("Missing diagnosis codes (ICD-10)"),
    "primaryDiagnosis alone (no icdCodes) satisfies the check"
  )

  const withIcdOnly = makePatient({ icdCodes: ["E11.9"], primaryDiagnosis: undefined })
  const [claimIcd] = generateMonthlyClaims([], [withIcdOnly], [makeLog()], MEDICARE_PIN, [makeIntake()])
  assert(
    !(claimIcd.validationErrors ?? []).includes("Missing diagnosis codes (ICD-10)"),
    "icdCodes alone (no primaryDiagnosis) satisfies the check"
  )
})

run("Initiating visit date not recorded is flagged separately from missing consent", () => {
  const patient = makePatient()
  const intake = makeIntake({ initiatingVisitDate: "" })
  const [claim] = generateMonthlyClaims([], [patient], [makeLog()], MEDICARE_PIN, [intake])
  assert(
    claim.validationErrors!.includes("Initiating visit date not recorded"),
    `missing initiating-visit-date error present (got ${JSON.stringify(claim.validationErrors)})`
  )
  assert(
    !claim.validationErrors!.includes("Patient consent not documented"),
    "consent is still on file, so that error does not also fire"
  )
})

run("Initiating visit older than 12 months before the claim month requires re-initiation", () => {
  const patient = makePatient()
  const intake = makeIntake({ initiatingVisitDate: "2019-01-01" })
  const logs = [makeLog({ date: "2020-07-15", billingPeriod: "2020-07" })]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])
  assert(
    claim.validationErrors!.includes("Initiating visit older than 12 months — re-initiation required"),
    `stale initiating-visit error present (got ${JSON.stringify(claim.validationErrors)})`
  )
})

run("Initiating visit exactly at the 12-month cutoff does not require re-initiation", () => {
  const patient = makePatient()
  // Cutoff for claim month 2020-07 is 2019-07-01 (year-1, same month, day 01);
  // an initiating visit ON the cutoff date is not "<" it, so it passes.
  const intake = makeIntake({ initiatingVisitDate: "2019-07-01" })
  const logs = [makeLog({ date: "2020-07-15", billingPeriod: "2020-07" })]
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])
  assert(
    !(claim.validationErrors ?? []).includes("Initiating visit older than 12 months — re-initiation required"),
    `visit exactly at cutoff passes (got ${JSON.stringify(claim.validationErrors)})`
  )
})

run("Missing payer assignment (no payerId) is flagged", () => {
  const patient = makePatient({ payerId: undefined })
  const [claim] = generateMonthlyClaims([], [patient], [makeLog()], MEDICARE_PIN, [makeIntake()])
  assert(
    claim.validationErrors!.includes("Missing payer assignment"),
    `missing-payer error present (got ${JSON.stringify(claim.validationErrors)})`
  )
})

run("A fully valid claim (past month) has no validation errors and is VALIDATED", () => {
  const patient = makePatient()
  const intake = makeIntake()
  const [claim] = generateMonthlyClaims([], [patient], [makeLog()], MEDICARE_PIN, [intake])
  assert(claim.validationErrors === undefined, `no validation errors (got ${JSON.stringify(claim.validationErrors)})`)
  assert(claim.status === "VALIDATED", `status VALIDATED (got "${claim.status}")`)
})

run("Multiple simultaneous errors surface in check order: time, member ID, diagnosis, consent, visit, payer", () => {
  const patient = makePatient({
    memberId: undefined,
    icdCodes: [],
    primaryDiagnosis: undefined,
    payerId: undefined,
  })
  const intake = makeIntake({ consentObtained: false, initiatingVisitDate: "" })
  const logs = [makeLog({ durationMinutes: 5 })] // below the 60-min PIN threshold
  const [claim] = generateMonthlyClaims([], [patient], logs, MEDICARE_PIN, [intake])

  assert(
    JSON.stringify(claim.validationErrors) ===
      JSON.stringify([
        "Insufficient Time (5/60 mins)",
        "Missing Member ID",
        "Missing diagnosis codes (ICD-10)",
        "Patient consent not documented",
        "Initiating visit date not recorded",
        "Missing payer assignment",
      ]),
    `errors appear in the original check order (got ${JSON.stringify(claim.validationErrors)})`
  )
})

console.log("\n=================================================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
