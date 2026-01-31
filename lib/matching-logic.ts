/**
 * Referral Matching Engine
 * Scores and ranks navigators for optimal patient-navigator matching
 */

import type { Referral, NavigatorAttributes } from './types'

// ============================================================================
// DISTANCE UTILITY
// ============================================================================

/**
 * Mock distance lookup for demo purposes
 * Hardcoded distances between specific Arizona zip codes
 */
const MOCK_DISTANCES: Record<string, Record<string, number>> = {
  '85301': { '85303': 3 },   // Glendale to West Valley Patient
  '85001': { '85303': 15 },  // Central Phoenix to West Valley Patient
  '85201': { '85303': 35 },  // Mesa to West Valley Patient
  '85303': { '85301': 3, '85001': 15, '85201': 35 },  // Reverse lookups consolidated
}

const DEFAULT_DISTANCE = 20 // Default fallback distance in miles

/**
 * Get mock distance between two zip codes
 * In production, this would call a geocoding API
 */
export function getMockDistance(zip1: string, zip2: string): number {
  // Same zip = 0 distance
  if (zip1 === zip2) return 0

  // Check direct lookup
  if (MOCK_DISTANCES[zip1]?.[zip2] !== undefined) {
    return MOCK_DISTANCES[zip1][zip2]
  }

  // Check reverse lookup
  if (MOCK_DISTANCES[zip2]?.[zip1] !== undefined) {
    return MOCK_DISTANCES[zip2][zip1]
  }

  // Default fallback
  return DEFAULT_DISTANCE
}

// ============================================================================
// SCORING FUNCTION
// ============================================================================

export interface MatchResult {
  score: number
  distance: number
  matchReasons: string[]
}

export interface NavigatorWithAttributes {
  id: string
  name: string
  attributes: NavigatorAttributes
}

/**
 * Calculate match score between a referral and a navigator
 * Higher scores = better match
 *
 * Scoring breakdown:
 * - Distance (within radius): +40 pts, (outside radius): -100 (hard fail)
 * - Capacity: +30 pts * (1 - current/max), full navigators get 0
 * - Language match: +20 pts, mismatch when needed: -50 (hard fail)
 * - Acuity capability: +10 pts if navigator can handle required level
 */
export function calculateMatchScore(
  referral: Referral,
  navigator: NavigatorWithAttributes
): MatchResult {
  const attrs = navigator.attributes
  const matchReasons: string[] = []
  let score = 0

  // -------------------------------------------------------------------------
  // DISTANCE SCORING
  // -------------------------------------------------------------------------
  const distance = getMockDistance(attrs.homeZipCode, referral.zipCode)

  if (distance <= attrs.serviceAreaRadius) {
    score += 40
    matchReasons.push(`Within service area (${distance} mi < ${attrs.serviceAreaRadius} mi radius)`)
  } else {
    // Hard fail - outside service area
    score -= 100
    matchReasons.push(`❌ Outside service area (${distance} mi > ${attrs.serviceAreaRadius} mi radius)`)
  }

  // -------------------------------------------------------------------------
  // CAPACITY SCORING
  // -------------------------------------------------------------------------
  const capacityRatio = attrs.currentCaseload / attrs.maxCaseload
  const capacityScore = 30 * (1 - capacityRatio)
  score += capacityScore

  if (capacityRatio >= 1) {
    matchReasons.push(`⚠️ At full capacity (${attrs.currentCaseload}/${attrs.maxCaseload})`)
  } else if (capacityRatio >= 0.8) {
    matchReasons.push(`Near capacity (${attrs.currentCaseload}/${attrs.maxCaseload}) +${capacityScore.toFixed(0)} pts`)
  } else {
    matchReasons.push(`Available capacity (${attrs.currentCaseload}/${attrs.maxCaseload}) +${capacityScore.toFixed(0)} pts`)
  }

  // -------------------------------------------------------------------------
  // LANGUAGE SCORING
  // -------------------------------------------------------------------------
  const patientLanguage = referral.language || 'en'
  const navigatorHasLanguage = attrs.languages.includes(patientLanguage)

  if (patientLanguage !== 'en') {
    // Non-English patient - language match is critical
    if (navigatorHasLanguage) {
      score += 20
      matchReasons.push(`Language match: ${patientLanguage.toUpperCase()} +20 pts`)
    } else {
      // Hard fail - language mismatch for non-English speaker
      score -= 50
      matchReasons.push(`❌ Language mismatch: Patient needs ${patientLanguage.toUpperCase()}, navigator speaks ${attrs.languages.join(', ').toUpperCase()}`)
    }
  } else {
    // English patient - most navigators speak English, minor bonus
    if (navigatorHasLanguage) {
      matchReasons.push(`Language: English ✓`)
    }
  }

  // -------------------------------------------------------------------------
  // ACUITY SCORING
  // -------------------------------------------------------------------------
  const requiredAcuity = referral.requiredAcuity
  const hasAcuityCapability = attrs.acuityCapabilities.includes(requiredAcuity)

  if (hasAcuityCapability) {
    score += 10
    matchReasons.push(`Acuity capable: ${requiredAcuity} +10 pts`)
  } else {
    matchReasons.push(`⚠️ Not certified for ${requiredAcuity} acuity`)
  }

  return {
    score,
    distance,
    matchReasons
  }
}

// ============================================================================
// BATCH MATCHING
// ============================================================================

export interface RankedNavigator extends MatchResult {
  navigatorId: string
  navigatorName: string
}

/**
 * Rank all available navigators for a given referral
 * Returns sorted list with best matches first
 */
export function rankNavigatorsForReferral(
  referral: Referral,
  navigators: NavigatorWithAttributes[]
): RankedNavigator[] {
  const results: RankedNavigator[] = navigators.map(nav => {
    const match = calculateMatchScore(referral, nav)
    return {
      navigatorId: nav.id,
      navigatorName: nav.name,
      ...match
    }
  })

  // Sort by score descending (highest first)
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Get the best matching navigator for a referral
 * Returns null if no suitable match (all scores negative)
 */
export function getBestMatch(
  referral: Referral,
  navigators: NavigatorWithAttributes[]
): RankedNavigator | null {
  const ranked = rankNavigatorsForReferral(referral, navigators)

  // Return best match only if score is positive (viable match)
  if (ranked.length > 0 && ranked[0].score > 0) {
    return ranked[0]
  }

  return null
}
