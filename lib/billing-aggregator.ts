/**
 * Billing Aggregator - Billing Bridge
 *
 * Aggregates individual TimeLog entries into BillableClaim records
 * following CMS G-code billing rules for patient navigation services.
 *
 * PIN (Principal Illness Navigation):
 *   - G0023: Base code, first 60 minutes
 *   - G0024: Add-on code, each additional 30 minutes
 *
 * CHI (Community Health Integration):
 *   - G0019: Base code, first 60 minutes
 *   - G0022: Add-on code, each additional 30 minutes
 */

import type {
  BillableClaim,
  TimeLog,
  Patient,
  IntakeRecord,
  ServiceType,
} from "./types"

/**
 * G-code mappings by service type
 */
const G_CODES: Record<ServiceType, { base: string; addOn: string }> = {
  PIN: { base: "G0023", addOn: "G0024" },
  CHI: { base: "G0019", addOn: "G0022" },
}

/**
 * Billing thresholds (in minutes)
 */
const BILLING_THRESHOLDS = {
  BASE_MINIMUM: 60, // Minimum minutes to bill base code
  ADD_ON_INCREMENT: 30, // Minutes per add-on unit
}

/**
 * Generate a unique claim ID
 */
function generateClaimId(patientId: string, month: string): string {
  return `claim-${patientId}-${month}`
}

/**
 * Calculate billing units from total minutes
 */
export function calculateBillingUnits(totalMinutes: number): {
  primaryUnits: number
  addOnUnits: number
} {
  if (totalMinutes < BILLING_THRESHOLDS.BASE_MINIMUM) {
    return { primaryUnits: 0, addOnUnits: 0 }
  }

  // Base code covers first 60 minutes
  const primaryUnits = 1

  // Add-on units for each additional 30 minutes
  const remainingMinutes = totalMinutes - BILLING_THRESHOLDS.BASE_MINIMUM
  const addOnUnits = Math.floor(remainingMinutes / BILLING_THRESHOLDS.ADD_ON_INCREMENT)

  return { primaryUnits, addOnUnits }
}

/**
 * Validate a claim and return any errors
 */
export function validateClaim(
  patient: Patient | undefined,
  intakeRecord: IntakeRecord | undefined,
  totalMinutes: number
): string[] {
  const errors: string[] = []

  if (!patient) {
    errors.push("Patient record not found")
    return errors
  }

  if (!intakeRecord) {
    errors.push("Intake record missing - consent required for billing")
  } else {
    if (!intakeRecord.consentObtained) {
      errors.push("Patient consent not documented")
    }
    if (!intakeRecord.initiatingVisitDate) {
      errors.push("Initiating visit date not recorded")
    }
  }

  if (totalMinutes < BILLING_THRESHOLDS.BASE_MINIMUM) {
    errors.push(`Insufficient time: ${totalMinutes} min (minimum 60 min required)`)
  }

  // Check for diagnosis codes (required for claims)
  if (!patient.icdCodes || patient.icdCodes.length === 0) {
    errors.push("No diagnosis codes (ICD-10) on file")
  }

  return errors
}

/**
 * Group time logs by patient and billing period (month)
 */
export function groupTimeLogsByPatientMonth(
  timeLogs: TimeLog[]
): Map<string, TimeLog[]> {
  const grouped = new Map<string, TimeLog[]>()

  for (const log of timeLogs) {
    // Only include verified time logs
    if (!log.verified) continue

    const month = log.billingPeriod || log.date.slice(0, 7) // "YYYY-MM"
    const key = `${log.patientId}:${month}`

    const existing = grouped.get(key) || []
    existing.push(log)
    grouped.set(key, existing)
  }

  return grouped
}

/**
 * Aggregate time logs into a BillableClaim
 */
