/**
 * Patient journey engine (Gellert WorkFlow2025 post-conversion phases).
 *
 * Phase is STORED on Patient.journeyPhase; transitions move only through the
 * matrix below (mirroring lib/claim-lifecycle.ts). Adverse Event Response is
 * NOT a stored phase — it is a derived overlay from open adverse events.
 *
 * Owned by workstream J-B after Phase 0 — signatures + matrices are frozen.
 */

import type {
  AdverseEvent,
  ExitPathway,
  IntakeChecklistItem,
  IntakeChecklistKey,
  IntakeVisit,
  JourneyPhase,
  Patient,
} from "./types"
import { localTodayISO } from "./date-rebase"
import { businessDaysBetween } from "./business-days"

// ============================================================================
// PHASE TRANSITION MATRIX
// ============================================================================

export const PHASE_TRANSITIONS: Record<JourneyPhase | "referral", JourneyPhase[]> = {
  referral: ["intake"], // conversion (patient created at agreement)
  intake: ["active", "exited"],
  active: ["telenavigation", "exited"],
  telenavigation: ["active", "exited"], // re-engage or exit
  exited: [], // terminal
}

export function canTransitionPhase(from: JourneyPhase | "referral", to: JourneyPhase): boolean {
  return PHASE_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// PHASE CHIP CONFIG (shared by phase-chip.tsx, journey board, rosters)
// ============================================================================

export interface PhaseChipConfig {
  label: string
  /** Tailwind badge classes consistent with existing risk/status chips */
  className: string
}

export const JOURNEY_PHASE_CONFIG: Record<JourneyPhase, PhaseChipConfig> = {
  intake: { label: "Intake", className: "bg-blue-100 text-blue-700 border-blue-200" },
  active: { label: "Active Navigation", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  telenavigation: { label: "Telenavigation", className: "bg-violet-100 text-violet-700 border-violet-200" },
  exited: { label: "Exited", className: "bg-slate-100 text-slate-600 border-slate-200" },
}

/** Derived adverse-event overlay chip (never a stored phase) */
export const ADVERSE_EVENT_OVERLAY_CONFIG: PhaseChipConfig = {
  label: "Adverse Event",
  className: "bg-red-100 text-red-700 border-red-200",
}

/** Display labels for the five documented program-exit pathways */
export const EXIT_PATHWAY_CONFIG: Record<ExitPathway, { label: string; description: string }> = {
  patient_initiated: {
    label: "Patient-initiated",
    description: "Patient chose to leave the program (requires supervisor confirmation)",
  },
  ineligible: {
    label: "Ineligibility",
    description: "Patient no longer meets program eligibility criteria",
  },
  mia: {
    label: "Missing in action (MIA)",
    description: "Unreachable / repeated no-shows per the closure protocol",
  },
  deceased: {
    label: "Deceased",
    description: "Patient is deceased",
  },
  safety: {
    label: "Safety",
    description: "Exit required for navigator or patient safety",
  },
}

// ============================================================================
// ADVERSE-EVENT OVERLAY (derived)
// ============================================================================

const OPEN_AE_STATUSES: AdverseEvent["status"][] = ["currently_inpatient", "currently_ed", "monitoring"]

/**
 * Adverse Event Response overlay: active when the patient has any open
 * adverse event. Returns the triggering event or null.
 */
export function getAdverseEventOverlay(patient: Patient): AdverseEvent | null {
  return patient.adverseEvents.find((ae) => OPEN_AE_STATUSES.includes(ae.status)) ?? null
}

// ============================================================================
// TELENAVIGATION CADENCE
// ============================================================================

export interface TelenavCheckInStatus {
  nextDue: string // YYYY-MM-DD
  daysUntilDue: number // negative when overdue
  status: "ok" | "due_soon" | "overdue"
}

/**
 * Monthly-cadence check-in status for a telenavigation patient.
 * nextDue = (lastCheckInAt ?? startedAt) + cadenceDays; due_soon within 7 days.
 * Returns null for patients not in telenavigation.
 */
export function telenavCheckInStatus(
  patient: Patient,
  today: string = localTodayISO()
): TelenavCheckInStatus | null {
  const telenav = patient.telenavigation
  if (!telenav || patient.journeyPhase !== "telenavigation") return null

  const baseIso = (telenav.lastCheckInAt ?? telenav.startedAt).slice(0, 10)
  const base = new Date(`${baseIso}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + telenav.cadenceDays)
  const nextDue = base.toISOString().slice(0, 10)

  const msPerDay = 1000 * 60 * 60 * 24
  const daysUntilDue = Math.round(
    (new Date(`${nextDue}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / msPerDay
  )

  return {
    nextDue,
    daysUntilDue,
    status: daysUntilDue < 0 ? "overdue" : daysUntilDue <= 7 ? "due_soon" : "ok",
  }
}

// ============================================================================
// INTAKE 1 & 2 CHECKLIST TEMPLATES
// ============================================================================

export const INTAKE1_CHECKLIST: Array<{ key: IntakeChecklistKey; label: string }> = [
  { key: "onboarding_packet", label: "Onboarding packet completed" },
  { key: "roi_signed", label: "Release of Information signed" },
  { key: "med_reconciliation", label: "Medication reconciliation" },
  { key: "health_history", label: "Health history collected" },
  { key: "provider_list", label: "Provider list compiled" },
  { key: "risk_screening", label: "Risk screening completed" },
  { key: "patient_photo", label: "Patient photo on file" },
  { key: "pcp_scheduled", label: "PCP appointment scheduled" },
]

export const INTAKE2_CHECKLIST: Array<{ key: IntakeChecklistKey; label: string }> = [
  { key: "intake_survey", label: "Intake survey administered" },
  { key: "navigation_contract_signed", label: "Navigation contract signed" },
  { key: "risk_tier_confirmed", label: "Risk tier confirmed" },
]

/** Build a fresh (all-undone) checklist from a template */
export function buildChecklist(
  template: Array<{ key: IntakeChecklistKey; label: string }>
): IntakeChecklistItem[] {
  return template.map(({ key, label }) => ({ key, label, done: false }))
}

/** An intake visit is complete only when every checklist item is done */
export function isIntakeVisitComplete(visit: IntakeVisit): boolean {
  return visit.checklist.length > 0 && visit.checklist.every((item) => item.done)
}

/** The number of intake no-shows that triggers the MIA closure protocol */
export const NO_SHOW_CLOSURE_THRESHOLD = 3

/** Checklist progress for an intake visit (drives progress chips) */
export function intakeChecklistProgress(visit: IntakeVisit): { done: number; total: number } {
  return {
    done: visit.checklist.filter((item) => item.done).length,
    total: visit.checklist.length,
  }
}

// ============================================================================
// PCP-WITHIN-7-BUSINESS-DAYS COUNTDOWN
// ============================================================================

export interface PcpDueStatus {
  dueBy: string // YYYY-MM-DD
  businessDaysRemaining: number // negative when past due
  status: "ok" | "due_soon" | "overdue"
}

/**
 * Countdown against the PCP-within-7-business-days deadline stamped at
 * conversion (IntakeRecord.pcpDueBy). due_soon within 2 business days.
 */
export function pcpDueStatus(pcpDueBy: string, today: string = localTodayISO()): PcpDueStatus {
  const businessDaysRemaining = businessDaysBetween(today, pcpDueBy)
  return {
    dueBy: pcpDueBy,
    businessDaysRemaining,
    status: businessDaysRemaining < 0 ? "overdue" : businessDaysRemaining <= 2 ? "due_soon" : "ok",
  }
}
