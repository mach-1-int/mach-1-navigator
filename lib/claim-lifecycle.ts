/**
 * Claim Lifecycle Module
 *
 * Governs the post-export life of a claim. Pre-export, claims are DERIVED
 * (recomputed from time logs each render by claims-engine); at export time an
 * immutable ClaimRecord snapshot is persisted and progresses through:
 *
 *   EXPORTED -> SUBMITTED -> ACCEPTED -> PAID
 *                         \-> REJECTED      \-> DENIED
 *
 * REJECTED/DENIED are terminal for a record; reopening voids the record and
 * returns the patient-month to the derived working tabs for rebill (-vN ids).
 */

import type {
  BillableClaim,
  ClaimRecord,
  ClaimRecordStatus,
  ClaimStatus,
  ClaimStatusEvent,
  Payer,
  PayerConfig,
} from "./types"
import { calculateClaimValue } from "./payer-config"

// ============================================================================
// TRANSITION MATRIX
// ============================================================================

/**
 * Legal status transitions for persisted claim records.
 * Derived statuses (DRAFT/NEEDS_ATTENTION/VALIDATED) never transition —
 * they are recomputed; export CREATES a record rather than transitioning one.
 */
export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  DRAFT: [],
  NEEDS_ATTENTION: [],
  VALIDATED: [],
  EXPORTED: ["SUBMITTED"],
  SUBMITTED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["PAID", "DENIED"],
  REJECTED: [], // Terminal; reopen (void + rebill) instead
  PAID: [], // Terminal
  DENIED: [], // Terminal; reopen (void + rebill) instead
}

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return CLAIM_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// RECORD CREATION
// ============================================================================

/**
 * Composite key identifying the patient-month-payer a record covers.
 * Used to exclude actively-tracked claims from the derived working tabs.
 */
export function claimRecordKey(patientId: string, month: string, payerConfigId: string): string {
  return `${patientId}:${month}:${payerConfigId}`
}

/**
 * Keys of all non-voided records — patient-months already in the ledger.
 */
export function getActiveClaimRecordKeys(records: ClaimRecord[]): Set<string> {
  return new Set(
    records
      .filter((r) => !r.voided)
      .map((r) => claimRecordKey(r.snapshot.patientId, r.snapshot.month, r.payerConfigId))
  )
}

/**
 * Patient-months with ANY active record, regardless of payer config.
 * The working tabs must exclude by this key: the same service minutes must
 * never be exportable under a second payer just because the biller switched
 * the payer dropdown (double billing). Format: `${patientId}:${month}`.
 */
export function getActiveClaimMonthKeys(records: ClaimRecord[]): Set<string> {
  return new Set(
    records
      .filter((r) => !r.voided)
      .map((r) => `${r.snapshot.patientId}:${r.snapshot.month}`)
  )
}

export interface CreateClaimRecordsOptions {
  claims: BillableClaim[]
  payers: Payer[]
  payerConfig: PayerConfig
  format: "CSV" | "837P"
  by: string
  existing: ClaimRecord[]
}

/**
 * Create persisted ClaimRecords from derived claims at export time.
 * Rebills of the same patient-month get versioned ids (-v2, -v3, ...) based on
 * how many prior records (voided or not) exist for that source claim.
 */
export function createClaimRecords({
  claims,
  payerConfig,
  format,
  by,
  existing,
}: CreateClaimRecordsOptions): ClaimRecord[] {
  const now = new Date().toISOString()
  const exportBatchId = `batch-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}`

  return claims.map((claim) => {
    const priorVersions = existing.filter((r) => r.sourceClaimId === claim.id).length
    const version = priorVersions + 1
    const billedAmount = calculateClaimValue(claim.primaryUnits, claim.addOnUnits, payerConfig)
    // claim.payerId is the ONLY source of payer identity — a payerConfig maps
    // to many payers (Molina/Mercy/AHCCCS all share medicaid-bh), so guessing
    // from the config would attribute claims to the wrong payer. Claims
    // without a payerId fail validation upstream ("Missing payer assignment")
    // and can't legitimately reach export; "unknown" marks the escape hatch.
    const payerId = claim.payerId ?? "unknown"

    const initialEvent: ClaimStatusEvent = {
      status: "EXPORTED",
      at: now,
      by,
      note: `Exported as ${format} (batch ${exportBatchId})`,
    }

    return {
      id: `${claim.id}-${payerConfig.id}-v${version}`,
      sourceClaimId: claim.id,
      snapshot: { ...claim, status: "VALIDATED", exportedAt: now },
      payerId,
      payerConfigId: payerConfig.id,
      billedAmount,
      status: "EXPORTED",
      statusHistory: [initialEvent],
      exportedAt: now,
      exportFormat: format,
      exportBatchId,
    }
  })
}

/**
 * Apply a status transition to a record, appending to its history.
 * Returns null if the transition is illegal.
 */
export function transitionClaimRecord(
  record: ClaimRecord,
  next: ClaimRecordStatus,
  by: string,
  note?: string
): ClaimRecord | null {
  if (!canTransition(record.status, next)) return null

  const event: ClaimStatusEvent = { status: next, at: new Date().toISOString(), by, note }
  return {
    ...record,
    status: next,
    statusHistory: [...record.statusHistory, event],
    submittedAt: next === "SUBMITTED" ? event.at : record.submittedAt,
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Shared status-chip styling metadata so every surface renders statuses alike.
 */
export function statusChipMeta(status: ClaimStatus): { label: string; colorClasses: string } {
  switch (status) {
    case "DRAFT":
      return { label: "Draft", colorClasses: "bg-muted text-muted-foreground" }
    case "NEEDS_ATTENTION":
      return { label: "Needs Attention", colorClasses: "bg-destructive/10 text-destructive" }
    case "VALIDATED":
      return { label: "Ready to Bill", colorClasses: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    case "EXPORTED":
      return { label: "Exported", colorClasses: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
    case "SUBMITTED":
      return { label: "Submitted", colorClasses: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" }
    case "ACCEPTED":
      return { label: "Accepted", colorClasses: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" }
    case "REJECTED":
      return { label: "Rejected", colorClasses: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" }
    case "PAID":
      return { label: "Paid", colorClasses: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    case "DENIED":
      return { label: "Denied", colorClasses: "bg-destructive/10 text-destructive" }
  }
}
