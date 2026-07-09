"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  GraduationCap,
  CheckCircle2,
  Circle,
  Clock,
  Award,
  ClipboardCheck,
  DollarSign,
  TrendingUp,
  ShieldCheck,
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { ONBOARDING_CURRICULUM, SHADOW_CHECKLIST, CERTIFICATION_BONUS, onboardingProgress, nextMilestone } from "@/lib/onboarding"
import { cn } from "@/lib/utils"
import type { NavigatorOnboarding, OnboardingMilestoneKey } from "@/lib/types"

const REVIEW_KEYS: OnboardingMilestoneKey[] = ["review_30", "review_60", "review_90"]

const STANDARDS_OF_EXCELLENCE = [
  "Punctual 8–4 attendance",
  "All activity logged in the scheduler",
  "Daily billing (charge slips) submitted by end of day",
  "Kindness, integrity, and quality in every patient interaction",
  "Navigational insight — anticipates barriers, connects resources",
  "Accepts and applies feedback",
]

function statusBadge(status: NavigatorOnboarding["status"]) {
  switch (status) {
    case "certified":
      return { label: "Certified", className: "bg-emerald-100 text-emerald-700" }
    case "lead":
      return { label: "Lead", className: "bg-blue-100 text-blue-700" }
    default:
      return { label: "Developmental", className: "bg-amber-100 text-amber-700" }
  }
}

function milestoneStatusConfig(status: "pending" | "in_progress" | "completed") {
  switch (status) {
    case "completed":
      return { label: "Completed", icon: CheckCircle2, className: "text-emerald-600", badgeClassName: "bg-emerald-100 text-emerald-700" }
    case "in_progress":
      return { label: "In progress", icon: Clock, className: "text-amber-600", badgeClassName: "bg-amber-100 text-amber-700" }
    default:
      return { label: "Pending", icon: Circle, className: "text-muted-foreground", badgeClassName: "bg-secondary text-secondary-foreground" }
  }
}

interface NavigatorOnboardingCardProps {
  navigatorId: string
}

export function NavigatorOnboardingCard({ navigatorId }: NavigatorOnboardingCardProps) {
  const { navigatorOnboarding, updateOnboardingMilestone, toggleShadowItem } = useDemoData()
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  // Stable "now" for days-in-program math (Date.now() is impure during render)
  const [now] = useState(() => Date.now())

  const record = navigatorOnboarding.find(r => r.navigatorId === navigatorId)

  if (!record) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <GraduationCap className="h-5 w-5 text-primary" />
            Developmental Record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No developmental record — hired before tracking</p>
        </CardContent>
      </Card>
    )
  }

  const progress = onboardingProgress(record)
  const next = nextMilestone(record)
  const badge = statusBadge(record.status)
  const daysInProgram = Math.max(0, Math.floor((now - new Date(record.startDate).getTime()) / (1000 * 60 * 60 * 24)))
  const milestoneByKey = new Map(record.milestones.map(m => [m.key, m]))

  const handleAdvance = (key: OnboardingMilestoneKey, current: "pending" | "in_progress" | "completed") => {
    const nextStatus = current === "pending" ? "in_progress" : "completed"
    updateOnboardingMilestone(navigatorId, key, nextStatus, noteDrafts[key])
  }

  const handleReopen = (key: OnboardingMilestoneKey) => {
    updateOnboardingMilestone(navigatorId, key, "in_progress")
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <GraduationCap className="h-5 w-5 text-primary" />
              Developmental Record
            </CardTitle>
            <CardDescription>
              Started {new Date(record.startDate).toLocaleDateString()} · {daysInProgram} days in program · target {record.unitsTargetPhase} units/day
            </CardDescription>
          </div>
          <Badge variant="secondary" className={badge.className}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Milestone progress</span>
            <span className="font-medium text-card-foreground">{progress.completed} / {progress.total}</span>
          </div>
          <Progress value={progress.percent} className="h-2" />
          {next && (
            <p className="mt-2 text-xs text-muted-foreground">
              Next up: <span className="font-medium text-card-foreground">{next.label}</span>
            </p>
          )}
        </div>

        {/* Milestone timeline */}
        <div className="space-y-2">
          {ONBOARDING_CURRICULUM.map((curr) => {
            const milestone = milestoneByKey.get(curr.key)
            if (!milestone) return null
            const isReview = REVIEW_KEYS.includes(curr.key)
            const isCertification = curr.key === "certification"
            const config = milestoneStatusConfig(milestone.status)
            const Icon = config.icon

            return (
              <div
                key={curr.key}
                className={cn(
                  "rounded-lg border p-3",
                  isReview && "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20",
                  isCertification && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.className)} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-card-foreground">{curr.label}</p>
                        {isReview && (
                          <Badge variant="outline" className="border-blue-300 text-blue-700 text-[10px]">
                            Review
                          </Badge>
                        )}
                        {isCertification && (
                          <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                            <DollarSign className="mr-0.5 h-3 w-3" />
                            +${CERTIFICATION_BONUS.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{curr.description}</p>
                      {isCertification && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                          <TrendingUp className="h-3 w-3" />
                          Completing this bumps units target {record.unitsTargetPhase < 18 ? "16 → 18" : "already at 18"}/day
                        </p>
                      )}
                      {milestone.note && (
                        <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{milestone.note}&rdquo;</p>
                      )}
                      {milestone.completedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Completed {new Date(milestone.completedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className={cn("shrink-0", config.badgeClassName)}>
                    {config.label}
                  </Badge>
                </div>

                {milestone.status !== "completed" && (
                  <div className="mt-2 flex items-center gap-2 pl-6">
                    <Textarea
                      value={noteDrafts[curr.key] ?? ""}
                      onChange={(e) => setNoteDrafts(prev => ({ ...prev, [curr.key]: e.target.value }))}
                      placeholder="Optional note"
                      className="h-8 min-h-8 flex-1 resize-none py-1.5 text-xs"
                    />
                    <Button
                      size="sm"
                      variant={isCertification ? "default" : "outline"}
                      onClick={() => handleAdvance(curr.key, milestone.status)}
                      className="shrink-0"
                    >
                      {milestone.status === "pending" ? "Start" : isCertification ? "Certify" : "Complete"}
                    </Button>
                  </div>
                )}
                {milestone.status === "completed" && !isCertification && (
                  <div className="mt-1 pl-6">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => handleReopen(curr.key)}>
                      Reopen
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Shadowing checklist */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-card-foreground">Weeks 2-4 shadowing checklist</p>
            </div>
            <span className="text-xs text-muted-foreground">{progress.shadowDone} / {progress.shadowTotal}</span>
          </div>
          <Progress value={progress.shadowTotal > 0 ? Math.round((progress.shadowDone / progress.shadowTotal) * 100) : 0} className="mb-3 h-1.5" />
          <div className="space-y-2">
            {SHADOW_CHECKLIST.map((item) => {
              const state = record.shadowChecklist.find(i => i.key === item.key)
              return (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={state?.done ?? false}
                    onCheckedChange={() => toggleShadowItem(navigatorId, item.key)}
                  />
                  <span className={cn(state?.done ? "text-card-foreground" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Standards of Excellence reference panel */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-card-foreground">Standards of Excellence</p>
            <span className="text-xs text-muted-foreground">(playbook §10.2)</span>
          </div>
          <ul className="space-y-1">
            {STANDARDS_OF_EXCELLENCE.map((standard) => (
              <li key={standard} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Award className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                {standard}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
