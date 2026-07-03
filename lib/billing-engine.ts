/**
 * Billing Engine - Payer-aware monthly billing progress calculator
 *
 * Computes a patient's progress toward billable units for a month using the
 * active PayerConfig. Supports two modes:
 *
 * - RULE_OF_EIGHTS (Medicaid H-codes): 15-minute units, 8+ minutes = 1 unit.
 *   Next unit threshold sits at (unitsEarned * 15) + 8 minutes.
 * - BASE_PLUS_ADDON (Medicare G-codes): 60-minute base + 30-minute add-ons.
 *
 * Codes come from PayerConfig.codes (plus the dominant-activity H-code for
 * Medicaid), and revenue comes from the payer's rate card via
 * calculateClaimValue — no hardcoded CPT tables or rates.
 */

import type { TimeLog, PayerConfig } from "./types"
import {
  calculateClaimValue,
  calculateRuleOfEightsUnits,
  getDominantHCode,
} from "./payer-config"

/**
 * Billing calculation mode derived from the payer configuration
 */
export type BillingMode = "RULE_OF_EIGHTS" | "BASE_PLUS_ADDON"

/**
 * Result of billing progress calculation for a patient in a given month
 */
export interface BillingCalculationResult {
  patientId: string
  billingPeriod: string // YYYY-MM format
  mode: BillingMode
  payerConfigId: string
  payerName: string
  totalMinutes: number
  isBillable: boolean
  baseCode: string | null // H-code (Medicaid) or base G-code (Medicare)
  baseUnits: number // Units earned on the base code
  addOnCode: string | null // Add-on G-code (Medicare only)
  addOnUnits: number // Add-on units (Medicare only, 0 for Medicaid)
  unitsEarned: number // Total billable units (base + add-on)
  minutesToNextUnit: number // Minutes needed to reach next billing threshold
  progressToNextUnit: number // 0-100 percentage within the current unit window
  estimatedRevenue: number // From the payer's rate card
  statusText: string // Human-readable status
  statusLevel: "unbillable" | "qualified" | "exceeded"
  breakdown: BillingBreakdown[]
}

/**
 * Individual billing unit breakdown
 */
export interface BillingBreakdown {
  code: string
  description: string
  minutes: number
  qualified: boolean
}

/**
 * Calculate billing progress for a patient in a given month using the
 * payer's billing rules (Rule of Eights vs base + add-on)
 *
 * @param timeLogs - All time logs (will be filtered by patient and period)
 * @param patientId - The patient ID
 * @param payerConfig - Active payer configuration
 * @param month - 1-12
 * @param year - Full year (e.g., 2026)
 */
export function calculateMonthlyBillingProgress(
  timeLogs: TimeLog[],
  patientId: string,
  payerConfig: PayerConfig,
  month: number,
  year: number
): BillingCalculationResult {
  const billingPeriod = `${year}-${String(month).padStart(2, "0")}`

  // Filter time logs for this patient and billing period
  const patientLogs = timeLogs.filter(
    (log) => log.patientId === patientId && log.billingPeriod === billingPeriod
  )

  // Sum total minutes
  const totalMinutes = patientLogs.reduce((sum, log) => sum + log.durationMinutes, 0)

  if (payerConfig.useRuleOfEights) {
    return calculateRuleOfEightsProgress(patientLogs, patientId, billingPeriod, totalMinutes, payerConfig)
  }
  return calculateBasePlusAddOnProgress(patientId, billingPeriod, totalMinutes, payerConfig)
}

/**
 * Rule of Eights progress (Medicaid H-codes, 15-min units)
 * Next unit threshold: (unitsEarned * 15) + 8 minutes
 */
