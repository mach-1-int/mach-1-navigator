/**
 * Claims Engine - Revenue Cycle Management
 *
 * Supports payer-agnostic billing with two billing models:
 *
 * 1. Medicaid Behavioral Health (H-codes, 15-min increments, Rule of Eights):
 *    - H0038: Self-help/peer services
 *    - H2015: Comprehensive Community Support
 *    - H0023: Behavioral health outreach
 *    - 8+ minutes = 1 unit (Rule of Eights)
 *
 * 2. Medicare PIN/CHI (G-codes, 60-min base + 30-min add-on):
 *    - PIN: G0023 (base) + G0024 (add-on)
 *    - CHI: G0019 (base) + G0022 (add-on)
 *    - 60 minutes minimum for base code
 */

import type {
  BillableClaim,
  TimeLog,
  Patient,
  Navigator,
  ServiceType,
  PayerConfig,
} from "./types"

import {
  calculateBillingUnits as calculateUnitsFromConfig,
  calculateClaimValue as calculateValueFromConfig,
  getHCodeForActivity,
  getPayerConfig,
  DEFAULT_PAYER_CONFIG_ID,
  PAYER_CONFIGS,
} from "./payer-config"

/**
 * G-code mappings by service type (for backward compatibility)
 */
const G_CODES: Record<ServiceType, { base: string; addOn: string }> = {
  PIN: { base: "G0023", addOn: "G0024" },
  CHI: { base: "G0019", addOn: "G0022" },
}

/**
 * Legacy billing thresholds (for backward compatibility)
 * Use PayerConfig.baseMinimum and unitIncrement instead
 */
const BILLING_THRESHOLDS = {
  BASE_MINIMUM: 60,
  ADD_ON_INCREMENT: 30,
}

/**
 * Legacy revenue rates (for backward compatibility)
 * Use PayerConfig.revenueRates instead
 */
export const REVENUE_RATES = {
  BASE_UNIT: 125.00,    // $125 per base unit (60 min) - Medicare
  ADD_ON_UNIT: 62.50,   // $62.50 per add-on unit (30 min) - Medicare
}

/**
 * Generate a unique claim ID
 */
function generateClaimId(patientId: string, month: string): string {
  return `claim-${patientId}-${month}`
}

/**
 * Extract month (YYYY-MM) from a date string
 */
