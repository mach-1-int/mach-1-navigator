/**
 * Remittance Matcher
 *
 * Correlates parsed 835 claim payments (RemitClaimPayment) back to persisted
 * ClaimRecords and resolves each to PAID or DENIED with a fully-populated
 * RemittanceInfo, ready for the store's applyRemittance action.
 *
 * Match priority per remit claim:
 *   1. CLP01 === ClaimRecord.id            (exact — the 835 echoed our CLM01)
 *   2. CLP01 === ClaimRecord.sourceClaimId (payer echoed the pre-version id)
 *   3. Normalized patient-name match AND billed amount within a cent, for
 *      records still in flight (SUBMITTED/ACCEPTED/EXPORTED, not voided)
 *
 * Voided records never match; each record is consumed by at most one remit
 * claim. The output is a strict superset of the demo-data context's
 * RemittanceApplication shape ({ matches, unmatchedCount } plus the raw
 * unmatched payments for surfacing in the import UI).
 */

import type { ClaimRecord, RemittanceInfo } from "../types"
import type { Remittance835, RemitClaimPayment } from "./edi-835-parser"

// ============================================================================
// TYPES
// ============================================================================

export interface RemittanceMatch {
  claimRecordId: string
  resolvedStatus: "PAID" | "DENIED"
  remittance: RemittanceInfo
}

/**
 * Superset of demo-data-context's RemittanceApplication: `unmatched` carries
 * the raw remit claims that found no home so the UI can list them.
 */
export interface RemittanceMatchResult {
  matches: RemittanceMatch[]
  unmatched: RemitClaimPayment[]
  unmatchedCount: number
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize a person name for order-insensitive comparison:
 * lowercase, split on non-letters, sort tokens. "DOE, JANE" === "Jane Doe".
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .sort()
    .join(" ")
}

/** Statuses eligible for the fuzzy (name + amount) fallback match */
const IN_FLIGHT_STATUSES = new Set(["SUBMITTED", "ACCEPTED", "EXPORTED"])

/** CLP02 1/2/3 = processed/paid; 4 = denied */
function resolveStatus(statusCode: string): "PAID" | "DENIED" {
  return statusCode === "4" ? "DENIED" : "PAID"
}

/** Build the RemittanceInfo persisted onto the claim record */
function buildRemittanceInfo(
  claim: RemitClaimPayment,
  remit: Remittance835,
  eraFileName?: string
): RemittanceInfo {
  const carcCodes: string[] = []
  for (const adj of claim.adjustments) {
    if (!carcCodes.includes(adj.reasonCode)) carcCodes.push(adj.reasonCode)
  }

  return {
    paidAmount: claim.paidAmount,
    chargedAmount: claim.chargedAmount,
    patientResponsibility: claim.patientResponsibility,
    carcCodes,
    rarcCodes: [...claim.rarcCodes],
    payerClaimControlNumber: claim.payerClaimControlNumber,
    checkOrEftNumber: remit.traceNumber,
    remitDate: remit.paymentDate,
    eraFileName,
  }
}

// ============================================================================
// MATCHER
// ============================================================================

/**
 * Match every claim payment in a parsed 835 against the claim-record ledger.
 *
 * @param remit parsed 835 (parse835 output)
 * @param claimRecords the persisted ledger to match against
 * @param eraFileName optional source file name recorded on each RemittanceInfo
 */
export function matchRemittance(
  remit: Remittance835,
  claimRecords: ClaimRecord[],
  eraFileName?: string
): RemittanceMatchResult {
  const matches: RemittanceMatch[] = []
  const unmatched: RemitClaimPayment[] = []
  const consumed = new Set<string>() // record ids already claimed by an earlier CLP

  const candidates = claimRecords.filter((r) => !r.voided)

  for (const claim of remit.claims) {
    const record = findRecord(claim, candidates, consumed)
    if (!record) {
      unmatched.push(claim)
      continue
    }
    consumed.add(record.id)
    matches.push({
      claimRecordId: record.id,
      resolvedStatus: resolveStatus(claim.statusCode),
      remittance: buildRemittanceInfo(claim, remit, eraFileName),
    })
  }

  return { matches, unmatched, unmatchedCount: unmatched.length }
}

/** Apply the three-tier match priority for one remit claim */
function findRecord(
  claim: RemitClaimPayment,
  candidates: ClaimRecord[],
  consumed: Set<string>
): ClaimRecord | undefined {
  const available = candidates.filter((r) => !consumed.has(r.id))

  // Tier 1: exact record id (CLP01 echoes our CLM01)
  const byId = available.find((r) => r.id === claim.patientControlNumber)
  if (byId) return byId

  // Tier 2: payer echoed the unversioned source claim id
  const bySourceId = available.find((r) => r.sourceClaimId === claim.patientControlNumber)
  if (bySourceId) return bySourceId

  // Tier 3: normalized patient name + billed amount within a cent,
  // restricted to records still awaiting adjudication
  if (!claim.patientName) return undefined
  const remitName = normalizeName(claim.patientName)
  if (!remitName) return undefined

  return available.find(
    (r) =>
      IN_FLIGHT_STATUSES.has(r.status) &&
      normalizeName(r.snapshot.patientName) === remitName &&
      Math.abs(r.billedAmount - claim.chargedAmount) < 0.01
  )
}
