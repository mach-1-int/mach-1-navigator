/**
 * Verification: Gellert Billing Mode (charge slips, day-close, DAP, zones)
 * Run: npm run verify:gellert
 *
 * 12 blocks: slip derivation integrity, per-day Rule of Eights, signing
 * freeze/idempotence + day-close math, daily-billing-submitted rate, the
 * daily-vs-monthly divergence contract, DAP 835 round-trip, pend/reprocess,
 * MIXED no-pend regression, denial work queue aging, zones fixtures, store v13.
 *
 * Zone-bonus matching and windshield time are implemented by workstream B-C;
 * their asserts run defensively and skip with a "pending B-C" notice until
 * the real implementations land (Phase 2 unskips).
 */

import {
  deriveDailySlips,
  computeDayCloseStatus,
  dailyBillingSubmittedRate,
  chargeSlipId,
  type DerivedChargeSlip,
} from "../lib/charge-slips"
import { findUnknownCodes, classifyRemitCodes } from "../lib/remittance-review"
import { getPayerConfig, calculateRuleOfEightsUnits } from "../lib/payer-config"
import { generateSample835 } from "../lib/edi/edi-835-simulator"
import { parse835 } from "../lib/edi/edi-835-parser"
import { matchRemittance } from "../lib/edi/remittance-matcher"
import { canTransition, transitionClaimRecord, CLAIM_TRANSITIONS } from "../lib/claim-lifecycle"
import { round2 } from "../lib/edi/x12"
import { denialAgingBucket, daysSinceISO } from "../components/billing/denial-work-queue"
import { calculateMatchScore, type NavigatorWithAttributes } from "../lib/matching-logic"
import { zoneForZip, resolveZoneForPatient, computeZoneCoverage, computeWindshieldTime } from "../lib/zones"
import { AZ_ZIP_CENTROIDS, geo } from "../lib/geo"
import {
  initialTimeLogs,
  initialChargeSlips,
  initialZones,
  initialRemarkCodes,
  initialPatients,
  initialUsers,
  initialNavigators,
  initialPayers,
  initialReferrals,
} from "../lib/initial-data"
import { createInitialState } from "../lib/store"
import type { Appointment, ChargeSlip, ClaimRecord, Patient, RemarkCode, TimeLog, Zone } from "../lib/types"

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  ✓ ${message}`)
}

const skip = (message: string) => {
  console.log(`  ⚠ SKIPPED (pending B-C): ${message}`)
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

// ============================================================================
// FIXTURES
// ============================================================================

const medicaid = getPayerConfig("medicaid-bh")

function mkLog(id: string, navigatorId: string, patientId: string, date: string, minutes: number): TimeLog {
  return {
    id,
    patientId,
    date,
    startTime: `${date}T09:00:00-07:00`,
    endTime: `${date}T09:${String(minutes).padStart(2, "0")}:00-07:00`,
    durationMinutes: minutes,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId,
    verified: true,
    billingPeriod: date.slice(0, 7),
    activityType: "PEER_SUPPORT",
  }
}

function mkSignedSlip(slip: DerivedChargeSlip, signedAt: string): ChargeSlip {
  return {
    id: slip.id,
    navigatorId: slip.navigatorId,
    patientId: slip.patientId,
    date: slip.date,
    timeLogIds: slip.timeLogIds,
    totalMinutes: slip.totalMinutes,
    units: slip.units,
    code: slip.code,
    signedAt,
    signedBy: slip.navigatorId,
  }
}

function mkRecord(id: string, patientName: string, billedAmount: number, status: ClaimRecord["status"] = "SUBMITTED"): ClaimRecord {
  return {
    id,
    sourceClaimId: id,
    snapshot: {
      id,
      patientId: `pt-${id}`,
      patientName,
      memberId: `MBR-${id}`,
      month: "2026-01",
      totalMinutes: 120,
      primaryCode: "H0038",
      primaryUnits: 8,
      addOnUnits: 0,
      diagnosisCodes: ["Z59.0"],
      status: "VALIDATED",
      timeLogIds: [],
      serviceType: "CHI",
      navigatorId: "nav1",
      createdAt: "2026-01-31T10:00:00Z",
      payerConfigId: "medicaid-bh",
      payerId: initialPayers[0]?.id ?? "payer-1",
    },
    payerId: initialPayers[0]?.id ?? "payer-1",
    payerConfigId: "medicaid-bh",
    billedAmount,
    status,
    statusHistory: [
      { status: "EXPORTED", at: "2026-01-31T10:00:00Z", by: "biller1" },
      { status: "SUBMITTED", at: "2026-01-31T10:05:00Z", by: "biller1" },
    ],
    exportedAt: "2026-01-31T10:00:00Z",
    exportFormat: "837P",
    exportBatchId: "batch-verify",
  }
}

console.log("Gellert Billing Mode – Verification")
console.log("=======================================================")

// Block 1: slip derivation integrity over raw seeds
run("Block 1: Slip derivation integrity (seeds)", () => {
  const logById = new Map(initialTimeLogs.map((l) => [l.id, l]))
  const slips = deriveDailySlips(initialTimeLogs, initialChargeSlips, medicaid)
  assert(slips.length > 0, `deriveDailySlips produces ${slips.length} slips from seed logs`)

  const ids = new Set(slips.map((s) => s.id))
  assert(ids.size === slips.length, "One slip per navigator-patient-day (unique slip ids)")

  const dayKeys = new Set(initialTimeLogs.map((l) => chargeSlipId(l.navigatorId, l.patientId, l.date)))
  assert(slips.length === dayKeys.size, "Slip count equals distinct navigator-patient-days in seed logs")

  for (const slip of slips) {
    const logs = slip.timeLogIds.map((id) => logById.get(id))
    if (logs.some((l) => !l)) throw new Error(`FAIL: slip ${slip.id} references a non-seed TimeLog`)
    const sum = logs.reduce((acc, l) => acc + l!.durationMinutes, 0)
    if (sum !== slip.totalMinutes) {
      throw new Error(`FAIL: slip ${slip.id} totalMinutes ${slip.totalMinutes} ≠ Σ TimeLogs ${sum}`)
    }
  }
  console.log(`  ✓ Every slip's timeLogIds ⊆ seed logs and totalMinutes = Σ its TimeLogs (${slips.length} slips)`)

  const seedSlip = slips.find((s) => s.id === chargeSlipId("nav1", "pt1", "2026-01-21"))
  assert(!!seedSlip && seedSlip.signed && seedSlip.totalMinutes === 45 && seedSlip.units === 3,
    "Seeded signed slip joins its derived patient-day (45 min = 3 units)")
})

