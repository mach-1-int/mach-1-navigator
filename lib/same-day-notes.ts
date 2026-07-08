/**
 * Same-day multi-note model (Gellert manual):
 * the FIRST billable note of a patient-day is the PRIMARY note and carries the
 * day total (carriesDayTotal). Later notes that day are CONTINUATIONS —
 * appointment content only, linked via linkedNoteId, billable: false, and they
 * create NO TimeLog (prevents transport/time double-billing).
 */

import type { PatientNote } from "./types"

function noteDate(note: PatientNote): string {
  return note.createdAt.slice(0, 10)
}

/**
 * Is this note a billable (TimeLog-carrying) note? Quick untimed notes never
 * anchor a patient-day — a primary must actually carry encounter time.
 */
function isBillableNote(note: PatientNote): boolean {
  return (
    note.billable !== false &&
    !note.linkedNoteId &&
    (note.timeLogId !== undefined || (note.duration ?? 0) > 0)
  )
}

/**
 * The primary note for a patient-day: the note flagged carriesDayTotal,
 * falling back to the earliest billable note of that date.
 */
export function findSameDayPrimaryNote(
  notes: PatientNote[],
  patientId: string,
  dateISO: string
): PatientNote | undefined {
  const date = dateISO.slice(0, 10)
  const dayNotes = notes.filter((n) => n.patientId === patientId && noteDate(n) === date)

  const flagged = dayNotes.find((n) => n.carriesDayTotal)
  if (flagged) return flagged

  return dayNotes
    .filter(isBillableNote)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
}

/**
 * A primary note plus every continuation linked to it (directly or through a
 * chain), in chronological order. Passing a continuation id resolves its
 * primary first.
 */
export function getLinkedNoteChain(notes: PatientNote[], noteId: string): PatientNote[] {
  const byId = new Map(notes.map((n) => [n.id, n]))
  let root = byId.get(noteId)
  if (!root) return []

  // Walk up to the chain root
  const seen = new Set<string>([root.id])
  while (root.linkedNoteId && byId.has(root.linkedNoteId) && !seen.has(root.linkedNoteId)) {
    root = byId.get(root.linkedNoteId)!
    seen.add(root.id)
  }

  // Collect everything that links (transitively) down from the root
  const chain: PatientNote[] = [root]
  const chainIds = new Set([root.id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of notes) {
      if (n.linkedNoteId && chainIds.has(n.linkedNoteId) && !chainIds.has(n.id)) {
        chain.push(n)
        chainIds.add(n.id)
        grew = true
      }
    }
  }

  return chain.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/**
 * Total documented minutes for a patient-day (billable notes only —
 * continuations carry no minutes of their own).
 */
export function dayTotalMinutes(notes: PatientNote[], patientId: string, dateISO: string): number {
  const date = dateISO.slice(0, 10)
  return notes
    .filter((n) => n.patientId === patientId && noteDate(n) === date && isBillableNote(n))
    .reduce((sum, n) => sum + (n.duration ?? 0), 0)
}
