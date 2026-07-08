/**
 * Centralized Store for Mach 1 Care Navigator
 * 
 * This module provides:
 * - localStorage persistence (data survives page refresh)
 * - Standalone appointments collection for easy querying
 * - Helper hooks for common data access patterns
 */

import type {
  Patient,
  Navigator,
  User,
  Supervisor,
  Appointment,
  PatientNote,
  AdverseEvent,
  Referral,
  Message,
  CareTemplate,
  CarePlan,
  GoalTracking,
  GoalDataPoint,
  Payer,
  RemarkCode,
  OrganizationSettings,
  AuditLog,
  NoteTemplate,
  NoteDraft,
  // CMS Billing Types (Phase 2.1)
  CPTDefinition,
  ZCode,
  IntakeRecord,
  TimeLog,
  MonthlyTimeSummary,
  BillingEncounter,
  ClaimRecord,
  // Scheduling Types (Phase 4)
  ScheduleEvent,
  NavigatorShift,
  TimeOffRequest,
  // Navigator Safety Map
  NavigatorLocation,
  SOSEvent,
} from "./types"
import {
  initialPatients,
  initialNavigators,
  initialUsers,
  initialSupervisors,
  initialAppointments,
  initialNotes,
  initialAdverseEvents,
  initialReferrals,
  initialCareTemplates,
  initialCarePlans,
  initialPayers,
  initialRemarkCodes,
  initialOrganizationSettings,
  initialAuditLogs,
  initialNoteTemplates,
  // CMS Billing Initial Data (Phase 2.1)
  initialCPTCodes,
  initialZCodes,
  initialIntakeRecords,
  initialTimeLogs,
  // Scheduling Initial Data (Phase 4)
  initialScheduleEvents,
  initialNavigatorShifts,
  // Direct Messages (incl. nudges)
  initialDirectMessages,
  // Navigator Safety Map
  initialNavigatorLocations,
} from "./initial-data"
import { rebaseToToday } from "./date-rebase"

// ============================================================================
// STORAGE KEY
// ============================================================================

const STORAGE_KEY = "mach1-navigator-store"

// ============================================================================
// STATE SHAPE
// ============================================================================

export interface StoreState {
  patients: Patient[]
  navigators: Navigator[]
  users: User[]
  supervisors: Supervisor[]
  appointments: Appointment[]
  notes: PatientNote[]
  adverseEvents: AdverseEvent[]
  referrals: Referral[]
  directMessages: Message[]
  careTemplates: CareTemplate[]
  carePlans: CarePlan[]
  payers: Payer[]
  remarkCodes: RemarkCode[]
  organizationSettings: OrganizationSettings
  auditLogs: AuditLog[]
  noteTemplates: NoteTemplate[]
  noteDrafts: NoteDraft[]
  // CMS Billing State (Phase 2.1)
  cptCodes: CPTDefinition[]
  zCodes: ZCode[]
  intakeRecords: IntakeRecord[]
  timeLogs: TimeLog[]
  monthlyTimeSummaries: MonthlyTimeSummary[]
  billingEncounters: BillingEncounter[]
  claimRecords: ClaimRecord[]
  // Payer-Agnostic Billing State (Phase 2.2)
  activePayerConfigId: string // "medicaid-bh" | "medicare-pin" | "medicare-chi"
  // Scheduling State (Phase 4)
  scheduleEvents: ScheduleEvent[]
  navigatorShifts: NavigatorShift[]
  timeOffRequests: TimeOffRequest[]
  // Navigator Safety Map
  navigatorLocations: NavigatorLocation[]
  sosEvents: SOSEvent[]
  lastAssignedPatientId: string | null
  _version: number // For future migrations
}

// ============================================================================
// PERSISTENCE VERSION
// ============================================================================

// Current schema version - bump this when seed data changes to force refresh.
// MUST be defined above createInitialState so fresh state is stamped with it;
// a stale literal here once caused every reload to wipe localStorage.
const CURRENT_VERSION = 12 // Production-hardening blitz: payers/claims/SOS/identity slices + enriched time logs

// ============================================================================
// INITIAL STATE
// ============================================================================