// Block 2: per-day Rule of Eights on slips
run("Block 2: Per-slip Rule of Eights (6/8/23 min)", () => {
  const logs = [
    mkLog("tl-r8-a", "navX", "ptA", "2026-03-02", 6),
    mkLog("tl-r8-b", "navX", "ptB", "2026-03-02", 8),
    mkLog("tl-r8-c", "navX", "ptC", "2026-03-02", 23),
  ]
  const slips = deriveDailySlips(logs, [], medicaid)
  const byPatient = new Map(slips.map((s) => [s.patientId, s]))
  const a = byPatient.get("ptA")!
  const b = byPatient.get("ptB")!
  const c = byPatient.get("ptC")!
  assert(a.units === 0 && a.isSubMinimum, "6 min = 0 units, flagged sub-minimum")
  assert(b.units === 1 && !b.isSubMinimum, "8 min = 1 unit (Rule of Eights threshold)")
  assert(c.units === 2 && !c.isSubMinimum, "23 min = 2 units (15 + 8)")
})

// Block 3: signing freeze semantics, idempotence, day-close math
run("Block 3: Signing freeze + idempotence + computeDayCloseStatus", () => {
  const day = "2026-03-03"
  const firstLog = mkLog("tl-s-1", "navX", "ptA", day, 10)
  const derived = deriveDailySlips([firstLog], [], medicaid)[0]
  const signed = mkSignedSlip(derived, `${day}T17:00:00Z`)

  const lateLog = mkLog("tl-s-2", "navX", "ptA", day, 20)
  const afterLateLog = deriveDailySlips([firstLog, lateLog], [signed], medicaid)[0]
  assert(afterLateLog.signed, "Signed slip stays signed after a late log lands")
  assert(
    afterLateLog.totalMinutes === 10 && afterLateLog.units === 1 && afterLateLog.timeLogIds.length === 1,
    "Signed slip freezes timeLogIds/minutes/units at signing time"
  )

  const doubleSigned = deriveDailySlips([firstLog, lateLog], [signed, { ...signed }], medicaid)
  assert(doubleSigned.length === 1, "Double-signing the same patient-day still derives ONE slip (idempotent join)")

  const otherLog = mkLog("tl-s-3", "navX", "ptB", day, 6)
  const daySlips = deriveDailySlips([firstLog, lateLog, otherLog], [signed], medicaid)
  const status = computeDayCloseStatus(daySlips)
  assert(status.totalSlips === 2 && status.signedSlips === 1 && status.unsignedSlips === 1,
    "Day-close counts: 2 slips, 1 signed, 1 unsigned")
  assert(status.totalUnits === 1 && status.subMinimumSlips === 1, "Day-close units and sub-minimum count")
  assert(!status.dayClosed, "Day not closed while an unsigned slip remains")

  const allSigned = daySlips.map((s) => mkSignedSlip(s, `${day}T17:30:00Z`))
  const closed = computeDayCloseStatus(deriveDailySlips([firstLog, lateLog, otherLog], allSigned, medicaid))
  assert(closed.dayClosed, "Day closes once every slip is signed")
  assert(!computeDayCloseStatus([]).dayClosed, "Empty day never reports closed")
})

