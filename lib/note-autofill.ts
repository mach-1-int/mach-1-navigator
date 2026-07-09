/**
 * Note auto-fill — resolves template fields from the provider directory,
 * standing patient facts, the linked appointment, and previous notes
 * (repeat-visit recall). The cut-and-paste killer.
 */

import type { Appointment, EncounterType, NoteTemplate, Patient, PatientNote, Provider, StandingPatientFacts, TemplateField } from "./types"

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

/** Which directory entry types are the natural match for each encounter type */
const PROVIDER_TYPES_BY_ENCOUNTER: Partial<Record<EncounterType, Provider["type"][]>> = {
  medical_appointment: ["pcp", "specialist"],
  behavioral_health: ["behavioral_health"],
  lab_imaging: ["lab_imaging"],
  medication_assistance: ["pharmacy"],
}

/** "Name Dose — frequency" joined list, for the med-assist template's current-med recall */
function formatCurrentMedications(patient: Patient | undefined): string | undefined {
  if (!patient || patient.medications.length === 0) return undefined
  return patient.medications.map((m) => `${m.name} ${m.dosage} — ${m.frequency}`).join("; ")
}

function formatProviderAddress(provider: Provider): string {
  const { street, city, state, zip } = provider.address
  return `${street}, ${city}, ${state} ${zip}`
}

/** Normalize "10:00", "10:00 AM", "2:30pm" to the manual's canonical "10:00AM" */
function normalizeClockTime(raw: string): string | undefined {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return undefined
  let hours = parseInt(match[1], 10)
  const minutes = match[2]
  let meridiem = match[3]?.toUpperCase() as "AM" | "PM" | undefined
  if (!meridiem) {
    meridiem = hours >= 12 ? "PM" : "AM"
    if (hours > 12) hours -= 12
    if (hours === 0) hours = 12
  }
  return `${hours}:${minutes}${meridiem}`
}

/** The linked provider this template's encounter naturally maps to */
function pickLinkedProvider(template: NoteTemplate, ctx: AutoFillContext): Provider | undefined {
  const linked = (ctx.patient?.providerIds ?? [])
    .map((id) => ctx.providers.find((p) => p.id === id))
    .filter((p): p is Provider => Boolean(p))
  if (linked.length === 0) return undefined
  const preferredTypes = template.encounterTypes?.flatMap((t) => PROVIDER_TYPES_BY_ENCOUNTER[t] ?? []) ?? []
  for (const type of preferredTypes) {
    const match = linked.find((p) => p.type === type)
    if (match) return match
  }
  return linked[0]
}

function resolveStandingFact(facts: StandingPatientFacts, key: string | undefined): unknown {
  switch (key) {
    case "preferredPharmacy":
    case "preferredPharmacyProviderId":
      return facts.preferredPharmacyProviderId
    case "diabetic":
      return facts.diabetic
    case "colonoscopy":
      return facts.colonoscopy?.status
    case "mammogram":
      return facts.mammogram?.status
    default:
      return undefined
  }
}

function resolveFromAppointment(field: TemplateField, ctx: AutoFillContext): unknown {
  if (!ctx.appointment) return undefined
  const key = field.autoFill?.key
  if (key === "date") return ctx.appointment.date
  if (key === "location" || key === "address") {
    const address = ctx.patient?.address
    return address ? `${address.street}, ${address.city}` : undefined
  }
  if (key === "time" || field.type === "time") return normalizeClockTime(ctx.appointment.time)
  return undefined
}

/**
 * Resolve every auto-fillable field on a template to a value + provenance.
 * Provider fields fill from the patient's directory links, patientFact fields
 * from standing facts, appointment fields from the linked appointment, and
 * previousNote fields from the last note for the same provider ("from last visit").
 */
export function resolveTemplateAutoFill(
  template: NoteTemplate,
  ctx: AutoFillContext
): Record<string, AutoFillResolution> {
  const resolved: Record<string, AutoFillResolution> = {}
  const linkedProvider = pickLinkedProvider(template, ctx)
  const previousNote =
    ctx.patient && linkedProvider
      ? findPreviousNoteForProvider(ctx.previousNotes, ctx.patient.id, linkedProvider.id)
      : undefined

  for (const field of template.fields) {
    if (!field.autoFill) continue
    let value: unknown
    let source: AutoFillSource

    switch (field.autoFill.source) {
      case "provider": {
        if (!linkedProvider) continue
        if (field.type === "provider") {
          value = linkedProvider.id
        } else if (field.autoFill.key === "address") {
          value = formatProviderAddress(linkedProvider)
        } else if (field.autoFill.key) {
          value = (linkedProvider as unknown as Record<string, unknown>)[field.autoFill.key]
        } else {
          value = `${linkedProvider.name} at ${linkedProvider.practiceName}`
        }
        source = "provider-directory"
        break
      }
      case "patientFact": {
        if (!ctx.standingFacts) continue
        value = resolveStandingFact(ctx.standingFacts, field.autoFill.key)
        source = "standing-facts"
        break
      }
      case "appointment": {
        value = resolveFromAppointment(field, ctx)
        source = "appointment"
        break
      }
      case "previousNote": {
        value = previousNote?.responses?.[field.autoFill.key ?? field.id]
        source = "previous-note"
        break
      }
    }

    if (value === undefined || value === null || value === "") continue
    resolved[field.id] = { value, source }
  }

  // Additive: medication-assistance template's activity field recalls the
  // patient's CURRENT medication list ("Name Dose — frequency", joined) so
  // the navigator starts from what's on chart instead of a blank narrative.
  if (template.id === "template-gellert-med-assist" && !resolved["pillbox-activity"]) {
    const currentMeds = formatCurrentMedications(ctx.patient)
    if (currentMeds) {
      resolved["pillbox-activity"] = {
        value: `Current medications on file: ${currentMeds}.`,
        source: "standing-facts",
      }
    }
  }

  return resolved
}

/**
 * Repeat-visit recall: the patient's most recent note whose responses
 * reference the same provider.
 */
export function findPreviousNoteForProvider(
  notes: PatientNote[],
  patientId: string,
  providerId: string
): PatientNote | undefined {
  return notes
    .filter(
      (note) =>
        note.patientId === patientId &&
        note.responses &&
        Object.values(note.responses).includes(providerId)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}
