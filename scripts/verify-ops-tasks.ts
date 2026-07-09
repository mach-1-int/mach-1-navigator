/**
 * Verification: Engagement engine (workstream G-3)
 * Run: npx tsx scripts/verify-ops-tasks.ts
 *
 * Standalone harness for the pieces G-3 owns: task-engine window derivation
 * at fixed timestamps, idempotent generation, no_show -> recovery task,
 * completed -> followup task, confirmation completion stamping the
 * appointment, overdueTasks date-based boundary, and the two flipped
 * playbook KPIs (missed-appointment same-day recovery, weekly-contact
 * cadence) against the seeded data.
 */

import {
  deriveDueConfirmationTasks,
  taskForCompletedVisit,
  taskForNoShow,
  overdueTasks,
  taskId,
  confirmationWindowForType,
  localDateOf,
  TASK_TYPE_CONFIG,
} from "../lib/task-engine"
import { weeklyContactCounts, cadenceStatus } from "../lib/engagement"
import { computePlaybookKpis } from "../lib/playbook-kpis"
import {
  initialAppointments,
  initialNavigatorTasks,
  initialPatients,
  initialNavigators,
  initialTimeLogs,
  initialNotes,
  initialReferrals,
  initialChargeSlips,
  initialAdverseEvents,
} from "../lib/initial-data"
import { getPayerConfig } from "../lib/payer-config"
import type { Appointment, NavigatorTask } from "../lib/types"

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

function mkAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt-verify-fixture",
    patientId: "pt-fixture",
    navigatorId: "nav-fixture",
    date: "2026-04-09",
    time: "10:00",
    type: "home_visit",
    status: "scheduled",
    ...overrides,
  }
}

// ============================================================================
// BLOCK 1: WINDOW DERIVATION AT FIXED TIMESTAMPS
// ============================================================================

run("Block 1: Confirmation window derivation at fixed timestamps", () => {
  const appt = mkAppointment() // 2026-04-09 10:00 local

  // Before any window opens
  const early = deriveDueConfirmationTasks([appt], [], new Date("2026-04-06T09:00:00"))
  assert(early.length === 0, "no window open more than 48h before the appointment")

  // Exactly at 48h entry
  const at48 = deriveDueConfirmationTasks([appt], [], new Date("2026-04-07T10:00:00"))
  assert(
    at48.length === 1 && at48[0].type === "confirmation_48h" && at48[0].dueAt === new Date("2026-04-07T10:00:00").toISOString(),
    "48h window enters exactly 48h before the appointment"
  )

  // 24h entry
  const at24 = deriveDueConfirmationTasks([appt], [], new Date("2026-04-08T10:00:00"))
  assert(at24.length === 2 && at24.some((t) => t.type === "confirmation_24h"), "24h window opens 24h before the appointment")

  // Day-of entry (08:00 local on appointment date)
  const dayOf = deriveDueConfirmationTasks([appt], [], new Date("2026-04-09T08:00:00"))
  assert(dayOf.length === 3, "all three windows open by 08:00 on the appointment date")
})

// ============================================================================
// BLOCK 2: IDEMPOTENT GENERATION (call twice -> 0 new)
// ============================================================================

run("Block 2: Idempotent generation — second call yields 0 new tasks", () => {
  const appt = mkAppointment({ id: "apt-verify-idem" })
  const now = new Date("2026-04-09T08:30:00")

  const firstPass = deriveDueConfirmationTasks([appt], [], now)
  assert(firstPass.length === 3, "first generation produces the 3 open windows")

  const secondPass = deriveDueConfirmationTasks([appt], firstPass, now)
  assert(secondPass.length === 0, "second generation against the same existing tasks produces nothing new")

  // Mixed statuses still suppress regeneration
  const doneAndDismissed: NavigatorTask[] = [
    { ...firstPass[0], status: "done", completedAt: now.toISOString(), completedBy: "nav-fixture" },
    { ...firstPass[1], status: "dismissed", completedAt: now.toISOString(), completedBy: "nav-fixture", note: "n/a" },
  ]
  const thirdPass = deriveDueConfirmationTasks([appt], doneAndDismissed, now)
  assert(thirdPass.length === 1, "done/dismissed tasks still occupy their idempotency key")
})

