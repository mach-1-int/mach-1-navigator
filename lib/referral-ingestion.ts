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
import { AZ_ZIP_CENTROIDS } from "./geo"
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

/**
 * Parse a raw HL7v2 message (ADT^A04 / REF^I12 style) into a Referral.
 * Recoverable issues (missing DG1/IN1/PV1, unknown fields) become warnings;
 * throws only when the message has no MSH or no PID segment.
 */
export function parseHL7v2(raw: string): ParsedReferralResult {
  const warnings: string[] = []
  const segments = splitSegments(raw).map((s) => s.split(FIELD_SEP))

  const msh = segments.find((s) => s[0] === "MSH")
  if (!msh) throw new Error("Invalid HL7 message: missing MSH segment")
  const pid = segments.find((s) => s[0] === "PID")
  if (!pid) throw new Error("Invalid HL7 message: missing PID segment")

  const dg1Segments = segments.filter((s) => s[0] === "DG1")
  const in1 = segments.find((s) => s[0] === "IN1")
  const pv1 = segments.find((s) => s[0] === "PV1")

  // --- MSH ---------------------------------------------------------------
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

  // --- PID ---------------------------------------------------------------
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

  // --- DG1 (repeatable) ----------------------------------------------------
  let primaryDiagnosis = ""
  let diagnosisDate = ""
  const icdCodes: string[] = []
  for (const dg1 of dg1Segments) {
    // DG1-3 may itself carry repeats (~) of code^description
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

  // --- IN1 ---------------------------------------------------------------
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

  // --- PV1 ---------------------------------------------------------------
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

  // --- Assemble Referral ---------------------------------------------------
  const now = new Date()
  const todayIso = localTodayISO()
  const requiredAcuity = acuityFromIcdCodes(icdCodes)
  const riskScore: 1 | 2 | 3 = requiredAcuity === "L3" ? 3 : requiredAcuity === "L2" ? 2 : 1

  const rawData: ReferralRawData = {
    PID: {
      patientName: patientName || "Unknown Patient",
      dob,
      gender,
      address,
      phone,
    },
    DG1: {
      primaryDiagnosis: primaryDiagnosis || "Unspecified",
      icdCodes,
      diagnosisDate: diagnosisDate || todayIso,
    },
    IN1: {
      payerName,
      payerId,
      memberId,
    },
    PV1: {
      attendingPhysician: attendingPhysician || undefined,
      referringPhysician,
      facilityName,
    },
  }

  const referral: Referral = {
    id: `ref-hl7-${Date.now().toString(36)}-${(ingestSequence++).toString(36)}`,
    receivedAt: now.toISOString(),
    source: sendingFacility,
    rawData,
    rawHL7: raw,
    status: "pending",
    patientName: rawData.PID.patientName,
    dob,
    referralSource: sendingFacility,
    riskScore,
    referralDate: todayIso,
    diagnosis: rawData.DG1.primaryDiagnosis,
    healthPlan: payerName,
    zipCode: address.zip,
    language,
    requiredAcuity,
  }

  return { referral, warnings }
}

// ============================================================================
// SIMULATED HL7 FEED (demo tier)
// ============================================================================

interface SimPatient {
  family: string
  given: string
  dob: string // YYYYMMDD
  gender: "M" | "F"
  street: string
  city: string
  zip: string // Must exist in AZ_ZIP_CENTROIDS so distance matching resolves
  phone: string
  language: "en" | "es"
  payerName: string
  payerId: string
  memberId: string
  diagnoses: { code: string; description: string }[]
  facility: string
  referring: { family: string; given: string }
}

// Zips deliberately drawn from AZ_ZIP_CENTROIDS keys; payer names match the
// seeded Payer entities (United Healthcare / Mercy Care / Molina / AHCCCS).
// Pool keeps the matching demo interesting: one Spanish speaker (Maria) and
// one L3 dialysis patient (Harold).
const SIM_PATIENT_POOL: SimPatient[] = [
  {
    family: "Garcia", given: "Maria", dob: "19570614", gender: "F",
    street: "4402 W Camelback Rd", city: "Phoenix", zip: "85031",
    phone: "(602) 555-0173", language: "es",
    payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC556677889",
    diagnoses: [{ code: "E11.9", description: "Type 2 Diabetes Mellitus" }],
    facility: "Banner Estrella Medical Center",
    referring: { family: "Martinez", given: "Ana" },
  },
  {
    family: "Simmons", given: "Harold", dob: "19490302", gender: "M",
    street: "2210 E Thomas Rd", city: "Phoenix", zip: "85008",
    phone: "(602) 555-0611", language: "en",
    payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC443322110",
    diagnoses: [
      { code: "N18.6", description: "End Stage Renal Disease" },
      { code: "Z99.2", description: "Dependence on renal dialysis" },
    ],
    facility: "Valleywise Medical Center",
    referring: { family: "Park", given: "James" },
  },
  {
    family: "Whitaker", given: "James", dob: "19601121", gender: "M",
    street: "1150 E Apache Blvd", city: "Tempe", zip: "85281",
    phone: "(480) 555-0342", language: "en",
    payerName: "Molina", payerId: "MOL-AZ", memberId: "MOL778899001",
    diagnoses: [{ code: "J44.9", description: "COPD, unspecified" }],
    facility: "Banner Desert Medical Center",
    referring: { family: "Okafor", given: "Chidi" },
  },
  {
    family: "Nguyen", given: "Dorothy", dob: "19530908", gender: "F",
    street: "7301 E Indian School Rd", city: "Scottsdale", zip: "85251",
    phone: "(480) 555-0518", language: "en",
    payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC334455667",
    diagnoses: [{ code: "I50.32", description: "Chronic diastolic heart failure" }],
    facility: "HonorHealth Scottsdale",
    referring: { family: "Chen", given: "Robert" },
  },
  {
    family: "Park", given: "Linda", dob: "19710419", gender: "F",
    street: "890 S Higley Rd", city: "Gilbert", zip: "85296",
    phone: "(480) 555-0227", language: "en",
    payerName: "Molina", payerId: "MOL-AZ", memberId: "MOL112233445",
    diagnoses: [{ code: "M54.5", description: "Low back pain" }],
    facility: "Dignity Health Mercy Gilbert",
    referring: { family: "Herrera", given: "Sofia" },
  },
  {
    family: "Tallchief", given: "Robert", dob: "19551230", gender: "M",
    street: "301 N Church Ave", city: "Tucson", zip: "85701",
    phone: "(520) 555-0490", language: "en",
    payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC990011223",
    diagnoses: [{ code: "C34.90", description: "Malignant neoplasm of lung" }],
    facility: "Tucson Medical Center",
    referring: { family: "Begay", given: "Naomi" },
  },
]

// Sanity guard for future pool edits: every simulated zip must resolve.
if (process.env.NODE_ENV !== "production") {
  for (const p of SIM_PATIENT_POOL) {
    if (!AZ_ZIP_CENTROIDS[p.zip]) {
      throw new Error(`SimulatedHL7Feed: zip ${p.zip} not in AZ_ZIP_CENTROIDS`)
    }
  }
}

/** Rotates deterministically through the pool across all feed instances. */
let simRotationIndex = 0
let simMessageControlId = 1000

/** HL7 DTM timestamp (local time) for MSH-7, e.g. "20260703143005". */
function hl7Timestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

/**
 * Simulated inbound HL7 feed. Builds realistic ADT^A04 messages from a
 * rotating pool of fake AZ patients; every generated message round-trips
 * through parseHL7v2.
 */
export class SimulatedHL7Feed implements ReferralSourceAdapter {
  readonly name = "Simulated HL7v2 Feed (ADT^A04)"

  parse(raw: string): ParsedReferralResult {
    return parseHL7v2(raw)
  }

  generateIncoming(): { raw: string; parsed: ParsedReferralResult } {
    const patient = SIM_PATIENT_POOL[simRotationIndex % SIM_PATIENT_POOL.length]
    simRotationIndex++
    const controlId = `MACH1${simMessageControlId++}`
    const ts = hl7Timestamp(new Date())

    const msh = [
      "MSH", "^~\\&", "AMDEHR", patient.facility, "MACH1NAV", "MACH1",
      ts, "", "ADT^A04", controlId, "P", "2.5.1",
    ].join(FIELD_SEP)

    const pid = [
      "PID", "1", "", `${patient.memberId}^^^${patient.payerId}`, "",
      `${patient.family}^${patient.given}`, "", patient.dob, patient.gender, "", "",
      `${patient.street}^^${patient.city}^AZ^${patient.zip}`, "",
      patient.phone, "", patient.language,
    ].join(FIELD_SEP)

    const pv1 = [
      "PV1", "1", "O", patient.facility, "", "", "", "",
      `2001^${patient.referring.family}^${patient.referring.given}`,
    ].join(FIELD_SEP)

    const dg1Segments = patient.diagnoses.map((dx, i) =>
      ["DG1", String(i + 1), "", `${dx.code}^${dx.description}^I10`, dx.description, ts.slice(0, 8)].join(FIELD_SEP)
    )

    const in1Fields = new Array<string>(37).fill("")
    in1Fields[0] = "IN1"
    in1Fields[1] = "1"
    in1Fields[3] = patient.payerId
    in1Fields[4] = patient.payerName
    in1Fields[36] = patient.memberId
    const in1 = in1Fields.join(FIELD_SEP)

    const raw = [msh, pid, pv1, ...dg1Segments, in1].join("\r")
    return { raw, parsed: this.parse(raw) }
  }
}

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