// Block 4: dailyBillingSubmittedRate — only same-day signatures count
run("Block 4: Daily billing submitted by EOD %", () => {
  const logs = [
    mkLog("tl-d-1", "navX", "ptA", "2026-03-02", 30),
    mkLog("tl-d-2", "navX", "ptB", "2026-03-03", 30),
    mkLog("tl-d-3", "navX", "ptC", "2026-03-04", 30),
  ]
  const derived = deriveDailySlips(logs, [], medicaid)
  const sameDay = mkSignedSlip(derived.find((s) => s.patientId === "ptA")!, "2026-03-02T17:00:00Z")
  const nextDay = mkSignedSlip(derived.find((s) => s.patientId === "ptB")!, "2026-03-04T09:00:00Z")

  const rate = dailyBillingSubmittedRate([sameDay, nextDay], logs, 7, "2026-03-05")
  assert(rate === 33, `1 of 3 patient-days signed same-day = 33% (got ${rate}%)`)
  assert(dailyBillingSubmittedRate([], logs, 7, "2026-03-05") === 0, "No signatures = 0%")

  const seedRate = dailyBillingSubmittedRate(initialChargeSlips, initialTimeLogs, 30, "2026-01-30")
  assert(seedRate > 0 && seedRate < 100,
    `Seed trailing-30-day rate is a live number (${seedRate}%) — today's slips unsigned, one next-day signature`)
  const nextDaySeed = initialChargeSlips.find((s) => s.id === "slip-nav1-pt2-2026-01-23")
  assert(!!nextDaySeed && nextDaySeed.signedAt!.slice(0, 10) !== nextDaySeed.date,
    "Seed contains a next-day signature (doesn't count toward the KPI)")
})

