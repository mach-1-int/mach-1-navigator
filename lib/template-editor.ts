/**
 * Template-editor helpers (Gellert ops blitz G-1).
 *
 * Pure functions behind components/admin/template-editor-view.tsx: id
 * slugging, template validation, duplication, the upsert semantics of the
 * context's saveNoteTemplate (mirrored here so the verify suite can exercise
 * the roundtrip without React), and plausible sample responses that power the
 * live narrative preview through generateNarrative.
 */

import type {
  EncounterType,
  NoteFieldType,
  NoteTemplate,
  PatientNote,
  Provider,
  TemplateField,
} from "./types"
import { TIME_FORMAT_REGEX } from "./gellert-templates"

// ============================================================================
// PALETTES (the editor's pickers; every NoteFieldType is covered)
// ============================================================================

export const NOTE_FIELD_TYPE_OPTIONS: { value: NoteFieldType; label: string; hint: string }[] = [
  { value: "text", label: "Text", hint: "Single-line free text" },
  { value: "textarea", label: "Long text", hint: "Multi-line narrative text" },
  { value: "select", label: "Select", hint: "One choice from a fixed list" },
  { value: "multi-select", label: "Multi-select", hint: "Any number of choices, joined in the narrative" },
  { value: "boolean", label: "Yes / No", hint: "Toggle; prefix-less booleans act as pure gates" },
  { value: "time", label: "Clock time", hint: "Manual format H:MMAM/PM (e.g. 3:03PM)" },
  { value: "time-duration", label: "Duration (minutes)", hint: "Numeric minutes total" },
  { value: "provider", label: "Provider", hint: "Picked from the provider directory, rendered in full" },
  { value: "attestation", label: "Attestation", hint: "Must-check box inserting exact manual language verbatim" },
]

export const ENCOUNTER_TYPE_OPTIONS: { value: EncounterType; label: string }[] = [
  { value: "phone_call", label: "Phone Call" },
  { value: "medical_appointment", label: "Medical Appointment" },
  { value: "behavioral_health", label: "Behavioral Health" },
  { value: "lab_imaging", label: "Lab / Imaging" },
  { value: "medication_assistance", label: "Medication Assistance" },
  { value: "sdoh", label: "SDOH" },
  { value: "multidisciplinary", label: "Multidisciplinary" },
  { value: "supervision", label: "Supervision" },
]

export const NOTE_TYPE_OPTIONS: { value: PatientNote["type"]; label: string }[] = [
  { value: "visit", label: "Visit" },
  { value: "phone", label: "Phone" },
  { value: "clinical", label: "Clinical" },
  { value: "follow-up", label: "Follow-up" },
  { value: "general", label: "General" },
  { value: "supervision", label: "Supervision" },
]

export const AUTO_FILL_SOURCE_OPTIONS: {
  value: NonNullable<TemplateField["autoFill"]>["source"]
  label: string
  hint: string
}[] = [
  { value: "provider", label: "Provider directory", hint: "Fills from the selected provider (key: address, phone, ...)" },
  { value: "patientFact", label: "Standing patient fact", hint: "Durable chart facts (key: preferredPharmacy, diabetic, ...)" },
  { value: "appointment", label: "Appointment", hint: "The appointment being documented" },
  { value: "previousNote", label: "Previous note", hint: "Carries the field forward from the patient's last note (key: field id)" },
]

/** Field types a showIf gate may target (the values are stable + comparable) */
export const SHOW_IF_TARGET_TYPES: NoteFieldType[] = ["boolean", "select"]

// ============================================================================
// IDS
// ============================================================================

/** "Pickup location" -> "pickup-location" */
export function slugifyLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "field"
}