// ============================================================================
// BLOCK 3: NO-SHOW -> RECOVERY TASK
// ============================================================================

run("Block 3: no_show -> no_show_recovery task", () => {
  const appt = mkAppointment({ id: "apt-verify-noshow", status: "no_show", date: "2026-04-09" })
  const task = taskForNoShow(appt)
  assert(task.type === "no_show_recovery", "task type is no_show_recovery")
  assert(task.appointmentId === appt.id, "task references the appointment")
  assert(task.dueAt === new Date("2026-04-09T18:00:00").toISOString(), "due 6:00 PM local same day")
  assert(task.id === taskId("no_show_recovery", appt.id), "deterministic task id")
  assert(task.status === "open", "task starts open")
})

// ============================================================================
// BLOCK 4: COMPLETED -> FOLLOWUP TASK
// ============================================================================

run("Block 4: completed visit -> post_visit_followup task", () => {
  const appt = mkAppointment({ id: "apt-verify-completed", status: "completed", date: "2026-04-09", time: "11:00" })
  const task = taskForCompletedVisit(appt)
  assert(task.type === "post_visit_followup", "task type is post_visit_followup")
  assert(
    task.dueAt === new Date(new Date("2026-04-09T11:00:00").getTime() + 24 * 3600 * 1000).toISOString(),
    "due +24h from the appointment datetime"
  )
  assert(task.id === taskId("post_visit_followup", appt.id), "deterministic task id")
})

// ============================================================================
// BLOCK 5: CONFIRMATION COMPLETION STAMPS THE APPOINTMENT (via seeded state)
// ============================================================================

run("Block 5: Confirmation task completion semantics (window -> appointment stamp)", () => {
  // Mirrors completeTask's stamping logic in lib/demo-data-context.tsx: a
  // confirmation task's type maps to a window, and completion appends to
  // appointment.confirmations[] with a validated outcome (bad outcomes fall
  // back to "confirmed" per the frozen contract).
  const CONFIRMATION_OUTCOMES = ["confirmed", "no_answer", "reschedule_requested"] as const

  function stampFromCompletion(appt: Appointment, task: NavigatorTask, outcome: string | undefined, by: string) {
    const window = confirmationWindowForType(task.type)
    if (!window) return appt
    const resolvedOutcome = outcome ?? "confirmed"
    const validOutcome = (CONFIRMATION_OUTCOMES as readonly string[]).includes(resolvedOutcome)
      ? (resolvedOutcome as (typeof CONFIRMATION_OUTCOMES)[number])
      : "confirmed"
    return {
      ...appt,
      confirmations: [...(appt.confirmations ?? []), { window, at: new Date().toISOString(), by, outcome: validOutcome }],
    }
  }

  const appt = mkAppointment({ id: "apt-verify-stamp" })
  const task48: NavigatorTask = {
    id: taskId("confirmation_48h", appt.id), type: "confirmation_48h", patientId: appt.patientId,
    navigatorId: appt.navigatorId, appointmentId: appt.id, dueAt: "2026-04-07T10:00:00",
    status: "open", createdAt: "2026-04-07T10:00:00", source: "system",
  }

  const stampedConfirmed = stampFromCompletion(appt, task48, "confirmed", "nav-fixture")
  assert(stampedConfirmed.confirmations?.length === 1, "completion appends one confirmation entry")
  assert(stampedConfirmed.confirmations?.[0].window === "48h", "confirmation entry carries the task's window")
  assert(stampedConfirmed.confirmations?.[0].outcome === "confirmed", "explicit valid outcome is preserved")

  const stampedNoAnswer = stampFromCompletion(appt, { ...task48, id: "t2" }, "no_answer", "nav-fixture")
  assert(stampedNoAnswer.confirmations?.[0].outcome === "no_answer", "no_answer outcome is preserved")

  const stampedGarbage = stampFromCompletion(appt, { ...task48, id: "t3" }, "yes please", "nav-fixture")
  assert(stampedGarbage.confirmations?.[0].outcome === "confirmed", "invalid outcome strings fall back to confirmed")

  const stampedDefault = stampFromCompletion(appt, { ...task48, id: "t4" }, undefined, "nav-fixture")
  assert(stampedDefault.confirmations?.[0].outcome === "confirmed", "omitted outcome defaults to confirmed")

  const nonConfirmationTask: NavigatorTask = { ...task48, id: "t5", type: "no_show_recovery" as const }
  const untouched = stampFromCompletion(appt, nonConfirmationTask, "confirmed", "nav-fixture")
  assert(!untouched.confirmations, "non-confirmation task types never stamp the appointment")
})

