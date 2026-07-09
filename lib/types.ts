export type UserRole = "executive" | "supervisor" | "navigator" | "patient" | "admin" | "biller"

/**
 * Navigator-specific attributes for matching engine
 */
export interface NavigatorAttributes {
  homeZipCode: string
  homeLat?: number // Home base coordinates for distance/routing calculations
  homeLng?: number
  serviceAreaRadius: number // in miles
  languages: string[] // e.g., ['en', 'es']
  currentCaseload: number
  maxCaseload: number
  acuityCapabilities: ('L1' | 'L2' | 'L3')[] // L3 = High Risk
  zoneId?: string // Assigned coverage zone (Gellert zones) - FK to Zone.id
}

export interface User {
  id: string
  name: string
  role: UserRole
  email: string
  phone?: string // Canonical contact number (safety map, directories resolve from here)
  avatar?: string
  // Navigator-specific attributes (only present when role === 'navigator')
  attributes?: NavigatorAttributes
}

/**
 * A geographic coordinate pair
 */
export interface GeoPoint {
  lat: number
  lng: number
}

// ============================================================================
// PATIENT JOURNEY (Gellert WorkFlow2025)
// ============================================================================

/**
 * Stored journey phase. Referral & Eligibility live on the Referral pipeline;
 * Adverse Event Response is a DERIVED overlay (lib/journey.ts), never stored.
 */
export type JourneyPhase = "intake" | "active" | "telenavigation" | "exited"

/** The five documented program-exit pathways */
export type ExitPathway = "patient_initiated" | "ineligible" | "mia" | "deceased" | "safety"

/** Program exit documentation (patient_initiated requires supervisorConfirmedBy) */
export interface ProgramExit {
  pathway: ExitPathway
  exitedAt: string
  documentedBy: string
  supervisorConfirmedBy?: string
  providerNotifiedAt?: string
  notes: string
}

/** One phase transition in a patient's journey (powers the timeline UI) */
export interface JourneyEvent {
  id: string
  patientId: string
  at: string // ISO timestamp
  fromPhase: JourneyPhase | "referral"
  toPhase: JourneyPhase
  actorId: string
  actorName: string
  reason?: string
}

export interface Patient {
  id: string
  name: string
  dob: string
  chartNumber: string
  riskLevel: 1 | 2 | 3
  riskScore?: number // 0-100 calculated risk score from assessment
  survivalStatus: "active" | "inactive"
  // Journey engine (Gellert WorkFlow2025) - required; all seeds set it
  journeyPhase: JourneyPhase
  graduation?: {
    readinessFlaggedAt: string
    readinessFlaggedBy: string
    readinessNote?: string
    confirmedAt?: string
    confirmedBy?: string
  }
  telenavigation?: {
    startedAt: string
    cadenceDays: number // 30 = monthly check-in cadence
    lastCheckInAt?: string
  }
  exit?: ProgramExit
  assignedNavigator: string
  assignedSupervisor: string
  healthPlan: string
  enrollmentDate: string
  lastContactDate: string
  medicationCompliance: number
  pcpCompliance: boolean
  upcomingAppointments: Appointment[]
  medications: Medication[]
  adverseEvents: AdverseEvent[]
  riskAssessment?: RiskAssessmentData
  // Additional fields for intake
  address?: {
    street: string
    city: string
    state: string
    zip: string
  }
  phone?: string
  email?: string
  primaryDiagnosis?: string
  icdCodes?: string[]
  referralSource?: string
  // GPS coordinates for map visualization (Phase 4)
  lat?: number
  lng?: number
  // CMS Billing Track (Phase 2.1)
  billingTrack?: ServiceType // PIN (Principal Illness Navigation) or CHI (Community Health Integration)
  // Field safety for scheduling (Command Center) - visible on calendar without clicking
  securityRisk?: "Low" | "Medium" | "High"
  // Payer identity (unified billing) - FK to Payer.id; healthPlan string kept for display/legacy
  payerId?: string
  // Real insurance member ID (replaces synthesized <PLAN>-<PATIENTID> fallback)
  memberId?: string
  // Gellert zone assignment (explicit wins over zip lookup) - FK to Zone.id
  zoneId?: string
  // Provider directory links (PCP, BH, specialists) - FKs to Provider.id
  providerIds?: string[]
}

export interface Navigator {
  id: string
  name: string
  supervisorId: string
  /** Gellert navigator level; drives units/day target (16/18/20) */
  level: 1 | 2 | 3
  monthlyUnits: number
  mtdUnits: number
  adverseEventCount: number
  cancellations: number
  medicationCompliance: number
  pcpCompliance: number
  highFivePercentage: number
  engagementScore: number
  lengthOfService: number
  patientCount: number
}

export interface Supervisor {
  id: string
  name: string
  region: string
  // Team membership is derived from Navigator.supervisorId (single source of truth)
}

export interface AdverseEvent {
  id: string
  patientId: string
  type: "fall" | "infection" | "chronic_exacerbation" | "other"
  diagnosis: string
  startDate: string
  endDate?: string
  status: "currently_inpatient" | "currently_ed" | "ended" | "monitoring"
  rightCareFlag: boolean
  followUpStatus: "pending" | "completed" | "scheduled"
}

/** One confirmation touch on an appointment (SOP 3.3 multi-touch protocol) */
export interface AppointmentConfirmation {
  window: "48h" | "24h" | "day_of"
  at: string // ISO timestamp of the touch
  by: string // navigator id
  outcome: "confirmed" | "no_answer" | "reschedule_requested"
}

export interface Appointment {
  id: string
  patientId: string
  navigatorId: string
  date: string
  time: string
  type: "home_visit" | "phone_call" | "video_call" | "clinic"
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show"
  // Gellert encounter taxonomy (pre-selects the matching note template).
  // Legacy appointments without it fall back via lib/note-taxonomy.ts.
  encounterType?: EncounterType
  notes?: string
  // EVV (Electronic Visit Verification) fields - Phase 4
  checkInTime?: string // ISO timestamp when visit started
  checkOutTime?: string // ISO timestamp when visit ended
  evvLocation?: {
    lat: number
    lng: number
  }
  // Gellert ops blitz: 48h/24h/day-of confirmation touches (SOP 3.3)
  confirmations?: AppointmentConfirmation[]
}

export interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  nextRefillDate: string
  compliance: boolean
}

// ============================================================================
// NAVIGATOR TASKS (Gellert ops blitz — SOPs 3.3/3.6/3.10, 4.1-4.6)
// ============================================================================

/**
 * Task taxonomy for the engagement engine.
 * Confirmation tasks map 1:1 to the SOP 3.3 touch windows; the four
 * adverse-event tasks encode the SOP 4.x response protocol.
 */
export type NavigatorTaskType =
  | "confirmation_48h"
  | "confirmation_24h"
  | "confirmation_day_of"
  | "no_show_recovery"
  | "post_visit_followup"
  | "post_event_contact"
  | "post_discharge_pcp"
  | "post_discharge_med_rec"
  | "risk_reduction_education"

/**
 * A dated to-do for a navigator, generated by lib/task-engine.ts (source
 * "system") or created by hand (source "manual"). Idempotency key for system
 * generation: (type, appointmentId | adverseEventId) — ids are deterministic
 * (`task-${type}-${refId}`) so regeneration can never duplicate.
 */
export interface NavigatorTask {
  id: string
  type: NavigatorTaskType
  patientId: string
  navigatorId: string
  appointmentId?: string
  adverseEventId?: string
  dueAt: string // ISO timestamp; "overdue" = open with a local due DATE before today
  status: "open" | "done" | "dismissed"
  completedAt?: string
  completedBy?: string
  outcome?: string // confirmations: "confirmed" | "no_answer" | "reschedule_requested"
  note?: string
  createdAt: string
  source: "system" | "manual"
}

// ============================================================================
// PATIENT DOCUMENTS & E-SIGN (Gellert ops blitz — SOPs 2.3/2.7, billing §4)
// ============================================================================

export type PatientDocumentType =
  | "roi"
  | "navigation_contract"
  | "intake_survey"
  | "medication_list"
  | "patient_photo"
  | "onboarding_packet"

/**
 * A patient-facing document behind an intake checklist item.
 * "signed" applies to roi + navigation_contract; the other types are
 * terminal at "completed". A signed navigation_contract is the billing gate
 * (playbook §4: nothing billable before the signed Patient Agreement).
 */
export interface PatientDocument {
  id: string
  patientId: string
  type: PatientDocumentType
  status: "not_started" | "draft" | "completed" | "signed"
  fields: Record<string, unknown>
  signature?: {
    signedByName: string
    relationship: "patient" | "guardian" | "representative"
    signedAt: string
    attestationText: string // shown verbatim at signing (demo e-sign)
  }
  photoDataUrl?: string // patient_photo capture (data URL)
  createdAt: string
  updatedAt: string
  completedBy?: string // navigator who completed/witnessed
}

// ============================================================================
// MEDICATION RECONCILIATION (Gellert ops blitz — SOPs 2.3/3.7, 4.5)
// ============================================================================

/**
 * A point-in-time reconciliation of the patient's medication list.
 * Patient.medications remains the LIVE list; each event snapshots the list
 * as it stood AFTER the reconciliation, plus the diff that produced it.
 */
export interface MedReconciliationEvent {
  id: string
  patientId: string
  at: string // ISO timestamp
  by: string // navigator id
  byName: string
  medications: Medication[] // snapshot after reconciliation
  changes: { medication: string; action: "added" | "removed" | "dose_changed" | "confirmed" }[]
  note?: string
}

// ============================================================================
// ESCALATIONS (Gellert ops blitz — field guide §1.2; distinct from SOS)
// ============================================================================

/**
 * Closed-loop escalation: navigator raises -> supervisor acknowledges ->
 * supervisor resolves. Forward-only lifecycle (no backward transitions);
 * resolving an un-acknowledged escalation stamps the acknowledgment too.
 */
export interface Escalation {
  id: string
  patientId: string
  navigatorId: string
  reason: "repeated_no_shows" | "clinical_risk" | "unresolved_sdoh" | "safety" | "other"
  description: string
  raisedAt: string
  status: "open" | "acknowledged" | "resolved"
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedBy?: string
  resolvedAt?: string
  resolutionNote?: string
}

// ============================================================================
// PROVIDER COMMUNICATIONS (Gellert ops blitz — playbook §3.3, SOPs 1.6/2.6/6.7)
// ============================================================================

/**
 * A rendered, stored referring-provider communication. Honest demo tier:
 * always simulated (no fax/Direct integration yet) — the stamp + audit flow
 * from the journey engine is preserved alongside.
 */
export interface ProviderCommunication {
  id: string
  referralId?: string
  patientId?: string
  type: "intake_notification" | "exit_notification" | "ineligible_notification" | "unreachable_notification"
  subject: string
  body: string // rendered text (see lib/provider-comms.ts)
  sentAt: string
  sentBy: string
  sentByName: string
  simulated: true
}

// ============================================================================
// NAVIGATOR ONBOARDING (Gellert ops blitz — playbook §10 training program)
// ============================================================================

export type OnboardingMilestoneKey =
  | "orientation_week1"
  | "cpss_exam"
  | "gellert_exam"
  | "shadowing"
  | "review_30"
  | "review_60"
  | "review_90"
  | "certification"

/**
 * 90-day developmental record per navigator (playbook §10.1). Certification
 * bumps status (and pay per §10: +$2,500 Certified Health Navigator).
 * unitsTargetPhase ramps 16 -> 18 as the navigator levels up.
 */
export interface NavigatorOnboarding {
  navigatorId: string
  startDate: string
  milestones: {
    key: OnboardingMilestoneKey
    label: string
    status: "pending" | "in_progress" | "completed"
    completedAt?: string
    note?: string
  }[]
  shadowChecklist: { key: string; label: string; done: boolean }[]
  status: "developmental" | "certified" | "lead"
  unitsTargetPhase: number // daily units target for the current phase (ramps 16→18)
}

