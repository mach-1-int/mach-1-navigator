/**
 * EDI 835 Parser (5010 X221 Health Care Claim Payment/Advice)
 *
 * Parses a real 835 remittance file into a structured Remittance835:
 * payment header (BPR/TRN), payer/payee identification (N1), and one
 * RemitClaimPayment per CLP loop with CAS adjustments (CARC codes),
 * NM1*QC patient names, optional SVC service lines, and LQ*HE remark
 * codes (RARC).
 *
 * CLP01 (patient control number) echoes the CLM01 we sent on the 837P,
 * which is ClaimRecord.id — that is the correlation key used downstream
 * by the remittance matcher.
 *
 * Structural failures (no ISA, no ST*835) throw X12ParseError; tolerated
 * irregularities are collected into `warnings`.
 */

import { parseX12, fromCCYYMMDD, X12ParseError } from "./x12"
import type { X12Segment, X12Separators } from "./x12"

export { X12ParseError }

// ============================================================================
// TYPES
// ============================================================================

/** One CAS adjustment triple (group + CARC reason + amount) */
export interface RemitAdjustment {
  groupCode: string // CAS01: CO, PR, OA, PI, CR
  reasonCode: string // CARC, e.g. "45", "197"
  amount: number
}

/** Optional 2110 service line detail */
export interface RemitServiceLine {
  procedureCode: string // from SVC01 composite (qualifier stripped), e.g. "G0023"
  chargedAmount: number // SVC02
  paidAmount: number // SVC03
  units?: number // SVC05
}

/** One 2100 claim payment loop (CLP + children) */
export interface RemitClaimPayment {
  patientControlNumber: string // CLP01 — our 837 CLM01 = ClaimRecord.id
  statusCode: string // CLP02 — 1/2/3 = paid, 4 = denied
  chargedAmount: number // CLP03
  paidAmount: number // CLP04
  patientResponsibility: number // CLP05
  payerClaimControlNumber?: string // CLP07 (payer ICN)
  patientName?: string // NM1*QC, "LAST, FIRST"
  adjustments: RemitAdjustment[] // CAS segments (CARC codes + amounts)
  rarcCodes: string[] // LQ*HE remark codes
  serviceLines: RemitServiceLine[] // SVC segments (optional in many ERAs)
}

/** Parsed 835 remittance advice */
export interface Remittance835 {
  paymentAmount: number // BPR02 total actual payment
  paymentMethod?: string // BPR04 (ACH, CHK, NON, ...)
  paymentDate?: string // BPR16 CCYYMMDD -> ISO date
  traceNumber?: string // TRN02 check / EFT trace number
  payerName?: string // N1*PR
  payeeName?: string // N1*PE
  claims: RemitClaimPayment[]
  warnings: string[] // tolerated irregularities encountered while parsing
}

// ============================================================================
// PARSER
// ============================================================================

/** Parse an element as a monetary amount, warning (not throwing) on garbage */
function parseAmount(
  value: string | undefined,
  context: string,
  warnings: string[]
): number {
  if (value === undefined || value === "") return 0
  const n = Number(value)
  if (Number.isNaN(n)) {
    warnings.push(`Non-numeric amount "${value}" in ${context}; treated as 0`)
    return 0
  }
  return n
}

/** Element accessor: X12 positions are 1-based (el(seg, 1) === CLP01) */
function el(seg: X12Segment, position: number): string | undefined {
  const v = seg.elements[position - 1]
  return v === "" ? undefined : v
}

/** BPR: total payment amount, method, and (optional) payment date. */
function applyBpr(seg: X12Segment, remit: Remittance835, warnings: string[]): void {
  remit.paymentAmount = parseAmount(el(seg, 2), "BPR02", warnings)
  remit.paymentMethod = el(seg, 4)
  const bpr16 = el(seg, 16)
  if (!bpr16) return
  if (/^\d{8}$/.test(bpr16)) {
    remit.paymentDate = fromCCYYMMDD(bpr16)
  } else {
    warnings.push(`BPR16 "${bpr16}" is not CCYYMMDD; payment date omitted`)
  }
}

/** N1: payer (PR) or payee (PE) name. */
function applyN1(seg: X12Segment, remit: Remittance835): void {
  const qualifier = el(seg, 1)
  if (qualifier === "PR") remit.payerName = el(seg, 2)
  else if (qualifier === "PE") remit.payeeName = el(seg, 2)
}

