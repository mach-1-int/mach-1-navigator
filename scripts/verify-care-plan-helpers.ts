/**
 * Verification script for lib/care-plan-helpers.ts.
 * Run: npx tsx scripts/verify-care-plan-helpers.ts
 */

import type { CarePlan, CareTemplate, GoalTracking } from "../lib/types"
import {
  getCarePlanByPatient,
  calculateGoalStatus,
  createCarePlanFromTemplate,
  addGoalDataPoint,
  getRecentGoalHistory,
} from "../lib/care-plan-helpers"

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

console.log("lib/care-plan-helpers – Verification")
console.log("=============================================")

function goal(overrides: Partial<GoalTracking> = {}): GoalTracking {
  return {
    id: "g1",
    goalDefinitionId: "gd1",
    description: "Reduce weight",
    targetValue: 180,
    metricUnit: "lbs",
    direction: "below",
    history: [],
    status: "not_started",
    ...overrides,
  }
}

run("getCarePlanByPatient: finds the active plan for a patient", () => {
  const plans: CarePlan[] = [
    { id: "cp1", patientId: "pt1", templateId: "t1", templateName: "CHF", startDate: "2026-01-01", activeGoals: [], activeTasks: [], status: "completed" },
    { id: "cp2", patientId: "pt1", templateId: "t1", templateName: "CHF", startDate: "2026-02-01", activeGoals: [], activeTasks: [], status: "active" },
    { id: "cp3", patientId: "pt2", templateId: "t1", templateName: "CHF", startDate: "2026-02-01", activeGoals: [], activeTasks: [], status: "active" },
  ]
  const found = getCarePlanByPatient(plans, "pt1")
  assert(found?.id === "cp2", "returns the active plan, ignoring completed ones")
})

run("getCarePlanByPatient: undefined when no active plan exists", () => {
  const plans: CarePlan[] = [
    { id: "cp1", patientId: "pt1", templateId: "t1", templateName: "CHF", startDate: "2026-01-01", activeGoals: [], activeTasks: [], status: "completed" },
  ]
  assert(getCarePlanByPatient(plans, "pt1") === undefined, "returns undefined")
})

run("calculateGoalStatus: not_started with empty history", () => {
  assert(calculateGoalStatus(goal({ history: [] })) === "not_started", "empty history -> not_started")
})

run("calculateGoalStatus: 'below' direction on_track/warning/critical", () => {
  const g = goal({ direction: "below", targetValue: 180, warningThreshold: 190 })
  assert(
    calculateGoalStatus({ ...g, history: [{ date: "2026-01-01", value: 175, loggedBy: "n1" }] }) === "on_track",
    "value below target -> on_track"
  )
  assert(
    calculateGoalStatus({ ...g, history: [{ date: "2026-01-01", value: 185, loggedBy: "n1" }] }) === "warning",
    "value between target and warning threshold -> warning"
  )
  assert(
    calculateGoalStatus({ ...g, history: [{ date: "2026-01-01", value: 200, loggedBy: "n1" }] }) === "critical",
    "value past warning threshold -> critical"
  )
})

run("calculateGoalStatus: 'above' direction on_track/warning/critical", () => {
  const g = goal({ direction: "above", targetValue: 80, warningThreshold: 70 })
  assert(
    calculateGoalStatus({ ...g, history: [{ date: "2026-01-01", value: 85, loggedBy: "n1" }] }) === "on_track",
    "value above target -> on_track"
  )
  assert(
    calculateGoalStatus({ ...g, history: [{ date: "2026-01-01", value: 75, loggedBy: "n1" }] }) === "warning",
    "value between warning threshold and target -> warning"
  )
  assert(
    calculateGoalStatus({ ...g, history: [{ date: "2026-01-01", value: 60, loggedBy: "n1" }] }) === "critical",
    "value below warning threshold -> critical"
  )
})

run("createCarePlanFromTemplate: builds goals/tasks from a template", () => {
  const template: CareTemplate = {
    id: "t1",
    name: "CHF Pathway",
    description: "desc",
    condition: "CHF",
    goals: [
      { id: "gd1", description: "Weight", targetValue: 180, metricUnit: "lbs", direction: "below", frequency: "daily" },
    ],
    tasks: [
      { id: "td1", description: "Check vitals", frequency: "daily", category: "vitals" },
    ],
  }
  const plan = createCarePlanFromTemplate(template, "pt1")
  assert(plan.patientId === "pt1", "sets patientId")
  assert(plan.templateId === "t1" && plan.templateName === "CHF Pathway", "carries template identity")
  assert(plan.status === "active", "new plan is active")
  assert(plan.activeGoals.length === 1 && plan.activeGoals[0].goalDefinitionId === "gd1", "maps goal definitions")
  assert(plan.activeGoals[0].status === "not_started" && plan.activeGoals[0].history.length === 0, "goals start empty/not_started")
  assert(plan.activeTasks.length === 1 && plan.activeTasks[0].taskDefinitionId === "td1", "maps task definitions")
  assert(plan.id.length > 0 && plan.activeGoals[0].id.length > 0 && plan.activeTasks[0].id.length > 0, "generates ids for plan, goals, and tasks")
})

run("addGoalDataPoint: appends history and recalculates status on the matching goal only", () => {
  const plan: CarePlan = {
    id: "cp1",
    patientId: "pt1",
    templateId: "t1",
    templateName: "CHF",
    startDate: "2026-01-01",
    activeGoals: [
      goal({ id: "g1", direction: "below", targetValue: 180 }),
      goal({ id: "g2", direction: "below", targetValue: 100 }),
    ],
    activeTasks: [],
    status: "active",
  }
  const updated = addGoalDataPoint(plan, "g1", 175, "nav1")
  const updatedGoal = updated.activeGoals.find((g) => g.id === "g1")!
  const untouchedGoal = updated.activeGoals.find((g) => g.id === "g2")!
  assert(updatedGoal.history.length === 1 && updatedGoal.history[0].value === 175, "appends the data point")
  assert(updatedGoal.history[0].loggedBy === "nav1", "records who logged it")
  assert(updatedGoal.status === "on_track", "recalculates status from the new history")
  assert(untouchedGoal.history.length === 0, "leaves other goals untouched")
  assert(plan.activeGoals[0].history.length === 0, "does not mutate the original plan")
})

run("getRecentGoalHistory: filters to the last N days", () => {
  const now = new Date()
  const daysAgo = (n: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d.toISOString()
  }
  const g = goal({
    history: [
      { date: daysAgo(1), value: 1, loggedBy: "n1" },
      { date: daysAgo(10), value: 2, loggedBy: "n1" },
      { date: daysAgo(6), value: 3, loggedBy: "n1" },
    ],
  })
  const recent = getRecentGoalHistory(g, 7)
  assert(recent.length === 2, "keeps only points within the last 7 days (got " + recent.length + ")")
  assert(recent.every((dp) => dp.value !== 2), "excludes the point older than the cutoff")
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
