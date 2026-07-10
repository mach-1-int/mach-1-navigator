"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react"
import { toast } from "sonner"
import type { Patient, PatientNote, Appointment, Navigator, User, Supervisor, NavigatorAttributes, AdverseEvent, Referral, Message, UserRole, RiskAssessmentData, CareTemplate, CarePlan, Payer, RemarkCode, OrganizationSettings, AuditLog, AuditAction, NoteTemplate, NoteDraft, IntakeRecord, ZCode, TimeLog, ServiceType, PayerConfig, NavigatorLocation, SafetyStatus, BillableClaim, ClaimRecord, ClaimRecordStatus, ClaimWorkStatus, SOSEvent, GeoPoint, ScheduleEvent, NavigatorShift, TimeOffRequest, EligibilityCheck, OutreachAttempt, JourneyEvent, JourneyPhase, ProgramExit, IntakeChecklistKey, EncounterType, Provider, StandingPatientFacts, ChargeSlip, Zone, NavigatorTask, PatientDocument, MedReconciliationEvent, Escalation, ProviderCommunication, NavigatorOnboarding, OnboardingMilestoneKey, Medication } from "./types"
import { getPayerConfig, getAllPayerConfigs, resolvePayerByName, getPayerForPatient } from "./payer-config"
import { acuityLevelToRiskLevel, lineToRiskLevel } from "./acuity"
import {
  evaluateEligibility,
  applyOutreachAttempt,
  attemptsRemaining,
  isTerminalReferralStatus,
} from "./referral-pipeline"
import {
  canTransitionPhase,
  buildChecklist,
  isIntakeVisitComplete,
  INTAKE1_CHECKLIST,
  INTAKE2_CHECKLIST,
  NO_SHOW_CLOSURE_THRESHOLD,
} from "./journey"
import { addBusinessDays } from "./business-days"
import { chargeSlipId } from "./charge-slips"
import {
  deriveDueConfirmationTasks,
  taskForCompletedVisit,
  taskForNoShow,
  tasksForAdverseEvent,
  taskKey,
  confirmationWindowForType,
  TASK_TYPE_CONFIG,
} from "./task-engine"
import { checklistItemForDocument, isDocumentSatisfied, DOCUMENT_DEFINITIONS } from "./document-definitions"
import { renderProviderComm, type ProviderCommContext } from "./provider-comms"
import { findUnknownCodes } from "./remittance-review"
import {
  createClaimRecords,
  transitionClaimRecord,
  getActiveClaimRecordKeys,
} from "./claim-lifecycle"
import type { ClearinghouseAdapter, SubmissionResult } from "./clearinghouse/adapter"
import {
  type StoreState,
  createInitialState,
  loadState,
  saveState,
  clearPersistedState,
  generateId,
  syncAppointmentToPatient,
  calculateRiskScore,
  calculateRiskTier,
  createCarePlanFromTemplate,
  addGoalDataPoint,
  getCarePlanByPatient,
} from "./store"

// ============================================================================
// REMITTANCE APPLICATION SHAPE
// (structurally compatible with lib/edi/remittance-matcher's RemittanceMatchResult)
// ============================================================================

