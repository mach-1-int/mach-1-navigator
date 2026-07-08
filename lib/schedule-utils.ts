/**
 * Schedule Utilities for Dual-Track Calendar
 * Travel conflict detection and scheduling helpers
 */

import type { Appointment, Patient, ScheduleEvent } from "./types"

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Today's LOCAL date as YYYY-MM-DD.
 * (new Date().toISOString() would return the UTC date, which is wrong for
 * evening hours in Arizona.)
 */
export function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Whole days elapsed since the given date (never negative)
 */
export function daysSince(date: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)))
}

// ============================================================================
// APPOINTMENT DRAFT ADAPTER
// ============================================================================

const APPOINTMENT_TYPE_LABELS: Record<Appointment["type"], string> = {
  home_visit: "Home Visit",
  video_call: "Video Call",
  phone_call: "Phone Call",
  clinic: "Clinic Visit",
}

/**
 * Parse a display time like "8:00 AM" / "12:30 PM" into { hours, minutes } (24h)
 */
function parseDisplayTime(time: string): { hours: number; minutes: number } {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return { hours: 0, minutes: 0 }
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === "PM" && hours !== 12) hours += 12
  if (meridiem === "AM" && hours === 12) hours = 0
  return { hours, minutes }
}

export interface AppointmentDraftInput {
  patient: Patient
  navigatorId: string
  navigatorName: string
  date: string // YYYY-MM-DD
  time: string // e.g. "9:00 AM"
  type: Appointment["type"]
}

/**
 * Build a draft ScheduleEvent from the "New Appointment" dialog inputs so it
 * can be run through validateScheduleEvent before committing.
 *
 * - Parses date ("YYYY-MM-DD") + display time ("9:00 AM") to an ISO start
 * - End time defaults to start + 60 minutes
 * - Location comes from the patient's address/zip
 * - isHighSafetyRisk derives from patient riskLevel === 3
 */
export function appointmentDraftToEvent({
  patient,
  navigatorId,
  navigatorName,
  date,
  time,
  type,
}: AppointmentDraftInput): Omit<ScheduleEvent, "id"> {
  const { hours, minutes } = parseDisplayTime(time)
  const [year, month, day] = date.split("-").map(Number)
  const start = new Date(year, month - 1, day, hours, minutes)
  const end = new Date(start.getTime() + 60 * 60000)

  return {
    patientId: patient.id,
    patientName: patient.name,
    navigatorId,
    navigatorName,
    type: "NAVIGATOR_VISIT",
    title: `${APPOINTMENT_TYPE_LABELS[type]} - ${patient.name}`,
    location: {
      name: type === "home_visit" ? `${patient.name}'s Home` : APPOINTMENT_TYPE_LABELS[type],
      address: patient.address
        ? `${patient.address.street}, ${patient.address.city}, ${patient.address.state} ${patient.address.zip}`
        : "Address on file",
      zipCode: patient.address?.zip ?? "",
      lat: patient.lat,
      lng: patient.lng,
    },
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    isHighSafetyRisk: patient.riskLevel === 3,
    status: "SCHEDULED",
  }
}

// ============================================================================
// TRAVEL CONFLICT DETECTION
// ============================================================================

export interface TravelConflictResult {
  conflict: boolean
  message?: string
}

/**
 * Check if a new event has sufficient travel time from/to adjacent events
 *
 * @param newEvent - The event being scheduled
 * @param existingEvents - All existing events for the same navigator
 * @returns Conflict result with message if insufficient travel time
 */
