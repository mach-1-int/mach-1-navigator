/**
 * Verification: G-7 Training / onboarding module (Gellert ops blitz)
 * Run: npx tsx scripts/verify-ops-onboarding.ts
 *
 * Standalone harness — merges into scripts/verify-gellert-ops.ts at
 * integration. Covers: curriculum integrity, onboardingProgress math,
 * the certification transition (status + unitsTargetPhase 16->18), seed
 * record validity vs Navigator.level, and nextMilestone ordering.
 */

import {
  ONBOARDING_CURRICULUM,
  SHADOW_CHECKLIST,
  CERTIFICATION_BONUS,
  createOnboardingRecord,
  onboardingProgress,
  nextMilestone,
} from "../lib/onboarding"
import { initialNavigators, initialNavigatorOnboarding } from "../lib/initial-data"
import type { NavigatorOnboarding, OnboardingMilestoneKey } from "../lib/types"

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

console.log("G-7 Training / Onboarding Module — Verification")
console.log("====================================================")

// ============================================================================
// BLOCK 1: CURRICULUM INTEGRITY
// ============================================================================

run("Block 1: Curriculum has the 8 playbook §10.1 milestones with unique keys", () => {
  assert(ONBOARDING_CURRICULUM.length === 8, `curriculum has 8 milestones (got ${ONBOARDING_CURRICULUM.length})`)
  const keys = ONBOARDING_CURRICULUM.map((m) => m.key)
  assert(new Set(keys).size === keys.length, "milestone keys are unique")

  const expected: OnboardingMilestoneKey[] = [
    "orientation_week1", "cpss_exam", "gellert_exam", "shadowing",
    "review_30", "review_60", "review_90", "certification",
  ]
  for (const key of expected) {
    assert(keys.includes(key), `curriculum includes "${key}"`)
  }
  assert(keys.includes("review_30") && keys.includes("review_60") && keys.includes("review_90"),
    "30/60/90-day reviews are all present")
  assert(keys[keys.length - 1] === "certification", "certification is the terminal milestone")

  for (const m of ONBOARDING_CURRICULUM) {
    assert(!!m.label && !!m.description, `${m.key}: has label + description`)
    assert(typeof m.targetDay === "number" && m.targetDay > 0, `${m.key}: has a positive targetDay`)
  }

  assert(SHADOW_CHECKLIST.length === 7, `shadow checklist has 7 items (got ${SHADOW_CHECKLIST.length})`)
  const shadowKeys = SHADOW_CHECKLIST.map((i) => i.key)
  assert(new Set(shadowKeys).size === shadowKeys.length, "shadow checklist keys are unique")

  assert(CERTIFICATION_BONUS === 2500, "certification bonus is $2,500 per playbook §10 comp table")
})

// ============================================================================
// BLOCK 2: createOnboardingRecord + onboardingProgress MATH
// ============================================================================

run("Block 2: Fresh record shape + progress math", () => {
  const fresh = createOnboardingRecord("nav-x", "2026-03-01")
  assert(fresh.milestones.length === 8, "fresh record has 8 milestones")
  assert(fresh.milestones.every((m) => m.status === "pending"), "all milestones start pending")
  assert(fresh.shadowChecklist.length === 7, "fresh record has 7 shadow items")
  assert(fresh.shadowChecklist.every((i) => !i.done), "all shadow items start undone")
  assert(fresh.status === "developmental", "fresh record status is developmental")
  assert(fresh.unitsTargetPhase === 16, "fresh record defaults to 16 units/day")

  const custom = createOnboardingRecord("nav-y", "2026-03-01", 20)
  assert(custom.unitsTargetPhase === 20, "unitsTargetPhase override respected")

  const p0 = onboardingProgress(fresh)
  assert(p0.completed === 0 && p0.total === 8 && p0.percent === 0, "0/8 completed = 0%")
  assert(p0.shadowDone === 0 && p0.shadowTotal === 7, "0/7 shadow items done")

  // Progress math at partial completion (rounding behavior)
  const partial: NavigatorOnboarding = {
    ...fresh,
    milestones: fresh.milestones.map((m, i) => (i < 3 ? { ...m, status: "completed" as const } : m)),
    shadowChecklist: fresh.shadowChecklist.map((s, i) => (i < 2 ? { ...s, done: true } : s)),
  }
  const p1 = onboardingProgress(partial)
  assert(p1.completed === 3 && p1.total === 8, "3/8 completed")
  assert(p1.percent === Math.round((3 / 8) * 100), `percent rounds correctly (${p1.percent}%)`)
  assert(p1.shadowDone === 2 && p1.shadowTotal === 7, "2/7 shadow items done")

  const full: NavigatorOnboarding = {
    ...fresh,
    milestones: fresh.milestones.map((m) => ({ ...m, status: "completed" as const })),
  }
  assert(onboardingProgress(full).percent === 100, "8/8 completed = 100%")
})

