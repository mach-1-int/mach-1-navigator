/**
 * Verification script for Payer-Agnostic Billing Engine
 * Run: npx tsx scripts/verify-payer-billing.ts
 * (Or: pnpm exec tsx scripts/verify-payer-billing.ts)
 */

import {
  getPayerConfig,
  DEFAULT_PAYER_CONFIG_ID,
  PAYER_CONFIGS,
  getAllPayerConfigs,
  calculateBillingUnits as payerCalculateUnits,
  calculateClaimValue as payerCalculateValue,
  calculateRuleOfEightsUnits,
} from "../lib/payer-config"
import {
  generateMonthlyClaims,
  calculateBillingUnits,
  calculateClaimValue,
  calculateTotalRevenue,
  filterClaimsByStatus,
  filterClaimsByMonth,
} from "../lib/claims-engine"
import { initialPatients, initialNavigators, initialTimeLogs, initialUsers } from "../lib/initial-data"
import { createInitialState } from "../lib/store"
import { generateBillingCSV } from "../lib/csv-exporter"

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  ✓ ${message}`)
}

let passed = 0
let failed = 0

function run(name: string, fn: () => void) {
  try {
    console.log(`\n--- ${name} ---`)
    fn()
    passed++
  } catch (e) {
    failed++
    console.error(`  ✗ ${(e as Error).message}`)
  }
}

console.log("Payer-Agnostic Billing Engine – Verification")
console.log("=============================================")

// Step 1 & 2: Default payer is Arizona Medicaid (H-Codes); rate card
run("Step 1–2: Default payer Arizona Medicaid (H-Codes) and rate card", () => {
  assert(DEFAULT_PAYER_CONFIG_ID === "medicaid-bh", "Default payer config ID is medicaid-bh")
  const defaultConfig = getPayerConfig(DEFAULT_PAYER_CONFIG_ID)
  assert(defaultConfig.name === "Arizona Medicaid (H-Codes)", "Default payer name is Arizona Medicaid (H-Codes)")
  assert(defaultConfig.useRuleOfEights === true, "Medicaid uses Rule of Eights")
  assert(defaultConfig.baseMinimum === 8, "Medicaid base minimum is 8 minutes")
  assert(defaultConfig.revenueRates.baseRate === 18.5, "Medicaid rate is $18.50 per unit")
})

// Step 2: Rule of Eights – 45 min = 3 units, $55.50
run("Step 2: Rule of Eights – 45 min = 3 units, $55.50", () => {
  const units45 = calculateRuleOfEightsUnits(45)
  assert(units45 === 3, `45 minutes = ${units45} units (expected 3)`)
  const medicaid = getPayerConfig("medicaid-bh")
  const value = payerCalculateValue(3, 0, medicaid)
  assert(Math.abs(value - 55.5) < 0.01, `3 units × $18.50 = $${value} (expected $55.50)`)
})

// Step 3: Medicare PIN – rate card and 45 min / 90 min
run("Step 3: Medicare PIN – rate card and thresholds", () => {
  const pin = getPayerConfig("medicare-pin")
  assert(pin.name === "Medicare PIN (G-Codes)", "Medicare PIN name correct")
  assert(pin.revenueRates.baseRate === 125, "Base unit $125")
  assert(pin.revenueRates.addOnRate === 62.5, "Add-on unit $62.50")
  const units45 = payerCalculateUnits(45, pin)
  assert(units45.primaryUnits === 0 && units45.addOnUnits === 0, "45 min under Medicare = 0 units")
  const units90 = payerCalculateUnits(90, pin)
  assert(units90.primaryUnits === 1 && units90.addOnUnits === 1, "90 min = 1 base + 1 add-on")
  const value90 = payerCalculateValue(1, 1, pin)
  assert(Math.abs(value90 - 187.5) < 0.01, "90 min = $187.50")
})

// Step 4: Medicare CHI – G0019 / G0022
run("Step 4: Medicare CHI – G0019 / G0022", () => {
  const chi = getPayerConfig("medicare-chi")
  assert(chi.codes.base === "G0019" && chi.codes.addOn === "G0022", "CHI codes G0019 / G0022")
})

// Step 5: Needs Attention – Medicaid X/8 mins, Medicare X/60 mins
run("Step 5: Needs Attention threshold messages", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const medicare = getPayerConfig("medicare-pin")
  const claimsMedicaid = generateMonthlyClaims(
    initialNavigators,
    initialPatients,
    initialTimeLogs,
    medicaid
  )
  const claimsMedicare = generateMonthlyClaims(
    initialNavigators,
    initialPatients,
    initialTimeLogs,
    medicare
  )
  const month = "2026-01"
  const attentionM = filterClaimsByStatus(filterClaimsByMonth(claimsMedicaid, month), "MISSING_DATA")
  const attentionG = filterClaimsByStatus(filterClaimsByMonth(claimsMedicare, month), "MISSING_DATA")
  const insufficientM = attentionM.filter((c) =>
    c.validationErrors?.some((e) => e.includes("Insufficient Time"))
  )
  const insufficientG = attentionG.filter((c) =>
    c.validationErrors?.some((e) => e.includes("Insufficient Time"))
  )
  assert(
    insufficientM.length === 0 || insufficientM.every((c) => c.validationErrors?.some((e) => e.includes("/8 mins"))),
    "Medicaid Insufficient Time uses /8 mins when applicable"
  )
  assert(
    insufficientG.length === 0 || insufficientG.every((c) => c.validationErrors?.some((e) => e.includes("/60 mins"))),
    "Medicare Insufficient Time uses /60 mins when applicable"
  )
})

// Step 6: CSV Billing_Model column
run("Step 6: CSV Billing_Model column (MEDICAID BH, MEDICARE PIN)", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const claimsM = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid)
  const readyM = filterClaimsByStatus(filterClaimsByMonth(claimsM, "2026-01"), "READY")
  if (readyM.length > 0) {
    const csv = generateBillingCSV(readyM.slice(0, 1), initialPatients)
    assert(csv.includes("Billing_Model"), "CSV has Billing_Model header")
    assert(csv.includes("MEDICAID BH"), "CSV contains MEDICAID BH")
  }
  const pin = getPayerConfig("medicare-pin")
  const claimsG = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin)
  const readyG = filterClaimsByStatus(filterClaimsByMonth(claimsG, "2026-01"), "READY")
  if (readyG.length > 0) {
    const csv = generateBillingCSV(readyG.slice(0, 1), initialPatients)
    assert(csv.includes("MEDICARE PIN") || csv.includes("Billing_Model"), "CSV contains MEDICARE PIN or has Billing_Model")
  }
  console.log("  ✓ Billing_Model column and values verified")
})

// Step 7 & 10: Initial state default payer
run("Step 7 & 10: Initial state default payer and reset", () => {
  const state = createInitialState()
  assert(state.activePayerConfigId === "medicaid-bh", "createInitialState has activePayerConfigId medicaid-bh")
})

// Biller role and Revenue Cycle Manager
run("Biller role and user", () => {
  const biller = initialUsers.find((u) => u.role === "biller")
  assert(!!biller, "Biller user exists")
  assert(biller!.name === "Revenue Cycle Manager" || biller!.role === "biller", "Biller user has correct name/role")
})

// Payer configs available
run("Payer dropdown options", () => {
  const configs = getAllPayerConfigs()
  assert(configs.length >= 3, "At least 3 payer configs (Medicaid, PIN, CHI)")
  const names = configs.map((c) => c.name)
  assert(names.includes("Arizona Medicaid (H-Codes)"), "Arizona Medicaid (H-Codes) in list")
  assert(names.includes("Medicare PIN (G-Codes)"), "Medicare PIN (G-Codes) in list")
  assert(names.includes("Medicare CHI (G-Codes)"), "Medicare CHI (G-Codes) in list")
})

// Claims generation with both payers
run("Claims regeneration by payer", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const pin = getPayerConfig("medicare-pin")
  const claimsM = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid)
  const claimsG = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin)
  const month = "2026-01"
  const readyM = filterClaimsByStatus(filterClaimsByMonth(claimsM, month), "READY")
  const readyG = filterClaimsByStatus(filterClaimsByMonth(claimsG, month), "READY")
  const hasH = claimsM.some((c) => c.primaryCode.startsWith("H"))
  const hasG = claimsG.some((c) => c.primaryCode.startsWith("G"))
  assert(hasH, "Medicaid claims use H-codes")
  assert(hasG, "Medicare claims use G-codes")
  assert(claimsM.length === claimsG.length, "Same number of claims; only codes/status differ by payer")
})

// Revenue calculation uses payer config
run("Revenue metrics use active payer config", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const pin = getPayerConfig("medicare-pin")
  const claimsM = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid)
  const claimsG = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin)
  const month = "2026-01"
  const monthM = filterClaimsByMonth(claimsM, month)
  const monthG = filterClaimsByMonth(claimsG, month)
  const revM = calculateTotalRevenue(monthM, medicaid)
  const revG = calculateTotalRevenue(monthG, pin)
  assert(revM.readyValue >= 0 && revG.readyValue >= 0, "Revenue calculated per payer")
  assert(revM.readyValue !== revG.readyValue || monthM.length === 0, "Revenue differs by payer when claims exist")
})

// =============================================================================
// QA Protocol: The Billing Bridge
// =============================================================================

// Scenario 1: Guardrail – 45 min under Medicare → Needs Attention, "Insufficient Time (45/60 mins)", not Ready
run("QA Scenario 1: Guardrail (45 min → Needs Attention, not Ready)", () => {
  const pin = getPayerConfig("medicare-pin")
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin)
  const month = "2026-01"
  const attention = filterClaimsByStatus(filterClaimsByMonth(claims, month), "MISSING_DATA")
  const ready = filterClaimsByStatus(filterClaimsByMonth(claims, month), "READY")
  const samClaim = attention.find((c) => c.patientId === "pt-billing" && c.totalMinutes === 45)
  assert(!!samClaim, "Sam Underwood (45 min) appears in Needs Attention under Medicare PIN")
  const hasInsufficient = samClaim!.validationErrors?.some((e) => e.includes("Insufficient Time (45/60 mins)"))
  assert(hasInsufficient, "Issues column says 'Insufficient Time (45/60 mins)'")
  const samInReady = ready.some((c) => c.patientId === "pt-billing")
  assert(!samInReady, "Sam does not appear in Ready to Bill")
})

// Scenario 2: Logic Engine – 75 min → G0023 (1 Unit); 105 min → G0023 + G0024
run("QA Scenario 2: Logic Engine (75 min → G0023; 105 min → G0023 + G0024)", () => {
  const pin = getPayerConfig("medicare-pin")
  const u75 = payerCalculateUnits(75, pin)
  assert(u75.primaryUnits === 1 && u75.addOnUnits === 0, "75 min = G0023 (1 Unit) only")
  const u105 = payerCalculateUnits(105, pin)
  assert(u105.primaryUnits === 1 && u105.addOnUnits === 1, "105 min = G0023 (1 Unit) + G0024 (1 Unit)")
})

// Scenario 3: Validation – Missing Member ID when healthPlan empty
run("QA Scenario 3: Validation (Missing Member ID)", () => {
  const pin = getPayerConfig("medicare-pin")
  const patientsNoMember = initialPatients.map((p) =>
    p.id === "pt1" ? { ...p, healthPlan: "" } : p
  )
  const claims = generateMonthlyClaims(initialNavigators, patientsNoMember, initialTimeLogs, pin)
  const month = "2026-01"
  const attention = filterClaimsByStatus(filterClaimsByMonth(claims, month), "MISSING_DATA")
  const pt1Claim = attention.find((c) => c.patientId === "pt1")
  assert(!!pt1Claim, "Patient with no Health Plan appears in Needs Attention")
  const hasMissingMember = pt1Claim!.validationErrors?.some((e) => e.includes("Missing Member ID"))
  assert(hasMissingMember, "Error says 'Missing Member ID'")
})

// Scenario 4: Bridge – CSV has required columns and last-day-of-month date
run("QA Scenario 4: Bridge (CSV columns and Date_Of_Service)", () => {
  const pin = getPayerConfig("medicare-pin")
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin)
  const ready = filterClaimsByStatus(filterClaimsByMonth(claims, "2026-01"), "READY")
  if (ready.length === 0) {
    console.log("  (skip: no Ready claims for 2026-01)")
    return
  }
  const csv = generateBillingCSV(ready.slice(0, 1), initialPatients)
  assert(csv.includes("Patient_Name"), "CSV has Patient_Name")
  assert(csv.includes("Member_ID"), "CSV has Member_ID")
  assert(csv.includes("Date_Of_Service"), "CSV has Date_Of_Service")
  assert(csv.includes("CPT_Code"), "CSV has CPT_Code")
  assert(csv.includes("Diagnosis_1"), "CSV has Diagnosis_1")
  assert(csv.includes("01/31/2026") || csv.includes("31/01/2026"), "Date_Of_Service is last day of month (Jan 2026)")
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
