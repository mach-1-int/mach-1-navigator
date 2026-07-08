/**
 * Note compliance engine — the Gellert Note-Taking Manual as a pure rules
 * engine. Every rule carries a manual citation; blocking (fail) findings stop
 * note signing / TimeLog creation in note-builder.
 */

import type { NoteTemplate } from "./types"
import {
  INVOLVEMENT_FIELD_BY_TEMPLATE,
  MED_NO_TOUCH_LANGUAGE,
  WITH_PATIENT_UNTIL_PHRASE,
  isGellertTemplate,
} from "./gellert-templates"

export type ComplianceLevel = "pass" | "warn" | "fail"

export interface ComplianceRule {
  id: string
  title: string
  /** Direct quote / citation from the Gellert manual */
  citation: string
  appliesTo: (template?: NoteTemplate) => boolean
}

export interface ComplianceFinding {
  ruleId: string
  level: ComplianceLevel
  message: string
  citation: string
  fieldId?: string
  offendingText?: string[]
}

export interface CheckNoteComplianceInput {
  narrative: string
  template?: NoteTemplate
  responses: Record<string, unknown>
  durationMinutes: number
  isBillable: boolean
  sameDayPrimaryExists?: boolean
}

type RuleResult = Pick<ComplianceFinding, "level" | "message"> &
  Partial<Pick<ComplianceFinding, "fieldId" | "offendingText">>

interface RuleImpl extends ComplianceRule {
  check: (input: CheckNoteComplianceInput) => RuleResult
}

/** Direct patient quotes legitimately contain first person — exclude them from scans */
function stripQuotedSpeech(narrative: string): string {
  return narrative.replace(/"[^"]*"/g, " ").replace(/“[^”]*”/g, " ")
}

