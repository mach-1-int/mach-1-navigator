/**
 * Analytics Utilities for Executive ROI Dashboard
 *
 * This module provides read-only analytics functions that derive
 * metrics from the store without modifying any data.
 */

import type {
  IntakeRecord,
  Navigator,
  Patient,
  PayerConfig,
  Referral,
  TimeLog,
  User,
} from "./types"
import { generateMonthlyClaims, calculateTotalRevenue, filterClaimsByMonth } from "./claims-engine"
import { localCurrentMonth } from "./date-rebase"

// ============================================================================
// REVENUE CALCULATIONS
// ============================================================================

/**
 * Calculate estimated revenue for the CURRENT billing month by generating
 * claims from time logs and pricing them with the active payer's rate card.
 *
 * @param navigators - Array of navigators (for claim generation)
 * @param patients - Array of patients
 * @param timeLogs - Array of time log entries
 * @param intakeRecords - Intake records (consent, initiating visit, Z-codes)
 * @param payerConfig - Active payer configuration
 * @returns Total estimated claim value for the current billing month
 */
export function calculateEstimatedMonthlyRevenue(
  navigators: Navigator[],
  patients: Patient[],
  timeLogs: TimeLog[],
  intakeRecords: IntakeRecord[],
  payerConfig: PayerConfig
): number {
  if (!timeLogs || timeLogs.length === 0) {
    return 0
  }

  const claims = generateMonthlyClaims(navigators, patients, timeLogs, payerConfig, intakeRecords)
  // Local-calendar month (UTC would flip a month early for evening users);
  // fall back to the latest month on record when the current month is empty.
  const currentMonth = localCurrentMonth()
  const months = [...new Set(claims.map((c) => c.month))].sort()
  const reportMonth = months.includes(currentMonth)
    ? currentMonth
    : months.filter((m) => m <= currentMonth).pop() ?? currentMonth
  const currentMonthClaims = filterClaimsByMonth(claims, reportMonth)
  const { totalValue } = calculateTotalRevenue(currentMonthClaims, payerConfig)

  return Math.round(totalValue)
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
  /** Average days from referral received to accepted; null when no accepted referrals */
  avgTurnaroundDays: number | null
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
 * @returns Operational metrics object
 */
export function getOperationalMetrics(
  referrals: Referral[],
  navigators: User[]
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

  // ========== TURNAROUND TIME ==========
  // Mean days from referral.receivedAt to referral.acceptedAt over accepted
  // referrals; null when there is nothing to compute.
  const turnaroundDurations: number[] = []
  for (const ref of referrals) {
    if (!ref.acceptedAt) continue
    const receivedMs = new Date(ref.receivedAt).getTime()
    const acceptedMs = new Date(ref.acceptedAt).getTime()
    if (Number.isNaN(receivedMs) || Number.isNaN(acceptedMs) || acceptedMs < receivedMs) continue
    turnaroundDurations.push((acceptedMs - receivedMs) / (1000 * 60 * 60 * 24))
  }
  const avgTurnaroundDays = turnaroundDurations.length > 0
    ? Math.round((turnaroundDurations.reduce((sum, d) => sum + d, 0) / turnaroundDurations.length) * 10) / 10
    : null

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
  /** Percentage of time logs verified by a supervisor (0-100; 100 when no logs) */
  complianceRate: number
  totalNavigators: number
  avgCaseloadUtilization: number
}

/**
 * Calculate summary statistics for dashboard cards
 *
 * @param navigators - Array of navigators (for claim generation)
 * @param patients - Array of patients
 * @param timeLogs - Array of time logs
 * @param intakeRecords - Intake records (consent, initiating visit, Z-codes)
 * @param payerConfig - Active payer configuration
 * @param navigatorUsers - Array of users with navigator role (for caseload stats)
 * @returns Summary statistics object
 */
export function getDashboardSummary(
  navigators: Navigator[],
  patients: Patient[],
  timeLogs: TimeLog[],
  intakeRecords: IntakeRecord[],
  payerConfig: PayerConfig,
  navigatorUsers: User[]
): DashboardSummary {
  const activePatients = patients.filter((p) => p.survivalStatus === "active")
  const totalActivePatients = activePatients.length

  const estimatedMonthlyRevenue = calculateEstimatedMonthlyRevenue(
    navigators,
    patients,
    timeLogs,
    intakeRecords,
    payerConfig
  )

  // Time-log verification rate: % of logs verified by a supervisor
  const verifiedLogs = timeLogs.filter((log) => log.verified === true).length
  const complianceRate = timeLogs.length > 0
    ? Math.round((verifiedLogs / timeLogs.length) * 100)
    : 100

  const navigatorsWithAttributes = navigatorUsers.filter(
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