// ============================================================================
// BLOCK 3: nextMilestone ORDERING
// ============================================================================

run("Block 3: nextMilestone ordering (in-progress > pending > null)", () => {
  const fresh = createOnboardingRecord("nav-x", "2026-03-01")
  assert(nextMilestone(fresh)?.key === "orientation_week1", "fresh record's next milestone is Week-1 orientation")

  // In-progress milestone takes priority over earlier pending ones? No —
  // "first in-progress in curriculum order" wins over "first pending" only
  // when an in-progress milestone exists at all; verify exact precedence.
  const withInProgressLater: NavigatorOnboarding = {
    ...fresh,
    milestones: fresh.milestones.map((m) =>
      m.key === "shadowing" ? { ...m, status: "in_progress" as const } : m
    ),
  }
  assert(nextMilestone(withInProgressLater)?.key === "shadowing",
    "an in-progress milestone later in the curriculum still wins over earlier pending ones")

  const withEarlierCompleted: NavigatorOnboarding = {
    ...fresh,
    milestones: fresh.milestones.map((m) =>
      ["orientation_week1", "cpss_exam"].includes(m.key) ? { ...m, status: "completed" as const } : m
    ),
  }
  assert(nextMilestone(withEarlierCompleted)?.key === "gellert_exam",
    "with no in-progress milestones, next = first pending in curriculum order")

  const full: NavigatorOnboarding = {
    ...fresh,
    milestones: fresh.milestones.map((m) => ({ ...m, status: "completed" as const })),
  }
  assert(nextMilestone(full) === null, "fully completed record has no next milestone")
})

// ============================================================================
// BLOCK 4: CERTIFICATION TRANSITION (status + unitsTargetPhase 16 -> 18)
// ============================================================================

run("Block 4: Certification flips status and ramps units target 16 -> 18", () => {
  // Pure re-implementation of the updateOnboardingMilestone certification
  // transition (lib/demo-data-context.tsx) to assert the contract in
  // isolation, since the context action requires React runtime.
  function applyMilestoneUpdate(
    record: NavigatorOnboarding,
    key: OnboardingMilestoneKey,
    status: "pending" | "in_progress" | "completed"
  ): NavigatorOnboarding {
    const today = "2026-07-09"
    const certifying = key === "certification" && status === "completed" && record.status === "developmental"
    return {
      ...record,
      milestones: record.milestones.map((m) =>
        m.key === key ? { ...m, status, completedAt: status === "completed" ? today : undefined } : m
      ),
      status: certifying ? "certified" : record.status,
      unitsTargetPhase: certifying ? 18 : record.unitsTargetPhase,
    }
  }

  const record = createOnboardingRecord("nav-x", "2026-01-01")
  assert(record.status === "developmental" && record.unitsTargetPhase === 16, "starts developmental at 16/day")

  const inProgress = applyMilestoneUpdate(record, "certification", "in_progress")
  assert(inProgress.status === "developmental" && inProgress.unitsTargetPhase === 16,
    "marking certification in_progress does NOT flip status or bump units target")

  const certified = applyMilestoneUpdate(inProgress, "certification", "completed")
  assert(certified.status === "certified", "completing certification flips status to certified")
  assert(certified.unitsTargetPhase === 18, "completing certification ramps units target 16 -> 18")
  assert(certified.milestones.find((m) => m.key === "certification")?.completedAt === "2026-07-09",
    "certification milestone stamps completedAt")

  // Already-certified/lead records are untouched by a second completion (idempotency guard in the real action
  // short-circuits on unchanged status; here we assert the pure transition doesn't re-trigger from a non-developmental base)
  const alreadyLead: NavigatorOnboarding = { ...certified, status: "lead", unitsTargetPhase: 20 }
  const reapplied = applyMilestoneUpdate(alreadyLead, "certification", "completed")
  assert(reapplied.status === "lead" && reapplied.unitsTargetPhase === 20,
    "certifying is a no-op transition once a record has moved past developmental (lead stays lead/20)")
})

