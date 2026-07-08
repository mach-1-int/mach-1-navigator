/* eslint-disable @typescript-eslint/no-unused-vars -- Phase 0 stub signatures are frozen; params intentionally unused */
/**
 * Note auto-fill — resolves template fields from the provider directory,
 * standing patient facts, the linked appointment, and previous notes
 * (repeat-visit recall). The cut-and-paste killer.
 *
 * PHASE 0 STUB — signatures and types are FROZEN. Workstream N-B implements
 * the resolution logic.
 */

import type { Appointment, NoteTemplate, Patient, PatientNote, Provider, StandingPatientFacts } from "./types"

export type AutoFillSource = "provider-directory" | "standing-facts" | "previous-note" | "appointment"

export interface AutoFillContext {
  patient?: Patient
  providers: Provider[]
  standingFacts?: StandingPatientFacts
  previousNotes: PatientNote[]
  appointment?: Appointment
}

export interface AutoFillResolution {
  value: unknown
  source: AutoFillSource
}

/** Assemble the context object auto-fill resolution runs against */
export function buildAutoFillContext(args: {
  patient?: Patient
  providers?: Provider[]
  standingFacts?: StandingPatientFacts
  previousNotes?: PatientNote[]
  appointment?: Appointment
}): AutoFillContext {
  return {
    patient: args.patient,
    providers: args.providers ?? [],
    standingFacts: args.standingFacts,
    previousNotes: args.previousNotes ?? [],
    appointment: args.appointment,
  }
}

/**
 * Resolve every auto-fillable field on a template to a value + provenance.
 * Phase 0 stub: resolves nothing (empty map).
 */
export function resolveTemplateAutoFill(
  _template: NoteTemplate,
  _ctx: AutoFillContext
): Record<string, AutoFillResolution> {
  return {}
}

/**
 * Repeat-visit recall: the patient's most recent note referencing the same
 * provider. Phase 0 stub: no recall.
 */
export function findPreviousNoteForProvider(
  _notes: PatientNote[],
  _patientId: string,
  _providerId: string
): PatientNote | undefined {
  return undefined
}
