"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Patient, PatientNote, Appointment, Navigator, User, Supervisor, NavigatorAttributes, AdverseEvent, Referral, Message, UserRole, RiskAssessmentData, CareTemplate, CarePlan, Payer, RemarkCode, OrganizationSettings, AuditLog, AuditAction, NoteTemplate, NoteDraft, TemplateField, IntakeRecord, ZCode, TimeLog, ServiceType, AcuityScore, PayerConfig, NavigatorLocation, SafetyStatus, BillableClaim, ClaimRecord, ClaimRecordStatus, SOSEvent, GeoPoint, ScheduleEvent, NavigatorShift, TimeOffRequest } from "./types"
import { getPayerConfig, getAllPayerConfigs, resolvePayerByName, getPayerForPatient } from "./payer-config"
import { acuityLevelToRiskLevel, lineToRiskLevel } from "./acuity"
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

  // Referrals
  getPendingReferrals: () => Referral[]
  assignReferral: (referralId: string, navigatorId: string) => void
  getLastAssignedPatient: () => Patient | null

  // Intake & Assessment (Phase 2)
  acceptReferral: (referralId: string, patientData: Partial<Patient>, navigatorId: string) => Patient | null
  rejectReferral: (referralId: string) => void
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
  scheduleAppointment: (patientId: string, date: string, time: string, type: Appointment["type"], navigatorId: string, notes?: string) => Appointment
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
  applyRemittance: (application: RemittanceApplication, by: string) => { applied: number; unmatched: number }
  recordManualPayment: (claimRecordId: string, outcome: "PAID" | "DENIED", amount: number, by: string, carcCode?: string) => boolean
  submitClaimBatch: (claimRecordIds: string[], adapter: ClearinghouseAdapter, fileContent: string, fileName: string, by: string) => Promise<SubmissionResult>

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
  generateNarrative: (template: NoteTemplate, responses: Record<string, unknown>) => string
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
  const { patients, notes, navigators, users, supervisors, adverseEvents, referrals, directMessages, appointments, careTemplates, carePlans, payers, remarkCodes, organizationSettings, claimRecords, auditLogs, noteTemplates, noteDrafts, zCodes, intakeRecords, timeLogs, scheduleEvents, navigatorShifts, timeOffRequests, navigatorLocations, sosEvents, lastAssignedPatientId } = state

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

  const getPendingReferrals = useCallback(() => {
    return referrals.filter(ref => ref.status === "pending")
  }, [referrals])

  const getLastAssignedPatient = useCallback(() => {
    if (!lastAssignedPatientId) return null
    return patients.find(p => p.id === lastAssignedPatientId) || null
  }, [lastAssignedPatientId, patients])

  const assignReferral = useCallback((referralId: string, navigatorId: string) => {
    const referral = referrals.find(r => r.id === referralId)
    if (!referral) return

    const newPatientId = `pt-${generateId()}`
    const initialAppointmentId = generateId()

    // Resolve payer identity at the data boundary (the ONE fuzzy-match point)
    const payer = resolvePayerByName(payers, referral.rawData?.IN1?.payerName || referral.healthPlan)

    // Create initial appointment
    const initialAppointment: Appointment = {
      id: initialAppointmentId,
      patientId: newPatientId,
      navigatorId: navigatorId,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: "10:00 AM",
      type: "home_visit",
      status: "scheduled",
      notes: "Initial home visit for new patient enrollment"
    }

    // Create a full patient record from the referral
    const newPatient: Patient = {
      id: newPatientId,
      name: referral.patientName,
      dob: referral.dob,
      chartNumber: `C${Math.floor(Math.random() * 90000) + 10000}`,
      riskLevel: lineToRiskLevel(referral.requiredAcuity),
      survivalStatus: "active",
      assignedNavigator: navigatorId,
      assignedSupervisor: "sup1",
      healthPlan: referral.healthPlan,
      payerId: payer?.id,
      memberId: referral.rawData?.IN1?.memberId,
      enrollmentDate: new Date().toISOString().split('T')[0],
      lastContactDate: new Date().toISOString().split('T')[0],
      medicationCompliance: 0,
      pcpCompliance: false,
      upcomingAppointments: [initialAppointment],
      medications: referral.diagnosis.includes("Diabetes") ? [
        { id: generateId(), name: "Metformin", dosage: "500mg", frequency: "twice daily", nextRefillDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], compliance: true }
      ] : referral.diagnosis.includes("Hypertension") ? [
        { id: generateId(), name: "Lisinopril", dosage: "10mg", frequency: "once daily", nextRefillDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], compliance: true }
      ] : [
        { id: generateId(), name: "Aspirin", dosage: "81mg", frequency: "once daily", nextRefillDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], compliance: true }
      ],
      adverseEvents: []
    }

    // Create initial note
    const navigator = navigators.find(n => n.id === navigatorId)
    const initialNote: PatientNote = {
      id: generateId(),
      patientId: newPatientId,
      authorId: navigatorId,
      authorName: navigator?.name || "Navigator",
      authorRole: "navigator",
      content: `Patient enrolled from ${referral.referralSource} referral. Diagnosis: ${referral.diagnosis}. Initial home visit scheduled.`,
      type: "clinical",
      createdAt: new Date().toISOString()
    }

    setState(prev => ({
      ...prev,
      patients: [...prev.patients, newPatient],
      appointments: [...prev.appointments, initialAppointment],
      notes: [initialNote, ...prev.notes],
      lastAssignedPatientId: newPatientId,
      referrals: prev.referrals.map(r =>
        r.id === referralId
          ? { ...r, status: "accepted" as const, assignedNavigator: navigatorId, acceptedAt: new Date().toISOString() }
          : r
      ),
      navigators: prev.navigators.map(nav =>
        nav.id === navigatorId
          ? { ...nav, patientCount: nav.patientCount + 1 }
          : nav
      )
    }))
  }, [referrals, navigators, payers])

  // ============================================================================
  // INTAKE & ASSESSMENT OPERATIONS (Phase 2)
  // ============================================================================

  /**
   * Accept a referral and create a new patient record
   * This allows the supervisor to edit/validate the data before creating the patient
   */
  const acceptReferral = useCallback((
    referralId: string,
    patientData: Partial<Patient>,
    navigatorId: string
  ): Patient | null => {
    const referral = referrals.find(r => r.id === referralId)
    if (!referral || referral.status !== "pending") return null

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

    // Create initial home visit appointment
    const initialAppointment: Appointment = {
      id: generateId(),
      patientId: newPatientId,
      navigatorId: navigatorId,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: "10:00",
      type: "home_visit",
      status: "scheduled",
      notes: "Initial home visit - Risk assessment required"
    }

    setState(prev => ({
      ...prev,
      patients: [...prev.patients, newPatient],
      appointments: [...prev.appointments, initialAppointment],
      notes: [initialNote, ...prev.notes],
      lastAssignedPatientId: newPatientId,
      referrals: prev.referrals.map(r =>
        r.id === referralId
          ? { ...r, status: "accepted" as const, assignedNavigator: navigatorId, acceptedAt: new Date().toISOString() }
          : r
      ),
      navigators: prev.navigators.map(nav =>
        nav.id === navigatorId
          ? { ...nav, patientCount: nav.patientCount + 1 }
          : nav
      )
    }))

    return { ...newPatient, upcomingAppointments: [initialAppointment] }
  }, [referrals, navigators, payers])

  /**
   * Reject a referral
   */
  const rejectReferral = useCallback((referralId: string) => {
    setState(prev => ({
      ...prev,
      referrals: prev.referrals.map(r =>
        r.id === referralId
          ? { ...r, status: "rejected" as const }
          : r
      )
    }))
  }, [])

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
    appointmentNotes?: string
  ): Appointment => {
    const newAppointment: Appointment = {
      id: generateId(),
      patientId,
      navigatorId,
      date,
      time,
      type,
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
    const newRecords = createClaimRecords({ claims, payers, payerConfig, format, by, existing: claimRecords })

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
  ): { applied: number; unmatched: number } => {
    const updatedById = new Map<string, ClaimRecord>()
    let applied = 0

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
      const final = transitionClaimRecord(working, match.resolvedStatus, "system:835")
      if (!final) continue

      applied++
      updatedById.set(record.id, { ...final, remittance: match.remittance })
    }

    const skipped = application.matches.length - applied
    const auditEntry: AuditLog = {
      id: generateId(),
      userId: by,
      userName: by,
      userRole: "biller",
      action: "remittance_imported",
      timestamp: new Date().toISOString(),
      details: `835 remittance: ${applied} applied, ${application.unmatchedCount} unmatched${skipped > 0 ? `, ${skipped} skipped (already adjudicated)` : ""}`,
      entityType: "claim_record",
    }

    setState(prev => ({
      ...prev,
      claimRecords: prev.claimRecords.map(record => updatedById.get(record.id) ?? record),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }))

    return { applied, unmatched: application.unmatchedCount }
  }, [claimRecords])

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
   * Generate a narrative string from template and responses
   */
  const generateNarrative = useCallback((
    template: NoteTemplate,
    responses: Record<string, unknown>
  ): string => {
    const parts: string[] = []

    template.fields.forEach(field => {
      const value = responses[field.id]
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        return // Skip empty values
      }

      let narrativePart = ""

      // Handle different field types
      switch (field.type) {
        case "select":
        case "text":
        case "textarea":
          narrativePart = `${field.narrativePrefix || ""}${value}${field.narrativeSuffix || ""}`
          break

        case "multi-select":
          if (Array.isArray(value) && value.length > 0) {
            const joiner = field.narrativeJoiner || ", "
            const joined = value.join(joiner)
            narrativePart = `${field.narrativePrefix || ""}${joined}${field.narrativeSuffix || ""}`
          }
          break

        case "boolean":
          if (value === true) {
            narrativePart = `${field.narrativePrefix || ""}reviewed and discussed${field.narrativeSuffix || ""}`
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
    }
  ): PatientNote => {
    const template = noteTemplates.find(t => t.id === templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    // Check for manual narrative override
    const manualNarrative = responses._manualNarrative as string | undefined

    // Use manual narrative if provided, otherwise generate from responses
    const narrative = manualNarrative || generateNarrative(template, responses)

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
    }

    setState(prev => ({
      ...prev,
      notes: [newNote, ...prev.notes],
      patients: prev.patients.map(p =>
        p.id === patientId
          ? { ...p, lastContactDate: new Date().toISOString().split("T")[0] }
          : p
      ),
    }))

    return newNote
  }, [noteTemplates, generateNarrative])

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
      assignReferral,
      getLastAssignedPatient,
      ingestReferral,

      // Intake & Assessment (Phase 2)
      acceptReferral,
      rejectReferral,
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
