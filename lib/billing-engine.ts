import type { TimeLog, ServiceType, CPTDefinition, Patient } from "./types"

/**
 * Result of billing calculation for a patient in a given month
 */
export interface BillingCalculationResult {
  patientId: string
  billingPeriod: string // YYYY-MM format
  serviceType: ServiceType
  totalMinutes: number
  isBillable: boolean
  baseCode: string | null // G0023 (PIN) or G0019 (CHI)
  baseUnits: number
  addOnCode: string | null // G0024 (PIN) or G0022 (CHI)
  addOnUnits: number
  minutesToNextUnit: number // Minutes needed to reach next billing threshold
  progressToNextUnit: number // 0-100 percentage
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
 * CPT code mappings by service type
 */
const CPT_CODES: Record<ServiceType, { base: CPTDefinition; addOn: CPTDefinition }> = {
  PIN: {
    base: {
      code: "G0023",
      description: "Principal Illness Navigation - Base (first 60 min/month)",
      baseDuration: 60,
      isBaseCode: true,
      serviceType: "PIN",
    },
    addOn: {
      code: "G0024",
      description: "Principal Illness Navigation - Add-on (each additional 30 min)",
      baseDuration: 30,
      isBaseCode: false,
      serviceType: "PIN",
    },
  },
  CHI: {
    base: {
      code: "G0019",
      description: "Community Health Integration - Base (first 60 min/month)",
      baseDuration: 60,
      isBaseCode: true,
      serviceType: "CHI",
    },
    addOn: {
      code: "G0022",
      description: "Community Health Integration - Add-on (each additional 30 min)",
      baseDuration: 30,
      isBaseCode: false,
      serviceType: "CHI",
    },
  },
}

/**
 * Calculate billable units for a patient in a given month
 *
 * Logic Tree:
 * - Base code (G0023/G0019): First 60 minutes = 1 unit
 * - Add-on code (G0024/G0022): Each additional 30 minutes = 1 unit
 *
 * @param timeLogs - All time logs (will be filtered by patient and period)
 * @param patientId - The patient ID
 * @param serviceType - PIN or CHI (from patient.billingTrack)
 * @param month - 1-12
 * @param year - Full year (e.g., 2026)
 */
export function calculateMonthlyBilling(
  timeLogs: TimeLog[],
  patientId: string,
  serviceType: ServiceType,
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

  // Get CPT codes for this service type
  const codes = CPT_CODES[serviceType]
  const baseThreshold = 60
  const addOnIncrement = 30

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
    statusText = `Qualified: ${codes.base.code} x1${extraMins > 0 ? ` (+${extraMins} mins toward next unit)` : ""}`
    statusLevel = "qualified"
  } else {
    const extraMins = remainingMinutes % addOnIncrement
    statusText = `Qualified: ${codes.base.code} x1 + ${codes.addOn.code} x${addOnUnits}${extraMins > 0 ? ` (+${extraMins} mins toward next)` : ""}`
    statusLevel = "exceeded"
  }

  // Generate breakdown
  const breakdown: BillingBreakdown[] = []

  // Base code
  breakdown.push({
    code: codes.base.code,
    description: codes.base.description,
    minutes: Math.min(totalMinutes, baseThreshold),
    qualified: totalMinutes >= baseThreshold,
  })

  // Add-on codes
  if (totalMinutes > baseThreshold) {
    for (let i = 0; i < addOnUnits; i++) {
      breakdown.push({
        code: codes.addOn.code,
        description: `${codes.addOn.description} (Unit ${i + 1})`,
        minutes: addOnIncrement,
        qualified: true,
      })
    }

    // Partial progress toward next add-on
    const partialMinutes = remainingMinutes % addOnIncrement
    if (partialMinutes > 0) {
      breakdown.push({
        code: codes.addOn.code,
        description: `${codes.addOn.description} (In Progress)`,
        minutes: partialMinutes,
        qualified: false,
      })
    }
  }

  return {
    patientId,
    billingPeriod,
    serviceType,
    totalMinutes,
    isBillable,
    baseCode: codes.base.code,
    baseUnits,
    addOnCode: addOnUnits > 0 ? codes.addOn.code : null,
    addOnUnits,
    minutesToNextUnit,
    progressToNextUnit,
    statusText,
    statusLevel,
    breakdown,
  }
}

/**
 * Get billing calculation for current month
 */
export function calculateCurrentMonthBilling(
  timeLogs: TimeLog[],
  patientId: string,
  serviceType: ServiceType
): BillingCalculationResult {
  const now = new Date()
  return calculateMonthlyBilling(
    timeLogs,
    patientId,
    serviceType,
    now.getMonth() + 1, // getMonth() is 0-indexed
    now.getFullYear()
  )
}

/**
 * Get billing summary for multiple patients
 */
export function calculateBillingBatch(
  timeLogs: TimeLog[],
  patients: Patient[],
  month: number,
  year: number
): BillingCalculationResult[] {
  return patients.map((patient) =>
    calculateMonthlyBilling(
      timeLogs,
      patient.id,
      patient.billingTrack || "CHI",
      month,
      year
    )
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
 * Calculate estimated revenue from billing result
 * Using approximate CMS rates
 */
export function estimateRevenue(result: BillingCalculationResult): number {
  if (!result.isBillable) return 0

  // Approximate CMS reimbursement rates (2024)
  const rates: Record<string, number> = {
    G0023: 78.0, // PIN base
    G0024: 39.0, // PIN add-on
    G0019: 72.0, // CHI base
    G0022: 36.0, // CHI add-on
  }

  let total = 0

  if (result.baseCode && result.baseUnits > 0) {
    total += (rates[result.baseCode] || 0) * result.baseUnits
  }

  if (result.addOnCode && result.addOnUnits > 0) {
    total += (rates[result.addOnCode] || 0) * result.addOnUnits
  }

  return total
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
