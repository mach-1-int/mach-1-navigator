/**
 * Risk Assessment Helpers for Mach 1 Care Navigator
 *
 * Scoring weights, risk score/tier calculation, and referral-to-patient
 * conversion logic used during navigator intake.
 */

import type { Patient, Referral, RiskAssessmentData } from "./types"
import { generateId } from "./store"

/**
 * Risk scoring weights for assessment
 */
export const RISK_WEIGHTS = {
  // Social Determinants (max 60 points)
  housingInsecurity: 20,
  foodInsecurity: 20,
  transportationIssues: 20,
  // Clinical Status (max 45 points)
  recentFall: 15,
  hospitalizedLast30Days: 20,
  polypharmacy: 10,
  // Mobility (max 25 points)
  mobility: {
    independent: 0,
    walker: 10,
    wheelchair: 20,
    bedbound: 25,
  },
} as const

/**
 * Calculate risk score from assessment data
 * @returns Score from 0-100
 */
export function calculateRiskScore(assessment: Omit<RiskAssessmentData, 'riskScore' | 'calculatedTier' | 'completedAt' | 'completedBy'>): number {
  let score = 0

  // Social Determinants
  if (assessment.socialDeterminants.housingInsecurity) score += RISK_WEIGHTS.housingInsecurity
  if (assessment.socialDeterminants.foodInsecurity) score += RISK_WEIGHTS.foodInsecurity
  if (assessment.socialDeterminants.transportationIssues) score += RISK_WEIGHTS.transportationIssues

  // Clinical Status
  if (assessment.clinicalStatus.recentFall) score += RISK_WEIGHTS.recentFall
  if (assessment.clinicalStatus.hospitalizedLast30Days) score += RISK_WEIGHTS.hospitalizedLast30Days
  if (assessment.clinicalStatus.polypharmacy) score += RISK_WEIGHTS.polypharmacy

  // Mobility
  score += RISK_WEIGHTS.mobility[assessment.mobility]

  // Cap at 100
  return Math.min(score, 100)
}

/**
 * Determine risk tier from score
 * Low: 0-30, Medium: 31-60, High: 61-100
 */
export function calculateRiskTier(score: number): 1 | 2 | 3 {
  if (score <= 30) return 1 // Low
  if (score <= 60) return 2 // Medium
  return 3 // High
}

/**
 * Create a full patient record from a referral
 */
export function createPatientFromReferral(
  referral: Referral,
  navigatorId: string,
  supervisorId: string = "sup1"
): Patient {
  const rawData = referral.rawData

  return {
    id: generateId(),
    name: rawData.PID.patientName,
    dob: rawData.PID.dob,
    chartNumber: `GH-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
    riskLevel: referral.riskScore,
    survivalStatus: "active",
    assignedNavigator: navigatorId,
    assignedSupervisor: supervisorId,
    healthPlan: rawData.IN1.payerName,
    enrollmentDate: new Date().toISOString().split('T')[0],
    lastContactDate: new Date().toISOString().split('T')[0],
    medicationCompliance: 0, // New patient, no compliance data yet
    pcpCompliance: false,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    // Additional intake fields
    address: rawData.PID.address,
    phone: rawData.PID.phone,
    email: rawData.PID.email,
    primaryDiagnosis: rawData.DG1.primaryDiagnosis,
    icdCodes: rawData.DG1.icdCodes,
    referralSource: referral.source,
  }
}