export interface PatientNote {
  id: string
  patientId: string
  authorId: string
  authorName: string
  authorRole: UserRole
  content: string
  type: "clinical" | "follow-up" | "general" | "phone" | "visit" | "supervision"
  createdAt: string
  // Dynamic Narrative Engine fields (Phase 6)
  templateId?: string
  templateName?: string
  responses?: Record<string, unknown> // Structured field responses
  duration?: number // Duration in minutes
  // Audit-Proof Time Log fields
  startTime?: string // ISO timestamp - when visit started
  endTime?: string // ISO timestamp - when visit ended
  timeLogId?: string // Link to TimeLog for billing
  timeSource?: "timer" | "manual" | "edited" // How time was captured (audit trail)
  // Gellert note system (same-day multi-note model + supervision notes)
  linkedNoteId?: string // Same-day continuation -> primary note
  carriesDayTotal?: boolean // The ONE note per patient-day carrying the charge-slip total
  billable?: boolean // false for continuations/supervision (no TimeLog created)
  appointmentId?: string // Appointment this note documents
  subjectNavigatorId?: string // Supervision notes: navigator discussed
}

// ============================================================================
// DYNAMIC NARRATIVE ENGINE (Phase 6)
// ============================================================================

/**
 * Field types supported in note templates.
 * Gellert additions: "time" (canonical "3:03PM" clock string), "provider"
 * (stores a providerId, options resolved from the directory), "attestation"
 * (must-be-true checkbox emitting fixed manual language verbatim).
 */
export type NoteFieldType =
  | "select"
  | "multi-select"
  | "text"
  | "boolean"
  | "time-duration"
  | "textarea"
  | "time"
  | "provider"
  | "attestation"

/**
 * Encounter taxonomy from the Gellert Note-Taking Manual.
 * Maps appointments -> note templates (lib/note-taxonomy.ts).
 */
export type EncounterType =
  | "phone_call"
  | "medical_appointment"
  | "behavioral_health"
  | "lab_imaging"
  | "medication_assistance"
  | "sdoh"
  | "multidisciplinary"
  | "supervision"

/**
 * A single field within a note template
 */
export interface TemplateField {
  id: string
  label: string // e.g., "Intervention Type"
  type: NoteFieldType
  required: boolean
  options?: string[] // For select/multi-select fields
  placeholder?: string // Hint text for text fields
  narrativePrefix?: string // e.g., "Intervention performed included "
  narrativeSuffix?: string // e.g., "."
  narrativeJoiner?: string // For multi-select: ", " or " and "
  defaultValue?: unknown
  // Gellert manual encoding (all optional/additive)
  attestationText?: string // Exact manual language inserted verbatim when checked
  section?: string // Visual grouping: "Transit" | "Encounter" | "Wrap-Up"
  showIf?: { fieldId: string; equals: unknown } // Gates ±transit fields
  optionsSource?: "providers" | "navigators" // Dynamic options from the directory
  autoFill?: { source: "provider" | "patientFact" | "appointment" | "previousNote"; key?: string }
  neverSkip?: boolean // Manual's "never skip" elements - badged + compliance-cited
}

/**
 * A reusable note template definition
 */
export interface NoteTemplate {
  id: string
  name: string // e.g., "Standard Navigation Encounter"
  description: string
  noteType: PatientNote["type"] // Maps to existing note types
  fields: TemplateField[]
  narrativeTemplate?: string // Optional overall template with {fieldId} placeholders
  // Gellert manual encoding (all optional/additive)
  encounterTypes?: EncounterType[] // Appointment encounter types that pre-select this template
  billable?: boolean // Default true; false for supervision + multidisciplinary continuation
  manualSection?: string // e.g., "Manual §4 — Behavioral Health Appointments"
  isCustom?: boolean // true for templates created/duplicated via the template editor
}

// ============================================================================
// PROVIDER DIRECTORY & STANDING PATIENT FACTS (Gellert note system)
// ============================================================================

/** External provider directory entry (the cut-and-paste killer) */
export interface Provider {
  id: string
  name: string // e.g., "Dr. Jane Smith"
  credential?: string // e.g., "MD"
  specialty: string
  practiceName: string
  address: { street: string; city: string; state: string; zip: string }
  phone: string
  type: "pcp" | "behavioral_health" | "specialist" | "lab_imaging" | "pharmacy"
}

/** Durable per-patient facts the auto-fill layer recalls across notes */
export interface StandingPatientFacts {
  patientId: string
  diabetic?: boolean
  colonoscopy?: { status: "up_to_date" | "due" | "declined" | "never"; note?: string }
  mammogram?: { status: "up_to_date" | "due" | "declined" | "not_applicable"; note?: string }
  preferredPharmacyProviderId?: string
  updatedAt: string
  updatedBy: string
}

/**
 * A note being drafted (work in progress)
 */
export interface NoteDraft {
  id: string
  patientId: string
  templateId: string
  responses: Record<string, unknown> // Keyed by field ID
  generatedNarrative: string
  startTime: string // ISO timestamp
  endTime?: string // ISO timestamp
  duration?: number // Calculated duration in minutes
  // Transcript resilience (AI Scribe): raw dictation cached so a dropped
  // connection or navigation never loses the navigator's spoken notes
  rawTranscript?: string
  updatedAt?: string // ISO timestamp of last autosave
  aiMeta?: {
    isMock: boolean
    filledFieldIds: string[]
    lowConfidenceFieldIds: string[]
    generatedAt: string
  }
}

// Raw HL7-like data structure from AMD integration
export interface ReferralRawData {
  PID: {
    patientName: string
    dob: string
    gender: "M" | "F" | "O"
    ssn?: string
    address: {
      street: string
      city: string
      state: string
      zip: string
    }
    phone: string
    email?: string
  }
  DG1: {
    primaryDiagnosis: string
    icdCodes: string[]
    diagnosisDate: string
  }
  IN1: {
    payerName: string
    payerId: string
    memberId: string
    groupNumber?: string
  }
  PV1: {
    admitDate?: string
    dischargeDate?: string
    attendingPhysician?: string
    referringPhysician: string
    facilityName: string
  }
}