export interface RemittanceApplication {
  matches: Array<{
    claimRecordId: string
    resolvedStatus: "PAID" | "DENIED"
    remittance: NonNullable<ClaimRecord["remittance"]>
  }>
  unmatchedCount: number
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface DemoDataContextType {
  // State
  patients: Patient[]
  notes: PatientNote[]
  navigators: Navigator[]
  users: User[]
  supervisors: Supervisor[]
  adverseEvents: AdverseEvent[]
  referrals: Referral[]
  directMessages: Message[]
  appointments: Appointment[]
  careTemplates: CareTemplate[]
  carePlans: CarePlan[]
  payers: Payer[]
  remarkCodes: RemarkCode[]
  organizationSettings: OrganizationSettings
  claimRecords: ClaimRecord[]
  auditLogs: AuditLog[]
  noteTemplates: NoteTemplate[]
  noteDrafts: NoteDraft[]
  // Scheduling (Phase 4)
  scheduleEvents: ScheduleEvent[]
  navigatorShifts: NavigatorShift[]
  timeOffRequests: TimeOffRequest[]
  // Navigator Safety Map
  navigatorLocations: NavigatorLocation[]
  sosEvents: SOSEvent[]
  // Journey engine (Gellert WorkFlow2025)
  journeyEvents: JourneyEvent[]
  // Gellert note system
  providers: Provider[]
  standingFacts: StandingPatientFacts[]
  // Gellert billing mode
  chargeSlips: ChargeSlip[]
  zones: Zone[]
  // Gellert ops blitz (tasks / documents / escalations / comms / training)
  navigatorTasks: NavigatorTask[]
  patientDocuments: PatientDocument[]
  medReconciliations: MedReconciliationEvent[]
  escalations: Escalation[]
  providerCommunications: ProviderCommunication[]
  navigatorOnboarding: NavigatorOnboarding[]
  /**
   * Patient ids with a SIGNED navigation contract (Patient Agreement) —
   * the playbook §4 billing gate set. Pass to generateMonthlyClaims /
   * computeRevenue / calculateEstimatedMonthlyRevenue wherever claims are
   * generated for the UI.
   */
  signedContractPatientIds: Set<string>
  lastAssignedPatientId: string | null
  isHydrated: boolean

  // Identity selectors
  getUser: (userId: string) => User | undefined
  getSupervisor: (supervisorId: string) => Supervisor | undefined
  getTeamNavigators: (supervisorId: string) => Navigator[]
  getNavigatorsWithAttributes: () => Array<User & { attributes: NavigatorAttributes }>
  getNavigatorDisplayName: (navigatorId: string) => string

  // Patient Notes
  addNote: (patientId: string, content: string, type: PatientNote["type"], authorId: string, authorName: string, authorRole: PatientNote["authorRole"]) => void
  getPatientNotes: (patientId: string) => PatientNote[]

  // Referrals (pipeline)
  getPendingReferrals: () => Referral[]
  getLastAssignedPatient: () => Patient | null

  // Referral pipeline actions (Gellert WorkFlow2025)
  completeEligibilityCheck: (
    referralId: string,
    check: Omit<EligibilityCheck, "checkedAt" | "checkedBy" | "outcome" | "ineligibilityReason">,
    byId: string,
    byName: string
  ) => void
  logOutreachAttempt: (
    referralId: string,
    attempt: Omit<OutreachAttempt, "id" | "attemptNumber">
  ) => void
  scheduleIntakeVisit: (referralId: string, date: string, time: string, navigatorId: string) => void
  /**
   * SOP 1.7 gate: confirm the patient's decision-making capacity on a
   * referral. scheduleIntakeVisit refuses (with a toast) until this is set.
   */
  confirmDecisionCapacity: (referralId: string, by: string) => void
  /**
   * Render + store a referring-provider communication (simulated), stamp
   * providerNotifiedAt, and audit. `type` defaults from the entity's state
   * (closed-ineligible / unreachable / exited / otherwise intake). `override`
   * sends an edited subject/body instead of the rendered template.
   */
  notifyReferringProvider: (
    entity: { referralId?: string; patientId?: string },
    byId: string,
    byName: string,
    type?: ProviderCommunication["type"],
    override?: { subject: string; body: string }
  ) => void

  // Navigator tasks (Gellert ops blitz — engagement engine)
  /**
   * Run the task engine over current state and insert any newly-due tasks
   * (confirmation windows, post-visit follow-ups, no-show recoveries).
   * Idempotent by (type, appointmentId) — safe to call on every mount.
   * Returns the number of tasks inserted.
   */
  generateDueTasks: () => number
  /**
   * Insert the SOP 4.x response task set for one adverse event (skipping any
   * that already exist). Returns the number of tasks inserted.
   */
  generateAdverseEventTasks: (adverseEventId: string, byId: string, byName: string) => number
  /**
   * Complete a task. For confirmation tasks, also stamps the appointment's
   * confirmations[] with the window + outcome ("confirmed" when omitted;
   * valid outcomes: "confirmed" | "no_answer" | "reschedule_requested").
   */
  completeTask: (taskId: string, by: string, outcome?: string, note?: string) => void
  dismissTask: (taskId: string, by: string, note: string) => void

  // Patient documents & e-sign (Gellert ops blitz)
  /** Create or update (upsert by id) a document draft; stamps updatedAt. */
  savePatientDocument: (doc: PatientDocument) => void
  /** Mark a non-signature document completed; auto-checks its intake checklist item. */
  completePatientDocument: (docId: string, by: string) => void
  /** Sign roi / navigation_contract; auto-checks its intake checklist item. */
  signPatientDocument: (docId: string, signature: NonNullable<PatientDocument["signature"]>, by: string) => void

  // Medication reconciliation (Gellert ops blitz)
  /** Replace the patient's LIVE medication list (no snapshot; see recordMedReconciliation). */
  updatePatientMedications: (patientId: string, meds: Medication[], by: string) => void
  /**
   * Record a reconciliation event: snapshots the patient's CURRENT med list
   * plus the diff, audits, and auto-checks the med_reconciliation intake item.
   */
  recordMedReconciliation: (
    patientId: string,
    changes: MedReconciliationEvent["changes"],
    note: string | undefined,
    by: string,
    byName: string
  ) => void

  // Escalations (Gellert ops blitz — closed loop, distinct from SOS)
  /** Raise an escalation; the patient's supervisor gets a nudge. */
  raiseEscalation: (patientId: string, navigatorId: string, reason: Escalation["reason"], description: string) => void
  /** open -> acknowledged (no-op from any other status). */
  acknowledgeEscalation: (escalationId: string, by: string) => void
  /**
   * open|acknowledged -> resolved. Resolving an un-acknowledged escalation
   * stamps the acknowledgment with the resolver too (forward-only lifecycle).
   */
  resolveEscalation: (escalationId: string, by: string, resolutionNote: string) => void

  // Navigator onboarding (Gellert ops blitz — playbook §10 training)
  /**
   * Set a milestone's status (stamps completedAt when completed; audits).
   * Completing "certification" bumps a developmental record to "certified".
   */
  updateOnboardingMilestone: (
    navigatorId: string,
    key: OnboardingMilestoneKey,
    status: "pending" | "in_progress" | "completed",
    note?: string
  ) => void
  toggleShadowItem: (navigatorId: string, key: string) => void

  // Note templates (Gellert ops blitz — template editor)
  /** Upsert a note template by id; newly created templates get isCustom: true. */
  saveNoteTemplate: (template: NoteTemplate) => void
  /**
   * Delete a template. Returns false (no-op) when the template is referenced
   * by any existing note or does not exist.
   */
  deleteNoteTemplate: (templateId: string) => boolean

  // Journey actions (post-conversion)
  updateIntakeChecklistItem: (
    patientId: string,
    visit: 1 | 2,
    key: IntakeChecklistKey,
    done: boolean,
    byId: string,
    byName: string
  ) => void
  completeIntakeVisit: (patientId: string, visit: 1 | 2, byId: string, byName: string) => void
  recordIntakeNoShow: (patientId: string, visit: 1 | 2, byId: string, byName: string) => void
  flagGraduationReadiness: (patientId: string, navigatorId: string, note: string) => void
  confirmGraduation: (patientId: string, supervisorId: string, supervisorName: string) => void
  recordTelenavCheckIn: (patientId: string, byId: string, byName: string, note: string) => void
  reengagePatient: (patientId: string, byId: string, byName: string, reason: string) => void
  exitProgram: (patientId: string, exit: ProgramExit) => void

  // Intake & Assessment (Phase 2)
  // Conversion: patient is created ONLY once the referral is agreed/intake_scheduled
  // (encodes Gellert's "not entered into AMD until they accept services" rule)
  acceptReferral: (referralId: string, patientData: Partial<Patient>, navigatorId: string) => Patient | null
  submitAssessment: (patientId: string, assessmentData: Omit<RiskAssessmentData, 'riskScore' | 'calculatedTier' | 'completedAt'>, navigatorId: string) => void

  // Nudges (unified Messages with type "nudge")
  sendNudge: (toNavigatorId: string, patientId: string, patientName: string, content: string, senderId: string, senderName: string, senderRole?: UserRole) => void
  getNudgesForNavigator: (navigatorId: string) => Message[]

  // Referral ingestion (HL7 adapter)
  ingestReferral: (referral: Referral) => void

  // Direct Messaging
  sendMessage: (senderId: string, senderName: string, senderRole: UserRole, receiverId: string, receiverName: string, receiverRole: UserRole, content: string, type?: Message["type"], patientId?: string, patientName?: string) => void
  getMessagesForUser: (userId: string) => Message[]
  getThreadMessages: (userId1: string, userId2: string) => Message[]
  getUnreadCount: (userId: string) => number
  markDirectMessageRead: (messageId: string) => void
  markThreadAsRead: (userId: string, partnerId: string) => void

  // Navigator Assignment
  assignNavigator: (patientId: string, navigatorId: string) => void

  // Appointments
  scheduleAppointment: (patientId: string, date: string, time: string, type: Appointment["type"], navigatorId: string, notes?: string, encounterType?: EncounterType) => Appointment
  cancelAppointment: (patientId: string, appointmentId: string) => void
  completeAppointment: (patientId: string, appointmentId: string) => void
  updateAppointment: (appointmentId: string, updates: Partial<Appointment>) => void
  getAppointmentsByNavigator: (navigatorId: string) => Appointment[]
  getAppointmentsByDate: (date: string) => Appointment[]
  getAppointmentsByPatient: (patientId: string) => Appointment[]

  // EVV (Electronic Visit Verification) - Phase 4
  checkInAppointment: (appointmentId: string, location?: { lat: number; lng: number }) => void
  checkOutAppointment: (appointmentId: string) => void

  // Adverse Events
  addAdverseEvent: (patientId: string, type: AdverseEvent["type"], diagnosis: string) => void
  updateAdverseEventStatus: (eventId: string, status: AdverseEvent["status"]) => void

  // Care Plans (Phase 3)
  getPatientCarePlan: (patientId: string) => CarePlan | undefined
  applyCareTemplate: (patientId: string, templateId: string) => CarePlan | null
  logGoalMetric: (patientId: string, goalId: string, value: number, navigatorId: string) => void

  // Governance & Admin (Phase 5)
  updatePayer: (payerId: string, updates: Partial<Payer>, userId: string, userName: string) => void
  addRemarkCode: (code: Omit<RemarkCode, "id" | "lastUpdated">, userId: string, userName: string) => void
  updateRemarkCode: (id: string, updates: Partial<RemarkCode>, userId: string, userName: string) => void
  updateOrganizationSettings: (updates: Partial<OrganizationSettings>, userId: string, userName: string) => void
  logActivity: (userId: string, userName: string, userRole: UserRole, action: AuditAction, details?: string, entityType?: string, entityId?: string) => void
  calculateDynamicRevenue: () => number

  // Claim lifecycle (Revenue Cycle)
  exportClaims: (claims: BillableClaim[], format: "CSV" | "837P", by: string) => ClaimRecord[]
  updateClaimStatus: (claimRecordId: string, next: ClaimRecordStatus, by: string, note?: string) => boolean
  reopenClaimRecord: (claimRecordId: string, by: string) => void
  applyRemittance: (application: RemittanceApplication, by: string) => { applied: number; pended: number; unmatched: number }
  recordManualPayment: (claimRecordId: string, outcome: "PAID" | "DENIED", amount: number, by: string, carcCode?: string) => boolean
  submitClaimBatch: (claimRecordIds: string[], adapter: ClearinghouseAdapter, fileContent: string, fileName: string, by: string) => Promise<SubmissionResult>

  // Gellert billing mode (day-close, DAP review, denial work queue)
  signChargeSlip: (slip: Omit<ChargeSlip, "signedAt" | "signedBy">, byId: string, byName: string) => void
  signAllChargeSlips: (slips: Array<Omit<ChargeSlip, "signedAt" | "signedBy">>, byId: string, byName: string) => number
  setClaimWorkStatus: (claimRecordId: string, workStatus: ClaimWorkStatus, by: string) => void
  reprocessPendedRemittances: (by: string) => { reprocessed: number; stillPended: number }

  // Gellert note system (provider directory + standing facts)
  getProvidersForPatient: (patientId: string) => Provider[]
  getStandingFacts: (patientId: string) => StandingPatientFacts | undefined
  updateStandingFacts: (patientId: string, updates: Partial<Omit<StandingPatientFacts, "patientId" | "updatedAt" | "updatedBy">>, byId: string) => void

  // Note drafts (AI Scribe transcript resilience)
  saveNoteDraft: (draft: Omit<NoteDraft, "id"> & { id?: string }) => NoteDraft
  getNoteDraft: (patientId: string, templateId: string) => NoteDraft | undefined
  deleteNoteDraft: (draftId: string) => void

  // Scheduling (shifts & dual-track events)
  addShift: (shift: Omit<NavigatorShift, "id" | "createdAt" | "updatedAt">) => NavigatorShift
  updateShift: (shiftId: string, updates: Partial<NavigatorShift>) => void
  addScheduleEvent: (event: Omit<ScheduleEvent, "id">) => ScheduleEvent
  updateScheduleEvent: (eventId: string, updates: Partial<ScheduleEvent>) => void

  // SOS (navigator safety)
  triggerSOS: (navigatorId: string, location?: GeoPoint) => void
  acknowledgeSOS: (sosId: string, byName: string) => void
  resolveSOS: (sosId: string) => void

  // Dynamic Narrative Engine (Phase 6)
  getNoteTemplate: (templateId: string) => NoteTemplate | undefined
  generateNarrative: (
    template: NoteTemplate,
    responses: Record<string, unknown>,
    context?: { providers?: Provider[] }
  ) => string
  addNoteFromTemplate: (
    patientId: string,
    templateId: string,
    responses: Record<string, unknown>,
    authorId: string,
    authorName: string,
    authorRole: UserRole,
    duration?: number,
    timeData?: {
      startTime?: string
      endTime?: string
      timeLogId?: string
      timeSource?: "timer" | "manual" | "edited"
    },
    noteMeta?: {
      linkedNoteId?: string
      carriesDayTotal?: boolean
      billable?: boolean
      appointmentId?: string
      subjectNavigatorId?: string
    }
  ) => PatientNote

  // CMS Billing & Intake (Phase 2.1/2.2)
  zCodes: ZCode[]
  intakeRecords: IntakeRecord[]
  timeLogs: TimeLog[]
  createIntakeRecord: (intake: Omit<IntakeRecord, "id">) => IntakeRecord
  getPatientIntake: (patientId: string) => IntakeRecord | undefined
  addTimeLog: (timeLog: Omit<TimeLog, "id">) => TimeLog
  getPatientTimeLogs: (patientId: string) => TimeLog[]

  // Payer-Agnostic Billing (Phase 2.2)
  activePayerConfigId: string
  activePayerConfig: PayerConfig
  availablePayerConfigs: PayerConfig[]
  setActivePayerConfig: (configId: string) => void

  // Navigator Safety Map
  updateNavigatorLocation: (
    navigatorId: string,
    lat: number,
    lng: number,
    opts?: {
      status?: SafetyStatus
      currentTask?: string
      currentPatientId?: string
      touchCheckIn?: boolean // false = pure movement (simulator); does NOT stamp lastCheckIn
      speed?: number
      batteryLevel?: number
    }
  ) => void
  getNavigatorLocations: () => NavigatorLocation[]

  // Utility
  getPatient: (patientId: string) => Patient | undefined
  getNavigator: (navigatorId: string) => Navigator | undefined
  getPatientsByNavigator: (navigatorId: string) => Patient[]
  updatePatient: (patientId: string, updates: Partial<Patient>) => void

  // Reset for demo
  resetDemo: () => void
}

const DemoDataContext = createContext<DemoDataContextType | undefined>(undefined)

/** Valid appointment-confirmation outcomes (completeTask defaults to "confirmed") */
const CONFIRMATION_OUTCOMES = ["confirmed", "no_answer", "reschedule_requested"] as const

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function DemoDataProvider({ children }: { children: ReactNode }) {
  // Initialize with empty state, will hydrate from localStorage
  const [state, setState] = useState<StoreState>(createInitialState)
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const savedState = loadState()
    // Legitimate external-system sync: localStorage hydration must happen after
    // mount so the server render and first client render match (SSR correctness).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(savedState)
    setIsHydrated(true)
  }, [])

  // Persist to localStorage on state changes (after hydration), debounced:
  // serializing the whole store synchronously on every mutation is expensive
  // once high-churn writers exist (safety simulation ticks every 4s, transcript
  // autosave every 1.5s). A 400ms trailing write coalesces bursts; the final
  // state always lands because the effect re-arms on every change.
  useEffect(() => {
    if (!isHydrated) return
    const timer = setTimeout(() => saveState(state), 400)
    // Flush synchronously if the tab closes inside the debounce window
    const flush = () => saveState(state)
    window.addEventListener("beforeunload", flush)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("beforeunload", flush)
    }
  }, [state, isHydrated])

  // Destructure state for easier access
  const { patients, notes, navigators, users, supervisors, adverseEvents, referrals, directMessages, appointments, careTemplates, carePlans, payers, remarkCodes, organizationSettings, claimRecords, auditLogs, noteTemplates, noteDrafts, zCodes, intakeRecords, timeLogs, scheduleEvents, navigatorShifts, timeOffRequests, navigatorLocations, sosEvents, journeyEvents, providers, standingFacts, chargeSlips, zones, navigatorTasks, patientDocuments, medReconciliations, escalations, providerCommunications, navigatorOnboarding, lastAssignedPatientId } = state

  /**
   * Playbook §4 billing gate set: patients with a SIGNED navigation contract.
   * Derived once per patientDocuments change; components pass this into
   * generateMonthlyClaims / computeRevenue / calculateEstimatedMonthlyRevenue.
   */
  const signedContractPatientIds = useMemo(() => {
    const ids = new Set<string>()
    for (const doc of patientDocuments) {
      if (doc.type === "navigation_contract" && doc.status === "signed") ids.add(doc.patientId)
    }
    return ids
  }, [patientDocuments])

  // ============================================================================
  // IDENTITY SELECTORS
  // ============================================================================

  const getUser = useCallback((userId: string) => {
    return users.find(u => u.id === userId)
  }, [users])

  const getSupervisor = useCallback((supervisorId: string) => {
    return supervisors.find(s => s.id === supervisorId)
  }, [supervisors])

  const getTeamNavigators = useCallback((supervisorId: string) => {
    return navigators.filter(n => n.supervisorId === supervisorId)
  }, [navigators])

  /**
   * Navigator identities with matching-engine attributes, joined with LIVE
   * caseload (Navigator.patientCount) so the matching engine reflects
   * assignments made during the session.
   */
  const getNavigatorsWithAttributes = useCallback(() => {
    return users
      .filter((u): u is User & { attributes: NavigatorAttributes } => u.role === "navigator" && !!u.attributes)
      .map(u => {
        const live = navigators.find(n => n.id === u.id)
        return live
          ? { ...u, attributes: { ...u.attributes, currentCaseload: live.patientCount } }
          : u
      })
  }, [users, navigators])

  const getNavigatorDisplayName = useCallback((navigatorId: string) => {
    return (
      navigators.find(n => n.id === navigatorId)?.name ??
      users.find(u => u.id === navigatorId)?.name ??
      navigatorId
    )
  }, [navigators, users])

  // ============================================================================
  // NOTE OPERATIONS
  // ============================================================================

  const addNote = useCallback((
    patientId: string, 
    content: string, 
    type: PatientNote["type"],
    authorId: string,
    authorName: string,
    authorRole: PatientNote["authorRole"]
  ) => {
    const newNote: PatientNote = {
      id: generateId(),
      patientId,
      authorId,
      authorName,
      authorRole,
      content,
      type,
      createdAt: new Date().toISOString()
    }
    setState(prev => ({ ...prev, notes: [newNote, ...prev.notes] }))
  }, [])

  const getPatientNotes = useCallback((patientId: string) => {
    return notes.filter(note => note.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [notes])

  // ============================================================================
  // REFERRAL OPERATIONS
  // ============================================================================

  /**
   * In-pipeline (non-terminal) referrals. Name kept from the legacy 3-state
   * model — "pending" now means any working pipeline status.
   */
  const getPendingReferrals = useCallback(() => {
    return referrals.filter(ref => !isTerminalReferralStatus(ref.status))
  }, [referrals])

  const getLastAssignedPatient = useCallback(() => {
    if (!lastAssignedPatientId) return null
    return patients.find(p => p.id === lastAssignedPatientId) || null
  }, [lastAssignedPatientId, patients])

  // ============================================================================
  // REFERRAL PIPELINE ACTIONS (Gellert WorkFlow2025 — thin wrappers over
  // lib/referral-pipeline.ts; every action audit-logs)
  // ============================================================================

  /** Small factory for audit entries created inside combined setState updates */
  const makeAudit = useCallback((
    userId: string,
    userName: string,
    userRole: UserRole,
    action: AuditAction,
    details: string,
    entityType?: string,
    entityId?: string
  ): AuditLog => ({
    id: generateId(),
    userId,
    userName,
    userRole,
    action,
    timestamp: new Date().toISOString(),
    details,
    entityType,
    entityId,
  }), [])

  const makeJourneyEvent = useCallback((
    patientId: string,
    fromPhase: JourneyPhase | "referral",
    toPhase: JourneyPhase,
    actorId: string,
    actorName: string,
    reason?: string
  ): JourneyEvent => ({
    id: generateId(),
    patientId,
    at: new Date().toISOString(),
    fromPhase,
    toPhase,
    actorId,
    actorName,
    reason,
  }), [])

  /**
   * 1. Eligibility review: received -> accepted | ineligible (5-gate
   * short-circuit tree). Ineligible closes the referral and stamps the
   * referring-provider notification.
   */
  const completeEligibilityCheck = useCallback((
    referralId: string,
    check: Omit<EligibilityCheck, "checkedAt" | "checkedBy" | "outcome" | "ineligibilityReason">,
    byId: string,
    byName: string
  ) => {
    setState(prev => {
      const referral = prev.referrals.find(r => r.id === referralId)
      if (!referral || referral.status !== "received") return prev

      const now = new Date().toISOString()
      const result = evaluateEligibility(check)
      const eligibility: EligibilityCheck = {
        ...check,
        checkedAt: now,
        checkedBy: byId,
        outcome: result.outcome,
        ineligibilityReason: result.ineligibilityReason,
      }

      const eligible = result.outcome === "eligible"
      const updated: Referral = eligible
        ? { ...referral, status: "accepted", eligibility, acceptedAt: now }
        : {
            ...referral,
            status: "ineligible",
            eligibility,
            closedAt: now,
            closeReason: "ineligible",
            providerNotifiedAt: now,
          }

      const auditEntries: AuditLog[] = [
        makeAudit(byId, byName, "supervisor", "eligibility_completed",
          `Eligibility ${eligible ? "PASSED — 48h contact clock started" : `FAILED (${result.ineligibilityReason})`} for ${referral.patientName}`,
          "referral", referralId),
      ]
      if (!eligible) {
        auditEntries.push(
          makeAudit(byId, byName, "supervisor", "referral_closed",
            `Referral for ${referral.patientName} closed: ineligible (${result.ineligibilityReason}); referring provider notified`,
            "referral", referralId)
        )
      }

      return {
        ...prev,
        referrals: prev.referrals.map(r => (r.id === referralId ? updated : r)),
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  /**
   * 2. Log an outreach attempt (max 7). Disposition drives the transition via
   * applyOutreachAttempt: agreed / declined / 7th failure -> unreachable.
   */
  const logOutreachAttempt = useCallback((
    referralId: string,
    attempt: Omit<OutreachAttempt, "id" | "attemptNumber">
  ) => {
    setState(prev => {
      const referral = prev.referrals.find(r => r.id === referralId)
      if (!referral || isTerminalReferralStatus(referral.status)) return prev
      if (attemptsRemaining(referral) === 0) return prev

      const now = new Date().toISOString()
      const fullAttempt: OutreachAttempt = {
        ...attempt,
        id: generateId(),
        attemptNumber: referral.outreachAttempts.length + 1,
      }
      const nextStatus = applyOutreachAttempt(referral, fullAttempt)

      let updated: Referral = {
        ...referral,
        status: nextStatus,
        outreachAttempts: [...referral.outreachAttempts, fullAttempt],
      }
      if (nextStatus === "agreed") {
        updated = { ...updated, agreedAt: now }
      } else if (nextStatus === "declined" || nextStatus === "unreachable") {
        // Auto-close does NOT pre-stamp providerNotifiedAt: the notification is
        // an explicit, reviewable send (ProviderCommDialog -> notifyReferringProvider),
        // which stamps it and stores the ProviderCommunication record.
        updated = { ...updated, closedAt: now, closeReason: nextStatus }
      }

      const auditEntries: AuditLog[] = [
        makeAudit(attempt.by, attempt.byName, "supervisor", "outreach_attempt_logged",
          `Outreach attempt ${fullAttempt.attemptNumber}/7 (${attempt.channel}, ${attempt.disposition}) for ${referral.patientName}`,
          "referral", referralId),
      ]
      if (nextStatus === "declined" || nextStatus === "unreachable") {
        auditEntries.push(
          makeAudit(attempt.by, attempt.byName, "supervisor", "referral_closed",
            `Referral for ${referral.patientName} closed: ${nextStatus}; referring provider notification pending`,
            "referral", referralId)
        )
      }

      return {
        ...prev,
        referrals: prev.referrals.map(r => (r.id === referralId ? updated : r)),
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  /**
   * 3. Schedule Intake 1: agreed -> intake_scheduled. Creates the intake
   * appointment (linked via intakeAppointmentId). Pre-conversion the patient
   * record doesn't exist yet, so the appointment carries the referral's
   * patientId when converted, else the referral id as a placeholder key
   * (workstream J-A/J-B refine the pre-conversion calendar surface).
   */
  const scheduleIntakeVisit = useCallback((
    referralId: string,
    date: string,
    time: string,
    navigatorId: string
  ) => {
    // SOP 1.7 gate: decision-making capacity must be confirmed before intake
    const gated = referrals.find(r => r.id === referralId)
    if (gated && !gated.decisionCapacityConfirmed) {
      toast.error("Decision-making capacity not confirmed", {
        description: `Confirm ${gated.patientName}'s capacity to decide on services (SOP 1.7) before scheduling Intake 1.`,
      })
      return
    }
    setState(prev => {
      const referral = prev.referrals.find(r => r.id === referralId)
      if (!referral || referral.status !== "agreed") return prev

      const appointment: Appointment = {
        id: generateId(),
        patientId: referral.patientId ?? referral.id,
        navigatorId,
        date,
        time,
        type: "home_visit",
        status: "scheduled",
        notes: `Intake 1 — onboarding visit for referral ${referral.patientName}`,
      }

      const auditEntry = makeAudit(navigatorId, getNavigatorDisplayName(navigatorId), "supervisor",
        "appointment_scheduled",
        `Intake 1 scheduled ${date} ${time} for referral ${referral.patientName}`,
        "referral", referralId)

      return {
        ...prev,
        appointments: [...prev.appointments, appointment],
        referrals: prev.referrals.map(r =>
          r.id === referralId
            ? { ...r, status: "intake_scheduled" as const, intakeAppointmentId: appointment.id, assignedNavigator: navigatorId }
            : r
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [referrals, makeAudit, getNavigatorDisplayName])

  /** SOP 1.7: confirm decision-making capacity on a referral (gates intake scheduling). */
  const confirmDecisionCapacity = useCallback((referralId: string, by: string) => {
    const now = new Date().toISOString()
    setState(prev => ({
      ...prev,
      referrals: prev.referrals.map(r =>
        r.id === referralId && !r.decisionCapacityConfirmed
          ? { ...r, decisionCapacityConfirmed: { confirmedAt: now, confirmedBy: by } }
          : r
      ),
    }))
  }, [])

  /**
   * 8. Notify the referring provider: renders the playbook §3.3 message for
   * the entity's state (or a caller-supplied type/override), stores it as a
   * ProviderCommunication (always simulated — honest stand-in for fax/Direct),
   * stamps providerNotifiedAt, and audits both the stamp and the send.
   */
  const notifyReferringProvider = useCallback((
    entity: { referralId?: string; patientId?: string },
    byId: string,
    byName: string,
    type?: ProviderCommunication["type"],
    override?: { subject: string; body: string }
  ) => {
    const now = new Date().toISOString()
    setState(prev => {
      const referral = entity.referralId ? prev.referrals.find(r => r.id === entity.referralId) : undefined
      const patient = entity.patientId
        ? prev.patients.find(p => p.id === entity.patientId)
        : referral?.patientId
          ? prev.patients.find(p => p.id === referral.patientId)
          : undefined
      const subjectName = referral?.patientName ?? patient?.name
      if (!subjectName) return prev

      // Default the communication type from the entity's state
      const resolvedType: ProviderCommunication["type"] =
        type ??
        (referral?.closeReason === "ineligible"
          ? "ineligible_notification"
          : referral?.closeReason === "unreachable"
            ? "unreachable_notification"
            : patient?.journeyPhase === "exited"
              ? "exit_notification"
              : "intake_notification")

      const intake = patient ? prev.intakeRecords.find(ir => ir.patientId === patient.id) : undefined
      const ctx: ProviderCommContext = {
        patientName: subjectName,
        referringProvider: referral?.rawData?.PV1?.referringPhysician,
        facilityName: referral?.rawData?.PV1?.facilityName ?? referral?.source ?? patient?.referralSource,
        intakeCompletedDate: intake?.date,
        pcpAppointmentDate: intake?.pcpApptDate,
        clinicalSummary: patient?.primaryDiagnosis ?? referral?.diagnosis,
        exitReason: patient?.exit?.pathway,
        exitDate: patient?.exit?.exitedAt?.slice(0, 10),
        ineligibilityReason: referral?.eligibility?.ineligibilityReason,
        outreachAttempts: referral?.outreachAttempts.length,
        closedDate: referral?.closedAt?.slice(0, 10),
      }
      const rendered = override ?? renderProviderComm(resolvedType, ctx)

      const comm: ProviderCommunication = {
        id: generateId(),
        referralId: entity.referralId,
        patientId: entity.patientId ?? referral?.patientId,
        type: resolvedType,
        subject: rendered.subject,
        body: rendered.body,
        sentAt: now,
        sentBy: byId,
        sentByName: byName,
        simulated: true,
      }

      const auditEntries: AuditLog[] = [
        makeAudit(byId, byName, "supervisor", "provider_comm_sent",
          `${resolvedType.replace(/_/g, " ")} sent (simulated) regarding ${subjectName}`,
          "provider_communication", comm.id),
        makeAudit(byId, byName, "supervisor", "provider_notified",
          `Referring provider notified regarding ${subjectName}`,
          entity.referralId ? "referral" : "patient",
          entity.referralId ?? entity.patientId),
      ]

      return {
        ...prev,
        providerCommunications: [...prev.providerCommunications, comm],
        referrals: entity.referralId
          ? prev.referrals.map(r => (r.id === entity.referralId ? { ...r, providerNotifiedAt: now } : r))
          : prev.referrals,
        intakeRecords: entity.patientId
          ? prev.intakeRecords.map(ir => (ir.patientId === entity.patientId ? { ...ir, providerNotifiedAt: now } : ir))
          : prev.intakeRecords,
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  // ============================================================================
  // INTAKE & ASSESSMENT OPERATIONS (Phase 2)
  // ============================================================================

  /**
   * 4. CONVERSION: accept a referral and create the patient record.
   * Guarded to agreed | intake_scheduled — patients are created only once the
   * patient has agreed to services (Gellert's own AMD rule). Also creates the
   * IntakeRecord with a full Intake 1 checklist and the PCP-within-7-business-
   * days deadline, and writes the referral -> intake JourneyEvent.
   */
  const acceptReferral = useCallback((
    referralId: string,
    patientData: Partial<Patient>,
    navigatorId: string
  ): Patient | null => {
    const referral = referrals.find(r => r.id === referralId)
    if (!referral || !["agreed", "intake_scheduled"].includes(referral.status)) return null

    const newPatientId = `pt-${generateId()}`
    const navigator = navigators.find(n => n.id === navigatorId)

    // Resolve payer identity at the data boundary (the ONE fuzzy-match point)
    const resolvedHealthPlan = patientData.healthPlan || referral.healthPlan
    const payer = resolvePayerByName(payers, referral.rawData?.IN1?.payerName || resolvedHealthPlan)

    // Create patient with validated/edited data from the intake form
    const newPatient: Patient = {
      id: newPatientId,
      name: patientData.name || referral.patientName,
      dob: patientData.dob || referral.dob,
      chartNumber: patientData.chartNumber || `GH-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
      riskLevel: patientData.riskLevel || lineToRiskLevel(referral.requiredAcuity),
      survivalStatus: "active",
      journeyPhase: "intake",
      assignedNavigator: navigatorId,
      assignedSupervisor: patientData.assignedSupervisor || "sup1",
      healthPlan: resolvedHealthPlan,
      payerId: patientData.payerId || payer?.id,
      memberId: patientData.memberId || referral.rawData?.IN1?.memberId,
      enrollmentDate: new Date().toISOString().split('T')[0],
      lastContactDate: new Date().toISOString().split('T')[0],
      medicationCompliance: 0,
      pcpCompliance: false,
      upcomingAppointments: [],
      medications: [],
      adverseEvents: [],
      // Additional intake fields from rawData
      address: patientData.address || referral.rawData?.PID?.address,
      phone: patientData.phone || referral.rawData?.PID?.phone,
      email: patientData.email || referral.rawData?.PID?.email,
      primaryDiagnosis: patientData.primaryDiagnosis || referral.rawData?.DG1?.primaryDiagnosis || referral.diagnosis,
      icdCodes: patientData.icdCodes || referral.rawData?.DG1?.icdCodes,
      referralSource: referral.source,
    }

    // Create initial enrollment note
    const initialNote: PatientNote = {
      id: generateId(),
      patientId: newPatientId,
      authorId: "system",
      authorName: "System",
      authorRole: "supervisor",
      content: `Patient intake completed. Referral from ${referral.source} accepted. Diagnosis: ${newPatient.primaryDiagnosis}. Assigned to ${navigator?.name || 'Navigator'}.`,
      type: "clinical",
      createdAt: new Date().toISOString()
    }

    // Create initial home visit appointment (Intake 1 unless one already exists)
    const initialAppointment: Appointment = {
      id: generateId(),
      patientId: newPatientId,
      navigatorId: navigatorId,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: "10:00",
      type: "home_visit",
      status: "scheduled",
      notes: "Intake 1 — onboarding visit / risk assessment"
    }

    const todayIso = new Date().toISOString().split('T')[0]

    // Gellert intake protocol record: Intake 1 scheduled with a full (undone)
    // checklist + PCP-within-7-business-days deadline
    const intakeRecord: IntakeRecord = {
      id: generateId(),
      patientId: newPatientId,
      date: todayIso,
      initiatingVisitDate: todayIso,
      consentObtained: true,
      consentDate: todayIso,
      serviceType: (patientData.billingTrack as ServiceType) || "CHI",
      acuity: {
        clinical: 1, psychosocial: 1, barriers: 1, literacy: 1,
        totalScore: 4,
        level: referral.requiredAcuity === "L3" ? "High" : referral.requiredAcuity === "L2" ? "Moderate" : "Low",
      },
      identifiedBarriers: [],
      primaryNavigatorId: navigatorId,
      intake1: {
        scheduledDate: initialAppointment.date,
        status: "scheduled",
        noShowCount: 0,
        checklist: buildChecklist(INTAKE1_CHECKLIST),
      },
      intake2: {
        status: "not_scheduled",
        noShowCount: 0,
        checklist: buildChecklist(INTAKE2_CHECKLIST),
      },
      pcpDueBy: addBusinessDays(todayIso, 7),
      totalNoShows: 0,
    }

    const journeyEvent = makeJourneyEvent(
      newPatientId, "referral", "intake",
      navigatorId, navigator?.name || "Navigator",
      `Referral from ${referral.source} converted; Intake 1 scheduled`
    )
    const auditEntry = makeAudit(navigatorId, navigator?.name || "Navigator", "supervisor",
      "patient_created",
      `Referral for ${referral.patientName} converted to patient (Intake phase); PCP due by ${intakeRecord.pcpDueBy}`,
      "patient", newPatientId)

    setState(prev => ({
      ...prev,
      patients: [...prev.patients, newPatient],
      appointments: [...prev.appointments, initialAppointment],
      notes: [initialNote, ...prev.notes],
      intakeRecords: [...prev.intakeRecords, intakeRecord],
      journeyEvents: [...prev.journeyEvents, journeyEvent],
      lastAssignedPatientId: newPatientId,
      referrals: prev.referrals.map(r =>
        r.id === referralId
          ? { ...r, status: "converted" as const, assignedNavigator: navigatorId, patientId: newPatientId }
          : r
      ),
      navigators: prev.navigators.map(nav =>
        nav.id === navigatorId
          ? { ...nav, patientCount: nav.patientCount + 1 }
          : nav
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))

    return { ...newPatient, upcomingAppointments: [initialAppointment] }
  }, [referrals, navigators, payers, makeAudit, makeJourneyEvent])

  // ============================================================================
  // JOURNEY ACTIONS (post-conversion — intake protocol, graduation,
  // telenavigation, exits; thin wrappers over lib/journey.ts)
  // ============================================================================

  /** 13. Exit the program via one of the 5 documented pathways. */
  const exitProgram = useCallback((patientId: string, exit: ProgramExit) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient || patient.journeyPhase === "exited") return prev
      if (!canTransitionPhase(patient.journeyPhase, "exited")) return prev
      // Patient-initiated exits require supervisor confirmation (enforced here)
      if (exit.pathway === "patient_initiated" && !exit.supervisorConfirmedBy) return prev

      const now = new Date().toISOString()
      const fullExit: ProgramExit = { ...exit, providerNotifiedAt: exit.providerNotifiedAt ?? now }
      const journeyEvent = makeJourneyEvent(
        patientId, patient.journeyPhase, "exited",
        exit.documentedBy, getNavigatorDisplayName(exit.documentedBy),
        `Program exit: ${exit.pathway}`
      )
      const auditEntries = [
        makeAudit(exit.documentedBy, getNavigatorDisplayName(exit.documentedBy), "supervisor",
          "program_exited",
          `${patient.name} exited the program (${exit.pathway})`,
          "patient", patientId),
        makeAudit(exit.documentedBy, getNavigatorDisplayName(exit.documentedBy), "supervisor",
          "provider_notified",
          `Referring provider notified of program exit for ${patient.name}`,
          "patient", patientId),
      ]

      return {
        ...prev,
        patients: prev.patients.map(p =>
          p.id === patientId
            // survivalStatus -> inactive keeps every existing active-roster filter correct
            ? { ...p, journeyPhase: "exited" as const, exit: fullExit, survivalStatus: "inactive" as const }
            : p
        ),
        journeyEvents: [...prev.journeyEvents, journeyEvent],
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }
    })
  }, [makeAudit, makeJourneyEvent, getNavigatorDisplayName])

  /** 5. Check or uncheck an Intake 1/2 checklist item. */
  const updateIntakeChecklistItem = useCallback((
    patientId: string,
    visit: 1 | 2,
    key: IntakeChecklistKey,
    done: boolean,
    byId: string,
    byName: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      const auditEntry = makeAudit(byId, byName, "navigator", "intake_visit_completed",
        `Intake ${visit} checklist item "${key}" ${done ? "completed" : "unchecked"} for ${patient?.name ?? patientId}`,
        "intake_record", patientId)
      return {
        ...prev,
        intakeRecords: prev.intakeRecords.map(ir => {
          if (ir.patientId !== patientId) return ir
          const visitKey = visit === 1 ? "intake1" : "intake2"
          const intakeVisit = ir[visitKey]
          if (!intakeVisit) return ir
          return {
            ...ir,
            [visitKey]: {
              ...intakeVisit,
              checklist: intakeVisit.checklist.map(item =>
                item.key === key
                  ? { ...item, done, doneAt: done ? new Date().toISOString() : undefined, doneBy: done ? byId : undefined }
                  : item
              ),
            },
          }
        }),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  /**
   * 6. Complete Intake 1 or 2. Intake 2 completion (all checklist items done)
   * transitions the patient intake -> active.
   */
  const completeIntakeVisit = useCallback((
    patientId: string,
    visit: 1 | 2,
    byId: string,
    byName: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      const intake = prev.intakeRecords.find(ir => ir.patientId === patientId)
      const visitKey = visit === 1 ? "intake1" : "intake2"
      const intakeVisit = intake?.[visitKey]
      if (!patient || !intake || !intakeVisit || intakeVisit.status === "completed") return prev
      // Completion requires every checklist item done
      if (!isIntakeVisitComplete(intakeVisit)) return prev

      const now = new Date().toISOString()
      const graduatesToActive = visit === 2 && patient.journeyPhase === "intake"

      const auditEntries: AuditLog[] = [
        makeAudit(byId, byName, "navigator", "intake_visit_completed",
          `Intake ${visit} completed for ${patient.name}${graduatesToActive ? " — patient is now in Active Navigation" : ""}`,
          "patient", patientId),
      ]
      const newJourneyEvents = graduatesToActive
        ? [makeJourneyEvent(patientId, "intake", "active", byId, byName, "Intake 2 complete; graduated to active navigation")]
        : []

      return {
        ...prev,
        intakeRecords: prev.intakeRecords.map(ir =>
          ir.patientId === patientId
            ? { ...ir, [visitKey]: { ...intakeVisit, status: "completed" as const, completedDate: now.slice(0, 10) } }
            : ir
        ),
        patients: graduatesToActive
          ? prev.patients.map(p => (p.id === patientId ? { ...p, journeyPhase: "active" as const } : p))
          : prev.patients,
        journeyEvents: [...prev.journeyEvents, ...newJourneyEvents],
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }
    })
  }, [makeAudit, makeJourneyEvent])

  /**
   * 7. Record an intake no-show. The THIRD no-show auto-invokes the MIA
   * closure protocol (documented 3-no-show rule).
   */
  const recordIntakeNoShow = useCallback((
    patientId: string,
    visit: 1 | 2,
    byId: string,
    byName: string
  ) => {
    let shouldExit = false
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      const intake = prev.intakeRecords.find(ir => ir.patientId === patientId)
      const visitKey = visit === 1 ? "intake1" : "intake2"
      const intakeVisit = intake?.[visitKey]
      if (!patient || !intake || !intakeVisit) return prev

      const totalNoShows = (intake.totalNoShows ?? 0) + 1
      shouldExit = totalNoShows >= NO_SHOW_CLOSURE_THRESHOLD

      const auditEntry = makeAudit(byId, byName, "navigator", "intake_no_show",
        `Intake ${visit} no-show recorded for ${patient.name} (${totalNoShows}/${NO_SHOW_CLOSURE_THRESHOLD})`,
        "patient", patientId)

      return {
        ...prev,
        intakeRecords: prev.intakeRecords.map(ir =>
          ir.patientId === patientId
            ? {
                ...ir,
                totalNoShows,
                [visitKey]: { ...intakeVisit, noShowCount: intakeVisit.noShowCount + 1 },
              }
            : ir
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
    // 3rd no-show: MIA closure protocol
    if (shouldExit) {
      exitProgram(patientId, {
        pathway: "mia",
        exitedAt: new Date().toISOString(),
        documentedBy: byId,
        notes: `Closed per the 3-no-show protocol: patient missed ${NO_SHOW_CLOSURE_THRESHOLD} intake visits and is unreachable (MIA).`,
      })
    }
  }, [makeAudit, exitProgram])

  /** 9. Navigator flags graduation readiness; supervisor gets a nudge. */
  const flagGraduationReadiness = useCallback((
    patientId: string,
    navigatorId: string,
    note: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient || patient.journeyPhase !== "active") return prev

      const navigatorName = prev.navigators.find(n => n.id === navigatorId)?.name || "Navigator"
      const supervisorId = patient.assignedSupervisor
      const supervisor = prev.supervisors.find(s => s.id === supervisorId)

      const nudge: Message = {
        id: generateId(),
        senderId: navigatorId,
        senderName: navigatorName,
        senderRole: "navigator",
        receiverId: supervisorId,
        receiverName: supervisor?.name || "Supervisor",
        receiverRole: "supervisor",
        content: `Graduation readiness flagged for ${patient.name}: ${note}`,
        timestamp: new Date().toISOString(),
        readStatus: false,
        type: "nudge",
        patientId,
        patientName: patient.name,
      }
      const auditEntry = makeAudit(navigatorId, navigatorName, "navigator", "graduation_flagged",
        `Graduation readiness flagged for ${patient.name}`,
        "patient", patientId)

      return {
        ...prev,
        patients: prev.patients.map(p =>
          p.id === patientId
            ? { ...p, graduation: { readinessFlaggedAt: new Date().toISOString(), readinessFlaggedBy: navigatorId, readinessNote: note } }
            : p
        ),
        directMessages: [...prev.directMessages, nudge],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  /** 10. Supervisor confirms graduation: active -> telenavigation (30-day cadence). */
  const confirmGraduation = useCallback((
    patientId: string,
    supervisorId: string,
    supervisorName: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient || patient.journeyPhase !== "active" || !patient.graduation) return prev
      if (!canTransitionPhase("active", "telenavigation")) return prev

      const now = new Date().toISOString()
      const journeyEvent = makeJourneyEvent(patientId, "active", "telenavigation",
        supervisorId, supervisorName, "Graduation confirmed; monthly telenavigation cadence begins")
      const auditEntry = makeAudit(supervisorId, supervisorName, "supervisor", "graduation_confirmed",
        `Graduation confirmed for ${patient.name}; telenavigation started (30-day cadence)`,
        "patient", patientId)

      return {
        ...prev,
        patients: prev.patients.map(p =>
          p.id === patientId
            ? {
                ...p,
                journeyPhase: "telenavigation" as const,
                graduation: { ...p.graduation!, confirmedAt: now, confirmedBy: supervisorId },
                telenavigation: { startedAt: now, cadenceDays: 30 },
              }
            : p
        ),
        journeyEvents: [...prev.journeyEvents, journeyEvent],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit, makeJourneyEvent])

  /** 11. Record a monthly telenavigation check-in (writes a phone note). */
  const recordTelenavCheckIn = useCallback((
    patientId: string,
    byId: string,
    byName: string,
    note: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient || patient.journeyPhase !== "telenavigation" || !patient.telenavigation) return prev

      const now = new Date().toISOString()
      const checkInNote: PatientNote = {
        id: generateId(),
        patientId,
        authorId: byId,
        authorName: byName,
        authorRole: "navigator",
        content: `Telenavigation monthly check-in: ${note}`,
        type: "phone",
        createdAt: now,
      }
      const auditEntry = makeAudit(byId, byName, "navigator", "telenav_check_in",
        `Telenavigation check-in recorded for ${patient.name}`,
        "patient", patientId)

      return {
        ...prev,
        patients: prev.patients.map(p =>
          p.id === patientId
            ? { ...p, telenavigation: { ...p.telenavigation!, lastCheckInAt: now }, lastContactDate: now.slice(0, 10) }
            : p
        ),
        notes: [checkInNote, ...prev.notes],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  /** 12. Re-engage a telenavigation patient back into active navigation. */
  const reengagePatient = useCallback((
    patientId: string,
    byId: string,
    byName: string,
    reason: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient || patient.journeyPhase !== "telenavigation") return prev
      if (!canTransitionPhase("telenavigation", "active")) return prev

      const journeyEvent = makeJourneyEvent(patientId, "telenavigation", "active", byId, byName, reason)
      const auditEntry = makeAudit(byId, byName, "supervisor", "patient_reengaged",
        `${patient.name} re-engaged into active navigation: ${reason}`,
        "patient", patientId)

      return {
        ...prev,
        patients: prev.patients.map(p =>
          p.id === patientId ? { ...p, journeyPhase: "active" as const, telenavigation: undefined } : p
        ),
        journeyEvents: [...prev.journeyEvents, journeyEvent],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit, makeJourneyEvent])

  /**
   * Submit a risk assessment for a patient
   * Updates the patient's riskScore and riskLevel based on assessment
   */
  const submitAssessment = useCallback((
    patientId: string,
    assessmentData: Omit<RiskAssessmentData, 'riskScore' | 'calculatedTier' | 'completedAt'>,
    navigatorId: string
  ) => {
    const riskScore = calculateRiskScore(assessmentData)
    const calculatedTier = calculateRiskTier(riskScore)
    const navigator = navigators.find(n => n.id === navigatorId)

    const fullAssessment: RiskAssessmentData = {
      ...assessmentData,
      riskScore,
      calculatedTier,
      completedAt: new Date().toISOString(),
      completedBy: navigatorId
    }

    // Create assessment note
    const assessmentNote: PatientNote = {
      id: generateId(),
      patientId,
      authorId: navigatorId,
      authorName: navigator?.name || "Navigator",
      authorRole: "navigator",
      content: `Risk Assessment Completed. Score: ${riskScore}/100 (Tier ${calculatedTier}). ` +
        `Social: Housing=${assessmentData.socialDeterminants.housingInsecurity ? 'Yes' : 'No'}, ` +
        `Food=${assessmentData.socialDeterminants.foodInsecurity ? 'Yes' : 'No'}, ` +
        `Transport=${assessmentData.socialDeterminants.transportationIssues ? 'Yes' : 'No'}. ` +
        `Clinical: Fall=${assessmentData.clinicalStatus.recentFall ? 'Yes' : 'No'}, ` +
        `Hospitalized=${assessmentData.clinicalStatus.hospitalizedLast30Days ? 'Yes' : 'No'}, ` +
        `Polypharmacy=${assessmentData.clinicalStatus.polypharmacy ? 'Yes' : 'No'}. ` +
        `Mobility: ${assessmentData.mobility}.`,
      type: "clinical",
      createdAt: new Date().toISOString()
    }

    setState(prev => ({
      ...prev,
      patients: prev.patients.map(p =>
        p.id === patientId
          ? { ...p, riskScore, riskLevel: calculatedTier, riskAssessment: fullAssessment }
          : p
      ),
      notes: [assessmentNote, ...prev.notes]
    }))
  }, [navigators])

  // ============================================================================
  // MESSAGE OPERATIONS
  // ============================================================================

  const sendNudge = useCallback((
    toNavigatorId: string,
    patientId: string,
    patientName: string,
    content: string,
    senderId: string,
    senderName: string,
    senderRole: UserRole = "supervisor"
  ) => {
    const navigator = navigators.find(n => n.id === toNavigatorId)
    const newDirectMessage: Message = {
      id: generateId(),
      senderId: senderId,
      senderName: senderName,
      senderRole: senderRole,
      receiverId: toNavigatorId,
      receiverName: navigator?.name || "Navigator",
      receiverRole: "navigator",
      content,
      timestamp: new Date().toISOString(),
      readStatus: false,
      type: "nudge",
      patientId,
      patientName
    }

    setState(prev => ({
      ...prev,
      directMessages: [...prev.directMessages, newDirectMessage]
    }))
  }, [navigators])

  const getNudgesForNavigator = useCallback((navigatorId: string) => {
    return directMessages
      .filter(m => m.receiverId === navigatorId && m.type === "nudge")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [directMessages])

  // ============================================================================
  // NAVIGATOR TASKS (Gellert ops blitz — thin wrappers over lib/task-engine.ts)
  // ============================================================================

  /**
   * Run the task engine over current state and insert newly-due tasks:
   * confirmation windows entered (SOP 3.3), post-visit follow-ups for
   * completed appointments (SOP 3.6), and same-day no-show recoveries
   * (SOP 3.10). Idempotent by (type, appointmentId); returns inserted count.
   */
  const generateDueTasks = useCallback((): number => {
    let inserted = 0
    setState(prev => {
      const now = new Date()
      const candidates: NavigatorTask[] = [
        ...deriveDueConfirmationTasks(prev.appointments, prev.navigatorTasks, now),
      ]
      for (const appt of prev.appointments) {
        if (appt.status === "completed") candidates.push(taskForCompletedVisit(appt, now))
        else if (appt.status === "no_show") candidates.push(taskForNoShow(appt, now))
      }

      const existingKeys = new Set(prev.navigatorTasks.map(taskKey))
      const fresh = candidates.filter(t => {
        const key = taskKey(t)
        if (existingKeys.has(key)) return false
        existingKeys.add(key)
        return true
      })
      inserted = fresh.length
      if (fresh.length === 0) return prev
      return { ...prev, navigatorTasks: [...prev.navigatorTasks, ...fresh] }
    })
    return inserted
  }, [])

  /**
   * Insert the SOP 4.x response task set for one adverse event (post-event
   * contact; PCP-in-7-business-days, med rec, and education once ended).
   * Idempotent by (type, adverseEventId); returns inserted count.
   */
  const generateAdverseEventTasks = useCallback((adverseEventId: string, byId: string, byName: string): number => {
    let inserted = 0
    setState(prev => {
      const event = prev.adverseEvents.find(e => e.id === adverseEventId)
      const patient = event ? prev.patients.find(p => p.id === event.patientId) : undefined
      if (!event || !patient) return prev

      const existingKeys = new Set(prev.navigatorTasks.map(taskKey))
      const fresh = tasksForAdverseEvent(event, patient).filter(t => !existingKeys.has(taskKey(t)))
      inserted = fresh.length
      if (fresh.length === 0) return prev

      const auditEntry = makeAudit(byId, byName, "supervisor", "task_completed",
        `Adverse-event response tasks generated for ${patient.name} (${fresh.length} task${fresh.length === 1 ? "" : "s"})`,
        "adverse_event", adverseEventId)
      return {
        ...prev,
        navigatorTasks: [...prev.navigatorTasks, ...fresh],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
    return inserted
  }, [makeAudit])

  /**
   * Complete an open task. Confirmation tasks also stamp the appointment's
   * confirmations[] (window from the task type, outcome defaulting to
   * "confirmed") so the engine never regenerates that window.
   */
  const completeTask = useCallback((taskId: string, by: string, outcome?: string, note?: string) => {
    setState(prev => {
      const task = prev.navigatorTasks.find(t => t.id === taskId)
      if (!task || task.status !== "open") return prev

      const now = new Date().toISOString()
      const window = confirmationWindowForType(task.type)
      const resolvedOutcome = outcome ?? (window ? "confirmed" : undefined)
      const updatedTask: NavigatorTask = {
        ...task,
        status: "done",
        completedAt: now,
        completedBy: by,
        outcome: resolvedOutcome,
        note: note ?? task.note,
      }

      let nextAppointments = prev.appointments
      let nextPatients = prev.patients
      if (window && task.appointmentId) {
        const appt = prev.appointments.find(a => a.id === task.appointmentId)
        if (appt && !appt.confirmations?.some(c => c.window === window)) {
          const confirmationOutcome = (CONFIRMATION_OUTCOMES as readonly string[]).includes(resolvedOutcome ?? "")
            ? (resolvedOutcome as (typeof CONFIRMATION_OUTCOMES)[number])
            : "confirmed"
          const updatedAppt: Appointment = {
            ...appt,
            confirmations: [...(appt.confirmations ?? []), { window, at: now, by, outcome: confirmationOutcome }],
          }
          nextAppointments = prev.appointments.map(a => (a.id === appt.id ? updatedAppt : a))
          nextPatients = syncAppointmentToPatient(prev.patients, updatedAppt)
        }
      }

      const patient = prev.patients.find(p => p.id === task.patientId)
      const auditEntry = makeAudit(by, getNavigatorDisplayName(by), "navigator", "task_completed",
        `${TASK_TYPE_CONFIG[task.type].label} completed for ${patient?.name ?? task.patientId}${resolvedOutcome ? ` — ${resolvedOutcome.replace(/_/g, " ")}` : ""}`,
        "navigator_task", taskId)

      return {
        ...prev,
        navigatorTasks: prev.navigatorTasks.map(t => (t.id === taskId ? updatedTask : t)),
        appointments: nextAppointments,
        patients: nextPatients,
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit, getNavigatorDisplayName])

  /** Dismiss an open task with a reason note. */
  const dismissTask = useCallback((taskId: string, by: string, note: string) => {
    setState(prev => {
      const task = prev.navigatorTasks.find(t => t.id === taskId)
      if (!task || task.status !== "open") return prev

      const patient = prev.patients.find(p => p.id === task.patientId)
      const auditEntry = makeAudit(by, getNavigatorDisplayName(by), "navigator", "task_dismissed",
        `${TASK_TYPE_CONFIG[task.type].label} dismissed for ${patient?.name ?? task.patientId}: ${note}`,
        "navigator_task", taskId)

      return {
        ...prev,
        navigatorTasks: prev.navigatorTasks.map(t =>
          t.id === taskId
            ? { ...t, status: "dismissed" as const, completedAt: new Date().toISOString(), completedBy: by, note }
            : t
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit, getNavigatorDisplayName])

  // ============================================================================
  // PATIENT DOCUMENTS & E-SIGN (Gellert ops blitz)
  // ============================================================================

  /**
   * Auto-check the intake checklist item a document satisfies (via the
   * existing updateIntakeChecklistItem so the audit trail stays uniform).
   * No-ops when the patient has no intake record or the item is already done.
   */
  const autoCheckChecklistForDocument = useCallback((doc: PatientDocument, byId: string) => {
    if (!isDocumentSatisfied(doc)) return
    const mapping = checklistItemForDocument(doc.type)
    const intake = intakeRecords.find(ir => ir.patientId === doc.patientId)
    const visit = mapping.visit === 1 ? intake?.intake1 : intake?.intake2
    const item = visit?.checklist.find(i => i.key === mapping.key)
    if (!item || item.done) return
    updateIntakeChecklistItem(doc.patientId, mapping.visit, mapping.key, true, byId, getNavigatorDisplayName(byId))
  }, [intakeRecords, updateIntakeChecklistItem, getNavigatorDisplayName])

  /** Create or update (upsert by id) a patient document; stamps updatedAt. */
  const savePatientDocument = useCallback((doc: PatientDocument) => {
    const now = new Date().toISOString()
    setState(prev => {
      const exists = prev.patientDocuments.some(d => d.id === doc.id)
      const saved: PatientDocument = { ...doc, createdAt: doc.createdAt || now, updatedAt: now }
      return {
        ...prev,
        patientDocuments: exists
          ? prev.patientDocuments.map(d => (d.id === doc.id ? saved : d))
          : [...prev.patientDocuments, saved],
      }
    })
  }, [])

  /**
   * Mark a document completed (terminal for non-signature types) and
   * auto-check its intake checklist item.
   */
  const completePatientDocument = useCallback((docId: string, by: string) => {
    const doc = patientDocuments.find(d => d.id === docId)
    if (!doc || doc.status === "completed" || doc.status === "signed") return

    const now = new Date().toISOString()
    const updated: PatientDocument = { ...doc, status: "completed", completedBy: by, updatedAt: now }
    const patient = patients.find(p => p.id === doc.patientId)
    const auditEntry = makeAudit(by, getNavigatorDisplayName(by), "navigator", "document_completed",
      `${DOCUMENT_DEFINITIONS[doc.type].title} completed for ${patient?.name ?? doc.patientId}`,
      "patient_document", docId)

    setState(prev => ({
      ...prev,
      patientDocuments: prev.patientDocuments.map(d => (d.id === docId ? updated : d)),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
    autoCheckChecklistForDocument(updated, by)
  }, [patientDocuments, patients, makeAudit, getNavigatorDisplayName, autoCheckChecklistForDocument])

  /**
   * Sign a signature-bearing document (roi / navigation_contract) with the
   * typed-name demo e-signature, and auto-check its intake checklist item.
   * Signing the navigation contract is what opens the billing gate.
   */
  const signPatientDocument = useCallback((
    docId: string,
    signature: NonNullable<PatientDocument["signature"]>,
    by: string
  ) => {
    const doc = patientDocuments.find(d => d.id === docId)
    if (!doc || doc.status === "signed") return
    if (!DOCUMENT_DEFINITIONS[doc.type].requiresSignature) return

    const now = new Date().toISOString()
    const updated: PatientDocument = {
      ...doc,
      status: "signed",
      signature: { ...signature, signedAt: signature.signedAt || now },
      completedBy: by,
      updatedAt: now,
    }
    const patient = patients.find(p => p.id === doc.patientId)
    const auditEntry = makeAudit(by, getNavigatorDisplayName(by), "navigator", "document_signed",
      `${DOCUMENT_DEFINITIONS[doc.type].title} signed by ${signature.signedByName} (${signature.relationship}) for ${patient?.name ?? doc.patientId}${doc.type === "navigation_contract" ? " — billing gate open" : ""}`,
      "patient_document", docId)

    setState(prev => ({
      ...prev,
      patientDocuments: prev.patientDocuments.map(d => (d.id === docId ? updated : d)),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
    autoCheckChecklistForDocument(updated, by)
  }, [patientDocuments, patients, makeAudit, getNavigatorDisplayName, autoCheckChecklistForDocument])

  // ============================================================================
  // MEDICATION RECONCILIATION (Gellert ops blitz)
  // ============================================================================

  /** Replace the patient's LIVE medication list (snapshots happen at reconciliation). */
  const updatePatientMedications = useCallback((patientId: string, meds: Medication[], by: string) => {
    void by // actor recorded on the reconciliation event, not the raw list edit
    setState(prev => ({
      ...prev,
      patients: prev.patients.map(p => (p.id === patientId ? { ...p, medications: meds } : p)),
    }))
  }, [])

  /**
   * Record a reconciliation: snapshots the patient's CURRENT medications plus
   * the change diff, audits, and auto-checks the med_reconciliation item.
   */
  const recordMedReconciliation = useCallback((
    patientId: string,
    changes: MedReconciliationEvent["changes"],
    note: string | undefined,
    by: string,
    byName: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient) return prev

      const event: MedReconciliationEvent = {
        id: generateId(),
        patientId,
        at: new Date().toISOString(),
        by,
        byName,
        medications: patient.medications.map(m => ({ ...m })),
        changes,
        note,
      }
      const auditEntry = makeAudit(by, byName, "navigator", "med_reconciliation_recorded",
        `Medication reconciliation recorded for ${patient.name} (${changes.length} change${changes.length === 1 ? "" : "s"})`,
        "med_reconciliation", event.id)

      return {
        ...prev,
        medReconciliations: [...prev.medReconciliations, event],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })

    // Auto-check the Intake 1 med_reconciliation item (uniform audit trail)
    const mapping = checklistItemForDocument("medication_list")
    const intake = intakeRecords.find(ir => ir.patientId === patientId)
    const item = intake?.intake1?.checklist.find(i => i.key === mapping.key)
    if (item && !item.done) {
      updateIntakeChecklistItem(patientId, mapping.visit, mapping.key, true, by, byName)
    }
  }, [makeAudit, intakeRecords, updateIntakeChecklistItem])

  // ============================================================================
  // ESCALATIONS (Gellert ops blitz — closed loop; distinct from SOS)
  // ============================================================================

  /** Raise an escalation; the patient's assigned supervisor gets a nudge. */
  const raiseEscalation = useCallback((
    patientId: string,
    navigatorId: string,
    reason: Escalation["reason"],
    description: string
  ) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient) return prev

      const now = new Date().toISOString()
      const navigatorName = prev.navigators.find(n => n.id === navigatorId)?.name ?? "Navigator"
      const supervisorId = patient.assignedSupervisor
      const supervisor = prev.supervisors.find(s => s.id === supervisorId)

      const escalation: Escalation = {
        id: generateId(),
        patientId,
        navigatorId,
        reason,
        description,
        raisedAt: now,
        status: "open",
      }
      const nudge: Message = {
        id: generateId(),
        senderId: navigatorId,
        senderName: navigatorName,
        senderRole: "navigator",
        receiverId: supervisorId,
        receiverName: supervisor?.name ?? "Supervisor",
        receiverRole: "supervisor",
        content: `Escalation raised for ${patient.name} (${reason.replace(/_/g, " ")}): ${description}`,
        timestamp: now,
        readStatus: false,
        type: "nudge",
        patientId,
        patientName: patient.name,
      }
      const auditEntry = makeAudit(navigatorId, navigatorName, "navigator", "escalation_raised",
        `Escalation raised for ${patient.name}: ${reason.replace(/_/g, " ")}`,
        "escalation", escalation.id)

      return {
        ...prev,
        escalations: [...prev.escalations, escalation],
        directMessages: [...prev.directMessages, nudge],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  /** open -> acknowledged. */
  const acknowledgeEscalation = useCallback((escalationId: string, by: string) => {
    setState(prev => {
      const escalation = prev.escalations.find(e => e.id === escalationId)
      if (!escalation || escalation.status !== "open") return prev

      const now = new Date().toISOString()
      const patient = prev.patients.find(p => p.id === escalation.patientId)
      const auditEntry = makeAudit(by, getNavigatorDisplayName(by), "supervisor", "escalation_acknowledged",
        `Escalation for ${patient?.name ?? escalation.patientId} acknowledged`,
        "escalation", escalationId)

      return {
        ...prev,
        escalations: prev.escalations.map(e =>
          e.id === escalationId
            ? { ...e, status: "acknowledged" as const, acknowledgedBy: by, acknowledgedAt: now }
            : e
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit, getNavigatorDisplayName])

  /**
   * open|acknowledged -> resolved (forward-only). Resolving straight from
   * open stamps the acknowledgment with the resolver as well.
   */
  const resolveEscalation = useCallback((escalationId: string, by: string, resolutionNote: string) => {
    setState(prev => {
      const escalation = prev.escalations.find(e => e.id === escalationId)
      if (!escalation || escalation.status === "resolved") return prev

      const now = new Date().toISOString()
      const patient = prev.patients.find(p => p.id === escalation.patientId)
      const auditEntry = makeAudit(by, getNavigatorDisplayName(by), "supervisor", "escalation_resolved",
        `Escalation for ${patient?.name ?? escalation.patientId} resolved: ${resolutionNote}`,
        "escalation", escalationId)

      return {
        ...prev,
        escalations: prev.escalations.map(e =>
          e.id === escalationId
            ? {
                ...e,
                status: "resolved" as const,
                acknowledgedBy: e.acknowledgedBy ?? by,
                acknowledgedAt: e.acknowledgedAt ?? now,
                resolvedBy: by,
                resolvedAt: now,
                resolutionNote,
              }
            : e
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit, getNavigatorDisplayName])

  // ============================================================================
  // NAVIGATOR ONBOARDING (Gellert ops blitz — playbook §10 training)
  // ============================================================================

  /**
   * Set a milestone's status. Completing "certification" bumps a
   * developmental record to "certified" and ramps unitsTargetPhase 16 -> 18.
   */
  const updateOnboardingMilestone = useCallback((
    navigatorId: string,
    key: OnboardingMilestoneKey,
    status: "pending" | "in_progress" | "completed",
    note?: string
  ) => {
    setState(prev => {
      const record = prev.navigatorOnboarding.find(r => r.navigatorId === navigatorId)
      const milestone = record?.milestones.find(m => m.key === key)
      if (!record || !milestone || milestone.status === status) return prev

      const today = new Date().toISOString().slice(0, 10)
      const certifying = key === "certification" && status === "completed" && record.status === "developmental"
      const updatedRecord: NavigatorOnboarding = {
        ...record,
        milestones: record.milestones.map(m =>
          m.key === key
            ? { ...m, status, completedAt: status === "completed" ? today : undefined, note: note ?? m.note }
            : m
        ),
        status: certifying ? "certified" : record.status,
        unitsTargetPhase: certifying ? 18 : record.unitsTargetPhase,
      }

      const navigatorName = getNavigatorDisplayName(navigatorId)
      const auditEntries: AuditLog[] = status === "completed"
        ? [makeAudit(navigatorId, navigatorName, "supervisor", "onboarding_milestone_completed",
            `${milestone.label} completed for ${navigatorName}${certifying ? " — Certified Health Navigator (+$2,500); units target ramps to 18/day" : ""}`,
            "navigator_onboarding", navigatorId)]
        : []

      return {
        ...prev,
        navigatorOnboarding: prev.navigatorOnboarding.map(r => (r.navigatorId === navigatorId ? updatedRecord : r)),
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }
    })
  }, [makeAudit, getNavigatorDisplayName])

  /** Toggle one Weeks-2-4 shadowing checklist item. */
  const toggleShadowItem = useCallback((navigatorId: string, key: string) => {
    setState(prev => ({
      ...prev,
      navigatorOnboarding: prev.navigatorOnboarding.map(r =>
        r.navigatorId === navigatorId
          ? { ...r, shadowChecklist: r.shadowChecklist.map(i => (i.key === key ? { ...i, done: !i.done } : i)) }
          : r
      ),
    }))
  }, [])

  // ============================================================================
  // NOTE TEMPLATES (Gellert ops blitz — template editor CRUD)
  // ============================================================================

  /** Upsert a note template by id; newly created templates get isCustom: true. */
  const saveNoteTemplate = useCallback((template: NoteTemplate) => {
    setState(prev => {
      const exists = prev.noteTemplates.some(t => t.id === template.id)
      return {
        ...prev,
        noteTemplates: exists
          ? prev.noteTemplates.map(t => (t.id === template.id ? { ...t, ...template } : t))
          : [...prev.noteTemplates, { ...template, isCustom: true }],
      }
    })
  }, [])

  /**
   * Delete a template unless any existing note references it (in-use guard).
   * Returns true when deleted.
   */
  const deleteNoteTemplate = useCallback((templateId: string): boolean => {
    if (!noteTemplates.some(t => t.id === templateId)) return false
    if (notes.some(n => n.templateId === templateId)) return false
    setState(prev => ({
      ...prev,
      noteTemplates: prev.noteTemplates.filter(t => t.id !== templateId),
    }))
    return true
  }, [noteTemplates, notes])

  /**
   * Ingest a referral from an external source (HL7 adapter / simulated feed)
   */
  const ingestReferral = useCallback((referral: Referral) => {
    const auditEntry: AuditLog = {
      id: generateId(),
      userId: "system:hl7",
      userName: "Referral Ingestion",
      userRole: "supervisor",
      action: "referral_ingested",
      timestamp: new Date().toISOString(),
      details: `Referral for ${referral.patientName} received from ${referral.source}`,
      entityType: "referral",
      entityId: referral.id,
    }
    setState(prev => ({
      ...prev,
      referrals: [referral, ...prev.referrals],
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
  }, [])

  // ============================================================================
  // DIRECT MESSAGING OPERATIONS
  // ============================================================================

  const sendMessage = useCallback((
    senderId: string,
    senderName: string,
    senderRole: UserRole,
    receiverId: string,
    receiverName: string,
    receiverRole: UserRole,
    content: string,
    type: Message["type"] = "direct",
    patientId?: string,
    patientName?: string
  ) => {
    const newMessage: Message = {
      id: generateId(),
      senderId,
      senderName,
      senderRole,
      receiverId,
      receiverName,
      receiverRole,
      content,
      timestamp: new Date().toISOString(),
      readStatus: false,
      type,
      patientId,
      patientName
    }
    setState(prev => ({ ...prev, directMessages: [...prev.directMessages, newMessage] }))
  }, [])

  const getMessagesForUser = useCallback((userId: string) => {
    return directMessages
      .filter(m => m.senderId === userId || m.receiverId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [directMessages])

  const getThreadMessages = useCallback((userId1: string, userId2: string) => {
    return directMessages
      .filter(
        m =>
          (m.senderId === userId1 && m.receiverId === userId2) ||
          (m.senderId === userId2 && m.receiverId === userId1)
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [directMessages])

  const getUnreadCount = useCallback((userId: string) => {
    return directMessages.filter(m => m.receiverId === userId && !m.readStatus).length
  }, [directMessages])

  const markDirectMessageRead = useCallback((messageId: string) => {
    setState(prev => ({
      ...prev,
      directMessages: prev.directMessages.map(m =>
        m.id === messageId ? { ...m, readStatus: true } : m
      )
    }))
  }, [])

  const markThreadAsRead = useCallback((userId: string, partnerId: string) => {
    setState(prev => ({
      ...prev,
      directMessages: prev.directMessages.map(m =>
        // Nudges keep their unread state until explicitly acted on (dismissed
        // on the dashboard or opened via View Patient) — merely opening a chat
        // thread must not clear an un-actioned clinical nudge.
        m.senderId === partnerId && m.receiverId === userId && m.type !== "nudge"
          ? { ...m, readStatus: true }
          : m
      )
    }))
  }, [])

  // ============================================================================
  // NAVIGATOR ASSIGNMENT
  // ============================================================================

  const assignNavigator = useCallback((patientId: string, navigatorId: string) => {
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      if (!patient) return prev

      const oldNavigatorId = patient.assignedNavigator

      return {
        ...prev,
        patients: prev.patients.map(p => 
          p.id === patientId ? { ...p, assignedNavigator: navigatorId } : p
        ),
        navigators: prev.navigators.map(nav => {
          if (nav.id === oldNavigatorId) {
            return { ...nav, patientCount: Math.max(0, nav.patientCount - 1) }
          }
          if (nav.id === navigatorId) {
            return { ...nav, patientCount: nav.patientCount + 1 }
          }
          return nav
        })
      }
    })
  }, [])

  // ============================================================================
  // APPOINTMENT OPERATIONS
  // ============================================================================

  const scheduleAppointment = useCallback((
    patientId: string,
    date: string,
    time: string,
    type: Appointment["type"],
    navigatorId: string,
    appointmentNotes?: string,
    encounterType?: EncounterType
  ): Appointment => {
    const newAppointment: Appointment = {
      id: generateId(),
      patientId,
      navigatorId,
      date,
      time,
      type,
      encounterType,
      status: "scheduled",
      notes: appointmentNotes
    }
    
    setState(prev => ({
      ...prev,
      appointments: [...prev.appointments, newAppointment],
      patients: syncAppointmentToPatient(prev.patients, newAppointment)
    }))

    return newAppointment
  }, [])

  const cancelAppointment = useCallback((patientId: string, appointmentId: string) => {
    setState(prev => ({
      ...prev,
      appointments: prev.appointments.map(apt => 
        apt.id === appointmentId ? { ...apt, status: "cancelled" as const } : apt
      ),
      patients: prev.patients.map(patient => {
        if (patient.id === patientId) {
          return {
            ...patient,
            upcomingAppointments: patient.upcomingAppointments.map(apt => 
              apt.id === appointmentId ? { ...apt, status: "cancelled" as const } : apt
            )
          }
        }
        return patient
      })
    }))
  }, [])

  const completeAppointment = useCallback((patientId: string, appointmentId: string) => {
    setState(prev => ({
      ...prev,
      appointments: prev.appointments.map(apt => 
        apt.id === appointmentId ? { ...apt, status: "completed" as const } : apt
      ),
      patients: prev.patients.map(patient => {
        if (patient.id === patientId) {
          return {
            ...patient,
            upcomingAppointments: patient.upcomingAppointments.map(apt => 
              apt.id === appointmentId ? { ...apt, status: "completed" as const } : apt
            ),
            lastContactDate: new Date().toISOString().split('T')[0]
          }
        }
        return patient
      })
    }))
  }, [])

  const updateAppointment = useCallback((appointmentId: string, updates: Partial<Appointment>) => {
    setState(prev => {
      const appointment = prev.appointments.find(apt => apt.id === appointmentId)
      if (!appointment) return prev

      const updatedAppointment = { ...appointment, ...updates }

      return {
        ...prev,
        appointments: prev.appointments.map(apt => 
          apt.id === appointmentId ? updatedAppointment : apt
        ),
        patients: syncAppointmentToPatient(prev.patients, updatedAppointment)
      }
    })
  }, [])

  const getAppointmentsByNavigator = useCallback((navigatorId: string) => {
    return appointments.filter(apt => apt.navigatorId === navigatorId)
  }, [appointments])

  const getAppointmentsByDate = useCallback((date: string) => {
    return appointments.filter(apt => apt.date === date && apt.status === "scheduled")
  }, [appointments])

  const getAppointmentsByPatient = useCallback((patientId: string) => {
    return appointments.filter(apt => apt.patientId === patientId)
  }, [appointments])

  // ============================================================================
  // EVV (Electronic Visit Verification) OPERATIONS - Phase 4
  // ============================================================================

  /**
   * Check in to an appointment - captures timestamp and GPS location
   * Updates status to "in_progress"
   */
  const checkInAppointment = useCallback((
    appointmentId: string,
    location?: { lat: number; lng: number }
  ) => {
    const checkInTime = new Date().toISOString()
    // Default to a simulated Phoenix-area location if not provided
    const evvLocation = location || { lat: 33.4484, lng: -112.0740 }

    setState(prev => ({
      ...prev,
      appointments: prev.appointments.map(apt =>
        apt.id === appointmentId
          ? { ...apt, status: "in_progress" as const, checkInTime, evvLocation }
          : apt
      ),
      patients: prev.patients.map(patient => ({
        ...patient,
        upcomingAppointments: patient.upcomingAppointments.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: "in_progress" as const, checkInTime, evvLocation }
            : apt
        )
      }))
    }))
  }, [])

  /**
   * Check out of an appointment - captures checkout timestamp
   * Updates status to "completed" and generates billing unit
   */
  const checkOutAppointment = useCallback((appointmentId: string) => {
    const checkOutTime = new Date().toISOString()

    setState(prev => {
      const appointment = prev.appointments.find(apt => apt.id === appointmentId)
      if (!appointment) return prev

      // Update navigator's MTD units (billing unit generated)
      const navigatorId = appointment.navigatorId

      return {
        ...prev,
        appointments: prev.appointments.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: "completed" as const, checkOutTime }
            : apt
        ),
        patients: prev.patients.map(patient => {
          if (patient.id === appointment.patientId) {
            return {
              ...patient,
              upcomingAppointments: patient.upcomingAppointments.map(apt =>
                apt.id === appointmentId
                  ? { ...apt, status: "completed" as const, checkOutTime }
                  : apt
              ),
              lastContactDate: new Date().toISOString().split('T')[0]
            }
          }
          return patient
        }),
        navigators: prev.navigators.map(nav =>
          nav.id === navigatorId
            ? { ...nav, mtdUnits: nav.mtdUnits + 1 }
            : nav
        )
      }
    })
  }, [])

  // ============================================================================
  // ADVERSE EVENT OPERATIONS
  // ============================================================================

  const addAdverseEvent = useCallback((
    patientId: string, 
    type: AdverseEvent["type"], 
    diagnosis: string
  ) => {
    const newEvent: AdverseEvent = {
      id: generateId(),
      patientId,
      type,
      diagnosis,
      startDate: new Date().toISOString().split('T')[0],
      status: "monitoring",
      rightCareFlag: false,
      followUpStatus: "pending"
    }
    
    setState(prev => {
      const patient = prev.patients.find(p => p.id === patientId)
      
      return {
        ...prev,
        adverseEvents: [...prev.adverseEvents, newEvent],
        navigators: patient 
          ? prev.navigators.map(nav => {
              if (nav.id === patient.assignedNavigator) {
                return { ...nav, adverseEventCount: nav.adverseEventCount + 1 }
              }
              return nav
            })
          : prev.navigators
      }
    })
  }, [])

  const updateAdverseEventStatus = useCallback((eventId: string, status: AdverseEvent["status"]) => {
    setState(prev => ({
      ...prev,
      adverseEvents: prev.adverseEvents.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            status,
            endDate: status === "ended" ? new Date().toISOString().split('T')[0] : event.endDate
          }
        }
        return event
      })
    }))
  }, [])

  // ============================================================================
  // CARE PLAN OPERATIONS (Phase 3)
  // ============================================================================

  /**
   * Get active care plan for a patient
   */
  const getPatientCarePlan = useCallback((patientId: string) => {
    return getCarePlanByPatient(carePlans, patientId)
  }, [carePlans])

  /**
   * Apply a care template to a patient, creating a new care plan
   */
  const applyCareTemplate = useCallback((patientId: string, templateId: string): CarePlan | null => {
    const template = careTemplates.find(t => t.id === templateId)
    if (!template) return null

    // Check if patient already has an active care plan
    const existingPlan = carePlans.find(cp => cp.patientId === patientId && cp.status === "active")

    const newCarePlan = createCarePlanFromTemplate(template, patientId)
    const navigator = navigators.find(n => {
      const patient = patients.find(p => p.id === patientId)
      return patient && n.id === patient.assignedNavigator
    })

    // Create a note documenting the care plan assignment
    const planNote: PatientNote = {
      id: generateId(),
      patientId,
      authorId: navigator?.id || "system",
      authorName: navigator?.name || "System",
      authorRole: "navigator",
      content: `Care plan "${template.name}" applied. Goals: ${template.goals.map(g => g.description).join(", ")}.`,
      type: "clinical",
      createdAt: new Date().toISOString()
    }

    setState(prev => ({
      ...prev,
      carePlans: existingPlan
        ? prev.carePlans.map(cp =>
            cp.id === existingPlan.id
              ? { ...cp, status: "completed" as const }
              : cp
          ).concat(newCarePlan)
        : [...prev.carePlans, newCarePlan],
      notes: [planNote, ...prev.notes]
    }))

    return newCarePlan
  }, [careTemplates, carePlans, navigators, patients])

  /**
   * Log a metric value for a specific goal
   */
  const logGoalMetric = useCallback((
    patientId: string,
    goalId: string,
    value: number,
    navigatorId: string
  ) => {
    setState(prev => {
      const carePlan = prev.carePlans.find(cp => cp.patientId === patientId && cp.status === "active")
      if (!carePlan) return prev

      const updatedCarePlan = addGoalDataPoint(carePlan, goalId, value, navigatorId)

      return {
        ...prev,
        carePlans: prev.carePlans.map(cp =>
          cp.id === carePlan.id ? updatedCarePlan : cp
        )
      }
    })
  }, [])

  // ============================================================================
  // GOVERNANCE & ADMIN OPERATIONS (Phase 5)
  // ============================================================================

  /**
   * Log an activity to the audit log
   */
  const logActivity = useCallback((
    userId: string,
    userName: string,
    userRole: UserRole,
    action: AuditAction,
    details?: string,
    entityType?: string,
    entityId?: string
  ) => {
    const newLog: AuditLog = {
      id: generateId(),
      userId,
      userName,
      userRole,
      action,
      timestamp: new Date().toISOString(),
      details,
      entityType,
      entityId,
    }

    setState(prev => ({
      ...prev,
      auditLogs: [newLog, ...prev.auditLogs],
    }))
  }, [])

  /**
   * Update a payer (rate card / identity) and log the change
   */
  const updatePayer = useCallback((
    payerId: string,
    updates: Partial<Payer>,
    userId: string,
    userName: string
  ) => {
    setState(prev => {
      const existing = prev.payers.find(p => p.id === payerId)
      if (!existing) return prev

      const details =
        updates.ratePerUnit !== undefined && updates.ratePerUnit !== existing.ratePerUnit
          ? `Updated ${existing.name} rate from $${existing.ratePerUnit.toFixed(2)} to $${updates.ratePerUnit.toFixed(2)}`
          : `Updated ${existing.name} payer settings`

      const auditEntry: AuditLog = {
        id: generateId(),
        userId,
        userName,
        userRole: "admin",
        action: "payer_updated",
        timestamp: new Date().toISOString(),
        details,
        entityType: "payer",
        entityId: payerId,
      }

      return {
        ...prev,
        payers: prev.payers.map(p =>
          p.id === payerId
            ? { ...p, ...updates, lastUpdated: new Date().toISOString(), updatedBy: userId }
            : p
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [])

  /**
   * Add a remark code (CARC/RARC) to the dictionary
   */
  const addRemarkCode = useCallback((
    code: Omit<RemarkCode, "id" | "lastUpdated">,
    userId: string,
    userName: string
  ) => {
    const newCode: RemarkCode = {
      ...code,
      id: `${code.type.toLowerCase()}-${code.code.toLowerCase()}-${generateId()}`,
      lastUpdated: new Date().toISOString(),
      updatedBy: userId,
    }
    const auditEntry: AuditLog = {
      id: generateId(),
      userId,
      userName,
      userRole: "admin",
      action: "remark_code_updated",
      timestamp: new Date().toISOString(),
      details: `Added ${code.type} code ${code.code}`,
      entityType: "remark_code",
      entityId: newCode.id,
    }
    setState(prev => ({
      ...prev,
      remarkCodes: [...prev.remarkCodes, newCode],
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
  }, [])

  /**
   * Update a remark code description
   */
  const updateRemarkCode = useCallback((
    id: string,
    updates: Partial<RemarkCode>,
    userId: string,
    userName: string
  ) => {
    setState(prev => {
      const existing = prev.remarkCodes.find(c => c.id === id)
      if (!existing) return prev
      const auditEntry: AuditLog = {
        id: generateId(),
        userId,
        userName,
        userRole: "admin",
        action: "remark_code_updated",
        timestamp: new Date().toISOString(),
        details: `Updated ${existing.type} code ${existing.code}`,
        entityType: "remark_code",
        entityId: id,
      }
      return {
        ...prev,
        remarkCodes: prev.remarkCodes.map(c =>
          c.id === id ? { ...c, ...updates, lastUpdated: new Date().toISOString(), updatedBy: userId } : c
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [])

  /**
   * Update organization / billing-provider settings
   */
  const updateOrganizationSettings = useCallback((
    updates: Partial<OrganizationSettings>,
    userId: string,
    userName: string
  ) => {
    const auditEntry: AuditLog = {
      id: generateId(),
      userId,
      userName,
      userRole: "admin",
      action: "org_settings_updated",
      timestamp: new Date().toISOString(),
      details: "Updated organization / billing provider settings",
      entityType: "organization_settings",
    }
    setState(prev => ({
      ...prev,
      organizationSettings: {
        ...prev.organizationSettings,
        ...updates,
        lastUpdated: new Date().toISOString(),
        updatedBy: userId,
      },
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
  }, [])

  /**
   * Calculate dynamic revenue based on completed appointments and payer rates.
   * Resolves the patient's payer by explicit FK first; name matching only as a
   * legacy fallback. Unresolvable payers contribute $0 (honest, surfaced in UI)
   * instead of a silent default.
   */
  const calculateDynamicRevenue = useCallback(() => {
    const completedAppointments = appointments.filter(apt => apt.status === "completed")

    let totalRevenue = 0

    completedAppointments.forEach(apt => {
      const patient = patients.find(p => p.id === apt.patientId)
      if (!patient) return

      const payer = getPayerForPatient(payers, patient)
      totalRevenue += payer?.ratePerUnit ?? 0
    })

    return totalRevenue
  }, [appointments, patients, payers])

  // ============================================================================
  // CLAIM LIFECYCLE (Revenue Cycle)
  // ============================================================================

  /**
   * Persist immutable ClaimRecord snapshots for exported claims.
   * File download happens in the component; this records the export.
   */
  const exportClaims = useCallback((
    claims: BillableClaim[],
    format: "CSV" | "837P",
    by: string
  ): ClaimRecord[] => {
    const payerConfig = getPayerConfig(state.activePayerConfigId)
    const newRecords = createClaimRecords(claims, payers, payerConfig, format, by, claimRecords)

    const auditEntry: AuditLog = {
      id: generateId(),
      userId: by,
      userName: getNavigatorDisplayName(by),
      userRole: "biller",
      action: "claim_exported",
      timestamp: new Date().toISOString(),
      details: `Exported ${newRecords.length} claim(s) as ${format}`,
      entityType: "claim_record",
    }

    setState(prev => ({
      ...prev,
      claimRecords: [...prev.claimRecords, ...newRecords],
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))

    return newRecords
  }, [state.activePayerConfigId, payers, claimRecords, getNavigatorDisplayName])

  /**
   * Transition a persisted claim record. Returns false (no-op) on an
   * illegal transition.
   */
  const updateClaimStatus = useCallback((
    claimRecordId: string,
    next: ClaimRecordStatus,
    by: string,
    note?: string
  ): boolean => {
    const record = claimRecords.find(r => r.id === claimRecordId)
    if (!record) return false

    const transitioned = transitionClaimRecord(record, next, by, note)
    if (!transitioned) return false

    const auditEntry: AuditLog = {
      id: generateId(),
      userId: by,
      userName: by.startsWith("system:") ? by : getNavigatorDisplayName(by),
      userRole: "biller",
      action: "claim_status_changed",
      timestamp: new Date().toISOString(),
      details: `Claim ${record.snapshot.patientName} ${record.snapshot.month}: ${record.status} -> ${next}${note ? ` (${note})` : ""}`,
      entityType: "claim_record",
      entityId: claimRecordId,
    }

    setState(prev => ({
      ...prev,
      claimRecords: prev.claimRecords.map(r => (r.id === claimRecordId ? transitioned : r)),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
    return true
  }, [claimRecords, getNavigatorDisplayName])

  /**
   * Void a record so its patient-month returns to the derived working tabs
   * for correction and rebill. Allowed for REJECTED/DENIED (adjudication came
   * back negative) and EXPORTED (file generated but not yet transmitted —
   * e.g. new time was logged after the export froze the snapshot).
   * SUBMITTED/ACCEPTED records are with the payer and must adjudicate first.
   */
  const reopenClaimRecord = useCallback((claimRecordId: string, by: string) => {
    setState(prev => {
      const record = prev.claimRecords.find(r => r.id === claimRecordId)
      if (!record || !["REJECTED", "DENIED", "EXPORTED"].includes(record.status)) return prev

      const auditEntry: AuditLog = {
        id: generateId(),
        userId: by,
        userName: by,
        userRole: "biller",
        action: "claim_status_changed",
        timestamp: new Date().toISOString(),
        details: `Claim ${record.snapshot.patientName} ${record.snapshot.month} reopened for rebill (record voided)`,
        entityType: "claim_record",
        entityId: claimRecordId,
      }

      return {
        ...prev,
        claimRecords: prev.claimRecords.map(r =>
          r.id === claimRecordId ? { ...r, voided: true } : r
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [])

  /**
   * Apply matched 835 remittance results: set PAID/DENIED with remittance
   * details. Records still in EXPORTED are auto-bumped through SUBMITTED with
   * a system note so history stays truthful.
   *
   * Transitions are computed BEFORE setState so the returned counts reflect
   * what actually posted — re-importing an 835 against already-adjudicated
   * records reports 0 applied, never a false success.
   */
  const applyRemittance = useCallback((
    application: RemittanceApplication,
    by: string
  ): { applied: number; pended: number; unmatched: number } => {
    const updatedById = new Map<string, ClaimRecord>()
    const auditEntries: AuditLog[] = []
    let applied = 0
    let pended = 0

    for (const match of application.matches) {
      const record = claimRecords.find(r => r.id === match.claimRecordId)
      if (!record) continue

      let working = record
      // Walk the record forward through any legal intermediate states
      if (working.status === "EXPORTED") {
        working = transitionClaimRecord(working, "SUBMITTED", "system:835", "Inferred from remittance") ?? working
      }
      if (working.status === "SUBMITTED") {
        working = transitionClaimRecord(working, "ACCEPTED", "system:835", "Inferred from remittance") ?? working
      }

      // DAP guardrail: unknown remark codes PEND the remittance for biller
      // review instead of misposting (e.g. UHC's +1% CARC 144 / N807 incentive
      // posting as a denial). The record advances only to ACCEPTED.
      const unknownCodes = findUnknownCodes(match.remittance, remarkCodes)
      if (unknownCodes.length > 0) {
        if (working.status !== "ACCEPTED") continue // already adjudicated
        pended++
        updatedById.set(record.id, {
          ...working,
          statusHistory: [
            ...working.statusHistory,
            {
              status: "ACCEPTED" as const,
              at: new Date().toISOString(),
              by: "system:835",
              note: `Remittance pended — unknown remark code(s): ${unknownCodes.join(", ")}`,
            },
          ],
          pendedRemittance: {
            remittance: match.remittance,
            resolvedStatus: match.resolvedStatus,
            unknownCodes,
            pendedAt: new Date().toISOString(),
          },
        })
        auditEntries.push({
          id: generateId(),
          userId: by,
          userName: by,
          userRole: "biller",
          action: "remittance_pended",
          timestamp: new Date().toISOString(),
          details: `Remittance for ${record.snapshot.patientName} ${record.snapshot.month} pended — unknown remark code(s): ${unknownCodes.join(", ")}`,
          entityType: "claim_record",
          entityId: record.id,
        })
        continue
      }

      const final = transitionClaimRecord(working, match.resolvedStatus, "system:835")
      if (!final) continue

      applied++
      updatedById.set(record.id, { ...final, remittance: match.remittance })
    }

    const skipped = application.matches.length - applied - pended
    auditEntries.push({
      id: generateId(),
      userId: by,
      userName: by,
      userRole: "biller",
      action: "remittance_imported",
      timestamp: new Date().toISOString(),
      details: `835 remittance: ${applied} applied, ${pended} pended, ${application.unmatchedCount} unmatched${skipped > 0 ? `, ${skipped} skipped (already adjudicated)` : ""}`,
      entityType: "claim_record",
    })

    setState(prev => ({
      ...prev,
      claimRecords: prev.claimRecords.map(record => updatedById.get(record.id) ?? record),
      auditLogs: [...auditEntries, ...prev.auditLogs],
    }))

    return { applied, pended, unmatched: application.unmatchedCount }
  }, [claimRecords, remarkCodes])

  /**
   * Re-check every pended remittance against the (updated) remark-code
   * dictionary. Fully-classified pends post to their resolved status with the
   * held remittance attached; the pend flag clears.
   */
  const reprocessPendedRemittances = useCallback((by: string): { reprocessed: number; stillPended: number } => {
    let reprocessed = 0
    let stillPended = 0
    const updatedById = new Map<string, ClaimRecord>()
    const auditEntries: AuditLog[] = []

    for (const record of claimRecords) {
      if (!record.pendedRemittance || record.voided) continue
      const unknownCodes = findUnknownCodes(record.pendedRemittance.remittance, remarkCodes)
      if (unknownCodes.length > 0) {
        stillPended++
        continue
      }
      const final = transitionClaimRecord(
        record,
        record.pendedRemittance.resolvedStatus,
        "system:835",
        "Reprocessed after remark-code classification"
      )
      if (!final) {
        stillPended++
        continue
      }
      reprocessed++
      updatedById.set(record.id, {
        ...final,
        remittance: record.pendedRemittance.remittance,
        pendedRemittance: undefined,
      })
      auditEntries.push({
        id: generateId(),
        userId: by,
        userName: by,
        userRole: "biller",
        action: "remittance_reprocessed",
        timestamp: new Date().toISOString(),
        details: `Pended remittance for ${record.snapshot.patientName} ${record.snapshot.month} posted as ${record.pendedRemittance.resolvedStatus} after code classification`,
        entityType: "claim_record",
        entityId: record.id,
      })
    }

    if (updatedById.size > 0) {
      setState(prev => ({
        ...prev,
        claimRecords: prev.claimRecords.map(record => updatedById.get(record.id) ?? record),
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }))
    }

    return { reprocessed, stillPended }
  }, [claimRecords, remarkCodes])

  // ============================================================================
  // GELLERT BILLING MODE (charge slips / day-close, denial work queue)
  // ============================================================================

  /**
   * Sign (persist) a charge slip — the navigator's attestation over a derived
   * patient-day. Idempotent per navigator-patient-day; timeLogIds freeze at
   * signing.
   */
  const signChargeSlip = useCallback((
    slip: Omit<ChargeSlip, "signedAt" | "signedBy">,
    byId: string,
    byName: string
  ) => {
    setState(prev => {
      const id = chargeSlipId(slip.navigatorId, slip.patientId, slip.date)
      const alreadySigned = prev.chargeSlips.some(
        s => chargeSlipId(s.navigatorId, s.patientId, s.date) === id && s.signedAt
      )
      if (alreadySigned) return prev

      const signed: ChargeSlip = {
        ...slip,
        id,
        signedAt: new Date().toISOString(),
        signedBy: byId,
      }
      const auditEntry = makeAudit(byId, byName, "navigator", "charge_slip_signed",
        `Charge slip signed: ${slip.date}, patient ${slip.patientId}, ${slip.totalMinutes} min = ${slip.units} unit(s) ${slip.code}`,
        "charge_slip", id)

      return {
        ...prev,
        chargeSlips: [...prev.chargeSlips, signed],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  /** Sign every remaining slip for the day ("Sign & Submit Day"). Returns count signed. */
  const signAllChargeSlips = useCallback((
    slips: Array<Omit<ChargeSlip, "signedAt" | "signedBy">>,
    byId: string,
    byName: string
  ): number => {
    let signedCount = 0
    setState(prev => {
      const now = new Date().toISOString()
      const newSlips: ChargeSlip[] = []
      const auditEntries: AuditLog[] = []

      for (const slip of slips) {
        const id = chargeSlipId(slip.navigatorId, slip.patientId, slip.date)
        const alreadySigned =
          prev.chargeSlips.some(s => chargeSlipId(s.navigatorId, s.patientId, s.date) === id && s.signedAt) ||
          newSlips.some(s => s.id === id)
        if (alreadySigned) continue
        newSlips.push({ ...slip, id, signedAt: now, signedBy: byId })
        auditEntries.push(makeAudit(byId, byName, "navigator", "charge_slip_signed",
          `Charge slip signed: ${slip.date}, patient ${slip.patientId}, ${slip.totalMinutes} min = ${slip.units} unit(s) ${slip.code}`,
          "charge_slip", id))
      }
      signedCount = newSlips.length
      if (newSlips.length === 0) return prev

      return {
        ...prev,
        chargeSlips: [...prev.chargeSlips, ...newSlips],
        auditLogs: [...auditEntries, ...prev.auditLogs],
      }
    })
    return signedCount
  }, [makeAudit])

  /** Denial work queue: set the biller-facing work status on a claim record. */
  const setClaimWorkStatus = useCallback((
    claimRecordId: string,
    workStatus: ClaimWorkStatus,
    by: string
  ) => {
    setState(prev => {
      const record = prev.claimRecords.find(r => r.id === claimRecordId)
      if (!record || record.workStatus === workStatus) return prev
      const auditEntry = makeAudit(by, by, "biller", "denial_work_status_changed",
        `Denial work status for ${record.snapshot.patientName} ${record.snapshot.month}: ${record.workStatus ?? "new"} -> ${workStatus}`,
        "claim_record", claimRecordId)
      return {
        ...prev,
        claimRecords: prev.claimRecords.map(r => (r.id === claimRecordId ? { ...r, workStatus } : r)),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit])

  // ============================================================================
  // GELLERT NOTE SYSTEM (provider directory + standing patient facts)
  // ============================================================================

  /** Providers linked to a patient (Patient.providerIds -> directory) */
  const getProvidersForPatient = useCallback((patientId: string): Provider[] => {
    const patient = patients.find(p => p.id === patientId)
    if (!patient?.providerIds?.length) return []
    return providers.filter(prov => patient.providerIds!.includes(prov.id))
  }, [patients, providers])

  const getStandingFacts = useCallback((patientId: string): StandingPatientFacts | undefined => {
    return standingFacts.find(f => f.patientId === patientId)
  }, [standingFacts])

  /** Upsert standing patient facts (durable chart memory for auto-fill) */
  const updateStandingFacts = useCallback((
    patientId: string,
    updates: Partial<Omit<StandingPatientFacts, "patientId" | "updatedAt" | "updatedBy">>,
    byId: string
  ) => {
    setState(prev => {
      const existing = prev.standingFacts.find(f => f.patientId === patientId)
      const now = new Date().toISOString()
      const next: StandingPatientFacts = existing
        ? { ...existing, ...updates, updatedAt: now, updatedBy: byId }
        : { patientId, ...updates, updatedAt: now, updatedBy: byId }
      const auditEntry = makeAudit(byId, getNavigatorDisplayName(byId), "navigator", "note_updated",
        `Standing patient facts updated for ${prev.patients.find(p => p.id === patientId)?.name ?? patientId}`,
        "standing_facts", patientId)
      return {
        ...prev,
        standingFacts: existing
          ? prev.standingFacts.map(f => (f.patientId === patientId ? next : f))
          : [...prev.standingFacts, next],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [makeAudit, getNavigatorDisplayName])

  /**
   * Post a manual payment or denial against an accepted claim, persisting the
   * dollar amount as real remittance data (not just note text) so the Paid
   * column, detail panel, and Paid metrics all reflect it.
   */
  const recordManualPayment = useCallback((
    claimRecordId: string,
    outcome: "PAID" | "DENIED",
    amount: number,
    by: string,
    carcCode?: string
  ): boolean => {
    const record = claimRecords.find(r => r.id === claimRecordId)
    if (!record) return false

    const note = outcome === "PAID"
      ? `Manual payment $${amount.toFixed(2)}${carcCode ? ` (CARC ${carcCode})` : ""}`
      : `Manual denial${carcCode ? ` (CARC ${carcCode})` : ""}`
    const transitioned = transitionClaimRecord(record, outcome, by, note)
    if (!transitioned) return false

    const remittance: NonNullable<ClaimRecord["remittance"]> = {
      paidAmount: outcome === "PAID" ? amount : 0,
      chargedAmount: record.billedAmount,
      patientResponsibility: 0,
      carcCodes: carcCode ? [carcCode] : [],
      rarcCodes: [],
      remitDate: new Date().toISOString().slice(0, 10),
      checkOrEftNumber: "MANUAL",
    }

    const auditEntry: AuditLog = {
      id: generateId(),
      userId: by,
      userName: by.startsWith("system:") ? by : getNavigatorDisplayName(by),
      userRole: "biller",
      action: "claim_status_changed",
      timestamp: new Date().toISOString(),
      details: `Claim ${record.snapshot.patientName} ${record.snapshot.month}: ${note}`,
      entityType: "claim_record",
      entityId: claimRecordId,
    }

    setState(prev => ({
      ...prev,
      claimRecords: prev.claimRecords.map(r =>
        r.id === claimRecordId ? { ...transitioned, remittance } : r
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
    return true
  }, [claimRecords, getNavigatorDisplayName])

  /**
   * Submit a batch of exported claims via a clearinghouse adapter.
   * EXPORTED -> SUBMITTED immediately; ACCEPTED/REJECTED per adapter result.
   */
  const submitClaimBatch = useCallback(async (
    claimRecordIds: string[],
    adapter: ClearinghouseAdapter,
    fileContent: string,
    fileName: string,
    by: string
  ): Promise<SubmissionResult> => {
    // Compute the SUBMITTED batch once, up front: the same transitioned
    // snapshots go to both the state update and the adapter, so the
    // clearinghouse never sees stale pre-SUBMITTED statuses and every
    // requested id is guaranteed to reach the adapter.
    const batchById = new Map<string, ClaimRecord>()
    for (const record of claimRecords) {
      if (!claimRecordIds.includes(record.id)) continue
      const submitted = record.status === "EXPORTED"
        ? transitionClaimRecord(record, "SUBMITTED", by, `Via ${adapter.name}`) ?? record
        : record
      batchById.set(record.id, submitted)
    }
    const batchRecords = [...batchById.values()]

    // Phase 1: mark submitted
    setState(prev => ({
      ...prev,
      claimRecords: prev.claimRecords.map(r => batchById.get(r.id) ?? r),
    }))

    const result = await adapter.submit({ fileName, content: fileContent, claimRecords: batchRecords })

    // Phase 2: apply adapter verdicts
    setState(prev => ({
      ...prev,
      claimRecords: prev.claimRecords.map(r => {
        if (result.accepted.includes(r.id) && r.status === "SUBMITTED") {
          return { ...(transitionClaimRecord(r, "ACCEPTED", "system:clearinghouse") ?? r), clearinghouseBatchId: result.clearinghouseBatchId }
        }
        const rejection = result.rejected.find(rej => rej.claimRecordId === r.id)
        if (rejection && r.status === "SUBMITTED") {
          return { ...(transitionClaimRecord(r, "REJECTED", "system:clearinghouse", rejection.reason) ?? r), clearinghouseBatchId: result.clearinghouseBatchId }
        }
        return r
      }),
    }))

    return result
  }, [claimRecords])

  // ============================================================================
  // NOTE DRAFTS (AI Scribe transcript resilience)
  // ============================================================================

  /**
   * Upsert a note draft, keyed by (patientId, templateId)
   */
  const saveNoteDraft = useCallback((draft: Omit<NoteDraft, "id"> & { id?: string }): NoteDraft => {
    const existing = noteDrafts.find(
      d => d.patientId === draft.patientId && d.templateId === draft.templateId
    )
    const saved: NoteDraft = {
      ...draft,
      id: draft.id ?? existing?.id ?? generateId(),
      updatedAt: new Date().toISOString(),
    }
    setState(prev => ({
      ...prev,
      noteDrafts: existing
        ? prev.noteDrafts.map(d => (d.id === saved.id ? saved : d))
        : [...prev.noteDrafts, saved],
    }))
    return saved
  }, [noteDrafts])

  const getNoteDraft = useCallback((patientId: string, templateId: string) => {
    return noteDrafts.find(d => d.patientId === patientId && d.templateId === templateId)
  }, [noteDrafts])

  const deleteNoteDraft = useCallback((draftId: string) => {
    setState(prev => ({
      ...prev,
      noteDrafts: prev.noteDrafts.filter(d => d.id !== draftId),
    }))
  }, [])

  // ============================================================================
  // SCHEDULING (shifts & dual-track events - all mutations through context)
  // ============================================================================

  const addShift = useCallback((shift: Omit<NavigatorShift, "id" | "createdAt" | "updatedAt">): NavigatorShift => {
    const now = new Date().toISOString()
    const newShift: NavigatorShift = { ...shift, id: generateId(), createdAt: now, updatedAt: now }
    setState(prev => ({ ...prev, navigatorShifts: [...prev.navigatorShifts, newShift] }))
    return newShift
  }, [])

  const updateShift = useCallback((shiftId: string, updates: Partial<NavigatorShift>) => {
    setState(prev => ({
      ...prev,
      navigatorShifts: prev.navigatorShifts.map(s =>
        s.id === shiftId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      ),
    }))
  }, [])

  const addScheduleEvent = useCallback((event: Omit<ScheduleEvent, "id">): ScheduleEvent => {
    const patient = patients.find(p => p.id === event.patientId)
    const newEvent: ScheduleEvent = {
      ...event,
      // Default the safety flag from patient risk when the caller didn't decide
      isHighSafetyRisk: event.isHighSafetyRisk ?? patient?.riskLevel === 3,
      id: generateId(),
    }
    setState(prev => ({ ...prev, scheduleEvents: [...prev.scheduleEvents, newEvent] }))
    return newEvent
  }, [patients])

  const updateScheduleEvent = useCallback((eventId: string, updates: Partial<ScheduleEvent>) => {
    setState(prev => ({
      ...prev,
      scheduleEvents: prev.scheduleEvents.map(e =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    }))
  }, [])

  // ============================================================================
  // SOS (navigator safety)
  // ============================================================================

  const triggerSOS = useCallback((navigatorId: string, location?: GeoPoint) => {
    const loc = navigatorLocations.find(l => l.navigatorId === navigatorId)
    const name = getNavigatorDisplayName(navigatorId)
    const point = location ?? (loc ? { lat: loc.lat, lng: loc.lng } : { lat: 33.4484, lng: -112.074 })

    const sos: SOSEvent = {
      id: generateId(),
      navigatorId,
      navigatorName: name,
      triggeredAt: new Date().toISOString(),
      lat: point.lat,
      lng: point.lng,
      status: "ACTIVE",
    }
    const auditEntry: AuditLog = {
      id: generateId(),
      userId: navigatorId,
      userName: name,
      userRole: "navigator",
      action: "sos_triggered",
      timestamp: sos.triggeredAt,
      details: `SOS triggered at ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
      entityType: "sos_event",
      entityId: sos.id,
    }
    setState(prev => ({
      ...prev,
      sosEvents: [sos, ...prev.sosEvents],
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))
  }, [navigatorLocations, getNavigatorDisplayName])

  const acknowledgeSOS = useCallback((sosId: string, byName: string) => {
    setState(prev => {
      const sos = prev.sosEvents.find(s => s.id === sosId)
      if (!sos || sos.status !== "ACTIVE") return prev
      const auditEntry: AuditLog = {
        id: generateId(),
        userId: byName,
        userName: byName,
        userRole: "supervisor",
        action: "sos_acknowledged",
        timestamp: new Date().toISOString(),
        details: `SOS from ${sos.navigatorName} acknowledged`,
        entityType: "sos_event",
        entityId: sosId,
      }
      return {
        ...prev,
        sosEvents: prev.sosEvents.map(s =>
          s.id === sosId
            ? { ...s, status: "ACKNOWLEDGED" as const, acknowledgedBy: byName, acknowledgedAt: new Date().toISOString() }
            : s
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [])

  const resolveSOS = useCallback((sosId: string) => {
    setState(prev => {
      const sos = prev.sosEvents.find(s => s.id === sosId)
      if (!sos || sos.status === "RESOLVED") return prev
      const auditEntry: AuditLog = {
        id: generateId(),
        userId: sos.acknowledgedBy ?? "supervisor",
        userName: sos.acknowledgedBy ?? "Supervisor",
        userRole: "supervisor",
        action: "sos_resolved",
        timestamp: new Date().toISOString(),
        details: `SOS from ${sos.navigatorName} resolved`,
        entityType: "sos_event",
        entityId: sosId,
      }
      return {
        ...prev,
        sosEvents: prev.sosEvents.map(s =>
          s.id === sosId ? { ...s, status: "RESOLVED" as const, resolvedAt: new Date().toISOString() } : s
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [])

  // ============================================================================
  // DYNAMIC NARRATIVE ENGINE (Phase 6)
  // ============================================================================

  /**
   * Get a note template by ID
   */
  const getNoteTemplate = useCallback((templateId: string) => {
    return noteTemplates.find(t => t.id === templateId)
  }, [noteTemplates])

  /**
   * Generate a narrative string from template and responses.
   * Optional context resolves Gellert "provider" fields into their full
   * display string ("Dr. Jane Smith at Desert Family Medicine, 4045 W Main
   * St, Phoenix, AZ 85004") — pass state providers wherever this is called.
   */
  const generateNarrative = useCallback((
    template: NoteTemplate,
    responses: Record<string, unknown>,
    context?: { providers?: Provider[] }
  ): string => {
    const parts: string[] = []

    template.fields.forEach(field => {
      const value = responses[field.id]
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        return // Skip empty values
      }
      // Fields hidden by an unmet showIf gate contribute nothing
      if (field.showIf && responses[field.showIf.fieldId] !== field.showIf.equals) {
        return
      }

      let narrativePart = ""

      // Handle different field types
      switch (field.type) {
        case "select":
        case "text":
        case "textarea":
        case "time":
          narrativePart = `${field.narrativePrefix || ""}${value}${field.narrativeSuffix || ""}`
          break

        case "provider": {
          const provider = context?.providers?.find(p => p.id === value)
          const display = provider
            ? `${provider.name}${provider.credential ? `, ${provider.credential}` : ""} at ${provider.practiceName}, ${provider.address.street}, ${provider.address.city}, ${provider.address.state} ${provider.address.zip}`
            : String(value)
          narrativePart = `${field.narrativePrefix || ""}${display}${field.narrativeSuffix || ""}`
          break
        }

        case "attestation":
          // Attestations insert the manual's exact language, verbatim, only when true
          if (value === true && field.attestationText) {
            narrativePart = `${field.narrativePrefix || ""}${field.attestationText}${field.narrativeSuffix || ""}`
          }
          break

        case "multi-select":
          if (Array.isArray(value) && value.length > 0) {
            const joiner = field.narrativeJoiner || ", "
            const joined = value.join(joiner)
            narrativePart = `${field.narrativePrefix || ""}${joined}${field.narrativeSuffix || ""}`
          }
          break

        case "boolean":
          // Prefix-less booleans are pure gates (e.g. transport-provided) and
          // contribute no narrative of their own
          if (value === true && field.narrativePrefix) {
            narrativePart = `${field.narrativePrefix}reviewed and discussed${field.narrativeSuffix || ""}`
          } else if (value === false && field.narrativePrefix) {
            // For supervisor notified field, handle the false case
            if (field.id === "supervisor-notified") {
              narrativePart = `${field.narrativePrefix}was not notified${field.narrativeSuffix || ""}`
            } else {
              narrativePart = `${field.narrativePrefix}not reviewed${field.narrativeSuffix || ""}`
            }
          }
          break

        case "time-duration":
          if (typeof value === "number" && value > 0) {
            narrativePart = `${field.narrativePrefix || ""}${value}${field.narrativeSuffix || ""}`
          }
          break
      }

      if (narrativePart) {
        parts.push(narrativePart)
      }
    })

    return parts.join("")
  }, [])

  /**
   * Create a new note from a template with structured responses
   * Supports manual narrative override via _manualNarrative in responses
   * Now includes audit-proof time tracking fields
   */
  const addNoteFromTemplate = useCallback((
    patientId: string,
    templateId: string,
    responses: Record<string, unknown>,
    authorId: string,
    authorName: string,
    authorRole: UserRole,
    duration?: number,
    timeData?: {
      startTime?: string
      endTime?: string
      timeLogId?: string
      timeSource?: "timer" | "manual" | "edited"
    },
    noteMeta?: {
      linkedNoteId?: string
      carriesDayTotal?: boolean
      billable?: boolean
      appointmentId?: string
      subjectNavigatorId?: string
    }
  ): PatientNote => {
    const template = noteTemplates.find(t => t.id === templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    // Check for manual narrative override
    const manualNarrative = responses._manualNarrative as string | undefined

    // Use manual narrative if provided, otherwise generate from responses
    // (providers passed so Gellert "provider" fields render display strings)
    const narrative = manualNarrative || generateNarrative(template, responses, { providers })

    // Remove the _manualNarrative from stored responses (it's internal)
    const { _manualNarrative, ...cleanResponses } = responses

    const newNote: PatientNote = {
      id: generateId(),
      patientId,
      authorId,
      authorName,
      authorRole,
      content: narrative,
      type: template.noteType,
      createdAt: new Date().toISOString(),
      templateId,
      templateName: template.name,
      responses: cleanResponses,
      duration,
      // Audit-proof time tracking fields
      startTime: timeData?.startTime,
      endTime: timeData?.endTime,
      timeLogId: timeData?.timeLogId,
      timeSource: timeData?.timeSource,
      // Gellert note system (same-day model + supervision notes)
      linkedNoteId: noteMeta?.linkedNoteId,
      carriesDayTotal: noteMeta?.carriesDayTotal,
      billable: noteMeta?.billable ?? template.billable,
      appointmentId: noteMeta?.appointmentId,
      subjectNavigatorId: noteMeta?.subjectNavigatorId,
    }

    const auditEntry = makeAudit(authorId, authorName, authorRole, "note_created",
      `${template.name} note created${noteMeta?.linkedNoteId ? " (same-day continuation)" : ""}`,
      "note", newNote.id)

    setState(prev => ({
      ...prev,
      notes: [newNote, ...prev.notes],
      patients: prev.patients.map(p =>
        p.id === patientId
          ? { ...p, lastContactDate: new Date().toISOString().split("T")[0] }
          : p
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))

    return newNote
  }, [noteTemplates, generateNarrative, providers, makeAudit])

  // ============================================================================
  // CMS BILLING & INTAKE (Phase 2.1/2.2)
  // ============================================================================

  /**
   * Create a new intake record for a patient
   */
  const createIntakeRecord = useCallback((
    intake: Omit<IntakeRecord, "id">
  ): IntakeRecord => {
    const newIntake: IntakeRecord = {
      ...intake,
      id: generateId(),
    }

    setState(prev => ({
      ...prev,
      intakeRecords: [...prev.intakeRecords, newIntake],
      // Update patient risk level based on acuity (one chain: acuity -> tier)
      patients: prev.patients.map(p => {
        if (p.id === intake.patientId) {
          return {
            ...p,
            riskLevel: acuityLevelToRiskLevel(intake.acuity.level),
            riskScore: Math.round((intake.acuity.totalScore / 12) * 100),
            billingTrack: intake.serviceType,
          }
        }
        return p
      }),
    }))

    return newIntake
  }, [])

  /**
   * Get intake record for a patient
   */
  const getPatientIntake = useCallback((patientId: string): IntakeRecord | undefined => {
    return intakeRecords.find(r => r.patientId === patientId)
  }, [intakeRecords])

  /**
   * Add a time log entry for a patient
   */
  const addTimeLog = useCallback((
    timeLog: Omit<TimeLog, "id">
  ): TimeLog => {
    const newTimeLog: TimeLog = {
      ...timeLog,
      id: generateId(),
    }

    setState(prev => ({
      ...prev,
      timeLogs: [...prev.timeLogs, newTimeLog],
    }))

    return newTimeLog
  }, [])

  /**
   * Get time logs for a patient
   */
  const getPatientTimeLogs = useCallback((patientId: string): TimeLog[] => {
    return timeLogs.filter(log => log.patientId === patientId)
  }, [timeLogs])

  // ============================================================================
  // PAYER-AGNOSTIC BILLING (Phase 2.2)
  // ============================================================================

  /**
   * Set the active payer configuration for billing
   */
  const setActivePayerConfig = useCallback((configId: string) => {
    setState(prev => ({
      ...prev,
      activePayerConfigId: configId,
    }))
  }, [])

  /**
   * Get the active payer configuration object
   */
  const activePayerConfig = getPayerConfig(state.activePayerConfigId)

  /**
   * Get all available payer configurations
   */
  const availablePayerConfigs = getAllPayerConfigs()

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getPatient = useCallback((patientId: string) => {
    return patients.find(p => p.id === patientId)
  }, [patients])

  const getNavigator = useCallback((navigatorId: string) => {
    return navigators.find(n => n.id === navigatorId)
  }, [navigators])

  const getPatientsByNavigator = useCallback((navigatorId: string) => {
    return patients.filter(p => p.assignedNavigator === navigatorId)
  }, [patients])

  const updatePatient = useCallback((patientId: string, updates: Partial<Patient>) => {
    setState(prev => ({
      ...prev,
      patients: prev.patients.map(p =>
        p.id === patientId ? { ...p, ...updates } : p
      )
    }))
  }, [])

  // ============================================================================
  // NAVIGATOR SAFETY MAP
  // ============================================================================

  const updateNavigatorLocation = useCallback((
    navigatorId: string,
    lat: number,
    lng: number,
    opts?: {
      status?: SafetyStatus
      currentTask?: string
      currentPatientId?: string
      touchCheckIn?: boolean
      speed?: number
      batteryLevel?: number
    }
  ) => {
    // touchCheckIn defaults true (a real check-in). The movement simulator
    // passes false so pure position updates don't reset check-in age —
    // otherwise stale-check-in alerts would self-heal while pins move.
    const touchCheckIn = opts?.touchCheckIn ?? true

    setState(prev => ({
      ...prev,
      navigatorLocations: prev.navigatorLocations.map(loc =>
        loc.navigatorId === navigatorId
          ? {
              ...loc,
              lat,
              lng,
              lastCheckIn: touchCheckIn ? new Date().toISOString() : loc.lastCheckIn,
              status: opts?.status ?? loc.status,
              currentTask: opts?.currentTask !== undefined ? opts.currentTask : loc.currentTask,
              currentPatientId: opts?.currentPatientId !== undefined ? opts.currentPatientId : loc.currentPatientId,
              speed: opts?.speed !== undefined ? opts.speed : loc.speed,
              batteryLevel: opts?.batteryLevel !== undefined ? opts.batteryLevel : loc.batteryLevel,
            }
          : loc
      )
    }))
  }, [])

  const getNavigatorLocations = useCallback(() => {
    return navigatorLocations
  }, [navigatorLocations])

  // ============================================================================
  // RESET
  // ============================================================================

  const resetDemo = useCallback(() => {
    clearPersistedState()
    setState(createInitialState())
  }, [])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DemoDataContext.Provider value={{
      // State
      patients,
      notes,
      navigators,
      users,
      supervisors,
      adverseEvents,
      referrals,
      directMessages,
      appointments,
      careTemplates,
      carePlans,
      payers,
      remarkCodes,
      organizationSettings,
      claimRecords,
      auditLogs,
      noteTemplates,
      noteDrafts,
      scheduleEvents,
      navigatorShifts,
      timeOffRequests,
      sosEvents,
      journeyEvents,
      providers,
      standingFacts,
      chargeSlips,
      zones,
      navigatorTasks,
      patientDocuments,
      medReconciliations,
      escalations,
      providerCommunications,
      navigatorOnboarding,
      signedContractPatientIds,
      lastAssignedPatientId,
      isHydrated,

      // Identity selectors
      getUser,
      getSupervisor,
      getTeamNavigators,
      getNavigatorsWithAttributes,
      getNavigatorDisplayName,

      // Note operations
      addNote,
      getPatientNotes,

      // Referral operations
      getPendingReferrals,
      getLastAssignedPatient,
      ingestReferral,

      // Referral pipeline (Gellert WorkFlow2025)
      completeEligibilityCheck,
      logOutreachAttempt,
      scheduleIntakeVisit,
      confirmDecisionCapacity,
      notifyReferringProvider,

      // Gellert ops blitz: tasks / documents / meds / escalations / onboarding / templates
      generateDueTasks,
      generateAdverseEventTasks,
      completeTask,
      dismissTask,
      savePatientDocument,
      completePatientDocument,
      signPatientDocument,
      updatePatientMedications,
      recordMedReconciliation,
      raiseEscalation,
      acknowledgeEscalation,
      resolveEscalation,
      updateOnboardingMilestone,
      toggleShadowItem,
      saveNoteTemplate,
      deleteNoteTemplate,

      // Journey actions (post-conversion)
      updateIntakeChecklistItem,
      completeIntakeVisit,
      recordIntakeNoShow,
      flagGraduationReadiness,
      confirmGraduation,
      recordTelenavCheckIn,
      reengagePatient,
      exitProgram,

      // Intake & Assessment (Phase 2)
      acceptReferral,
      submitAssessment,

      // Nudges (unified messaging)
      sendNudge,
      getNudgesForNavigator,

      // Direct messaging operations
      sendMessage,
      getMessagesForUser,
      getThreadMessages,
      getUnreadCount,
      markDirectMessageRead,
      markThreadAsRead,

      // Navigator assignment
      assignNavigator,

      // Appointment operations
      scheduleAppointment,
      cancelAppointment,
      completeAppointment,
      updateAppointment,
      getAppointmentsByNavigator,
      getAppointmentsByDate,
      getAppointmentsByPatient,

      // EVV operations (Phase 4)
      checkInAppointment,
      checkOutAppointment,

      // Adverse event operations
      addAdverseEvent,
      updateAdverseEventStatus,

      // Care plan operations (Phase 3)
      getPatientCarePlan,
      applyCareTemplate,
      logGoalMetric,

      // Governance & Admin (Phase 5)
      updatePayer,
      addRemarkCode,
      updateRemarkCode,
      updateOrganizationSettings,
      logActivity,
      calculateDynamicRevenue,

      // Claim lifecycle (Revenue Cycle)
      exportClaims,
      updateClaimStatus,
      reopenClaimRecord,
      applyRemittance,
      recordManualPayment,
      submitClaimBatch,

      // Gellert billing mode
      signChargeSlip,
      signAllChargeSlips,
      setClaimWorkStatus,
      reprocessPendedRemittances,

      // Gellert note system
      getProvidersForPatient,
      getStandingFacts,
      updateStandingFacts,

      // Note drafts (AI Scribe)
      saveNoteDraft,
      getNoteDraft,
      deleteNoteDraft,

      // Scheduling
      addShift,
      updateShift,
      addScheduleEvent,
      updateScheduleEvent,

      // SOS
      triggerSOS,
      acknowledgeSOS,
      resolveSOS,

      // Dynamic Narrative Engine (Phase 6)
      getNoteTemplate,
      generateNarrative,
      addNoteFromTemplate,

      // CMS Billing & Intake (Phase 2.1/2.2)
      zCodes,
      intakeRecords,
      timeLogs,
      createIntakeRecord,
      getPatientIntake,
      addTimeLog,
      getPatientTimeLogs,

      // Payer-Agnostic Billing (Phase 2.2)
      activePayerConfigId: state.activePayerConfigId,
      activePayerConfig,
      availablePayerConfigs,
      setActivePayerConfig,

      // Navigator Safety Map
      navigatorLocations,
      updateNavigatorLocation,
      getNavigatorLocations,

      // Utility
      getPatient,
      getNavigator,
      getPatientsByNavigator,
      updatePatient,

      // Reset
      resetDemo
    }}>
      {children}
    </DemoDataContext.Provider>
  )
}

// ============================================================================
// HOOKS
// ============================================================================

export function useDemoData() {
  const context = useContext(DemoDataContext)
  if (context === undefined) {
    throw new Error("useDemoData must be used within a DemoDataProvider")
  }
  return context
}