export const createInitialState = (): StoreState => ({
  // Operational dates are rebased to "today" so the demo never looks stale.
  // DOBs and enrollmentDate are frozen inside rebaseToToday(). See date-rebase.ts.
  patients: rebaseToToday(initialPatients),
  navigators: initialNavigators,
  users: initialUsers,
  supervisors: initialSupervisors,
  appointments: rebaseToToday(initialAppointments),
  notes: rebaseToToday(initialNotes),
  adverseEvents: rebaseToToday(initialAdverseEvents),
  referrals: rebaseToToday(initialReferrals),
  directMessages: rebaseToToday(initialDirectMessages),
  careTemplates: initialCareTemplates,
  carePlans: rebaseToToday(initialCarePlans),
  payers: initialPayers,
  remarkCodes: initialRemarkCodes,
  organizationSettings: initialOrganizationSettings,
  auditLogs: rebaseToToday(initialAuditLogs),
  noteTemplates: initialNoteTemplates,
  noteDrafts: [],
  // CMS Billing Initial State (Phase 2.1)
  cptCodes: initialCPTCodes,
  zCodes: initialZCodes,
  intakeRecords: rebaseToToday(initialIntakeRecords),
  timeLogs: rebaseToToday(initialTimeLogs),
  monthlyTimeSummaries: [],
  billingEncounters: [],
  claimRecords: [],
  // Payer-Agnostic Billing (Phase 2.2) - Default to Medicaid BH for demo
  activePayerConfigId: "medicaid-bh",
  // Scheduling Initial State (Phase 4)
  scheduleEvents: rebaseToToday(initialScheduleEvents),
  navigatorShifts: rebaseToToday(initialNavigatorShifts),
  timeOffRequests: [],
  // Navigator Safety Map
  navigatorLocations: initialNavigatorLocations,
  sosEvents: [],
  lastAssignedPatientId: null,
  _version: CURRENT_VERSION,
})

// ============================================================================
// PERSISTENCE HELPERS
// ============================================================================

/** value ?? fallback, but falsy-value-permissive (matches the pre-refactor `||` merges below). */
function orFallback<T>(value: T | undefined, fallback: T): T {
  return (value || fallback) as T
}

function mergeCoreState(parsed: Partial<StoreState>, initial: StoreState) {
  return {
    patients: orFallback(parsed.patients, initial.patients),
    navigators: orFallback(parsed.navigators, initial.navigators),
    users: orFallback(parsed.users, initial.users),
    supervisors: orFallback(parsed.supervisors, initial.supervisors),
    appointments: orFallback(parsed.appointments, initial.appointments),
    notes: orFallback(parsed.notes, initial.notes),
    adverseEvents: orFallback(parsed.adverseEvents, initial.adverseEvents),
    referrals: orFallback(parsed.referrals, initial.referrals),
    directMessages: orFallback(parsed.directMessages, initial.directMessages),
    careTemplates: orFallback(parsed.careTemplates, initial.careTemplates),
    carePlans: orFallback(parsed.carePlans, initial.carePlans),
    payers: orFallback(parsed.payers, initial.payers),
    remarkCodes: orFallback(parsed.remarkCodes, initial.remarkCodes),
    organizationSettings: orFallback(parsed.organizationSettings, initial.organizationSettings),
    auditLogs: orFallback(parsed.auditLogs, initial.auditLogs),
    noteTemplates: orFallback(parsed.noteTemplates, initial.noteTemplates),
    noteDrafts: orFallback(parsed.noteDrafts, initial.noteDrafts),
  }
}

function mergeBillingState(parsed: Partial<StoreState>, initial: StoreState) {
  return {
    cptCodes: orFallback(parsed.cptCodes, initial.cptCodes),
    zCodes: orFallback(parsed.zCodes, initial.zCodes),
    intakeRecords: orFallback(parsed.intakeRecords, initial.intakeRecords),
    timeLogs: orFallback(parsed.timeLogs, initial.timeLogs),
    monthlyTimeSummaries: orFallback(parsed.monthlyTimeSummaries, initial.monthlyTimeSummaries),
    billingEncounters: orFallback(parsed.billingEncounters, initial.billingEncounters),
    claimRecords: orFallback(parsed.claimRecords, initial.claimRecords),
    activePayerConfigId: orFallback(parsed.activePayerConfigId, initial.activePayerConfigId),
  }
}

