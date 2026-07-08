"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserPlus, AlertTriangle, Building2, Users, ShieldCheck, PhoneCall } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import { AMDSourceIndicator } from "@/components/amd-source-indicator"
import { OutreachSlaChip } from "@/components/supervisor/outreach-log"
import { referralStatusMeta } from "@/lib/referral-pipeline"
import type { Referral } from "@/lib/types"

function getRiskBadge(riskScore: 1 | 2 | 3) {
  const config = {
    1: { label: "L1", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    2: { label: "L2", className: "bg-amber-100 text-amber-700 border-amber-200" },
    3: { label: "L3", className: "bg-red-100 text-red-700 border-red-200" },
  }
  return config[riskScore]
}

/** Route the row CTA to the right pipeline step for the referral's status */
function rowAction(referral: Referral): { label: string; icon: typeof Users; view: "referrals" | "intake-workspace" } {
  switch (referral.status) {
    case "received":
      return { label: "Eligibility", icon: ShieldCheck, view: "referrals" }
    case "accepted":
    case "outreach":
      return { label: "Outreach", icon: PhoneCall, view: "referrals" }
    default:
      return { label: "Match & Assign", icon: Users, view: "intake-workspace" }
  }
}

export function ReferralQueue() {
  const { getPendingReferrals } = useDemoData()
  const { navigateTo } = useRole()

  const pendingReferrals = getPendingReferrals()

  const handleAction = (referral: Referral) => {
    const action = rowAction(referral)
    navigateTo(action.view, { referralId: referral.id })
  }

  if (pendingReferrals.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <UserPlus className="h-5 w-5 text-primary" />
            Referral Pipeline
          </CardTitle>
          <CardDescription>Referrals working toward intake</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <UserPlus className="h-6 w-6" />
            </div>
            <p className="text-sm">No referrals in the pipeline</p>
            <p className="text-xs">Every referral has converted or closed</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <UserPlus className="h-5 w-5 text-primary" />
                Referral Pipeline
              </CardTitle>
              <CardDescription>Referrals working toward intake</CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              {pendingReferrals.length} in pipeline
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Patient Name</TableHead>
                <TableHead className="text-muted-foreground">Referral Source</TableHead>
                <TableHead className="text-muted-foreground">Stage</TableHead>
                <TableHead className="text-center text-muted-foreground">Risk Score</TableHead>
                <TableHead className="text-right text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingReferrals.map((referral) => {
                const risk = getRiskBadge(referral.riskScore)
                const statusMeta = referralStatusMeta(referral.status)
                const action = rowAction(referral)
                const ActionIcon = action.icon
                const showSla =
                  referral.status === "accepted" ||
                  (referral.status === "outreach" && referral.outreachAttempts.length === 0)
                return (
                  <TableRow key={referral.id} className="border-border">
                    <TableCell>
                      <div>
                        <p className="font-medium text-card-foreground">{referral.patientName}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {referral.diagnosis}
                          <AMDSourceIndicator source={referral.source} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-card-foreground">{referral.referralSource}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-xs", statusMeta.colorClasses)}>
                          {statusMeta.label}
                        </Badge>
                        {showSla && <OutreachSlaChip referral={referral} />}
                        {referral.status === "outreach" && referral.outreachAttempts.length > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <PhoneCall className="h-3 w-3" />
                            {referral.outreachAttempts.length}/7
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("font-semibold", risk.className)}>
                        {referral.riskScore === 3 && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {risk.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleAction(referral)}>
                        <ActionIcon className="h-4 w-4 mr-1" />
                        {action.label}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
  )
}