// ============================================================================
// REFERRAL PIPELINE (Gellert WorkFlow2025 - replaces the legacy 3-state status)
// Legacy mapping: pending -> received, accepted -> converted, rejected -> ineligible
// ============================================================================

export type ReferralStatus =
  | "received" // Ingested; awaiting eligibility review
  | "ineligible" // Closed at eligibility, one of 5 reasons (terminal)
  | "accepted" // Eligible; awaiting first contact (24-48h SLA clock runs)
  | "outreach" // >=1 attempt logged, not yet resolved (max 7)
  | "unreachable" // Closed after 7 attempts; provider informed (terminal)
  | "declined" // Patient declined during outreach (terminal)
  | "agreed" // Patient agreed; ready for Match & Assign / intake scheduling
  | "intake_scheduled" // Intake 1 on the books
  | "converted" // Patient record created (terminal success)

/** The five documented ineligibility reasons (eligibility decision tree) */
export type IneligibilityReason =
  | "insurance"
  | "out_of_service_area"
  | "no_medical_need"
  | "level_of_care"
  | "age"

/** Five-gate eligibility check (short-circuit decision tree) */
export interface EligibilityCheck {
  checkedAt: string
  checkedBy: string
  insuranceVerified: boolean
  inServiceArea: boolean
  medicalNeedConfirmed: boolean
  levelOfCareAppropriate: boolean
  ageEligible: boolean
  outcome: "eligible" | "ineligible"
  ineligibilityReason?: IneligibilityReason
  notes?: string
}

/** One outreach attempt (max 7 before auto-close to unreachable) */
export interface OutreachAttempt {
  id: string
  attemptNumber: number // 1-7
  at: string // ISO timestamp
  by: string
  byName: string
  channel: "phone" | "text" | "in_person"
  disposition: "no_answer" | "voicemail" | "wrong_number" | "callback_requested" | "declined" | "agreed"
  notes?: string
}

export interface Referral {
  id: string
  receivedAt: string
  acceptedAt?: string // ISO timestamp of eligibility acceptance (starts the 24-48h contact SLA clock)
  source: string // e.g., "Dignity Health", "Banner Health"
  rawData: ReferralRawData
  rawHL7?: string // Original HL7v2 message text when ingested via the HL7 adapter
  status: ReferralStatus
  // Pipeline records
  eligibility?: EligibilityCheck
  outreachAttempts: OutreachAttempt[]
  agreedAt?: string // Patient agreed to services
  closedAt?: string // Terminal close timestamp (ineligible/unreachable/declined)
  closeReason?: "ineligible" | "unreachable" | "declined"
  providerNotifiedAt?: string // Referring provider informed (any close AND post-intake)
  intakeAppointmentId?: string // Intake 1 appointment when intake_scheduled
  patientId?: string // Set at conversion (FK to Patient.id)
  // SOP 1.7 gate: decision-making capacity confirmed before intake scheduling
  decisionCapacityConfirmed?: { confirmedAt: string; confirmedBy: string }
  // Denormalized fields for quick access (derived from rawData)
  patientName: string
  dob: string
  referralSource: string
  riskScore: 1 | 2 | 3
  referralDate: string
  diagnosis: string
  healthPlan: string
  assignedNavigator?: string
  // Matching engine fields
  zipCode: string // Patient's zip code for distance matching
  language: string // Patient's preferred language (default 'en')
  requiredAcuity: 'L1' | 'L2' | 'L3' // Required navigator acuity capability
}

// Assessment data collected during initial home visit
export interface RiskAssessmentData {
  // Social Determinants
  socialDeterminants: {
    housingInsecurity: boolean
    foodInsecurity: boolean
    transportationIssues: boolean
  }
  // Clinical Status
  clinicalStatus: {
    recentFall: boolean
    hospitalizedLast30Days: boolean
    polypharmacy: boolean // 5+ medications
  }
  // Mobility
  mobility: "independent" | "walker" | "wheelchair" | "bedbound"
  // Calculated fields
  riskScore: number // 0-100
  calculatedTier: 1 | 2 | 3
  completedAt: string
  completedBy: string // Navigator ID
}

export interface Message {
  id: string
  senderId: string
  senderName: string
  senderRole: UserRole
  receiverId: string
  receiverName: string
  receiverRole: UserRole
  content: string
  timestamp: string
  readStatus: boolean
  type: "direct" | "nudge"
  // Optional reference to patient for context (used in nudges)
  patientId?: string
  patientName?: string
}

export interface HealthPlanRevenue {
  planName: string
  pmpmRevenue: number
  patientCount: number
  color: string
}

export interface ReferralSource {
  name: string
  count: number
  trend: "up" | "down" | "stable"
}

export interface BillingData {
  date: string
  units: number
  target: number
}

export interface PerformanceData {
  name: string
  units: number
  lengthOfService: number
  tier: "top" | "standard" | "low"
}

// ============================================================================
// CARE PLAN TYPES (Phase 3)
// ============================================================================

/**
 * Goal definition within a care template
 */
export interface GoalDefinition {
  id: string
  description: string
  targetValue: number
  metricUnit: string // e.g., "lbs", "%", "mmHg", "mg/dL", "breaths/min"
  direction: "below" | "above" | "between" // target should be below, above, or between range
  warningThreshold?: number // threshold for yellow warning state
  frequency: "daily" | "weekly" | "monthly" // how often to log
}

/**
 * Task definition within a care template
 */
export interface TaskDefinition {
  id: string
  description: string
  frequency: "daily" | "weekly" | "as_needed"
  category: "vitals" | "medication" | "activity" | "nutrition" | "education"
}

/**
 * A reusable care pathway template
 */
export interface CareTemplate {
  id: string
  name: string
  description: string
  condition: string // Primary condition this template addresses (e.g., "CHF", "COPD", "Diabetes")
  goals: GoalDefinition[]
  tasks: TaskDefinition[]
}

/**
 * Historical data point for goal tracking
 */
export interface GoalDataPoint {
  date: string
  value: number
  loggedBy: string // Navigator ID
}

/**
 * Active goal tracking for a patient
 */
