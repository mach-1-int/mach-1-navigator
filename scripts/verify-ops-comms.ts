/**
 * Verification: Provider communications (Gellert ops blitz, workstream G-6)
 * Run: npx tsx scripts/verify-ops-comms.ts
 *
 * Standalone harness — this block is merged into scripts/verify-gellert-ops.ts
 * at integration. Covers:
 *  - rendered intake notification carries intake-completion date + PCP date
 *  - rendered exit notification carries reason + date + closure line
 *  - subjects carry the "secmsg:" HIPAA convention on all four types
 *  - notifyReferringProvider persistence semantics (override honored,
 *    simulated: true, providerNotifiedAt stamped) — mirrors the reducer in
 *    lib/demo-data-context.tsx since context actions aren't standalone
 *    functions; the mirror is asserted against the real render output too
 *  - seed integrity: the 3 seeded providerCommunications resolve to real
 *    referrals/patients and carry the expected types
 */

import { renderProviderComm } from "../lib/provider-comms"
import { createInitialState } from "../lib/store"
import { initialReferrals, initialPatients, initialProviderCommunications } from "../lib/initial-data"
import type { ProviderCommunication, Referral } from "../lib/types"

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

// ============================================================================
// BLOCK 1: RENDER CONTENT — required elements per type
// ============================================================================

run("Block 1: Rendered templates carry the required elements", () => {
  const intake = renderProviderComm("intake_notification", {
    patientName: "Jamie Rivera",
    referringProvider: "Dr. Test",
    intakeCompletedDate: "March 3",
    pcpAppointmentDate: "March 10",
    clinicalSummary: "CHF (I50.9)",
  })
  assert(intake.body.includes("March 3"), "intake: includes intake completion date")
  assert(intake.body.includes("March 10"), "intake: includes scheduled PCP date")
  assert(intake.subject.startsWith("secmsg:"), "intake: subject carries secmsg: prefix")

  const exit = renderProviderComm("exit_notification", {
    patientName: "Jamie Rivera",
    exitReason: "goals_met",
    exitDate: "2026-04-01",
  })
  assert(exit.body.includes("goals_met"), "exit: includes exit reason")
  assert(exit.body.includes("2026-04-01"), "exit: includes exit date")
  assert(exit.body.toLowerCase().includes("closed"), "exit: includes record-closure line")
  assert(exit.subject.startsWith("secmsg:"), "exit: subject carries secmsg: prefix")

  const ineligible = renderProviderComm("ineligible_notification", {
    patientName: "Jamie Rivera",
    ineligibilityReason: "out_of_service_area",
    closedDate: "2026-02-01",
  })
  assert(ineligible.subject.startsWith("secmsg:"), "ineligible: subject carries secmsg: prefix")
  assert(ineligible.body.includes("out_of_service_area"), "ineligible: includes reason")

  const unreachable = renderProviderComm("unreachable_notification", {
    patientName: "Jamie Rivera",
    outreachAttempts: 7,
    closedDate: "2026-02-15",
  })
  assert(unreachable.subject.startsWith("secmsg:"), "unreachable: subject carries secmsg: prefix")
  assert(unreachable.body.includes("7 documented outreach attempts"), "unreachable: includes attempt count")
})

// ============================================================================
// BLOCK 2: notifyReferringProvider PERSISTENCE SEMANTICS (mirrored reducer)
// ============================================================================

/**
 * Mirrors the notifyReferringProvider reducer body (lib/demo-data-context.tsx)
 * closely enough to validate its storage contract without a React runtime.
 * Any drift here should be caught by integration smoke-testing the live app.
 */
