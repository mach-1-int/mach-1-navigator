/**
 * Gellert note templates — the Note-Taking Manual as executable data.
 *
 * Phase 0 ships the shared constants and ONE complete template (Medical
 * Appointment ± Transit) as the pattern. Workstream N-A fills the remaining
 * seven (Phone, BH ± Transit, Lab/Imaging, Medication Assistance, SDOH,
 * Multidisciplinary Continuation, Supervision) using the SAME frozen template
 * ids from lib/note-taxonomy.ts.
 *
 * Conventions (from the manual):
 * - Third person throughout ("Navigator arrived at...", never "I").
 * - Clock times in H:MMAM/PM with a colon ("10:05AM", never "10am").
 * - Every billable note closes with presence + "Total = X minutes."
 */

import type { NoteTemplate } from "./types"

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

// ============================================================================
// TEMPLATE: MEDICAL APPOINTMENT ± TRANSIT (the pattern for the other seven)
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
    // --- Transit (gated) ----------------------------------------------------
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
    {
      id: "patient-response",
      label: "Patient response / involvement",
      type: "textarea",
      required: true,
      section: "Encounter",
      neverSkip: true,
      narrativePrefix: "Patient ",
      narrativeSuffix: " ",
      placeholder: "What did the patient say or do? Use direct quotes for notable statements.",
    },
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
  ],
}

// ============================================================================
// EXPORT (initial-data.ts spreads this into initialNoteTemplates)
// ============================================================================

export const gellertNoteTemplates: NoteTemplate[] = [medicalAppointmentTemplate]
