/**
 * CMS Billing Helpers (Phase 2.1)
 *
 * Pure helper functions for time logs, CPT codes, intake consent, and
 * billing encounters. Extracted from lib/store.ts to keep that module
 * focused on state shape and persistence.
 */

import type {
  TimeLog,
  CPTDefinition,
  IntakeRecord,
  BillingEncounter,
} from "./types"

/**
 * Get time logs for a patient within a billing period
 */
export function getTimeLogsByPatientAndPeriod(
  timeLogs: TimeLog[],
  patientId: string,
  billingPeriod: string
): TimeLog[] {
  return timeLogs.filter(
    (log) => log.patientId === patientId && log.billingPeriod === billingPeriod
  )
}

/**
 * Get total minutes for a patient in a billing period
 */
export function getTotalMinutesForPeriod(
  timeLogs: TimeLog[],
  patientId: string,
  billingPeriod: string
): number {
  const logs = getTimeLogsByPatientAndPeriod(timeLogs, patientId, billingPeriod)
  return logs.reduce((total, log) => total + log.durationMinutes, 0)
}

/**
 * Calculate G-code units from total minutes
 * Base code (G0023/G0019): First 60 minutes = 1 unit
 * Add-on code (G0024/G0022): Each additional 30 minutes = 1 unit
 */
export function calculateBillingUnits(totalMinutes: number): { baseUnits: number; addOnUnits: number } {
  if (totalMinutes < 60) {
    return { baseUnits: 0, addOnUnits: 0 } // Minimum 60 minutes for base code
  }

  const baseUnits = 1 // Always 1 base unit if >= 60 minutes
  const remainingMinutes = totalMinutes - 60
  const addOnUnits = Math.floor(remainingMinutes / 30) // Each 30 min = 1 add-on

  return { baseUnits, addOnUnits }
}

/**
 * Get CPT code for service type
 */
export function getCPTCodeForService(
  cptCodes: CPTDefinition[],
  serviceType: "PIN" | "CHI",
  isBaseCode: boolean
): CPTDefinition | undefined {
  return cptCodes.find(
    (code) => code.serviceType === serviceType && code.isBaseCode === isBaseCode
  )
}

/**
 * Get all time logs for a specific navigator
 */
export function getTimeLogsByNavigator(timeLogs: TimeLog[], navigatorId: string): TimeLog[] {
  return timeLogs.filter((log) => log.navigatorId === navigatorId)
}

/**
 * Get unverified time logs (pending supervisor review)
 */
export function getUnverifiedTimeLogs(timeLogs: TimeLog[]): TimeLog[] {
  return timeLogs.filter((log) => !log.verified)
}

/**
 * Get intake record for a patient
 */
export function getIntakeByPatient(
  intakeRecords: IntakeRecord[],
  patientId: string
): IntakeRecord | undefined {
  return intakeRecords.find((record) => record.patientId === patientId)
}

/**
 * Check if patient has valid consent for billing
 */
export function hasValidConsent(intakeRecords: IntakeRecord[], patientId: string): boolean {
  const intake = getIntakeByPatient(intakeRecords, patientId)
  return intake?.consentObtained ?? false
}

/**
 * Get billing encounters by status
 */
export function getBillingEncountersByStatus(
  encounters: BillingEncounter[],
  status: BillingEncounter["status"]
): BillingEncounter[] {
  return encounters.filter((enc) => enc.status === status)
}

/**
 * Get billing encounters for a patient
 */
export function getBillingEncountersByPatient(
  encounters: BillingEncounter[],
  patientId: string
): BillingEncounter[] {
  return encounters.filter((enc) => enc.patientId === patientId)
}

/**
 * Calculate time duration between start and end timestamps
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.round((end - start) / 1000 / 60)
}
