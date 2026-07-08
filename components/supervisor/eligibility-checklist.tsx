"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Clock, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import {
  ELIGIBILITY_GATES,
  INELIGIBILITY_REASON_LABELS,
  evaluateEligibility,
  type EligibilityGateKey,
} from "@/lib/referral-pipeline"
import type { Referral } from "@/lib/types"

interface EligibilityChecklistProps {
  referral: Referral
}

type GateAnswers = Partial<Record<EligibilityGateKey, boolean>>

export function EligibilityChecklist({ referral }: EligibilityChecklistProps) {
  const { completeEligibilityCheck } = useDemoData()
  const { currentUser } = useRole()
  const [answers, setAnswers] = useState<GateAnswers>({})
  const [notes, setNotes] = useState("")

  // Short-circuit: the first "no" ends the tree; later gates stay locked
  const firstNoIndex = ELIGIBILITY_GATES.findIndex((g) => answers[g.key] === false)
  const failedGate = firstNoIndex >= 0 ? ELIGIBILITY_GATES[firstNoIndex] : null
  const allYes = ELIGIBILITY_GATES.every((g) => answers[g.key] === true)

  const decision = useMemo(() => {
    if (failedGate) {
      return evaluateEligibility({
        insuranceVerified: answers.insuranceVerified ?? true,
        inServiceArea: answers.inServiceArea ?? true,
        medicalNeedConfirmed: answers.medicalNeedConfirmed ?? true,
        levelOfCareAppropriate: answers.levelOfCareAppropriate ?? true,
        ageEligible: answers.ageEligible ?? true,
      })
    }
    return null
  }, [answers, failedGate])

  const setAnswer = (key: EligibilityGateKey, value: boolean) => {
    setAnswers((prev) => {
      const next: GateAnswers = { ...prev, [key]: value }
      // Answers past a "no" are stale — clear them so re-opening a gate re-asks
      const noIndex = ELIGIBILITY_GATES.findIndex((g) => next[g.key] === false)
      if (noIndex >= 0) {
        for (const gate of ELIGIBILITY_GATES.slice(noIndex + 1)) {
          delete next[gate.key]
        }
      }
      return next
    })
  }

  const submit = () => {
    if (!currentUser) return
    completeEligibilityCheck(
      referral.id,
      {
        insuranceVerified: answers.insuranceVerified ?? false,
        inServiceArea: answers.inServiceArea ?? false,
        medicalNeedConfirmed: answers.medicalNeedConfirmed ?? false,
        levelOfCareAppropriate: answers.levelOfCareAppropriate ?? false,
        ageEligible: answers.ageEligible ?? false,
        notes: notes.trim() || undefined,
      },
      currentUser.id,
      currentUser.name
    )
  }

  return (
    <Card className="bg-card overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-card-foreground">Eligibility Review</CardTitle>
        </div>
        <CardDescription>
          Five-gate decision tree — the first &quot;No&quot; closes the referral with the mapped reason
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 overflow-y-auto">
        {ELIGIBILITY_GATES.map((gate, index) => {
          const answer = answers[gate.key]
          const locked = firstNoIndex >= 0 && index > firstNoIndex
          const isFailed = answer === false
          return (
            <div
              key={gate.key}
              className={cn(
                "rounded-lg border p-3 transition-all",
                isFailed
                  ? "border-destructive/40 bg-destructive/5"
                  : answer === true
                    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                    : "border-border",
                locked && "opacity-40 pointer-events-none"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 mt-0.5",
                      answer === true
                        ? "bg-emerald-100 text-emerald-700"
                        : isFailed
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">{gate.label}</p>
                    <p className="text-xs text-muted-foreground">{gate.question}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant={answer === true ? "default" : "outline"}
                    className={cn("h-7 px-3", answer === true && "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={() => setAnswer(gate.key, true)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant={isFailed ? "destructive" : "outline"}
                    className="h-7 px-3"
                    onClick={() => setAnswer(gate.key, false)}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    No
                  </Button>
                </div>
              </div>
            </div>
          )
        })}

        <Textarea
          placeholder="Review notes (optional)…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px] text-sm"
        />

        <Separator />

        {failedGate && decision ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-semibold text-destructive">Ineligible at gate {firstNoIndex + 1}</p>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                {INELIGIBILITY_REASON_LABELS[decision.ineligibilityReason!]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              The referral closes as ineligible and the referring provider is notified — no patient record is created.
            </p>
            <Button variant="destructive" className="w-full gap-2" onClick={submit}>
              <Send className="h-4 w-4" />
              Close as Ineligible &amp; Notify Referring Provider
            </Button>
          </div>
        ) : allYes ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                All five gates passed — eligible
              </p>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Accepting starts the 24–48h first-contact SLA clock.
            </p>
            <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={submit}>
              <CheckCircle2 className="h-4 w-4" />
              Accept — 48h Contact Clock Starts
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-1">
            Answer each gate in order to reach a decision ({ELIGIBILITY_GATES.filter((g) => answers[g.key] !== undefined).length}/5 answered)
          </p>
        )}
      </CardContent>
    </Card>
  )
}
