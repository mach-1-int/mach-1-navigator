/**
 * Referral pipeline engine (Gellert WorkFlow2025 front-of-funnel).
 *
 * Pure module mirroring lib/claim-lifecycle.ts: an explicit transition matrix,
 * the 5-gate eligibility decision tree, the 7-attempt outreach engine, and the
 * 24-48h first-contact SLA clock. Context actions in demo-data-context.tsx are
 * thin wrappers over these functions; verify:journey imports them raw.
 *
 * Owned by workstream J-A after Phase 0 — signatures are frozen.
 */

import type {
  EligibilityCheck,
  IneligibilityReason,
  OutreachAttempt,
  Referral,
  ReferralStatus,
} from "./types"

// ============================================================================
// TRANSITION MATRIX
// ============================================================================

export const REFERRAL_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  received: ["accepted", "ineligible"],
  ineligible: [], // terminal
  accepted: ["outreach", "agreed", "declined"],
  outreach: ["outreach", "agreed", "declined", "unreachable"],
  unreachable: [], // terminal
  declined: [], // terminal
  agreed: ["intake_scheduled", "converted"],
  intake_scheduled: ["converted"],
  converted: [], // terminal success
}

/** Statuses that end a referral's pipeline life */
export const TERMINAL_REFERRAL_STATUSES: ReferralStatus[] = [
  "converted",
  "ineligible",
  "unreachable",
  "declined",
]

export function isTerminalReferralStatus(status: ReferralStatus): boolean {
  return TERMINAL_REFERRAL_STATUSES.includes(status)
}

export function canTransitionReferral(from: ReferralStatus, to: ReferralStatus): boolean {
  return REFERRAL_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// ELIGIBILITY (5-gate short-circuit decision tree)
// ============================================================================

/** Gate order matters: the FIRST failing gate names the ineligibility reason */
const ELIGIBILITY_GATES: Array<{
  key: keyof Pick<
    EligibilityCheck,
    "insuranceVerified" | "inServiceArea" | "medicalNeedConfirmed" | "levelOfCareAppropriate" | "ageEligible"
  >
  reason: IneligibilityReason
}> = [
  { key: "insuranceVerified", reason: "insurance" },
  { key: "inServiceArea", reason: "out_of_service_area" },
  { key: "medicalNeedConfirmed", reason: "no_medical_need" },
  { key: "levelOfCareAppropriate", reason: "level_of_care" },
  { key: "ageEligible", reason: "age" },
]

/**
 * Evaluate the 5-gate eligibility checklist. Short-circuits on the first "no",
 * returning the mapped ineligibility reason; all-yes yields "eligible".
 */
export function evaluateEligibility(
  check: Pick<
    EligibilityCheck,
    "insuranceVerified" | "inServiceArea" | "medicalNeedConfirmed" | "levelOfCareAppropriate" | "ageEligible"
  >
): { outcome: "eligible" | "ineligible"; ineligibilityReason?: IneligibilityReason } {
  for (const gate of ELIGIBILITY_GATES) {
    if (!check[gate.key]) {
      return { outcome: "ineligible", ineligibilityReason: gate.reason }
    }
  }
  return { outcome: "eligible" }
}

// ============================================================================
// OUTREACH ENGINE (max 7 attempts, then auto-close unreachable)
// ============================================================================

export const MAX_OUTREACH_ATTEMPTS = 7

/** Attempts left before the auto-close protocol fires */
export function attemptsRemaining(referral: Referral): number {
  return Math.max(0, MAX_OUTREACH_ATTEMPTS - (referral.outreachAttempts?.length ?? 0))
}

/**
 * Resolve the referral's next status after logging `attempt`.
 * - disposition "agreed" -> agreed (fast path at any attempt number)
 * - disposition "declined" -> declined
 * - 7th unsuccessful attempt -> unreachable (auto-close, provider informed)
 * - otherwise -> outreach
 * Attempts beyond 7 are rejected: the current (terminal) status is returned
 * unchanged and the caller must not append the attempt.
 */
export function applyOutreachAttempt(
  referral: Referral,
  attempt: Pick<OutreachAttempt, "attemptNumber" | "disposition">
): ReferralStatus {
  if (isTerminalReferralStatus(referral.status)) return referral.status
  if (attempt.attemptNumber > MAX_OUTREACH_ATTEMPTS) return referral.status

  if (attempt.disposition === "agreed") return "agreed"
  if (attempt.disposition === "declined") return "declined"
  if (attempt.attemptNumber >= MAX_OUTREACH_ATTEMPTS) return "unreachable"
  return "outreach"
}

// ============================================================================
// FIRST-CONTACT SLA (24-48h from eligibility acceptance)
// ============================================================================

export interface OutreachSla {
  hoursSinceAccepted: number
  status: "on_time" | "due" | "breached"
}

/** SLA clock: <24h on_time, 24-48h due, >48h breached (from acceptedAt) */
export function outreachSla(referral: Referral, now: Date = new Date()): OutreachSla {
  if (!referral.acceptedAt) return { hoursSinceAccepted: 0, status: "on_time" }
  const hours = (now.getTime() - new Date(referral.acceptedAt).getTime()) / (1000 * 60 * 60)
  const hoursSinceAccepted = Math.max(0, Math.round(hours * 10) / 10)
  if (hoursSinceAccepted >= 48) return { hoursSinceAccepted, status: "breached" }
  if (hoursSinceAccepted >= 24) return { hoursSinceAccepted, status: "due" }
  return { hoursSinceAccepted, status: "on_time" }
}
