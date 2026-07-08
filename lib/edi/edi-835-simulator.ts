/**
 * EDI 835 Simulator
 *
 * Generates a valid 5010 X221 835 remittance file for a set of exported
 * ClaimRecords — the demo stand-in for a payer's ERA until real payer
 * connections exist. Output is guaranteed to round-trip through parse835.
 *
 * Adjudication is DETERMINISTIC: each record's outcome derives from a hash
 * of its id combined with the seed (default 42) — never Math.random — so a
 * demo replays identically. Scenarios:
 *
 *   PAY_ALL        — every claim paid in full (CLP02=1)
 *   MIXED          — ~70% paid in full, ~15% paid at 85% with a CAS*CO*45
 *                    contractual adjustment, ~15% denied (CLP02=4, paid 0)
 *                    with CAS*CO*197 and remark LQ*HE*N30
 *   DENY_ALL       — every claim denied
 *   DAP_ADJUSTMENT — every claim paid at 101% with a NEGATIVE CAS*CO*144
 *                    (payment increase) and remark LQ*HE*N807 — the UHC
 *                    Differential Adjustment Payment incentive whose codes
 *                    are deliberately absent from the seed dictionary
 *
 * CLP01 = ClaimRecord.id (echoing our 837 CLM01), CLP03 = billedAmount,
 * BPR02 = sum of all claim payments.
 */

import type { ClaimRecord, Payer } from "../types"
import {
  DEFAULT_SEPARATORS,
  buildGE,
  buildGS,
  buildIEA,
  buildISA,
  buildSE,
  buildST,
  formatAmount,
  round2,
  serializeX12,
  toCCYYMMDD,
} from "./x12"
import type { X12Segment } from "./x12"
import { localTodayISO } from "../date-rebase"

// ============================================================================
// OPTIONS
// ============================================================================

export type RemitScenario = "PAY_ALL" | "MIXED" | "DENY_ALL" | "DAP_ADJUSTMENT"

export interface Simulate835Options {
  scenario?: RemitScenario // default "MIXED"
  seed?: number // default 42 — same seed + same records = same 835
  /** ISO payment date for BPR16 (defaults to today) */
  paymentDate?: string
}

// ============================================================================
// DETERMINISTIC RNG
// ============================================================================

/** djb2 string hash (unsigned 32-bit) */
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * Deterministic roll in [0, 1) for a record id + seed:
 * hash the id, mix in the seed, advance one LCG step.
 */
function seededRoll(id: string, seed: number): number {
  let x = (hashString(id) ^ Math.imul(seed, 2654435761)) >>> 0
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0
  return x / 4294967296
}

// ============================================================================
// ADJUDICATION
// ============================================================================

interface AdjudicatedClaim {
  record: ClaimRecord
  statusCode: "1" | "4" // CLP02: 1 = processed as primary (paid), 4 = denied
  paidAmount: number
  adjustments: { groupCode: string; reasonCode: string; amount: number }[]
  rarcCodes: string[]
}

function adjudicate(record: ClaimRecord, scenario: RemitScenario, seed: number): AdjudicatedClaim {
  const billed = round2(record.billedAmount)
  const roll = seededRoll(record.id, seed)

  const denied = (): AdjudicatedClaim => ({
    record,
    statusCode: "4",
    paidAmount: 0,
    // CARC 197: precertification/authorization absent
    adjustments: [{ groupCode: "CO", reasonCode: "197", amount: billed }],
    // RARC N30: patient ineligible for this service
    rarcCodes: ["N30"],
  })

  const paidInFull = (): AdjudicatedClaim => ({
    record,
    statusCode: "1",
    paidAmount: billed,
    adjustments: [],
    rarcCodes: [],
  })

  if (scenario === "PAY_ALL") return paidInFull()
  if (scenario === "DENY_ALL") return denied()
  if (scenario === "DAP_ADJUSTMENT") {
    const paid = round2(billed * 1.01)
    return {
      record,
      statusCode: "1",
      paidAmount: paid,
      // CARC 144: incentive adjustment — negative CAS = payment increase
      // (billed - paid keeps CLP03 = CLP04 + ΣCAS balanced to the cent)
      adjustments: [{ groupCode: "CO", reasonCode: "144", amount: round2(billed - paid) }],
      // RARC N807: payment adjustment based on a payment-incentive program
      rarcCodes: ["N807"],
    }
  }

  // MIXED: ~70% full, ~15% contractual reduction to 85%, ~15% denied
  if (roll < 0.7) return paidInFull()
  if (roll < 0.85) {
    const paid = round2(billed * 0.85)
    return {
      record,
      statusCode: "1",
      paidAmount: paid,
      // CARC 45: charge exceeds fee schedule (contractual obligation)
      adjustments: [{ groupCode: "CO", reasonCode: "45", amount: round2(billed - paid) }],
      rarcCodes: [],
    }
  }
  return denied()
}

