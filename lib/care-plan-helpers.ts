/**
 * Care Plan Helpers for Mach 1 Care Navigator
 *
 * Care plan lookup, goal status derivation, template instantiation, and
 * goal-history tracking used by the care plan tab and demo data layer.
 */

import type { CarePlan, CareTemplate, GoalDataPoint, GoalTracking } from "./types"
import { generateId } from "./store"

/**
 * Get care plan for a specific patient
 */
export function getCarePlanByPatient(carePlans: CarePlan[], patientId: string): CarePlan | undefined {
  return carePlans.find((cp) => cp.patientId === patientId && cp.status === "active")
}

/**
 * Calculate goal status based on history and target
 */
export function calculateGoalStatus(
  goal: GoalTracking
): "on_track" | "warning" | "critical" | "not_started" {
  if (goal.history.length === 0) {
    return "not_started"
  }

  const latestValue = goal.history[goal.history.length - 1].value
  const { targetValue, direction, warningThreshold } = goal

  // Check if on track based on direction
  let isOnTrack = false
  let isWarning = false

  if (direction === "below") {
    isOnTrack = latestValue <= targetValue
    if (warningThreshold) {
      isWarning = latestValue > targetValue && latestValue <= warningThreshold
    }
  } else if (direction === "above") {
    isOnTrack = latestValue >= targetValue
    if (warningThreshold) {
      isWarning = latestValue < targetValue && latestValue >= warningThreshold
    }
  }

  if (isOnTrack) return "on_track"
  if (isWarning) return "warning"
  return "critical"
}

/**
 * Create a new care plan from a template for a patient
 */
export function createCarePlanFromTemplate(
  template: CareTemplate,
  patientId: string
): CarePlan {
  const activeGoals: GoalTracking[] = template.goals.map((goal) => ({
    id: generateId(),
    goalDefinitionId: goal.id,
    description: goal.description,
    targetValue: goal.targetValue,
    metricUnit: goal.metricUnit,
    direction: goal.direction,
    warningThreshold: goal.warningThreshold,
    history: [],
    status: "not_started",
  }))

  const activeTasks = template.tasks.map((task) => ({
    id: generateId(),
    taskDefinitionId: task.id,
    description: task.description,
    frequency: task.frequency,
    category: task.category,
  }))

  return {
    id: generateId(),
    patientId,
    templateId: template.id,
    templateName: template.name,
    startDate: new Date().toISOString().split("T")[0],
    activeGoals,
    activeTasks,
    status: "active",
  }
}

/**
 * Add a data point to a goal's history and recalculate status
 */
export function addGoalDataPoint(
  carePlan: CarePlan,
  goalId: string,
  value: number,
  loggedBy: string
): CarePlan {
  const dataPoint: GoalDataPoint = {
    date: new Date().toISOString(),
    value,
    loggedBy,
  }

  const updatedGoals = carePlan.activeGoals.map((goal) => {
    if (goal.id === goalId) {
      const updatedHistory = [...goal.history, dataPoint]
      const updatedGoal = { ...goal, history: updatedHistory }
      updatedGoal.status = calculateGoalStatus(updatedGoal)
      return updatedGoal
    }
    return goal
  })

  return { ...carePlan, activeGoals: updatedGoals }
}

/**
 * Get recent goal data points for trending (last N days)
 */
export function getRecentGoalHistory(
  goal: GoalTracking,
  days: number = 7
): GoalDataPoint[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  return goal.history.filter((dp) => new Date(dp.date) >= cutoff)
}