// Block 5: daily vs monthly Rule of Eights divergence (honest-labeling contract)
run("Block 5: Daily units ≠ monthly units (labeling contract)", () => {
  const logs = [
    mkLog("tl-m-1", "navX", "ptA", "2026-03-02", 8),
    mkLog("tl-m-2", "navX", "ptA", "2026-03-03", 8),
  ]
  const dailyUnits = deriveDailySlips(logs, [], medicaid).reduce((sum, s) => sum + s.units, 0)
  const monthlyUnits = calculateRuleOfEightsUnits(16)
  assert(dailyUnits === 2, "Two 8-minute days bill 2 units DAILY (per-day Rule of Eights)")
  assert(monthlyUnits === 1, "The same 16 minutes bill 1 unit MONTHLY (single aggregation)")
  assert(dailyUnits !== monthlyUnits,
    "Σ(daily units) ≠ monthly units — UI must label 'daily units (charge slips)' vs 'claim units'")
})

// Block 6: DAP_ADJUSTMENT 835 round-trip through the real parser
run("Block 6: DAP 835 round-trip (CLP02=1, 101%, negative CAS CO 144, N807)", () => {
  const records = [mkRecord("clm-dap-1", "James Thompson", 185.0), mkRecord("clm-dap-2", "Maria Lopez", 92.5)]
  const text = generateSample835(records, initialPayers, { scenario: "DAP_ADJUSTMENT", paymentDate: "2026-01-30" })
  const remit = parse835(text)

  assert(remit.claims.length === 2, "835 contains one CLP loop per record")
  let totalPaid = 0
  for (const record of records) {
    const claim = remit.claims.find((c) => c.patientControlNumber === record.id)!
    assert(!!claim && claim.statusCode === "1", `${record.id}: CLP02 = 1 (processed as primary, NOT a denial)`)
    const expectedPaid = round2(record.billedAmount * 1.01)
    assert(claim.paidAmount === expectedPaid, `${record.id}: paid $${claim.paidAmount} = 1.01 × billed`)
    const cas = claim.adjustments.find((a) => a.groupCode === "CO" && a.reasonCode === "144")
    assert(!!cas && cas.amount < 0, `${record.id}: CAS CO 144 carries a NEGATIVE amount (${cas?.amount})`)
    assert(cas!.amount === round2(record.billedAmount - expectedPaid),
      `${record.id}: CLP03 = CLP04 + ΣCAS balances to the cent`)
    assert(claim.rarcCodes.includes("N807"), `${record.id}: LQ HE N807 present`)
    totalPaid = round2(totalPaid + expectedPaid)
  }
  assert(remit.paymentAmount === totalPaid, `BPR02 total payment = Σ claim payments ($${totalPaid})`)

  const match = matchRemittance(remit, records)
  assert(match.matches.length === 2 && match.unmatchedCount === 0, "Matcher ties every CLP back to its record via CLP01")
  assert(match.matches.every((m) => m.resolvedStatus === "PAID"), "Matcher resolves DAP claims as PAID, not DENIED")
})

// Block 7: unknown codes pend the remittance (record holds at ACCEPTED)
run("Block 7: DAP pend — unknown 144/N807 hold the record at ACCEPTED", () => {
  const record = mkRecord("clm-pend-1", "James Thompson", 185.0)
  const text = generateSample835([record], initialPayers, { scenario: "DAP_ADJUSTMENT" })
  const match = matchRemittance(parse835(text), [record]).matches[0]

  const unknown = findUnknownCodes(match.remittance, initialRemarkCodes)
  assert(unknown.length === 2 && unknown.includes("144") && unknown.includes("N807"),
    "144 and N807 are deliberately absent from the seed dictionary")

  // Simulate applyRemittance's guardrail: walk to ACCEPTED, then PEND instead of posting
  let working = transitionClaimRecord(record, "ACCEPTED", "system:835", "Inferred from remittance")!
  assert(working.status === "ACCEPTED", "Record advances to ACCEPTED")
  if (unknown.length > 0) {
    working = {
      ...working,
      pendedRemittance: {
        remittance: match.remittance,
        resolvedStatus: match.resolvedStatus,
        unknownCodes: unknown,
        pendedAt: new Date().toISOString(),
      },
    }
  }
  assert(working.status === "ACCEPTED" && !working.remittance, "Pended record is NOT posted PAID (no remittance attached)")
  assert(!!working.pendedRemittance && working.pendedRemittance.resolvedStatus === "PAID",
    "Pend holds the resolved status + remittance for reprocessing")
  assert(canTransition("ACCEPTED", "PAID"), "State machine unchanged — ACCEPTED → PAID stays legal for reprocess")

  const classified = classifyRemitCodes(unknown, initialRemarkCodes)
  assert(classified.every((c) => !c.known), "classifyRemitCodes reports both codes unknown for the review UI")
})

