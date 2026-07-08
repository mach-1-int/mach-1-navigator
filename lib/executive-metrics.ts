/**
 * Executive Metrics
 *
 * Pure functions that compute every number on the executive dashboard from
 * live store slices (patients, navigators, referrals, time logs, payers).
 * No React here — these are backend-portable aggregations.
 */

import type {
  AdverseEvent,
  Appointment,
  BillingData,
  HealthPlanRevenue,
  IntakeRecord,
  Navigator,
  Patient,
  Payer,
  PayerConfig,
  PerformanceData,
  Referral,
  ReferralSource,
  TimeLog,
} from "./types"
import {
  generateMonthlyClaims,
  calculateTotalRevenue,
  filterClaimsByMonth,
  getAvailableMonths,
} from "./claims-engine"
import { calculateBillingUnits, getPayerForPatient } from "./payer-config"
import { localCurrentMonth } from "./date-rebase"

// ============================================================================
// PROGRAM TARGETS
// ============================================================================

/**
 * Organization-wide program targets. These were previously scattered across
 * the static kpiMetrics seed and hardcoded chart/tier thresholds.
 */
export const PROGRAM_TARGETS = {
  /** Monthly billable units expected per navigator */
  monthlyUnitsPerNavigator: 280,
  /** Medication compliance target (%) */
  medicationCompliance: 95,
  /** PCP follow-up compliance target (%) */
  pcpCompliance: 90,
  /** High-Five patient satisfaction target (%) */
  highFive: 85,
} as const

/** Navigators below this monthly-unit count are flagged as low performers */
export const LOW_PERFORMER_UNITS = 220

/**
 * Daily billing-units target for the daily chart. The legacy chart plotted
 * daily units against the MONTHLY 280-unit target; a sensible daily line is
 * the monthly per-navigator target spread over ~22 workdays (280 / 22 ≈ 13).
 */
export const DAILY_UNITS_TARGET = Math.round(
  PROGRAM_TARGETS.monthlyUnitsPerNavigator / 22
)

// ============================================================================
// HELPERS
// ============================================================================

/** Month ("YYYY-MM") a time log bills under */
function logMonth(log: TimeLog): string {
  return log.billingPeriod || log.date.slice(0, 7)
}

/**
 * Resolve the billing month to report on: the current calendar month when it
 * has claims/logs, otherwise the latest month on record. (Rebased seed data
 * can land mostly in the prior calendar month early in a real month.)
 */
function resolveBillingMonth(monthsOnRecord: string[]): string {
  const currentMonth = localCurrentMonth()
  if (monthsOnRecord.includes(currentMonth)) return currentMonth
  const past = monthsOnRecord.filter((m) => m <= currentMonth).sort()
  return past.length > 0 ? past[past.length - 1] : currentMonth
}

// ============================================================================
// REVENUE
// ============================================================================

export interface RevenueBreakdown {
  /** Estimated value of the billing month's claims (time logs × payer rules) */
  claimsRevenue: number
  /** Completed appointments × resolved payer rate (calculateDynamicRevenue) */
  appointmentRevenue: number
  /** claimsRevenue + appointmentRevenue */
  total: number
  /** Billing month the claims figure covers ("YYYY-MM") */
  month: string
  /** Number of claims priced into claimsRevenue */
  claimCount: number
}

export interface ComputeRevenueOptions {
  navigators: Navigator[]
  patients: Patient[]
  timeLogs: TimeLog[]
  intakeRecords: IntakeRecord[]
  payerConfig: PayerConfig
  appointments: Appointment[]
  payers: Payer[]
}

/**
 * Compute estimated revenue for the current billing month:
 * claims value (generateMonthlyClaims + calculateTotalRevenue) plus
 * appointment-driven revenue (completed appointments × payer ratePerUnit).
 */
export function computeRevenue({
  navigators,
  patients,
  timeLogs,
  intakeRecords,
  payerConfig,
  appointments,
  payers,
}: ComputeRevenueOptions): RevenueBreakdown {
  const claims = generateMonthlyClaims(
    navigators,
    patients,
    timeLogs,
    payerConfig,
    intakeRecords
  )
  const month = resolveBillingMonth(getAvailableMonths(claims))
  const monthClaims = filterClaimsByMonth(claims, month)
  const { totalValue, claimCount } = calculateTotalRevenue(monthClaims, payerConfig)

  const patientById = new Map(patients.map((p) => [p.id, p]))
  let appointmentRevenue = 0
  for (const apt of appointments) {
    if (apt.status !== "completed") continue
    const patient = patientById.get(apt.patientId)
    if (!patient) continue
    appointmentRevenue += getPayerForPatient(payers, patient)?.ratePerUnit ?? 0
  }

  const claimsRevenue = Math.round(totalValue)
  appointmentRevenue = Math.round(appointmentRevenue)

  return {
    claimsRevenue,
    appointmentRevenue,
    total: claimsRevenue + appointmentRevenue,
    month,
    claimCount,
  }
}

// ============================================================================
// DAILY BILLING UNITS
// ============================================================================

/**
 * Group the current billing month's time logs by day and convert minutes to
 * billable units with the active payer's rules. Target is the per-navigator
 * DAILY target (monthly target / ~22 workdays), not the legacy monthly 280.
 */
