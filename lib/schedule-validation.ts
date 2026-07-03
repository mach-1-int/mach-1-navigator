/**
 * Schedule Validation Logic for Dual-Track Calendar
 * Handles conflict detection, travel time validation, and safety checks
 */

import type { ScheduleEvent, NavigatorShift, DayOfWeek } from "./types"
import { geo } from "./geo"

// ============================================================================
// TRAVEL TIME UTILITIES
// ============================================================================

/**
 * Get estimated travel time between two zip codes.
 * Delegates to the pluggable geo adapter (haversine simulator tier by default).
 */
export function getEstimatedTravelTime(fromZip: string, toZip: string): number {
  return geo.zipDriveTimeMinutes(fromZip, toZip)
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

export interface ScheduleConflict {
  type: "OVERLAP" | "INSUFFICIENT_TRAVEL" | "DOUBLE_BOOKING" | "SAFETY_RISK" | "INVALID_TIME" | "LONG_SHIFT"
  severity: "ERROR" | "WARNING"
  message: string
  conflictingEventId?: string
  suggestedResolution?: string
}

export interface ValidationResult {
  isValid: boolean
  conflicts: ScheduleConflict[]
}

/**
 * Check if two time ranges overlap
 */
function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1
}

/**
 * Calculate minutes between two times
 */
function minutesBetween(earlier: Date, later: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 1000 / 60)
}

/**
 * Validate a new event against existing events for a navigator
 */
export function validateScheduleEvent(
  newEvent: Omit<ScheduleEvent, "id">,
  existingEvents: ScheduleEvent[],
  options: {
    travelBufferMinutes?: number // Extra buffer for travel (default: 15)
    allowDoubleBooking?: boolean // Allow same navigator at two places (default: false)
    checkHighRiskConflicts?: boolean // Extra scrutiny for high-risk patients (default: true)
  } = {}
): ValidationResult {
  const {
    travelBufferMinutes = 15,
    allowDoubleBooking = false,
    checkHighRiskConflicts = true,
  } = options

  const conflicts: ScheduleConflict[] = []

  const newStart = new Date(newEvent.startTime)
  const newEnd = new Date(newEvent.endTime)

  // Filter to same navigator's events on the same day
  const sameDayEvents = existingEvents.filter((event) => {
    if (event.navigatorId !== newEvent.navigatorId) return false
    const eventDate = new Date(event.startTime).toDateString()
    const newDate = newStart.toDateString()
    return eventDate === newDate && event.status !== "CANCELLED"
  })

  for (const existingEvent of sameDayEvents) {
    const existingStart = new Date(existingEvent.startTime)
    const existingEnd = new Date(existingEvent.endTime)

    // Check 1: Direct time overlap
    if (doTimesOverlap(newStart, newEnd, existingStart, existingEnd)) {
      conflicts.push({
        type: "OVERLAP",
        severity: "ERROR",
        message: `Time conflict with "${existingEvent.title}" (${formatTime(existingStart)} - ${formatTime(existingEnd)})`,
        conflictingEventId: existingEvent.id,
        suggestedResolution: `Reschedule to avoid overlap with existing ${existingEvent.type === "MEDICAL_VISIT" ? "medical appointment" : "navigator visit"}`,
      })
      continue // Skip other checks for this event if there's direct overlap
    }

    // Check 2: Insufficient travel time
    // If new event is AFTER existing event
    if (newStart >= existingEnd) {
      const travelTime = getEstimatedTravelTime(
        existingEvent.location.zipCode,
        newEvent.location.zipCode
      )
      const requiredBuffer = travelTime + travelBufferMinutes
      const actualGap = minutesBetween(existingEnd, newStart)

      if (actualGap < requiredBuffer) {
        conflicts.push({
          type: "INSUFFICIENT_TRAVEL",
          severity: "WARNING",
          message: `Only ${actualGap} min between events, but ${travelTime} min travel + ${travelBufferMinutes} min buffer needed`,
          conflictingEventId: existingEvent.id,
          suggestedResolution: `Start time should be at least ${formatTime(new Date(existingEnd.getTime() + requiredBuffer * 60000))}`,
        })
      }
    }

    // If new event is BEFORE existing event
    if (newEnd <= existingStart) {
      const travelTime = getEstimatedTravelTime(
        newEvent.location.zipCode,
        existingEvent.location.zipCode
      )
      const requiredBuffer = travelTime + travelBufferMinutes
      const actualGap = minutesBetween(newEnd, existingStart)

      if (actualGap < requiredBuffer) {
        conflicts.push({
          type: "INSUFFICIENT_TRAVEL",
          severity: "WARNING",
          message: `Only ${actualGap} min until next event, but ${travelTime} min travel + ${travelBufferMinutes} min buffer needed`,
          conflictingEventId: existingEvent.id,
          suggestedResolution: `End time should be no later than ${formatTime(new Date(existingStart.getTime() - requiredBuffer * 60000))}`,
        })
      }
    }
  }

  // Check 3: Double booking (same patient, different events)
  if (!allowDoubleBooking) {
    const samePatientEvents = existingEvents.filter(
      (event) =>
        event.patientId === newEvent.patientId &&
        event.status !== "CANCELLED" &&
        doTimesOverlap(
          newStart,
          newEnd,
          new Date(event.startTime),
          new Date(event.endTime)
        )
    )

    for (const event of samePatientEvents) {
      conflicts.push({
        type: "DOUBLE_BOOKING",
        severity: "ERROR",
        message: `Patient already has "${event.title}" scheduled at this time`,
        conflictingEventId: event.id,
        suggestedResolution: "Choose a different time slot for this patient",
      })
    }
  }

  // Check 4: High safety risk validation
  if (checkHighRiskConflicts && newEvent.isHighSafetyRisk) {
    // High-risk patients should have adequate time for their appointments
    const eventDuration = minutesBetween(newStart, newEnd)
    if (eventDuration < 45) {
      conflicts.push({
        type: "SAFETY_RISK",
        severity: "WARNING",
        message: "High-risk patient appointment may need more time (minimum 45 min recommended)",
        suggestedResolution: "Consider extending appointment duration for thorough care",
      })
    }

    // Check if navigator has too many high-risk patients on the same day
    const highRiskSameDay = sameDayEvents.filter((e) => e.isHighSafetyRisk).length
    if (highRiskSameDay >= 3) {
      conflicts.push({
        type: "SAFETY_RISK",
        severity: "WARNING",
        message: `Navigator already has ${highRiskSameDay} high-risk appointments this day`,
        suggestedResolution: "Consider redistributing high-risk patients across navigators",
      })
    }
  }

  return {
    isValid: !conflicts.some((c) => c.severity === "ERROR"),
    conflicts,
  }
}

