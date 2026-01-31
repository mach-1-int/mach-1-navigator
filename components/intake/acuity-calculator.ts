import type { AcuityScore, ZCode } from "@/lib/types"

/**
 * Domain scores for acuity calculation
 */
export interface AcuityInputs {
  clinical: 0 | 1 | 2 | 3
  psychosocial: 0 | 1 | 2 | 3
  barriers: 0 | 1 | 2 | 3
  literacy: 0 | 1 | 2 | 3
}

/**
 * SDOH screening inputs
 */
export interface SDOHScreeningInputs {
  housingInsecurity: boolean
  foodInsecurity: boolean
  transportationInsecurity: boolean
  financialStrain: boolean
  socialIsolation: boolean
  employmentIssues: boolean
}

/**
 * Calculate the acuity score from 4 domain inputs
 *
 * Scoring Matrix:
 * - Each domain: 0 (None), 1 (Mild), 2 (Moderate), 3 (Severe)
 * - Total Score: 0-12
 * - Level: Low (0-3), Moderate (4-7), High (8-12)
 *
 * @param inputs - The 4 domain scores
 * @returns Complete AcuityScore object
 */
export function calculateAcuity(inputs: AcuityInputs): AcuityScore {
  const totalScore = inputs.clinical + inputs.psychosocial + inputs.barriers + inputs.literacy

  let level: AcuityScore["level"]
  if (totalScore <= 3) {
    level = "Low"
  } else if (totalScore <= 7) {
    level = "Moderate"
  } else {
    level = "High"
  }

  return {
    clinical: inputs.clinical,
    psychosocial: inputs.psychosocial,
    barriers: inputs.barriers,
    literacy: inputs.literacy,
    totalScore,
    level,
  }
}

/**
 * Domain descriptions for UI display
 */
export const ACUITY_DOMAINS = {
  clinical: {
    label: "Clinical Complexity",
    description: "Medical conditions, comorbidities, treatment complexity",
    options: [
      { value: 0, label: "None", description: "Stable, well-managed conditions" },
      { value: 1, label: "Mild", description: "1-2 chronic conditions, minimal complexity" },
      { value: 2, label: "Moderate", description: "Multiple conditions, regular monitoring needed" },
      { value: 3, label: "Severe", description: "Complex multi-morbidity, high medical needs" },
    ],
  },
  psychosocial: {
    label: "Psychosocial Factors",
    description: "Mental health, family support, coping ability",
    options: [
      { value: 0, label: "None", description: "Strong support system, good coping" },
      { value: 1, label: "Mild", description: "Minor stress, adequate support" },
      { value: 2, label: "Moderate", description: "Anxiety/depression, limited support" },
      { value: 3, label: "Severe", description: "Significant mental health issues, isolated" },
    ],
  },
  barriers: {
    label: "Access Barriers",
    description: "Transportation, technology, geographic access",
    options: [
      { value: 0, label: "None", description: "No significant barriers to care" },
      { value: 1, label: "Mild", description: "Occasional transportation issues" },
      { value: 2, label: "Moderate", description: "Regular access challenges" },
      { value: 3, label: "Severe", description: "Multiple major barriers to care" },
    ],
  },
  literacy: {
    label: "Health Literacy",
    description: "Understanding of health information, self-management ability",
    options: [
      { value: 0, label: "None", description: "High health literacy, self-directed" },
      { value: 1, label: "Mild", description: "Generally understands, occasional clarification" },
      { value: 2, label: "Moderate", description: "Needs regular education and support" },
      { value: 3, label: "Severe", description: "Significant comprehension challenges" },
    ],
  },
} as const

/**
 * Get acuity level color for UI
 */
export function getAcuityLevelColor(level: AcuityScore["level"]): string {
  switch (level) {
    case "Low":
      return "text-green-600 bg-green-50 border-green-200"
    case "Moderate":
      return "text-amber-600 bg-amber-50 border-amber-200"
    case "High":
      return "text-red-600 bg-red-50 border-red-200"
  }
}

/**
 * Get suggested Z-codes based on SDOH screening responses
 * Maps screening responses to appropriate ICD-10 Z-codes
 */
export function getSuggestedZCodes(
  screening: SDOHScreeningInputs,
  availableZCodes: ZCode[]
): ZCode[] {
  const suggestions: ZCode[] = []

  if (screening.housingInsecurity) {
    const housingCodes = availableZCodes.filter((z) => z.category === "Housing")
    // Suggest primary housing code
    const primary = housingCodes.find((z) => z.code === "Z59.0" || z.code === "Z59.1")
    if (primary) suggestions.push(primary)
  }

  if (screening.foodInsecurity) {
    const foodCodes = availableZCodes.filter((z) => z.category === "Food")
    const primary = foodCodes.find((z) => z.code === "Z59.41")
    if (primary) suggestions.push(primary)
  }

  if (screening.transportationInsecurity) {
    const transportCodes = availableZCodes.filter((z) => z.category === "Transport")
    const primary = transportCodes.find((z) => z.code === "Z59.82")
    if (primary) suggestions.push(primary)
  }

  if (screening.financialStrain) {
    const financialCodes = availableZCodes.filter((z) => z.category === "Financial")
    const primary = financialCodes.find((z) => z.code === "Z59.6" || z.code === "Z59.5")
    if (primary) suggestions.push(primary)
  }

  if (screening.socialIsolation) {
    const socialCodes = availableZCodes.filter((z) => z.category === "Social")
    const primary = socialCodes.find((z) => z.code === "Z60.2" || z.code === "Z60.4")
    if (primary) suggestions.push(primary)
  }

  if (screening.employmentIssues) {
    const employmentCodes = availableZCodes.filter((z) => z.category === "Employment")
    const primary = employmentCodes.find((z) => z.code === "Z56.0")
    if (primary) suggestions.push(primary)
  }

  return suggestions
}

/**
 * Calculate the barrier score from SDOH screening
 * Used to auto-suggest the barriers domain score
 */
export function calculateBarrierScore(screening: SDOHScreeningInputs): 0 | 1 | 2 | 3 {
  const barrierCount = [
    screening.housingInsecurity,
    screening.foodInsecurity,
    screening.transportationInsecurity,
    screening.financialStrain,
    screening.socialIsolation,
    screening.employmentIssues,
  ].filter(Boolean).length

  if (barrierCount === 0) return 0
  if (barrierCount <= 2) return 1
  if (barrierCount <= 4) return 2
  return 3
}

/**
 * Validate initiating visit date
 * CMS requires the initiating visit to be within the past 12 months
 */
export function validateInitiatingVisitDate(date: Date): {
  isValid: boolean
  warning?: string
  error?: string
} {
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const elevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, now.getDate())

  if (date > now) {
    return {
      isValid: false,
      error: "Initiating visit date cannot be in the future",
    }
  }

  // Error for dates > 12 months ago (blocks progress)
  if (date < oneYearAgo) {
    return {
      isValid: false,
      error: "Referral Expired: Initiating visit must be within 12 months.",
    }
  }

  // Warning for dates approaching the 12-month limit (11+ months ago)
  if (date < elevenMonthsAgo) {
    return {
      isValid: true,
      warning: "Approaching 12-month limit. Complete intake soon to maintain billing eligibility.",
    }
  }

  return { isValid: true }
}
