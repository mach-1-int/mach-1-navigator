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
 *
 * All calculations require an explicit PayerConfig — thresholds, codes, and
 * rates always come from the payer configuration (no legacy fallbacks).
 */

import type {
  BillableClaim,
  IntakeRecord,
  TimeLog,
  Patient,
  Navigator,
  ServiceType,
  PayerConfig,
} from "./types"

import {
  calculateBillingUnits as calculateUnitsFromConfig,
  calculateClaimValue as calculateValueFromConfig,
  getDominantHCode,
} from "./payer-config"
import { localCurrentMonth } from "./date-rebase"

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
 * Calculate billing units from total minutes using payer-specific rules
 * (Rule of Eights for Medicaid, 60-min base + 30-min add-on for Medicare)
 *
 * @param totalMinutes Total minutes of service
 * @param payerConfig Payer configuration
 */
export function calculateBillingUnits(
  totalMinutes: number,
  payerConfig: PayerConfig
): {
  primaryUnits: number
  addOnUnits: number
} {
  return calculateUnitsFromConfig(totalMinutes, payerConfig)
}

/**
 * Calculate estimated revenue for a claim using the payer's rate card
 *
 * @param primaryUnits Number of base code units
 * @param addOnUnits Number of add-on code units
 * @param payerConfig Payer configuration
 */
export function calculateClaimValue(
  primaryUnits: number,
  addOnUnits: number,
  payerConfig: PayerConfig
): number {
  return calculateValueFromConfig(primaryUnits, addOnUnits, payerConfig)
}

/**
 * Options for {@link validateClaimData}
 *
 * @param patient Patient record
 * @param intakeRecord Intake record for the patient (consent/initiating visit)
 * @param totalMinutes Total minutes of service
 * @param payerConfig Payer configuration for threshold validation
 * @param month Claim billing month ("YYYY-MM")
 * @param serviceType Claim service type (PIN or CHI)
 * @param diagnosisCodes Combined diagnosis set (patient ICD + intake Z-codes)
 */
interface ValidateClaimDataOptions {
  patient: Patient | undefined
  intakeRecord: IntakeRecord | undefined
  totalMinutes: number
  payerConfig: PayerConfig
  month: string
  serviceType: ServiceType
  diagnosisCodes: string[]
}

/** Payer-specific minimum time threshold (8 min Medicaid, 60 min Medicare). */
function checkMinimumTime(totalMinutes: number, payerConfig: PayerConfig): string | undefined {
  if (totalMinutes < payerConfig.baseMinimum) {
    return `Insufficient Time (${totalMinutes}/${payerConfig.baseMinimum} mins)`
  }
}

/**
 * Only a real payer-issued ID satisfies this — a health plan NAME is not a
 * subscriber ID, and fabricated IDs guarantee denials.
 */
function checkMemberId(patient: Patient): string | undefined {
  if (!patient.memberId || patient.memberId.length === 0) return "Missing Member ID"
}

/** Diagnosis codes (ICD-10) on the patient record, falling back to primaryDiagnosis. */
function checkDiagnosisCodes(patient: Patient): string | undefined {
  if ((!patient.icdCodes || patient.icdCodes.length === 0) && !patient.primaryDiagnosis) {
    return "Missing diagnosis codes (ICD-10)"
  }
}

/** No intake on file, or intake without documented consent (CMS G-code requirement). */
function checkConsent(intakeRecord: IntakeRecord | undefined): string | undefined {
  if (!intakeRecord || !intakeRecord.consentObtained) return "Patient consent not documented"
}

/**
 * Initiating visit date recorded, and within 12 months of the claim month
 * (re-initiation rule). Cutoff = first day of the claim month, minus 12
 * months (ISO compare). No intake on file is covered by {@link checkConsent}.
 */
function checkInitiatingVisit(intakeRecord: IntakeRecord | undefined, month: string): string | undefined {
  if (!intakeRecord) return undefined
  if (!intakeRecord.initiatingVisitDate) return "Initiating visit date not recorded"
  const [yearStr, monthStr] = month.split("-")
  const cutoff = `${parseInt(yearStr, 10) - 1}-${monthStr}-01`
  if (intakeRecord.initiatingVisitDate < cutoff) {
    return "Initiating visit older than 12 months — re-initiation required"
  }
}

/** CHI claims must document at least one SDOH barrier (Z-code) in the combined diagnosis set. */
function checkChiZCode(serviceType: ServiceType, diagnosisCodes: string[]): string | undefined {
  if (serviceType === "CHI" && !diagnosisCodes.some((code) => code.startsWith("Z"))) {
    return "CHI claim requires at least one SDOH Z-code"
  }
}

