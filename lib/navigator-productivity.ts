/**
 * Navigator productivity — per-navigator DAILY units vs Gellert's level-based
 * targets (Playbook §5). Reuses deriveDailySlips so productivity math and
 * charge-slip math agree by construction.
 *
 * Units-math honesty: these are "daily units (charge slips)" — the claims
 * ledger's monthly "claim units" aggregate differently and are labeled apart.
 *
 * Owned by workstream B-B after Phase 0 — signatures are frozen; bodies are
 * working baselines B-B extends (trend windows, sparklines, windshield time).
 */

import type { ChargeSlip, Navigator, PayerConfig, TimeLog } from "./types"
import { dailyBillingSubmittedRate, deriveDailySlips } from "./charge-slips"

/** Units-per-day target by Gellert navigator level (Playbook §5) */
export const UNITS_PER_DAY_TARGET_BY_LEVEL: Record<1 | 2 | 3, number> = {
  1: 16,
  2: 18,
  3: 20,
}

export interface NavigatorDailyUnits {
  navigatorId: string
  date: string
  units: number
}

/**
 * Per-navigator daily unit totals (Σ per-patient-day Rule of Eights),
 * derived from the same slip math the day-close panel uses.
 */
export function computeNavigatorDailyUnits(
  timeLogs: TimeLog[],
  chargeSlips: ChargeSlip[],
  payerConfig: PayerConfig
): NavigatorDailyUnits[] {
  const slips = deriveDailySlips(timeLogs, chargeSlips, payerConfig)
  const byNavDay = new Map<string, NavigatorDailyUnits>()

  for (const slip of slips) {
    const key = `${slip.navigatorId}|${slip.date}`
    const entry = byNavDay.get(key)
    if (entry) entry.units += slip.units
    else byNavDay.set(key, { navigatorId: slip.navigatorId, date: slip.date, units: slip.units })
  }

  return [...byNavDay.values()].sort(
    (a, b) => a.navigatorId.localeCompare(b.navigatorId) || a.date.localeCompare(b.date)
  )
}

export interface NavigatorProductivity {
  navigatorId: string
  name: string
  level: 1 | 2 | 3
  targetUnitsPerDay: number
  avgUnitsPerDay: number
  /** avg / target, as a whole percent */
  attainmentPct: number
  /** Daily unit series (chronological) for sparklines */
  trend: NavigatorDailyUnits[]
  /** % of this navigator's patient-days signed same-day */
  dayCloseRate: number
}

/**
 * Productivity summary per navigator over the trailing `rangeDays` window.
 */
export function computeNavigatorProductivity(
  navigators: Navigator[],
  timeLogs: TimeLog[],
  chargeSlips: ChargeSlip[],
  payerConfig: PayerConfig,
  rangeDays: number,
  today: string = new Date().toISOString().slice(0, 10)
): NavigatorProductivity[] {
  const start = new Date(`${today}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - rangeDays)
  const startIso = start.toISOString().slice(0, 10)

  const windowLogs = timeLogs.filter((l) => l.date >= startIso && l.date <= today)
  const dailyUnits = computeNavigatorDailyUnits(windowLogs, chargeSlips, payerConfig)

  return navigators.map((nav) => {
    const trend = dailyUnits.filter((d) => d.navigatorId === nav.id)
    const totalUnits = trend.reduce((sum, d) => sum + d.units, 0)
    const avgUnitsPerDay = trend.length > 0 ? Math.round((totalUnits / trend.length) * 10) / 10 : 0
    const target = UNITS_PER_DAY_TARGET_BY_LEVEL[nav.level]

    return {
      navigatorId: nav.id,
      name: nav.name,
      level: nav.level,
      targetUnitsPerDay: target,
      avgUnitsPerDay,
      attainmentPct: target > 0 ? Math.round((avgUnitsPerDay / target) * 100) : 0,
      trend,
      dayCloseRate: dailyBillingSubmittedRate(
        chargeSlips,
        windowLogs.filter((l) => l.navigatorId === nav.id),
        rangeDays,
        today
      ),
    }
  })
}
