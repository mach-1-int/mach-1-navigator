"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ClipboardSignature, PenLine } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useToast } from "@/hooks/use-toast"
import { deriveDailySlips, computeDayCloseStatus, type DerivedChargeSlip } from "@/lib/charge-slips"
import { localTodayISO } from "@/lib/date-rebase"
import type { ChargeSlip } from "@/lib/types"
import { cn } from "@/lib/utils"

interface DayClosePanelProps {
  navigatorId: string
  navigatorName: string
}

/** Strip derived-only fields so only the ChargeSlip shape persists at signing */
function toSlipPayload(slip: DerivedChargeSlip): Omit<ChargeSlip, "signedAt" | "signedBy"> {
  return {
    id: slip.id,
    navigatorId: slip.navigatorId,
    patientId: slip.patientId,
    date: slip.date,
    timeLogIds: slip.timeLogIds,
    totalMinutes: slip.totalMinutes,
    units: slip.units,
    code: slip.code,
  }
}

/**
 * Today's Charge Slips — Gellert's end-of-day billing attestation ("the face
 * sheet you can't lose"). One row per patient seen today with per-day Rule of
 * Eights units; signing persists the slip and closes the day.
 */
export function DayClosePanel({ navigatorId, navigatorName }: DayClosePanelProps) {
  const { timeLogs, chargeSlips, patients, activePayerConfig, signChargeSlip, signAllChargeSlips } =
    useDemoData()
  const { toast } = useToast()

  const today = localTodayISO()

  const slips = useMemo(
    () => deriveDailySlips(timeLogs, chargeSlips, activePayerConfig, { navigatorId, date: today }),
    [timeLogs, chargeSlips, activePayerConfig, navigatorId, today]
  )
  const status = useMemo(() => computeDayCloseStatus(slips), [slips])

  const patientNameById = useMemo(() => new Map(patients.map((p) => [p.id, p.name])), [patients])

  const handleSign = (slip: DerivedChargeSlip) => {
    signChargeSlip(toSlipPayload(slip), navigatorId, navigatorName)
    toast({
      title: "Charge slip signed",
      description: `${patientNameById.get(slip.patientId) ?? slip.patientId} — ${slip.totalMinutes} min = ${slip.units} unit${slip.units === 1 ? "" : "s"} ${slip.code}`,
    })
  }

  const handleSignDay = () => {
    const unsigned = slips.filter((s) => !s.signed).map(toSlipPayload)
    signAllChargeSlips(unsigned, navigatorId, navigatorName)
    toast({
      title: "Day closed",
      description: `${unsigned.length} charge slip${unsigned.length === 1 ? "" : "s"} signed — ${status.totalUnits} daily units submitted`,
    })
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <ClipboardSignature className="h-5 w-5 text-primary" />
              Today&apos;s Charge Slips
            </CardTitle>
            <CardDescription>
              Sign each patient-day to submit daily billing — daily units (charge slips)
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {status.totalSlips} patient{status.totalSlips === 1 ? "" : "s"} ·{" "}
              {status.totalUnits} unit{status.totalUnits === 1 ? "" : "s"}
            </span>
            {status.dayClosed ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Day closed
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={handleSignDay}
                disabled={status.unsignedSlips === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <PenLine className="h-4 w-4 mr-2" />
                Sign &amp; Submit Day
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {slips.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No time logged today — charge slips appear as you log patient time
          </p>
        ) : (
          <div className="space-y-2">
            {slips.map((slip) => (
              <div
                key={slip.id}
                className={cn(
                  "rounded-lg border p-3",
                  slip.isSubMinimum
                    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                    : "border-border bg-secondary/50"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-card-foreground truncate">
                      {patientNameById.get(slip.patientId) ?? slip.patientId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {slip.totalMinutes} min · {slip.units} unit{slip.units === 1 ? "" : "s"}{" "}
                      {slip.code}
                    </p>
                  </div>
                  {slip.signed ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 shrink-0"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Signed
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleSign(slip)} className="shrink-0">
                      <PenLine className="h-3.5 w-3.5 mr-1" />
                      Sign
                    </Button>
                  )}
                </div>
                {slip.isSubMinimum && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    {slip.totalMinutes} min — below the {activePayerConfig.baseMinimum}-minute
                    billable minimum. Stack activities for this patient into one visit window to
                    capture the unit.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
