/**
 * Verification: Patient Journey Engine + Referral CRM (Gellert WorkFlow2025)
 * Run: npm run verify:journey
 *
 * PHASE 0 STUB — trivially-passing scaffold checks only. Workstreams J-A
 * (blocks 1-4 & 8: referral matrix, eligibility tree, outreach engine, seed
 * integrity, funnel) and J-B (blocks 5-7 & 9: phase matrix, intake protocol,
 * telenav cadence, persistence) fill this in. J-A has lexical priority;
 * J-B appends in Phase 2.
 */

import { REFERRAL_TRANSITIONS, canTransitionReferral } from "../lib/referral-pipeline"
import { PHASE_TRANSITIONS, canTransitionPhase } from "../lib/journey"
import { initialReferrals, initialPatients, initialJourneyEvents } from "../lib/initial-data"
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

console.log("Patient Journey Engine – Verification (Phase 0 scaffold)")
console.log("=========================================================")

run("Scaffold: transition matrices exist and reject nonsense", () => {
  assert(Object.keys(REFERRAL_TRANSITIONS).length === 9, "Referral matrix covers all 9 statuses")
  assert(canTransitionReferral("received", "accepted"), "received -> accepted is legal")
  assert(!canTransitionReferral("received", "converted"), "received -> converted is illegal")
  assert(!canTransitionReferral("unreachable", "agreed"), "unreachable -> agreed is illegal")
  assert(canTransitionPhase("referral", "intake"), "referral -> intake is legal")
  assert(!canTransitionPhase("exited", "active"), "exited -> active is illegal")
  assert(PHASE_TRANSITIONS.exited.length === 0, "exited is terminal")
})

run("Scaffold: seeds carry journey shapes", () => {
  assert(initialReferrals.length >= 20, `~20 seed referrals (got ${initialReferrals.length})`)
  assert(
    initialPatients.every((p) => ["intake", "active", "telenavigation", "exited"].includes(p.journeyPhase)),
    "Every seed patient has a valid journeyPhase"
  )
  assert(initialJourneyEvents.length > 0, "initialJourneyEvents seeded")
})

run("Scaffold: store v13 exposes journey slices", () => {
  const state = createInitialState()
  assert(Array.isArray(state.journeyEvents), "createInitialState has journeyEvents")
  assert(state._version >= 13, `store version ${state._version} >= 13`)
})

console.log("\n=========================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
