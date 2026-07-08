import type { NoteTemplate, Provider, TemplateField } from "./types"

export interface NarrativeContext {
  providers?: Provider[]
}

/**
 * Generate a clinical narrative from a template and user responses.
 *
 * Mirrors the context-level generator in lib/demo-data-context.tsx exactly so
 * note-builder previews match saved narratives:
 * 1. Loop through the template fields (skipping fields hidden by showIf gates)
 * 2. If a response exists for that field, construct the sentence segment:
 *    [Prefix] + [Response Value] + [Suffix]
 * 3. Join the segments into a cohesive paragraph string
 * 4. Handle edge cases (like empty optional fields)
 *
 * @param template - The note template with field definitions
 * @param responses - Record of field IDs to their response values
 * @param context - Optional providers so Gellert "provider" fields render
 *   their full display string instead of a raw providerId
 * @returns The generated narrative string
 */
export function generateNarrative(
  template: NoteTemplate,
  responses: Record<string, unknown>,
  context?: NarrativeContext
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

    // Fields hidden by an unmet showIf gate contribute nothing
    if (field.showIf && responses[field.showIf.fieldId] !== field.showIf.equals) {
      return
    }

    const segment = buildFieldSegment(field, value, context)
    if (segment) {
      parts.push(segment)
    }
  })

  return parts.join("")
}

/** Full provider display string ("Dr. Jane Smith, MD at Desert Family Medicine, 4045 W Main St, Phoenix, AZ 85004") */
export function formatProviderDisplay(provider: Provider): string {
  return `${provider.name}${provider.credential ? `, ${provider.credential}` : ""} at ${provider.practiceName}, ${provider.address.street}, ${provider.address.city}, ${provider.address.state} ${provider.address.zip}`
}

/**
 * Build a narrative segment for a single field.
 * Constructs: [Prefix] + [FormattedValue] + [Suffix]
 */
function buildFieldSegment(field: TemplateField, value: unknown, context?: NarrativeContext): string {
  const prefix = field.narrativePrefix || ""
  const suffix = field.narrativeSuffix || ""

  switch (field.type) {
    case "select":
    case "text":
    case "textarea":
    case "time":
      // Simple text-based fields: directly insert the value
      return `${prefix}${value}${suffix}`

    case "provider": {
      const provider = context?.providers?.find((p) => p.id === value)
      const display = provider ? formatProviderDisplay(provider) : String(value)
      return `${prefix}${display}${suffix}`
    }

    case "attestation":
      // Attestations insert the manual's exact language, verbatim, only when true
      if (value === true && field.attestationText) {
        return `${prefix}${field.attestationText}${suffix}`
      }
      return ""

    case "multi-select":
      // Join multiple selections with the specified joiner
      if (Array.isArray(value) && value.length > 0) {
        const joiner = field.narrativeJoiner || ", "
        const joined = value.join(joiner)
        return `${prefix}${joined}${suffix}`
      }
      return ""

    case "boolean":
      // Prefix-less booleans are pure gates (e.g. transport-provided) and
      // contribute no narrative of their own
      if (value === true && prefix) {
        return `${prefix}reviewed and discussed${suffix}`
      } else if (value === false && prefix) {
        // Handle specific false cases based on field context
        if (field.id === "supervisor-notified") {
          return `${prefix}was not notified${suffix}`
        }
        return `${prefix}not reviewed${suffix}`
      }
      return ""

    case "time-duration":
      // Duration fields: only include if positive value
      if (typeof value === "number" && value > 0) {
        return `${prefix}${value}${suffix}`
      }
      return ""

    default:
      return ""
  }
}

/** Canonical manual clock format: "3:03PM" — colon plus AM/PM, no space */
const CLOCK_FORMAT = /^\d{1,2}:\d{2}(AM|PM)$/

/**
 * Validate that all required fields have responses.
 * Fields hidden by an unmet showIf gate are skipped entirely.
 * Returns an object with field IDs mapped to error messages.
 */
export function validateResponses(
  template: NoteTemplate,
  responses: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {}

  template.fields.forEach((field) => {
    if (field.showIf && responses[field.showIf.fieldId] !== field.showIf.equals) {
      return
    }

    const value = responses[field.id]

    if (field.type === "time" && typeof value === "string" && value !== "" && !CLOCK_FORMAT.test(value)) {
      errors[field.id] = `${field.label} must use the H:MMAM/PM format (e.g. 3:03PM)`
      return
    }

    if (field.required) {
      if (field.type === "attestation") {
        if (value !== true) {
          errors[field.id] = `${field.label} must be attested`
        }
      } else if (value === undefined || value === null || value === "") {
        errors[field.id] = `${field.label} is required`
      } else if (field.type === "multi-select" && Array.isArray(value) && value.length === 0) {
        errors[field.id] = `Select at least one ${field.label.toLowerCase()}`
      } else if (field.type === "time-duration" && (typeof value !== "number" || value <= 0)) {
        errors[field.id] = `${field.label} must be greater than 0`
      } else if (field.type === "boolean" && typeof value !== "boolean") {
        errors[field.id] = `${field.label} is required`
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
