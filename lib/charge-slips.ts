/**
 * Charge slips — Gellert's daily billing attestation layer.
 *
 * TimeLogs stay the single source of billing truth. A charge slip is a
 * navigator's signature over a DERIVED navigator-patient-day grouping of
 * TimeLogs, with per-day Rule of Eights units. Only SIGNED slips are
 * persisted; unsigned slips are derived on the fly by deriveDailySlips.
 *
 * NOTE (units-math honesty): Gellert bills DAILY (per-day Rule of Eights per
 * patient); the claims engine bills MONTHLY. Σ(daily units) ≠ monthly units in
 * general — UI copy labels these "daily units (charge slips)" vs "claim units".
 */

import type { ChargeSlip, PayerConfig, TimeLog } from "./types"
import { calculateRuleOfEightsUnits } from "./payer-config"

/** A charge slip as derived from TimeLogs, joined against any signed record */
export interface DerivedChargeSlip extends ChargeSlip {
  /** Below the payer's billable minimum (e.g. < 8 min) — coaching hint, 0 units */
  isSubMinimum: boolean
  /** True when a persisted signed slip exists for this navigator-patient-day */
  signed: boolean
}

/** Deterministic slip id: one slip per navigator-patient-day */
export function chargeSlipId(navigatorId: string, patientId: string, date: string): string {
  return `slip-${navigatorId}-${patientId}-${date}`
}

/**
 * Derive one charge slip per navigator-patient-day from TimeLogs, computing
 * per-day Rule of Eights units and joining signature state from persisted
 * (signed) slips. Optionally scoped to a navigator and/or a service date.
 */
export function deriveDailySlips(
  timeLogs: TimeLog[],
  chargeSlips: ChargeSlip[],
  payerConfig: PayerConfig,
  opts?: { navigatorId?: string; date?: string }
): DerivedChargeSlip[] {
  const groups = new Map<string, TimeLog[]>()

  for (const log of timeLogs) {
    if (opts?.navigatorId && log.navigatorId !== opts.navigatorId) continue
    if (opts?.date && log.date !== opts.date) continue
    const id = chargeSlipId(log.navigatorId, log.patientId, log.date)
    const bucket = groups.get(id)
    if (bucket) bucket.push(log)
    else groups.set(id, [log])
  }

  // Key persisted slips by their (rebased) navigator/patient/date fields, not
  // by the stored id string — the date rebase shifts the date FIELD but not
  // the date embedded in an authored id.
  const signedById = new Map(chargeSlips.map((s) => [chargeSlipId(s.navigatorId, s.patientId, s.date), s]))

  const slips: DerivedChargeSlip[] = []
  for (const [id, logs] of groups) {
    const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0)
    const signedSlip = signedById.get(id)
    const { navigatorId, patientId, date } = logs[0]
    slips.push({
      id,
      navigatorId,
      patientId,
      date,
      // Signed slips freeze their timeLogIds at signing time
      timeLogIds: signedSlip?.timeLogIds ?? logs.map((l) => l.id),
      totalMinutes: signedSlip?.totalMinutes ?? totalMinutes,
      units: signedSlip?.units ?? calculateRuleOfEightsUnits(totalMinutes),
      code: signedSlip?.code ?? payerConfig.codes.base,
      signedAt: signedSlip?.signedAt,
      signedBy: signedSlip?.signedBy,
      isSubMinimum: totalMinutes > 0 && totalMinutes < payerConfig.baseMinimum,
      signed: !!signedSlip?.signedAt,
    })
  }

  return slips.sort((a, b) => a.date.localeCompare(b.date) || a.patientId.localeCompare(b.patientId))
}

export interface DayCloseStatus {
  totalSlips: number
  signedSlips: number
  unsignedSlips: number
  totalUnits: number
  subMinimumSlips: number
  dayClosed: boolean // Every slip signed (and there is at least one)
}

/** Aggregate day-close state over a set of (usually one day's) slips */
export function computeDayCloseStatus(slips: DerivedChargeSlip[]): DayCloseStatus {
  const signedSlips = slips.filter((s) => s.signed).length
  return {
    totalSlips: slips.length,
    signedSlips,
    unsignedSlips: slips.length - signedSlips,
    totalUnits: slips.reduce((sum, s) => sum + s.units, 0),
    subMinimumSlips: slips.filter((s) => s.isSubMinimum).length,
    dayClosed: slips.length > 0 && signedSlips === slips.length,
  }
}

/**
 * "Daily billing submitted by end of day" KPI (Playbook §5):
 * the % of navigator-patient-days in the trailing window whose slip was
 * signed ON the service date (signedAt calendar date === slip date).
 * Days with no time logged are not counted.
 */
export function dailyBillingSubmittedRate(
  chargeSlips: ChargeSlip[],
  timeLogs: TimeLog[],
  rangeDays: number,
  today: string = new Date().toISOString().slice(0, 10)
): number {
  const start = new Date(`${today}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - rangeDays)
  const startIso = start.toISOString().slice(0, 10)

  const slipDays = new Set<string>()
  for (const log of timeLogs) {
    if (log.date >= startIso && log.date <= today) {
      slipDays.add(chargeSlipId(log.navigatorId, log.patientId, log.date))
    }
  }
  if (slipDays.size === 0) return 0

  const signedSameDay = new Set<string>()
  for (const slip of chargeSlips) {
    // Recompute the key from fields (authored ids don't rebase; dates do)
    const key = chargeSlipId(slip.navigatorId, slip.patientId, slip.date)
    if (!slipDays.has(key) || !slip.signedAt) continue
    if (slip.signedAt.slice(0, 10) === slip.date) signedSameDay.add(key)
  }

  return Math.round((signedSameDay.size / slipDays.size) * 100)
}