// ============================================================================
// SHIFT VALIDATION
// ============================================================================

/**
 * Convert an "HH:MM" time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Check if two shift date ranges overlap (open-ended endDate = ongoing)
 */
function doDateRangesOverlap(a: NavigatorShift, b: NavigatorShift): boolean {
  const aEnd = a.endDate ?? "9999-12-31"
  const bEnd = b.endDate ?? "9999-12-31"
  return a.startDate <= bEnd && b.startDate <= aEnd
}

/**
 * Validate a new shift against a navigator's existing shifts.
 *
 * ERROR:
 * - endTime <= startTime (invalid time window)
 * - Same navigator has an overlapping shift (overlapping date range AND
 *   overlapping day-of-week set AND overlapping time window)
 * WARNING:
 * - Shift longer than 12 hours
 */
export function validateShift(
  newShift: NavigatorShift,
  existingShifts: NavigatorShift[]
): ValidationResult {
  const conflicts: ScheduleConflict[] = []

  const newStart = timeToMinutes(newShift.startTime)
  const newEnd = timeToMinutes(newShift.endTime)

  // Check 1: Invalid time window
  if (newEnd <= newStart) {
    conflicts.push({
      type: "INVALID_TIME",
      severity: "ERROR",
      message: `End time (${newShift.endTime}) must be after start time (${newShift.startTime})`,
      suggestedResolution: "Adjust the shift end time to be later than the start time",
    })
  }

  // Check 2: Excessive shift length
  if (newEnd - newStart > 12 * 60) {
    conflicts.push({
      type: "LONG_SHIFT",
      severity: "WARNING",
      message: `Shift is longer than 12 hours (${newShift.startTime} - ${newShift.endTime})`,
      suggestedResolution: "Consider splitting into shorter shifts to avoid navigator fatigue",
    })
  }

  // Check 3: Overlap with the navigator's existing shifts
  const navigatorShifts = existingShifts.filter(
    (shift) => shift.navigatorId === newShift.navigatorId && shift.id !== newShift.id
  )

  for (const shift of navigatorShifts) {
    if (!doDateRangesOverlap(newShift, shift)) continue

    const sharedDays = newShift.days.filter((day: DayOfWeek) => shift.days.includes(day))
    if (sharedDays.length === 0) continue

    const existingStart = timeToMinutes(shift.startTime)
    const existingEnd = timeToMinutes(shift.endTime)
    if (newStart < existingEnd && existingStart < newEnd) {
      conflicts.push({
        type: "OVERLAP",
        severity: "ERROR",
        message: `Overlaps existing shift for ${shift.navigatorName} (${shift.startTime} - ${shift.endTime} on ${sharedDays.join(", ")})`,
        conflictingEventId: shift.id,
        suggestedResolution: "Adjust the days, times, or date range to avoid the existing shift",
      })
    }
  }

  return {
    isValid: !conflicts.some((c) => c.severity === "ERROR"),
    conflicts,
  }
}

// ============================================================================
// SCHEDULE HELPERS
// ============================================================================

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Get available time slots for a navigator on a given day
 */
