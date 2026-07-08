/**
 * Playbook KPIs (Gellert Operating Playbook §5) — computable metrics compute
 * honestly from live data; KPIs whose signal isn't captured yet render as
 * LABELED placeholders naming the exact dependency (never a fake number).
 */

import type {
  AdverseEvent,
  Appointment,
  ChargeSlip,
  IntakeRecord,
  Navigator,
  Patient,
  Payer,
  PayerConfig,
  Referral,
  TimeLog,
} from "./types"
import { dailyBillingSubmittedRate } from "./charge-slips"
import { computeNavigatorProductivity } from "./navigator-productivity"
import { computeRevenue } from "./executive-metrics"

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
  /** Optional revenue inputs — enables the cost-per-engaged-patient KPI */
  intakeRecords?: IntakeRecord[]
  payers?: Payer[]
}

const KPI_WINDOW_DAYS = 14
const MS_48_HOURS = 48 * 60 * 60 * 1000
const MS_DAY = 24 * 60 * 60 * 1000

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

/** Compute the Playbook §5 KPI board */
export function computePlaybookKpis(input: PlaybookKpiInput): PlaybookKpi[] {
  const {
    referrals,
    patients,
    navigators,
    timeLogs,
    chargeSlips,
    appointments,
    adverseEvents,
    payerConfig,
    intakeRecords,
    payers,
  } = input

  const kpis: PlaybookKpi[] = []

  const accepted = referrals.filter((r) => r.acceptedAt)
  const within48 = accepted.filter(
    (r) => Date.parse(r.acceptedAt!) - Date.parse(r.receivedAt) <= MS_48_HOURS
  )
  kpis.push({
    id: "acceptance-48h",
    label: "Referral accepted within 48h",
    status: "computable",
    value: accepted.length > 0 ? pct(within48.length, accepted.length) : "—",
    unit: accepted.length > 0 ? "%" : undefined,
    detail: `acceptance turnaround from receipt · ${within48.length} of ${accepted.length} accepted referrals`,
  })

  const productivity = computeNavigatorProductivity(
    navigators,
    timeLogs,
    chargeSlips,
    payerConfig,
    KPI_WINDOW_DAYS
  )
  const activeNavigators = productivity.filter((p) => p.trend.length > 0)
  kpis.push({
    id: "units-per-day",
    label: "Units/day vs level target",
    status: "computable",
    value:
      activeNavigators.length > 0
        ? Math.round(
            activeNavigators.reduce((sum, p) => sum + p.attainmentPct, 0) / activeNavigators.length
          )
        : "—",
    unit: activeNavigators.length > 0 ? "%" : undefined,
    detail: `avg attainment vs 16/18/20 level targets · daily units (charge slips), ${KPI_WINDOW_DAYS}-day window`,
  })

  kpis.push({
    id: "daily-billing",
    label: "Daily billing submitted by EOD",
    status: "computable",
    value: dailyBillingSubmittedRate(chargeSlips, timeLogs, KPI_WINDOW_DAYS),
    unit: "%",
    detail: `charge slips signed on the service date, trailing ${KPI_WINDOW_DAYS} days`,
  })

  const activePatients = patients.filter((p) => p.survivalStatus === "active")
  kpis.push({
    id: "pcp-compliance",
    label: "PCP compliance",
    status: "computable",
    value: pct(activePatients.filter((p) => p.pcpCompliance).length, activePatients.length),
    unit: "%",
    detail: "proxy: PCP-compliance flag on active census · 7-business-day timing signal pending",
  })

  const endedEvents = adverseEvents.filter((e) => e.status === "ended")
  const followedUp = endedEvents.filter((e) => e.followUpStatus === "completed")
  kpis.push({
    id: "post-discharge-followup",
    label: "Post-discharge follow-up",
    status: "computable",
    value: endedEvents.length > 0 ? pct(followedUp.length, endedEvents.length) : "—",
    unit: endedEvents.length > 0 ? "%" : undefined,
    detail: `follow-up completed on ${followedUp.length} of ${endedEvents.length} ended adverse events`,
  })

  kpis.push({
    id: "patient-guide-friday",
    label: "Patient Guide by Friday 4pm",
    status: "placeholder",
    dependency: "Patient Guide module — weekly guide submission timestamps are not yet captured",
  })

  const noShows = appointments.filter((a) => a.status === "no_show").length
  kpis.push({
    id: "no-show-rate",
    label: "No-show rate",
    status: "computable",
    value: pct(noShows, appointments.length),
    unit: "%",
    detail: `${noShows} of ${appointments.length} appointments`,
  })

  const now = Date.now()
  const last30 = adverseEvents.filter((e) => now - Date.parse(e.startDate) <= 30 * MS_DAY).length
  const prior30 = adverseEvents.filter((e) => {
    const ageMs = now - Date.parse(e.startDate)
    return ageMs > 30 * MS_DAY && ageMs <= 60 * MS_DAY
  }).length
  const delta = last30 - prior30
  const currentlyEd = adverseEvents.filter((e) => e.status === "currently_ed").length
  kpis.push({
    id: "ed-trend",
    label: "ED / acute event trend (30d)",
    status: "computable",
    value: last30,
    detail: `${delta >= 0 ? "+" : ""}${delta} vs prior 30 days · ${currentlyEd} currently in ED`,
  })

  if (intakeRecords && payers) {
    const revenue = computeRevenue(
      navigators,
      patients,
      timeLogs,
      intakeRecords,
      payerConfig,
      appointments,
      payers
    )
    kpis.push({
      id: "cost-per-engaged",
      label: "Cost per engaged patient",
      status: "computable",
      value: activePatients.length > 0 ? Math.round(revenue.total / activePatients.length) : "—",
      unit: activePatients.length > 0 ? "$" : undefined,
      detail: `$${revenue.total.toLocaleString()} billing-month revenue ÷ ${activePatients.length} active patients`,
    })
  } else {
    kpis.push({
      id: "cost-per-engaged",
      label: "Cost per engaged patient",
      status: "placeholder",
      dependency: "payer + intake data — pass intakeRecords and payers to compute",
    })
  }

  return kpis
}
