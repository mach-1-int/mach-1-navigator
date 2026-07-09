/**
 * Navigator onboarding (Gellert ops blitz) — the playbook §10.1 training
 * program as data: Week-1 orientation with the CPSS and Gellert exams,
 * Weeks 2-4 shadowing with a checklist, 30/60/90-day developmental reviews,
 * and certification (Certified Health Navigator: +$2,500 and a level bump).
 *
 * Pure curriculum + progress math; the training module UI (workstream G-7)
 * renders from here.
 */

import type { NavigatorOnboarding, OnboardingMilestoneKey } from "./types"

// ============================================================================
// CURRICULUM (playbook §10.1)
// ============================================================================

export interface CurriculumMilestone {
  key: OnboardingMilestoneKey
  label: string
  description: string
  /** Nominal day of the 90-day developmental period this lands on */
  targetDay: number
}

export const ONBOARDING_CURRICULUM: CurriculumMilestone[] = [
  {
    key: "orientation_week1",
    label: "Week 1 orientation",
    description: "Program, documentation, HIPAA, and field-safety orientation",
    targetDay: 5,
  },
  {
    key: "cpss_exam",
    label: "CPSS exam",
    description: "Certified Peer Support Specialist examination",
    targetDay: 5,
  },
  {
    key: "gellert_exam",
    label: "Gellert exam",
    description: "Gellert SOP and note-manual competency exam",
    targetDay: 5,
  },
  {
    key: "shadowing",
    label: "Weeks 2-4 shadowing",
    description: "Field shadowing with a certified navigator (checklist below)",
    targetDay: 28,
  },
  {
    key: "review_30",
    label: "30-day review",
    description: "First developmental review with supervisor",
    targetDay: 30,
  },
  {
    key: "review_60",
    label: "60-day review",
    description: "Second developmental review — caseload and units ramp check",
    targetDay: 60,
  },
  {
    key: "review_90",
    label: "90-day review",
    description: "Final developmental review — certification readiness",
    targetDay: 90,
  },
  {
    key: "certification",
    label: "Certification",
    description: "Certified Health Navigator: +$2,500 compensation and level bump",
    targetDay: 90,
  },
]

/** Weeks 2-4 shadowing checklist items */
export const SHADOW_CHECKLIST: Array<{ key: string; label: string }> = [
  { key: "shadow_home_visit", label: "Shadowed a home visit" },
  { key: "shadow_transport", label: "Shadowed a transport with in-transit coaching" },
  { key: "shadow_medical_appt", label: "Shadowed a medical appointment (± transit)" },
  { key: "shadow_bh_appt", label: "Shadowed a behavioral health appointment" },
  { key: "shadow_intake", label: "Shadowed an Intake 1 / Intake 2 visit" },
  { key: "shadow_day_close", label: "Completed a day-close (charge slips) alongside a mentor" },
  { key: "solo_note_reviewed", label: "First solo note reviewed against the manual" },
]

/** Certification bonus per playbook §10 comp table */
export const CERTIFICATION_BONUS = 2500

// ============================================================================
// RECORD HELPERS
// ============================================================================

/** A fresh developmental record (all milestones pending, checklist undone) */
export function createOnboardingRecord(
  navigatorId: string,
  startDate: string,
  unitsTargetPhase: number = 16
): NavigatorOnboarding {
  return {
    navigatorId,
    startDate,
    milestones: ONBOARDING_CURRICULUM.map(({ key, label }) => ({ key, label, status: "pending" as const })),
    shadowChecklist: SHADOW_CHECKLIST.map(({ key, label }) => ({ key, label, done: false })),
    status: "developmental",
    unitsTargetPhase,
  }
}

export interface OnboardingProgress {
  completed: number
  total: number
  percent: number // 0-100, rounded
  shadowDone: number
  shadowTotal: number
}

/** Milestone + shadow-checklist progress for a record */
export function onboardingProgress(record: NavigatorOnboarding): OnboardingProgress {
  const total = record.milestones.length
  const completed = record.milestones.filter((m) => m.status === "completed").length
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    shadowDone: record.shadowChecklist.filter((i) => i.done).length,
    shadowTotal: record.shadowChecklist.length,
  }
}

/**
 * The next milestone to work on: the first in-progress milestone in curriculum
 * order, else the first pending one; null when everything is completed.
 */
export function nextMilestone(record: NavigatorOnboarding): NavigatorOnboarding["milestones"][number] | null {
  const byKey = new Map(record.milestones.map((m) => [m.key, m]))
  const ordered = ONBOARDING_CURRICULUM
    .map((c) => byKey.get(c.key))
    .filter((m): m is NavigatorOnboarding["milestones"][number] => !!m)
  return ordered.find((m) => m.status === "in_progress") ?? ordered.find((m) => m.status === "pending") ?? null
}