function mergeSchedulingAndSafetyState(parsed: Partial<StoreState>, initial: StoreState) {
  return {
    scheduleEvents: orFallback(parsed.scheduleEvents, initial.scheduleEvents),
    navigatorShifts: orFallback(parsed.navigatorShifts, initial.navigatorShifts),
    timeOffRequests: orFallback(parsed.timeOffRequests, initial.timeOffRequests),
    // Navigator Safety Map: locations are LIVE TELEMETRY, not durable data —
    // persisted lastCheckIn timestamps go stale (a day-old store would derive
    // RISK_ALERT for the whole fleet, and the simulator never touches
    // alerted navigators, so it could never recover). Always start from
    // fresh relative seeds. SOS events ARE durable user actions and persist
    // normally.
    navigatorLocations: initial.navigatorLocations,
    sosEvents: orFallback(parsed.sosEvents, initial.sosEvents),
  }
}

/** Merge with initial state to ensure new fields are always present. */
function mergeParsedState(parsed: Partial<StoreState>, initial: StoreState): StoreState {
  return {
    ...initial,
    ...parsed,
    ...mergeCoreState(parsed, initial),
    ...mergeBillingState(parsed, initial),
    ...mergeSchedulingAndSafetyState(parsed, initial),
    _version: CURRENT_VERSION,
  }
}

/**
 * Read + validate the persisted store from localStorage.
 * Returns null when there's nothing to merge (no saved state, or the saved
 * structure is missing required fields) — the caller falls back to
 * `initialState` in that case. Forces a refresh when the version is
 * outdated so users get updated seed data.
 */
function tryLoadPersistedState(initialState: StoreState): StoreState | null {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return null

  const parsed = JSON.parse(saved) as Partial<StoreState>

  if (!parsed._version || parsed._version < CURRENT_VERSION) {
    console.log(`[Store] Version mismatch (${parsed._version || 0} < ${CURRENT_VERSION}), resetting to fresh seed data`)
    localStorage.removeItem(STORAGE_KEY)
    return initialState
  }

  if (!parsed.patients || !parsed.navigators || !parsed.appointments) return null

  return mergeParsedState(parsed, initialState)
}

/**
 * Load state from localStorage, falling back to initial state if not found
 * Merges with initial state to ensure new fields are always present
 * Forces refresh when version changes to ensure users get updated seed data
 */
export function loadState(): StoreState {
  if (typeof window === "undefined") {
    return createInitialState()
  }

  const initialState = createInitialState()

  try {
    return tryLoadPersistedState(initialState) ?? initialState
  } catch (error) {
    console.warn("Failed to load state from localStorage:", error)
    return initialState
  }
}

/**
 * Save state to localStorage
 */
export function saveState(state: StoreState): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn("Failed to save state to localStorage:", error)
  }
}

/**
 * Clear all persisted state
 */
export function clearPersistedState(): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn("Failed to clear persisted state:", error)
  }
}

// ============================================================================
// ID GENERATION
// ============================================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

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

// ============================================================================
// RISK ASSESSMENT HELPERS
// ============================================================================
//
// Moved to ./risk-assessment; re-exported here to keep this module's public
// API stable for existing importers.
export { RISK_WEIGHTS, calculateRiskScore, calculateRiskTier, createPatientFromReferral } from "./risk-assessment"

// ============================================================================
// CARE PLAN HELPERS
// ============================================================================

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

// ============================================================================
// CMS BILLING HELPERS (Phase 2.1)
// ============================================================================
// Extracted to ./billing-helpers; re-exported here to keep this module's
// public API stable for existing consumers.

export {
  getTimeLogsByPatientAndPeriod,
  getTotalMinutesForPeriod,
  calculateBillingUnits,
  getCPTCodeForService,
  getTimeLogsByNavigator,
  getUnverifiedTimeLogs,
  getIntakeByPatient,
  hasValidConsent,
  getBillingEncountersByStatus,
  getBillingEncountersByPatient,
  calculateDurationMinutes,
} from "./billing-helpers"
