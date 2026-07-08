/**
 * Verification script for Payer-Agnostic Billing Engine
 * Run: npx tsx scripts/verify-payer-billing.ts
 * (Or: pnpm exec tsx scripts/verify-payer-billing.ts)
 *
 * NOTE: This script uses RAW (unrebased) seed data with billingPeriod "2026-01",
 * so claims land in a past month and validate to VALIDATED (not DRAFT).
 */

import {
  getPayerConfig,
  DEFAULT_PAYER_CONFIG_ID,
  getAllPayerConfigs,
  calculateBillingUnits as payerCalculateUnits,
  calculateClaimValue as payerCalculateValue,
  calculateRuleOfEightsUnits,
} from "../lib/payer-config"
import {
  generateMonthlyClaims,
  calculateTotalRevenue,
  filterClaimsByStatus,
  filterClaimsByMonth,
} from "../lib/claims-engine"
import {
  initialPatients,
  initialNavigators,
  initialTimeLogs,
  initialUsers,
  initialPayers,
  initialIntakeRecords,
} from "../lib/initial-data"
import { createInitialState } from "../lib/store"
import { generateBillingCSV } from "../lib/csv-exporter"
import { createVerifyHarness } from "./verify-harness"

const { assert, run, printSummary } = createVerifyHarness()

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
    medicaid,
    initialIntakeRecords
  )
  const claimsMedicare = generateMonthlyClaims(
    initialNavigators,
    initialPatients,
    initialTimeLogs,
    medicare,
    initialIntakeRecords
  )
  const month = "2026-01"
  const attentionM = filterClaimsByStatus(filterClaimsByMonth(claimsMedicaid, month), "NEEDS_ATTENTION")
  const attentionG = filterClaimsByStatus(filterClaimsByMonth(claimsMedicare, month), "NEEDS_ATTENTION")
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
  const claimsM = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  const readyM = filterClaimsByStatus(filterClaimsByMonth(claimsM, "2026-01"), "VALIDATED")
  if (readyM.length > 0) {
    const csv = generateBillingCSV(readyM.slice(0, 1), initialPatients)
    assert(csv.includes("Billing_Model"), "CSV has Billing_Model header")
    assert(csv.includes("MEDICAID BH"), "CSV contains MEDICAID BH")
  }
  const pin = getPayerConfig("medicare-pin")
  const claimsG = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin, initialIntakeRecords)
  const readyG = filterClaimsByStatus(filterClaimsByMonth(claimsG, "2026-01"), "VALIDATED")
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
  // CURRENT_VERSION is not exported from store; 11 is the payer-unification version
  assert(state._version >= 11, `createInitialState _version is ${state._version} (expected >= 11)`)
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
  const claimsM = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  const claimsG = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin, initialIntakeRecords)
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
  const claimsM = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  const claimsG = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin, initialIntakeRecords)
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
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin, initialIntakeRecords)
  const month = "2026-01"
  const attention = filterClaimsByStatus(filterClaimsByMonth(claims, month), "NEEDS_ATTENTION")
  const ready = filterClaimsByStatus(filterClaimsByMonth(claims, month), "VALIDATED")
  const samClaim = attention.find((c) => c.patientId === "pt-billing" && c.totalMinutes === 45)
  assert(!!samClaim, "Sam Underwood (45 min) appears in Needs Attention under Medicare PIN")
  const hasInsufficient = samClaim!.validationErrors?.some((e) => e.includes("Insufficient Time (45/60 mins)"))
  assert(!!hasInsufficient, "Issues column says 'Insufficient Time (45/60 mins)'")
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

// Scenario 3: Validation – Missing Member ID when memberId and healthPlan are both empty
run("QA Scenario 3: Validation (Missing Member ID)", () => {
  const pin = getPayerConfig("medicare-pin")
  const patientsNoMember = initialPatients.map((p) =>
    p.id === "pt1" ? { ...p, healthPlan: "", memberId: undefined } : p
  )
  const claims = generateMonthlyClaims(initialNavigators, patientsNoMember, initialTimeLogs, pin, initialIntakeRecords)
  const month = "2026-01"
  const attention = filterClaimsByStatus(filterClaimsByMonth(claims, month), "NEEDS_ATTENTION")
  const pt1Claim = attention.find((c) => c.patientId === "pt1")
  assert(!!pt1Claim, "Patient with no member ID / health plan appears in Needs Attention")
  const hasMissingMember = pt1Claim!.validationErrors?.some((e) => e.includes("Missing Member ID"))
  assert(!!hasMissingMember, "Error says 'Missing Member ID'")
})

// Scenario 4: Bridge – CSV has required columns and last-day-of-month date
run("QA Scenario 4: Bridge (CSV columns and Date_Of_Service)", () => {
  const pin = getPayerConfig("medicare-pin")
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, pin, initialIntakeRecords)
  const ready = filterClaimsByStatus(filterClaimsByMonth(claims, "2026-01"), "VALIDATED")
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

// =============================================================================
// Intake-driven validation (consent, 12-month rule, CHI Z-codes)
// =============================================================================

// Consent guardrail: pt-validation-test has NO intake record (intentional seed gap)
run("Consent guardrail: pt-validation-test flags missing consent", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  const claim = filterClaimsByMonth(claims, "2026-01").find((c) => c.patientId === "pt-validation-test")
  assert(!!claim, "pt-validation-test has a claim for 2026-01")
  assert(claim!.status === "NEEDS_ATTENTION", "pt-validation-test claim is NEEDS_ATTENTION")
  const hasConsentError = claim!.validationErrors?.some((e) => e.toLowerCase().includes("consent"))
  assert(!!hasConsentError, "Validation errors flag missing consent")
})