export interface GoalTracking {
  id: string
  goalDefinitionId: string
  description: string
  targetValue: number
  metricUnit: string
  direction: "below" | "above" | "between"
  warningThreshold?: number
  history: GoalDataPoint[]
  status: "on_track" | "warning" | "critical" | "not_started"
}

/**
 * Active care plan assigned to a patient
 */
export interface CarePlan {
  id: string
  patientId: string
  templateId: string
  templateName: string
  startDate: string
  activeGoals: GoalTracking[]
  activeTasks: {
    id: string
    taskDefinitionId: string
    description: string
    frequency: "daily" | "weekly" | "as_needed"
    category: "vitals" | "medication" | "activity" | "nutrition" | "education"
    lastCompleted?: string
  }[]
  status: "active" | "completed" | "paused"
}

// ============================================================================
// GOVERNANCE & ADMIN TYPES (Phase 5)
// ============================================================================

/**
 * Unified payer entity - single source of truth for payer identity.
 * Absorbs the admin rate card and links to billing rules (PayerConfig).
 * Patients reference payers by id (Patient.payerId); name-string matching happens
 * ONLY at data boundaries (referral acceptance) via alias resolution.
 */
export interface Payer {
  id: string // e.g., "payer-uhc"
  name: string // Canonical name, e.g., "United Healthcare"
  aliases: string[] // Legacy/inbound name variants, e.g., ["UHC", "United"]
  payerType: "MEDICARE" | "MEDICAID" | "COMMERCIAL"
  payerConfigId: string // FK -> PAYER_CONFIGS billing-rules id
  ratePerUnit: number // Revenue per completed visit (admin rate card)
  ediPayerId: string // Payer ID for 837P NM1*PR / 835 correlation
  lastUpdated: string // ISO timestamp
  updatedBy?: string
}

/**
 * CARC/RARC remark code dictionary entry (remittance adjudication).
 * Admin-editable so billing managers can add payer-specific codes without code changes.
 */
/** How a remark code should be treated when posting remittances */
export type RemarkClassification = "informational" | "adjustment" | "denial"

export interface RemarkCode {
  id: string // e.g., "carc-45", "rarc-n30"
  type: "CARC" | "RARC"
  code: string // e.g., "45", "N30"
  description: string
  classification?: RemarkClassification
  lastUpdated: string
  updatedBy?: string
}

/**
 * Organization/billing-provider settings used by claim exports (837P, CSV).
 * Replaces hardcoded provider strings.
 */
export interface OrganizationSettings {
  organizationName: string
  npi: string // Billing provider NPI (10-digit)
  taxId: string // EIN
  taxonomyCode: string // e.g., "251B00000X" (case management)
  submitterId: string // ISA06 / 1000A submitter identifier
  address: { street: string; city: string; state: string; zip: string }
  contactPhone: string
  supervisingProvider: { name: string; npi: string }
  lastUpdated: string
  updatedBy?: string
}

/**
 * Audit log entry for tracking system activity
 */
export interface AuditLog {
  id: string
  userId: string
  userName: string
  userRole: UserRole
  action: AuditAction
  timestamp: string
  details?: string
  entityType?: string // e.g., "appointment", "note", "payer_rate"
  entityId?: string
}

/**
 * Action types for audit logging
 */
export type AuditAction =
  | "check_in"
  | "check_out"
  | "note_created"
  | "note_updated"
  | "payer_rate_updated"
  | "payer_updated"
  | "care_plan_applied"
  | "referral_accepted"
  | "referral_rejected"
  | "referral_ingested"
  | "assessment_completed"
  | "appointment_scheduled"
  | "appointment_cancelled"
  | "patient_created"
  | "login"
  | "logout"
  | "claim_exported"
  | "claim_status_changed"
  | "remittance_imported"
  | "remark_code_updated"
  | "org_settings_updated"
  | "sos_triggered"
  | "sos_acknowledged"
  | "sos_resolved"
  // Journey engine (Gellert WorkFlow2025)
  | "eligibility_completed"
  | "outreach_attempt_logged"
  | "referral_closed"
  | "intake_visit_completed"
  | "intake_no_show"
  | "provider_notified"
  | "graduation_flagged"
  | "graduation_confirmed"
  | "telenav_check_in"
  | "patient_reengaged"
  | "program_exited"
  // Gellert billing mode
  | "charge_slip_signed"
  | "remittance_pended"
  | "remittance_reprocessed"
  | "denial_work_status_changed"
  // Gellert ops blitz (tasks / documents / meds / escalations / comms / training)
  | "task_completed"
  | "task_dismissed"
  | "document_completed"
  | "document_signed"
  | "med_reconciliation_recorded"
  | "escalation_raised"
  | "escalation_acknowledged"
  | "escalation_resolved"
  | "provider_comm_sent"
  | "onboarding_milestone_completed"

// ============================================================================
// CMS BILLING & CODING STANDARDS (Phase 2.1 - Documentation Engine)
// ============================================================================

/**
 * Service type for Patient Navigation billing
 * PIN = Principal Illness Navigation (oncology, serious illness)
 * CHI = Community Health Integration (SDOH-focused)
 */
export type ServiceType = "PIN" | "CHI"

/**
 * Billing model identifier for payer-agnostic billing
 * MEDICAID_BH = Medicaid Behavioral Health (H-codes, 15-min increments)
 * MEDICARE_PIN = Medicare Principal Illness Navigation (G-codes, 60-min base)
 * MEDICARE_CHI = Medicare Community Health Integration (G-codes, 60-min base)
 */
export type BillingModel = "MEDICAID_BH" | "MEDICARE_PIN" | "MEDICARE_CHI"

/**
 * Activity types for H-code mapping (Medicaid Behavioral Health)
 * Determines which H-code to bill based on type of service provided
 */
export type ActivityType =
  | "PEER_SUPPORT"   // -> H0038
  | "CHECK_IN"       // -> H0038
  | "TRANSPORT"      // -> H2015
  | "HOME_VISIT"     // -> H2015
  | "OUTREACH"       // -> H0023

