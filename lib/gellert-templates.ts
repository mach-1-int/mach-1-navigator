/**
 * Gellert note templates — the Note-Taking Manual as executable data.
 *
 * All eight manual note types (Phone, Medical ± Transit, BH ± Transit,
 * Lab/Imaging, Medication Assistance, SDOH, Multidisciplinary Continuation,
 * Supervision) with the FROZEN template ids from lib/note-taxonomy.ts.
 *
 * Conventions (from the manual):
 * - Third person throughout ("Navigator arrived at...", never "I").
 * - Clock times in H:MMAM/PM with a colon ("10:05AM", never "10am").
 * - Every billable note closes with presence + "Total = X minutes."
 * - "Never skip" elements carry neverSkip: true (badged in the builder,
 *   cited by the compliance engine).
 */

import type { NoteTemplate, Provider, TemplateField } from "./types"

// ============================================================================
// SHARED CONSTANTS (compliance engine + scribe prompt import these)
// ============================================================================

/** Exact manual language for the medication no-touch attestation (verbatim) */
export const MED_NO_TOUCH_LANGUAGE =
  "Patient refilled medication containers independently with verbal direction only; Navigator never touched the medications."

/** Closing presence phrase every in-person note must carry */
export const WITH_PATIENT_UNTIL_PHRASE = "Navigator was with the patient until"

/** Canonical manual time format: H:MM followed by AM/PM, colon required */
export const TIME_FORMAT_REGEX = /^\d{1,2}:\d{2}(AM|PM)$/

/**
 * Provider-picker type filters by field id — note-builder narrows the
 * directory options for these fields (e.g. "facility" only offers labs).
 */
export const PROVIDER_FIELD_TYPE_FILTER: Record<string, Provider["type"]> = {
  "bh-provider": "behavioral_health",
  facility: "lab_imaging",
  pharmacy: "pharmacy",
}

/**
 * The designated patient-involvement field per Gellert template — the field
 * the "NO PATIENT INVOLVEMENT = NO BILLING" rule inspects.
 */
export const INVOLVEMENT_FIELD_BY_TEMPLATE: Record<string, string> = {
  "template-gellert-phone": "patient-statements",
  "template-gellert-medical": "patient-response",
  "template-gellert-bh": "patient-response",
  "template-gellert-lab": "patient-response",
  "template-gellert-med-assist": "patient-response",
  "template-gellert-sdoh": "patient-response",
  "template-gellert-multidisciplinary": "patient-response",
}

// ============================================================================
// SHARED FIELD FRAGMENTS
// ============================================================================

/** ± Transit section: gate boolean + pickup fields shown only when true */
const transitFields = (): TemplateField[] => [
  {
    // Gate only — the pickup fields below carry the transit narrative
    id: "transport-provided",
    label: "Transport provided?",
    type: "boolean",
    required: true,
    section: "Transit",
  },
  {
    id: "pickup-time",
    label: "Pickup time",
    type: "time",
    required: false,
    section: "Transit",
    showIf: { fieldId: "transport-provided", equals: true },
    narrativePrefix: "Navigator provided transport, picking the patient up at ",
    narrativeSuffix: " ",
    placeholder: "9:40AM",
  },
  {
    id: "pickup-location",
    label: "Pickup location",
    type: "text",
    required: false,
    section: "Transit",
    showIf: { fieldId: "transport-provided", equals: true },
    narrativePrefix: "from ",
    narrativeSuffix: ". ",
    placeholder: "Patient's home",
  },
]

/** Wrap-up tail every billable in-person template carries */
const inPersonWrapUpFields = (): TemplateField[] => [
  {
    id: "with-patient-until",
    label: "With patient until",
    type: "time",
    required: true,
    section: "Wrap-Up",
    neverSkip: true,
    narrativePrefix: `${WITH_PATIENT_UNTIL_PHRASE} `,
    narrativeSuffix: ".",
    placeholder: "11:15AM",
  },
  {
    id: "duration",
    label: "Total encounter time",
    type: "time-duration",
    required: true,
    section: "Wrap-Up",
    neverSkip: true,
    narrativePrefix: " Total = ",
    narrativeSuffix: " minutes.",
  },
]

const patientResponseField = (): TemplateField => ({
  id: "patient-response",
  label: "Patient response / involvement",
  type: "textarea",
  required: true,
  section: "Encounter",
  neverSkip: true,
  narrativePrefix: "Patient ",
  narrativeSuffix: " ",
  placeholder: "What did the patient say or do? Use direct quotes for notable statements.",
})

