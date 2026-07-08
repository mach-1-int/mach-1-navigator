/* eslint-disable @typescript-eslint/no-unused-vars -- Phase 0 stub signatures are frozen; params intentionally unused */
/**
 * Note compliance engine — the Gellert Note-Taking Manual as a pure rules
 * engine. Every rule carries a manual citation; blocking (fail) findings stop
 * note signing / TimeLog creation in note-builder.
 *
 * PHASE 0 STUB — signatures and types are FROZEN. Workstream N-A implements
 * the nine rules (patient-involvement, third-person, time-format,
 * total-minutes-close, med-no-touch, bh-safety-screen, with-patient-until,
 * aggression-documented, transport-duplication).
 */

import type { NoteTemplate } from "./types"

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

/**
 * Full rule list so the compliance panel renders the entire checklist
 * (including passes). N-A fills this in.
 */
export const COMPLIANCE_RULES: ComplianceRule[] = []

/**
 * Run every applicable rule against a drafted note.
 * Phase 0 stub: returns no findings (everything passes).
 */
export function checkNoteCompliance(_input: CheckNoteComplianceInput): ComplianceFinding[] {
  return []
}

/** True when any finding is blocking (level "fail") */
export function hasBlockingFindings(findings: ComplianceFinding[]): boolean {
  return findings.some((f) => f.level === "fail")
}
