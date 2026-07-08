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
// APPOINTMENT / PATIENT / NOTES / REFERRAL / ADVERSE EVENT / SYNC / MESSAGING
// HELPERS
// ============================================================================
//
// Moved to ./collection-helpers; re-exported here to keep this module's
// public API stable for existing importers.

export {
  getAppointmentsByDate,
  getAppointmentsByNavigator,
  getAppointmentsByPatient,
  getAppointmentsInRange,
  getUpcomingAppointments,
  getPatientsByNavigator,
  getHighRiskPatients,
  getPatientsNeedingContact,
  getNotesByPatient,
  getNotesByAuthor,
  getRecentNotes,
  getPendingReferrals,
  getActiveAdverseEvents,
  getAdverseEventsByPatient,
  syncAppointmentToPatient,
  removeAppointmentFromPatient,
  getMessagesForUser,
  getThreadMessages,
  getUnreadCount,
  getConversationThreads,
} from "./collection-helpers"

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
//
// Moved to ./care-plan-helpers; re-exported here to keep this module's
// public API stable for existing importers.
export {
  getCarePlanByPatient,
  calculateGoalStatus,
  createCarePlanFromTemplate,
  addGoalDataPoint,
  getRecentGoalHistory,
} from "./care-plan-helpers"

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
