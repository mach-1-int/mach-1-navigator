/**
 * Simulated HL7 Referral Feed (demo tier)
 *
 * Builds realistic ADT^A04 HL7v2 messages from a rotating pool of fake AZ
 * patients so the demo has an inbound referral stream without a real
 * backend integration. Every generated message round-trips through
 * parseHL7v2 in ./referral-ingestion. Split out of referral-ingestion.ts,
 * which re-exports SimulatedHL7Feed to keep its public API unchanged.
 */

import { AZ_ZIP_CENTROIDS } from "./geo"
import {
  parseHL7v2,
  type ParsedReferralResult,
  type ReferralSourceAdapter,
} from "./referral-ingestion"

const FIELD_SEP = "|"

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
    payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC601124873",
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
  {
    family: "Okonkwo", given: "Grace", dob: "19630227", gender: "F",
    street: "6220 W Bell Rd", city: "Glendale", zip: "85308",
    phone: "(623) 555-0384", language: "en",
    payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC220953187",
    diagnoses: [{ code: "I10", description: "Essential hypertension" }],
    facility: "Abrazo Arrowhead Campus",
    referring: { family: "Delgado", given: "Rosa" },
  },
  {
    family: "Reyes", given: "Carlos", dob: "19581105", gender: "M",
    street: "5150 W Baseline Rd", city: "Laveen", zip: "85339",
    phone: "(602) 555-0736", language: "es",
    payerName: "Molina", payerId: "MOL-AZ", memberId: "MOL640281559",
    diagnoses: [
      { code: "E11.42", description: "Type 2 diabetes with polyneuropathy" },
      { code: "I10", description: "Essential hypertension" },
    ],
    facility: "Valleywise Medical Center",
    referring: { family: "Ibrahim", given: "Layla" },
  },
  {
    family: "Kowalski", given: "Stanley", dob: "19470816", gender: "M",
    street: "10401 W Thunderbird Blvd", city: "Sun City", zip: "85351",
    phone: "(623) 555-0912", language: "en",
    payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC118834920",
    diagnoses: [
      { code: "I50.9", description: "Heart failure, unspecified" },
      { code: "J44.9", description: "COPD, unspecified" },
    ],
    facility: "Banner Boswell Medical Center",
    referring: { family: "Patel", given: "Anjali" },
  },
  {
    family: "Yazzie", given: "Marie", dob: "19660531", gender: "F",
    street: "4025 E Chandler Blvd", city: "Phoenix", zip: "85044",
    phone: "(480) 555-0655", language: "en",
    payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC774209316",
    diagnoses: [{ code: "N18.3", description: "Chronic kidney disease, stage 3" }],
    facility: "Chandler Regional Medical Center",
    referring: { family: "Whitehorse", given: "Daniel" },
  },
  {
    family: "Petrov", given: "Irina", dob: "19740910", gender: "F",
    street: "3320 N 35th Ave", city: "Phoenix", zip: "85021",
    phone: "(602) 555-0248", language: "en",
    payerName: "Molina", payerId: "MOL-AZ", memberId: "MOL905517432",
    diagnoses: [{ code: "F33.1", description: "Major depressive disorder, recurrent" }],
    facility: "Valleywise Behavioral Health",
    referring: { family: "Sandoval", given: "Miguel" },
  },
  {
    family: "Buckley", given: "Thomas", dob: "19520403", gender: "M",
    street: "1818 E Broadway Rd", city: "Tucson", zip: "85710",
    phone: "(520) 555-0177", language: "en",
    payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC559361208",
    diagnoses: [
      { code: "C61", description: "Malignant neoplasm of prostate" },
      { code: "Z51.11", description: "Encounter for antineoplastic chemotherapy" },
    ],
    facility: "Tucson Medical Center",
    referring: { family: "Nakamura", given: "Kenji" },
  },
]

// Name-part pools for the combinatorial fallback once every curated persona
// is already in the system: 144 first/last combinations, each stamped with a
// unique member ID, so back-to-back demos never require a data reset.
const FALLBACK_GIVEN = ["Walter", "Diane", "Hector", "Pauline", "Marcus", "Yolanda", "Gerald", "Renee", "Felix", "Bernice", "Omar", "Cheryl"]
const FALLBACK_FAMILY = ["Trujillo", "Vance", "Osei", "Lindqvist", "Marsh", "Delacruz", "Boyd", "Antone", "Kaminski", "Fuentes", "Ngata", "Sherwood"]

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
let simFallbackIndex = 0

/** Case/whitespace-insensitive name key for exclusion checks */
function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Synthesize a fresh persona once the curated pool is exhausted: rotate
 * through 144 first/last name combinations, reusing a curated persona's
 * clinical/payer/address profile but with a unique name and member ID.
 */
function synthesizeFallbackPatient(exclude: Set<string>): SimPatient {
  for (let attempt = 0; attempt < FALLBACK_GIVEN.length * FALLBACK_FAMILY.length; attempt++) {
    const i = simFallbackIndex++
    const given = FALLBACK_GIVEN[i % FALLBACK_GIVEN.length]
    const family = FALLBACK_FAMILY[Math.floor(i / FALLBACK_GIVEN.length) % FALLBACK_FAMILY.length]
    if (exclude.has(nameKey(`${given} ${family}`))) continue

    const template = SIM_PATIENT_POOL[i % SIM_PATIENT_POOL.length]
    const serial = String(100000 + ((i * 7919) % 900000)) // unique-enough member serial
    return {
      ...template,
      given,
      family,
      dob: `19${45 + (i % 35)}0${1 + (i % 9)}1${i % 9}`,
      phone: `(602) 555-0${String(100 + (i % 900)).slice(0, 3)}`,
      memberId: `${template.memberId.slice(0, 3)}${serial}`,
    }
  }
  // Every combination somehow taken (demo would need 150+ ingests): make the
  // uniqueness explicit rather than colliding silently.
  const template = SIM_PATIENT_POOL[0]
  const n = simFallbackIndex++
  return { ...template, given: "Case", family: `Referral-${n}`, memberId: `SIM${100000 + n}` }
}

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

  /**
   * Generate the next incoming referral. Pass the names of everyone already
   * in the system (patients + referrals of any status) and the feed will
   * never re-produce a person who is already schedulable or already queued —
   * curated personas are skipped once used, and after the curated pool is
   * exhausted a combinatorial fallback keeps producing unique people, so
   * repeated demo runs never require a data reset.
   */
  generateIncoming(existingNames?: Iterable<string>): { raw: string; parsed: ParsedReferralResult } {
    const exclude = new Set<string>()
    for (const name of existingNames ?? []) exclude.add(nameKey(name))

    let patient: SimPatient | undefined
    for (let tries = 0; tries < SIM_PATIENT_POOL.length; tries++) {
      const candidate = SIM_PATIENT_POOL[simRotationIndex % SIM_PATIENT_POOL.length]
      simRotationIndex++
      if (!exclude.has(nameKey(`${candidate.given} ${candidate.family}`))) {
        patient = candidate
        break
      }
    }
    if (!patient) {
      patient = synthesizeFallbackPatient(exclude)
    }

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
