/**
 * Document definitions (Gellert ops blitz) — the per-type shape of every
 * patient document behind the Intake 1/2 checklist items (SOPs 2.3/2.7),
 * including the attestation language for the two SIGNED documents:
 *  - ROI: HIPAA release naming the insurance company + pharmacy (playbook §5.1)
 *  - Navigation contract: service agreement incl. the zero-tolerance
 *    aggression acknowledgment (note manual) — this is the billing gate (§4).
 *
 * Pure data + mapping helpers; the document forms (workstream G-2) render
 * from these definitions.
 */

import type { IntakeChecklistKey, PatientDocument, PatientDocumentType } from "./types"

// ============================================================================
// FIELD & DEFINITION SHAPES
// ============================================================================

export type DocumentFieldType = "text" | "textarea" | "select" | "boolean" | "date" | "med_rows"

export interface DocumentFieldDef {
  id: string
  label: string
  type: DocumentFieldType
  required: boolean
  options?: string[] // for select fields
  placeholder?: string
}

export interface DocumentDefinition {
  type: PatientDocumentType
  title: string
  description: string
  fields: DocumentFieldDef[]
  /** true = terminal status is "signed" (roi, navigation_contract); else "completed" */
  requiresSignature: boolean
  /** Exact language shown verbatim above the signature line */
  attestationText?: string
}

// ============================================================================
// ATTESTATION LANGUAGE (verbatim at signing; seeds reference these constants)
// ============================================================================

export const ROI_ATTESTATION_TEXT =
  "I authorize Gellert Health to obtain from and disclose to my insurance company, " +
  "my pharmacy, my referring provider, and my treating providers the health information " +
  "needed to coordinate my care and bill for navigation services, as permitted by HIPAA. " +
  "I understand I may revoke this authorization in writing at any time, that revocation " +
  "does not apply to information already released, and that this authorization expires " +
  "one year from the date signed unless I end it sooner."

export const CONTRACT_ATTESTATION_TEXT =
  "I agree to receive peer-support navigation services from Gellert Health. I understand " +
  "my navigator is non-clinical: they do not diagnose, treat, or handle my medications — " +
  "they accompany, coach, transport, coordinate, and document. I agree to participate in " +
  "scheduled visits and to notify my navigator when I cannot attend. I acknowledge Gellert " +
  "Health's zero-tolerance policy toward aggression: threats, profanity directed at staff, " +
  "or physical intimidation are documented and may end services for safety. I understand " +
  "services begin, and navigation time becomes billable, only after I sign this agreement."

// ============================================================================
// DEFINITIONS
// ============================================================================

