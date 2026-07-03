/**
 * EDI 837P Generator (5010 X222 Professional Claim)
 *
 * Builds an ANSI X12 837P transaction from persisted ClaimRecord snapshots:
 * envelope (ISA/GS/ST) from OrganizationSettings + the target payer, one
 * 2000A billing-provider loop for the org, and per record a 2000B subscriber
 * loop, 2300 claim (CLM01 = ClaimRecord.id — this is the number the payer's
 * 835 echoes back in CLP01), and 2400 service lines priced from the
 * PayerConfig revenue rates.
 *
 * Design notes:
 * - DMG (date of birth) is emitted only when the real DOB is found in the
 *   patients lookup — never a placeholder date.
 * - DTP*434 covers the full billing month using the REAL month end.
 * - Diagnosis codes are emitted with the "." stripped (HI*ABK:Z590), primary
 *   first (ABK) then up to 11 secondaries (ABF).
 */

import type {
  ClaimRecord,
  Navigator,
  OrganizationSettings,
  Patient,
  Payer,
  PayerConfig,
} from "../types"
import {
  DEFAULT_SEPARATORS,
  buildGE,
  buildGS,
  buildIEA,
  buildISA,
  buildSE,
  buildST,
  firstDayOfMonth,
  formatAmount,
  lastDayOfMonth,
  round2,
  serializeX12,
  toCCYYMMDD,
} from "./x12"
import type { X12Segment } from "./x12"

// ============================================================================
// CONTEXT
// ============================================================================

export interface Generate837Context {
  patients: Patient[]
  navigators: Navigator[]
  payer: Payer
  payerConfig: PayerConfig
  orgSettings: OrganizationSettings
}

// ============================================================================
// HELPERS
// ============================================================================

/** "First Middle Last" -> NM1 last/first elements */
function splitName(fullName: string): { last: string; first: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { last: parts[0], first: "" }
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") }
}

/** SBR09 claim filing indicator from the payer type */
function claimFilingCode(payer: Payer): string {
  switch (payer.payerType) {
    case "MEDICARE":
      return "MB"
    case "MEDICAID":
      return "MC"
    case "COMMERCIAL":
      return "CI"
  }
}

/** Uppercase and strip characters X12 name elements should not carry */
function cleanName(value: string): string {
  return value.toUpperCase().replace(/[*:~^]/g, " ").trim()
}

// ============================================================================
// GENERATOR
// ============================================================================

/**
 * Generate a 5010 X222 837P file for the given claim records.
 * All records in one call are billed to the single payer in `ctx`
 * (one 837 goes to one receiver).
 */
