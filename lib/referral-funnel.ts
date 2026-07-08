/**
 * Referral funnel analytics — stage counts, conversion rate, and the
 * per-source scorecard ("St. Joe's sends us the patients who convert").
 *
 * Owned by workstream J-A after Phase 0 — signatures are frozen; bodies are
 * working baselines J-A extends.
 */

import type { Referral, ReferralStatus } from "./types"

const FUNNEL_STAGE_ORDER: ReferralStatus[] = [
  "received",
  "accepted",
  "outreach",
  "agreed",
  "intake_scheduled",
  "converted",
  "ineligible",
  "unreachable",
  "declined",
]

export interface FunnelSummary {
  total: number
  /** Counts per status, in funnel display order */
  stages: Array<{ status: ReferralStatus; count: number }>
  converted: number
  /** Overall referral -> converted %, rounded to whole percent */
  conversionRate: number
}

export function computeFunnel(referrals: Referral[]): FunnelSummary {
  const counts = new Map<ReferralStatus, number>()
  for (const r of referrals) {
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  }
  const converted = counts.get("converted") ?? 0
  return {
    total: referrals.length,
    stages: FUNNEL_STAGE_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 })),
    converted,
    conversionRate: referrals.length > 0 ? Math.round((converted / referrals.length) * 100) : 0,
  }
}

export interface SourceScorecardRow {
  source: string
  received: number // total referrals from this source
  ineligible: number
  unreachable: number
  declined: number
  inProgress: number // non-terminal pipeline statuses
  converted: number
  conversionRate: number // % of total from this source
  avgDaysToConversion: number | null // receivedAt -> acceptedAt-based conversions
}

/** Per-source funnel scorecard, sorted by volume (highest first) */
export function computeSourceScorecard(referrals: Referral[]): SourceScorecardRow[] {
  const bySource = new Map<string, Referral[]>()
  for (const r of referrals) {
    const source = r.source || r.referralSource || "Unknown"
    const bucket = bySource.get(source)
    if (bucket) bucket.push(r)
    else bySource.set(source, [r])
  }

  const rows: SourceScorecardRow[] = []
  for (const [source, refs] of bySource) {
    const count = (status: Referral["status"]) => refs.filter((r) => r.status === status).length
    const converted = count("converted")
    const terminal = converted + count("ineligible") + count("unreachable") + count("declined")

    const conversionDays = refs
      .filter((r) => r.status === "converted" && r.acceptedAt)
      .map((r) => (new Date(r.acceptedAt!).getTime() - new Date(r.receivedAt).getTime()) / (1000 * 60 * 60 * 24))
      .filter((d) => Number.isFinite(d) && d >= 0)

    rows.push({
      source,
      received: refs.length,
      ineligible: count("ineligible"),
      unreachable: count("unreachable"),
      declined: count("declined"),
      inProgress: refs.length - terminal,
      converted,
      conversionRate: refs.length > 0 ? Math.round((converted / refs.length) * 100) : 0,
      avgDaysToConversion:
        conversionDays.length > 0
          ? Math.round((conversionDays.reduce((a, b) => a + b, 0) / conversionDays.length) * 10) / 10
          : null,
    })
  }

  return rows.sort((a, b) => b.received - a.received)
}