export const DOCUMENT_DEFINITIONS: Record<PatientDocumentType, DocumentDefinition> = {
  roi: {
    type: "roi",
    title: "Release of Information (ROI)",
    description:
      "HIPAA authorization to exchange health information with the patient's insurance company, pharmacy, and providers.",
    requiresSignature: true,
    attestationText: ROI_ATTESTATION_TEXT,
    fields: [
      { id: "insurance-company", label: "Insurance company", type: "text", required: true, placeholder: "e.g., Mercy Care" },
      { id: "pharmacy", label: "Preferred pharmacy", type: "text", required: true, placeholder: "e.g., CVS #08842, Glendale" },
      { id: "referring-provider", label: "Referring provider / facility", type: "text", required: false },
      { id: "other-parties", label: "Other authorized parties", type: "textarea", required: false, placeholder: "Family members, caregivers, agencies…" },
    ],
  },
  navigation_contract: {
    type: "navigation_contract",
    title: "Patient Navigation Agreement",
    description:
      "The service agreement (Patient Agreement). Billing is gated on this document — no navigation time bills before it is signed (playbook §4).",
    requiresSignature: true,
    attestationText: CONTRACT_ATTESTATION_TEXT,
    fields: [
      {
        id: "services-reviewed",
        label: "Services reviewed with patient (accompaniment, transport, coordination, coaching)",
        type: "boolean",
        required: true,
      },
      {
        id: "non-clinical-role-explained",
        label: "Non-clinical navigator role explained (no diagnosis, no treatment, no medication handling)",
        type: "boolean",
        required: true,
      },
      {
        id: "zero-tolerance-reviewed",
        label: "Zero-tolerance aggression policy reviewed",
        type: "boolean",
        required: true,
      },
      { id: "patient-questions", label: "Patient questions / notes", type: "textarea", required: false },
    ],
  },
  intake_survey: {
    type: "intake_survey",
    title: "Intake Patient Survey",
    description: "Baseline survey administered at Intake 2 — situation, supports, barriers, and goals.",
    requiresSignature: false,
    fields: [
      {
        id: "living-situation",
        label: "Current living situation",
        type: "select",
        required: true,
        options: ["Lives alone", "Lives with family", "Lives with caregiver", "Assisted living", "Unstably housed"],
      },
      {
        id: "support-system",
        label: "Who helps you day to day?",
        type: "select",
        required: true,
        options: ["Family nearby", "Friends/neighbors", "Paid caregiver", "No regular support"],
      },
      {
        id: "transport-access",
        label: "How do you usually get to appointments?",
        type: "select",
        required: true,
        options: ["Drives self", "Family/friends drive", "Public transit", "Insurance transport", "No reliable option"],
      },
      {
        id: "health-confidence",
        label: "How confident are you managing your health conditions?",
        type: "select",
        required: true,
        options: ["Very confident", "Somewhat confident", "Not confident"],
      },
      {
        id: "biggest-barrier",
        label: "What gets in the way of your health most?",
        type: "select",
        required: true,
        options: ["Transportation", "Cost / insurance", "Understanding instructions", "Food or housing", "Feeling alone", "Other"],
      },
      { id: "medications-concern", label: "Any concerns about your medications?", type: "textarea", required: false },
      { id: "patient-goal", label: "In your own words, what would you like navigation to help with?", type: "textarea", required: true },
    ],
  },
  medication_list: {
    type: "medication_list",
    title: "Medication List",
    description:
      "Structured medication rows captured at reconciliation. The live list stays on the patient record; reconciliation events snapshot it.",
    requiresSignature: false,
    fields: [
      { id: "medications", label: "Medications (name, dose, frequency)", type: "med_rows", required: true },
      { id: "reconciliation-note", label: "Reconciliation note", type: "textarea", required: false },
    ],
  },
  patient_photo: {
    type: "patient_photo",
    title: "Patient Photo",
    description: "Identification photo on file for field-safety and continuity (Intake 1 checklist item).",
    requiresSignature: false,
    fields: [
      { id: "consent-to-photo", label: "Patient consents to a photo on file", type: "boolean", required: true },
    ],
  },
  onboarding_packet: {
    type: "onboarding_packet",
    title: "Onboarding Packet",
    description: "Contents of the Intake 1 onboarding packet, reviewed item by item with the patient.",
    requiresSignature: false,
    fields: [
      { id: "welcome-letter", label: "Welcome letter & program overview reviewed", type: "boolean", required: true },
      { id: "contact-card", label: "Navigator contact card provided", type: "boolean", required: true },
      { id: "rights-responsibilities", label: "Patient rights & responsibilities reviewed", type: "boolean", required: true },
      { id: "privacy-practices", label: "Notice of privacy practices provided", type: "boolean", required: true },
      { id: "emergency-instructions", label: "When-to-call-911 / after-hours instructions reviewed", type: "boolean", required: true },
    ],
  },
}

// ============================================================================
// CHECKLIST <-> DOCUMENT MAPPING
// ============================================================================

const CHECKLIST_TO_DOCUMENT: Partial<Record<IntakeChecklistKey, PatientDocumentType>> = {
  roi_signed: "roi",
  navigation_contract_signed: "navigation_contract",
  intake_survey: "intake_survey",
  med_reconciliation: "medication_list",
  patient_photo: "patient_photo",
  onboarding_packet: "onboarding_packet",
}

/** The document type behind an intake checklist item, or null for manual-only items */
export function documentForChecklistItem(checklistKey: IntakeChecklistKey): PatientDocumentType | null {
  return CHECKLIST_TO_DOCUMENT[checklistKey] ?? null
}

const DOCUMENT_TO_CHECKLIST: Record<PatientDocumentType, { visit: 1 | 2; key: IntakeChecklistKey }> = {
  roi: { visit: 1, key: "roi_signed" },
  medication_list: { visit: 1, key: "med_reconciliation" },
  patient_photo: { visit: 1, key: "patient_photo" },
  onboarding_packet: { visit: 1, key: "onboarding_packet" },
  intake_survey: { visit: 2, key: "intake_survey" },
  navigation_contract: { visit: 2, key: "navigation_contract_signed" },
}

/** The intake checklist item (and which visit it lives on) a document satisfies */
export function checklistItemForDocument(type: PatientDocumentType): { visit: 1 | 2; key: IntakeChecklistKey } {
  return DOCUMENT_TO_CHECKLIST[type]
}

/**
 * Whether a document satisfies its checklist item:
 * signature-bearing types must be "signed"; the rest are done at "completed"
 * (a signed status also satisfies, defensively).
 */
export function isDocumentSatisfied(doc: PatientDocument): boolean {
  if (DOCUMENT_DEFINITIONS[doc.type].requiresSignature) return doc.status === "signed"
  return doc.status === "completed" || doc.status === "signed"
}
