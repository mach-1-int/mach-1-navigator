/**
 * Task engine (Gellert ops blitz) — pure derivation of navigator tasks from
 * appointments and adverse events. Encodes:
 *  - SOP 3.3  multi-touch appointment confirmation (48h / 24h / day-of)
 *  - SOP 3.10 same-day missed-appointment (no-show) recovery
 *  - SOP 3.6  24-hour post-visit follow-up
 *  - SOPs 4.1-4.6 adverse-event response (post-event contact, post-discharge
 *    PCP within 7 BUSINESS days, med reconciliation, risk-reduction education)
 *
 * SEMANTICS (frozen for the parallel workstreams):
 *  - Task ids are DETERMINISTIC: `taskId(type, refId)` where refId is the
 *    appointment id or adverse-event id. Idempotency falls out of the id and
 *    the (type, appointmentId|adverseEventId) key — generators skip any
 *    candidate whose key already exists in ANY status.
 *  - `dueAt` is the moment the touch becomes actionable (window entry for
 *    confirmations). "Due today" = dueAt's LOCAL date is today; "overdue"
 *    (red) = open with a local due DATE strictly before today — see
 *    `overdueTasks`. Same-day tasks are never instantly red.
 */

import type {
  AdverseEvent,
  Appointment,
  NavigatorTask,
  NavigatorTaskType,
  Patient,
} from "./types"
import { addBusinessDays } from "./business-days"

// ============================================================================
// TIME HELPERS
// ============================================================================

const MS_HOUR = 60 * 60 * 1000
const MS_DAY = 24 * MS_HOUR

/** Local-calendar YYYY-MM-DD for a Date or ISO string */
export function localDateOf(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Appointment date+time as a LOCAL Date (falls back to 09:00 when time is missing) */
export function appointmentDateTime(appointment: Appointment): Date {
  const time = /^\d{1,2}:\d{2}$/.test(appointment.time) ? appointment.time : "09:00"
  return new Date(`${appointment.date}T${time.padStart(5, "0")}:00`)
}

/** Deterministic task id — regeneration can never duplicate a task */
export function taskId(type: NavigatorTaskType, refId: string): string {
  return `task-${type}-${refId}`
}

/** The (type, reference) idempotency key a task occupies */
export function taskKey(task: Pick<NavigatorTask, "type" | "appointmentId" | "adverseEventId" | "patientId">): string {
  return `${task.type}:${task.appointmentId ?? task.adverseEventId ?? task.patientId}`
}

function hasExisting(existing: NavigatorTask[], candidate: NavigatorTask): boolean {
  const key = taskKey(candidate)
  return existing.some((t) => t.id === candidate.id || taskKey(t) === key)
}

function makeTask(
  type: NavigatorTaskType,
  refId: string,
  base: Pick<NavigatorTask, "patientId" | "navigatorId"> &
    Partial<Pick<NavigatorTask, "appointmentId" | "adverseEventId">>,
  dueAt: Date | string,
  now: Date
): NavigatorTask {
  return {
    id: taskId(type, refId),
    type,
    patientId: base.patientId,
    navigatorId: base.navigatorId,
    appointmentId: base.appointmentId,
    adverseEventId: base.adverseEventId,
    dueAt: typeof dueAt === "string" ? dueAt : dueAt.toISOString(),
    status: "open",
    createdAt: now.toISOString(),
    source: "system",
  }
}

// ============================================================================
// CONFIRMATION TASKS (SOP 3.3)
// ============================================================================

const CONFIRMATION_WINDOWS: Array<{
  type: NavigatorTaskType
  window: "48h" | "24h" | "day_of"
  msBefore: number | null // null = day-of (dueAt = appointment date 08:00 local)
}> = [
  { type: "confirmation_48h", window: "48h", msBefore: 48 * MS_HOUR },
  { type: "confirmation_24h", window: "24h", msBefore: 24 * MS_HOUR },
  { type: "confirmation_day_of", window: "day_of", msBefore: null },
]

/** The confirmation window a confirmation-task type covers (null otherwise) */
export function confirmationWindowForType(type: NavigatorTaskType): "48h" | "24h" | "day_of" | null {
  return CONFIRMATION_WINDOWS.find((w) => w.type === type)?.window ?? null
}

/**
 * Confirmation tasks whose windows have OPENED for upcoming scheduled
 * appointments (48h / 24h before the appointment datetime; day-of from
 * 08:00 local on the appointment date). Skips:
 *  - windows already confirmed on the appointment (`confirmations[]`),
 *  - windows with an existing task of the same key in ANY status,
 *  - non-scheduled appointments and appointments already in the past.
 */
export function deriveDueConfirmationTasks(
  appointments: Appointment[],
  existingTasks: NavigatorTask[],
  now: Date = new Date()
): NavigatorTask[] {
  const out: NavigatorTask[] = []

  for (const appt of appointments) {
    if (appt.status !== "scheduled") continue
    const at = appointmentDateTime(appt)
    if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) continue

    for (const spec of CONFIRMATION_WINDOWS) {
      const dueAt =
        spec.msBefore !== null
          ? new Date(at.getTime() - spec.msBefore)
          : new Date(`${appt.date}T08:00:00`)
      if (now.getTime() < dueAt.getTime()) continue // window not yet entered
      if (appt.confirmations?.some((c) => c.window === spec.window)) continue

      const candidate = makeTask(
        spec.type,
        appt.id,
        { patientId: appt.patientId, navigatorId: appt.navigatorId, appointmentId: appt.id },
        dueAt,
        now
      )
      if (hasExisting(existingTasks, candidate) || hasExisting(out, candidate)) continue
      out.push(candidate)
    }
  }

  return out
}

