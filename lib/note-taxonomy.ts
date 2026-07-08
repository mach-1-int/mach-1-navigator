/**
 * Note taxonomy — maps the Gellert encounter types to note templates and
 * provides the legacy fallback for appointments created before encounterType
 * existed. Consumed by the scheduler UI, note-builder pre-selection, and the
 * AI scribe context.
 */

import type { Appointment, EncounterType } from "./types"

export const ENCOUNTER_TYPE_LABELS: Record<EncounterType, string> = {
  phone_call: "Phone Call",
  medical_appointment: "Medical Appointment",
  behavioral_health: "Behavioral Health",
  lab_imaging: "Lab / Imaging",
  medication_assistance: "Medication Assistance",
  sdoh: "SDOH / Resource",
  multidisciplinary: "Multidisciplinary (Continuation)",
  supervision: "Supervision",
}

/**
 * Gellert template ids per encounter type. IDs are FROZEN here in Phase 0;
 * lib/gellert-templates.ts fills the remaining template bodies (N-A).
 */
const TEMPLATE_ID_BY_ENCOUNTER_TYPE: Record<EncounterType, string> = {
  phone_call: "template-gellert-phone",
  medical_appointment: "template-gellert-medical",
  behavioral_health: "template-gellert-bh",
  lab_imaging: "template-gellert-lab",
  medication_assistance: "template-gellert-med-assist",
  sdoh: "template-gellert-sdoh",
  multidisciplinary: "template-gellert-multidisciplinary",
  supervision: "template-gellert-supervision",
}

/** Legacy Appointment.type -> EncounterType fallback mapping */
const LEGACY_TYPE_TO_ENCOUNTER: Record<Appointment["type"], EncounterType> = {
  phone_call: "phone_call",
  video_call: "phone_call",
  clinic: "medical_appointment",
  home_visit: "sdoh",
}

/** Resolve the encounter type for an appointment (explicit wins, legacy falls back) */
export function encounterTypeForAppointment(appt: Appointment): EncounterType {
  return appt.encounterType ?? LEGACY_TYPE_TO_ENCOUNTER[appt.type]
}

/** The Gellert note template pre-selected for an encounter type */
export function templateIdForEncounterType(encounterType: EncounterType): string {
  return TEMPLATE_ID_BY_ENCOUNTER_TYPE[encounterType]
}