/**
 * H-code definition for Medicaid behavioral health billing
 * Billed in 15-minute increments using Rule of Eights
 */
export interface HCodeDefinition {
  code: string // e.g., "H0038", "H2015", "H0023"
  description: string
  unitMinutes: number // Always 15 for H-codes
  activityTypes: ActivityType[] // Which activities map to this code
}

/**
 * Payer configuration defining billing rules
 * Enables payer-agnostic billing with different code sets and thresholds
 */
export interface PayerConfig {
  id: string
  name: string // e.g., "Arizona Medicaid (H-Codes)"
  billingModel: BillingModel
  // Threshold configuration
  baseMinimum: number // Minutes for first billable unit (8 for Medicaid, 60 for Medicare)
  unitIncrement: number // Minutes per unit (15 for Medicaid, 30 for Medicare add-on)
  // Code mappings
  codes: {
    base: string // Primary code (H0038 for Medicaid, G0023/G0019 for Medicare)
    addOn?: string // Add-on code (undefined for Medicaid, G0024/G0022 for Medicare)
  }
  // Rule of Eights (Medicaid only) - 8+ minutes = 1 unit
  useRuleOfEights: boolean
  // Revenue rates
  revenueRates: {
    baseRate: number // Per unit
    addOnRate?: number // For Medicare add-on codes
  }
}

/**
 * CPT/G-code definition for billing
 * PIN codes: G0023 (base 60min), G0024 (add-on 30min)
 * CHI codes: G0019 (base 60min), G0022 (add-on 30min)
 */
export interface CPTDefinition {
  code: string // e.g., "G0023", "G0019"
  description: string
  baseDuration: number // Duration in minutes (60 for base, 30 for add-on)
  isBaseCode: boolean // True for G0023/G0019, False for G0024/G0022
  serviceType: ServiceType
}

/**
 * ICD-10 Z-code for Social Determinants of Health (SDOH)
 * Required for CHI billing to document barriers addressed
 */
export interface ZCode {
  code: string // e.g., "Z59.0"
  description: string // e.g., "Homelessness"
  category: "Housing" | "Food" | "Transport" | "Financial" | "Social" | "Employment"
}

// ============================================================================
// ASSESSMENT MODELS (Phase 2.1)
// ============================================================================

/**
 * Acuity scoring model for patient complexity assessment
 * Each domain scored 0-3, total 0-12 determines service intensity
 */
export interface AcuityScore {
  clinical: 0 | 1 | 2 | 3 // Medical complexity
  psychosocial: 0 | 1 | 2 | 3 // Mental health/social support
  barriers: 0 | 1 | 2 | 3 // SDOH barriers count
  literacy: 0 | 1 | 2 | 3 // Health literacy challenges
  totalScore: number // 0-12 sum of domains
  level: "Low" | "Moderate" | "High" // Derived from totalScore
}

// ============================================================================
// INTAKE 1 & 2 (Gellert two-visit intake protocol; extends IntakeRecord)
// ============================================================================

/** Intake 1 checklist keys (onboarding visit) */
export type Intake1ChecklistKey =
  | "onboarding_packet"
  | "roi_signed"
  | "med_reconciliation"
  | "health_history"
  | "provider_list"
  | "risk_screening"
  | "patient_photo"
  | "pcp_scheduled"

/** Intake 2 checklist keys (contract + survey visit) */
export type Intake2ChecklistKey = "intake_survey" | "navigation_contract_signed" | "risk_tier_confirmed"

export type IntakeChecklistKey = Intake1ChecklistKey | Intake2ChecklistKey

export interface IntakeChecklistItem {
  key: IntakeChecklistKey
  label: string
  done: boolean
  doneAt?: string
  doneBy?: string
}

export interface IntakeVisit {
  scheduledDate?: string
  completedDate?: string
  status: "not_scheduled" | "scheduled" | "completed"
  noShowCount: number
  checklist: IntakeChecklistItem[]
}

/**
 * Initial intake record capturing critical billing prerequisites
 */
export interface IntakeRecord {
  id: string
  patientId: string
  date: string // ISO date string
  initiatingVisitDate: string // Critical for billing trigger - first billable date
  consentObtained: boolean // Mandatory G-code requirement for CMS
  consentDate?: string // Date consent was obtained
  serviceType: ServiceType // PIN or CHI
  acuity: AcuityScore
  identifiedBarriers: ZCode[] // Linked Z-codes for SDOH documentation
  primaryNavigatorId: string
  referralSourceId?: string
  notes?: string
  // Gellert Intake 1 & 2 protocol (all optional/additive)
  intake1?: IntakeVisit
  intake2?: IntakeVisit
  pcpApptDate?: string // Scheduled PCP appointment date
  pcpDueBy?: string // Conversion + 7 BUSINESS days (lib/business-days.ts)
  providerNotifiedAt?: string // 24h post-intake referring-provider notification
  totalNoShows?: number // Across both intake visits; 3 = closure protocol (MIA exit)
}

// ============================================================================
// TIME LOGGING (Phase 2.1)
// ============================================================================

/**
 * Time log entry for tracking billable time
 * Aggregated monthly for G-code billing (60min base + 30min increments)
 * Or aggregated with Rule of Eights for H-code billing (15min increments)
 */
export interface TimeLog {
  id: string
  patientId: string
  date: string // ISO date string
  startTime: string // ISO timestamp
  endTime: string // ISO timestamp
  durationMinutes: number // Calculated duration
  modality: "In-Person" | "Phone" | "Video"
  serviceType: ServiceType // PIN or CHI
  linkedEncounterId?: string // Reference to related encounter/note
  navigatorId: string
  verified: boolean // Supervisor verification for billing
  verifiedBy?: string
  verifiedAt?: string
  billingPeriod?: string // e.g., "2026-01" for monthly aggregation
  // H-code mapping (Medicaid Behavioral Health)
  activityType?: ActivityType // For H-code activity mapping (PEER_SUPPORT, HOME_VISIT, etc.)
}

/**
 * Monthly time aggregation for billing calculation
 */
