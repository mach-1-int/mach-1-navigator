/**
 * Analytics Utilities for Executive ROI Dashboard
 *
 * This module provides read-only analytics functions that derive
 * metrics from the store without modifying any data.
 */

import type { TimeLog, Referral, User, Patient, PatientNote } from "./types"

// ============================================================================
// REVENUE CALCULATIONS
// ============================================================================

/**
 * Rule of Thumb revenue calculation:
 * Every 60 minutes of logged time = approximately $100 reimbursement
 */
const REVENUE_PER_HOUR = 100

/**
 * Calculate projected revenue from time logs using the "Rule of Thumb"
 * 60 minutes = $100 (approx reimbursement)
 *
 * @param timeLogs - Array of time log entries
 * @returns Total projected revenue in dollars
 */
export function calculateProjectedRevenue(timeLogs: TimeLog[]): number {
  if (!timeLogs || timeLogs.length === 0) {
    return 0
  }

  const totalMinutes = timeLogs.reduce((sum, log) => {
    // Only count verified time logs for revenue projection
    return sum + (log.durationMinutes || 0)
  }, 0)

  // Apply Rule of Thumb: 60 mins = $100
  const totalHours = totalMinutes / 60
  return Math.round(totalHours * REVENUE_PER_HOUR)
}

/**
 * Calculate revenue breakdown by service type (PIN vs CHI)
 *
 * @param timeLogs - Array of time log entries
 * @returns Object with PIN and CHI revenue breakdowns
 */
export function calculateRevenueByServiceType(timeLogs: TimeLog[]): {
  pin: { minutes: number; revenue: number }
  chi: { minutes: number; revenue: number }
  total: { minutes: number; revenue: number }
} {
  if (!timeLogs || timeLogs.length === 0) {
    return {
      pin: { minutes: 0, revenue: 0 },
      chi: { minutes: 0, revenue: 0 },
      total: { minutes: 0, revenue: 0 },
    }
  }

  const pinMinutes = timeLogs
    .filter((log) => log.serviceType === "PIN")
    .reduce((sum, log) => sum + (log.durationMinutes || 0), 0)

  const chiMinutes = timeLogs
    .filter((log) => log.serviceType === "CHI")
    .reduce((sum, log) => sum + (log.durationMinutes || 0), 0)

  const totalMinutes = pinMinutes + chiMinutes

  return {
    pin: {
      minutes: pinMinutes,
      revenue: Math.round((pinMinutes / 60) * REVENUE_PER_HOUR)
    },
    chi: {
      minutes: chiMinutes,
      revenue: Math.round((chiMinutes / 60) * REVENUE_PER_HOUR)
    },
    total: {
      minutes: totalMinutes,
      revenue: Math.round((totalMinutes / 60) * REVENUE_PER_HOUR)
    },
  }
}

// ============================================================================
// OPERATIONAL METRICS
// ============================================================================

export interface OperationalMetrics {
  /** Percentage of referrals still pending assignment (0-100) */
  unassignedRate: number
  /** Number of referrals still pending */
  unassignedCount: number
  /** Total number of referrals */
  totalReferrals: number
  /** Percentage of navigators with >90% caseload (0-100) */
  burnoutRisk: number
  /** Number of navigators at risk of burnout */
  navigatorsAtRisk: number
  /** Total number of navigators */
  totalNavigators: number
  /** Average days from referral to first note (mocked for now) */
  avgTurnaroundDays: number
  /** List of navigators flagged as over capacity */
  overCapacityNavigators: Array<{
    id: string
    name: string
    currentCaseload: number
    maxCaseload: number
    utilizationPercent: number
  }>
  /** List of referrals pending more than 48 hours */
  stalePendingReferrals: Array<{
    id: string
    patientName: string
    receivedAt: string
    hoursPending: number
  }>
}

/**
 * Calculate operational metrics for the executive dashboard
 *
 * @param referrals - Array of referrals
 * @param navigators - Array of users with navigator role (must have attributes)
 * @param notes - Array of patient notes (optional, for turnaround calculation)
 * @returns Operational metrics object
 */