export function aggregateToClaimForPatientMonth(
  patientId: string,
  month: string,
  timeLogs: TimeLog[],
  patient: Patient | undefined,
  intakeRecord: IntakeRecord | undefined
): BillableClaim {
  // Calculate total minutes from all logs
  const totalMinutes = timeLogs.reduce((sum, log) => sum + log.durationMinutes, 0)

  // Determine service type (use first log's service type, should be consistent)
  const serviceType = timeLogs[0]?.serviceType || "CHI"

  // Get G-codes for this service type
  const codes = G_CODES[serviceType]

  // Calculate billing units
  const { primaryUnits, addOnUnits } = calculateBillingUnits(totalMinutes)

  // Validate the claim
  const validationErrors = validateClaim(patient, intakeRecord, totalMinutes)
  const status = validationErrors.length > 0 ? "MISSING_DATA" : "READY"

  // Get diagnosis codes from patient and intake record
  const diagnosisCodes: string[] = []
  if (patient?.icdCodes) {
    diagnosisCodes.push(...patient.icdCodes)
  }
  if (intakeRecord?.identifiedBarriers) {
    // Add Z-codes from identified barriers
    diagnosisCodes.push(...intakeRecord.identifiedBarriers.map((b) => b.code))
  }

  // Get member ID from intake or use placeholder
  const memberId = intakeRecord
    ? `MBR-${patientId.toUpperCase()}`
    : "UNKNOWN"

  // Get primary navigator (most frequent in logs)
  const navigatorCounts = new Map<string, number>()
  for (const log of timeLogs) {
    const count = navigatorCounts.get(log.navigatorId) || 0
    navigatorCounts.set(log.navigatorId, count + log.durationMinutes)
  }
  let primaryNavigatorId = timeLogs[0]?.navigatorId || ""
  let maxMinutes = 0
  for (const [navId, minutes] of navigatorCounts) {
    if (minutes > maxMinutes) {
      maxMinutes = minutes
      primaryNavigatorId = navId
    }
  }

  return {
    id: generateClaimId(patientId, month),
    patientId,
    patientName: patient?.name || "Unknown Patient",
    memberId,
    month,
    totalMinutes,
    primaryCode: codes.base,
    primaryUnits,
    addOnCode: addOnUnits > 0 ? codes.addOn : undefined,
    addOnUnits,
    diagnosisCodes: [...new Set(diagnosisCodes)], // Deduplicate
    status,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    timeLogIds: timeLogs.map((log) => log.id),
    serviceType,
    navigatorId: primaryNavigatorId,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Main aggregation function - generates all billable claims from time logs
 */
export function aggregateBillableClaims(
  timeLogs: TimeLog[],
  patients: Patient[],
  intakeRecords: IntakeRecord[]
): BillableClaim[] {
  // Create lookup maps for patients and intake records
  const patientMap = new Map(patients.map((p) => [p.id, p]))
  const intakeMap = new Map(intakeRecords.map((i) => [i.patientId, i]))

  // Group time logs by patient and month
  const grouped = groupTimeLogsByPatientMonth(timeLogs)

  // Generate claims for each group
  const claims: BillableClaim[] = []

  for (const [key, logs] of grouped) {
    const [patientId, month] = key.split(":")
    const patient = patientMap.get(patientId)
    const intakeRecord = intakeMap.get(patientId)

    const claim = aggregateToClaimForPatientMonth(
      patientId,
      month,
      logs,
      patient,
      intakeRecord
    )

    claims.push(claim)
  }

  // Sort by month descending, then by patient name
  claims.sort((a, b) => {
    if (a.month !== b.month) {
      return b.month.localeCompare(a.month) // Descending by month
    }
    return a.patientName.localeCompare(b.patientName)
  })

  return claims
}

/**
 * Calculate expected revenue from claims
 */
export function calculateClaimRevenue(
  claims: BillableClaim[],
  baseRate: number = 125, // Default rate per base unit
  addOnRate: number = 62.5 // Default rate per add-on unit (typically half of base)
): {
  totalRevenue: number
  readyRevenue: number
  pendingRevenue: number
  claimCount: number
  readyCount: number
} {
  let totalRevenue = 0
  let readyRevenue = 0
  let readyCount = 0

  for (const claim of claims) {
    const claimRevenue =
      claim.primaryUnits * baseRate + claim.addOnUnits * addOnRate

    totalRevenue += claimRevenue

    if (claim.status === "READY") {
      readyRevenue += claimRevenue
      readyCount++
    }
  }

  return {
    totalRevenue,
    readyRevenue,
    pendingRevenue: totalRevenue - readyRevenue,
    claimCount: claims.length,
    readyCount,
  }
}

/**
 * Format claim for 837P export (simplified representation)
 */
export function formatClaimFor837P(claim: BillableClaim): Record<string, unknown> {
  return {
    claimId: claim.id,
    patientId: claim.patientId,
    memberId: claim.memberId,
    serviceDate: `${claim.month}-01`, // First of month
    serviceDateEnd: `${claim.month}-28`, // Approximate end
    primaryProcedure: {
      code: claim.primaryCode,
      units: claim.primaryUnits,
      modifier: null,
    },
    additionalProcedures: claim.addOnCode
      ? [
          {
            code: claim.addOnCode,
            units: claim.addOnUnits,
            modifier: null,
          },
        ]
      : [],
    diagnosisCodes: claim.diagnosisCodes,
    totalMinutes: claim.totalMinutes,
    renderingProvider: claim.navigatorId,
  }
}