/** Claims cannot be routed without an assigned payer (payerId FK). */
function checkPayerAssignment(patient: Patient): string | undefined {
  if (!patient.payerId) return "Missing payer assignment"
}

/**
 * Validate claim data and return any errors, in the same order as the
 * checks below:
 * - Payer-specific minimum time threshold (8 min Medicaid, 60 min Medicare)
 * - Member ID present (real memberId or legacy healthPlan-derived)
 * - Diagnosis codes (ICD-10) on the patient record
 * - Consent documented at intake (CMS G-code requirement)
 * - Initiating visit date recorded
 * - Initiating visit within 12 months of the claim month (re-initiation rule)
 * - CHI claims carry at least one SDOH Z-code in the combined diagnosis set
 * - Patient has an assigned payer (payerId FK)
 */
function validateClaimData(options: ValidateClaimDataOptions): string[] {
  const { patient, intakeRecord, totalMinutes, payerConfig, month, serviceType, diagnosisCodes } = options

  if (!patient) {
    return ["Patient record not found"]
  }

  return [
    checkMinimumTime(totalMinutes, payerConfig),
    checkMemberId(patient),
    checkDiagnosisCodes(patient),
    checkConsent(intakeRecord),
    checkInitiatingVisit(intakeRecord, month),
    checkChiZCode(serviceType, diagnosisCodes),
    checkPayerAssignment(patient),
  ].filter((error): error is string => error !== undefined)
}

/**
 * Determine primary/add-on billing codes from the payer's billing model.
 * Medicaid H-codes bill under the dominant activity's H-code and have no
 * add-on code; Medicare G-codes use the payer config's fixed base + add-on.
 */
function selectBillingCodes(
  logs: TimeLog[],
  payerConfig: PayerConfig
): { primaryCode: string; addOnCode: string | undefined } {
  if (payerConfig.useRuleOfEights) {
    return { primaryCode: getDominantHCode(logs), addOnCode: undefined }
  }
  return { primaryCode: payerConfig.codes.base, addOnCode: payerConfig.codes.addOn }
}

/**
 * Collect the combined, deduplicated diagnosis code set for a claim: patient
 * ICD codes, an ICD code embedded in the free-text primary diagnosis (e.g.
 * "Cancer (C50.9)"), and intake-identified SDOH Z-codes.
 */
function collectDiagnosisCodes(patient: Patient | undefined, intakeRecord: IntakeRecord | undefined): string[] {
  const diagnosisCodes: string[] = []
  if (patient?.icdCodes) {
    diagnosisCodes.push(...patient.icdCodes)
  }
  if (patient?.primaryDiagnosis) {
    const icdMatch = patient.primaryDiagnosis.match(/\(([A-Z]\d+\.?\d*)\)/)
    if (icdMatch && !diagnosisCodes.includes(icdMatch[1])) {
      diagnosisCodes.push(icdMatch[1])
    }
  }
  if (intakeRecord) {
    for (const barrier of intakeRecord.identifiedBarriers) {
      diagnosisCodes.push(barrier.code)
    }
  }
  return [...new Set(diagnosisCodes)]
}

/**
 * Supervisor-verification guardrail: unverified minutes are never exportable.
 * The claim still surfaces (in Needs Attention) so the pending time is
 * visible, but it cannot reach VALIDATED until every log is verified.
 */
function appendUnverifiedTimeError(validationErrors: string[], logs: TimeLog[]): string[] {
  const unverifiedMinutes = logs
    .filter((log) => !log.verified)
    .reduce((sum, log) => sum + log.durationMinutes, 0)
  if (unverifiedMinutes > 0) {
    validationErrors.push(`Unverified time (${unverifiedMinutes} min) — supervisor review required`)
  }
  return validationErrors
}

/** Current billing month is compared on the LOCAL calendar (matches date-rebase semantics). */
function determineClaimStatus(validationErrors: string[], month: string): BillableClaim["status"] {
  if (validationErrors.length > 0) return "NEEDS_ATTENTION"
  return month === localCurrentMonth() ? "DRAFT" : "VALIDATED"
}