/** CLP: opens a new claim payment loop (or null if CLP01 is missing). */
function buildClaimFromClp(seg: X12Segment, warnings: string[]): RemitClaimPayment | null {
  const patientControlNumber = el(seg, 1)
  if (!patientControlNumber) {
    warnings.push("CLP segment missing CLP01 patient control number; skipped")
    return null
  }
  if (!el(seg, 2)) {
    warnings.push(`CLP for ${patientControlNumber} missing CLP02 status code`)
  }
  return {
    patientControlNumber,
    statusCode: el(seg, 2) ?? "",
    chargedAmount: parseAmount(el(seg, 3), `CLP03 (${patientControlNumber})`, warnings),
    paidAmount: parseAmount(el(seg, 4), `CLP04 (${patientControlNumber})`, warnings),
    patientResponsibility: parseAmount(el(seg, 5), `CLP05 (${patientControlNumber})`, warnings),
    payerClaimControlNumber: el(seg, 7),
    adjustments: [],
    rarcCodes: [],
    serviceLines: [],
  }
}

/** CAS: repeats reason/amount/quantity triples (CAS02-04, CAS05-07, ...) onto the current claim. */
function applyCas(seg: X12Segment, current: RemitClaimPayment | null, warnings: string[]): void {
  if (!current) {
    warnings.push("CAS segment outside a claim loop; ignored")
    return
  }
  const groupCode = el(seg, 1) ?? ""
  for (let pos = 2; pos <= seg.elements.length; pos += 3) {
    const reasonCode = el(seg, pos)
    if (!reasonCode) continue
    current.adjustments.push({
      groupCode,
      reasonCode,
      amount: parseAmount(el(seg, pos + 1), `CAS ${groupCode}*${reasonCode}`, warnings),
    })
  }
}

/** NM1*QC: patient name onto the current claim. */
function applyNm1(seg: X12Segment, current: RemitClaimPayment | null): void {
  if (!current || el(seg, 1) !== "QC") return
  const last = el(seg, 3) ?? ""
  const first = el(seg, 4) ?? ""
  current.patientName = [last, first].filter(Boolean).join(", ")
}

/** SVC: an optional service line onto the current claim (SVC01 composite qualifier is stripped). */
function applySvc(
  seg: X12Segment,
  current: RemitClaimPayment | null,
  separators: X12Separators,
  warnings: string[]
): void {
  if (!current) {
    warnings.push("SVC segment outside a claim loop; ignored")
    return
  }
  const composite = el(seg, 1) ?? ""
  const parts = composite.split(separators.component)
  const procedureCode = parts.length > 1 ? parts[1] : parts[0]
  const line: RemitServiceLine = {
    procedureCode,
    chargedAmount: parseAmount(el(seg, 2), `SVC02 (${procedureCode})`, warnings),
    paidAmount: parseAmount(el(seg, 3), `SVC03 (${procedureCode})`, warnings),
  }
  const units = el(seg, 5)
  if (units !== undefined) {
    const n = Number(units)
    if (!Number.isNaN(n)) line.units = n
  }
  current.serviceLines.push(line)
}

/** LQ*HE: a deduplicated remark (RARC) code onto the current claim. */
function applyLq(seg: X12Segment, current: RemitClaimPayment | null, warnings: string[]): void {
  if (!current) {
    warnings.push("LQ segment outside a claim loop; ignored")
    return
  }
  if (el(seg, 1) !== "HE") return
  const rarc = el(seg, 2)
  if (rarc && !current.rarcCodes.includes(rarc)) current.rarcCodes.push(rarc)
}

/**
 * Parse a 5010 X221 835 remittance advice.
 *
 * @throws X12ParseError when the interchange has no ISA or no ST*835
 */
export function parse835(text: string): Remittance835 {
  const { segments, separators } = parseX12(text)
  const warnings: string[] = []

  const st = segments.find((s) => s.id === "ST")
  if (!st || el(st, 1) !== "835") {
    throw new X12ParseError("Not an 835 remittance: missing ST*835 transaction set")
  }

  const remit: Remittance835 = {
    paymentAmount: 0,
    claims: [],
    warnings,
  }

  let current: RemitClaimPayment | null = null

  for (const seg of segments) {
    switch (seg.id) {
      case "BPR":
        applyBpr(seg, remit, warnings)
        break
      case "TRN":
        remit.traceNumber = el(seg, 2)
        break
      case "N1":
        applyN1(seg, remit)
        break
      case "CLP":
        current = buildClaimFromClp(seg, warnings)
        if (current) remit.claims.push(current)
        break
      case "CAS":
        applyCas(seg, current, warnings)
        break
      case "NM1":
        applyNm1(seg, current)
        break
      case "SVC":
        applySvc(seg, current, separators, warnings)
        break
      case "LQ":
        applyLq(seg, current, warnings)
        break
      default:
        // ISA/GS/ST/SE/GE/IEA envelope, LX headers, REF, DTM, PER etc. — not needed
        break
    }
  }

  if (remit.claims.length === 0) {
    warnings.push("835 contained no CLP claim payment loops")
  }

  return remit
}