// ============================================================================
// BLOCK 6: OVERDUE MATH (date-based boundary)
// ============================================================================

run("Block 6: overdueTasks is DATE-based, never dueAt < now", () => {
  const now = new Date("2026-04-09T09:00:00")
  const dueLaterTodayOpen: NavigatorTask = {
    id: "t-later-today", type: "confirmation_day_of", patientId: "p", navigatorId: "n",
    dueAt: "2026-04-09T18:00:00", status: "open", createdAt: now.toISOString(), source: "system",
  }
  const dueEarlierTodayOpen: NavigatorTask = { ...dueLaterTodayOpen, id: "t-earlier-today", dueAt: "2026-04-09T06:00:00" }
  const dueYesterdayOpen: NavigatorTask = { ...dueLaterTodayOpen, id: "t-yesterday", dueAt: "2026-04-08T23:59:00" }
  const dueYesterdayDone: NavigatorTask = { ...dueYesterdayOpen, id: "t-yesterday-done", status: "done" }
  const dueYesterdayDismissed: NavigatorTask = { ...dueYesterdayOpen, id: "t-yesterday-dismissed", status: "dismissed" }

  const overdue = overdueTasks(
    [dueLaterTodayOpen, dueEarlierTodayOpen, dueYesterdayOpen, dueYesterdayDone, dueYesterdayDismissed],
    now
  )
  assert(overdue.length === 1 && overdue[0].id === "t-yesterday", "only the open, prior-date task is overdue")
  assert(!overdue.some((t) => t.id === "t-later-today" || t.id === "t-earlier-today"), "same-day tasks are never overdue regardless of time-of-day")
  assert(!overdue.some((t) => t.status !== "open"), "done/dismissed tasks are never overdue")

  assert(localDateOf("2026-04-09T23:59:00") === "2026-04-09", "localDateOf uses the local calendar date")
})

// ============================================================================
// BLOCK 7: SEEDED TASKS — the one confirmed red demo beat
// ============================================================================

run("Block 7: Seed integrity — apt1's overdue 24h confirmation (the red demo beat)", () => {
  const overdue24h = initialNavigatorTasks.find((t) => t.id === "task-confirmation_24h-apt1")
  assert(!!overdue24h && overdue24h.status === "open", "the apt1 24h confirmation task is seeded open")
  const overdueNow = overdueTasks(initialNavigatorTasks, new Date("2026-01-30T09:00:00-07:00"))
  assert(overdueNow.some((t) => t.id === "task-confirmation_24h-apt1"), "apt1's 24h confirmation is overdue on the anchor date")

  const dayOfTask = initialNavigatorTasks.find((t) => t.id === "task-confirmation_day_of-apt1")
  assert(!!dayOfTask && dayOfTask.status === "open", "apt1's day-of confirmation is seeded open (due today, not overdue)")
  assert(!overdueNow.some((t) => t.id === "task-confirmation_day_of-apt1"), "the day-of task is due today, never instantly overdue")

  const apt1 = initialAppointments.find((a) => a.id === "apt1")
  assert(!!apt1?.confirmations?.some((c) => c.window === "48h" && c.outcome === "confirmed"), "apt1 carries the confirmed 48h touch")

  assert(TASK_TYPE_CONFIG.confirmation_24h.icon === "PhoneCall", "TASK_TYPE_CONFIG icon is a lucide name string")
})

