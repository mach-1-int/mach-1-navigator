/**
 * Date Rebasing for the Demo
 * ---------------------------
 * The seed data in `initial-data.ts` was authored around a fixed "today" of
 * 2026-01-30 (ANCHOR_DATE below). So the demo always looks current (recent contacts, upcoming
 * appointments, an in-progress billing month) regardless of the real date,
 * every operational date is shifted forward by the gap between that anchor and
 * the actual current date.
 *
 * What gets shifted: visit/appointment dates, note timestamps, contact dates,
 * adverse-event windows, referral dates, billing time-logs & periods, etc.
 *
 * What is FROZEN (never shifted):
 *  - `dob` — patient dates of birth are real birth dates, not relative.
 *  - `enrollmentDate` — historical enrollment (2024); keeping it fixed lets
 *    "months enrolled" grow naturally over time.
 *
 * The shift is whole-days only, preserving every relationship between dates
 * (admit→discharge, start→end, the 14-day contact-gap flags, billing windows).
 */

// The "today" the seed data was built around. This is the most recent
// `lastContactDate`/note timestamp in the seed — i.e. the latest moment any
// patient was actually contacted — so after rebasing, the freshest contact
// reads "Today" and nothing lands in the future.
const ANCHOR_DATE = "2026-01-30"

// Keys whose date values must NOT be shifted.
const FROZEN_KEYS = new Set(["dob", "enrollmentDate"])

const MS_PER_DAY = 1000 * 60 * 60 * 24

// Full ISO timestamp (with time), e.g. "2026-01-28T10:30:00Z"
const ISO_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?$/
// Date only, e.g. "2026-01-28"
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
// Month only (billingPeriod), e.g. "2026-01"
const MONTH_RE = /^(\d{4})-(\d{2})$/

/** Whole-day offset between the anchor and the current date. Computed once. */
function getShiftDays(): number {
  const anchor = new Date(`${ANCHOR_DATE}T00:00:00Z`).getTime()
  // Use the LOCAL calendar date (not UTC) so an evening user west of UTC
  // doesn't get an extra day of shift ("today's" events landing tomorrow).
  const now = new Date()
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((todayUtc - anchor) / MS_PER_DAY)
}

/** Shift a single date-bearing string by `days`, preserving its original format. */
function shiftDateString(value: string, days: number): string {
  if (ISO_DATETIME_RE.test(value)) {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().replace(/\.\d{3}Z$/, "Z")
  }

  if (DATE_RE.test(value)) {
    const d = new Date(`${value}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  if (MONTH_RE.test(value)) {
    // Shift the MIDDLE of the month, not the 1st, so a month-only value
    // (e.g. a billingPeriod) lands in the same month its daily dates do.
    // Anchoring on the 1st can slip to the prior month when the shift isn't a
    // whole number of months.
    const d = new Date(`${value}-15T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 7)
  }

  return value
}

/**
 * Deep-clone `input` while shifting every date string by the current offset.
 * `key` is the property name a string was found under (used to freeze DOBs etc).
 */
function rebase<T>(input: T, days: number, key?: string): T {
  if (typeof input === "string") {
    if (key && FROZEN_KEYS.has(key)) return input
    return shiftDateString(input, days) as unknown as T
  }

  if (Array.isArray(input)) {
    return input.map((item) => rebase(item, days, key)) as unknown as T
  }

  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = rebase(v, days, k)
    }
    return out as T
  }

  return input
}

/**
 * Rebase a seed array (or object) so its dates are relative to today.
 * Returns a deep copy; the original seed module is left untouched.
 */
export function rebaseToToday<T>(seed: T): T {
  const days = getShiftDays()
  if (days === 0) return seed
  return rebase(seed, days)
}

// ============================================================================
// LOCAL "TODAY" HELPERS
// This module owns demo-time semantics: everything date-related anchors to the
// user's LOCAL calendar date, never UTC. Any code that needs "today" or "the
// current billing month" must use these — new Date().toISOString() is UTC and
// drifts a day/month ahead for evening users west of UTC.
// ============================================================================

/** Today as a local-calendar YYYY-MM-DD string. */
export function localTodayISO(): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${mm}-${dd}`
}

/** The current billing month as a local-calendar YYYY-MM string. */
export function localCurrentMonth(): string {
  return localTodayISO().slice(0, 7)
}