// ============================================================================
// TEMPLATE: PHONE CALL
// ============================================================================

const phoneCallTemplate: NoteTemplate = {
  id: "template-gellert-phone",
  name: "Phone Call",
  description:
    "Gellert-format note for a phone encounter — who was spoken with, the purpose, the patient's own words, and the plan.",
  noteType: "phone",
  encounterTypes: ["phone_call"],
  billable: true,
  manualSection: "Manual §2 — Phone Calls",
  fields: [
    {
      id: "call-time",
      label: "Call start time",
      type: "time",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Navigator placed a phone call at ",
      narrativeSuffix: " ",
      placeholder: "2:10PM",
    },
    {
      id: "spoke-with",
      label: "Spoke with",
      type: "select",
      required: true,
      section: "Encounter",
      options: ["patient", "caregiver / family member", "provider office", "pharmacy"],
      narrativePrefix: "and spoke with the ",
      narrativeSuffix: ". ",
    },
    {
      id: "call-purpose",
      label: "Call purpose",
      type: "text",
      required: true,
      section: "Encounter",
      narrativePrefix: "The purpose of the call was ",
      narrativeSuffix: ". ",
      placeholder: "e.g. to confirm Friday's cardiology appointment",
    },
    {
      id: "patient-statements",
      label: "Patient statements / involvement",
      type: "textarea",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Patient ",
      narrativeSuffix: " ",
      placeholder: "What did the patient say? Use direct quotes for notable statements.",
    },
    {
      id: "plan",
      label: "Plan / next steps",
      type: "textarea",
      required: true,
      section: "Wrap-Up",
      narrativePrefix: "Plan: ",
      narrativeSuffix: " ",
      placeholder: "What happens next?",
    },
    {
      id: "call-end-time",
      label: "Call end time",
      type: "time",
      required: true,
      section: "Wrap-Up",
      neverSkip: true,
      narrativePrefix: "The call ended at ",
      narrativeSuffix: ".",
      placeholder: "2:25PM",
    },
    {
      id: "duration",
      label: "Total call time",
      type: "time-duration",
      required: true,
      section: "Wrap-Up",
      neverSkip: true,
      narrativePrefix: " Total = ",
      narrativeSuffix: " minutes.",
    },
  ],
}

// ============================================================================
// TEMPLATE: MEDICAL APPOINTMENT ± TRANSIT (the pattern for the others)
// ============================================================================

const medicalAppointmentTemplate: NoteTemplate = {
  id: "template-gellert-medical",
  name: "Medical Appointment ± Transit",
  description:
    "Gellert-format note for accompanying a patient to a medical appointment, with an optional transit section gated behind 'Transport provided?'",
  noteType: "visit",
  encounterTypes: ["medical_appointment"],
  billable: true,
  manualSection: "Manual §3 — Medical Appointments",
  fields: [
    ...transitFields(),
    {
      id: "in-transit-coaching",
      label: "In-transit coaching delivered",
      type: "multi-select",
      options: [
        "Connection — rapport check-in",
        "Preparation — what to expect",
        "Education — condition basics",
        "Reinforcement — adherence importance",
      ],
      required: false,
      section: "Transit",
      showIf: { fieldId: "transport-provided", equals: true },
      narrativePrefix: " In-transit coaching included: ",
      narrativeJoiner: "; ",
      narrativeSuffix: ".",
    },
    // --- Encounter ----------------------------------------------------------
    {
      id: "arrival-time",
      label: "Arrival time at office",
      type: "time",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Navigator and patient arrived at the office at ",
      narrativeSuffix: ". ",
      placeholder: "10:05AM",
    },
    {
      id: "office-provider",
      label: "Provider seen",
      type: "provider",
      required: true,
      section: "Encounter",
      optionsSource: "providers",
      autoFill: { source: "provider" },
      narrativePrefix: "Patient was seen by ",
      narrativeSuffix: ". ",
    },
    {
      id: "provider-guidance",
      label: "Provider guidance / instructions",
      type: "textarea",
      required: true,
      section: "Encounter",
      autoFill: { source: "previousNote", key: "provider-guidance" },
      narrativePrefix: "The provider advised: ",
      narrativeSuffix: " ",
      placeholder: "What did the provider tell the patient?",
    },
    patientResponseField(),
    // --- Wrap-Up ------------------------------------------------------------
    {
      id: "follow-up-date",
      label: "Follow-up date",
      type: "text",
      required: false,
      section: "Wrap-Up",
      autoFill: { source: "previousNote", key: "follow-up-date" },
      narrativePrefix: "A follow-up appointment was scheduled for ",
      narrativeSuffix: " ",
      placeholder: "e.g. March 4",
    },
    {
      id: "follow-up-time",
      label: "Follow-up time",
      type: "time",
      required: false,
      section: "Wrap-Up",
      narrativePrefix: "at ",
      narrativeSuffix: " ",
      placeholder: "2:30PM",
    },
    {
      id: "follow-up-address",
      label: "Follow-up location / address",
      type: "text",
      required: false,
      section: "Wrap-Up",
      autoFill: { source: "provider", key: "address" },
      narrativePrefix: "at ",
      narrativeSuffix: ". ",
    },
    ...inPersonWrapUpFields(),
  ],
}

