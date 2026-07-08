/**
 * Verification: Gellert Billing Mode (charge slips, day-close, DAP, zones)
 * Run: npm run verify:gellert
 *
 * PHASE 0 STUB — trivially-passing scaffold checks only. Workstream B-A fills
 * in the 12 blocks (slip integrity, per-day Rule of Eights, signing
 * idempotence, day-close rate, daily-vs-monthly divergence, DAP 835
 * round-trip, pend/reprocess, zones fixtures from B-C).
 */

import { deriveDailySlips, computeDayCloseStatus, chargeSlipId } from "../lib/charge-slips"
import { findUnknownCodes, classifyRemitCodes } from "../lib/remittance-review"
import { getPayerConfig } from "../lib/payer-config"
import { initialTimeLogs, initialChargeSlips, initialZones, initialRemarkCodes } from "../lib/initial-data"
import { AZ_ZIP_CENTROIDS } from "../lib/geo"
import { createInitialState } from "../lib/store"

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

console.log("Gellert Billing Mode – Verification (Phase 0 scaffold)")
console.log("=======================================================")

run("Scaffold: slip derivation over raw seeds", () => {
  const medicaid = getPayerConfig("medicaid-bh")
  const slips = deriveDailySlips(initialTimeLogs, initialChargeSlips, medicaid)
  assert(slips.length > 0, "deriveDailySlips produces slips from seed logs")
  const seedSlip = slips.find((s) => s.id === chargeSlipId("nav1", "pt1", "2026-01-21"))
  assert(!!seedSlip && seedSlip.signed, "Seeded signed slip joins its derived patient-day")
  assert(seedSlip!.totalMinutes === 45 && seedSlip!.units === 3, "45 min = 3 units on the seeded slip")
  const subMin = slips.find((s) => s.patientId === "pt4" && s.date === "2026-01-30")
  assert(!!subMin && subMin.isSubMinimum && subMin.units === 0, "6-minute patient-day flags sub-minimum, 0 units")
  const status = computeDayCloseStatus(slips.filter((s) => s.date === "2026-01-30"))
  assert(status.unsignedSlips > 0 && !status.dayClosed, "Today's slips are unsigned (live day-close demo)")
})

run("Scaffold: DAP pend inputs (144/N807 absent from dictionary)", () => {
  const unknown = findUnknownCodes(
    { paidAmount: 101, chargedAmount: 100, patientResponsibility: 0, carcCodes: ["144"], rarcCodes: ["N807"] },
    initialRemarkCodes
  )
  assert(unknown.length === 2, "CARC 144 and RARC N807 are deliberately unknown")
  const classified = classifyRemitCodes(["45", "144"], initialRemarkCodes)
  assert(classified[0].known && classified[0].classification === "adjustment", "CARC 45 classified as adjustment")
  assert(!classified[1].known, "CARC 144 reports as unknown")
})

run("Scaffold: zones fixtures", () => {
  assert(initialZones.length === 6, "6 Phoenix-metro zones seeded (Gellert runs 11)")
  const allZips = initialZones.flatMap((z) => z.zipCodes)
  assert(allZips.every((zip) => !!AZ_ZIP_CENTROIDS[zip]), "Every zone zip exists in AZ_ZIP_CENTROIDS")
  assert(new Set(allZips).size === allZips.length, "No zip belongs to two zones")
})

run("Scaffold: store v13 exposes billing slices", () => {
  const state = createInitialState()
  assert(Array.isArray(state.chargeSlips), "createInitialState has chargeSlips")
  assert(Array.isArray(state.zones) && state.zones.length === 6, "createInitialState has zones")
  assert(state._version >= 13, `store version ${state._version} >= 13`)
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
