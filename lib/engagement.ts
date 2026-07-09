/**
 * Engagement cadence (Gellert ops blitz) — per-patient weekly contact counts.
 * The playbook prescribes "multiple contacts per week" during active
 * navigation but flags the target percentage as undecided (⚑), so this module
 * reports HONESTLY: counts and a multiple/single/none status, never a made-up
 * target.
 *
 * A "contact" is a distinct local calendar DAY on which any of these touched
 * the patient: a note was authored (supervision notes excluded — they discuss
 * the patient, they don't contact them), a time log was recorded, or an
 * appointment was completed.
 */

import type { Appointment, PatientNote, TimeLog } from "./types"
import { localDateOf } from "./task-engine"

export interface WeeklyContactCount {
  /** Monday of the week, local calendar (YYYY-MM-DD) */
  weekStart: string
  /** Distinct contact days in that week */
  count: number
}

/** Monday (local) of the week containing `date` */
export function weekStartOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return localDateOf(d)
}

/**
 * Contact counts for the trailing `weeks` weeks (oldest first; the LAST entry
 * is the current week). Counts distinct contact days per week.
 */
export function weeklyContactCounts(
  patientId: string,
  notes: PatientNote[],
  timeLogs: TimeLog[],
  appointments: Appointment[],
  weeks: number,
  now: Date = new Date()
): WeeklyContactCount[] {
  const contactDays = new Set<string>()

  for (const note of notes) {
    if (note.patientId !== patientId || note.type === "supervision") continue
    contactDays.add(localDateOf(note.createdAt))
  }
  for (const log of timeLogs) {
    if (log.patientId !== patientId) continue
    contactDays.add(log.date.slice(0, 10))
  }
  for (const appt of appointments) {
    if (appt.patientId !== patientId || appt.status !== "completed") continue
    contactDays.add(appt.date.slice(0, 10))
  }

  // Build the trailing week buckets, oldest first
  const buckets: WeeklyContactCount[] = []
  const currentWeekStart = weekStartOf(now)
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(`${currentWeekStart}T00:00:00`)
    start.setDate(start.getDate() - i * 7)
    buckets.push({ weekStart: localDateOf(start), count: 0 })
  }

  const bucketByStart = new Map(buckets.map((b) => [b.weekStart, b]))
  for (const day of contactDays) {
    const start = weekStartOf(new Date(`${day}T00:00:00`))
    const bucket = bucketByStart.get(start)
    if (bucket) bucket.count++
  }

  return buckets
}

export type CadenceStatus = "multiple" | "single" | "none"

/**
 * Cadence status for the CURRENT week (last bucket): 2+ contact days =
 * "multiple", 1 = "single", 0 = "none". No target percentage — the playbook
 * leaves that decision to Gellert (⚑).
 */
export function cadenceStatus(counts: WeeklyContactCount[]): CadenceStatus {
  const current = counts[counts.length - 1]?.count ?? 0
  if (current >= 2) return "multiple"
  if (current === 1) return "single"
  return "none"
}