// ============================================================================
// TEMPLATE: BEHAVIORAL HEALTH ± TRANSIT
// ============================================================================

const behavioralHealthTemplate: NoteTemplate = {
  id: "template-gellert-bh",
  name: "Behavioral Health ± Transit",
  description:
    "Gellert-format note for behavioral health appointments — SI/HI/AH/VH safety screening is required and never skipped.",
  noteType: "visit",
  encounterTypes: ["behavioral_health"],
  billable: true,
  manualSection: "Manual §4 — Behavioral Health Appointments",
  fields: [
    ...transitFields(),
    {
      id: "in-transit-coaching",
      label: "In-transit coaching delivered",
      type: "multi-select",
      options: [
        "Connection — rapport check-in",
        "Preparation — what to expect",
        "Education — condition basics",
        "Reinforcement — adherence importance",
      ],
      required: false,
      section: "Transit",
      showIf: { fieldId: "transport-provided", equals: true },
      narrativePrefix: " In-transit coaching included: ",
      narrativeJoiner: "; ",
      narrativeSuffix: ".",
    },
    // --- Encounter ----------------------------------------------------------
    {
      id: "arrival-time",
      label: "Arrival time at office",
      type: "time",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Navigator and patient arrived at the office at ",
      narrativeSuffix: ". ",
      placeholder: "1:00PM",
    },
    {
      id: "bh-provider",
      label: "Provider seen",
      type: "provider",
      required: true,
      section: "Encounter",
      optionsSource: "providers",
      autoFill: { source: "provider" },
      narrativePrefix: "Patient was seen by ",
      narrativeSuffix: ". ",
    },
    {
      id: "safety-screen",
      label: "Safety screen — patient denied",
      type: "multi-select",
      required: true,
      section: "Encounter",
      neverSkip: true,
      options: [
        "Suicidal ideation (SI)",
        "Homicidal ideation (HI)",
        "Auditory hallucinations (AH)",
        "Visual hallucinations (VH)",
      ],
      narrativePrefix: "Patient denied: ",
      narrativeJoiner: ", ",
      narrativeSuffix: ". ",
    },
    {
      id: "safety-screen-findings",
      label: "Positive safety-screen findings",
      type: "textarea",
      required: false,
      section: "Encounter",
      narrativePrefix: "Positive findings: ",
      narrativeSuffix: " ",
      placeholder: "Document any positive findings with direct quotes; leave blank if all denied.",
    },
    {
      id: "med-changes",
      label: "Medication changes discussed",
      type: "textarea",
      required: false,
      section: "Encounter",
      narrativePrefix: "Medication changes discussed: ",
      narrativeSuffix: " ",
      placeholder: "e.g. sertraline increased from 50mg to 100mg daily",
    },
    patientResponseField(),
    // --- Wrap-Up ------------------------------------------------------------
    {
      id: "follow-up-date",
      label: "Follow-up date",
      type: "text",
      required: false,
      section: "Wrap-Up",
      autoFill: { source: "previousNote", key: "follow-up-date" },
      narrativePrefix: "A follow-up appointment was scheduled for ",
      narrativeSuffix: ". ",
      placeholder: "e.g. March 4",
    },
    ...inPersonWrapUpFields(),
  ],
}

// ============================================================================
// TEMPLATE: LAB / IMAGING
// ============================================================================

