/* eslint-disable @typescript-eslint/no-unused-vars -- Phase 0 stub signatures are frozen; params intentionally unused */
/**
 * Playbook KPIs (Gellert Operating Playbook §5) — computable metrics compute
 * honestly from live data; KPIs whose signal isn't captured yet render as
 * LABELED placeholders naming the exact dependency (never a fake number).
 *
 * PHASE 0 STUB — types and signature are FROZEN. Workstream B-B implements
 * the computable KPIs (48h acceptance %, units/day vs level targets, daily
 * billing submitted %, PCP compliance proxy, post-discharge follow-up %,
 * no-show rate, ED-visit trend, cost per engaged patient) and keeps the
 * Patient Guide Friday-4pm KPI as an honest placeholder.
 */

import type {
  AdverseEvent,
  Appointment,
  ChargeSlip,
  Navigator,
  Patient,
  PayerConfig,
  Referral,
  TimeLog,
} from "./types"

export interface PlaybookKpi {
  id: string
  label: string
  status: "computable" | "placeholder"
  /** Present only for computable KPIs */
  value?: number | string
  /** Unit/format hint, e.g. "%" */
  unit?: string
  detail?: string
  /** For placeholders: the exact missing signal, e.g. "Patient Guide module" */
  dependency?: string
}

export interface PlaybookKpiInput {
  referrals: Referral[]
  patients: Patient[]
  navigators: Navigator[]
  timeLogs: TimeLog[]
  chargeSlips: ChargeSlip[]
  appointments: Appointment[]
  adverseEvents: AdverseEvent[]
  payerConfig: PayerConfig
}

/**
 * Compute the Playbook §5 KPI board.
 * Phase 0 stub: returns an empty list (B-B fills it).
 */
export function computePlaybookKpis(_input: PlaybookKpiInput): PlaybookKpi[] {
  return []
}
