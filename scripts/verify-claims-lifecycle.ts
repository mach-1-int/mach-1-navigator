/**
 * Verify: Claim Lifecycle + EDI pipeline
 *
 * Run with: npm run verify:claims
 *
 * Proves:
 * 1. The transition matrix permits exactly the legal lifecycle paths
 * 2. Export creates immutable, versioned ClaimRecord snapshots
 * 3. The 837P generator emits real month-end dates, the org NPI, and no
 *    hardcoded provider strings
 * 4. A simulated 835 round-trips through the parser and the matcher resolves
 *    100% of payments by CLP01
 * 5. The billing progress engine is payer-aware (Rule of Eights vs base+add-on)
 */

import { getPayerConfig } from "../lib/payer-config"
import {
  CLAIM_TRANSITIONS,
  canTransition,
  createClaimRecords,
  transitionClaimRecord,
  getActiveClaimRecordKeys,
} from "../lib/claim-lifecycle"
import { generate837P } from "../lib/edi/edi-837p-generator"
import { parse835 } from "../lib/edi/edi-835-parser"
import { generateSample835 } from "../lib/edi/edi-835-simulator"
import { matchRemittance } from "../lib/edi/remittance-matcher"
import { generateMonthlyClaims, filterClaimsByMonth } from "../lib/claims-engine"
import { calculateMonthlyBillingProgress } from "../lib/billing-engine"
import {
  initialNavigators,
  initialPatients,
  initialTimeLogs,
  initialIntakeRecords,
  initialPayers,
  initialOrganizationSettings,
} from "../lib/initial-data"
import type { ClaimRecord, ClaimStatus } from "../lib/types"

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function run(title: string, fn: () => void) {
  console.log(`\n--- ${title} ---`)
  try {
    fn()
  } catch (err) {
    failed++
    console.error(`  ✗ threw: ${err instanceof Error ? err.message : err}`)
  }
}

// Shared fixtures: claims from raw (unrebased) seeds are past-month VALIDATED
const medicaid = getPayerConfig("medicaid-bh")
const allClaims = generateMonthlyClaims(
  initialNavigators,
  initialPatients,
  initialTimeLogs,
  medicaid,
  initialIntakeRecords
)
const validated = filterClaimsByMonth(allClaims, "2026-01").filter((c) => c.status === "VALIDATED")

function exportFixture(): ClaimRecord[] {
  return createClaimRecords(validated, initialPayers, medicaid, "837P", "verify-script", [])
}

// =============================================================================
run("Transition matrix", () => {
  assert(canTransition("EXPORTED", "SUBMITTED"), "EXPORTED -> SUBMITTED legal")
  assert(canTransition("SUBMITTED", "ACCEPTED"), "SUBMITTED -> ACCEPTED legal")
  assert(canTransition("SUBMITTED", "REJECTED"), "SUBMITTED -> REJECTED legal")
  assert(canTransition("ACCEPTED", "PAID"), "ACCEPTED -> PAID legal")
  assert(canTransition("ACCEPTED", "DENIED"), "ACCEPTED -> DENIED legal")
  assert(!canTransition("EXPORTED", "PAID"), "EXPORTED -> PAID illegal (must submit first)")
  assert(!canTransition("PAID", "DENIED"), "PAID is terminal")
  assert(!canTransition("REJECTED", "SUBMITTED"), "REJECTED is terminal (reopen instead)")
  const derived: ClaimStatus[] = ["DRAFT", "NEEDS_ATTENTION", "VALIDATED"]
  assert(
    derived.every((s) => CLAIM_TRANSITIONS[s].length === 0),
    "Derived statuses never transition (export creates records)"
  )
})

run("ClaimRecord snapshots + versioned rebill ids", () => {
  assert(validated.length >= 2, `Fixture has VALIDATED claims to export (${validated.length})`)
  const records = exportFixture()
  assert(records.length === validated.length, "One record per exported claim")
  assert(records.every((r) => r.status === "EXPORTED"), "Records start EXPORTED")
  assert(records.every((r) => r.id.endsWith("-v1")), "First export gets -v1 ids")
  assert(
    records.every((r) => r.statusHistory.length === 1 && r.statusHistory[0].status === "EXPORTED"),
    "History starts with the export event"
  )
  // Rebill: same claim exported again with prior records present gets -v2
  const rebill = createClaimRecords([validated[0]], initialPayers, medicaid, "CSV", "verify-script", records)
  assert(rebill[0].id.endsWith("-v2"), "Rebill of an exported claim gets -v2")
  // Snapshot immutability: mutating the source claim after export must not change the record
  const before = JSON.stringify(records[0].snapshot)
  validated[0].totalMinutes = 99999
  assert(JSON.stringify(records[0].snapshot) === before, "Snapshot is frozen at export time")
  validated[0].totalMinutes = records[0].snapshot.totalMinutes // restore
  // Active-key exclusion
  const keys = getActiveClaimRecordKeys(records)
  assert(keys.size === records.length, "Active record keys cover exported patient-months")
  const voided = { ...records[0], voided: true }
  const keysAfterVoid = getActiveClaimRecordKeys([voided, ...records.slice(1)])
  assert(keysAfterVoid.size === records.length - 1, "Voided records release their patient-month")
})