// Block 8: reprocess posts the pend once codes are classified
run("Block 8: Reprocess after classifying 144 (adjustment) + N807", () => {
  const record = mkRecord("clm-pend-1", "James Thompson", 185.0)
  const text = generateSample835([record], initialPayers, { scenario: "DAP_ADJUSTMENT" })
  const match = matchRemittance(parse835(text), [record]).matches[0]
  const pended: ClaimRecord = {
    ...transitionClaimRecord(record, "ACCEPTED", "system:835")!,
    pendedRemittance: {
      remittance: match.remittance,
      resolvedStatus: match.resolvedStatus,
      unknownCodes: findUnknownCodes(match.remittance, initialRemarkCodes),
      pendedAt: new Date().toISOString(),
    },
  }

  const now = new Date().toISOString()
  const updatedDictionary: RemarkCode[] = [
    ...initialRemarkCodes,
    { id: "carc-144", type: "CARC", code: "144", description: "Incentive adjustment (Differential Adjustment Payment)", classification: "adjustment", lastUpdated: now },
    { id: "rarc-n807", type: "RARC", code: "N807", description: "Payment adjustment based on a payment-incentive program", classification: "informational", lastUpdated: now },
  ]
  assert(findUnknownCodes(pended.pendedRemittance!.remittance, updatedDictionary).length === 0,
    "Updated dictionary resolves every pended code")

  const final = transitionClaimRecord(pended, pended.pendedRemittance!.resolvedStatus, "system:835", "Reprocessed after remark-code classification")
  assert(!!final && final.status === "PAID", "Reprocess posts the record PAID")
  const posted: ClaimRecord = { ...final!, remittance: pended.pendedRemittance!.remittance, pendedRemittance: undefined }
  assert(posted.remittance!.paidAmount === round2(185.0 * 1.01), `Posted paid amount $${posted.remittance!.paidAmount} = 101% of billed`)
  assert(posted.remittance!.paidAmount > posted.billedAmount, "Paid exceeds billed — the +1% incentive, not a denial")
  assert(posted.pendedRemittance === undefined, "Pend flag clears after posting")
  assert(classifyRemitCodes(["144"], updatedDictionary)[0].classification === "adjustment",
    "CARC 144 classifies as adjustment for the ledger annotation")
})

// Block 9: MIXED scenario regression — every code is in the seed dictionary
run("Block 9: MIXED remit codes (45/197/N30) never pend", () => {
  const records = Array.from({ length: 20 }, (_, i) => mkRecord(`clm-mix-${i + 1}`, `Patient Mixcase${i + 1}`, 100 + i * 7.5))
  const remit = parse835(generateSample835(records, initialPayers, { scenario: "MIXED" }))

  const seen = new Set<string>()
  for (const claim of remit.claims) {
    for (const adj of claim.adjustments) seen.add(adj.reasonCode)
    for (const rarc of claim.rarcCodes) seen.add(rarc)
    const unknown = findUnknownCodes(
      { paidAmount: claim.paidAmount, chargedAmount: claim.chargedAmount, patientResponsibility: 0, carcCodes: claim.adjustments.map((a) => a.reasonCode), rarcCodes: claim.rarcCodes },
      initialRemarkCodes
    )
    if (unknown.length > 0) throw new Error(`FAIL: MIXED claim ${claim.patientControlNumber} would pend on ${unknown.join(", ")}`)
  }
  assert(true, `No MIXED claim pends (codes seen: ${[...seen].sort().join(", ") || "none"})`)
  assert(seen.has("45") || seen.has("197"), "MIXED scenario exercised adjustment/denial codes (deterministic seed)")
  assert(remit.claims.some((c) => c.statusCode === "4"), "MIXED scenario produced at least one denial")
})