const labImagingTemplate: NoteTemplate = {
  id: "template-gellert-lab",
  name: "Lab / Imaging",
  description:
    "Gellert-format note for lab draws and imaging appointments — facility, orders completed, and results follow-up.",
  noteType: "visit",
  encounterTypes: ["lab_imaging"],
  billable: true,
  manualSection: "Manual §5 — Lab & Imaging",
  fields: [
    ...transitFields(),
    // --- Encounter ----------------------------------------------------------
    {
      id: "arrival-time",
      label: "Arrival time at facility",
      type: "time",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Navigator and patient arrived at the facility at ",
      narrativeSuffix: ". ",
      placeholder: "8:15AM",
    },
    {
      id: "facility",
      label: "Facility",
      type: "provider",
      required: true,
      section: "Encounter",
      optionsSource: "providers",
      autoFill: { source: "provider" },
      narrativePrefix: "Services were completed at ",
      narrativeSuffix: ". ",
    },
    {
      id: "orders-completed",
      label: "Orders completed",
      type: "textarea",
      required: true,
      section: "Encounter",
      narrativePrefix: "Orders completed: ",
      narrativeSuffix: " ",
      placeholder: "e.g. CBC and lipid panel drawn; chest X-ray completed",
    },
    {
      id: "results-follow-up",
      label: "Results follow-up",
      type: "text",
      required: true,
      section: "Encounter",
      narrativePrefix: "Results follow-up: ",
      narrativeSuffix: ". ",
      placeholder: "Who reviews the results, and when?",
    },
    patientResponseField(),
    ...inPersonWrapUpFields(),
  ],
}

// ============================================================================
// TEMPLATE: MEDICATION ASSISTANCE
// ============================================================================

const medicationAssistanceTemplate: NoteTemplate = {
  id: "template-gellert-med-assist",
  name: "Medication Assistance",
  description:
    "Gellert-format note for pillbox and refill support — the medication no-touch attestation is required, verbatim.",
  noteType: "visit",
  encounterTypes: ["medication_assistance"],
  billable: true,
  manualSection: "Manual §6 — Medication Assistance",
  fields: [
    // --- Encounter ----------------------------------------------------------
    {
      id: "arrival-time",
      label: "Arrival time",
      type: "time",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Navigator arrived at the patient's home at ",
      narrativeSuffix: ". ",
      placeholder: "9:00AM",
    },
    {
      id: "pillbox-activity",
      label: "Pillbox / refill activity",
      type: "textarea",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "",
      narrativeSuffix: " ",
      placeholder: "What did the patient do? e.g. Patient filled the weekly pillbox compartments while Navigator read each label aloud.",
    },
    {
      id: "no-touch-attestation",
      label: "Medication no-touch attestation",
      type: "attestation",
      required: true,
      section: "Encounter",
      neverSkip: true,
      attestationText: MED_NO_TOUCH_LANGUAGE,
      narrativeSuffix: " ",
    },
    {
      id: "pharmacy",
      label: "Pharmacy",
      type: "provider",
      required: false,
      section: "Encounter",
      optionsSource: "providers",
      autoFill: { source: "patientFact", key: "preferredPharmacy" },
      narrativePrefix: "Refills were coordinated with ",
      narrativeSuffix: ". ",
    },
    patientResponseField(),
    ...inPersonWrapUpFields(),
  ],
}

// ============================================================================
// TEMPLATE: SDOH / RESOURCE NAVIGATION
// ============================================================================

const sdohTemplate: NoteTemplate = {
  id: "template-gellert-sdoh",
  name: "SDOH / Resource Navigation",
  description:
    "Gellert-format note for social-needs assistance — the need category, the resource connected, and any Unite Us referral.",
  noteType: "visit",
  encounterTypes: ["sdoh"],
  billable: true,
  manualSection: "Manual §7 — SDOH & Resource Navigation",
  fields: [
    // --- Encounter ----------------------------------------------------------
    {
      id: "arrival-time",
      label: "Start time",
      type: "time",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Navigator met with the patient at ",
      narrativeSuffix: ". ",
      placeholder: "11:30AM",
    },
    {
      id: "need-category",
      label: "Need category",
      type: "select",
      required: true,
      section: "Encounter",
      options: [
        "Housing",
        "Food security",
        "Transportation",
        "Utilities",
        "Employment",
        "Insurance / benefits",
        "Other",
      ],
      narrativePrefix: "Navigator assisted the patient with a ",
      narrativeSuffix: " need. ",
    },
    {
      id: "resource-connected",
      label: "Resource connected",
      type: "textarea",
      required: true,
      section: "Encounter",
      narrativePrefix: "Resource connected: ",
      narrativeSuffix: " ",
      placeholder: "e.g. St. Mary's Food Bank weekly delivery program; intake call completed together",
    },
    {
      id: "unite-us-referral",
      label: "Unite Us referral",
      type: "select",
      required: false,
      section: "Encounter",
      options: ["Submitted", "Already open", "Not needed"],
      narrativePrefix: "Unite Us referral: ",
      narrativeSuffix: ". ",
    },
    patientResponseField(),
    ...inPersonWrapUpFields(),
  ],
}

