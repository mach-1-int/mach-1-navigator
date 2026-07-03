"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DollarSign,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Users,
  TrendingUp,
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import {
  generateMonthlyClaims,
  filterClaimsByStatus,
  filterClaimsByMonth,
  calculateTotalRevenue,
  calculateClaimValue,
  getAvailableMonths,
  formatMonthDisplay,
} from "@/lib/claims-engine"
import { getPayerConfig } from "@/lib/payer-config"
import { downloadMonthlyClaimsCsv, generateExportSummary } from "@/lib/csv-exporter"
import type { BillableClaim } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/**
 * Revenue Cycle Manager - Claims Dashboard
 *
 * The Billing Bridge UI that allows billers to:
 * - View aggregated monthly claims
 * - Validate claim readiness
 * - Export claims to CSV for billing systems
 * - Nudge navigators about missing data
 */
export function ClaimsManager() {
  const {
    patients,
    timeLogs,
    navigators,
    intakeRecords,
    activePayerConfigId,
    activePayerConfig,
    availablePayerConfigs,
    setActivePayerConfig,
    sendNudge,
  } = useDemoData()

  // State
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [selectedTab, setSelectedTab] = useState<"ready" | "attention">("ready")
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set())
  const [nudgeDialogOpen, setNudgeDialogOpen] = useState(false)
  const [claimToNudge, setClaimToNudge] = useState<BillableClaim | null>(null)

  // Generate all claims using active payer configuration
  const allClaims = useMemo(() => {
    console.log(`📊 ClaimsManager: Processing ${timeLogs.length} time logs for ${patients.length} patients`)
    console.log(`📊 ClaimsManager: Using payer config: ${activePayerConfig.name}`)
    const claims = generateMonthlyClaims(navigators, patients, timeLogs, activePayerConfig, intakeRecords)
    console.log(`📊 ClaimsManager: Generated ${claims.length} claims`)
    return claims
  }, [navigators, patients, timeLogs, activePayerConfig, intakeRecords])

  // Get available months
  const availableMonths = useMemo(() => {
    return getAvailableMonths(allClaims)
  }, [allClaims])

  // Set default month to most recent if not set
  const activeMonth = selectedMonth || availableMonths[0] || "2026-01"

  // Filter claims by month and status
  const monthClaims = useMemo(() => {
    return filterClaimsByMonth(allClaims, activeMonth)
  }, [allClaims, activeMonth])

  const readyClaims = useMemo(() => {
    // VALIDATED (past months) and DRAFT (current, still-accruing month) are both exportable
    return [
      ...filterClaimsByStatus(monthClaims, "VALIDATED"),
      ...filterClaimsByStatus(monthClaims, "DRAFT"),
    ]
  }, [monthClaims])

  const attentionClaims = useMemo(() => {
    return filterClaimsByStatus(monthClaims, "NEEDS_ATTENTION")
  }, [monthClaims])

  // Calculate revenue metrics using active payer rates
  const revenueMetrics = useMemo(() => {
    return calculateTotalRevenue(monthClaims, activePayerConfig)
  }, [monthClaims, activePayerConfig])

  // Handle claim selection
  const handleSelectClaim = useCallback((claimId: string, checked: boolean) => {
    setSelectedClaims((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(claimId)
      } else {
        next.delete(claimId)
      }
      return next
    })
  }, [])

  // Handle select all
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedClaims(new Set(readyClaims.map((c) => c.id)))
    } else {
      setSelectedClaims(new Set())
    }
  }, [readyClaims])

  // Handle CSV export using medical billing format
  const handleExportCSV = useCallback(() => {
    const claimsToExport = readyClaims.filter((c) => selectedClaims.has(c.id))

    if (claimsToExport.length === 0) {
      toast.error("No claims selected for export")
      return
    }

    // Use the new CSV exporter with medical billing format
    // Pass patients for DOB lookup
    downloadMonthlyClaimsCsv(claimsToExport, activeMonth, patients)

    // Generate summary for console/logging
    const summary = generateExportSummary(claimsToExport)
    console.log(summary)

    // Calculate row count (base + add-on codes = separate rows)
    const rowCount = claimsToExport.reduce(
      (sum, c) => sum + (c.primaryUnits > 0 ? 1 : 0) + (c.addOnUnits > 0 ? 1 : 0),
      0
    )

    toast.success(`Exported ${claimsToExport.length} claims (${rowCount} billing rows) to CSV`)

    // Clear selection after export
    setSelectedClaims(new Set())
  }, [readyClaims, selectedClaims, activeMonth, patients])

  // Handle nudge navigator
  const handleNudgeNavigator = useCallback((claim: BillableClaim) => {
    setClaimToNudge(claim)
    setNudgeDialogOpen(true)
  }, [])

  const confirmNudge = useCallback(() => {
    if (claimToNudge) {
      // Create the nudge message content
      const issuesList = claimToNudge.validationErrors?.join(", ") || "Unknown issues"
      const nudgeContent = `Billing Review: Patient ${claimToNudge.patientName} has claim issues that need attention. Issues: ${issuesList}. Please review and update the patient record.`

      // Send the actual nudge message to the navigator
      sendNudge(
        claimToNudge.navigatorId,
        claimToNudge.patientId,
        claimToNudge.patientName,
        nudgeContent,
        "biller1", // Biller user ID
        "Revenue Cycle Manager", // Biller name
        "biller" // Sender role
      )

      toast.success(
        `Nudge sent to ${getNavigatorName(claimToNudge.navigatorId)}`,
        {
          description: `Issues: ${issuesList}`,
        }
      )
    }
    setNudgeDialogOpen(false)
    setClaimToNudge(null)
  }, [claimToNudge, sendNudge])

  // Format codes display: "G0023 (1 Unit)" and "G0023 (1 Unit) + G0024 (1 Unit)"
  const formatCodesDisplay = (claim: BillableClaim): string => {
    const parts: string[] = []
    if (claim.primaryUnits > 0) {
      const u = claim.primaryUnits === 1 ? "Unit" : "Units"
      parts.push(`${claim.primaryCode} (${claim.primaryUnits} ${u})`)
    }
    if (claim.addOnUnits > 0 && claim.addOnCode) {
      const u = claim.addOnUnits === 1 ? "Unit" : "Units"
      parts.push(`${claim.addOnCode} (${claim.addOnUnits} ${u})`)
    }
    return parts.length > 0 ? parts.join(" + ") : "—"
  }

  // Get navigator name from Navigator[] (Navigator type has id and name)
  const getNavigatorName = (navigatorId: string): string => {
    // Navigator IDs in time logs may differ from navigator entity IDs
    // Try direct match first, then partial match
    const navigator = navigators.find((n) => n.id === navigatorId)
    if (navigator) return navigator.name

    // Check for nav-maria -> nav1 style mapping
    const navIdMap: Record<string, string> = {
      "nav-maria": "Maria Gonzalez",
      "nav-david": "David Chen",
      "nav-john": "John Smith",
      "nav-sarah": "Sarah Jones",
      "nav1": "Emily Rodriguez",
      "nav2": "David Chen",
      "nav3": "Maria Santos",
    }
    return navIdMap[navigatorId] || navigatorId
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" />
            Revenue Cycle Manager
          </h1>
          <p className="text-muted-foreground">
            Aggregate, validate, and export billable claims
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Payer Config Selector */}
          <Select value={activePayerConfigId} onValueChange={setActivePayerConfig}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select payer" />
            </SelectTrigger>
            <SelectContent>
              {availablePayerConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month Selector */}
          <Select value={activeMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthDisplay(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ready to Bill</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${revenueMetrics.readyValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {revenueMetrics.readyCount} claim{revenueMetrics.readyCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className="text-2xl font-bold text-amber-600">
                  {revenueMetrics.pendingCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  claim{revenueMetrics.pendingCount !== 1 ? "s" : ""} with issues
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Minutes</p>
                <p className="text-2xl font-bold">
                  {monthClaims.reduce((sum, c) => sum + c.totalMinutes, 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  this billing period
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patients</p>
                <p className="text-2xl font-bold">{monthClaims.length}</p>
                <p className="text-xs text-muted-foreground">
                  with billable time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Info - Show active payer config */}
      <Card className="bg-muted/30">
        <CardContent className="py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <strong>{activePayerConfig.name}</strong> Billing Rates:
            </span>
            <div className="flex items-center gap-4">
              {activePayerConfig.useRuleOfEights ? (
                <>
                  <span>
                    <strong>Per 15-min Unit:</strong> ${activePayerConfig.revenueRates.baseRate.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    (Rule of Eights: 8+ min = 1 unit)
                  </span>
                </>
              ) : (
                <>
                  <span>
                    <strong>Base Unit (60 min):</strong> ${activePayerConfig.revenueRates.baseRate.toFixed(2)}
                  </span>
                  <span>
                    <strong>Add-on Unit (30 min):</strong> ${(activePayerConfig.revenueRates.addOnRate || 0).toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as "ready" | "attention")}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="ready" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Ready to Bill
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              {readyClaims.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="attention" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Needs Attention
            <Badge variant="secondary" className="bg-red-100 text-red-700">
              {attentionClaims.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Ready to Bill Tab */}
        <TabsContent value="ready" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ready to Bill</CardTitle>
                  <CardDescription>
                    Claims that have passed validation and are ready for export
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExportCSV}
                  disabled={selectedClaims.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected ({selectedClaims.size})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {readyClaims.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No claims ready for billing this month</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedClaims.size === readyClaims.length && readyClaims.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Member ID</TableHead>
                      <TableHead className="text-center">Total Mins</TableHead>
                      <TableHead>Codes Generated</TableHead>
                      <TableHead>Navigator</TableHead>
                      <TableHead className="text-right">Est. Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyClaims.map((claim) => {
                      // Use active payer config for value calculation
                      const claimValue = calculateClaimValue(claim.primaryUnits, claim.addOnUnits, activePayerConfig)
                      return (
                        <TableRow key={claim.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedClaims.has(claim.id)}
                              onCheckedChange={(checked) =>
                                handleSelectClaim(claim.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{claim.patientName}</p>
                              <p className="text-xs text-muted-foreground">
                                {claim.serviceType} • {claim.diagnosisCodes.slice(0, 2).join(", ")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {claim.memberId}
                            </code>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              {claim.totalMinutes} min
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {formatCodesDisplay(claim)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getNavigatorName(claim.navigatorId)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            ${claimValue.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Needs Attention Tab */}
        <TabsContent value="attention" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Needs Attention</CardTitle>
              <CardDescription>
                Claims with validation errors that need to be resolved before billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attentionClaims.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                  <p>All claims are validated! Nothing needs attention.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Member ID</TableHead>
                      <TableHead className="text-center">Total Mins</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Navigator</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionClaims.map((claim) => (
                      <TableRow key={claim.id} className="bg-red-50/30">
                        <TableCell>
                          <div>
                            <p className="font-medium">{claim.patientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {claim.serviceType}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {claim.memberId === "UNKNOWN" ? (
                            <Badge variant="destructive" className="text-xs">
                              Missing
                            </Badge>
                          ) : (
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {claim.memberId}
                            </code>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            // Use active payer config for threshold
                            const minThreshold = activePayerConfig.baseMinimum
                            const isBelowThreshold = claim.totalMinutes < minThreshold
                            return (
                              <Badge
                                variant="outline"
                                className={cn(
                                  isBelowThreshold
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-muted"
                                )}
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {claim.totalMinutes}/{minThreshold} min
                              </Badge>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {claim.validationErrors?.map((error, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1 text-xs text-red-600"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {error}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getNavigatorName(claim.navigatorId)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleNudgeNavigator(claim)}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Nudge
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Nudge Confirmation Dialog */}
      <AlertDialog open={nudgeDialogOpen} onOpenChange={setNudgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Nudge to Navigator?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-sm">
                {claimToNudge && (
                  <>
                    <p className="mb-2">
                      This will send a notification to{" "}
                      <strong>{getNavigatorName(claimToNudge.navigatorId)}</strong> about:
                    </p>
                    <div className="bg-muted p-3 rounded-lg space-y-1">
                      <p>
                        <strong>Patient:</strong> {claimToNudge.patientName}
                      </p>
                      <p>
                        <strong>Issues:</strong>
                      </p>
                      <ul className="list-disc list-inside text-sm">
                        {claimToNudge.validationErrors?.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNudge} className="bg-amber-600 hover:bg-amber-700">
              <Send className="h-4 w-4 mr-2" />
              Send Nudge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