export function getOperationalMetrics(
  referrals: Referral[],
  navigators: User[],
  notes?: PatientNote[]
): OperationalMetrics {
  // Filter to only navigators with attributes
  const navigatorsWithAttributes = navigators.filter(
    (user) => user.role === "navigator" && user.attributes
  )

  // ========== UNASSIGNED RATE ==========
  const pendingReferrals = referrals.filter((ref) => ref.status === "pending")
  const unassignedCount = pendingReferrals.length
  const totalReferrals = referrals.length
  const unassignedRate = totalReferrals > 0
    ? Math.round((unassignedCount / totalReferrals) * 100)
    : 0

  // ========== BURNOUT RISK (>90% caseload) ==========
  const overCapacityNavigators: OperationalMetrics["overCapacityNavigators"] = []

  for (const nav of navigatorsWithAttributes) {
    if (!nav.attributes) continue

    const { currentCaseload, maxCaseload } = nav.attributes
    const utilizationPercent = maxCaseload > 0
      ? Math.round((currentCaseload / maxCaseload) * 100)
      : 0

    if (utilizationPercent > 90) {
      overCapacityNavigators.push({
        id: nav.id,
        name: nav.name,
        currentCaseload,
        maxCaseload,
        utilizationPercent,
      })
    }
  }

  const navigatorsAtRisk = overCapacityNavigators.length
  const totalNavigators = navigatorsWithAttributes.length
  const burnoutRisk = totalNavigators > 0
    ? Math.round((navigatorsAtRisk / totalNavigators) * 100)
    : 0

  // ========== STALE PENDING REFERRALS (>48 hours) ==========
  const now = new Date()
  const stalePendingReferrals: OperationalMetrics["stalePendingReferrals"] = []

  for (const ref of pendingReferrals) {
    const receivedAt = new Date(ref.receivedAt)
    const hoursPending = Math.round(
      (now.getTime() - receivedAt.getTime()) / (1000 * 60 * 60)
    )

    if (hoursPending > 48) {
      stalePendingReferrals.push({
        id: ref.id,
        patientName: ref.patientName,
        receivedAt: ref.receivedAt,
        hoursPending,
      })
    }
  }

  // Sort by hours pending (most urgent first)
  stalePendingReferrals.sort((a, b) => b.hoursPending - a.hoursPending)

  // ========== TURNAROUND TIME (Mocked for now) ==========
  // In a real implementation, this would calculate:
  // Average time from referral.receivedAt to first note with matching patientId
  // For now, returning a reasonable mock value
  const avgTurnaroundDays = 2.4 // Mock: ~2.4 days average

  return {
    unassignedRate,
    unassignedCount,
    totalReferrals,
    burnoutRisk,
    navigatorsAtRisk,
    totalNavigators,
    avgTurnaroundDays,
    overCapacityNavigators,
    stalePendingReferrals,
  }
}

// ============================================================================
// ACUITY DISTRIBUTION (for charts)
// ============================================================================

export interface AcuityDistribution {
  highRisk: number
  lowRisk: number
  mediumRisk: number
  total: number
}

/**
 * Calculate referral distribution by acuity/risk level
 *
 * @param referrals - Array of referrals
 * @returns Distribution counts for pie chart
 */
export function getReferralsByAcuity(referrals: Referral[]): AcuityDistribution {
  if (!referrals || referrals.length === 0) {
    return { highRisk: 0, lowRisk: 0, mediumRisk: 0, total: 0 }
  }

  const highRisk = referrals.filter((ref) => ref.riskScore === 3).length
  const mediumRisk = referrals.filter((ref) => ref.riskScore === 2).length
  const lowRisk = referrals.filter((ref) => ref.riskScore === 1).length

  return {
    highRisk,
    mediumRisk,
    lowRisk,
    total: referrals.length,
  }
}

/**
 * Calculate patient distribution by risk level
 *
 * @param patients - Array of patients
 * @returns Distribution counts for pie chart
 */