// ============================================================================
// VISIT-OUTCOME TASKS (SOPs 3.6 / 3.10)
// ============================================================================

/** Post-visit follow-up due 24h after the completed appointment (SOP 3.6) */
export function taskForCompletedVisit(appointment: Appointment, now: Date = new Date()): NavigatorTask {
  const dueAt = new Date(appointmentDateTime(appointment).getTime() + 24 * MS_HOUR)
  return makeTask(
    "post_visit_followup",
    appointment.id,
    { patientId: appointment.patientId, navigatorId: appointment.navigatorId, appointmentId: appointment.id },
    dueAt,
    now
  )
}

/** Same-day no-show recovery, due 6:00 PM local on the appointment date (SOP 3.10) */
export function taskForNoShow(appointment: Appointment, now: Date = new Date()): NavigatorTask {
  return makeTask(
    "no_show_recovery",
    appointment.id,
    { patientId: appointment.patientId, navigatorId: appointment.navigatorId, appointmentId: appointment.id },
    new Date(`${appointment.date}T18:00:00`),
    now
  )
}

// ============================================================================
// ADVERSE-EVENT RESPONSE TASKS (SOPs 4.1-4.6)
// ============================================================================

/**
 * The response task set for an adverse event:
 *  - post_event_contact: startDate + 24h (always)
 *  - once the event has ENDED (endDate present):
 *    - post_discharge_pcp: due addBusinessDays(endDate, 7) — the 7-BUSINESS-day rule
 *    - post_discharge_med_rec: endDate + 48h
 *    - risk_reduction_education: endDate + 7 days
 * The navigator is the patient's assigned navigator.
 */
export function tasksForAdverseEvent(
  event: AdverseEvent,
  patient: Patient,
  now: Date = new Date()
): NavigatorTask[] {
  const base = {
    patientId: event.patientId,
    navigatorId: patient.assignedNavigator,
    adverseEventId: event.id,
  }
  const tasks: NavigatorTask[] = [
    makeTask(
      "post_event_contact",
      event.id,
      base,
      new Date(new Date(`${event.startDate}T09:00:00`).getTime() + 24 * MS_HOUR),
      now
    ),
  ]

  if (event.status === "ended" && event.endDate) {
    tasks.push(
      makeTask("post_discharge_pcp", event.id, base, `${addBusinessDays(event.endDate, 7)}T17:00:00`, now),
      makeTask(
        "post_discharge_med_rec",
        event.id,
        base,
        new Date(new Date(`${event.endDate}T09:00:00`).getTime() + 48 * MS_HOUR),
        now
      ),
      makeTask(
        "risk_reduction_education",
        event.id,
        base,
        new Date(new Date(`${event.endDate}T09:00:00`).getTime() + 7 * MS_DAY),
        now
      )
    )
  }

  return tasks
}

// ============================================================================
// OVERDUE
// ============================================================================

/**
 * Open tasks whose local due DATE is strictly before today. Date-based on
 * purpose: a task generated at window entry is "due today", never instantly
 * red the moment it appears.
 */
export function overdueTasks(tasks: NavigatorTask[], now: Date = new Date()): NavigatorTask[] {
  const today = localDateOf(now)
  return tasks.filter((t) => t.status === "open" && localDateOf(t.dueAt) < today)
}

// ============================================================================
// DISPLAY CONFIG (labels, colors, SOP citations) — icons are lucide names so
// this module stays dependency-light for the verify harness.
// ============================================================================

export interface TaskTypeConfig {
  label: string
  description: string
  /** lucide-react icon name, e.g. "PhoneCall" — components resolve it */
  icon: string
  /** Tailwind badge classes consistent with existing status chips */
  color: string
}

export const TASK_TYPE_CONFIG: Record<NavigatorTaskType, TaskTypeConfig> = {
  confirmation_48h: {
    label: "48-hour confirmation",
    description: "First confirmation touch, 48 hours before the appointment (SOP 3.3)",
    icon: "PhoneCall",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  confirmation_24h: {
    label: "24-hour confirmation",
    description: "Second confirmation touch, 24 hours before the appointment (SOP 3.3)",
    icon: "PhoneCall",
    color: "bg-sky-100 text-sky-700 border-sky-200",
  },
  confirmation_day_of: {
    label: "Day-of confirmation",
    description: "Morning-of confirmation touch on the appointment day (SOP 3.3)",
    icon: "CalendarCheck",
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
  no_show_recovery: {
    label: "No-show recovery",
    description: "Same-day recovery contact after a missed appointment (SOP 3.10)",
    icon: "AlertTriangle",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  post_visit_followup: {
    label: "Post-visit follow-up",
    description: "24-hour follow-up: confirm understanding, next steps, new barriers (SOP 3.6)",
    icon: "MessageCircle",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  post_event_contact: {
    label: "Post-event contact",
    description: "Contact patient/family within 24 hours of an adverse event (SOP 4.1)",
    icon: "HeartPulse",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  post_discharge_pcp: {
    label: "Post-discharge PCP visit",
    description: "PCP appointment within 7 business days of discharge (SOP 4.3)",
    icon: "Stethoscope",
    color: "bg-rose-100 text-rose-700 border-rose-200",
  },
  post_discharge_med_rec: {
    label: "Post-discharge med reconciliation",
    description: "Reconcile medications within 48 hours of discharge (SOP 4.5)",
    icon: "Pill",
    color: "bg-violet-100 text-violet-700 border-violet-200",
  },
  risk_reduction_education: {
    label: "Risk-reduction education",
    description: "Education to prevent recurrence, within 7 days of discharge (SOP 4.6)",
    icon: "BookOpen",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
}