export function checkTravelConflict(
  newEvent: ScheduleEvent,
  existingEvents: ScheduleEvent[]
): TravelConflictResult {
  const REQUIRED_TRAVEL_GAP_MINUTES = 30

  // Filter to same navigator and non-cancelled events
  const navigatorEvents = existingEvents.filter(
    (event) =>
      event.navigatorId === newEvent.navigatorId &&
      event.status !== "CANCELLED" &&
      event.id !== newEvent.id // Exclude the event itself if it's an update
  )

  // Sort all events by start time
  const allEvents = [...navigatorEvents, newEvent].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  // Find the index of the new event in the sorted list
  const newEventIndex = allEvents.findIndex((e) => e.id === newEvent.id)

  // Get previous and next events
  const prevEvent = newEventIndex > 0 ? allEvents[newEventIndex - 1] : null
  const nextEvent = newEventIndex < allEvents.length - 1 ? allEvents[newEventIndex + 1] : null

  const newStart = new Date(newEvent.startTime)
  const newEnd = new Date(newEvent.endTime)

  // Check gap with previous event
  if (prevEvent) {
    // Only check if locations are different (different zip codes)
    if (prevEvent.location.zipCode !== newEvent.location.zipCode) {
      const prevEnd = new Date(prevEvent.endTime)
      const gapMinutes = Math.round((newStart.getTime() - prevEnd.getTime()) / 1000 / 60)

      if (gapMinutes < REQUIRED_TRAVEL_GAP_MINUTES) {
        return {
          conflict: true,
          message: `⚠️ Insufficient Travel Time. Only ${gapMinutes} min between "${prevEvent.title}" (${prevEvent.location.zipCode}) and this event (${newEvent.location.zipCode}). 30 min required.`,
        }
      }
    }
  }

  // Check gap with next event
  if (nextEvent) {
    // Only check if locations are different (different zip codes)
    if (newEvent.location.zipCode !== nextEvent.location.zipCode) {
      const nextStart = new Date(nextEvent.startTime)
      const gapMinutes = Math.round((nextStart.getTime() - newEnd.getTime()) / 1000 / 60)

      if (gapMinutes < REQUIRED_TRAVEL_GAP_MINUTES) {
        return {
          conflict: true,
          message: `⚠️ Insufficient Travel Time. Only ${gapMinutes} min between this event (${newEvent.location.zipCode}) and "${nextEvent.title}" (${nextEvent.location.zipCode}). 30 min required.`,
        }
      }
    }
  }

  // No conflicts found
  return { conflict: false }
}

// ============================================================================
// ADDITIONAL SCHEDULE UTILITIES
// ============================================================================

/**
 * Check for direct time overlap between new event and existing events
 */
export function checkTimeOverlap(
  newEvent: ScheduleEvent,
  existingEvents: ScheduleEvent[]
): TravelConflictResult {
  const newStart = new Date(newEvent.startTime)
  const newEnd = new Date(newEvent.endTime)

  // Filter to same navigator and non-cancelled events
  const navigatorEvents = existingEvents.filter(
    (event) =>
      event.navigatorId === newEvent.navigatorId &&
      event.status !== "CANCELLED" &&
      event.id !== newEvent.id
  )

  for (const event of navigatorEvents) {
    const existingStart = new Date(event.startTime)
    const existingEnd = new Date(event.endTime)

    // Check if times overlap
    if (newStart < existingEnd && existingStart < newEnd) {
      return {
        conflict: true,
        message: `Time overlap with "${event.title}" (${formatTime(existingStart)} - ${formatTime(existingEnd)})`,
      }
    }
  }

  return { conflict: false }
}

/**
 * Combined validation: check both overlap and travel conflicts
 */
export function validateEventSchedule(
  newEvent: ScheduleEvent,
  existingEvents: ScheduleEvent[]
): TravelConflictResult {
  // First check for direct time overlap
  const overlapResult = checkTimeOverlap(newEvent, existingEvents)
  if (overlapResult.conflict) {
    return overlapResult
  }

  // Then check for travel time conflicts
  const travelResult = checkTravelConflict(newEvent, existingEvents)
  if (travelResult.conflict) {
    return travelResult
  }

  return { conflict: false }
}

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
 * Get the gap in minutes between two events
 */
export function getGapBetweenEvents(
  earlierEvent: ScheduleEvent,
  laterEvent: ScheduleEvent
): number {
  const earlierEnd = new Date(earlierEvent.endTime)
  const laterStart = new Date(laterEvent.startTime)
  return Math.round((laterStart.getTime() - earlierEnd.getTime()) / 1000 / 60)
}

/**
 * Find adjacent events for a given event
 */
export function findAdjacentEvents(
  targetEvent: ScheduleEvent,
  allEvents: ScheduleEvent[]
): { previous: ScheduleEvent | null; next: ScheduleEvent | null } {
  // Filter to same navigator and same day, non-cancelled
  const targetDate = new Date(targetEvent.startTime).toDateString()

  const sameDayEvents = allEvents
    .filter(
      (event) =>
        event.navigatorId === targetEvent.navigatorId &&
        event.status !== "CANCELLED" &&
        event.id !== targetEvent.id &&
        new Date(event.startTime).toDateString() === targetDate
    )
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const targetStart = new Date(targetEvent.startTime).getTime()

  let previous: ScheduleEvent | null = null
  let next: ScheduleEvent | null = null

  for (const event of sameDayEvents) {
    const eventStart = new Date(event.startTime).getTime()

    if (eventStart < targetStart) {
      previous = event // Keep updating until we find the closest one before
    } else if (eventStart > targetStart && !next) {
      next = event // First one after is our next
      break
    }
  }

  return { previous, next }
}
