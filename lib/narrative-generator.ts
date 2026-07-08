import type { NoteTemplate, TemplateField } from "./types"

/**
 * Generate a clinical narrative from a template and user responses.
 *
 * Logic:
 * 1. Loop through the template fields
 * 2. If a response exists for that field, construct the sentence segment:
 *    [Prefix] + [Response Value] + [Suffix]
 * 3. Join the segments into a cohesive paragraph string
 * 4. Handle edge cases (like empty optional fields)
 *
 * @param template - The note template with field definitions
 * @param responses - Record of field IDs to their response values
 * @returns The generated narrative string
 */
export function generateNarrative(
  template: NoteTemplate,
  responses: Record<string, unknown>
): string {
  const parts: string[] = []

  template.fields.forEach((field: TemplateField) => {
    const value = responses[field.id]

    // Skip empty/null/undefined values (edge case handling for optional fields)
    if (value === undefined || value === null || value === "") {
      return
    }

    // Skip empty arrays for multi-select
    if (Array.isArray(value) && value.length === 0) {
      return
    }

    // Cast: `responses` is keyed by arbitrary field IDs typed as `unknown`.
    // The AI-scribe autofill path (lib/gemini-scribe.ts) does not currently
    // validate that AI-extracted values match the field's expected shape
    // before merging them into responses, so this assumption isn't
    // runtime-enforced today (see follow-up PR for the validation gap).
    const segment = buildFieldSegment(field, value as NoteFieldValue)
    if (segment) {
      parts.push(segment)
    }
  })

  return parts.join("")
}

/**
 * The runtime shape a response value takes, keyed by the field's type:
 * select/text/textarea -> string, multi-select -> string[],
 * boolean -> boolean, time-duration -> number.
 */
type NoteFieldValue = string | string[] | boolean | number

/** Simple text-based fields (select/text/textarea): directly insert the value. */
function buildTextSegment(prefix: string, suffix: string, value: NoteFieldValue): string {
  return `${prefix}${value}${suffix}`
}

/** Multi-select fields: join the selected values with the field's joiner (default ", "). */
function buildMultiSelectSegment(field: TemplateField, prefix: string, suffix: string, value: NoteFieldValue): string {
  if (!Array.isArray(value) || value.length === 0) return ""
  const joiner = field.narrativeJoiner || ", "
  return `${prefix}${value.join(joiner)}${suffix}`
}

/** Boolean fields: a contextual phrase for true, and a field-specific phrase for false. */
function buildBooleanSegment(field: TemplateField, prefix: string, suffix: string, value: NoteFieldValue): string {
  if (value === true) return `${prefix}reviewed and discussed${suffix}`
  if (value !== false || !prefix) return ""
  if (field.id === "supervisor-notified") return `${prefix}was not notified${suffix}`
  return `${prefix}not reviewed${suffix}`
}

/** Duration fields: only included when the value is a positive number. */
function buildDurationSegment(prefix: string, suffix: string, value: NoteFieldValue): string {
  if (typeof value !== "number" || value <= 0) return ""
  return `${prefix}${value}${suffix}`
}

/**
 * Build a narrative segment for a single field.
 * Constructs: [Prefix] + [FormattedValue] + [Suffix]
 */
function buildFieldSegment(field: TemplateField, value: NoteFieldValue): string {
  const prefix = field.narrativePrefix || ""
  const suffix = field.narrativeSuffix || ""

  switch (field.type) {
    case "select":
    case "text":
    case "textarea":
      return buildTextSegment(prefix, suffix, value)
    case "multi-select":
      return buildMultiSelectSegment(field, prefix, suffix, value)
    case "boolean":
      return buildBooleanSegment(field, prefix, suffix, value)
    case "time-duration":
      return buildDurationSegment(prefix, suffix, value)
    default:
      return ""
  }
}

/**
 * Validate that all required fields have responses.
 * Returns an object with field IDs mapped to error messages.
 */
export function validateResponses(
  template: NoteTemplate,
  responses: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {}

  template.fields.forEach((field) => {
    if (field.required) {
      const value = responses[field.id]

      if (value === undefined || value === null || value === "") {
        errors[field.id] = `${field.label} is required`
      } else if (field.type === "multi-select" && Array.isArray(value) && value.length === 0) {
        errors[field.id] = `Select at least one ${field.label.toLowerCase()}`
      } else if (field.type === "time-duration" && (typeof value !== "number" || value <= 0)) {
        errors[field.id] = `${field.label} must be greater than 0`
      }
    }
  })

  return errors
}

/**
 * Check if the form has any validation errors.
 */
export function isValidForm(
  template: NoteTemplate,
  responses: Record<string, unknown>
): boolean {
  const errors = validateResponses(template, responses)
  return Object.keys(errors).length === 0
}