function calculateRuleOfEightsProgress(
  patientLogs: TimeLog[],
  patientId: string,
  billingPeriod: string,
  totalMinutes: number,
  payerConfig: PayerConfig
): BillingCalculationResult {
  const unitIncrement = payerConfig.unitIncrement // 15
  const baseMinimum = payerConfig.baseMinimum // 8

  const unitsEarned = calculateRuleOfEightsUnits(totalMinutes)
  const isBillable = unitsEarned > 0

  // Dominant-activity H-code for the month's logs; fall back to the config default
  const baseCode = patientLogs.length > 0 ? getDominantHCode(patientLogs) : payerConfig.codes.base

  // Next threshold sits at units*15 + 8 (8 -> 1st unit, 23 -> 2nd, 38 -> 3rd, ...)
  const nextThreshold = unitsEarned * unitIncrement + baseMinimum
  const previousThreshold = unitsEarned === 0 ? 0 : (unitsEarned - 1) * unitIncrement + baseMinimum
  const minutesToNextUnit = nextThreshold - totalMinutes
  const progressToNextUnit = Math.min(
    100,
    ((totalMinutes - previousThreshold) / (nextThreshold - previousThreshold)) * 100
  )

  // Status: "unbillable" only below the 8-minute floor
  let statusText: string
  let statusLevel: BillingCalculationResult["statusLevel"]

  if (!isBillable) {
    statusText = `${minutesToNextUnit} mins to Billable Event`
    statusLevel = "unbillable"
  } else {
    statusText = `Qualified: ${baseCode} x${unitsEarned} (${minutesToNextUnit} mins to next unit)`
    statusLevel = unitsEarned > 1 ? "exceeded" : "qualified"
  }

  // Per-unit breakdown
  const breakdown: BillingBreakdown[] = []
  for (let i = 0; i < unitsEarned; i++) {
    breakdown.push({
      code: baseCode,
      description: `${unitIncrement}-min unit ${i + 1} of ${unitsEarned}`,
      minutes: Math.max(0, Math.min(unitIncrement, totalMinutes - i * unitIncrement)),
      qualified: true,
    })
  }
  // Partial progress toward the next unit
  const partialMinutes = totalMinutes - unitsEarned * unitIncrement
  if (partialMinutes > 0) {
    breakdown.push({
      code: baseCode,
      description: `${unitIncrement}-min unit ${unitsEarned + 1} (In Progress)`,
      minutes: partialMinutes,
      qualified: false,
    })
  }

  return {
    patientId,
    billingPeriod,
    mode: "RULE_OF_EIGHTS",
    payerConfigId: payerConfig.id,
    payerName: payerConfig.name,
    totalMinutes,
    isBillable,
    baseCode,
    baseUnits: unitsEarned,
    addOnCode: null,
    addOnUnits: 0,
    unitsEarned,
    minutesToNextUnit,
    progressToNextUnit,
    estimatedRevenue: calculateClaimValue(unitsEarned, 0, payerConfig),
    statusText,
    statusLevel,
    breakdown,
  }
}

/**
 * Base + add-on progress (Medicare G-codes: 60-min base, 30-min add-ons)
 */