export function generate837P(records: ClaimRecord[], ctx: Generate837Context): string {
  const { patients, navigators, payer, payerConfig, orgSettings } = ctx
  const seps = DEFAULT_SEPARATORS
  const now = new Date()

  const patientById = new Map(patients.map((p) => [p.id, p]))
  const navigatorById = new Map(navigators.map((n) => [n.id, n]))

  const interchangeControl = 1
  const groupControl = 1
  const txnControl = 1
  const orgName = cleanName(orgSettings.organizationName)

  const ccyymmdd =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0")
  const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0")

  // --- Transaction set body (ST..SE) ---
  const txn: X12Segment[] = []
  txn.push(buildST("837", txnControl, "005010X222A1"))
  txn.push({
    id: "BHT",
    elements: ["0019", "00", `MACH1-${ccyymmdd}${hhmm}`, ccyymmdd, hhmm, "CH"],
  })

  // 1000A submitter
  txn.push({
    id: "NM1",
    elements: ["41", "2", orgName, "", "", "", "", "46", orgSettings.submitterId],
  })
  txn.push({
    id: "PER",
    elements: ["IC", orgName, "TE", orgSettings.contactPhone.replace(/\D/g, "")],
  })

  // 1000B receiver
  txn.push({
    id: "NM1",
    elements: ["40", "2", cleanName(payer.name), "", "", "", "", "46", payer.ediPayerId],
  })

  // 2000A billing provider
  let hlCounter = 1
  const billingHl = hlCounter
  txn.push({ id: "HL", elements: [String(billingHl), "", "20", "1"] })
  txn.push({ id: "PRV", elements: ["BI", "PXC", orgSettings.taxonomyCode] })
  txn.push({
    id: "NM1",
    elements: ["85", "2", orgName, "", "", "", "", "XX", orgSettings.npi],
  })
  txn.push({ id: "N3", elements: [orgSettings.address.street.toUpperCase()] })
  txn.push({
    id: "N4",
    elements: [
      orgSettings.address.city.toUpperCase(),
      orgSettings.address.state.toUpperCase(),
      orgSettings.address.zip.replace(/\D/g, ""),
    ],
  })
  txn.push({ id: "REF", elements: ["EI", orgSettings.taxId.replace(/\D/g, "")] })

  for (const record of records) {
    const claim = record.snapshot
    const patient = patientById.get(claim.patientId)
    const navigator = navigatorById.get(claim.navigatorId)

    // 2000B subscriber (patient is the subscriber for these plans)
    hlCounter++
    txn.push({ id: "HL", elements: [String(hlCounter), String(billingHl), "22", "0"] })
    txn.push({
      id: "SBR",
      elements: ["P", "18", "", "", "", "", "", "", claimFilingCode(payer)],
    })

    const patientName = splitName(claim.patientName)
    txn.push({
      id: "NM1",
      elements: [
        "IL", "1",
        cleanName(patientName.last),
        cleanName(patientName.first),
        "", "", "",
        "MI",
        claim.memberId,
      ],
    })

    if (patient?.address) {
      txn.push({ id: "N3", elements: [patient.address.street.toUpperCase()] })
      txn.push({
        id: "N4",
        elements: [
          patient.address.city.toUpperCase(),
          patient.address.state.toUpperCase(),
          patient.address.zip.replace(/\D/g, ""),
        ],
      })
    }

    // DMG only with a REAL date of birth — no placeholder fallback
    if (patient?.dob) {
      txn.push({ id: "DMG", elements: ["D8", toCCYYMMDD(patient.dob)] })
    }

    // 2300 claim: CLM01 = ClaimRecord.id (echoed back as CLP01 on the 835);
    // facility code 12 = home (community navigation happens in the home)
    txn.push({
      id: "CLM",
      elements: [
        record.id,
        formatAmount(record.billedAmount),
        "", "",
        `12${seps.component}B${seps.component}1`,
        "Y", "A", "Y", "Y",
      ],
    })

    // Service period: the full billing month, real month end
    const monthStart = firstDayOfMonth(claim.month)
    const monthEnd = lastDayOfMonth(claim.month)
    txn.push({
      id: "DTP",
      elements: ["434", "RD8", `${toCCYYMMDD(monthStart)}-${toCCYYMMDD(monthEnd)}`],
    })

    // HI diagnosis codes: ABK primary + ABF secondaries, "." stripped, max 12
    const diagnoses = claim.diagnosisCodes
      .map((code) => code.replace(/\./g, "").toUpperCase())
      .filter(Boolean)
      .slice(0, 12)
    if (diagnoses.length > 0) {
      txn.push({
        id: "HI",
        elements: diagnoses.map(
          (code, i) => `${i === 0 ? "ABK" : "ABF"}${seps.component}${code}`
        ),
      })
    }

    // 2310B rendering provider: the navigator, billed under the supervising NPI
    const renderingName = splitName(navigator?.name ?? orgSettings.supervisingProvider.name)
    txn.push({
      id: "NM1",
      elements: [
        "82", "1",
        cleanName(renderingName.last),
        cleanName(renderingName.first),
        "", "", "",
        "XX",
        orgSettings.supervisingProvider.npi,
      ],
    })

    // 2400 service lines: one per code, priced from the payer config
    const serviceDate = toCCYYMMDD(monthEnd)
    let lineNumber = 0

    const pushLine = (code: string, units: number, rate: number) => {
      lineNumber++
      txn.push({ id: "LX", elements: [String(lineNumber)] })
      txn.push({
        id: "SV1",
        elements: [
          `HC${seps.component}${code}`,
          formatAmount(round2(units * rate)),
          "UN",
          String(units),
          "", "",
          "1", // diagnosis pointer -> first HI code
        ],
      })
      txn.push({ id: "DTP", elements: ["472", "D8", serviceDate] })
    }

    if (claim.primaryUnits > 0) {
      pushLine(claim.primaryCode, claim.primaryUnits, payerConfig.revenueRates.baseRate)
    }
    if (claim.addOnUnits > 0 && claim.addOnCode) {
      pushLine(
        claim.addOnCode,
        claim.addOnUnits,
        payerConfig.revenueRates.addOnRate ?? payerConfig.revenueRates.baseRate
      )
    }
  }

  // SE count includes ST and SE itself
  txn.push(buildSE(txn.length + 1, txnControl))

  // --- Envelope ---
  const segments: X12Segment[] = [
    buildISA({
      senderId: orgSettings.submitterId,
      receiverId: payer.ediPayerId,
      controlNumber: interchangeControl,
      date: now,
      separators: seps,
    }),
    buildGS({
      functionalCode: "HC",
      senderCode: orgSettings.submitterId,
      receiverCode: payer.ediPayerId,
      controlNumber: groupControl,
      versionCode: "005010X222A1",
      date: now,
    }),
    ...txn,
    buildGE(1, groupControl),
    buildIEA(1, interchangeControl),
  ]

  return serializeX12(segments, seps)
}