// ============================================================================
// BLOCK 5: SEED RECORD VALIDITY
// ============================================================================

run("Block 5: Seed records are valid and consistent with Navigator.level", () => {
  assert(initialNavigatorOnboarding.length === 3, `3 seeded onboarding records (got ${initialNavigatorOnboarding.length})`)

  const navById = new Map(initialNavigators.map((n) => [n.id, n]))
  const curriculumKeys = new Set(ONBOARDING_CURRICULUM.map((m) => m.key))
  const shadowKeys = new Set(SHADOW_CHECKLIST.map((s) => s.key))

  for (const record of initialNavigatorOnboarding) {
    const nav = navById.get(record.navigatorId)
    assert(!!nav, `${record.navigatorId}: references a real seeded navigator`)

    assert(record.milestones.length === 8, `${record.navigatorId}: 8 milestones present`)
    const mKeys = record.milestones.map((m) => m.key)
    assert(new Set(mKeys).size === 8, `${record.navigatorId}: milestone keys unique`)
    assert(mKeys.every((k) => curriculumKeys.has(k)), `${record.navigatorId}: milestone keys match curriculum`)
    for (const m of record.milestones) {
      assert(["pending", "in_progress", "completed"].includes(m.status), `${record.navigatorId}/${m.key}: valid status`)
      if (m.status === "completed") {
        assert(!!m.completedAt, `${record.navigatorId}/${m.key}: completed milestone has completedAt`)
      }
    }

    assert(record.shadowChecklist.length === 7, `${record.navigatorId}: 7 shadow items present`)
    assert(record.shadowChecklist.every((s) => shadowKeys.has(s.key)), `${record.navigatorId}: shadow keys match SHADOW_CHECKLIST`)

    assert(["developmental", "certified", "lead"].includes(record.status), `${record.navigatorId}: valid top-level status`)
    assert(record.unitsTargetPhase >= 16, `${record.navigatorId}: unitsTargetPhase >= 16`)

    // Status consistency with Navigator.level (developmental=1, lead=3 per seed convention)
    if (record.status === "developmental") {
      assert(nav!.level === 1, `${nav!.name}: developmental record sits on a level-1 navigator`)
      assert(record.unitsTargetPhase === 16, `${nav!.name}: developmental record still at 16/day`)
    }
    if (record.status === "certified") {
      assert(nav!.level >= 2, `${nav!.name}: certified record sits on a level-2+ navigator`)
      assert(record.unitsTargetPhase === 18, `${nav!.name}: certified record ramped to 18/day`)
    }
    if (record.status === "lead") {
      assert(nav!.level === 3, `${nav!.name}: lead record sits on a level-3 navigator`)
      const cert = record.milestones.find((m) => m.key === "certification")
      assert(cert?.status === "completed", `${nav!.name}: lead record has completed certification`)
    }
  }

  // Named personas from the spec
  const sarah = initialNavigatorOnboarding.find((r) => r.navigatorId === "nav-sarah")
  assert(!!sarah, "nav-sarah (Week-1 new hire) is seeded")
  assert(nextMilestone(sarah!)?.key === "orientation_week1", "nav-sarah's next milestone is Week-1 orientation")
  assert(onboardingProgress(sarah!).completed === 0, "nav-sarah has 0 completed milestones (true new hire)")

  const sixtyDay = initialNavigatorOnboarding.find((r) => nextMilestone(r)?.key === "review_60")
  assert(!!sixtyDay, "one navigator sits at the 60-day review stage")

  const nav2 = initialNavigatorOnboarding.find((r) => r.navigatorId === "nav2")
  assert(!!nav2, "nav2 is seeded")
  assert(nav2!.status === "lead", "nav2 status is lead")
  assert(nav2!.milestones.find((m) => m.key === "certification")?.status === "completed",
    "nav2 has completed the certification milestone")
  assert(onboardingProgress(nav2!).percent === 100, "nav2's record is 100% complete")
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