function calculateBasePlusAddOnProgress(
  patientId: string,
  billingPeriod: string,
  totalMinutes: number,
  payerConfig: PayerConfig
): BillingCalculationResult {
  const baseThreshold = payerConfig.baseMinimum // 60
  const addOnIncrement = payerConfig.unitIncrement // 30
  const baseCode = payerConfig.codes.base
  const addOnCode = payerConfig.codes.addOn || null

  // Calculate billing units
  const isBillable = totalMinutes >= baseThreshold
  const baseUnits = isBillable ? 1 : 0
  const remainingMinutes = Math.max(0, totalMinutes - baseThreshold)
  const addOnUnits = Math.floor(remainingMinutes / addOnIncrement)

  // Calculate progress to next unit
  let minutesToNextUnit: number
  let progressToNextUnit: number

  if (totalMinutes < baseThreshold) {
    // Working toward base code
    minutesToNextUnit = baseThreshold - totalMinutes
    progressToNextUnit = (totalMinutes / baseThreshold) * 100
  } else {
    // Working toward next add-on
    const minutesIntoCurrentAddOn = remainingMinutes % addOnIncrement
    minutesToNextUnit = addOnIncrement - minutesIntoCurrentAddOn
    progressToNextUnit = (minutesIntoCurrentAddOn / addOnIncrement) * 100

    // If exactly at a threshold, show 100%
    if (minutesIntoCurrentAddOn === 0 && remainingMinutes > 0) {
      progressToNextUnit = 100
      minutesToNextUnit = addOnIncrement
    }
  }

  // Generate status text
  let statusText: string
  let statusLevel: BillingCalculationResult["statusLevel"]

  if (totalMinutes < baseThreshold) {
    statusText = `${minutesToNextUnit} mins to Billable Event`
    statusLevel = "unbillable"
  } else if (addOnUnits === 0) {
    const extraMins = remainingMinutes
    statusText = `Qualified: ${baseCode} x1${extraMins > 0 ? ` (+${extraMins} mins toward next unit)` : ""}`
    statusLevel = "qualified"
  } else {
    const extraMins = remainingMinutes % addOnIncrement
    statusText = `Qualified: ${baseCode} x1 + ${addOnCode} x${addOnUnits}${extraMins > 0 ? ` (+${extraMins} mins toward next)` : ""}`
    statusLevel = "exceeded"
  }

  // Generate breakdown
  const breakdown: BillingBreakdown[] = []

  // Base code
  breakdown.push({
    code: baseCode,
    description: `Base (first ${baseThreshold} min/month)`,
    minutes: Math.min(totalMinutes, baseThreshold),
    qualified: totalMinutes >= baseThreshold,
  })

  // Add-on codes
  if (totalMinutes > baseThreshold && addOnCode) {
    for (let i = 0; i < addOnUnits; i++) {
      breakdown.push({
        code: addOnCode,
        description: `Add-on: each additional ${addOnIncrement} min (Unit ${i + 1})`,
        minutes: addOnIncrement,
        qualified: true,
      })
    }

    // Partial progress toward next add-on
    const partialMinutes = remainingMinutes % addOnIncrement
    if (partialMinutes > 0) {
      breakdown.push({
        code: addOnCode,
        description: `Add-on: each additional ${addOnIncrement} min (In Progress)`,
        minutes: partialMinutes,
        qualified: false,
      })
    }
  }

  return {
    patientId,
    billingPeriod,
    mode: "BASE_PLUS_ADDON",
    payerConfigId: payerConfig.id,
    payerName: payerConfig.name,
    totalMinutes,
    isBillable,
    baseCode,
    baseUnits,
    addOnCode: addOnUnits > 0 ? addOnCode : null,
    addOnUnits,
    unitsEarned: baseUnits + addOnUnits,
    minutesToNextUnit,
    progressToNextUnit,
    estimatedRevenue: calculateClaimValue(baseUnits, addOnUnits, payerConfig),
    statusText,
    statusLevel,
    breakdown,
  }
}

/**
 * Get billing progress for the current month
 */
export function calculateCurrentMonthBillingProgress(
  timeLogs: TimeLog[],
  patientId: string,
  payerConfig: PayerConfig
): BillingCalculationResult {
  const now = new Date()
  return calculateMonthlyBillingProgress(
    timeLogs,
    patientId,
    payerConfig,
    now.getMonth() + 1, // getMonth() is 0-indexed
    now.getFullYear()
  )
}

/**
 * Format billing codes for display
 */
export function formatBillingCodes(result: BillingCalculationResult): string {
  if (!result.isBillable) {
    return "Not yet billable"
  }

  const parts: string[] = []

  if (result.baseUnits > 0 && result.baseCode) {
    parts.push(`${result.baseCode} x${result.baseUnits}`)
  }

  if (result.addOnUnits > 0 && result.addOnCode) {
    parts.push(`${result.addOnCode} x${result.addOnUnits}`)
  }

  return parts.join(" + ")
}

/**
 * Get time logs summary by date for a patient
 */
export function getTimeLogsSummaryByDate(
  timeLogs: TimeLog[],
  patientId: string,
  billingPeriod: string
): { date: string; minutes: number; modality: string }[] {
  const patientLogs = timeLogs.filter(
    (log) => log.patientId === patientId && log.billingPeriod === billingPeriod
  )

  // Group by date
  const byDate = new Map<string, { minutes: number; modality: string }>()

  patientLogs.forEach((log) => {
    const existing = byDate.get(log.date)
    if (existing) {
      existing.minutes += log.durationMinutes
    } else {
      byDate.set(log.date, { minutes: log.durationMinutes, modality: log.modality })
    }
  })

  return Array.from(byDate.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