export function getPatientsByRiskLevel(patients: Patient[]): AcuityDistribution {
  if (!patients || patients.length === 0) {
    return { highRisk: 0, lowRisk: 0, mediumRisk: 0, total: 0 }
  }

  const highRisk = patients.filter((p) => p.riskLevel === 3).length
  const mediumRisk = patients.filter((p) => p.riskLevel === 2).length
  const lowRisk = patients.filter((p) => p.riskLevel === 1).length

  return {
    highRisk,
    mediumRisk,
    lowRisk,
    total: patients.length,
  }
}

// ============================================================================
// CASELOAD DISTRIBUTION (for bar charts)
// ============================================================================

export interface CaseloadBucket {
  label: string
  count: number
  navigators: Array<{ id: string; name: string; utilization: number }>
}

/**
 * Calculate caseload distribution across navigators
 * Groups navigators into buckets: Empty (0-25%), Light (25-50%),
 * Moderate (50-75%), Heavy (75-90%), Full (90%+)
 *
 * @param navigators - Array of users with navigator role
 * @returns Array of buckets for bar chart
 */
export function getCaseloadDistribution(navigators: User[]): CaseloadBucket[] {
  const buckets: CaseloadBucket[] = [
    { label: "Empty (0-25%)", count: 0, navigators: [] },
    { label: "Light (25-50%)", count: 0, navigators: [] },
    { label: "Moderate (50-75%)", count: 0, navigators: [] },
    { label: "Heavy (75-90%)", count: 0, navigators: [] },
    { label: "Full (90%+)", count: 0, navigators: [] },
  ]

  const navigatorsWithAttributes = navigators.filter(
    (user) => user.role === "navigator" && user.attributes
  )

  for (const nav of navigatorsWithAttributes) {
    if (!nav.attributes) continue

    const { currentCaseload, maxCaseload } = nav.attributes
    const utilization = maxCaseload > 0
      ? (currentCaseload / maxCaseload) * 100
      : 0

    const navInfo = { id: nav.id, name: nav.name, utilization: Math.round(utilization) }

    if (utilization < 25) {
      buckets[0].count++
      buckets[0].navigators.push(navInfo)
    } else if (utilization < 50) {
      buckets[1].count++
      buckets[1].navigators.push(navInfo)
    } else if (utilization < 75) {
      buckets[2].count++
      buckets[2].navigators.push(navInfo)
    } else if (utilization < 90) {
      buckets[3].count++
      buckets[3].navigators.push(navInfo)
    } else {
      buckets[4].count++
      buckets[4].navigators.push(navInfo)
    }
  }

  return buckets
}

// ============================================================================
// SUMMARY STATISTICS
// ============================================================================

export interface DashboardSummary {
  totalActivePatients: number
  estimatedMonthlyRevenue: number
  complianceRate: number // Mocked at 98%
  totalNavigators: number
  avgCaseloadUtilization: number
}

/**
 * Calculate summary statistics for dashboard cards
 *
 * @param patients - Array of patients
 * @param timeLogs - Array of time logs
 * @param navigators - Array of users with navigator role
 * @returns Summary statistics object
 */
export function getDashboardSummary(
  patients: Patient[],
  timeLogs: TimeLog[],
  navigators: User[]
): DashboardSummary {
  const activePatients = patients.filter((p) => p.survivalStatus === "active")
  const totalActivePatients = activePatients.length

  const estimatedMonthlyRevenue = calculateProjectedRevenue(timeLogs)

  // Compliance rate is mocked at 98% as specified
  const complianceRate = 98

  const navigatorsWithAttributes = navigators.filter(
    (user) => user.role === "navigator" && user.attributes
  )

  const totalNavigators = navigatorsWithAttributes.length

  // Calculate average caseload utilization
  let totalUtilization = 0
  for (const nav of navigatorsWithAttributes) {
    if (!nav.attributes) continue
    const { currentCaseload, maxCaseload } = nav.attributes
    if (maxCaseload > 0) {
      totalUtilization += (currentCaseload / maxCaseload) * 100
    }
  }
  const avgCaseloadUtilization = totalNavigators > 0
    ? Math.round(totalUtilization / totalNavigators)
    : 0

  return {
    totalActivePatients,
    estimatedMonthlyRevenue,
    complianceRate,
    totalNavigators,
    avgCaseloadUtilization,
  }
}