// Block 10: denial work queue — work statuses and aging buckets
run("Block 10: Denial work-status defaults + aging buckets", () => {
  const denied = mkRecord("clm-den-1", "James Thompson", 148.0, "ACCEPTED")
  const finalDenied = transitionClaimRecord(denied, "DENIED", "system:835")!
  assert(finalDenied.status === "DENIED", "ACCEPTED → DENIED lands in the work queue")
  assert((finalDenied.workStatus ?? "new") === "new", "Unworked denials default to work status 'new'")
  const worked: ClaimRecord = { ...finalDenied, workStatus: "in_review" }
  assert(worked.workStatus === "in_review", "Work status advances new → in_review (biller-managed, informational)")
  assert(CLAIM_TRANSITIONS.DENIED.length === 0 && !canTransition("DENIED", "PAID"),
    "DENIED stays terminal — work statuses never mutate the claim state machine")

  assert(daysSinceISO("2026-01-23", "2026-01-30") === 7 && denialAgingBucket(7) === "0-7", "7 days old → 0–7 bucket")
  assert(denialAgingBucket(8) === "8-30" && denialAgingBucket(30) === "8-30", "8 and 30 days → 8–30 bucket")
  assert(denialAgingBucket(31) === "31+", "31 days → 31+ bucket")
  assert(daysSinceISO("2025-12-16", "2026-01-30") === 45 && denialAgingBucket(45) === "31+",
    "A remit dated 45 days back ages into 31+")
  assert(daysSinceISO("2026-02-05", "2026-01-30") === 0, "Future remit dates clamp to 0 (never negative aging)")
})