export function computeDailyUnits(
  timeLogs: TimeLog[],
  payerConfig: PayerConfig
): BillingData[] {
  const month = resolveBillingMonth([...new Set(timeLogs.map(logMonth))])
  const minutesByDate = new Map<string, number>()

  for (const log of timeLogs) {
    if (logMonth(log) !== month) continue
    minutesByDate.set(log.date, (minutesByDate.get(log.date) || 0) + log.durationMinutes)
  }

  return [...minutesByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => {
      const { primaryUnits, addOnUnits } = calculateBillingUnits(minutes, payerConfig)
      return {
        date: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        units: primaryUnits + addOnUnits,
        target: DAILY_UNITS_TARGET,
      }
    })
}

// ============================================================================
// REFERRAL SOURCES
// ============================================================================

/**
 * Count referrals by source. A source trends "up" when it produced a referral
 * in the last 7 days (rebased seed data keeps recent referrals recent).
 */
export function computeReferralSources(referrals: Referral[]): ReferralSource[] {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const bySource = new Map<string, { count: number; recent: boolean }>()

  for (const referral of referrals) {
    const source = referral.referralSource || referral.source
    const entry = bySource.get(source) || { count: 0, recent: false }
    entry.count++
    const receivedMs = new Date(referral.receivedAt || referral.referralDate).getTime()
    if (!Number.isNaN(receivedMs) && receivedMs >= sevenDaysAgo) entry.recent = true
    bySource.set(source, entry)
  }

  return [...bySource.entries()]
    .map(([name, { count, recent }]) => ({
      name,
      count,
      trend: (recent ? "up" : "stable") as ReferralSource["trend"],
    }))
    .sort((a, b) => b.count - a.count)
}

// ============================================================================
// REVENUE BY HEALTH PLAN
// ============================================================================

/**
 * Group ACTIVE patients by health plan; revenue = patient count × the
 * resolved payer's ratePerUnit. Chart color tokens are assigned in order.
 */
export function computeHealthPlanRevenue(
  patients: Patient[],
  payers: Payer[]
): HealthPlanRevenue[] {
  const byPlan = new Map<string, { patientCount: number; revenue: number }>()

  for (const patient of patients) {
    if (patient.survivalStatus !== "active") continue
    const plan = patient.healthPlan || "Unknown"
    const entry = byPlan.get(plan) || { patientCount: 0, revenue: 0 }
    entry.patientCount++
    entry.revenue += getPayerForPatient(payers, patient)?.ratePerUnit ?? 0
    byPlan.set(plan, entry)
  }

  return [...byPlan.entries()]
    .map(([planName, { patientCount, revenue }]) => ({
      planName,
      pmpmRevenue: Math.round(revenue),
      patientCount,
    }))
    .sort((a, b) => b.pmpmRevenue - a.pmpmRevenue)
    .map((plan, index) => ({
      ...plan,
      color: `hsl(var(--chart-${(index % 5) + 1}))`,
    }))
}

// ============================================================================
// NAVIGATOR PERFORMANCE
// ============================================================================

/**
 * Tier every navigator by monthly units:
 * top ≥ 280 (monthly target), standard ≥ 220, low < 220.
 */
export function computePerformanceData(navigators: Navigator[]): PerformanceData[] {
  return navigators.map((nav) => ({
    name: nav.name,
    units: nav.monthlyUnits,
    lengthOfService: nav.lengthOfService,
    tier:
      nav.monthlyUnits >= PROGRAM_TARGETS.monthlyUnitsPerNavigator
        ? "top"
        : nav.monthlyUnits >= LOW_PERFORMER_UNITS
          ? "standard"
          : "low",
  }))
}

// ============================================================================
// CENSUS & MISC KPIS
// ============================================================================

export interface CensusSummary {
  active: number
  total: number
}

/** Active vs total patient census */
export function computeCensus(patients: Patient[]): CensusSummary {
  return {
    active: patients.filter((p) => p.survivalStatus === "active").length,
    total: patients.length,
  }
}

/**
 * Mean months since enrollment across active patients. Enrollment dates are
 * frozen by the date rebase, so this grows naturally over time.
 */
export function avgEngagementMonths(patients: Patient[]): number {
  const active = patients.filter((p) => p.survivalStatus === "active")
  if (active.length === 0) return 0

  const now = Date.now()
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
  const totalMonths = active.reduce((sum, p) => {
    const enrolledMs = new Date(p.enrollmentDate).getTime()
    if (Number.isNaN(enrolledMs)) return sum
    return sum + Math.max(0, (now - enrolledMs) / msPerMonth)
  }, 0)

  return Math.round(totalMonths / active.length)
}

/** Count of active patients at the highest risk level (L3) */
export function highRiskCount(patients: Patient[]): number {
  return patients.filter((p) => p.survivalStatus === "active" && p.riskLevel === 3).length
}

export interface AdverseEventsSummary {
  total: number
  currentInpatients: number
}

/** Adverse event totals for the alert card */
export function computeAdverseEventsSummary(
  adverseEvents: AdverseEvent[]
): AdverseEventsSummary {
  return {
    total: adverseEvents.length,
    currentInpatients: adverseEvents.filter((ae) => ae.status === "currently_inpatient")
      .length,
  }
}

/** Mean monthly units across navigators */
export function avgUnitsPerNavigator(navigators: Navigator[]): number {
  if (navigators.length === 0) return 0
  return Math.round(
    navigators.reduce((sum, n) => sum + n.monthlyUnits, 0) / navigators.length
  )
}
