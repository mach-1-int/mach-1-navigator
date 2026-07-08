/**
 * Verification: Patient Journey Engine + Referral CRM (Gellert WorkFlow2025)
 * Run: npm run verify:journey
 *
 * Blocks 1-4 & 8 (referral transition matrix, eligibility decision tree,
 * outreach engine + SLA, referral seed integrity, funnel) — workstream J-A.
 * Blocks 5-7 & 9 (phase matrix, intake protocol, telenav cadence,
 * persistence) — workstream J-B, appended at Phase 2 integration.
 */

import {
  REFERRAL_TRANSITIONS,
  TERMINAL_REFERRAL_STATUSES,
  MAX_OUTREACH_ATTEMPTS,
  ELIGIBILITY_GATES,
  canTransitionReferral,
  isTerminalReferralStatus,
  evaluateEligibility,
  applyOutreachAttempt,
  attemptsRemaining,
  outreachSla,
} from "../lib/referral-pipeline"
import { computeFunnel, computeSourceScorecard } from "../lib/referral-funnel"
import { initialReferrals, initialPatients } from "../lib/initial-data"
import type { EligibilityCheck, OutreachAttempt, Referral, ReferralStatus } from "../lib/types"

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

const ALL_STATUSES = Object.keys(REFERRAL_TRANSITIONS) as ReferralStatus[]

function mkAttempt(attemptNumber: number, disposition: OutreachAttempt["disposition"]): OutreachAttempt {
  return {
    id: `att-${attemptNumber}`,
    attemptNumber,
    at: new Date().toISOString(),
    by: "sup1",
    byName: "Test Supervisor",
    channel: "phone",
    disposition,
  }
}

