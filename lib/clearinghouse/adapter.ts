/**
 * Clearinghouse Adapter
 *
 * Pluggable interface for claim-batch submission. The SimulatedClearinghouse
 * stands in until a real clearinghouse account exists (Availity, Claim.MD,
 * Change Healthcare, ...) — a real adapter implements the same interface and
 * drops in without UI changes.
 */

import type { ClaimRecord } from "../types"

export interface SubmissionResult {
  clearinghouseBatchId: string
  accepted: string[] // claimRecordIds
  rejected: { claimRecordId: string; reason: string }[]
}

export interface ClaimBatch {
  fileName: string
  content: string // 837P or CSV file content
  claimRecords: ClaimRecord[]
}

export interface ClearinghouseAdapter {
  readonly id: string
  readonly name: string
  submit(batch: ClaimBatch): Promise<SubmissionResult>
}

/**
 * Deterministic simulator: accepts everything except records whose member ID
 * was synthesized (starts with "UNK" or contains no real member id), giving
 * the REJECTED path a demoable trigger. ~800ms latency for realism.
 */
export class SimulatedClearinghouse implements ClearinghouseAdapter {
  readonly id = "simulated"
  readonly name = "Simulated Clearinghouse"

  async submit(batch: ClaimBatch): Promise<SubmissionResult> {
    await new Promise((resolve) => setTimeout(resolve, 800))

    const accepted: string[] = []
    const rejected: { claimRecordId: string; reason: string }[] = []

    for (const record of batch.claimRecords) {
      const memberId = record.snapshot.memberId ?? ""
      if (!memberId || memberId.startsWith("UNK")) {
        rejected.push({ claimRecordId: record.id, reason: "Invalid subscriber ID" })
      } else {
        accepted.push(record.id)
      }
    }

    return {
      clearinghouseBatchId: `ch-${Date.now().toString(36)}`,
      accepted,
      rejected,
    }
  }
}

export const defaultClearinghouse: ClearinghouseAdapter = new SimulatedClearinghouse()