export interface MonthlyTimeSummary {
  patientId: string
  billingPeriod: string // e.g., "2026-01"
  serviceType: ServiceType
  totalMinutes: number
  baseUnits: number // Number of 60-min base codes
  addOnUnits: number // Number of 30-min add-on codes
  logs: string[] // TimeLog IDs included
  status: "pending" | "submitted" | "approved" | "denied"
}

/**
 * Billing encounter tying together documentation requirements
 */
export interface BillingEncounter {
  id: string
  patientId: string
  serviceType: ServiceType
  encounterDate: string
  cptCode: string // G-code used
  zCodes: string[] // Linked SDOH Z-codes
  timeLogIds: string[] // Time entries for this encounter
  totalMinutes: number
  noteId?: string // Linked clinical note
  intakeRecordId: string // Reference to intake for consent verification
  status: "documented" | "ready_for_billing" | "submitted" | "paid" | "denied"
  claimNumber?: string
  denialReason?: string
}

/**
 * Aggregated billable claim for Finance Dashboard export
 * Combines monthly time logs into a single billable unit per patient
 *
 * Supports two billing models:
 * 1. Medicare G-codes (60-min base + 30-min add-on):
 *    - PIN: G0023 (base) + G0024 (add-on)
 *    - CHI: G0019 (base) + G0022 (add-on)
 * 2. Medicaid H-codes (15-min increments, Rule of Eights):
 *    - H0038 (peer support), H2015 (community support), H0023 (outreach)
 */
/**
 * Full claim lifecycle status.
 * Derived (recomputed-from-time-logs) claims only ever hold DRAFT | NEEDS_ATTENTION | VALIDATED.
 * Persisted ClaimRecords (created at export) progress EXPORTED -> SUBMITTED -> ACCEPTED/REJECTED -> PAID/DENIED.
 */
export type ClaimStatus =
  | "DRAFT" // Derived claim for the current, still-accruing billing month
  | "NEEDS_ATTENTION" // Derived claim with validation errors
  | "VALIDATED" // Derived claim, passed validation, ready to export
  | "EXPORTED" // Persisted ClaimRecord; file generated (CSV or 837P)
  | "SUBMITTED" // Sent via ClearinghouseAdapter
  | "ACCEPTED" // Clearinghouse acknowledgment
  | "REJECTED" // Clearinghouse rejection -> fix & rebill
  | "PAID" // 835 posted payment
  | "DENIED" // 835 denial with CARC codes -> rebill/appeal

/** Statuses a derived (pre-export) claim can hold */
export type DerivedClaimStatus = Extract<ClaimStatus, "DRAFT" | "NEEDS_ATTENTION" | "VALIDATED">

/** Statuses a persisted ClaimRecord can hold */
export type ClaimRecordStatus = Exclude<ClaimStatus, DerivedClaimStatus>

export interface BillableClaim {
  id: string
  patientId: string
  patientName: string
  memberId: string // Insurance member ID from payer
  month: string // Billing period "YYYY-MM" format (e.g., "2026-01")
  totalMinutes: number // Sum of all verified time logs for the month
  primaryCode: string // Base code ("G0023" for Medicare PIN, "H0038" for Medicaid)
  primaryUnits: number // Units calculated based on billing model
  addOnCode?: string // Add-on code (Medicare only: "G0024" for PIN, "G0022" for CHI)
  addOnUnits: number // Add-on units (Medicare only, 0 for Medicaid)
  diagnosisCodes: string[] // ICD-10 codes (e.g., ["Z59.0", "C50.9"])
  status: DerivedClaimStatus
  validationErrors?: string[] // Reasons for NEEDS_ATTENTION status
  // Traceability
  timeLogIds: string[] // Source time log IDs that comprise this claim
  serviceType: ServiceType // PIN or CHI
  navigatorId: string // Primary navigator who provided service
  createdAt: string // ISO timestamp when claim was generated
  exportedAt?: string // ISO timestamp when claim was exported
  // Payer-agnostic billing (Phase 2.2)
  billingModel?: BillingModel // Which billing model generated this claim
  payerConfigId?: string // Reference to PayerConfig used
  payerId?: string // FK -> Payer.id (denormalized from patient at generation)
}

/**
 * One status transition in a claim record's history (audit trail)
 */
export interface ClaimStatusEvent {
  status: ClaimStatus
  at: string // ISO timestamp
  by: string // user id, or "system:835" / "system:clearinghouse"
  note?: string
}

/**
 * Remittance details applied to a claim from an 835 ERA
 */
export interface RemittanceInfo {
  paidAmount: number
  chargedAmount: number
  patientResponsibility: number
  carcCodes: string[] // Claim Adjustment Reason Codes (from CAS segments)
  rarcCodes: string[] // Remittance Advice Remark Codes (from LQ*HE segments)
  payerClaimControlNumber?: string
  checkOrEftNumber?: string // TRN02
  remitDate?: string // ISO date (from BPR16)
  eraFileName?: string
}

/**
 * Persisted, immutable snapshot of an exported claim.
 * Created by exportClaims(); the pre-export claim stays derived from time logs.
 * Rebills create a new record with a -vN versioned id; the old one is voided.
 */
export interface ClaimRecord {
  id: string // `${sourceClaimId}-${payerConfigId}-v${n}`
  sourceClaimId: string // Derived BillableClaim.id
  snapshot: BillableClaim // Frozen at export time
  payerId: string
  payerConfigId: string
  billedAmount: number // calculateClaimValue at export time
  status: ClaimRecordStatus
  statusHistory: ClaimStatusEvent[]
  exportedAt: string
  exportFormat: "CSV" | "837P"
  exportBatchId: string
  submittedAt?: string
  clearinghouseBatchId?: string
  remittance?: RemittanceInfo
  voided?: boolean // Superseded by a rebill; stays in ledger, greyed out
  // DAP review queue: remittance held (NOT posted) because it carried remark
  // codes missing from the dictionary. Record advances only to ACCEPTED;
  // reprocessPendedRemittances resolves it once codes are classified.
  pendedRemittance?: {
    remittance: RemittanceInfo
    resolvedStatus: "PAID" | "DENIED"
    unknownCodes: string[]
    pendedAt: string
  }
  // Denial work queue status (biller-managed, informational)
  workStatus?: ClaimWorkStatus
}

