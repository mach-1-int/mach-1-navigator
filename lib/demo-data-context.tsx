"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Patient, PatientNote, Appointment, Navigator, AdverseEvent, Referral, SupervisorMessage, Message, UserRole, RiskAssessmentData, CareTemplate, CarePlan, PayerRate, AuditLog, AuditAction, NoteTemplate, NoteDraft, TemplateField, IntakeRecord, ZCode, TimeLog, ServiceType, AcuityScore, PayerConfig } from "./types"
import { getPayerConfig, getAllPayerConfigs } from "./payer-config"
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
import { initialNavigators } from "./initial-data"

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface DemoDataContextType {
  // State
  patients: Patient[]
  notes: PatientNote[]
  navigators: Navigator[]
  adverseEvents: AdverseEvent[]
  referrals: Referral[]
  messages: SupervisorMessage[]
  directMessages: Message[]
  appointments: Appointment[]
  careTemplates: CareTemplate[]
  carePlans: CarePlan[]
  payerRates: PayerRate[]
  auditLogs: AuditLog[]
  noteTemplates: NoteTemplate[]
  noteDrafts: NoteDraft[]
  lastAssignedPatientId: string | null
  isHydrated: boolean

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

  // Messages/Nudges (Legacy)
  sendNudge: (toNavigatorId: string, patientId: string, patientName: string, content: string, supervisorId: string, supervisorName: string) => void
  getNavigatorMessages: (navigatorId: string) => SupervisorMessage[]
  markMessageRead: (messageId: string) => void

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
  updatePayerRate: (payerId: string, newRate: number, userId: string, userName: string) => void
  logActivity: (userId: string, userName: string, userRole: UserRole, action: AuditAction, details?: string, entityType?: string, entityId?: string) => void
  calculateDynamicRevenue: () => number

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
    setState(savedState)
    setIsHydrated(true)
  }, [])

  // Persist to localStorage on state changes (after hydration)
  useEffect(() => {
    if (isHydrated) {
      saveState(state)
    }
  }, [state, isHydrated])

  // Destructure state for easier access
  const { patients, notes, navigators, adverseEvents, referrals, messages, directMessages, appointments, careTemplates, carePlans, payerRates, auditLogs, noteTemplates, noteDrafts, zCodes, intakeRecords, timeLogs, lastAssignedPatientId } = state

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
      riskLevel: referral.riskScore,
      survivalStatus: "active",
      assignedNavigator: navigatorId,
      assignedSupervisor: "sup1",
      healthPlan: referral.healthPlan,
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
          ? { ...r, status: "accepted" as const, assignedNavigator: navigatorId }
          : r
      ),
      navigators: prev.navigators.map(nav =>
        nav.id === navigatorId
          ? { ...nav, patientCount: nav.patientCount + 1 }
          : nav
      )
    }))
  }, [referrals, navigators])

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

    // Create patient with validated/edited data from the intake form
    const newPatient: Patient = {
      id: newPatientId,
      name: patientData.name || referral.patientName,
      dob: patientData.dob || referral.dob,
      chartNumber: patientData.chartNumber || `GH-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
      riskLevel: patientData.riskLevel || referral.riskScore,
      survivalStatus: "active",
      assignedNavigator: navigatorId,
      assignedSupervisor: patientData.assignedSupervisor || "sup1",
      healthPlan: patientData.healthPlan || referral.healthPlan,
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
          ? { ...r, status: "accepted" as const, assignedNavigator: navigatorId }
          : r
      ),
      navigators: prev.navigators.map(nav =>
        nav.id === navigatorId
          ? { ...nav, patientCount: nav.patientCount + 1 }
          : nav
      )
    }))

    return { ...newPatient, upcomingAppointments: [initialAppointment] }
  }, [referrals, navigators])

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
    supervisorId: string,
    supervisorName: string
  ) => {
    // Legacy SupervisorMessage for backwards compatibility
    const newSupervisorMessage: SupervisorMessage = {
      id: generateId(),
      fromSupervisorId: supervisorId,
      fromSupervisorName: supervisorName,
      toNavigatorId,
      patientId,
      patientName,
      content,
      type: "nudge",
      createdAt: new Date().toISOString(),
      read: false
    }

    // Also create a unified Message record
    const navigator = navigators.find(n => n.id === toNavigatorId)
    const newDirectMessage: Message = {
      id: generateId(),
      senderId: supervisorId,
      senderName: supervisorName,
      senderRole: "supervisor",
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
      messages: [newSupervisorMessage, ...prev.messages],
      directMessages: [...prev.directMessages, newDirectMessage]
    }))
  }, [navigators])

  const getNavigatorMessages = useCallback((navigatorId: string) => {
    return messages.filter(m => m.toNavigatorId === navigatorId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [messages])

  const markMessageRead = useCallback((messageId: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === messageId ? { ...m, read: true } : m
      )
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
        m.senderId === partnerId && m.receiverId === userId
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
   * Update a payer rate and log the change
   */
  const updatePayerRate = useCallback((
    payerId: string,
    newRate: number,
    userId: string,
    userName: string
  ) => {
    setState(prev => {
      const existingRate = prev.payerRates.find(r => r.id === payerId)
      const oldRate = existingRate?.ratePerUnit || 0

      // Create audit log entry
      const auditEntry: AuditLog = {
        id: generateId(),
        userId,
        userName,
        userRole: "admin",
        action: "payer_rate_updated",
        timestamp: new Date().toISOString(),
        details: `Updated ${existingRate?.payerName} rate from $${oldRate.toFixed(2)} to $${newRate.toFixed(2)}`,
        entityType: "payer_rate",
        entityId: payerId,
      }

      return {
        ...prev,
        payerRates: prev.payerRates.map(rate =>
          rate.id === payerId
            ? { ...rate, ratePerUnit: newRate, lastUpdated: new Date().toISOString(), updatedBy: userId }
            : rate
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }
    })
  }, [])

  /**
   * Calculate dynamic revenue based on completed appointments and payer rates
   * Revenue = Sum(CompletedVisits * PayerRate for matching health plan)
   */
  const calculateDynamicRevenue = useCallback(() => {
    // Get completed appointments
    const completedAppointments = appointments.filter(apt => apt.status === "completed")

    let totalRevenue = 0

    completedAppointments.forEach(apt => {
      // Find the patient's health plan
      const patient = patients.find(p => p.id === apt.patientId)
      if (!patient) return

      // Find matching payer rate
      const payerRate = payerRates.find(rate =>
        patient.healthPlan.toLowerCase().includes(rate.payerName.toLowerCase()) ||
        rate.payerName.toLowerCase().includes(patient.healthPlan.toLowerCase())
      )

      // Use the payer rate or default to $150
      const ratePerUnit = payerRate?.ratePerUnit || 150
      totalRevenue += ratePerUnit
    })

    return totalRevenue
  }, [appointments, patients, payerRates])

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
      // Update patient risk level based on acuity
      patients: prev.patients.map(p => {
        if (p.id === intake.patientId) {
          const newRiskLevel = intake.acuity.level === "High" ? 3 : intake.acuity.level === "Moderate" ? 2 : 1
          return {
            ...p,
            riskLevel: newRiskLevel as 1 | 2 | 3,
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
      adverseEvents,
      referrals,
      messages,
      directMessages,
      appointments,
      careTemplates,
      carePlans,
      payerRates,
      auditLogs,
      noteTemplates,
      noteDrafts,
      lastAssignedPatientId,
      isHydrated,

      // Note operations
      addNote,
      getPatientNotes,

      // Referral operations
      getPendingReferrals,
      assignReferral,
      getLastAssignedPatient,

      // Intake & Assessment (Phase 2)
      acceptReferral,
      rejectReferral,
      submitAssessment,

      // Message operations (legacy nudges)
      sendNudge,
      getNavigatorMessages,
      markMessageRead,

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
      updatePayerRate,
      logActivity,
      calculateDynamicRevenue,

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

// Alias for cleaner naming
export const useStore = useDemoData
