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

export interface Patient {
  id: string
  name: string
  dob: string
  chartNumber: string
  riskLevel: 1 | 2 | 3
  riskScore?: number // 0-100 calculated risk score from assessment
  survivalStatus: "active" | "inactive"
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
}

export interface Navigator {
  id: string
  name: string
  supervisorId: string
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

export interface Appointment {
  id: string
  patientId: string
  navigatorId: string
  date: string
  time: string
  type: "home_visit" | "phone_call" | "video_call" | "clinic"
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show"
  notes?: string
  // EVV (Electronic Visit Verification) fields - Phase 4
  checkInTime?: string // ISO timestamp when visit started
  checkOutTime?: string // ISO timestamp when visit ended
  evvLocation?: {
    lat: number
    lng: number
  }
}

export interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  nextRefillDate: string
  compliance: boolean
}

export interface PatientNote {
  id: string
  patientId: string
  authorId: string
  authorName: string
  authorRole: UserRole
  content: string
  type: "clinical" | "follow-up" | "general" | "phone" | "visit"
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
}

// ============================================================================
// DYNAMIC NARRATIVE ENGINE (Phase 6)
// ============================================================================

/**
 * Field types supported in note templates
 */
export type NoteFieldType = "select" | "multi-select" | "text" | "boolean" | "time-duration" | "textarea"

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

export interface Referral {
  id: string
  receivedAt: string
  acceptedAt?: string // ISO timestamp when accepted/assigned (drives turnaround metrics)
  source: string // e.g., "Dignity Health", "Banner Health"
  rawData: ReferralRawData
  rawHL7?: string // Original HL7v2 message text when ingested via the HL7 adapter
  status: "pending" | "accepted" | "rejected"
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
 * @deprecated Replaced by the unified {@link Payer} entity. Kept for type
 * compatibility during migration; the store no longer carries a payerRates slice.
 */
export interface PayerRate {
  id: string
  payerName: string
  ratePerUnit: number // Revenue per completed visit
  lastUpdated: string // ISO timestamp
  updatedBy?: string // User ID who made the last update
}

/**
 * Unified payer entity - single source of truth for payer identity.
 * Absorbs the admin rate card (PayerRate) and links to billing rules (PayerConfig).
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
export interface RemarkCode {
  id: string // e.g., "carc-45", "rarc-n30"
  type: "CARC" | "RARC"
  code: string // e.g., "45", "N30"
  description: string
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