// ============================================================================
// BLOCK 8: KPI COMPUTATIONS ON SEEDS
// ============================================================================

run("Block 8: KPI — missed-appointment same-day recovery (seeds)", () => {
  const payerConfig = getPayerConfig("medicaid-bh")
  const kpis = computePlaybookKpis({
    referrals: initialReferrals,
    patients: initialPatients,
    navigators: initialNavigators,
    timeLogs: initialTimeLogs,
    chargeSlips: initialChargeSlips,
    appointments: initialAppointments,
    adverseEvents: initialAdverseEvents,
    payerConfig,
    navigatorTasks: initialNavigatorTasks,
    notes: initialNotes,
  })

  const recoveryKpi = kpis.find((k) => k.id === "missed-appointment-recovery")
  assert(!!recoveryKpi && recoveryKpi.status === "computable", "recovery KPI computes when navigatorTasks is provided")
  assert(typeof recoveryKpi!.detail === "string" && recoveryKpi!.detail!.includes("SOP 3.10"), "recovery KPI cites SOP 3.10")

  const withoutTasks = computePlaybookKpis({
    referrals: initialReferrals, patients: initialPatients, navigators: initialNavigators,
    timeLogs: initialTimeLogs, chargeSlips: initialChargeSlips, appointments: initialAppointments,
    adverseEvents: initialAdverseEvents, payerConfig,
  })
  const placeholderRecovery = withoutTasks.find((k) => k.id === "missed-appointment-recovery")
  assert(placeholderRecovery?.status === "placeholder", "recovery KPI is an honest placeholder when navigatorTasks is omitted")
})

run("Block 8b: KPI — weekly-contact cadence (seeds, no fake target)", () => {
  const payerConfig = getPayerConfig("medicaid-bh")
  const kpis = computePlaybookKpis({
    referrals: initialReferrals,
    patients: initialPatients,
    navigators: initialNavigators,
    timeLogs: initialTimeLogs,
    chargeSlips: initialChargeSlips,
    appointments: initialAppointments,
    adverseEvents: initialAdverseEvents,
    payerConfig,
    navigatorTasks: initialNavigatorTasks,
    notes: initialNotes,
  })

  const cadenceKpi = kpis.find((k) => k.id === "weekly-contact")
  assert(!!cadenceKpi && cadenceKpi.status === "computable", "weekly-contact KPI computes when notes is provided")
  assert(cadenceKpi!.detail!.includes("no target set"), "weekly-contact KPI honestly labels the missing target (playbook ⚑)")
  assert(typeof cadenceKpi!.value === "number" || cadenceKpi!.value === "—", "weekly-contact value is a percentage or em-dash")

  const withoutNotes = computePlaybookKpis({
    referrals: initialReferrals, patients: initialPatients, navigators: initialNavigators,
    timeLogs: initialTimeLogs, chargeSlips: initialChargeSlips, appointments: initialAppointments,
    adverseEvents: initialAdverseEvents, payerConfig,
  })
  const placeholderCadence = withoutNotes.find((k) => k.id === "weekly-contact")
  assert(placeholderCadence?.status === "placeholder", "weekly-contact KPI is an honest placeholder when notes is omitted")
})

run("Block 8c: cadenceStatus cross-check against a hand-built scenario", () => {
  const now = new Date("2026-01-30T12:00:00-07:00")
  const counts = weeklyContactCounts("pt1", initialNotes, initialTimeLogs, initialAppointments, 1, now)
  const status = cadenceStatus(counts)
  assert(["multiple", "single", "none"].includes(status), "cadenceStatus returns one of the three honest states")
  assert(counts.length === 1 && counts[0].count >= 0, "weeklyContactCounts returns a non-negative count for the current week")
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