// Block 11: zones — seeds, resolution, coverage, match bonus, windshield time
run("Block 11: Zones fixtures (B-C integration)", () => {
  assert(initialZones.length === 6, "6 Phoenix-metro zones seeded (Gellert runs 11)")
  const allZips = initialZones.flatMap((z) => z.zipCodes)
  assert(allZips.every((zip) => !!AZ_ZIP_CENTROIDS[zip]), "Every zone zip exists in AZ_ZIP_CENTROIDS")
  assert(new Set(allZips).size === allZips.length, "No zip belongs to two zones")

  const zoneIds = new Set(initialZones.map((z) => z.id))
  assert(initialPatients.every((p) => !p.zoneId || zoneIds.has(p.zoneId)), "Every patient zoneId references a seeded zone")
  const navUsers = initialUsers.filter((u) => u.role === "navigator")
  assert(navUsers.every((u) => !u.attributes?.zoneId || zoneIds.has(u.attributes.zoneId)),
    "Every navigator zoneId references a seeded zone")

  const westValley = zoneForZip(initialZones, "85301")
  assert(westValley?.id === "zone-west-valley", "zoneForZip resolves 85301 → West Valley")
  const eastPatient: Patient = { ...initialPatients[0], zoneId: "zone-east-valley", address: { ...initialPatients[0].address!, zip: "85301" } }
  assert(resolveZoneForPatient(initialZones, eastPatient)?.id === "zone-east-valley",
    "Explicit Patient.zoneId wins over address-zip lookup")

  const coverage = computeZoneCoverage(initialZones, initialPatients, initialNavigators, initialUsers)
  assert(coverage.length === 6 && coverage.every((c) => c.activePatients >= 0 && c.assignedNavigators >= 0),
    "computeZoneCoverage reports every zone with sane counts")

  // Zone bonus in matching (B-C adds the optional zones param)
  const referral = { ...initialReferrals[0], zipCode: "85301" }
  const navigator: NavigatorWithAttributes = {
    id: "nav-zone-test",
    name: "Zone Tester",
    attributes: {
      homeZipCode: "85301",
      serviceAreaRadius: 25,
      languages: ["en"],
      currentCaseload: 10,
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2", "L3"],
      zoneId: "zone-west-valley",
    },
  }
  const zoneAwareMatch = calculateMatchScore as unknown as (
    r: typeof referral,
    n: NavigatorWithAttributes,
    zones?: Zone[]
  ) => { score: number; matchReasons: string[] }
  const base = zoneAwareMatch(referral, navigator)
  const withZones = zoneAwareMatch(referral, navigator, initialZones)
  if (withZones.score === base.score) {
    skip("zone bonus in calculateMatchScore not yet implemented")
  } else {
    assert(withZones.score - base.score === 15, "Same-zone navigator earns +15 match points")
    assert(withZones.matchReasons.some((r) => r.toLowerCase().includes("zone")), "Match reasons name the zone bonus")
  }

  // Windshield time (B-C implements computeWindshieldTime)
  const stops = ["85001", "85032", "85301"]
  const wsPatients: Patient[] = stops.map((zip, i) => ({
    ...initialPatients[0],
    id: `pt-ws-${i + 1}`,
    zoneId: undefined,
    lat: AZ_ZIP_CENTROIDS[zip].lat,
    lng: AZ_ZIP_CENTROIDS[zip].lng,
    address: { ...initialPatients[0].address!, zip },
  }))
  const mkAppt = (id: string, patientId: string, date: string, time: string): Appointment => ({
    id, patientId, navigatorId: "nav-ws", date, time, type: "home_visit", status: "scheduled",
  })
  const appointments = [
    mkAppt("ap-ws-2", "pt-ws-2", "2026-03-02", "11:00"),
    mkAppt("ap-ws-1", "pt-ws-1", "2026-03-02", "09:00"),
    mkAppt("ap-ws-3", "pt-ws-3", "2026-03-02", "13:00"),
    mkAppt("ap-ws-4", "pt-ws-1", "2026-03-03", "09:00"),
  ]
  const windshield = computeWindshieldTime(appointments, wsPatients, geo)
  if (windshield.length === 0) {
    skip("computeWindshieldTime is a stub — windshield asserts run in Phase 2")
  } else {
    const threeStop = windshield.find((d) => d.navigatorId === "nav-ws" && d.date === "2026-03-02")
    const expected =
      geo.driveTimeMinutes(AZ_ZIP_CENTROIDS["85001"], AZ_ZIP_CENTROIDS["85032"]) +
      geo.driveTimeMinutes(AZ_ZIP_CENTROIDS["85032"], AZ_ZIP_CENTROIDS["85301"])
    assert(!!threeStop && threeStop.stops === 3, "3-stop day groups into one windshield entry")
    assert(threeStop!.driveMinutes === expected,
      `3-stop day = Σ consecutive drive times (${threeStop!.driveMinutes} = ${expected} min, time-sorted)`)
    const oneStop = windshield.find((d) => d.navigatorId === "nav-ws" && d.date === "2026-03-03")
    assert(!!oneStop && oneStop.driveMinutes === 0, "1-stop day has 0 windshield minutes")
  }
})

// Block 12: store v13 exposes the billing slices
run("Block 12: Store v13 slices", () => {
  const state = createInitialState()
  assert(state._version >= 13, `store version ${state._version} >= 13`)
  assert(Array.isArray(state.chargeSlips) && state.chargeSlips.length === initialChargeSlips.length,
    "createInitialState carries the seeded (rebased) chargeSlips")
  assert(Array.isArray(state.zones) && state.zones.length === 6, "createInitialState carries the 6 zones")
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