/** Build a single claim from one patient+month group of time logs. */
function buildClaimForGroup(
  key: string,
  logs: TimeLog[],
  patientMap: Map<string, Patient>,
  intakeMap: Map<string, IntakeRecord>,
  payerConfig: PayerConfig
): BillableClaim {
  const [patientId, month] = key.split(":")
  const patient = patientMap.get(patientId)
  const intakeRecord = intakeMap.get(patientId)

  const totalMinutes = logs.reduce((sum, log) => sum + log.durationMinutes, 0)
  const serviceType = logs[0]?.serviceType || "CHI"

  const { primaryCode, addOnCode } = selectBillingCodes(logs, payerConfig)
  const { primaryUnits, addOnUnits } = calculateBillingUnits(totalMinutes, payerConfig)
  const uniqueDiagnosisCodes = collectDiagnosisCodes(patient, intakeRecord)

  const validationErrors = appendUnverifiedTimeError(
    validateClaimData({
      patient,
      intakeRecord,
      totalMinutes,
      payerConfig,
      month,
      serviceType,
      diagnosisCodes: uniqueDiagnosisCodes,
    }),
    logs
  )

  const status = determineClaimStatus(validationErrors, month)
  const navigatorId = getPrimaryNavigator(logs)

  // Member ID: the real payer-issued ID only. The UNK- synthesis is a marked
  // placeholder that validation flags and the clearinghouse rejects — it can
  // never silently reach an accepted claim.
  const memberId = patient?.memberId || `UNK-${patientId.toUpperCase()}`

  return {
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
    diagnosisCodes: uniqueDiagnosisCodes,
    status,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    timeLogIds: logs.map((log) => log.id),
    serviceType,
    navigatorId,
    createdAt: new Date().toISOString(),
    // Payer-agnostic billing fields
    billingModel: payerConfig.billingModel,
    payerConfigId: payerConfig.id,
    payerId: patient?.payerId,
  }
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
 * Main function: Generate monthly billable claims from time logs
 * Supports payer-agnostic billing with H-codes (Medicaid) or G-codes (Medicare)
 *
 * @param navigators - Array of navigators (for reference/name lookup)
 * @param patients - Array of patients
 * @param timeLogs - Array of time log entries
 * @param payerConfig - Payer configuration (thresholds, codes, rates)
 * @param intakeRecords - Intake records (consent, initiating visit, SDOH Z-codes)
 * @returns Array of BillableClaim objects
 */
export function generateMonthlyClaims(
  navigators: Navigator[],
  patients: Patient[],
  timeLogs: TimeLog[],
  payerConfig: PayerConfig,
  intakeRecords: IntakeRecord[]
): BillableClaim[] {
  const patientMap = new Map(patients.map((p) => [p.id, p]))
  const intakeMap = new Map(intakeRecords.map((r) => [r.patientId, r]))
  const grouped = groupTimeLogsByPatientAndMonth(timeLogs)

  const claims = Array.from(grouped.entries()).map(([key, logs]) =>
    buildClaimForGroup(key, logs, patientMap, intakeMap, payerConfig)
  )

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
 * Calculate total revenue for an array of claims using the payer's rate card
 *
 * @param claims Array of claims to calculate revenue for
 * @param payerConfig Payer configuration for rates
 */
export function calculateTotalRevenue(
  claims: BillableClaim[],
  payerConfig: PayerConfig
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
    const claimValue = calculateClaimValue(claim.primaryUnits, claim.addOnUnits, payerConfig)
    totalValue += claimValue

    // VALIDATED and DRAFT both count as billable-in-progress ("ready" bucket);
    // NEEDS_ATTENTION is pending correction.
    if (claim.status === "VALIDATED" || claim.status === "DRAFT") {
      readyValue += claimValue
      readyCount++
    } else if (claim.status === "NEEDS_ATTENTION") {
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
export function formatClaimForCSV(claim: BillableClaim, payerConfig: PayerConfig): Record<string, string> {
  return {
    ClaimID: claim.id,
    PatientName: claim.patientName,
    MemberID: claim.memberId,
    BillingMonth: claim.month,
    BillingModel: claim.billingModel || payerConfig.billingModel,
    ServiceType: claim.serviceType,
    TotalMinutes: claim.totalMinutes.toString(),
    PrimaryCode: claim.primaryCode,
    PrimaryUnits: claim.primaryUnits.toString(),
    AddOnCode: claim.addOnCode || "",
    AddOnUnits: claim.addOnUnits.toString(),
    DiagnosisCodes: claim.diagnosisCodes.join(";"),
    EstimatedValue: calculateClaimValue(claim.primaryUnits, claim.addOnUnits, payerConfig).toFixed(2),
    Status: claim.status,
    NavigatorID: claim.navigatorId,
    CreatedAt: claim.createdAt,
  }
}

/**
 * Generate CSV content from claims
 * Supports payer-agnostic export with correct value calculations
 */
export function generateClaimsCSV(claims: BillableClaim[], payerConfig: PayerConfig): string {
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