function mkReferral(overrides: Partial<Referral>): Referral {
  return {
    id: "ref-test",
    receivedAt: new Date().toISOString(),
    source: "Test Hospital",
    rawData: {
      PID: {
        patientName: "Test Patient",
        dob: "1950-01-01",
        gender: "F",
        address: { street: "1 Main St", city: "Phoenix", state: "AZ", zip: "85001" },
        phone: "(602) 555-0100",
      },
      DG1: { primaryDiagnosis: "CHF", icdCodes: ["I50.9"], diagnosisDate: "2026-01-01" },
      IN1: { payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC000000000" },
      PV1: { referringPhysician: "Dr. Test", facilityName: "Test Hospital" },
    },
    status: "received",
    outreachAttempts: [],
    patientName: "Test Patient",
    dob: "1950-01-01",
    referralSource: "Test Hospital",
    riskScore: 2,
    referralDate: "2026-01-01",
    diagnosis: "CHF",
    healthPlan: "AHCCCS",
    zipCode: "85001",
    language: "en",
    requiredAcuity: "L2",
    ...overrides,
  }
}

const ALL_YES: Pick<
  EligibilityCheck,
  "insuranceVerified" | "inServiceArea" | "medicalNeedConfirmed" | "levelOfCareAppropriate" | "ageEligible"
> = {
  insuranceVerified: true,
  inServiceArea: true,
  medicalNeedConfirmed: true,
  levelOfCareAppropriate: true,
  ageEligible: true,
}

console.log("Patient Journey Engine – Verification")
console.log("=========================================================")

run("1) Referral transition matrix", () => {
  assert(ALL_STATUSES.length === 9, "Matrix covers all 9 referral statuses")

  const legalPaths: Array<[ReferralStatus, ReferralStatus]> = [
    ["received", "accepted"],
    ["received", "ineligible"],
    ["accepted", "outreach"],
    ["accepted", "agreed"],
    ["accepted", "declined"],
    ["outreach", "outreach"],
    ["outreach", "agreed"],
    ["outreach", "declined"],
    ["outreach", "unreachable"],
    ["agreed", "intake_scheduled"],
    ["agreed", "converted"],
    ["intake_scheduled", "converted"],
  ]
  for (const [from, to] of legalPaths) {
    assert(canTransitionReferral(from, to), `${from} -> ${to} is legal`)
  }

  assert(!canTransitionReferral("received", "converted"), "received -> converted is illegal")
  assert(!canTransitionReferral("received", "outreach"), "received -> outreach is illegal (eligibility first)")
  assert(!canTransitionReferral("unreachable", "agreed"), "unreachable -> agreed is illegal")
  assert(!canTransitionReferral("agreed", "declined"), "agreed -> declined is illegal")

  for (const status of TERMINAL_REFERRAL_STATUSES) {
    assert(REFERRAL_TRANSITIONS[status].length === 0, `${status} is terminal (no outbound transitions)`)
    assert(isTerminalReferralStatus(status), `${status} reported terminal`)
  }
})

run("2) Eligibility decision tree (5-gate short-circuit)", () => {
  assert(ELIGIBILITY_GATES.length === 5, "Five eligibility gates defined")

  const allYes = evaluateEligibility(ALL_YES)
  assert(allYes.outcome === "eligible" && allYes.ineligibilityReason === undefined, "All-yes yields eligible with no reason")

  for (const gate of ELIGIBILITY_GATES) {
    const result = evaluateEligibility({ ...ALL_YES, [gate.key]: false })
    assert(
      result.outcome === "ineligible" && result.ineligibilityReason === gate.reason,
      `Single "no" at ${gate.key} yields ineligible (${gate.reason})`
    )
  }

  const doubleNo = evaluateEligibility({ ...ALL_YES, inServiceArea: false, ageEligible: false })
  assert(
    doubleNo.ineligibilityReason === "out_of_service_area",
    "Multiple failures short-circuit to the FIRST failing gate's reason"
  )
})

run("3) Outreach engine + first-contact SLA", () => {
  const inOutreach = mkReferral({
    status: "outreach",
    outreachAttempts: [mkAttempt(1, "no_answer"), mkAttempt(2, "voicemail")],
  })
  assert(applyOutreachAttempt(inOutreach, mkAttempt(3, "agreed")) === "agreed", "Agreed disposition transitions to agreed at any attempt")
  assert(applyOutreachAttempt(inOutreach, mkAttempt(3, "declined")) === "declined", "Declined disposition transitions to declined")
  assert(applyOutreachAttempt(inOutreach, mkAttempt(3, "no_answer")) === "outreach", "Unresolved attempt stays in outreach")

  const accepted = mkReferral({ status: "accepted", acceptedAt: new Date().toISOString() })
  assert(applyOutreachAttempt(accepted, mkAttempt(1, "voicemail")) === "outreach", "First attempt moves accepted -> outreach")

  const sixDown = mkReferral({
    status: "outreach",
    outreachAttempts: Array.from({ length: 6 }, (_, i) => mkAttempt(i + 1, "no_answer")),
  })
  assert(attemptsRemaining(sixDown) === 1, "Six attempts logged leaves one remaining")
  assert(applyOutreachAttempt(sixDown, mkAttempt(7, "no_answer")) === "unreachable", "7th unsuccessful attempt auto-closes to unreachable")
  assert(applyOutreachAttempt(sixDown, mkAttempt(7, "agreed")) === "agreed", "Agreed on the 7th attempt still wins")

  const maxedOut = mkReferral({
    status: "unreachable",
    outreachAttempts: Array.from({ length: 7 }, (_, i) => mkAttempt(i + 1, "no_answer")),
    closedAt: new Date().toISOString(),
    closeReason: "unreachable",
  })
  assert(attemptsRemaining(maxedOut) === 0, "No attempts remain after 7")
  assert(applyOutreachAttempt(maxedOut, mkAttempt(8, "no_answer")) === "unreachable", "Attempt 8 is rejected (terminal status unchanged)")
  assert(
    applyOutreachAttempt(mkReferral({ status: "outreach" }), mkAttempt(MAX_OUTREACH_ATTEMPTS + 1, "no_answer")) === "outreach",
    "Attempt beyond the max never transitions a working referral"
  )

  const now = new Date("2026-01-30T12:00:00Z")
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString()
  assert(outreachSla(mkReferral({ status: "accepted", acceptedAt: hoursAgo(23) }), now).status === "on_time", "23h since acceptance -> on_time")
  assert(outreachSla(mkReferral({ status: "accepted", acceptedAt: hoursAgo(30) }), now).status === "due", "30h since acceptance -> due")
  assert(outreachSla(mkReferral({ status: "accepted", acceptedAt: hoursAgo(49) }), now).status === "breached", "49h since acceptance -> breached")
  assert(outreachSla(mkReferral({ status: "received" }), now).status === "on_time", "No acceptedAt -> clock not running (on_time)")
})

run("4) Referral seed integrity", () => {
  assert(initialReferrals.length >= 20, `Seed carries a full funnel (${initialReferrals.length} referrals)`)

  for (const ref of initialReferrals) {
    assert(ALL_STATUSES.includes(ref.status), `${ref.id}: status "${ref.status}" is a legal pipeline status`)
  }

  const unreachable = initialReferrals.filter((r) => r.status === "unreachable")
  assert(unreachable.length > 0, "Seed includes unreachable referrals")
  for (const ref of unreachable) {
    assert(
      ref.outreachAttempts.length === MAX_OUTREACH_ATTEMPTS,
      `${ref.id}: unreachable has exactly ${MAX_OUTREACH_ATTEMPTS} attempts`
    )
    assert(!!ref.providerNotifiedAt, `${ref.id}: unreachable stamped providerNotifiedAt`)
  }

  const ineligible = initialReferrals.filter((r) => r.status === "ineligible")
  assert(ineligible.length > 0, "Seed includes ineligible referrals")
  for (const ref of ineligible) {
    assert(
      ref.eligibility?.outcome === "ineligible" && !!ref.eligibility.ineligibilityReason,
      `${ref.id}: ineligible carries an eligibility block with a reason (${ref.eligibility?.ineligibilityReason})`
    )
  }

  const converted = initialReferrals.filter((r) => r.status === "converted")
  assert(converted.length > 0, "Seed includes converted referrals")
  for (const ref of converted) {
    assert(
      !!ref.patientId && initialPatients.some((p) => p.id === ref.patientId),
      `${ref.id}: converted patientId resolves to seed patient ${ref.patientId}`
    )
  }

  for (const ref of initialReferrals) {
    ref.outreachAttempts.forEach((attempt, i) => {
      if (attempt.attemptNumber !== i + 1) {
        throw new Error(`FAIL: ${ref.id}: attempt numbers not sequential`)
      }
    })
    if (["accepted", "outreach", "agreed", "intake_scheduled"].includes(ref.status) && !ref.acceptedAt) {
      throw new Error(`FAIL: ${ref.id}: post-eligibility status without acceptedAt (SLA clock cannot run)`)
    }
  }
  assert(true, "Every seed attempt log is sequential; post-eligibility referrals carry acceptedAt")
})

run("8) Referral funnel + source scorecard", () => {
  const funnel = computeFunnel(initialReferrals)
  assert(
    funnel.conversionRate >= 20 && funnel.conversionRate <= 35,
    `Conversion rate ${funnel.conversionRate}% within Gellert's stated 20-35% band`
  )
  const stageSum = funnel.stages.reduce((sum, s) => sum + s.count, 0)
  assert(stageSum === funnel.total, `Stage counts (${stageSum}) sum to total (${funnel.total})`)
  assert(
    funnel.inPipeline + funnel.converted + funnel.closedWithoutConversion === funnel.total,
    "inPipeline + converted + closed partitions the funnel"
  )

  const scorecard = computeSourceScorecard(initialReferrals)
  assert(scorecard.length > 1, `Scorecard covers ${scorecard.length} sources`)
  assert(
    scorecard[0].source.includes("St. Joseph"),
    `St. Joseph's is the top source by volume (got "${scorecard[0].source}")`
  )
  for (const row of scorecard) {
    assert(
      row.converted + row.ineligible + row.unreachable + row.declined + row.inProgress === row.received,
      `${row.source}: scorecard row partitions its ${row.received} referrals`
    )
  }
})

console.log("\n=========================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