/** Slugified id, suffixed -2/-3/... until unique among existingIds */
export function uniqueFieldId(label: string, existingIds: string[]): string {
  const base = slugifyLabel(label)
  if (!existingIds.includes(base)) return base
  let n = 2
  while (existingIds.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/** Id for a brand-new template, unique among existing template ids */
export function newTemplateId(name: string, existingTemplateIds: string[]): string {
  const base = `template-custom-${slugifyLabel(name)}`
  if (!existingTemplateIds.includes(base)) return base
  let n = 2
  while (existingTemplateIds.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// ============================================================================
// VALIDATION (runs before save; the editor blocks on any error)
// ============================================================================

export function validateTemplate(template: NoteTemplate): string[] {
  const errors: string[] = []
  if (!template.name.trim()) errors.push("Template name is required")
  if (template.fields.length === 0) errors.push("Template needs at least one field")

  const seen = new Set<string>()
  template.fields.forEach((field, index) => {
    const ordinal = `Field ${index + 1}`
    const name = field.label.trim() ? `"${field.label}"` : ordinal
    if (!field.label.trim()) errors.push(`${ordinal} needs a label`)
    if (!field.id.trim()) {
      errors.push(`${name} has no id`)
    } else if (seen.has(field.id)) {
      errors.push(`Duplicate field id "${field.id}" — ids must be unique`)
    }
    seen.add(field.id)

    if ((field.type === "select" || field.type === "multi-select") && !field.optionsSource) {
      if (!field.options || field.options.filter((o) => o.trim()).length === 0) {
        errors.push(`${name} is a ${field.type} and needs at least one option`)
      }
    }
    if (field.type === "attestation" && !field.attestationText?.trim()) {
      errors.push(`${name} is an attestation and needs its exact attestation language`)
    }
    if (field.showIf) {
      const target = template.fields.find((f) => f.id === field.showIf!.fieldId)
      if (!target) {
        errors.push(`${name} is gated by "${field.showIf.fieldId}", which is not a field on this template`)
      } else if (target.id === field.id) {
        errors.push(`${name} cannot be gated by itself`)
      }
    }
  })
  return errors
}

// ============================================================================
// DUPLICATE / UPSERT / DELETE GUARD (pure mirrors of the context actions)
// ============================================================================

/** Deep copy with a unique -copy id suffix; the copy is always custom */
export function duplicateTemplate(template: NoteTemplate, existingTemplateIds: string[]): NoteTemplate {
  const base = `${template.id}-copy`
  let id = base
  let n = 2
  while (existingTemplateIds.includes(id)) id = `${base}-${n++}`
  const copy: NoteTemplate = JSON.parse(JSON.stringify(template))
  return { ...copy, id, name: `${template.name} (Copy)`, isCustom: true }
}

/** Same semantics as demo-data-context saveNoteTemplate (upsert by id) */
export function upsertTemplate(templates: NoteTemplate[], template: NoteTemplate): NoteTemplate[] {
  const exists = templates.some((t) => t.id === template.id)
  return exists
    ? templates.map((t) => (t.id === template.id ? { ...t, ...template } : t))
    : [...templates, { ...template, isCustom: true }]
}

/** True when any saved note was written from this template */
export function isTemplateInUse(templateId: string, notes: Pick<PatientNote, "templateId">[]): boolean {
  return notes.some((n) => n.templateId === templateId)
}

/** Same guard as demo-data-context deleteNoteTemplate */
export function canDeleteTemplate(
  templateId: string,
  templates: NoteTemplate[],
  notes: Pick<PatientNote, "templateId">[]
): boolean {
  return templates.some((t) => t.id === templateId) && !isTemplateInUse(templateId, notes)
}

// ============================================================================
// SAMPLE RESPONSES (live preview: plausible answers per field type)
// ============================================================================

const SAMPLE_TIMES = ["9:40AM", "10:05AM", "11:15AM", "1:30PM", "2:45PM", "4:10PM"]

function sampleText(field: TemplateField, fallback: string): string {
  const placeholder = field.placeholder?.trim()
  if (placeholder && !placeholder.endsWith("?")) {
    return placeholder.replace(/^e\.g\.?,?\s*/i, "")
  }
  return fallback
}

/**
 * Plausible responses for every field so generateNarrative renders the exact
 * saved-form output. showIf gate fields are forced to their gate value so the
 * gated language previews too.
 */
export function sampleResponses(template: NoteTemplate, providers?: Provider[]): Record<string, unknown> {
  const responses: Record<string, unknown> = {}
  let timeIndex = 0

  template.fields.forEach((field) => {
    switch (field.type) {
      case "text":
        responses[field.id] = sampleText(field, "as documented")
        break
      case "textarea":
        responses[field.id] = sampleText(field, "verbalized understanding and agreed with the plan")
        break
      case "select":
        responses[field.id] = field.options?.[0] ?? "documented"
        break
      case "multi-select":
        responses[field.id] = field.options?.slice(0, 2) ?? []
        break
      case "boolean":
        responses[field.id] = true
        break
      case "time": {
        const placeholder = field.placeholder?.trim()
        responses[field.id] =
          placeholder && TIME_FORMAT_REGEX.test(placeholder)
            ? placeholder
            : SAMPLE_TIMES[timeIndex % SAMPLE_TIMES.length]
        timeIndex++
        break
      }
      case "time-duration":
        responses[field.id] = 45
        break
      case "provider":
        responses[field.id] = providers?.[0]?.id ?? "the provider on file"
        break
      case "attestation":
        responses[field.id] = true
        break
    }
  })

  // Open every showIf gate so conditional narrative language previews
  template.fields.forEach((field) => {
    if (field.showIf) responses[field.showIf.fieldId] = field.showIf.equals
  })

  return responses
}
