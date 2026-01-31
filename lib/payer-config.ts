/**
 * Payer Configuration Module
 *
 * Enables payer-agnostic billing with support for:
 * - Medicaid Behavioral Health (H-codes, 15-min increments, Rule of Eights)
 * - Medicare PIN/CHI (G-codes, 60-min base + 30-min add-on)
 */

import type { ActivityType, BillingModel, HCodeDefinition, PayerConfig } from "./types"

// ============================================================================
// H-CODE DEFINITIONS (Medicaid Behavioral Health)
// ============================================================================

/**
 * H-code definitions for Medicaid Behavioral Health billing
 * All codes use 15-minute increments with Rule of Eights
 */
export const H_CODES: HCodeDefinition[] = [
  {
    code: "H0038",
    description: "Self-help/peer services, per 15 minutes",
    unitMinutes: 15,
    activityTypes: ["PEER_SUPPORT", "CHECK_IN"],
  },
  {
    code: "H2015",
    description: "Comprehensive Community Support Services, per 15 minutes",
    unitMinutes: 15,
    activityTypes: ["TRANSPORT", "HOME_VISIT"],
  },
  {
    code: "H0023",
    description: "Behavioral health outreach service, per 15 minutes",
    unitMinutes: 15,
    activityTypes: ["OUTREACH"],
  },
]

// ============================================================================
// PAYER CONFIGURATIONS
// ============================================================================

/**
 * Predefined payer configurations
 * Default is Medicaid BH for the demo (client's current contract)
 */
export const PAYER_CONFIGS: Record<string, PayerConfig> = {
  "medicaid-bh": {
    id: "medicaid-bh",
    name: "Arizona Medicaid (H-Codes)",
    billingModel: "MEDICAID_BH",
    baseMinimum: 8, // Rule of Eights: 8+ minutes = 1 unit
    unitIncrement: 15, // 15-minute increments
    codes: {
      base: "H0038", // Default H-code (peer support)
    },
    useRuleOfEights: true,
    revenueRates: {
      baseRate: 18.50, // Per 15-min unit
    },
  },
  "medicare-pin": {
    id: "medicare-pin",
    name: "Medicare PIN (G-Codes)",
    billingModel: "MEDICARE_PIN",
    baseMinimum: 60, // 60 minutes for base code
    unitIncrement: 30, // 30-minute add-on increments
    codes: {
      base: "G0023",
      addOn: "G0024",
    },
    useRuleOfEights: false,
    revenueRates: {
      baseRate: 125.0, // Per base unit (60 min)
      addOnRate: 62.5, // Per add-on unit (30 min)
    },
  },
  "medicare-chi": {
    id: "medicare-chi",
    name: "Medicare CHI (G-Codes)",
    billingModel: "MEDICARE_CHI",
    baseMinimum: 60,
    unitIncrement: 30,
    codes: {
      base: "G0019",
      addOn: "G0022",
    },
    useRuleOfEights: false,
    revenueRates: {
      baseRate: 125.0,
      addOnRate: 62.5,
    },
  },
}

/**
 * Default payer config for demo
 */
export const DEFAULT_PAYER_CONFIG_ID = "medicaid-bh"

/**
 * Get payer config by ID with fallback to default
 */
export function getPayerConfig(id: string): PayerConfig {
  return PAYER_CONFIGS[id] || PAYER_CONFIGS[DEFAULT_PAYER_CONFIG_ID]
}

/**
 * Get all available payer configs as array
 */
export function getAllPayerConfigs(): PayerConfig[] {
  return Object.values(PAYER_CONFIGS)
}

// ============================================================================
// RULE OF EIGHTS CALCULATOR
// ============================================================================

/**
 * Calculate billable units using the CMS Rule of Eights
 * Used for Medicaid H-code billing with 15-minute increments
 *
 * Rule of Eights logic:
 * - 0-7 minutes: 0 units (not billable)
 * - 8-22 minutes: 1 unit
 * - 23-37 minutes: 2 units
 * - 38-52 minutes: 3 units
 * - 53-67 minutes: 4 units
 * - etc.
 *
 * Formula: Math.floor((totalMinutes + 7) / 15)
 *
 * @param totalMinutes Total minutes of service provided
 * @returns Number of billable 15-minute units
 */
export function calculateRuleOfEightsUnits(totalMinutes: number): number {
  if (totalMinutes < 8) return 0
  return Math.floor((totalMinutes + 7) / 15)
}

