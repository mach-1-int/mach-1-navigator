"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TriangleAlert, CheckCircle2, Clock, ShieldCheck, Plus } from "lucide-react"
import { toast } from "sonner"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import { EscalationDialog, REASON_CONFIG } from "@/components/escalations/escalation-dialog"
import type { Escalation, Patient } from "@/lib/types"

const STATUS_CONFIG: Record<Escalation["status"], { label: string; icon: typeof TriangleAlert; className: string }> = {
  open: { label: "Open", icon: TriangleAlert, className: "bg-destructive/10 text-destructive border-destructive/20" },
  acknowledged: { label: "Acknowledged", icon: Clock, className: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
}

interface EscalationListProps {
  /** Restrict the list to these escalations (e.g. a navigator's own, or a team's). Defaults to all. */
  escalations?: Escalation[]
  /** Roster the raise dialog's patient picker draws from. */
  roster?: Patient[]
  compact?: boolean
  /** Hide the "Raise escalation" trigger (e.g. when the caller renders its own). */
  hideRaiseButton?: boolean
  title?: string
  description?: string
}

/**
 * Escalation list with status chips, reason badges, raised-by/at, and
 * role-gated actions: supervisors acknowledge/resolve, navigators raise +
 * view. Resolve captures a required resolution note.
 */
export function EscalationList({
  escalations,
  roster,
  compact = false,
  hideRaiseButton = false,
  title = "Escalations",
  description = "Closed-loop clinical escalations",
}: EscalationListProps) {
  const { escalations: allEscalations, patients, getNavigatorDisplayName, acknowledgeEscalation, resolveEscalation } = useDemoData()
  const { currentUser } = useRole()
  const isSupervisor = currentUser?.role === "supervisor" || currentUser?.role === "admin"

  const [raiseOpen, setRaiseOpen] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState("")

  const list = [...(escalations ?? allEscalations)].sort(
    (a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime()
  )
  const openCount = list.filter((e) => e.status !== "resolved").length

  const handleAcknowledge = (escalation: Escalation) => {
    if (!currentUser) return
    acknowledgeEscalation(escalation.id, currentUser.id)
    toast.success("Escalation acknowledged")
  }

  const handleResolve = (escalation: Escalation) => {
    if (!currentUser || resolutionNote.trim().length === 0) return
    resolveEscalation(escalation.id, currentUser.id, resolutionNote.trim())
    toast.success("Escalation resolved")
    setResolvingId(null)
    setResolutionNote("")
  }

  const renderRow = (escalation: Escalation) => {
    const patient = patients.find((p) => p.id === escalation.patientId)
    const status = STATUS_CONFIG[escalation.status]
    const StatusIcon = status.icon
    const isResolving = resolvingId === escalation.id

    return (
      <div
        key={escalation.id}
        className={cn(
          "rounded-lg border p-3 space-y-2",
          escalation.status === "open" ? "border-destructive/30 bg-destructive/5" : "border-border"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-card-foreground truncate">{patient?.name ?? escalation.patientId}</p>
              <Badge variant="outline" className={cn("text-xs", status.className)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {REASON_CONFIG[escalation.reason]}
              </Badge>
            </div>
            <p className={cn("text-sm text-muted-foreground mt-1", compact && "line-clamp-2")}>
              {escalation.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Raised by {getNavigatorDisplayName(escalation.navigatorId)} on{" "}
              {new Date(escalation.raisedAt).toLocaleString()}
            </p>
            {escalation.acknowledgedAt && (
              <p className="text-xs text-muted-foreground">
                Acknowledged by {getNavigatorDisplayName(escalation.acknowledgedBy ?? "")} on{" "}
                {new Date(escalation.acknowledgedAt).toLocaleString()}
              </p>
            )}
            {escalation.status === "resolved" && (
              <div className="mt-2 flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">
                    Resolved by {getNavigatorDisplayName(escalation.resolvedBy ?? "")} on{" "}
                    {escalation.resolvedAt && new Date(escalation.resolvedAt).toLocaleString()}
                  </p>
                  {escalation.resolutionNote && <p className="mt-0.5">{escalation.resolutionNote}</p>}
                </div>
              </div>
            )}
          </div>

          {isSupervisor && escalation.status !== "resolved" && (
            <div className="flex shrink-0 gap-2">
              {escalation.status === "open" && (
                <Button size="sm" variant="outline" onClick={() => handleAcknowledge(escalation)}>
                  Acknowledge
                </Button>
              )}
              <Button
                size="sm"
                variant={isResolving ? "secondary" : "default"}
                onClick={() => {
                  setResolvingId(isResolving ? null : escalation.id)
                  setResolutionNote("")
                }}
              >
                {isResolving ? "Cancel" : "Resolve"}
              </Button>
            </div>
          )}
        </div>

        {isResolving && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <Textarea
              placeholder="Resolution note (required)..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="min-h-[70px] resize-none bg-card"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleResolve(escalation)} disabled={resolutionNote.trim().length === 0}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Confirm Resolution
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const body = (
    <div className="space-y-3">
      {!hideRaiseButton && (
        <Button size="sm" variant="outline" onClick={() => setRaiseOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Raise escalation
        </Button>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No escalations to display.</p>
      ) : (
        <div className="space-y-3">{list.map(renderRow)}</div>
      )}
      <EscalationDialog open={raiseOpen} onOpenChange={setRaiseOpen} roster={roster} />
    </div>
  )

  if (compact) {
    return (
      <>
        {body}
      </>
    )
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <TriangleAlert className="h-5 w-5 text-destructive" />
          {title}
          {openCount > 0 && <Badge variant="destructive">{openCount} open</Badge>}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
