"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserPlus, AlertTriangle, Building2, Users } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import { AMDSourceIndicator } from "@/components/amd-source-indicator"

function getRiskBadge(riskScore: 1 | 2 | 3) {
  const config = {
    1: { label: "L1", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    2: { label: "L2", className: "bg-amber-100 text-amber-700 border-amber-200" },
    3: { label: "L3", className: "bg-red-100 text-red-700 border-red-200" },
  }
  return config[riskScore]
}

export function ReferralQueue() {
  const { getPendingReferrals } = useDemoData()
  const { navigateTo } = useRole()

  const pendingReferrals = getPendingReferrals()

  // Both Review and Match & Assign go to intake-workspace for smart matching
  const handleMatchAssign = (referralId: string) => {
    navigateTo("intake-workspace", { referralId })
  }

  if (pendingReferrals.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <UserPlus className="h-5 w-5 text-primary" />
            New Referrals
          </CardTitle>
          <CardDescription>Incoming patient referrals awaiting assignment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <UserPlus className="h-6 w-6" />
            </div>
            <p className="text-sm">No pending referrals</p>
            <p className="text-xs">All referrals have been assigned</p>
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
                New Referrals
              </CardTitle>
              <CardDescription>Incoming patient referrals awaiting assignment</CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              {pendingReferrals.length} pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Patient Name</TableHead>
                <TableHead className="text-muted-foreground">Referral Source</TableHead>
                <TableHead className="text-center text-muted-foreground">Risk Score</TableHead>
                <TableHead className="text-right text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingReferrals.map((referral) => {
                const risk = getRiskBadge(referral.riskScore)
                return (
                  <TableRow key={referral.id} className="border-border">
                    <TableCell>
                      <div>
                        <p className="font-medium text-card-foreground">{referral.patientName}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {referral.diagnosis}
                          <AMDSourceIndicator source="Epic EHR" />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-card-foreground">{referral.referralSource}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("font-semibold", risk.className)}>
                        {referral.riskScore === 3 && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {risk.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleMatchAssign(referral.id)}>
                        <Users className="h-4 w-4 mr-1" />
                        Match & Assign
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