// ============================================================================
// TEMPLATE: MULTIDISCIPLINARY CONTINUATION (non-billable, no transit)
// ============================================================================

const multidisciplinaryTemplate: NoteTemplate = {
  id: "template-gellert-multidisciplinary",
  name: "Multidisciplinary Continuation",
  description:
    "Second-or-later note on a multi-appointment day — appointment content ONLY. Transport and time totals live on the first note of the day.",
  noteType: "visit",
  encounterTypes: ["multidisciplinary"],
  billable: false,
  manualSection: "Manual §8 — Multidisciplinary Days",
  fields: [
    // --- Encounter (no Transit section by design) ---------------------------
    {
      id: "arrival-time",
      label: "Arrival time at appointment",
      type: "time",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Navigator and patient arrived at the appointment at ",
      narrativeSuffix: ". ",
      placeholder: "1:45PM",
    },
    {
      id: "office-provider",
      label: "Provider seen",
      type: "provider",
      required: true,
      section: "Encounter",
      optionsSource: "providers",
      autoFill: { source: "provider" },
      narrativePrefix: "Patient was seen by ",
      narrativeSuffix: ". ",
    },
    {
      id: "provider-guidance",
      label: "Provider guidance / instructions",
      type: "textarea",
      required: true,
      section: "Encounter",
      narrativePrefix: "The provider advised: ",
      narrativeSuffix: " ",
      placeholder: "What did the provider tell the patient?",
    },
    patientResponseField(),
    // --- Wrap-Up (no duration — the day total stays on the primary note) ----
    {
      id: "follow-up-date",
      label: "Follow-up date",
      type: "text",
      required: false,
      section: "Wrap-Up",
      narrativePrefix: "A follow-up appointment was scheduled for ",
      narrativeSuffix: ". ",
      placeholder: "e.g. March 4",
    },
    {
      id: "with-patient-until",
      label: "With patient until",
      type: "time",
      required: true,
      section: "Wrap-Up",
      neverSkip: true,
      narrativePrefix: `${WITH_PATIENT_UNTIL_PHRASE} `,
      narrativeSuffix: ".",
      placeholder: "3:00PM",
    },
  ],
}

// ============================================================================
// TEMPLATE: SUPERVISION NOTE (non-billable, supervisor/admin only)
// ============================================================================

const supervisionTemplate: NoteTemplate = {
  id: "template-gellert-supervision",
  name: "Supervision Note",
  description:
    "Supervisor documentation of a case discussion with a navigator — concerns, directives, and follow-up. Never billed.",
  noteType: "supervision",
  encounterTypes: ["supervision"],
  billable: false,
  manualSection: "Playbook §6 — Supervision",
  fields: [
    {
      id: "navigator-discussed",
      label: "Navigator discussed",
      type: "select",
      required: true,
      section: "Supervision",
      optionsSource: "navigators",
      narrativePrefix: "Supervisor discussed this patient's care with Navigator ",
      narrativeSuffix: ". ",
    },
    {
      id: "concerns",
      label: "Concerns discussed",
      type: "textarea",
      required: true,
      section: "Supervision",
      narrativePrefix: "Concerns discussed: ",
      narrativeSuffix: " ",
      placeholder: "What prompted this supervision conversation?",
    },
    {
      id: "directives",
      label: "Directives given",
      type: "textarea",
      required: true,
      section: "Supervision",
      narrativePrefix: "Directives given: ",
      narrativeSuffix: " ",
      placeholder: "What was the navigator instructed to do?",
    },
    {
      id: "follow-up-date",
      label: "Supervision follow-up date",
      type: "text",
      required: false,
      section: "Supervision",
      narrativePrefix: "Supervision follow-up scheduled for ",
      narrativeSuffix: ".",
      placeholder: "e.g. next 1:1 on March 11",
    },
  ],
}

// ============================================================================
// EXPORT (initial-data.ts spreads this into initialNoteTemplates)
// ============================================================================

export const gellertNoteTemplates: NoteTemplate[] = [
  phoneCallTemplate,
  medicalAppointmentTemplate,
  behavioralHealthTemplate,
  labImagingTemplate,
  medicationAssistanceTemplate,
  sdohTemplate,
  multidisciplinaryTemplate,
  supervisionTemplate,
]

/** Is this template one of the eight Gellert manual templates? */
export function isGellertTemplate(template?: { id: string } | null): boolean {
  return !!template?.id.startsWith("template-gellert-")
}
