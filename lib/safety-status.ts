/**
 * Safety Status Derivation (pure - no React)
 *
 * Computes a navigator's live SafetyStatus from raw signals (location,
 * schedule, appointments, SOS events) instead of trusting a stored flag.
 * Imported by the supervisor safety map, the movement simulator, and the
 * verify:safety-map script - keep this module dependency-free beyond types.
 */

import type {
  Appointment,
  NavigatorLocation,
  SafetyStatus,
  ScheduleEvent,
  SOSEvent,
} from "./types"

export const SAFETY_RULES = {
  /** No movement + no check-in for this many minutes => IDLE */
  IDLE_AFTER_MIN: 15,
  /** Check-in older than this many minutes => RISK_ALERT */
  MISSED_CHECKIN_MIN: 90,
  /** In a high-risk visit longer than this without checkout => RISK_ALERT */
  HIGH_RISK_VISIT_OVERDUE_MIN: 60,
}

function minutesSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 60000
}

/**
 * Derive the live safety status for one navigator location.
 *
 * Rule order (first match wins):
 * 1. Any non-RESOLVED SOS event for this navigator -> RISK_ALERT
 * 2. High-risk visit overdue (in-progress appointment or IN_PROGRESS
 *    high-safety-risk schedule event, or seed-compat "High Acuity" task,
 *    older than HIGH_RISK_VISIT_OVERDUE_MIN) -> RISK_ALERT
 * 3. Check-in age > MISSED_CHECKIN_MIN -> RISK_ALERT
 * 4. Check-in age >= IDLE_AFTER_MIN and not moving -> IDLE
 * 5. Otherwise -> ACTIVE
 */
export function deriveSafetyStatus(
  loc: NavigatorLocation,
  scheduleEvents: ScheduleEvent[],
  appointments: Appointment[],
  sosEvents: SOSEvent[],
  now: Date
): SafetyStatus {
  // Rule 1: live SOS (ACTIVE or ACKNOWLEDGED) always wins
  if (sosEvents.some((s) => s.navigatorId === loc.navigatorId && s.status !== "RESOLVED")) {
    return "RISK_ALERT"
  }

  const checkInAgeMin = minutesSince(loc.lastCheckIn, now)

  // Rule 2a: in-progress appointment past the overdue window, where the
  // visit is high-risk per a linked/matching high-safety-risk schedule event
  const overdueHighRiskAppointment = appointments.some((apt) => {
    if (apt.navigatorId !== loc.navigatorId) return false
    if (apt.status !== "in_progress" || !apt.checkInTime) return false
    if (minutesSince(apt.checkInTime, now) <= SAFETY_RULES.HIGH_RISK_VISIT_OVERDUE_MIN) return false
    return scheduleEvents.some(
      (evt) =>
        evt.isHighSafetyRisk &&
        (evt.linkedAppointmentId === apt.id ||
          (evt.navigatorId === apt.navigatorId && evt.patientId === apt.patientId))
    )
  })

  // Rule 2b: high-safety-risk schedule event running past the overdue window
  const overdueHighRiskEvent = scheduleEvents.some(
    (evt) =>
      evt.navigatorId === loc.navigatorId &&
      evt.isHighSafetyRisk &&
      evt.status === "IN_PROGRESS" &&
      minutesSince(evt.startTime, now) > SAFETY_RULES.HIGH_RISK_VISIT_OVERDUE_MIN
  )

  // Rule 2c (seed-compat): the location itself marks a high-acuity visit
  // and the navigator hasn't checked in within the overdue window
  const overdueHighAcuityTask =
    (loc.currentTask ?? "").includes("High Acuity") &&
    checkInAgeMin > SAFETY_RULES.HIGH_RISK_VISIT_OVERDUE_MIN

  if (overdueHighRiskAppointment || overdueHighRiskEvent || overdueHighAcuityTask) {
    return "RISK_ALERT"
  }

  // Rule 3: missed check-in
  if (checkInAgeMin > SAFETY_RULES.MISSED_CHECKIN_MIN) return "RISK_ALERT"

  // Rule 4: stale and stationary
  if (checkInAgeMin >= SAFETY_RULES.IDLE_AFTER_MIN && (loc.speed ?? 0) === 0) return "IDLE"

  return "ACTIVE"
}

/** Derive statuses for a fleet, keyed by navigatorId. */
export function deriveAllStatuses(
  locations: NavigatorLocation[],
  scheduleEvents: ScheduleEvent[],
  appointments: Appointment[],
  sosEvents: SOSEvent[],
  now: Date
): Map<string, SafetyStatus> {
  const statuses = new Map<string, SafetyStatus>()
  locations.forEach((loc) => {
    statuses.set(loc.navigatorId, deriveSafetyStatus(loc, scheduleEvents, appointments, sosEvents, now))
  })
  return statuses
}
