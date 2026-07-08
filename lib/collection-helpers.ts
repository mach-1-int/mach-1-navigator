/**
 * Collection Helpers
 *
 * Pure query/filter/sort helpers over the appointment, patient, note,
 * referral, adverse-event, and messaging collections. Extracted from
 * lib/store.ts, which re-exports these for backward compatibility.
 */

import type {
  Appointment,
  Patient,
  PatientNote,
  Referral,
  AdverseEvent,
  Message,
} from "./types"

// ============================================================================
// APPOINTMENT HELPERS
// ============================================================================

/**
 * Get all appointments for a specific date
 */
export function getAppointmentsByDate(appointments: Appointment[], date: string): Appointment[] {
  return appointments.filter((apt) => apt.date === date && apt.status === "scheduled")
}

/**
 * Get all appointments for a specific navigator
 */
export function getAppointmentsByNavigator(appointments: Appointment[], navigatorId: string): Appointment[] {
  return appointments.filter((apt) => apt.navigatorId === navigatorId)
}

/**
 * Get all appointments for a specific patient
 */
export function getAppointmentsByPatient(appointments: Appointment[], patientId: string): Appointment[] {
  return appointments.filter((apt) => apt.patientId === patientId)
}

/**
 * Get appointments within a date range
 */
export function getAppointmentsInRange(
  appointments: Appointment[],
  startDate: string,
  endDate: string
): Appointment[] {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()

  return appointments.filter((apt) => {
    const aptDate = new Date(apt.date).getTime()
    return aptDate >= start && aptDate <= end && apt.status === "scheduled"
  })
}

/**
 * Get upcoming appointments (today and future)
 */
export function getUpcomingAppointments(appointments: Appointment[]): Appointment[] {
  const today = new Date().toISOString().split("T")[0]
  return appointments
    .filter((apt) => apt.date >= today && apt.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

// ============================================================================
// PATIENT HELPERS
// ============================================================================

/**
 * Get patients assigned to a specific navigator
 */
export function getPatientsByNavigator(patients: Patient[], navigatorId: string): Patient[] {
  return patients.filter((p) => p.assignedNavigator === navigatorId)
}

/**
 * Get high-risk patients (risk level 3)
 */
export function getHighRiskPatients(patients: Patient[]): Patient[] {
  return patients.filter((p) => p.riskLevel === 3)
}

/**
 * Get patients needing contact (no contact in X days)
 */
export function getPatientsNeedingContact(patients: Patient[], daysSinceContact: number = 14): Patient[] {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceContact)

  return patients.filter((p) => new Date(p.lastContactDate) < cutoffDate)
}

// ============================================================================
// NOTES HELPERS
// ============================================================================

/**
 * Get notes for a specific patient, sorted by date descending
 */
export function getNotesByPatient(notes: PatientNote[], patientId: string): PatientNote[] {
  return notes
    .filter((note) => note.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Get notes by a specific author
 */
export function getNotesByAuthor(notes: PatientNote[], authorId: string): PatientNote[] {
  return notes.filter((note) => note.authorId === authorId)
}

/**
 * Get recent notes across all patients
 */
export function getRecentNotes(notes: PatientNote[], limit: number = 20): PatientNote[] {
  return [...notes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

// ============================================================================
// REFERRAL HELPERS
// ============================================================================

/**
 * Get pending referrals
 */
export function getPendingReferrals(referrals: Referral[]): Referral[] {
  return referrals.filter((ref) => ref.status === "pending")
}

// ============================================================================
// ADVERSE EVENT HELPERS
// ============================================================================

/**
 * Get active adverse events (not ended)
 */
export function getActiveAdverseEvents(adverseEvents: AdverseEvent[]): AdverseEvent[] {
  return adverseEvents.filter((ae) => ae.status !== "ended")
}

/**
 * Get adverse events for a patient
 */
export function getAdverseEventsByPatient(adverseEvents: AdverseEvent[], patientId: string): AdverseEvent[] {
  return adverseEvents.filter((ae) => ae.patientId === patientId)
}

// ============================================================================
// SYNC HELPERS
// ============================================================================

/**
 * Sync appointment to patient's upcomingAppointments array
 * This keeps the embedded appointments in sync with the standalone collection
 */
export function syncAppointmentToPatient(
  patients: Patient[],
  appointment: Appointment
): Patient[] {
  return patients.map((patient) => {
    if (patient.id === appointment.patientId) {
      const existingIndex = patient.upcomingAppointments.findIndex(
        (apt) => apt.id === appointment.id
      )
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...patient.upcomingAppointments]
        updated[existingIndex] = appointment
        return { ...patient, upcomingAppointments: updated }
      } else {
        // Add new
        return {
          ...patient,
          upcomingAppointments: [...patient.upcomingAppointments, appointment],
        }
      }
    }
    return patient
  })
}

/**
 * Remove appointment from patient's upcomingAppointments array
 */
export function removeAppointmentFromPatient(
  patients: Patient[],
  patientId: string,
  appointmentId: string
): Patient[] {
  return patients.map((patient) => {
    if (patient.id === patientId) {
      return {
        ...patient,
        upcomingAppointments: patient.upcomingAppointments.filter(
          (apt) => apt.id !== appointmentId
        ),
      }
    }
    return patient
  })
}

// ============================================================================
// MESSAGING HELPERS
// ============================================================================

/**
 * Get all messages for a user (sent or received)
 */
export function getMessagesForUser(messages: Message[], userId: string): Message[] {
  return messages
    .filter((m) => m.senderId === userId || m.receiverId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * Get messages between two users (a conversation thread)
 */
export function getThreadMessages(messages: Message[], userId1: string, userId2: string): Message[] {
  return messages
    .filter(
      (m) =>
        (m.senderId === userId1 && m.receiverId === userId2) ||
        (m.senderId === userId2 && m.receiverId === userId1)
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

/**
 * Get unread message count for a user
 */
export function getUnreadCount(messages: Message[], userId: string): number {
  return messages.filter((m) => m.receiverId === userId && !m.readStatus).length
}

/**
 * Get unique conversation threads for a user
 * Returns an array of the other user's ID and the most recent message
 */
export function getConversationThreads(
  messages: Message[],
  userId: string
): { partnerId: string; partnerName: string; partnerRole: string; lastMessage: Message; unreadCount: number }[] {
  const threadMap = new Map<
    string,
    { partnerId: string; partnerName: string; partnerRole: string; lastMessage: Message; unreadCount: number }
  >()

  messages.forEach((msg) => {
    const isIncoming = msg.receiverId === userId
    const partnerId = isIncoming ? msg.senderId : msg.receiverId
    const partnerName = isIncoming ? msg.senderName : msg.receiverName
    const partnerRole = isIncoming ? msg.senderRole : msg.receiverRole

    const existing = threadMap.get(partnerId)
    if (!existing || new Date(msg.timestamp) > new Date(existing.lastMessage.timestamp)) {
      const unreadCount = messages.filter(
        (m) => m.senderId === partnerId && m.receiverId === userId && !m.readStatus
      ).length

      threadMap.set(partnerId, {
        partnerId,
        partnerName,
        partnerRole,
        lastMessage: msg,
        unreadCount,
      })
    }
  })

  return Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
  )
}
