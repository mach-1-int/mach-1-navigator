/**
 * Business-day math for the Gellert journey engine.
 * Used by the "PCP appointment within 7 BUSINESS days of conversion" rule.
 * Pure date arithmetic on YYYY-MM-DD strings; weekends (Sat/Sun) excluded.
 * Holidays are intentionally out of scope for the demo tier.
 */

function parseISODate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

/**
 * Add `n` business days to an ISO date (YYYY-MM-DD or full ISO timestamp).
 * Weekend start dates roll to the next business day before counting.
 * Example: Friday + 7 business days = the second Monday out.
 */
export function addBusinessDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  let remaining = n
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (!isWeekend(d)) remaining--
  }
  return toISODate(d)
}

/**
 * Count business days between two ISO dates (exclusive of `fromIso`,
 * inclusive of `toIso`). Returns a negative count when `toIso` is earlier.
 */
export function businessDaysBetween(fromIso: string, toIso: string): number {
  const from = parseISODate(fromIso)
  const to = parseISODate(toIso)
  if (from.getTime() === to.getTime()) return 0

  const sign = to.getTime() > from.getTime() ? 1 : -1
  const [start, end] = sign === 1 ? [from, to] : [to, from]

  let count = 0
  const cursor = new Date(start)
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (!isWeekend(cursor)) count++
  }
  return count * sign
}