/** Denial-work-queue status ("the queue Sonya doesn't have in AMD") */
export type ClaimWorkStatus = "new" | "in_review" | "corrected" | "resubmitted"

// ============================================================================
// CHARGE SLIPS & ZONES (Gellert billing mode)
// ============================================================================

/**
 * Daily charge slip: a navigator's signed attestation over a derived
 * patient-day grouping of TimeLogs. TimeLogs remain the single source of
 * billing truth; only SIGNED slips are persisted (unsigned derived on the fly).
 */
export interface ChargeSlip {
  id: string // `slip-{navigatorId}-{patientId}-{date}`
  navigatorId: string
  patientId: string
  date: string // YYYY-MM-DD service date
  timeLogIds: string[] // Frozen at signing
  totalMinutes: number
  units: number // Per-day Rule of Eights units
  code: string // e.g., "H0038"
  signedAt?: string // ISO timestamp; presence = signed
  signedBy?: string
}

/** Geographic coverage zone (Gellert runs 11; demo seeds 6 Phoenix-metro) */
export interface Zone {
  id: string
  name: string
  color: string // Hex or CSS color for map overlays / chips
  zipCodes: string[] // Member zips (must exist in AZ_ZIP_CENTROIDS)
  description?: string
}

// ============================================================================
// SCHEDULING & LOGISTICS (Phase 4)
// ============================================================================

/**
 * Event type for dual-track calendar
 * MEDICAL_VISIT: Patient's medical appointment (oncology, PCP, specialist)
 * NAVIGATOR_VISIT: Navigator service (transport, home visit, accompaniment)
 */
export type EventType = "MEDICAL_VISIT" | "NAVIGATOR_VISIT"

/**
 * Event status for tracking progress
 */
export type EventStatus = "SCHEDULED" | "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW"

/**
 * Location details for an event
 */
export interface EventLocation {
  name: string // e.g., "Banner Desert Medical Center"
  address: string // Full street address
  zipCode: string // For travel time calculation
  lat?: number // Optional GPS coordinates
  lng?: number
}

/**
 * Schedule event for dual-track calendar
 * Tracks both medical appointments and navigator services
 */
export interface ScheduleEvent {
  id: string
  patientId: string
  patientName: string // Denormalized for display
  navigatorId: string
  navigatorName: string // Denormalized for display
  type: EventType
  title: string // e.g., "Oncology Consult" or "Pickup & Transport"
  description?: string // Additional notes
  location: EventLocation
  startTime: string // ISO timestamp
  endTime: string // ISO timestamp
  isHighSafetyRisk: boolean // Derived from patient acuity (L3 = high risk)
  status: EventStatus
  // Linked records
  linkedAppointmentId?: string // If this is a NAVIGATOR_VISIT accompanying a MEDICAL_VISIT
  // Travel logistics
  estimatedTravelMinutes?: number // Calculated travel time to location
  pickupLocation?: EventLocation // For transport events
  // Recurrence (for follow-up scheduling)
  recurrenceRule?: string // iCal RRULE format (optional)
  recurrenceParentId?: string // If this is an instance of a recurring event
}

/**
 * Days of the week for shift scheduling
 */
export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"

/**
 * Navigator shift/availability schedule
 * Created by supervisors to define when navigators are available to work
 */
export interface NavigatorShift {
  id: string
  navigatorId: string
  navigatorName: string // Denormalized for display
  supervisorId: string // Who created this shift
  // Schedule definition
  startDate: string // YYYY-MM-DD - when this shift pattern starts
  endDate?: string // YYYY-MM-DD - optional end date (null = ongoing)
  days: DayOfWeek[] // Which days this shift applies to
  startTime: string // HH:MM format (e.g., "09:00")
  endTime: string // HH:MM format (e.g., "17:00")
  // Metadata
  region?: string // Optional region/territory assignment
  notes?: string // Supervisor notes about this shift
  isPublished: boolean // Draft vs published to navigator
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

/**
 * Time-off request from navigator
 */
export interface TimeOffRequest {
  id: string
  navigatorId: string
  navigatorName: string
  requestedDate: string // YYYY-MM-DD
  startTime?: string // HH:MM - if partial day
  endTime?: string // HH:MM - if partial day
  isFullDay: boolean
  reason: "PTO" | "Sick" | "Personal" | "Training" | "Other"
  notes?: string
  status: "pending" | "approved" | "denied"
  reviewedBy?: string // Supervisor ID
  reviewedAt?: string // ISO timestamp
  createdAt: string
}

// ============================================================================
// NAVIGATOR SAFETY MAP (Real-time Location Tracking)
// ============================================================================

/**
 * Safety status for navigator field tracking
 * - ACTIVE: Navigator is moving/working (green)
 * - IDLE: No movement for 15+ minutes (yellow warning)
 * - RISK_ALERT: No check-in for 30+ minutes or manual SOS (red alert)
 */
export type SafetyStatus = "ACTIVE" | "IDLE" | "RISK_ALERT"

/**
 * Real-time navigator location for safety tracking
 */
export interface NavigatorLocation {
  id: string
  navigatorId: string
  navigatorName: string
  lat: number
  lng: number
  lastCheckIn: string // ISO timestamp
  status: SafetyStatus
  currentTask?: string // e.g., "Home Visit: James T."
  currentPatientId?: string // Link to patient if on a visit
  speed?: number // mph - to detect if moving
  heading?: number // degrees - direction of travel
  batteryLevel?: number // 0-100 phone battery
}

/**
 * SOS event lifecycle for navigator panic alerts
 */
export type SOSStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED"

/**
 * Navigator-triggered emergency alert, surfaced on the supervisor safety map
 */
export interface SOSEvent {
  id: string
  navigatorId: string
  navigatorName: string
  triggeredAt: string // ISO timestamp
  lat: number
  lng: number
  status: SOSStatus
  acknowledgedBy?: string // Supervisor name
  acknowledgedAt?: string
  resolvedAt?: string
  note?: string
}
