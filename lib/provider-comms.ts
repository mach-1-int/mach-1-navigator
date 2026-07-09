/**
 * Provider communications (Gellert ops blitz) — renders the referring-provider
 * messages the playbook requires (§3.3; SOPs 1.6, 2.6, 6.7):
 *  - intake_notification: intake completion date, scheduled PCP date, relevant
 *    clinical info
 *  - exit_notification: exit reason + date + record closure
 *  - ineligible_notification / unreachable_notification: Phase-1 closes
 *
 * Pure rendering only. Storage/stamping happens in demo-data-context
 * (notifyReferringProvider), always with `simulated: true` — honest demo tier
 * for a future fax / Direct-messaging integration.
 */

import type { ProviderCommunication } from "./types"

export interface ProviderCommContext {
  patientName: string
  /** Referring physician name (rawData.PV1.referringPhysician) */
  referringProvider?: string
  /** Referring facility / source name */
  facilityName?: string
  /** Intake completion date (YYYY-MM-DD) — intake_notification */
  intakeCompletedDate?: string
  /** Scheduled PCP appointment date (YYYY-MM-DD) — intake_notification */
  pcpAppointmentDate?: string
  /** Relevant clinical info line (primary diagnosis etc.) */
  clinicalSummary?: string
  /** Exit pathway label or reason — exit_notification */
  exitReason?: string
  /** Exit date (YYYY-MM-DD) — exit_notification */
  exitDate?: string
  /** Ineligibility reason — ineligible_notification */
  ineligibilityReason?: string
  /** Outreach attempts made — unreachable_notification */
  outreachAttempts?: number
  /** Close date (YYYY-MM-DD) — terminal notifications */
  closedDate?: string
}

function greeting(ctx: ProviderCommContext): string {
  return ctx.referringProvider ? `Dear ${ctx.referringProvider},` : "Dear referring provider,"
}

function signature(): string {
  return "Sincerely,\nGellert Health Navigation Team\n(602) 555-0100\n\n[Simulated communication — demo environment]"
}

/**
 * Render the subject + body for a provider communication type.
 * Bodies are plain text (edit-before-send friendly).
 */
export function renderProviderComm(
  type: ProviderCommunication["type"],
  ctx: ProviderCommContext
): { subject: string; body: string } {
  const facility = ctx.facilityName ? ` at ${ctx.facilityName}` : ""

  switch (type) {
    case "intake_notification": {
      const lines = [
        greeting(ctx),
        "",
        `Thank you for referring ${ctx.patientName} to Gellert Health navigation services.`,
        `Intake was completed on ${ctx.intakeCompletedDate ?? "[intake date pending]"}.`,
        `A primary care appointment is scheduled for ${ctx.pcpAppointmentDate ?? "[PCP appointment pending scheduling]"}.`,
      ]
      if (ctx.clinicalSummary) {
        lines.push(`Relevant clinical information: ${ctx.clinicalSummary}.`)
      }
      lines.push(
        "",
        "Your patient is now actively enrolled. We will keep your office informed of significant changes in engagement or status.",
        "",
        signature()
      )
      return {
        subject: `secmsg: Navigation intake completed — ${ctx.patientName}`,
        body: lines.join("\n"),
      }
    }

    case "exit_notification": {
      const lines = [
        greeting(ctx),
        "",
        `This is to inform you that ${ctx.patientName} exited Gellert Health navigation services on ${ctx.exitDate ?? "[exit date]"}.`,
        `Exit reason: ${ctx.exitReason ?? "[reason]"}.`,
        "The navigation record has been closed. Should the patient become eligible and interested in services again, a new referral is welcome.",
        "",
        signature(),
      ]
      return {
        subject: `secmsg: Navigation services ended — ${ctx.patientName}`,
        body: lines.join("\n"),
      }
    }

    case "ineligible_notification": {
      const lines = [
        greeting(ctx),
        "",
        `Thank you for your referral of ${ctx.patientName}${facility}.`,
        `After eligibility review, the patient does not currently qualify for Gellert Health navigation services. Reason: ${ctx.ineligibilityReason ?? "[reason]"}.`,
        `The referral was closed on ${ctx.closedDate ?? "[close date]"}. Please re-refer if the patient's circumstances change.`,
        "",
        signature(),
      ]
      return {
        subject: `secmsg: Referral ineligible — ${ctx.patientName}`,
        body: lines.join("\n"),
      }
    }

    case "unreachable_notification": {
      const lines = [
        greeting(ctx),
        "",
        `Thank you for your referral of ${ctx.patientName}${facility}.`,
        `Despite ${ctx.outreachAttempts ?? 7} documented outreach attempts across multiple channels, we were unable to reach the patient.`,
        `Per protocol the referral was closed as unreachable on ${ctx.closedDate ?? "[close date]"}. If you are in contact with the patient and they remain interested, please re-refer and we will restart outreach immediately.`,
        "",
        signature(),
      ]
      return {
        subject: `secmsg: Referral closed — unable to reach ${ctx.patientName}`,
        body: lines.join("\n"),
      }
    }
  }
}
