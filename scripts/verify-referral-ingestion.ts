/**
 * Verify: HL7v2 Referral Ingestion
 *
 * Run with: npm run verify:referral-ingestion
 *
 * Characterization test for `parseHL7v2` (lib/referral-ingestion.ts), added
 * when the function was refactored (split into per-segment helpers to bring
 * its cyclomatic complexity down). Locks in the pre-refactor behavior:
 * 1. A fully-populated message parses cleanly with zero warnings.
 * 2. A message missing the optional DG1/IN1/PV1 segments falls back to
 *    defaults and emits warnings in the original order.
 * 3. Messages missing the required MSH or PID segment still throw.
 */

import { parseHL7v2 } from "../lib/referral-ingestion"

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

const MSH = [
  "MSH", "^~\\&", "AMDEHR", "Banner Estrella Medical Center", "MACH1NAV", "MACH1",
  "20260101120000", "", "ADT^A04", "MACH1TEST1", "P", "2.5.1",
].join("|")

const PID = [
  "PID", "1", "", "MC601124873^^^MC-AZ", "",
  "Garcia^Maria", "", "19570614", "F", "", "",
  "4402 W Camelback Rd^^Phoenix^AZ^85031", "",
  "(602) 555-0173", "", "es",
].join("|")

const PV1 = ["PV1", "1", "O", "Banner Estrella Medical Center", "", "", "", "", "2001^Martinez^Ana"].join("|")

const DG1 = ["DG1", "1", "", "E11.9^Type 2 Diabetes Mellitus^I10", "Type 2 Diabetes Mellitus", "20260101"].join("|")

const in1Fields = new Array<string>(37).fill("")
in1Fields[0] = "IN1"
in1Fields[1] = "1"
in1Fields[3] = "MC-AZ"
in1Fields[4] = "Mercy Care"
in1Fields[36] = "MC601124873"
const IN1 = in1Fields.join("|")

run("Fully-populated message parses cleanly", () => {
  const raw = [MSH, PID, PV1, DG1, IN1].join("\r")
  const { referral, warnings } = parseHL7v2(raw)

  assert(warnings.length === 0, `zero warnings (got ${JSON.stringify(warnings)})`)
  assert(referral.patientName === "Maria Garcia", `patient name "Maria Garcia" (got "${referral.patientName}")`)
  assert(referral.dob === "1957-06-14", `dob 1957-06-14 (got ${referral.dob})`)
  assert(referral.zipCode === "85031", `zip 85031 (got ${referral.zipCode})`)
  assert(referral.language === "es", `language es (got ${referral.language})`)
  assert(referral.diagnosis === "Type 2 Diabetes Mellitus", `diagnosis carried through (got "${referral.diagnosis}")`)
  assert(referral.healthPlan === "Mercy Care", `health plan Mercy Care (got "${referral.healthPlan}")`)
  assert(referral.requiredAcuity === "L2", `acuity L2 for E11.9 (got ${referral.requiredAcuity})`)
  assert(referral.riskScore === 2, `risk score 2 for L2 (got ${referral.riskScore})`)
  assert(referral.source === "Banner Estrella Medical Center", `source is sending facility (got "${referral.source}")`)
  assert(
    referral.rawData.PV1.referringPhysician === "Dr. Ana Martinez",
    `referring physician "Dr. Ana Martinez" (got "${referral.rawData.PV1.referringPhysician}")`
  )
})

run("Missing optional segments fall back to defaults with ordered warnings", () => {
  const raw = [MSH, PID].join("\r")
  const { referral, warnings } = parseHL7v2(raw)

  assert(
    JSON.stringify(warnings) ===
      JSON.stringify([
        "No DG1 segment — diagnosis unknown; acuity defaulted to L1",
        "No IN1 segment — insurance information missing",
        "No PV1 segment — facility taken from MSH-4 sending facility",
        "Referring physician missing",
      ]),
    `warnings emitted in original order (got ${JSON.stringify(warnings)})`
  )
  assert(referral.diagnosis === "Unspecified", `diagnosis defaults to Unspecified (got "${referral.diagnosis}")`)
  assert(referral.requiredAcuity === "L1", `acuity defaults to L1 (got ${referral.requiredAcuity})`)
  assert(referral.riskScore === 1, `risk score defaults to 1 (got ${referral.riskScore})`)
  assert(referral.healthPlan === "", `health plan defaults to empty string (got "${referral.healthPlan}")`)
  assert(
    referral.source === "Banner Estrella Medical Center",
    `facility falls back to MSH-4 sending facility (got "${referral.source}")`
  )
})

run("Missing MSH or PID segment still throws", () => {
  assert(
    (() => {
      try {
        parseHL7v2(PID)
        return false
      } catch (err) {
        return err instanceof Error && err.message === "Invalid HL7 message: missing MSH segment"
      }
    })(),
    "throws on missing MSH segment"
  )
  assert(
    (() => {
      try {
        parseHL7v2(MSH)
        return false
      } catch (err) {
        return err instanceof Error && err.message === "Invalid HL7 message: missing PID segment"
      }
    })(),
    "throws on missing PID segment"
  )
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