// ============================================================================
// GENERATOR
// ============================================================================

/** "First Last" -> { last: "Last", first: "First" } for NM1 name elements */
function splitName(fullName: string): { last: string; first: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { last: parts[0], first: "" }
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") }
}

/** Deterministic payer internal control number for CLP07 */
function payerControlNumber(recordId: string, seed: number): string {
  return `ICN${String(hashString(`${recordId}:${seed}`)).padStart(10, "0")}`
}

/**
 * Generate a sample 835 ERA for the given claim records.
 * The result parses cleanly with parse835 and matches back to the records
 * via CLP01 = record.id.
 */
export function generateSample835(
  claimRecords: ClaimRecord[],
  payers: Payer[],
  options: Simulate835Options = {}
): string {
  const scenario = options.scenario ?? "MIXED"
  const seed = options.seed ?? 42
  const seps = DEFAULT_SEPARATORS
  const now = new Date()
  const paymentDateIso = options.paymentDate ?? localTodayISO()

  // One 835 comes from one payer — resolve from the first record with a known payer
  const payer = claimRecords
    .map((r) => payers.find((p) => p.id === r.payerId))
    .find((p): p is Payer => Boolean(p))
  const payerName = (payer?.name ?? "SAMPLE HEALTH PLAN").toUpperCase()
  const payerEdiId = payer?.ediPayerId ?? "99999"

  const adjudicated = claimRecords.map((r) => adjudicate(r, scenario, seed))
  const totalPaid = round2(adjudicated.reduce((sum, a) => sum + a.paidAmount, 0))

  const interchangeControl = 1
  const groupControl = 1
  const txnControl = 1
  const traceNumber = `EFT${String(hashString(`${seed}:${claimRecords.map((r) => r.id).join("|")}`)).padStart(9, "0")}`

  // --- Transaction set body (ST..SE) ---
  const txn: X12Segment[] = []
  txn.push(buildST("835", txnControl))
  txn.push({
    id: "BPR",
    elements: [
      "I", // BPR01 remittance + payment
      formatAmount(totalPaid), // BPR02 total actual payment
      "C", // BPR03 credit
      totalPaid > 0 ? "ACH" : "NON", // BPR04 payment method
      "CCP", // BPR05 payment format
      "", "", "", "", "", "", "", "", "", "", // BPR06-15 banking detail (unused in sim)
      toCCYYMMDD(paymentDateIso), // BPR16 payment effective date
    ],
  })
  txn.push({ id: "TRN", elements: ["1", traceNumber, `1${payerEdiId.padStart(9, "0").slice(0, 9)}`] })
  txn.push({ id: "N1", elements: ["PR", payerName, "PI", payerEdiId] })
  txn.push({ id: "N1", elements: ["PE", "MACH 1 INTEGRATION", "XX", "1234567893"] })
  txn.push({ id: "LX", elements: ["1"] })

  for (const adj of adjudicated) {
    const { record } = adj
    txn.push({
      id: "CLP",
      elements: [
        record.id, // CLP01 patient control number = our CLM01
        adj.statusCode, // CLP02 claim status
        formatAmount(record.billedAmount), // CLP03 charged
        formatAmount(adj.paidAmount), // CLP04 paid
        "0", // CLP05 patient responsibility
        "MC", // CLP06 claim filing indicator
        payerControlNumber(record.id, seed), // CLP07 payer claim control number
      ],
    })

    for (const cas of adj.adjustments) {
      txn.push({ id: "CAS", elements: [cas.groupCode, cas.reasonCode, formatAmount(cas.amount)] })
    }

    const name = splitName(record.snapshot.patientName)
    txn.push({
      id: "NM1",
      elements: [
        "QC", "1",
        name.last.toUpperCase(),
        name.first.toUpperCase(),
        "", "", "",
        "MI",
        record.snapshot.memberId || "UNKNOWN",
      ],
    })

    for (const rarc of adj.rarcCodes) {
      txn.push({ id: "LQ", elements: ["HE", rarc] })
    }
  }

  // SE count includes ST and SE itself
  txn.push(buildSE(txn.length + 1, txnControl))

  // --- Envelope ---
  const segments: X12Segment[] = [
    buildISA({
      senderId: payerEdiId,
      receiverId: "MACH1NAV",
      controlNumber: interchangeControl,
      date: now,
      separators: seps,
    }),
    buildGS({
      functionalCode: "HP",
      senderCode: payerEdiId,
      receiverCode: "MACH1NAV",
      controlNumber: groupControl,
      versionCode: "005010X221A1",
      date: now,
    }),
    ...txn,
    buildGE(1, groupControl),
    buildIEA(1, interchangeControl),
  ]

  return serializeX12(segments, seps)
}