function extractMonth(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/**
 * Group time logs by patient ID and month
 */
function groupTimeLogsByPatientAndMonth(
  timeLogs: TimeLog[]
): Map<string, TimeLog[]> {
  const grouped = new Map<string, TimeLog[]>()

  for (const log of timeLogs) {
    // Include all time logs so under-threshold claims appear in "Needs Attention"
    const month = log.billingPeriod || extractMonth(log.date)
    const key = `${log.patientId}:${month}`

    const existing = grouped.get(key) || []
    existing.push(log)
    grouped.set(key, existing)
  }

  return grouped
}

/**
 * Calculate billing units from total minutes
 * Supports both legacy Medicare logic and payer-agnostic billing
 *
 * @param totalMinutes Total minutes of service
 * @param payerConfig Optional payer configuration (defaults to Medicare CHI for backward compatibility)
 */
export function calculateBillingUnits(
  totalMinutes: number,
  payerConfig?: PayerConfig
): {
  primaryUnits: number
  addOnUnits: number
} {
  // If payer config provided, use the unified calculator
  if (payerConfig) {
    return calculateUnitsFromConfig(totalMinutes, payerConfig)
  }

  // Legacy behavior for backward compatibility (Medicare 60-minute rule)
  if (totalMinutes < BILLING_THRESHOLDS.BASE_MINIMUM) {
    return { primaryUnits: 0, addOnUnits: 0 }
  }

  // Base code covers first 60 minutes = 1 unit
  const primaryUnits = 1

  // Add-on units for each additional 30 minutes
  const remainingMinutes = totalMinutes - BILLING_THRESHOLDS.BASE_MINIMUM
  const addOnUnits = Math.floor(remainingMinutes / BILLING_THRESHOLDS.ADD_ON_INCREMENT)

  return { primaryUnits, addOnUnits }
}

/**
 * Calculate estimated revenue for a claim
 * Supports both legacy Medicare rates and payer-agnostic billing
 *
 * @param primaryUnits Number of base code units
 * @param addOnUnits Number of add-on code units
 * @param payerConfig Optional payer configuration (defaults to Medicare rates)
 */
export function calculateClaimValue(
  primaryUnits: number,
  addOnUnits: number,
  payerConfig?: PayerConfig
): number {
  // If payer config provided, use its rates
  if (payerConfig) {
    return calculateValueFromConfig(primaryUnits, addOnUnits, payerConfig)
  }

  // Legacy behavior for backward compatibility (Medicare rates)
  return (primaryUnits * REVENUE_RATES.BASE_UNIT) + (addOnUnits * REVENUE_RATES.ADD_ON_UNIT)
}

/**
 * Validate claim data and return any errors
 * Supports payer-specific thresholds (8 min for Medicaid, 60 min for Medicare)
 *
 * @param patient Patient record
 * @param totalMinutes Total minutes of service
 * @param payerConfig Payer configuration for threshold validation
 */
function validateClaimData(
  patient: Patient | undefined,
  totalMinutes: number,
  payerConfig?: PayerConfig
): string[] {
  const errors: string[] = []

  if (!patient) {
    errors.push("Patient record not found")
    return errors
  }

  // Get threshold from payer config or use legacy Medicare threshold
  const minThreshold = payerConfig?.baseMinimum ?? BILLING_THRESHOLDS.BASE_MINIMUM
  const thresholdLabel = payerConfig?.useRuleOfEights ? "8" : "60"

  // Check for minimum time requirement
  if (totalMinutes < minThreshold) {
    errors.push(`Insufficient Time (${totalMinutes}/${minThreshold} mins)`)
  }

  // Check for member ID (insurance ID)
  // In demo, we'll derive from patient ID or health plan
  const hasMemberId = patient.healthPlan && patient.healthPlan.length > 0

  if (!hasMemberId) {
    errors.push("Missing insurance/member ID")
  }

  // Check for diagnosis codes
  if (!patient.icdCodes || patient.icdCodes.length === 0) {
    // Also check primaryDiagnosis as a fallback
    if (!patient.primaryDiagnosis) {
      errors.push("Missing diagnosis codes (ICD-10)")
    }
  }

  return errors
}

/**
 * Get the primary navigator from time logs (most minutes logged)
 */
function getPrimaryNavigator(timeLogs: TimeLog[]): string {
  const navigatorMinutes = new Map<string, number>()

  for (const log of timeLogs) {
    const current = navigatorMinutes.get(log.navigatorId) || 0
    navigatorMinutes.set(log.navigatorId, current + log.durationMinutes)
  }

  let primaryNavigatorId = timeLogs[0]?.navigatorId || ""
  let maxMinutes = 0

  for (const [navId, minutes] of navigatorMinutes) {
    if (minutes > maxMinutes) {
      maxMinutes = minutes
      primaryNavigatorId = navId
    }
  }

  return primaryNavigatorId
}

/**
 * Generate a member ID for a patient (demo purposes)
 */
function generateMemberId(patient: Patient): string {
  // In production, this would come from insurance data
  // For demo, create from health plan abbreviation + patient ID
  const planPrefix = patient.healthPlan
    ? patient.healthPlan.slice(0, 3).toUpperCase()
    : "UNK"
  return `${planPrefix}-${patient.id.toUpperCase()}`
}

/**
 * Main function: Generate monthly billable claims from time logs
 * Supports payer-agnostic billing with H-codes (Medicaid) or G-codes (Medicare)
 *
 * @param navigators - Array of navigators (for reference/name lookup)
 * @param patients - Array of patients
 * @param timeLogs - Array of time log entries
 * @param payerConfig - Optional payer configuration (defaults to Medicaid BH)
 * @returns Array of BillableClaim objects
 */
export function generateMonthlyClaims(
  navigators: Navigator[],
  patients: Patient[],
  timeLogs: TimeLog[],
  payerConfig?: PayerConfig
): BillableClaim[] {
  // Use provided payer config or default to Medicaid BH
  const config = payerConfig || getPayerConfig(DEFAULT_PAYER_CONFIG_ID)

  // Create patient lookup map
  const patientMap = new Map(patients.map((p) => [p.id, p]))

  // Group time logs by patient and month
  const grouped = groupTimeLogsByPatientAndMonth(timeLogs)

  // Generate claims for each group
  const claims: BillableClaim[] = []

  for (const [key, logs] of grouped) {
    const [patientId, month] = key.split(":")
    const patient = patientMap.get(patientId)

    // Calculate total minutes
    const totalMinutes = logs.reduce((sum, log) => sum + log.durationMinutes, 0)

    // Determine service type (from first log, should be consistent)
    const serviceType = logs[0]?.serviceType || "CHI"

    // Determine codes based on payer config
    let primaryCode: string
    let addOnCode: string | undefined

    if (config.useRuleOfEights) {
      // Medicaid H-codes: Determine code based on activity type
      // Use the most common activity type from the logs
      const activityCounts = new Map<string, number>()
      for (const log of logs) {
        const activity = log.activityType || "PEER_SUPPORT"
        activityCounts.set(activity, (activityCounts.get(activity) || 0) + log.durationMinutes)
      }
      // Find most common activity
      let dominantActivity = "PEER_SUPPORT"
      let maxMinutes = 0
      for (const [activity, minutes] of activityCounts) {
        if (minutes > maxMinutes) {
          maxMinutes = minutes
          dominantActivity = activity
        }
      }
      primaryCode = getHCodeForActivity(dominantActivity as import("./types").ActivityType)
      addOnCode = undefined // H-codes don't have add-on codes
    } else {
      // Medicare G-codes: Use service type to determine codes
      const gCodes = G_CODES[serviceType]
      primaryCode = gCodes.base
      addOnCode = gCodes.addOn
    }

    // Calculate billing units using payer-specific logic
    const { primaryUnits, addOnUnits } = calculateBillingUnits(totalMinutes, config)

    // Validate the claim with payer-specific thresholds
    const validationErrors = validateClaimData(patient, totalMinutes, config)
    const status: BillableClaim["status"] = validationErrors.length > 0 ? "MISSING_DATA" : "READY"

    // Collect diagnosis codes
    const diagnosisCodes: string[] = []
    if (patient?.icdCodes) {
      diagnosisCodes.push(...patient.icdCodes)
    }
    // Add primary diagnosis if available and not already included
    if (patient?.primaryDiagnosis) {
      // Extract ICD code if present in diagnosis string (e.g., "Cancer (C50.9)")
      const icdMatch = patient.primaryDiagnosis.match(/\(([A-Z]\d+\.?\d*)\)/)
      if (icdMatch && !diagnosisCodes.includes(icdMatch[1])) {
        diagnosisCodes.push(icdMatch[1])
      }
    }

    // Get primary navigator
    const navigatorId = getPrimaryNavigator(logs)

    // Generate member ID
    const memberId = patient ? generateMemberId(patient) : "UNKNOWN"

    // Create the claim
    const claim: BillableClaim = {
      id: generateClaimId(patientId, month),
      patientId,
      patientName: patient?.name || "Unknown Patient",
      memberId,
      month,
      totalMinutes,
      primaryCode,
      primaryUnits,
      addOnCode: addOnUnits > 0 ? addOnCode : undefined,
      addOnUnits,
      diagnosisCodes: [...new Set(diagnosisCodes)], // Deduplicate
      status,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      timeLogIds: logs.map((log) => log.id),
      serviceType,
      navigatorId,
      createdAt: new Date().toISOString(),
      // Payer-agnostic billing fields
      billingModel: config.billingModel,
      payerConfigId: config.id,
    }

    claims.push(claim)
  }

  // Sort by month descending, then by patient name
  claims.sort((a, b) => {
    if (a.month !== b.month) {
      return b.month.localeCompare(a.month)
    }
    return a.patientName.localeCompare(b.patientName)
  })

  return claims
}

/**
 * Filter claims by status
 */
export function filterClaimsByStatus(
  claims: BillableClaim[],
  status: BillableClaim["status"]
): BillableClaim[] {
  return claims.filter((c) => c.status === status)
}

/**
 * Filter claims by month
 */
export function filterClaimsByMonth(
  claims: BillableClaim[],
  month: string
): BillableClaim[] {
  return claims.filter((c) => c.month === month)
}

/**
 * Calculate total revenue for an array of claims
 * Supports payer-agnostic revenue calculation
 *
 * @param claims Array of claims to calculate revenue for
 * @param payerConfig Optional payer configuration for rates (defaults to claim's config or Medicare)
 */
export function calculateTotalRevenue(
  claims: BillableClaim[],
  payerConfig?: PayerConfig
): {
  totalValue: number
  readyValue: number
  pendingValue: number
  claimCount: number
  readyCount: number
  pendingCount: number
} {
  let totalValue = 0
  let readyValue = 0
  let readyCount = 0
  let pendingCount = 0

  for (const claim of claims) {
    // Use provided payer config, or fall back to claim's config, or use legacy rates
    const config = payerConfig || (claim.payerConfigId ? getPayerConfig(claim.payerConfigId) : undefined)
    const claimValue = calculateClaimValue(claim.primaryUnits, claim.addOnUnits, config)
    totalValue += claimValue

    if (claim.status === "READY") {
      readyValue += claimValue
      readyCount++
    } else if (claim.status === "MISSING_DATA") {
      pendingCount++
    }
  }

  return {
    totalValue,
    readyValue,
    pendingValue: totalValue - readyValue,
    claimCount: claims.length,
    readyCount,
    pendingCount,
  }
}

/**
 * Format claim for CSV export
 * Includes billing model for payer-agnostic export
 */
export function formatClaimForCSV(claim: BillableClaim, payerConfig?: PayerConfig): Record<string, string> {
  // Get config for value calculation
  const config = payerConfig || (claim.payerConfigId ? getPayerConfig(claim.payerConfigId) : undefined)

  return {
    ClaimID: claim.id,
    PatientName: claim.patientName,
    MemberID: claim.memberId,
    BillingMonth: claim.month,
    BillingModel: claim.billingModel || "MEDICARE_CHI",
    ServiceType: claim.serviceType,
    TotalMinutes: claim.totalMinutes.toString(),
    PrimaryCode: claim.primaryCode,
    PrimaryUnits: claim.primaryUnits.toString(),
    AddOnCode: claim.addOnCode || "",
    AddOnUnits: claim.addOnUnits.toString(),
    DiagnosisCodes: claim.diagnosisCodes.join(";"),
    EstimatedValue: calculateClaimValue(claim.primaryUnits, claim.addOnUnits, config).toFixed(2),
    Status: claim.status,
    NavigatorID: claim.navigatorId,
    CreatedAt: claim.createdAt,
  }
}

/**
 * Generate CSV content from claims
 * Supports payer-agnostic export with correct value calculations
 */
export function generateClaimsCSV(claims: BillableClaim[], payerConfig?: PayerConfig): string {
  if (claims.length === 0) return ""

  const formatted = claims.map(c => formatClaimForCSV(c, payerConfig))
  const headers = Object.keys(formatted[0])
  const rows = formatted.map((row) =>
    headers.map((h) => `"${row[h]}"`).join(",")
  )

  return [headers.join(","), ...rows].join("\n")
}

/**
 * Get available billing months from claims
 */
export function getAvailableMonths(claims: BillableClaim[]): string[] {
  const months = new Set(claims.map((c) => c.month))
  return Array.from(months).sort().reverse()
}

/**
 * Format month for display (e.g., "2026-01" -> "January 2026")
 */
export function formatMonthDisplay(month: string): string {
  const [year, monthNum] = month.split("-")
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