export function getAvailableSlots(
  navigatorId: string,
  date: string, // YYYY-MM-DD format
  existingEvents: ScheduleEvent[],
  options: {
    workdayStart?: number // Hour (default: 8)
    workdayEnd?: number // Hour (default: 17)
    slotDurationMinutes?: number // Duration of each slot (default: 30)
    minGapMinutes?: number // Minimum gap between events (default: 30)
  } = {}
): { start: Date; end: Date }[] {
  const {
    workdayStart = 8,
    workdayEnd = 17,
    slotDurationMinutes = 30,
    minGapMinutes = 30,
  } = options

  const slots: { start: Date; end: Date }[] = []
  const dayStart = new Date(`${date}T${String(workdayStart).padStart(2, "0")}:00:00`)
  const dayEnd = new Date(`${date}T${String(workdayEnd).padStart(2, "0")}:00:00`)

  // Get navigator's events for this day
  const dayEvents = existingEvents
    .filter((event) => {
      if (event.navigatorId !== navigatorId) return false
      if (event.status === "CANCELLED") return false
      const eventDate = new Date(event.startTime).toISOString().split("T")[0]
      return eventDate === date
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  // Generate slots between events
  let currentTime = dayStart

  for (const event of dayEvents) {
    const eventStart = new Date(event.startTime)
    const eventEnd = new Date(event.endTime)

    // Add slots before this event (with gap buffer)
    while (currentTime.getTime() + slotDurationMinutes * 60000 + minGapMinutes * 60000 <= eventStart.getTime()) {
      slots.push({
        start: new Date(currentTime),
        end: new Date(currentTime.getTime() + slotDurationMinutes * 60000),
      })
      currentTime = new Date(currentTime.getTime() + slotDurationMinutes * 60000)
    }

    // Move current time to after this event (with gap)
    currentTime = new Date(eventEnd.getTime() + minGapMinutes * 60000)
  }

  // Add remaining slots until end of day
  while (currentTime.getTime() + slotDurationMinutes * 60000 <= dayEnd.getTime()) {
    slots.push({
      start: new Date(currentTime),
      end: new Date(currentTime.getTime() + slotDurationMinutes * 60000),
    })
    currentTime = new Date(currentTime.getTime() + slotDurationMinutes * 60000)
  }

  return slots
}

/**
 * Calculate optimal pickup time for a NAVIGATOR_VISIT that accompanies a MEDICAL_VISIT
 */
export function calculatePickupTime(
  medicalAppointment: ScheduleEvent,
  patientZipCode: string,
  options: {
    arrivalBufferMinutes?: number // How early to arrive (default: 15)
  } = {}
): { pickupTime: Date; estimatedTravelMinutes: number } {
  const { arrivalBufferMinutes = 15 } = options

  const appointmentStart = new Date(medicalAppointment.startTime)
  const travelTime = getEstimatedTravelTime(
    patientZipCode,
    medicalAppointment.location.zipCode
  )

  // Pickup time = appointment time - travel time - arrival buffer
  const pickupTime = new Date(
    appointmentStart.getTime() - (travelTime + arrivalBufferMinutes) * 60000
  )

  return {
    pickupTime,
    estimatedTravelMinutes: travelTime,
  }
}

/**
 * Get events for a specific patient
 */
export function getPatientSchedule(
  patientId: string,
  events: ScheduleEvent[],
  options: {
    includeCompleted?: boolean
    startDate?: string // YYYY-MM-DD
    endDate?: string // YYYY-MM-DD
  } = {}
): ScheduleEvent[] {
  const { includeCompleted = false, startDate, endDate } = options

  return events
    .filter((event) => {
      if (event.patientId !== patientId) return false
      if (!includeCompleted && event.status === "COMPLETED") return false
      if (event.status === "CANCELLED") return false

      if (startDate) {
        const eventDate = new Date(event.startTime).toISOString().split("T")[0]
        if (eventDate < startDate) return false
      }

      if (endDate) {
        const eventDate = new Date(event.startTime).toISOString().split("T")[0]
        if (eventDate > endDate) return false
      }

      return true
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}

/**
 * Get navigator's daily schedule
 */
export function getNavigatorDailySchedule(
  navigatorId: string,
  date: string, // YYYY-MM-DD format
  events: ScheduleEvent[]
): ScheduleEvent[] {
  return events
    .filter((event) => {
      if (event.navigatorId !== navigatorId) return false
      if (event.status === "CANCELLED") return false
      const eventDate = new Date(event.startTime).toISOString().split("T")[0]
      return eventDate === date
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}

/**
 * Calculate total scheduled hours for a navigator in a date range
 */
export function calculateScheduledHours(
  navigatorId: string,
  events: ScheduleEvent[],
  startDate: string,
  endDate: string
): { totalMinutes: number; eventCount: number; highRiskCount: number } {
  const relevantEvents = events.filter((event) => {
    if (event.navigatorId !== navigatorId) return false
    if (event.status === "CANCELLED") return false
    const eventDate = new Date(event.startTime).toISOString().split("T")[0]
    return eventDate >= startDate && eventDate <= endDate
  })

  let totalMinutes = 0
  let highRiskCount = 0

  for (const event of relevantEvents) {
    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    totalMinutes += minutesBetween(start, end)
    if (event.isHighSafetyRisk) highRiskCount++
  }

  return {
    totalMinutes,
    eventCount: relevantEvents.length,
    highRiskCount,
  }
}