run("Illegal transitions are rejected", () => {
  const [record] = exportFixture()
  assert(transitionClaimRecord(record, "PAID", "x") === null, "EXPORTED -> PAID returns null")
  const submitted = transitionClaimRecord(record, "SUBMITTED", "verify")!
  assert(submitted.status === "SUBMITTED" && submitted.statusHistory.length === 2, "Legal transition appends history")
  assert(submitted.submittedAt !== undefined, "submittedAt stamped on SUBMITTED")
})

run("837P generation", () => {
  const records = exportFixture()
  const payer = initialPayers.find((p) => p.payerConfigId === medicaid.id)!
  const x12 = generate837P(records, {
    patients: initialPatients,
    navigators: initialNavigators,
    payer,
    payerConfig: medicaid,
    orgSettings: initialOrganizationSettings,
  })
  assert(x12.startsWith("ISA"), "Starts with ISA envelope")
  assert(x12.includes("ST*837*"), "Contains ST*837 transaction set")
  assert(x12.includes(initialOrganizationSettings.npi), "Contains the org NPI from settings")
  assert(!x12.includes("Dr. Supervising MD"), "No hardcoded provider strings")
  assert(x12.includes(`CLM*${records[0].id}*`), "CLM01 echoes the ClaimRecord id")
  // Real month-end: January 2026 ends on the 31st, never the -28 approximation
  assert(x12.includes("20260131"), "DTP*434 uses the real last day of the month (Jan 31)")
  assert(!/2026012[0-8][~*]/.test(x12.slice(x12.indexOf("DTP*434"), x12.indexOf("DTP*434") + 40)), "No -28 month-end approximation")
})

run("835 round-trip + matcher", () => {
  const records = exportFixture()
    .map((r) => transitionClaimRecord(r, "SUBMITTED", "verify")!)
  const era = generateSample835(records, initialPayers, { scenario: "MIXED", seed: 42 })
  const remit = parse835(era)
  assert(remit.claims.length === records.length, "835 carries one CLP per record")
  assert(remit.warnings.length === 0, "Simulator output parses with zero warnings")
  const result = matchRemittance(remit, records)
  assert(result.matches.length === records.length, "Matcher resolves 100% of payments")
  assert(result.unmatchedCount === 0, "No unmatched payments")
  assert(
    result.matches.every((m) => m.resolvedStatus === "PAID" || m.resolvedStatus === "DENIED"),
    "Every match resolves to PAID or DENIED"
  )
  assert(
    result.matches.every((m) => m.remittance.carcCodes !== undefined && m.remittance.rarcCodes !== undefined),
    "RemittanceInfo carries CARC/RARC arrays"
  )
  // Determinism
  const era2 = generateSample835(records, initialPayers, { scenario: "MIXED", seed: 42 })
  const body = (s: string) => s.slice(s.indexOf("ST*"))
  assert(body(era) === body(era2), "Same seed produces an identical 835 body")
  const denyAll = parse835(generateSample835(records, initialPayers, { scenario: "DENY_ALL", seed: 1 }))
  assert(denyAll.claims.every((c) => c.statusCode === "4" || c.paidAmount === 0), "DENY_ALL denies everything")
})

run("Payer-aware billing progress", () => {
  const pin = getPayerConfig("medicare-pin")
  // Medicaid: 45 min = 3 units (Rule of Eights)
  const medicaidProgress = calculateMonthlyBillingProgress(initialTimeLogs, "pt-billing", medicaid, 1, 2026)
  assert(medicaidProgress.mode === "RULE_OF_EIGHTS", "Medicaid progress runs in Rule-of-Eights mode")
  assert(medicaidProgress.unitsEarned === 3, `45 min = 3 Medicaid units (got ${medicaidProgress.unitsEarned})`)
  // Medicare: 45 min = 0 units, unbillable; 105 min (pt1) = base + add-on
  const medicareProgress = calculateMonthlyBillingProgress(initialTimeLogs, "pt-billing", pin, 1, 2026)
  assert(medicareProgress.mode === "BASE_PLUS_ADDON", "Medicare progress runs in base+add-on mode")
  assert(medicareProgress.unitsEarned === 0, "45 min is unbillable under Medicare")
  const pt1Progress = calculateMonthlyBillingProgress(initialTimeLogs, "pt1", pin, 1, 2026)
  assert(pt1Progress.unitsEarned >= 2, `105 min = base + add-on under Medicare (got ${pt1Progress.unitsEarned})`)
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
