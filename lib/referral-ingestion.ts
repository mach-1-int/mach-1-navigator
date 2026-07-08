/**
 * Referral Ingestion Adapters
 *
 * Pluggable parsers that turn raw referral payloads from external systems
 * into the app's Referral shape. The HL7v2 parser is the simulator/demo tier:
 * it handles the pipe-delimited segments we care about (MSH/PID/DG1/IN1/PV1)
 * and degrades gracefully — recoverable problems become warnings, never
 * throws. A future FHIR R4 adapter slots in behind the same interface once
 * the backend integration lands.
 */

import type { Referral, ReferralRawData } from "./types"
import { localTodayISO } from "./date-rebase"

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

export type ParsedReferralResult = {
  referral: Referral
  warnings: string[]
}

// NOTE: intentionally NOT named `ReferralSource` — that name is taken by an
// analytics type in lib/types.ts.
export interface ReferralSourceAdapter {
  readonly name: string
  parse(raw: string): ParsedReferralResult
}

// ============================================================================
// HL7v2 PARSING HELPERS
// ============================================================================

const FIELD_SEP = "|"
const COMPONENT_SEP = "^"
const REPEAT_SEP = "~"

/** Split a raw HL7 message into non-empty segments (tolerates \r, \n, \r\n). */
function splitSegments(raw: string): string[] {
  return raw
    .split(/\r\n|\r|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Component split with trailing-safe access. */
function components(field: string | undefined): string[] {
  return (field ?? "").split(COMPONENT_SEP)
}

/**
 * Field accessor for non-MSH segments: SEG-N === fields[N] after splitting
 * on `|` (fields[0] is the segment name).
 */
function field(fields: string[], n: number): string {
  return (fields[n] ?? "").trim()
}

/**
 * Field accessor for MSH. MSH-1 is the field separator character itself, so
 * after splitting on `|`, MSH-N lives at fields[N - 1] (e.g. MSH-9 message
 * type is fields[8]).
 */
function mshField(fields: string[], n: number): string {
  return (fields[n - 1] ?? "").trim()
}

/** HL7 DTM (YYYYMMDD[HHMMSS...]) -> ISO date "YYYY-MM-DD"; "" if unparseable. */
function hl7DateToIso(dtm: string): string {
  const m = dtm.match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ""
}

/** PID-15 language code -> app language ("es" or "en"). */
function mapLanguage(code: string): string {
  const normalized = code.trim().toLowerCase()
  if (normalized === "es" || normalized === "spa") return "es"
  return "en"
}

/**
 * XCN physician name components -> "Dr. Given Family".
 * Handles both `id^family^given` (standard XCN) and bare `family^given`.
 */
function physicianName(rawField: string): string {
  const comps = components(rawField)
  if (!rawField.trim()) return ""
  let family: string
  let given: string
  if (/^\d+$/.test(comps[0] ?? "") && comps.length >= 2) {
    family = (comps[1] ?? "").trim()
    given = (comps[2] ?? "").trim()
  } else {
    family = (comps[0] ?? "").trim()
    given = (comps[1] ?? "").trim()
  }
  const name = [given, family].filter(Boolean).join(" ")
  return name ? `Dr. ${name}` : ""
}

/** Acuity heuristic from ICD-10 codes (mirrors seed-data tiering). */
function acuityFromIcdCodes(icdCodes: string[]): "L1" | "L2" | "L3" {
  const isL3 = icdCodes.some(
    (code) =>
      code.startsWith("N18.6") ||
      code.startsWith("C") ||
      code.startsWith("I50") ||
      code.startsWith("Z99.2")
  )
  if (isL3) return "L3"
  const isL2 = icdCodes.some(
    (code) => code.startsWith("E11") || code.startsWith("I10") || code.startsWith("J44")
  )
  if (isL2) return "L2"
  return "L1"
}

// ============================================================================
// HL7v2 PARSER
// ============================================================================

/** Monotonic suffix so two ingests in the same millisecond never collide. */
let ingestSequence = 0

type HL7Segment = string[]

/** MSH-4 sending facility + MSH-9 message type sanity check. */
function parseMsh(msh: HL7Segment): { sendingFacility: string; warnings: string[] } {
  const warnings: string[] = []
  const sendingFacility = components(mshField(msh, 4))[0] || "Unknown Facility"
  if (!components(mshField(msh, 4))[0]) {
    warnings.push("MSH-4 sending facility missing — source set to 'Unknown Facility'")
  }
  const messageType = mshField(msh, 9) // e.g. "ADT^A04" or "REF^I12"
  const messageCode = components(messageType)[0]
  if (messageCode !== "ADT" && messageCode !== "REF") {
    warnings.push(
      `Unexpected message type "${messageType || "(none)"}" — expected ADT^A04 or REF^I12; parsing anyway`
    )
  }
  return { sendingFacility, warnings }
}

/** PID-5/7/8/11/13/15 patient demographics. */
function parsePid(pid: HL7Segment): {
  patientName: string
  dob: string
  gender: "M" | "F" | "O"
  address: { street: string; city: string; state: string; zip: string }
  phone: string
  language: string
  warnings: string[]
} {
  const warnings: string[] = []

  const nameComps = components(field(pid, 5)) // family^given
  const familyName = (nameComps[0] ?? "").trim()
  const givenName = (nameComps[1] ?? "").trim()
  const patientName = [givenName, familyName].filter(Boolean).join(" ")
  if (!patientName) warnings.push("PID-5 patient name missing")

  const dob = hl7DateToIso(field(pid, 7))
  if (!dob) warnings.push("PID-7 date of birth missing or unparseable")

  const genderRaw = field(pid, 8).toUpperCase()
  let gender: "M" | "F" | "O" = "O"
  if (genderRaw === "M" || genderRaw === "F") {
    gender = genderRaw
  } else if (genderRaw !== "O") {
    warnings.push(`PID-8 gender "${genderRaw || "(none)"}" not recognized — defaulted to "O"`)
  }

  const addrComps = components(field(pid, 11)) // street^^city^state^zip
  const address = {
    street: (addrComps[0] ?? "").trim(),
    city: (addrComps[2] ?? "").trim(),
    state: (addrComps[3] ?? "").trim(),
    zip: (addrComps[4] ?? "").trim(),
  }
  if (!address.zip) warnings.push("PID-11 address has no zip code — distance matching will use fallbacks")

  const phone = field(pid, 13)
  if (!phone) warnings.push("PID-13 phone number missing")

  const language = mapLanguage(field(pid, 15))

  return { patientName, dob, gender, address, phone, language, warnings }
}

/** DG1 (repeatable) diagnosis codes; DG1-3 may itself carry `~` repeats. */
function parseDiagnoses(dg1Segments: HL7Segment[]): {
  primaryDiagnosis: string
  diagnosisDate: string
  icdCodes: string[]
  warnings: string[]
} {
  const warnings: string[] = []
  let primaryDiagnosis = ""
  let diagnosisDate = ""
  const icdCodes: string[] = []

  for (const dg1 of dg1Segments) {
    for (const rep of field(dg1, 3).split(REPEAT_SEP)) {
      const dxComps = components(rep)
      const code = (dxComps[0] ?? "").trim()
      const description = (dxComps[1] ?? "").trim() || field(dg1, 4)
      if (code) icdCodes.push(code)
      if (!primaryDiagnosis && (description || code)) {
        primaryDiagnosis = description || code
      }
    }
    if (!diagnosisDate) diagnosisDate = hl7DateToIso(field(dg1, 5))
  }

  if (dg1Segments.length === 0) {
    warnings.push("No DG1 segment — diagnosis unknown; acuity defaulted to L1")
  } else if (icdCodes.length === 0) {
    warnings.push("DG1 present but no ICD codes found")
  }

  return { primaryDiagnosis, diagnosisDate, icdCodes, warnings }
}

/** IN1-3/4/36/49 insurance/payer fields. */
function parseInsurance(in1: HL7Segment | undefined): {
  payerName: string
  payerId: string
  memberId: string
  warnings: string[]
} {
  const warnings: string[] = []
  let payerName = ""
  let payerId = ""
  let memberId = ""

  if (in1) {
    payerId = components(field(in1, 3))[0]?.trim() ?? ""
    payerName = components(field(in1, 4))[0]?.trim() ?? ""
    memberId = field(in1, 36) || field(in1, 49)
    if (!payerName) warnings.push("IN1-4 payer name missing")
    if (!memberId) warnings.push("IN1-36/IN1-49 member ID missing — billing will need manual entry")
  } else {
    warnings.push("No IN1 segment — insurance information missing")
  }

  return { payerName, payerId, memberId, warnings }
}

/** PV1-3/7/8 facility and physician fields. */
function parseVisit(
  pv1: HL7Segment | undefined,
  sendingFacility: string
): {
  attendingPhysician: string
  referringPhysician: string
  facilityName: string
  warnings: string[]
} {
  const warnings: string[] = []
  let attendingPhysician = ""
  let referringPhysician = ""
  let facilityName = sendingFacility

  if (pv1) {
    attendingPhysician = physicianName(field(pv1, 7))
    referringPhysician = physicianName(field(pv1, 8))
    facilityName = components(field(pv1, 3))[0]?.trim() || sendingFacility
  } else {
    warnings.push("No PV1 segment — facility taken from MSH-4 sending facility")
  }
  if (!referringPhysician) warnings.push("Referring physician missing")

  return { attendingPhysician, referringPhysician, facilityName, warnings }
}

/**
 * Parse a raw HL7v2 message (ADT^A04 / REF^I12 style) into a Referral.
 * Recoverable issues (missing DG1/IN1/PV1, unknown fields) become warnings;
 * throws only when the message has no MSH or no PID segment.
 */
export function parseHL7v2(raw: string): ParsedReferralResult {
  const segments = splitSegments(raw).map((s) => s.split(FIELD_SEP))

  const msh = segments.find((s) => s[0] === "MSH")
  if (!msh) throw new Error("Invalid HL7 message: missing MSH segment")
  const pid = segments.find((s) => s[0] === "PID")
  if (!pid) throw new Error("Invalid HL7 message: missing PID segment")

  const dg1Segments = segments.filter((s) => s[0] === "DG1")
  const in1 = segments.find((s) => s[0] === "IN1")
  const pv1 = segments.find((s) => s[0] === "PV1")

  const mshResult = parseMsh(msh)
  const pidResult = parsePid(pid)
  const dg1Result = parseDiagnoses(dg1Segments)
  const in1Result = parseInsurance(in1)
  const pv1Result = parseVisit(pv1, mshResult.sendingFacility)

  const warnings = [
    ...mshResult.warnings,
    ...pidResult.warnings,
    ...dg1Result.warnings,
    ...in1Result.warnings,
    ...pv1Result.warnings,
  ]

  // --- Assemble Referral ---------------------------------------------------
  const now = new Date()
  const todayIso = localTodayISO()
  const requiredAcuity = acuityFromIcdCodes(dg1Result.icdCodes)
  const riskScore: 1 | 2 | 3 = requiredAcuity === "L3" ? 3 : requiredAcuity === "L2" ? 2 : 1

  const rawData: ReferralRawData = {
    PID: {
      patientName: pidResult.patientName || "Unknown Patient",
      dob: pidResult.dob,
      gender: pidResult.gender,
      address: pidResult.address,
      phone: pidResult.phone,
    },
    DG1: {
      primaryDiagnosis: dg1Result.primaryDiagnosis || "Unspecified",
      icdCodes: dg1Result.icdCodes,
      diagnosisDate: dg1Result.diagnosisDate || todayIso,
    },
    IN1: {
      payerName: in1Result.payerName,
      payerId: in1Result.payerId,
      memberId: in1Result.memberId,
    },
    PV1: {
      attendingPhysician: pv1Result.attendingPhysician || undefined,
      referringPhysician: pv1Result.referringPhysician,
      facilityName: pv1Result.facilityName,
    },
  }

  const referral: Referral = {
    id: `ref-hl7-${Date.now().toString(36)}-${(ingestSequence++).toString(36)}`,
    receivedAt: now.toISOString(),
    source: mshResult.sendingFacility,
    rawData,
    rawHL7: raw,
    status: "pending",
    patientName: rawData.PID.patientName,
    dob: pidResult.dob,
    referralSource: mshResult.sendingFacility,
    riskScore,
    referralDate: todayIso,
    diagnosis: rawData.DG1.primaryDiagnosis,
    healthPlan: in1Result.payerName,
    zipCode: pidResult.address.zip,
    language: pidResult.language,
    requiredAcuity,
  }

  return { referral, warnings }
}

// ============================================================================
// SIMULATED HL7 FEED (demo tier)
// ============================================================================
//
// Moved to ./referral-simulator (SimulatedHL7Feed builds a rotating pool of
// fake AZ patients into ADT^A04 messages); re-exported here to keep this
// module's public API unchanged.
export { SimulatedHL7Feed } from "./referral-simulator"

// ============================================================================
// FHIR R4 ADAPTER (future real-integration slot)
// ============================================================================

/**
 * FHIR R4 ServiceRequest/Patient bundle adapter.
 *
 * This is the designated slot for the real backend integration: when the
 * FHIR interface goes live, implement parse() to map a ServiceRequest bundle
 * (Patient, Condition, Coverage, Encounter resources) onto the same
 * ParsedReferralResult shape the HL7v2 path produces. Until then it throws so
 * accidental wiring fails loudly.
 */
export class FhirR4Adapter implements ReferralSourceAdapter {
  readonly name = "FHIR R4 (ServiceRequest)"

  parse(_raw: string): ParsedReferralResult {
    void _raw
    throw new Error("FHIR R4 adapter not implemented — backend integration deferred")
  }
}
