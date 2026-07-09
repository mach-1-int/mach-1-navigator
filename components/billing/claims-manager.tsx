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
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileOutput,
  Send,
  ShieldAlert,
  Users,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import {
  generateMonthlyClaims,
  filterClaimsByStatus,
  filterClaimsByMonth,
  calculateTotalRevenue,
  calculateClaimValue,
  getAvailableMonths,
  formatMonthDisplay,
} from "@/lib/claims-engine"
import { getActiveClaimMonthKeys } from "@/lib/claim-lifecycle"
import { deriveDailySlips } from "@/lib/charge-slips"
import { generate837P } from "@/lib/edi/edi-837p-generator"
import { downloadMonthlyClaimsCsv, triggerFileDownload } from "@/lib/csv-exporter"
import { ClaimsLedger } from "@/components/billing/claims-ledger"
import { DenialWorkQueue } from "@/components/billing/denial-work-queue"
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
    chargeSlips,
    navigators,
    intakeRecords,
    activePayerConfigId,
    activePayerConfig,
    availablePayerConfigs,
    setActivePayerConfig,
    sendNudge,
    claimRecords,
    payers,
    organizationSettings,
    signedContractPatientIds,
    exportClaims,
    reopenClaimRecord,
    getNavigatorDisplayName,
  } = useDemoData()
  const { currentUser } = useRole()

  // State
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [selectedTab, setSelectedTab] = useState<"ready" | "attention" | "denials" | "ledger">("ready")
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set())
  const [nudgeDialogOpen, setNudgeDialogOpen] = useState(false)
  const [claimToNudge, setClaimToNudge] = useState<BillableClaim | null>(null)

  // Generate all claims using active payer configuration.
  // signedContractPatientIds enforces the playbook §4 gate: no billing before
  // the signed Patient Agreement (navigation contract).
  const allClaims = useMemo(() => {
    return generateMonthlyClaims(navigators, patients, timeLogs, activePayerConfig, intakeRecords, signedContractPatientIds)
  }, [navigators, patients, timeLogs, activePayerConfig, intakeRecords, signedContractPatientIds])

  // Get available months
  const availableMonths = useMemo(() => {
    return getAvailableMonths(allClaims)
  }, [allClaims])

  // Set default month to most recent if not set
  const activeMonth = selectedMonth || availableMonths[0] || "2026-01"

  // Patient-months already tracked by an active (non-voided) ClaimRecord stay
  // out of the derived working tabs — the ledger owns them now. Keyed by
  // patient-month WITHOUT the payer config: the same service minutes must not
  // become exportable again just because the payer dropdown changed.
  const activeMonthKeys = useMemo(() => {
    return getActiveClaimMonthKeys(claimRecords)
  }, [claimRecords])

  // Filter claims by month and status
  const monthClaims = useMemo(() => {
    return filterClaimsByMonth(allClaims, activeMonth).filter(
      (claim) => !activeMonthKeys.has(`${claim.patientId}:${claim.month}`)
    )
  }, [allClaims, activeMonth, activeMonthKeys])

  // Post-export activity guard: exported snapshots are frozen, so any minutes
  // logged AFTER an export would otherwise vanish (suppressed from the tabs,
  // absent from the snapshot). Surface those patient-months for rebill.
  const unbilledResiduals = useMemo(() => {
    const activeByKey = new Map(
      claimRecords
        .filter((r) => !r.voided)
        .map((r) => [`${r.snapshot.patientId}:${r.snapshot.month}`, r] as const)
    )
    return filterClaimsByMonth(allClaims, activeMonth)
      .map((claim) => {
        const record = activeByKey.get(`${claim.patientId}:${claim.month}`)
        if (!record || claim.totalMinutes <= record.snapshot.totalMinutes) return null
        return {
          record,
          patientName: claim.patientName,
          newMinutes: claim.totalMinutes - record.snapshot.totalMinutes,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  }, [allClaims, activeMonth, claimRecords])

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

  // Ledger metrics from persisted claim records
  const activeRecords = useMemo(() => claimRecords.filter((r) => !r.voided), [claimRecords])

  const deniedCount = useMemo(
    () => activeRecords.filter((r) => r.status === "DENIED").length,
    [activeRecords]
  )

  // Informational day-close signal per claim: unsigned charge-slip days in the
  // claim's month. NEVER a validation error — claims export regardless.
  const unsignedSlipDaysByClaim = useMemo(() => {
    const counts = new Map<string, number>()
    const slips = deriveDailySlips(timeLogs, chargeSlips, activePayerConfig)
    for (const slip of slips) {
      if (slip.signed) continue
      const key = `${slip.patientId}:${slip.date.slice(0, 7)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [timeLogs, chargeSlips, activePayerConfig])

  const outstandingAR = useMemo(() => {
    return activeRecords
      .filter((r) => r.status === "EXPORTED" || r.status === "SUBMITTED" || r.status === "ACCEPTED")
      .reduce((sum, r) => sum + r.billedAmount, 0)
  }, [activeRecords])

  const paidTotal = useMemo(() => {
    return activeRecords
      .filter((r) => r.status === "PAID")
      .reduce((sum, r) => sum + (r.remittance?.paidAmount ?? 0), 0)
  }, [activeRecords])

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

    // Persist immutable ClaimRecords in the ledger (EXPORTED)
    exportClaims(claimsToExport, "CSV", currentUser?.id ?? "biller1")

    // Use the CSV exporter with medical billing format
    downloadMonthlyClaimsCsv(claimsToExport, activeMonth, patients, navigators, organizationSettings)

    // Calculate row count (base + add-on codes = separate rows)
    const rowCount = claimsToExport.reduce(
      (sum, c) => sum + (c.primaryUnits > 0 ? 1 : 0) + (c.addOnUnits > 0 ? 1 : 0),
      0
    )

    toast.success(
      `Exported ${claimsToExport.length} claims (${rowCount} billing rows) to CSV`,
      { description: "Claims moved to the Ledger for tracking" }
    )

    // Clear selection after export
    setSelectedClaims(new Set())
  }, [readyClaims, selectedClaims, activeMonth, patients, navigators, organizationSettings, exportClaims, currentUser])

  // Handle 837P export: persist records, generate X12, download
  const handleExport837P = useCallback(() => {
    const claimsToExport = readyClaims.filter((c) => selectedClaims.has(c.id))

    if (claimsToExport.length === 0) {
      toast.error("No claims selected for export")
      return
    }

    const records = exportClaims(claimsToExport, "837P", currentUser?.id ?? "biller1")

    // An 837P file is addressed to ONE payer. Group records by their claim's
    // payerId (validation guarantees exported claims carry one) and emit one
    // file per payer — never guess a payer from the shared billing config.
    const byPayer = new Map<string, typeof records>()
    for (const record of records) {
      const group = byPayer.get(record.payerId) ?? []
      group.push(record)
      byPayer.set(record.payerId, group)
    }

    let files = 0
    for (const [payerId, payerRecords] of byPayer) {
      const payer = payers.find((p) => p.id === payerId)
      if (!payer) {
        toast.error(`${payerRecords.length} claim(s) skipped: unresolved payer "${payerId}"`)
        continue
      }
      const content = generate837P(payerRecords, {
        patients,
        navigators,
        payer,
        payerConfig: activePayerConfig,
        orgSettings: organizationSettings,
      })
      const suffix = byPayer.size > 1 ? `-${payer.id.replace(/^payer-/, "")}` : ""
      triggerFileDownload(content, `claims-${activeMonth}${suffix}.837`, "text/plain")
      files++
    }

    toast.success(`Exported ${records.length} claims as 837P (${files} file${files === 1 ? "" : "s"})`, {
      description: "Claims moved to the Ledger for tracking",
    })

    setSelectedClaims(new Set())
  }, [
    readyClaims,
    selectedClaims,
    activeMonth,
    patients,
    navigators,
    payers,
    activePayerConfig,
    organizationSettings,
    exportClaims,
    currentUser,
  ])

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
        `Nudge sent to ${getNavigatorDisplayName(claimToNudge.navigatorId)}`,
        {
          description: `Issues: ${issuesList}`,
        }
      )
    }
    setNudgeDialogOpen(false)
    setClaimToNudge(null)
  }, [claimToNudge, sendNudge, getNavigatorDisplayName])

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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <FileOutput className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding A/R</p>
                <p className="text-2xl font-bold text-indigo-600">
                  ${outstandingAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  exported, submitted, accepted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  posted from remittances
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
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as "ready" | "attention" | "denials" | "ledger")}>
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
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
          <TabsTrigger value="denials" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Denials
            <Badge variant="secondary" className="bg-rose-100 text-rose-700">
              {deniedCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4" />
            Ledger
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {activeRecords.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Ready to Bill Tab */}
        <TabsContent value="ready" className="mt-4">
          {unbilledResiduals.length > 0 && (
            <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Unbilled activity since export
                </CardTitle>
                <CardDescription>
                  Time was logged after these claims were exported. The exported
                  snapshots are frozen — reopen a claim to rebill the full month.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {unbilledResiduals.map(({ record, patientName, newMinutes }) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-md border border-amber-200 bg-card px-3 py-2 dark:border-amber-900"
                  >
                    <span className="text-sm">
                      <span className="font-medium">{patientName}</span>
                      <span className="text-muted-foreground">
                        {" "}— {newMinutes} min logged since export ({record.snapshot.month})
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
                      disabled={record.status !== "REJECTED" && record.status !== "DENIED" && record.status !== "EXPORTED"}
                      onClick={() => {
                        reopenClaimRecord(record.id, currentUser?.id ?? "biller1")
                        toast.info(`${patientName}'s claim reopened — the full month is back in the working tabs`)
                      }}
                    >
                      Reopen for rebill
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ready to Bill</CardTitle>
                  <CardDescription>
                    Claims that have passed validation and are ready for export
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleExportCSV}
                    disabled={selectedClaims.size === 0}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected ({selectedClaims.size})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExport837P}
                    disabled={selectedClaims.size === 0}
                    className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  >
                    <FileOutput className="h-4 w-4 mr-2" />
                    Export 837P
                  </Button>
                </div>
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
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{claim.patientName}</p>
                                {claim.status === "DRAFT" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                                  >
                                    In-progress month
                                  </Badge>
                                )}
                                {(() => {
                                  const unsignedDays = unsignedSlipDaysByClaim.get(
                                    `${claim.patientId}:${claim.month}`
                                  )
                                  return unsignedDays ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-slate-50 text-slate-600 border-slate-200 text-xs"
                                    >
                                      {unsignedDays} unsigned slip-day{unsignedDays === 1 ? "" : "s"}
                                    </Badge>
                                  ) : null
                                })()}
                              </div>
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
                            {getNavigatorDisplayName(claim.navigatorId)}
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
                          {getNavigatorDisplayName(claim.navigatorId)}
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

        {/* Denial Work Queue Tab */}
        <TabsContent value="denials" className="mt-4">
          <DenialWorkQueue />
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger" className="mt-4">
          <ClaimsLedger />
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
                      <strong>{getNavigatorDisplayName(claimToNudge.navigatorId)}</strong> about:
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
