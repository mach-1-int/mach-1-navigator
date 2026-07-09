"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PhoneCall, AlertTriangle, CheckCircle2, Clock, PlusCircle, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import {
  MAX_OUTREACH_ATTEMPTS,
  OUTREACH_CHANNEL_LABELS,
  OUTREACH_DISPOSITION_LABELS,
  attemptsRemaining,
  outreachSla,
} from "@/lib/referral-pipeline"
import type { OutreachAttempt, Referral } from "@/lib/types"
import { ProviderCommDialog } from "@/components/supervisor/provider-comm-dialog"

interface OutreachLogProps {
  referral: Referral
}

export function OutreachSlaChip({ referral }: { referral: Referral }) {
  const sla = outreachSla(referral)
  const config = {
    on_time: {
      label: `${Math.round(sla.hoursSinceAccepted)}h — on time`,
      className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
      icon: Clock,
    },
    due: {
      label: `${Math.round(sla.hoursSinceAccepted)}h — contact due`,
      className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
      icon: Clock,
    },
    breached: {
      label: `${Math.round(sla.hoursSinceAccepted)}h — SLA breached`,
      className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300",
      icon: AlertTriangle,
    },
  }[sla.status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn("text-xs gap-1", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

export function OutreachLog({ referral }: OutreachLogProps) {
  const { logOutreachAttempt, providerCommunications } = useDemoData()
  const { currentUser } = useRole()
  const [channel, setChannel] = useState<OutreachAttempt["channel"]>("phone")
  const [disposition, setDisposition] = useState<OutreachAttempt["disposition"]>("no_answer")
  const [note, setNote] = useState("")
  const [commDialogOpen, setCommDialogOpen] = useState(false)

  const attempts = referral.outreachAttempts
  const remaining = attemptsRemaining(referral)
  const firstContactMade = attempts.length > 0
  const onLastAttempt = remaining === 1
  const autoClosedUnreachable = referral.status === "unreachable"
  const alreadyNotified = providerCommunications.some(
    (c) => c.referralId === referral.id && c.type === "unreachable_notification"
  )

  const log = (dispositionOverride?: OutreachAttempt["disposition"]) => {
    if (!currentUser) return
    logOutreachAttempt(referral.id, {
      at: new Date().toISOString(),
      by: currentUser.id,
      byName: currentUser.name,
      channel,
      disposition: dispositionOverride ?? disposition,
      notes: note.trim() || undefined,
    })
    setNote("")
  }

  return (
    <Card className="bg-card overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Outreach Log</CardTitle>
          </div>
          {!firstContactMade && <OutreachSlaChip referral={referral} />}
        </div>
        <CardDescription>
          {attempts.length} of {MAX_OUTREACH_ATTEMPTS} attempts — unresolved after {MAX_OUTREACH_ATTEMPTS} auto-closes as unreachable
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-y-auto">
        {/* 7-slot attempt tracker */}
        <div className="flex items-center gap-2">
          {Array.from({ length: MAX_OUTREACH_ATTEMPTS }, (_, i) => {
            const attempt = attempts[i]
            return (
              <div
                key={i}
                title={
                  attempt
                    ? `#${attempt.attemptNumber} ${OUTREACH_CHANNEL_LABELS[attempt.channel]} — ${OUTREACH_DISPOSITION_LABELS[attempt.disposition]}`
                    : `Attempt ${i + 1} — not yet made`
                }
                className={cn(
                  "h-3.5 w-3.5 rounded-full border-2",
                  attempt
                    ? attempt.disposition === "agreed"
                      ? "bg-emerald-500 border-emerald-500"
                      : attempt.disposition === "declined"
                        ? "bg-orange-500 border-orange-500"
                        : "bg-indigo-500 border-indigo-500"
                    : "border-border bg-transparent"
                )}
              />
            )
          })}
          <span className="text-xs text-muted-foreground ml-1">
            {remaining} attempt{remaining === 1 ? "" : "s"} remaining
          </span>
        </div>

        {autoClosedUnreachable ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">
                Maximum attempts reached — auto-closed as unreachable.
                {alreadyNotified && " Referring provider notified."}
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0 bg-transparent" onClick={() => setCommDialogOpen(true)}>
              <Send className="h-3.5 w-3.5" />
              Send provider notification
            </Button>
          </div>
        ) : (
          onLastAttempt && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Final attempt — if the patient can&apos;t be reached, the referral auto-closes as unreachable and the
                referring provider is notified.
              </p>
            </div>
          )
        )}

        {autoClosedUnreachable && (
          <ProviderCommDialog
            open={commDialogOpen}
            onOpenChange={setCommDialogOpen}
            type="unreachable_notification"
            entity={{ referralId: referral.id }}
            referral={referral}
          />
        )}

        {/* Attempt history */}
        {attempts.length > 0 && (
          <div className="space-y-2">
            {[...attempts].reverse().map((attempt) => (
              <div key={attempt.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-card-foreground">
                    #{attempt.attemptNumber} — {OUTREACH_DISPOSITION_LABELS[attempt.disposition]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {OUTREACH_CHANNEL_LABELS[attempt.channel]} by {attempt.byName} ·{" "}
                    {new Date(attempt.at).toLocaleString()}
                  </p>
                  {attempt.notes && <p className="text-xs text-muted-foreground mt-1">{attempt.notes}</p>}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs shrink-0",
                    attempt.disposition === "agreed"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : attempt.disposition === "declined"
                        ? "bg-orange-100 text-orange-700 border-orange-200"
                        : "bg-secondary text-muted-foreground"
                  )}
                >
                  {OUTREACH_DISPOSITION_LABELS[attempt.disposition]}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Log attempt form */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Log Attempt {attempts.length + 1}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={channel} onValueChange={(v) => setChannel(v as OutreachAttempt["channel"])}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OUTREACH_CHANNEL_LABELS) as OutreachAttempt["channel"][]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {OUTREACH_CHANNEL_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={disposition} onValueChange={(v) => setDisposition(v as OutreachAttempt["disposition"])}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Disposition" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OUTREACH_DISPOSITION_LABELS) as OutreachAttempt["disposition"][]).map((d) => (
                  <SelectItem key={d} value={d}>
                    {OUTREACH_DISPOSITION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Attempt note (optional)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2 bg-transparent" onClick={() => log()}>
              <PhoneCall className="h-4 w-4" />
              Log Attempt
            </Button>
            <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => log("agreed")}>
              <CheckCircle2 className="h-4 w-4" />
              Patient Agreed
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