function snippetsAround(text: string, regex: RegExp): string[] {
  const snippets: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`)
  while ((match = re.exec(text)) !== null && snippets.length < 5) {
    const start = Math.max(0, match.index - 20)
    const end = Math.min(text.length, match.index + match[0].length + 20)
    snippets.push(`…${text.slice(start, end).trim()}…`)
  }
  return snippets
}

const FIRST_PERSON = /\b(I|we|me|my|our)\b/
const PARTICIPATION =
  /\b(said|stated|reported|responded|response|agreed|declined|asked|confirmed|denied|verbalized|demonstrated|participated|filled|refilled|completed|expressed|chose|decided|understood|voiced|involve[dm]?)\w*\b/i
const AGGRESSION =
  /\b(threat\w*|profanity|cursed|cussed|swore|swearing|threw|yelled|scream\w*|shout\w*|slammed|punched|aggressive|aggression)\b/i
const TRANSPORT_VOCAB = /\b(transport\w*|picked up|pickup|pick-up|drove|driving|dropped off|drop-off)\b/i
const TIME_TOKEN =
  /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?(?:am|pm|a\.m\.|p\.m\.))?\b|\b\d{1,2}\s?(?:am|pm|a\.m\.|p\.m\.)\b/gi
const CANONICAL_TIME = /^\d{1,2}:\d{2}(?:AM|PM)$/
const TOTAL_MINUTES = /Total = (\d+) minutes\./

function hasWithPatientUntilField(template?: NoteTemplate): boolean {
  return !!template?.fields.some((f) => f.id === "with-patient-until")
}

const RULES: RuleImpl[] = [
  {
    id: "patient-involvement",
    title: "Patient involvement documented",
    citation: "NO PATIENT INVOLVEMENT = NO BILLING. Every note must state what the patient said or did.",
    appliesTo: (template) => template?.noteType !== "supervision",
    check: ({ narrative, template, responses }) => {
      const involvementFieldId = template ? INVOLVEMENT_FIELD_BY_TEMPLATE[template.id] : undefined
      const failLevel: ComplianceLevel = isGellertTemplate(template) ? "fail" : "warn"

      if (involvementFieldId) {
        const value = responses[involvementFieldId]
        if (typeof value !== "string" || value.trim() === "") {
          return {
            level: failLevel,
            message: 'Patient involvement field is empty. "NO PATIENT INVOLVEMENT = NO BILLING."',
            fieldId: involvementFieldId,
          }
        }
      }
      if (!/\bpatient\b/i.test(narrative) || !PARTICIPATION.test(narrative)) {
        return {
          level: failLevel,
          message: 'Narrative does not reference patient participation. "NO PATIENT INVOLVEMENT = NO BILLING."',
          fieldId: involvementFieldId,
        }
      }
      return { level: "pass", message: "Narrative documents what the patient said or did." }
    },
  },
  {
    id: "third-person",
    title: "Third person throughout",
    citation: 'Notes are written in third person ("Navigator", he/she/they) — never "I" or "we". Direct patient quotes are the exception.',
    appliesTo: () => true,
    check: ({ narrative }) => {
      const scannable = stripQuotedSpeech(narrative)
      if (FIRST_PERSON.test(scannable)) {
        return {
          level: "warn",
          message: "First-person language found outside direct quotes — rewrite as “Navigator…”.",
          offendingText: snippetsAround(scannable, FIRST_PERSON),
        }
      }
      return { level: "pass", message: "No first-person language outside direct quotes." }
    },
  },
  {
    id: "time-format",
    title: "Manual time format (H:MMAM/PM)",
    citation: "Every timestamp uses a colon and AM/PM (e.g., 3:03PM) — never “3pm” or 24-hour time.",
    appliesTo: () => true,
    check: ({ narrative }) => {
      const offenders = (narrative.match(TIME_TOKEN) ?? []).filter((token) => !CANONICAL_TIME.test(token))
      if (offenders.length > 0) {
        return {
          level: "warn",
          message: `Non-manual time format: ${offenders.slice(0, 4).join(", ")}. Use H:MMAM/PM (e.g. 3:03PM).`,
          offendingText: offenders.slice(0, 5),
        }
      }
      return { level: "pass", message: "All clock times use the H:MMAM/PM format." }
    },
  },
  {
    id: "total-minutes-close",
    title: "Closes with the day total",
    citation: "Every billable note closes with the end time and total minutes (“Total = X minutes.”).",
    appliesTo: (template) => isGellertTemplate(template) && template?.billable !== false,
    check: ({ narrative, durationMinutes, isBillable }) => {
      if (!isBillable) {
        return { level: "pass", message: "Non-billable note — the day total lives on the primary note." }
      }
      const match = narrative.match(TOTAL_MINUTES)
      if (!match) {
        return {
          level: "fail",
          message: "Narrative must close with “Total = X minutes.”",
          fieldId: "duration",
        }
      }
      const narrated = parseInt(match[1], 10)
      if (durationMinutes > 0 && narrated !== durationMinutes) {
        return {
          level: "fail",
          message: `Narrative says Total = ${narrated} minutes but the timer logged ${durationMinutes} — they must match.`,
          fieldId: "duration",
          offendingText: [match[0]],
        }
      }
      return { level: "pass", message: "Narrative total matches the logged encounter time." }
    },
  },
  {
    id: "med-no-touch",
    title: "Medication no-touch language",
    citation: `Required verbatim: "${MED_NO_TOUCH_LANGUAGE}"`,
    appliesTo: (template) => template?.id === "template-gellert-med-assist",
    check: ({ narrative }) => {
      if (!narrative.includes(MED_NO_TOUCH_LANGUAGE)) {
        return {
          level: "fail",
          message: "The manual's exact no-touch language is missing — check the attestation.",
          fieldId: "no-touch-attestation",
        }
      }
      return { level: "pass", message: "No-touch language present, verbatim." }
    },
  },
  {
    id: "bh-safety-screen",
    title: "SI/HI/AH/VH safety screen",
    citation: "Behavioral health notes must document the SI/HI/AH/VH screening — denials and any positive findings.",
    appliesTo: (template) => template?.id === "template-gellert-bh",
    check: ({ responses }) => {
      const screen = responses["safety-screen"]
      const findings = responses["safety-screen-findings"]
      const answered =
        (Array.isArray(screen) && screen.length > 0) ||
        (typeof findings === "string" && findings.trim() !== "")
      if (!answered) {
        return {
          level: "fail",
          message: "Safety screen unanswered — record denials or document positive findings.",
          fieldId: "safety-screen",
        }
      }
      return { level: "pass", message: "Safety screen documented." }
    },
  },
  {
    id: "with-patient-until",
    title: "Closing presence phrase",
    citation: `In-person notes close with presence: "${WITH_PATIENT_UNTIL_PHRASE} [time]."`,
    appliesTo: (template) => hasWithPatientUntilField(template),
    check: ({ narrative }) => {
      if (!narrative.includes(WITH_PATIENT_UNTIL_PHRASE)) {
        return {
          level: "warn",
          message: `Add the closing presence phrase: "${WITH_PATIENT_UNTIL_PHRASE} [time]."`,
          fieldId: "with-patient-until",
        }
      }
      return { level: "pass", message: "Closing presence phrase present." }
    },
  },
  {
    id: "aggression-documented",
    title: "Aggression incidents quoted",
    citation: "Zero-tolerance policy: document any incident (profanity, threats, thrown objects) with direct quotes.",
    appliesTo: () => true,
    check: ({ narrative }) => {
      if (AGGRESSION.test(narrative) && !/["“]/.test(narrative)) {
        return {
          level: "warn",
          message: "Possible incident language detected — zero-tolerance policy: document the incident with direct quotes.",
          offendingText: snippetsAround(narrative, AGGRESSION),
        }
      }
      return { level: "pass", message: "No undocumented incident language detected." }
    },
  },
  {
    id: "transport-duplication",
    title: "Transport documented once per day",
    citation: "Multidisciplinary days: transport and peer-support narrative lives only in the FIRST note of the day.",
    appliesTo: () => true,
    check: ({ narrative, sameDayPrimaryExists }) => {
      if (sameDayPrimaryExists && TRANSPORT_VOCAB.test(narrative)) {
        return {
          level: "warn",
          message: "Transport narrative in a continuation note — transport lives only in the first note of the day.",
          offendingText: snippetsAround(narrative, TRANSPORT_VOCAB),
        }
      }
      return { level: "pass", message: "No duplicated transport narrative." }
    },
  },
]

/**
 * Full rule list so the compliance panel renders the entire checklist
 * (including passes).
 */
export const COMPLIANCE_RULES: ComplianceRule[] = RULES

/**
 * Run every applicable rule against a drafted note. Returns one finding per
 * applicable rule — passes included, so the UI can render the full checklist.
 */
export function checkNoteCompliance(input: CheckNoteComplianceInput): ComplianceFinding[] {
  return RULES.filter((rule) => rule.appliesTo(input.template)).map((rule) => ({
    ruleId: rule.id,
    citation: rule.citation,
    ...rule.check(input),
  }))
}

/** True when any finding is blocking (level "fail") */
export function hasBlockingFindings(findings: ComplianceFinding[]): boolean {
  return findings.some((f) => f.level === "fail")
}