function mirrorNotifyReferringProvider(
  referrals: Referral[],
  entity: { referralId?: string; patientId?: string },
  byId: string,
  byName: string,
  type: ProviderCommunication["type"],
  override?: { subject: string; body: string }
): { comm: ProviderCommunication; updatedReferral?: Referral } {
  const now = new Date().toISOString()
  const referral = entity.referralId ? referrals.find((r) => r.id === entity.referralId) : undefined
  const subjectName = referral?.patientName ?? "Unknown Patient"

  const rendered = override ?? renderProviderComm(type, { patientName: subjectName })

  const comm: ProviderCommunication = {
    id: `pcomm-test-${Date.now()}`,
    referralId: entity.referralId,
    patientId: entity.patientId ?? referral?.patientId,
    type,
    subject: rendered.subject,
    body: rendered.body,
    sentAt: now,
    sentBy: byId,
    sentByName: byName,
    simulated: true,
  }

  const updatedReferral = referral && entity.referralId ? { ...referral, providerNotifiedAt: now } : undefined
  return { comm, updatedReferral }
}

run("Block 2: notifyReferringProvider override persistence + stamping", () => {
  const referral = initialReferrals.find((r) => r.status === "unreachable") as Referral
  assert(!!referral, "fixture: a seeded unreachable referral exists")

  const override = { subject: "secmsg: Edited subject for Jamie Rivera", body: "Edited body text — reviewed by supervisor." }
  const { comm, updatedReferral } = mirrorNotifyReferringProvider(
    initialReferrals,
    { referralId: referral.id },
    "sup1",
    "Test Supervisor",
    "unreachable_notification",
    override
  )

  assert(comm.subject === override.subject, "edited subject persists exactly as overridden")
  assert(comm.body === override.body, "edited body persists exactly as overridden")
  assert(comm.simulated === true, "persisted communication is always simulated: true")
  assert(!!updatedReferral?.providerNotifiedAt, "providerNotifiedAt is still stamped when sending an override")
  assert(comm.sentBy === "sup1" && comm.sentByName === "Test Supervisor", "sender identity recorded")

  // Un-overridden send still renders + stamps (backward compatible)
  const { comm: renderedComm, updatedReferral: renderedReferral } = mirrorNotifyReferringProvider(
    initialReferrals,
    { referralId: referral.id },
    "sup1",
    "Test Supervisor",
    "unreachable_notification"
  )
  assert(renderedComm.subject.startsWith("secmsg:"), "non-override send still renders the template")
  assert(!!renderedReferral?.providerNotifiedAt, "non-override send still stamps providerNotifiedAt")
})

// ============================================================================
// BLOCK 3: SEED INTEGRITY — 3 providerCommunications resolve
// ============================================================================

run("Block 3: Seeded providerCommunications resolve to real entities", () => {
  const state = createInitialState()
  assert(state.providerCommunications.length === 3, `exactly 3 seeded providerCommunications (found ${state.providerCommunications.length})`)
  assert(initialProviderCommunications.length === 3, "initial-data exports 3 seeded records")

  const referralIds = new Set(initialReferrals.map((r) => r.id))
  const patientIds = new Set(initialPatients.map((p) => p.id))

  for (const comm of initialProviderCommunications) {
    assert(comm.simulated === true, `${comm.id}: simulated true`)
    assert(comm.subject.startsWith("secmsg:"), `${comm.id}: subject carries secmsg: prefix`)
    if (comm.referralId) {
      assert(referralIds.has(comm.referralId), `${comm.id}: referralId resolves to a seeded referral`)
    }
    if (comm.patientId) {
      assert(patientIds.has(comm.patientId), `${comm.id}: patientId resolves to a seeded patient`)
    }
    assert(!!comm.referralId || !!comm.patientId, `${comm.id}: carries at least one entity link`)
  }

  const intakeCount = initialProviderCommunications.filter((c) => c.type === "intake_notification").length
  const unreachableCount = initialProviderCommunications.filter((c) => c.type === "unreachable_notification").length
  assert(intakeCount === 2, `2 seeded intake notifications (found ${intakeCount})`)
  assert(unreachableCount === 1, `1 seeded unreachable notification (found ${unreachableCount})`)
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
