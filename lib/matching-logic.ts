/**
 * Referral Matching Engine
 * Scores and ranks navigators for optimal patient-navigator matching
 */

import type { Referral, NavigatorAttributes, Zone } from './types'
import { geo } from './geo'
import { zoneForZip } from './zones'

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
 * - Zone match (when zones provided): +15 pts same zone; cross-zone is
 *   informational only (0 pts)
 */
export function calculateMatchScore(
  referral: Referral,
  navigator: NavigatorWithAttributes,
  zones?: Zone[]
): MatchResult {
  const attrs = navigator.attributes
  const matchReasons: string[] = []
  let score = 0

  // -------------------------------------------------------------------------
  // DISTANCE SCORING
  // -------------------------------------------------------------------------
  // Haversine-derived road distance via the geo adapter (whole miles for display)
  const distance = Math.round(geo.zipDistanceMiles(attrs.homeZipCode, referral.zipCode))

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

  // -------------------------------------------------------------------------
  // ZONE SCORING (optional - only when the caller passes the zone list)
  // -------------------------------------------------------------------------
  if (zones && zones.length > 0) {
    const referralZone = zoneForZip(zones, referral.zipCode)
    const navigatorZone = attrs.zoneId
      ? zones.find((z) => z.id === attrs.zoneId)
      : zoneForZip(zones, attrs.homeZipCode)

    if (referralZone && navigatorZone) {
      if (referralZone.id === navigatorZone.id) {
        score += 15
        matchReasons.push(`Zone match: ${referralZone.name} +15 pts`)
      } else {
        matchReasons.push(`Cross-zone: patient in ${referralZone.name}, navigator covers ${navigatorZone.name}`)
      }
    }
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
  navigators: NavigatorWithAttributes[],
  zones?: Zone[]
): RankedNavigator[] {
  const results: RankedNavigator[] = navigators.map(nav => {
    const match = calculateMatchScore(referral, nav, zones)
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
  navigators: NavigatorWithAttributes[],
  zones?: Zone[]
): RankedNavigator | null {
  const ranked = rankNavigatorsForReferral(referral, navigators, zones)

  // Return best match only if score is positive (viable match)
  if (ranked.length > 0 && ranked[0].score > 0) {
    return ranked[0]
  }

  return null
}