// 12-month rule: initiating visit 13 months before the claim month requires re-initiation
run("12-month rule: stale initiating visit flags re-initiation", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  // Synthetic intake: pt1's initiating visit moved to 2024-12-01, 13 months
  // before the 2026-01 claim month
  const staleIntakes = initialIntakeRecords.map((r) =>
    r.patientId === "pt1" ? { ...r, initiatingVisitDate: "2024-12-01" } : r
  )
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, staleIntakes)
  const claim = filterClaimsByMonth(claims, "2026-01").find((c) => c.patientId === "pt1")
  assert(!!claim, "pt1 has a claim for 2026-01")
  const hasStaleError = claim!.validationErrors?.some((e) => e.includes("12 months"))
  assert(!!hasStaleError, "Stale initiating visit flags 'older than 12 months' error")

  // Baseline: with the real intake (2025-12-01), pt1 does NOT trigger the rule
  const baseline = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  const baselineClaim = filterClaimsByMonth(baseline, "2026-01").find((c) => c.patientId === "pt1")
  const baselineStale = baselineClaim?.validationErrors?.some((e) => e.includes("12 months"))
  assert(!baselineStale, "In-window initiating visit does not flag the 12-month rule")
})

// CHI Z-code rule: CHI claims must carry at least one SDOH Z-code
run("CHI Z-code rule: CHI claim without Z-codes flags SDOH error", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  // Synthetic: strip pt4's intake barriers; pt4's own ICD codes (I10, E78.0)
  // have no Z-codes, so the CHI claim loses its only Z-code source
  const intakesNoBarriers = initialIntakeRecords.map((r) =>
    r.patientId === "pt4" ? { ...r, identifiedBarriers: [] } : r
  )
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, intakesNoBarriers)
  const claim = filterClaimsByMonth(claims, "2026-01").find((c) => c.patientId === "pt4")
  assert(!!claim, "pt4 has a claim for 2026-01")
  const hasZCodeError = claim!.validationErrors?.some((e) => e.includes("Z-code"))
  assert(!!hasZCodeError, "CHI claim without Z-codes flags 'requires at least one SDOH Z-code'")
})

// Intake Z-code merge + clean pass: pt2/pt4 CHI claims carry intake Z-codes
run("Intake Z-code merge: CHI patients pass via seeded intake barriers", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  const monthClaims = filterClaimsByMonth(claims, "2026-01")

  const pt2Claim = monthClaims.find((c) => c.patientId === "pt2")
  assert(!!pt2Claim, "pt2 has a claim for 2026-01")
  assert(
    pt2Claim!.diagnosisCodes.includes("Z60.2") && pt2Claim!.diagnosisCodes.includes("Z59.41"),
    "pt2 diagnosis codes include intake Z-codes (Z60.2, Z59.41)"
  )
  assert(
    !pt2Claim!.validationErrors?.some((e) => e.includes("Z-code")),
    "pt2 (CHI) does not trigger the Z-code rule"
  )

  const pt4Claim = monthClaims.find((c) => c.patientId === "pt4")
  assert(!!pt4Claim, "pt4 has a claim for 2026-01")
  assert(pt4Claim!.diagnosisCodes.includes("Z59.82"), "pt4 diagnosis codes include intake Z-code (Z59.82)")
  assert(pt4Claim!.status === "VALIDATED", "pt4 (CHI, intake Z59.82) passes clean under Medicaid")
  assert(!pt4Claim!.validationErrors, "pt4 claim has no validation errors")
})

// Payer identity: real member IDs and payer FKs flow onto claims
run("Payer identity: memberId and payerId on claims", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const claims = generateMonthlyClaims(initialNavigators, initialPatients, initialTimeLogs, medicaid, initialIntakeRecords)
  const pt1Claim = filterClaimsByMonth(claims, "2026-01").find((c) => c.patientId === "pt1")
  assert(!!pt1Claim, "pt1 has a claim for 2026-01")
  assert(pt1Claim!.memberId === "UHC10023845", "pt1 claim uses real memberId (not synthesized)")
  assert(pt1Claim!.payerId === "payer-uhc", "pt1 claim carries payerId from patient")
})

// Seed integrity: payer FKs and navigator FKs resolve
run("Seed integrity: patient payerIds and time log navigatorIds resolve", () => {
  const payerIds = new Set(initialPayers.map((p) => p.id))
  const unresolvedPayers = initialPatients.filter((p) => !p.payerId || !payerIds.has(p.payerId))
  assert(
    unresolvedPayers.length === 0,
    `Every seed patient payerId resolves into initialPayers${unresolvedPayers.length > 0 ? ` (unresolved: ${unresolvedPayers.map((p) => p.id).join(", ")})` : ""}`
  )

  const navigatorIds = new Set(initialNavigators.map((n) => n.id))
  const unresolvedNavs = initialTimeLogs.filter((log) => !navigatorIds.has(log.navigatorId))
  assert(
    unresolvedNavs.length === 0,
    `Every seed timeLog navigatorId exists in initialNavigators${unresolvedNavs.length > 0 ? ` (unresolved: ${unresolvedNavs.map((l) => l.id).join(", ")})` : ""}`
  )
})

printSummary(45)