/**
 * Get the Rule of Eights breakdown for display
 * Shows the minute ranges for each unit count
 *
 * @param totalMinutes Total minutes of service provided
 * @returns Human-readable breakdown string
 */
export function getRuleOfEightsBreakdown(totalMinutes: number): string {
  const units = calculateRuleOfEightsUnits(totalMinutes)
  if (units === 0) {
    return `${totalMinutes} mins = 0 units (need 8+ mins)`
  }
  return `${totalMinutes} mins = ${units} unit${units > 1 ? "s" : ""}`
}

// ============================================================================
// MEDICARE (G-CODE) CALCULATOR
// ============================================================================

/**
 * Calculate billable units using Medicare G-code rules
 * - 60 minutes minimum for base code (1 unit)
 * - Each additional 30 minutes = 1 add-on unit
 *
 * @param totalMinutes Total minutes of service provided
 * @returns Object with primaryUnits (base code) and addOnUnits (add-on code)
 */
export function calculateMedicareUnits(totalMinutes: number): {
  primaryUnits: number
  addOnUnits: number
} {
  if (totalMinutes < 60) {
    return { primaryUnits: 0, addOnUnits: 0 }
  }

  const remaining = totalMinutes - 60
  return {
    primaryUnits: 1,
    addOnUnits: Math.floor(remaining / 30),
  }
}

// ============================================================================
// UNIFIED BILLING CALCULATOR
// ============================================================================

/**
 * Calculate billable units based on payer configuration
 * Automatically selects the correct calculation method (Rule of Eights vs Medicare)
 *
 * @param totalMinutes Total minutes of service provided
 * @param payerConfig Payer configuration to use for calculation
 * @returns Object with primaryUnits and addOnUnits
 */
export function calculateBillingUnits(
  totalMinutes: number,
  payerConfig: PayerConfig
): { primaryUnits: number; addOnUnits: number } {
  if (payerConfig.useRuleOfEights) {
    // Medicaid: Rule of Eights (all units are primary, no add-on)
    return {
      primaryUnits: calculateRuleOfEightsUnits(totalMinutes),
      addOnUnits: 0,
    }
  } else {
    // Medicare: 60-min base + 30-min add-on
    return calculateMedicareUnits(totalMinutes)
  }
}

/**
 * Calculate claim revenue value based on payer configuration
 *
 * @param primaryUnits Number of base code units
 * @param addOnUnits Number of add-on code units
 * @param payerConfig Payer configuration with rates
 * @returns Total revenue value in dollars
 */
export function calculateClaimValue(
  primaryUnits: number,
  addOnUnits: number,
  payerConfig: PayerConfig
): number {
  const baseValue = primaryUnits * payerConfig.revenueRates.baseRate
  const addOnValue = addOnUnits * (payerConfig.revenueRates.addOnRate || 0)
  return baseValue + addOnValue
}

// ============================================================================
// H-CODE ACTIVITY MAPPING
// ============================================================================

/**
 * Get the appropriate H-code for an activity type
 * Used when billing under Medicaid Behavioral Health
 *
 * @param activityType The type of activity performed
 * @returns H-code string (e.g., "H0038", "H2015", "H0023")
 */
export function getHCodeForActivity(activityType: ActivityType): string {
  const hCode = H_CODES.find((h) => h.activityTypes.includes(activityType))
  return hCode?.code || "H0038" // Default to peer support
}

/**
 * Get the H-code definition for an activity type
 *
 * @param activityType The type of activity performed
 * @returns Full H-code definition or undefined
 */
export function getHCodeDefinitionForActivity(
  activityType: ActivityType
): HCodeDefinition | undefined {
  return H_CODES.find((h) => h.activityTypes.includes(activityType))
}

/**
 * Check if the given billing model is Medicaid (uses H-codes)
 */
export function isMedicaidBilling(billingModel: BillingModel): boolean {
  return billingModel === "MEDICAID_BH"
}

/**
 * Check if the given billing model is Medicare (uses G-codes)
 */
export function isMedicareBilling(billingModel: BillingModel): boolean {
  return billingModel === "MEDICARE_PIN" || billingModel === "MEDICARE_CHI"
}

/**
 * Get minimum billable minutes for a payer configuration
 * Returns the threshold below which time is not billable
 */
export function getMinimumBillableMinutes(payerConfig: PayerConfig): number {
  return payerConfig.baseMinimum
}

/**
 * Check if total minutes meets billing threshold for a payer configuration
 */
export function meetsBillingThreshold(
  totalMinutes: number,
  payerConfig: PayerConfig
): boolean {
  return totalMinutes >= payerConfig.baseMinimum
}
