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

/** Pipeline display order: working statuses first, then terminal closes */
export const REFERRAL_PIPELINE_ORDER: ReferralStatus[] = [
  "received",
  "accepted",
  "outreach",
  "agreed",
  "intake_scheduled",
  "converted",
  "ineligible",
  "unreachable",
  "declined",
]

/** Status chip metadata (mirrors statusChipMeta in lib/claim-lifecycle.ts) */
export function referralStatusMeta(status: ReferralStatus): { label: string; colorClasses: string } {
  switch (status) {
    case "received":
      return { label: "Received", colorClasses: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
    case "ineligible":
      return { label: "Ineligible", colorClasses: "bg-destructive/10 text-destructive" }
    case "accepted":
      return { label: "Accepted — Contact Due", colorClasses: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
    case "outreach":
      return { label: "Outreach", colorClasses: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" }
    case "unreachable":
      return { label: "Unreachable", colorClasses: "bg-muted text-muted-foreground" }
    case "declined":
      return { label: "Declined", colorClasses: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" }
    case "agreed":
      return { label: "Agreed", colorClasses: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    case "intake_scheduled":
      return { label: "Intake Scheduled", colorClasses: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" }
    case "converted":
      return { label: "Converted", colorClasses: "bg-primary/10 text-primary" }
  }
}

export const INELIGIBILITY_REASON_LABELS: Record<IneligibilityReason, string> = {
  insurance: "Insurance not verified",
  out_of_service_area: "Out of service area",
  no_medical_need: "No documented medical need",
  level_of_care: "Level of care not appropriate",
  age: "Age ineligible",
}

export const OUTREACH_CHANNEL_LABELS: Record<OutreachAttempt["channel"], string> = {
  phone: "Phone",
  text: "Text",
  in_person: "In person",
}

export const OUTREACH_DISPOSITION_LABELS: Record<OutreachAttempt["disposition"], string> = {
  no_answer: "No answer",
  voicemail: "Voicemail",
  wrong_number: "Wrong number",
  callback_requested: "Callback requested",
  declined: "Declined",
  agreed: "Agreed",
}

// ============================================================================
// ELIGIBILITY (5-gate short-circuit decision tree)
// ============================================================================

export type EligibilityGateKey = keyof Pick<
  EligibilityCheck,
  "insuranceVerified" | "inServiceArea" | "medicalNeedConfirmed" | "levelOfCareAppropriate" | "ageEligible"
>

/** Gate order matters: the FIRST failing gate names the ineligibility reason */
export const ELIGIBILITY_GATES: Array<{
  key: EligibilityGateKey
  reason: IneligibilityReason
  label: string
  question: string
}> = [
  { key: "insuranceVerified", reason: "insurance", label: "Insurance", question: "AHCCCS / accepted plan verified?" },
  { key: "inServiceArea", reason: "out_of_service_area", label: "Service area", question: "Patient lives inside the coverage area?" },
  { key: "medicalNeedConfirmed", reason: "no_medical_need", label: "Medical need", question: "Referral documents a qualifying medical need?" },
  { key: "levelOfCareAppropriate", reason: "level_of_care", label: "Level of care", question: "Peer-support navigation is the right level of care?" },
  { key: "ageEligible", reason: "age", label: "Age", question: "Patient meets the adult age requirement?" },
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
