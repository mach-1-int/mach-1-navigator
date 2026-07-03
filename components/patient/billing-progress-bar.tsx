"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDemoData } from "@/lib/demo-data-context"
import {
  calculateCurrentMonthBillingProgress,
  formatBillingCodes,
  getTimeLogsSummaryByDate,
} from "@/lib/billing-engine"
import type { ServiceType } from "@/lib/types"

interface BillingProgressBarProps {
  patientId: string
  serviceType?: ServiceType
  showDetails?: boolean
  compact?: boolean
}

/**
 * Visual progress bar showing billing status for current month
 * Payer-aware: renders Rule of Eights (Medicaid) or base + add-on (Medicare)
 */
export function BillingProgressBar({
  patientId,
  serviceType = "CHI",
  showDetails = true,
  compact = false,
}: BillingProgressBarProps) {
  const { timeLogs, getPatient, activePayerConfig } = useDemoData()

  const patient = getPatient(patientId)
  const effectiveServiceType = patient?.billingTrack || serviceType

  // Calculate billing progress for current month under the active payer
  const billingResult = useMemo(() => {
    return calculateCurrentMonthBillingProgress(timeLogs, patientId, activePayerConfig)
  }, [timeLogs, patientId, activePayerConfig])

  const isRuleOfEights = billingResult.mode === "RULE_OF_EIGHTS"
  const baseMinimum = activePayerConfig.baseMinimum

  // Get time logs summary for tooltip
  const logsSummary = useMemo(() => {
    return getTimeLogsSummaryByDate(timeLogs, patientId, billingResult.billingPeriod)
  }, [timeLogs, patientId, billingResult.billingPeriod])

  // Estimated revenue (payer rate card)
  const estimatedRevenue = billingResult.estimatedRevenue

  // Main progress bar value:
  // - Medicaid: progress within the current 15-min unit window
  // - Medicare: progress toward the base code threshold
  const overallProgress = useMemo(() => {
    if (isRuleOfEights) {
      return billingResult.progressToNextUnit
    }
    if (billingResult.totalMinutes >= baseMinimum) {
      return 100
    }
    return (billingResult.totalMinutes / baseMinimum) * 100
  }, [isRuleOfEights, billingResult.progressToNextUnit, billingResult.totalMinutes, baseMinimum])

  // Compact/inline minutes label
  const minutesLabel = isRuleOfEights
    ? `${billingResult.totalMinutes} min • ${billingResult.unitsEarned} units earned`
    : `${billingResult.totalMinutes}/${baseMinimum} min`

  // Get status icon
  const statusIcon =
    billingResult.statusLevel === "unbillable" ? (
      <Clock className="h-4 w-4 text-amber-600" />
    ) : billingResult.statusLevel === "qualified" ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingUp className="h-4 w-4 text-blue-600" />
    )

  // Format month name
  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <div className="w-24">
                <Progress
                  value={overallProgress}
                  className={cn(
                    "h-2",
                    billingResult.statusLevel === "unbillable"
                      ? "[&>div]:bg-amber-500"
                      : billingResult.statusLevel === "qualified"
                        ? "[&>div]:bg-green-500"
                        : "[&>div]:bg-blue-500"
                  )}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {minutesLabel}
              </span>
              {billingResult.isBillable && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  {billingResult.baseCode}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{billingResult.statusText}</p>
              <p className="text-xs text-muted-foreground">
                {formatBillingCodes(billingResult)}
              </p>
              {billingResult.isBillable && (
                <p className="text-xs text-green-600">
                  Est. Revenue: ${estimatedRevenue.toFixed(2)}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Card className={cn(
      "border-2 transition-colors",
      billingResult.statusLevel === "unbillable"
        ? "border-amber-200 bg-amber-50/30"
        : billingResult.statusLevel === "qualified"
          ? "border-green-200 bg-green-50/30"
          : "border-blue-200 bg-blue-50/30"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Billing Progress - {monthName}
          </CardTitle>
          {isRuleOfEights ? (
            <Badge
              variant="outline"
              className="text-xs bg-teal-50 text-teal-700 border-teal-200"
            >
              {billingResult.payerName}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                effectiveServiceType === "PIN"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              )}
            >
              {effectiveServiceType === "PIN" ? "Principal Illness" : "Community Health"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {statusIcon}
              <span className={cn(
                "font-medium",
                billingResult.statusLevel === "unbillable"
                  ? "text-amber-700"
                  : billingResult.statusLevel === "qualified"
                    ? "text-green-700"
                    : "text-blue-700"
              )}>
                {billingResult.statusText}
              </span>
            </div>
            <span className="text-muted-foreground font-mono">
              {minutesLabel}
            </span>
          </div>

          {/* Progress toward next unit (Medicaid) or base code (Medicare) */}
          <div className="relative">
            <Progress
              value={overallProgress}
              className={cn(
                "h-4",
                billingResult.statusLevel === "unbillable"
                  ? "[&>div]:bg-amber-500"
                  : billingResult.statusLevel === "qualified"
                    ? "[&>div]:bg-green-500"
                    : "[&>div]:bg-blue-500"
              )}
            />
            {/* Threshold markers */}
            <div className="absolute inset-0 flex items-center">
              <div
                className="absolute h-full w-px bg-foreground/30"
                style={{ left: "100%" }}
              />
            </div>
          </div>

          {/* Threshold labels */}
          {isRuleOfEights ? (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {billingResult.unitsEarned > 0
                  ? `${billingResult.unitsEarned} unit${billingResult.unitsEarned > 1 ? "s" : ""} earned`
                  : "0 units earned"}
              </span>
              <span className="font-medium">
                {billingResult.unitsEarned === 0
                  ? `${baseMinimum} min = 1st unit`
                  : `${billingResult.minutesToNextUnit} min to next unit`}
              </span>
            </div>
          ) : (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 min</span>
              <span className="font-medium">{baseMinimum} min (Base Code)</span>
            </div>
          )}
        </div>

        {/* Add-on progress (Medicare only) */}
        {!isRuleOfEights && billingResult.totalMinutes > baseMinimum && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Add-on Progress</span>
              <span className="font-medium">
                {billingResult.addOnUnits > 0 && `${billingResult.addOnCode} x${billingResult.addOnUnits}`}
                {billingResult.addOnUnits === 0 && "Working toward first add-on"}
              </span>
            </div>
            <Progress
              value={billingResult.progressToNextUnit}
              className="h-2 [&>div]:bg-blue-400"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {(billingResult.totalMinutes - baseMinimum) % activePayerConfig.unitIncrement} min into current unit
              </span>
              <span>{billingResult.minutesToNextUnit} min to next unit</span>
            </div>
          </div>
        )}

        {showDetails && (
          <>
            <Separator />

            {/* Billing Summary */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Codes</p>
                <p className="font-medium">{formatBillingCodes(billingResult)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Est. Revenue</p>
                <p className={cn(
                  "font-medium",
                  estimatedRevenue > 0 ? "text-green-600" : "text-muted-foreground"
                )}>
                  {estimatedRevenue > 0 ? `$${estimatedRevenue.toFixed(2)}` : "--"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Encounters</p>
                <p className="font-medium">{logsSummary.length}</p>
              </div>
            </div>

            {/* Code Breakdown */}
            {billingResult.breakdown.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Billing Breakdown</p>
                <div className="space-y-1">
                  {billingResult.breakdown.map((item, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-2 rounded text-sm",
                        item.qualified
                          ? "bg-green-50 border border-green-100"
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {item.qualified ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-mono">{item.code}</span>
                      </div>
                      <span className={cn(
                        item.qualified ? "text-green-700" : "text-muted-foreground"
                      )}>
                        {item.minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Time Logs */}
            {logsSummary.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Recent Encounters
                </p>
                <div className="space-y-1 max-h-[100px] overflow-y-auto">
                  {logsSummary.slice(-5).reverse().map((log) => (
                    <div
                      key={log.date}
                      className="flex items-center justify-between text-xs p-1.5 bg-muted/30 rounded"
                    >
                      <span>
                        {new Date(log.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-muted-foreground">{log.modality}</span>
                      <span className="font-medium">{log.minutes} min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Minimal inline billing indicator for lists/tables
 */
export function BillingIndicator({
  patientId,
}: {
  patientId: string
  serviceType?: ServiceType
}) {
  const { timeLogs, activePayerConfig } = useDemoData()

  const billingResult = useMemo(() => {
    return calculateCurrentMonthBillingProgress(timeLogs, patientId, activePayerConfig)
  }, [timeLogs, patientId, activePayerConfig])

  const isRuleOfEights = billingResult.mode === "RULE_OF_EIGHTS"
  const minutesLabel = isRuleOfEights
    ? `${billingResult.totalMinutes} min • ${billingResult.unitsEarned} units`
    : `${billingResult.totalMinutes}/${activePayerConfig.baseMinimum} min`

  if (billingResult.totalMinutes === 0) {
    return (
      <span className="text-xs text-muted-foreground">No time logged</span>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "text-xs cursor-help",
              billingResult.statusLevel === "unbillable"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : billingResult.statusLevel === "qualified"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
            )}
          >
            {minutesLabel}
            {billingResult.isBillable && ` • ${billingResult.baseCode}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{billingResult.statusText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
