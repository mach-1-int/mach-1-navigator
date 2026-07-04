"use client"

import { useCallback, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileUp,
  MoreHorizontal,
  RotateCcw,
  Search,
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { canTransition, statusChipMeta } from "@/lib/claim-lifecycle"
import { getPayerConfig } from "@/lib/payer-config"
import { generate837P } from "@/lib/edi/edi-837p-generator"
import { generateSample835 } from "@/lib/edi/edi-835-simulator"
import { defaultClearinghouse } from "@/lib/clearinghouse/adapter"
import { triggerFileDownload } from "@/lib/csv-exporter"
import { localTodayISO } from "@/lib/date-rebase"
import { RemittanceImportDialog } from "@/components/billing/remittance-import-dialog"
import type { BillableClaim, ClaimRecord, ClaimStatus } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Ledger statuses offered by the filter dropdown */
const FILTER_STATUSES: ClaimStatus[] = [
  "EXPORTED",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "PAID",
  "DENIED",
]

/** Small shared status chip driven by claim-lifecycle metadata */
function StatusChip({ status }: { status: ClaimStatus }) {
  const meta = statusChipMeta(status)
  return (
    <Badge variant="secondary" className={cn("font-medium", meta.colorClasses)}>
      {meta.label}
    </Badge>
  )
}

/** "G0023 x2 + G0024 x1" style codes summary from the frozen snapshot */
function formatSnapshotCodes(snapshot: BillableClaim): string {
  const parts: string[] = []
  if (snapshot.primaryUnits > 0) {
    parts.push(`${snapshot.primaryCode} x${snapshot.primaryUnits}`)
  }
  if (snapshot.addOnUnits > 0 && snapshot.addOnCode) {
    parts.push(`${snapshot.addOnCode} x${snapshot.addOnUnits}`)
  }
  return parts.length > 0 ? parts.join(" + ") : "—"
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Claims Ledger - persisted post-export claim records.
 *
 * Every exported claim lives here as an immutable snapshot and progresses
 * EXPORTED -> SUBMITTED -> ACCEPTED/REJECTED -> PAID/DENIED via row actions,
 * the simulated clearinghouse, or an imported 835 remittance.
 */
export function ClaimsLedger() {
  const {
    claimRecords,
    payers,
    patients,
    navigators,
    remarkCodes,
    organizationSettings,
    updateClaimStatus,
    recordManualPayment,
    reopenClaimRecord,
    submitClaimBatch,
    getNavigatorDisplayName,
  } = useDemoData()
  const { currentUser } = useRole()

  const userId = currentUser?.id ?? "biller1"

  // Filters
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "ALL">("ALL")
  const [search, setSearch] = useState("")

  // Row expansion
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Import dialog + generated sample 835 kept in state for "Import now"
  const [importOpen, setImportOpen] = useState(false)
  const [preloadedText, setPreloadedText] = useState<string | null>(null)

  // Manual payment / denial dialog
  const [paymentDialog, setPaymentDialog] = useState<{
    record: ClaimRecord
    mode: "PAID" | "DENIED"
  } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentCarc, setPaymentCarc] = useState("none")

  const payerNameById = useMemo(() => {
    return new Map(payers.map((p) => [p.id, p.name]))
  }, [payers])

  const carcCodes = useMemo(() => {
    return remarkCodes.filter((rc) => rc.type === "CARC")
  }, [remarkCodes])

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase()
    return [...claimRecords]
      .filter((r) => statusFilter === "ALL" || r.status === statusFilter)
      .filter((r) => term === "" || r.snapshot.patientName.toLowerCase().includes(term))
      .sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))
  }, [claimRecords, statusFilter, search])

  const toggleExpanded = useCallback((recordId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) {
        next.delete(recordId)
      } else {
        next.add(recordId)
      }
      return next
    })
  }, [])

  /** Look up a remark code description for tooltips */
  const remarkDescription = useCallback(
    (type: "CARC" | "RARC", code: string): string => {
      return (
        remarkCodes.find((rc) => rc.type === type && rc.code === code)?.description ??
        "No description on file"
      )
    },
    [remarkCodes]
  )

  /** Regenerate the 837P content for a single record (clearinghouse resubmission) */
  const buildRecord837P = useCallback(
    (record: ClaimRecord): string => {
      const payerConfig = getPayerConfig(record.payerConfigId)
      const payer =
        payers.find((p) => p.id === record.payerId) ??
        payers.find((p) => p.payerConfigId === record.payerConfigId) ??
        payers[0]
      return generate837P([record], {
        patients,
        navigators,
        payer,
        payerConfig,
        orgSettings: organizationSettings,
      })
    },
    [payers, patients, navigators, organizationSettings]
  )

  // ==========================================================================
  // ROW ACTIONS
  // ==========================================================================

  const handleMarkStatus = useCallback(
    (record: ClaimRecord, next: "SUBMITTED" | "ACCEPTED" | "REJECTED") => {
      const ok = updateClaimStatus(record.id, next, userId)
      if (ok) {
        toast.success(`${record.snapshot.patientName} marked ${statusChipMeta(next).label}`)
      } else {
        toast.error(`Cannot transition ${record.status} to ${next}`)
      }
    },
    [updateClaimStatus, userId]
  )

  const handleSimulateClearinghouse = useCallback(
    async (record: ClaimRecord) => {
      const content = buildRecord837P(record)
      const fileName = `claims-${record.snapshot.month}.837`
      toast.info(`Submitting ${record.snapshot.patientName} to ${defaultClearinghouse.name}...`)
      const result = await submitClaimBatch(
        [record.id],
        defaultClearinghouse,
        content,
        fileName,
        userId
      )
      if (result.accepted.includes(record.id)) {
        toast.success(`Clearinghouse accepted claim for ${record.snapshot.patientName}`, {
          description: `Batch ${result.clearinghouseBatchId}`,
        })
      } else {
        const rejection = result.rejected.find((rej) => rej.claimRecordId === record.id)
        toast.error(`Clearinghouse rejected claim for ${record.snapshot.patientName}`, {
          description: rejection?.reason ?? "Unknown rejection reason",
        })
      }
    },
    [buildRecord837P, submitClaimBatch, userId]
  )

  const openPaymentDialog = useCallback((record: ClaimRecord, mode: "PAID" | "DENIED") => {
    setPaymentAmount(mode === "PAID" ? record.billedAmount.toFixed(2) : "")
    setPaymentCarc("none")
    setPaymentDialog({ record, mode })
  }, [])

  const confirmPaymentDialog = useCallback(() => {
    if (!paymentDialog) return
    const { record, mode } = paymentDialog
    const carc = paymentCarc === "none" ? undefined : paymentCarc

    let amount = 0
    if (mode === "PAID") {
      amount = parseFloat(paymentAmount)
      if (isNaN(amount) || amount < 0) {
        toast.error("Please enter a valid payment amount")
        return
      }
    }

    // Persists the dollar amount as real remittance data so the Paid column,
    // detail panel, and Paid metrics all reflect manual postings.
    const ok = recordManualPayment(record.id, mode, amount, userId, carc)
    if (ok) {
      toast.success(
        mode === "PAID"
          ? `Payment of $${amount.toFixed(2)} recorded for ${record.snapshot.patientName}`
          : `${record.snapshot.patientName} marked Denied`,
        { description: carc ? `CARC ${carc}: ${remarkDescription("CARC", carc)}` : undefined }
      )
    } else {
      toast.error(`Cannot transition ${record.status} to ${mode}`)
    }
    setPaymentDialog(null)
  }, [paymentDialog, paymentAmount, paymentCarc, remarkDescription, recordManualPayment, userId])

  const handleReopen = useCallback(
    (record: ClaimRecord) => {
      reopenClaimRecord(record.id, userId)
      toast.success(`Claim reopened for rebill`, {
        description: `${record.snapshot.patientName} (${record.snapshot.month}) returned to the working tabs`,
      })
    },
    [reopenClaimRecord, userId]
  )

  // ==========================================================================
  // HEADER ACTIONS (835 round trip)
  // ==========================================================================

  const handleGenerateSample835 = useCallback(() => {
    const eligible = claimRecords.filter(
      (r) => !r.voided && (r.status === "SUBMITTED" || r.status === "ACCEPTED")
    )
    if (eligible.length === 0) {
      toast.error("No submitted or accepted claims to adjudicate", {
        description: "Submit claims to the clearinghouse first",
      })
      return
    }

    const text = generateSample835(eligible, payers)
    const date = localTodayISO()
    triggerFileDownload(text, `sample-remit-${date}.835`, "text/plain")
    setPreloadedText(text)

    toast.success(`Sample 835 generated for ${eligible.length} claims`, {
      action: {
        label: "Import now",
        onClick: () => setImportOpen(true),
      },
    })
  }, [claimRecords, payers])

  const handleOpenImport = useCallback(() => {
    setPreloadedText(null)
    setImportOpen(true)
  }, [])

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Claims Ledger</CardTitle>
              <CardDescription>
                Exported claim records and their adjudication lifecycle
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleGenerateSample835}>
                <FileDown className="h-4 w-4 mr-2" />
                Generate Sample 835
              </Button>
              <Button variant="outline" onClick={handleOpenImport}>
                <FileUp className="h-4 w-4 mr-2" />
                Import 835
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[220px]"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ClaimStatus | "ALL")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {FILTER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusChipMeta(status).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {visibleRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpenCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>
                {claimRecords.length === 0
                  ? "No exported claims yet — export from Ready to Bill to start the ledger."
                  : "No claims match the current filters."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Patient</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Codes</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Exported</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.map((record) => {
                  const isExpanded = expandedRows.has(record.id)
                  const hasActions =
                    !record.voided &&
                    (record.status === "EXPORTED" ||
                      record.status === "SUBMITTED" ||
                      record.status === "ACCEPTED" ||
                      record.status === "REJECTED" ||
                      record.status === "DENIED")

                  return (
                    <ClaimsLedgerRow
                      key={record.id}
                      record={record}
                      isExpanded={isExpanded}
                      hasActions={hasActions}
                      payerName={payerNameById.get(record.payerId) ?? record.payerId}
                      onToggleExpand={() => toggleExpanded(record.id)}
                      onMarkStatus={handleMarkStatus}
                      onSimulateClearinghouse={handleSimulateClearinghouse}
                      onOpenPaymentDialog={openPaymentDialog}
                      onReopen={handleReopen}
                      remarkDescription={remarkDescription}
                      getNavigatorDisplayName={getNavigatorDisplayName}
                    />
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manual Payment / Denial Dialog */}
      <Dialog open={paymentDialog !== null} onOpenChange={(open) => !open && setPaymentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentDialog?.mode === "PAID" ? "Record Manual Payment" : "Mark Claim Denied"}
            </DialogTitle>
            <DialogDescription>
              {paymentDialog?.record.snapshot.patientName} —{" "}
              {paymentDialog?.record.snapshot.month} (billed $
              {paymentDialog?.record.billedAmount.toFixed(2)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {paymentDialog?.mode === "PAID" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Paid Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="font-mono"
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                CARC Code {paymentDialog?.mode === "PAID" ? "(optional)" : ""}
              </label>
              <Select value={paymentCarc} onValueChange={setPaymentCarc}>
                <SelectTrigger>
                  <SelectValue placeholder="Select CARC code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {carcCodes.map((rc) => (
                    <SelectItem key={rc.id} value={rc.code}>
                      {rc.code} — {rc.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmPaymentDialog}
              className={cn(
                paymentDialog?.mode === "DENIED" && "bg-destructive hover:bg-destructive/90"
              )}
            >
              {paymentDialog?.mode === "PAID" ? "Record Payment" : "Mark Denied"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 835 Import Dialog */}
      <RemittanceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        preloadedText={preloadedText}
      />
    </TooltipProvider>
  )
}

// ============================================================================
// ROW
// ============================================================================

interface ClaimsLedgerRowProps {
  record: ClaimRecord
  isExpanded: boolean
  hasActions: boolean
  payerName: string
  onToggleExpand: () => void
  onMarkStatus: (record: ClaimRecord, next: "SUBMITTED" | "ACCEPTED" | "REJECTED") => void
  onSimulateClearinghouse: (record: ClaimRecord) => void
  onOpenPaymentDialog: (record: ClaimRecord, mode: "PAID" | "DENIED") => void
  onReopen: (record: ClaimRecord) => void
  remarkDescription: (type: "CARC" | "RARC", code: string) => string
  getNavigatorDisplayName: (id: string) => string
}

function ClaimsLedgerRow({
  record,
  isExpanded,
  hasActions,
  payerName,
  onToggleExpand,
  onMarkStatus,
  onSimulateClearinghouse,
  onOpenPaymentDialog,
  onReopen,
  remarkDescription,
  getNavigatorDisplayName,
}: ClaimsLedgerRowProps) {
  const canReopen =
    !record.voided && (record.status === "REJECTED" || record.status === "DENIED")

  return (
    <>
      <TableRow className={cn(record.voided && "opacity-50")}>
        <TableCell className="pr-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onToggleExpand}
            aria-label={isExpanded ? "Collapse row" : "Expand row"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <p className="font-medium">{record.snapshot.patientName}</p>
            {record.voided && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Voided
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-sm">{record.snapshot.month}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{payerName}</TableCell>
        <TableCell>
          <span className="font-mono text-sm">{formatSnapshotCodes(record.snapshot)}</span>
        </TableCell>
        <TableCell className="text-right font-medium">
          ${record.billedAmount.toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-medium text-emerald-600">
          {record.remittance ? `$${record.remittance.paidAmount.toFixed(2)}` : "—"}
        </TableCell>
        <TableCell>
          <StatusChip status={record.status} />
        </TableCell>
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(record.exportedAt)}
        </TableCell>
        <TableCell className="text-right">
          {hasActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Row actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canTransition(record.status, "SUBMITTED") && (
                  <DropdownMenuItem onClick={() => onMarkStatus(record, "SUBMITTED")}>
                    Mark Submitted
                  </DropdownMenuItem>
                )}
                {record.status === "EXPORTED" && (
                  <DropdownMenuItem onClick={() => onSimulateClearinghouse(record)}>
                    Simulate Clearinghouse
                  </DropdownMenuItem>
                )}
                {canTransition(record.status, "ACCEPTED") && (
                  <DropdownMenuItem onClick={() => onMarkStatus(record, "ACCEPTED")}>
                    Mark Accepted
                  </DropdownMenuItem>
                )}
                {canTransition(record.status, "REJECTED") && (
                  <DropdownMenuItem onClick={() => onMarkStatus(record, "REJECTED")}>
                    Mark Rejected
                  </DropdownMenuItem>
                )}
                {canTransition(record.status, "PAID") && (
                  <DropdownMenuItem onClick={() => onOpenPaymentDialog(record, "PAID")}>
                    Record Manual Payment
                  </DropdownMenuItem>
                )}
                {canTransition(record.status, "DENIED") && (
                  <DropdownMenuItem onClick={() => onOpenPaymentDialog(record, "DENIED")}>
                    Mark Denied
                  </DropdownMenuItem>
                )}
                {canReopen && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onReopen(record)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reopen for Rebill
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {isExpanded && (
        <TableRow className={cn("hover:bg-transparent", record.voided && "opacity-60")}>
          <TableCell colSpan={10} className="bg-muted/30 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Status history timeline */}
              <div>
                <p className="text-sm font-medium mb-2">Status History</p>
                <div className="space-y-2">
                  {record.statusHistory.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <StatusChip status={event.status} />
                      <div className="min-w-0">
                        <p className="text-muted-foreground">
                          {formatDateTime(event.at)} •{" "}
                          {event.by.startsWith("system:")
                            ? event.by
                            : getNavigatorDisplayName(event.by)}
                        </p>
                        {event.note && (
                          <p className="text-xs text-muted-foreground/80">{event.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remittance details */}
              {record.remittance && (
                <div>
                  <p className="text-sm font-medium mb-2">Remittance</p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Paid:</span>{" "}
                      <span className="font-medium text-emerald-600">
                        ${record.remittance.paidAmount.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground"> of </span>$
                      {record.remittance.chargedAmount.toFixed(2)}
                      <span className="text-muted-foreground"> charged</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Patient responsibility:</span> $
                      {record.remittance.patientResponsibility.toFixed(2)}
                    </p>
                    {record.remittance.checkOrEftNumber && (
                      <p className="text-muted-foreground text-xs">
                        Check/EFT {record.remittance.checkOrEftNumber}
                        {record.remittance.remitDate ? ` • ${record.remittance.remitDate}` : ""}
                      </p>
                    )}
                    {(record.remittance.carcCodes.length > 0 ||
                      record.remittance.rarcCodes.length > 0) && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {record.remittance.carcCodes.map((code) => (
                          <Tooltip key={`carc-${code}`}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="text-xs bg-amber-50 text-amber-700 border-amber-200 cursor-default"
                              >
                                CARC {code}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {remarkDescription("CARC", code)}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {record.remittance.rarcCodes.map((code) => (
                          <Tooltip key={`rarc-${code}`}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="text-xs bg-slate-50 text-slate-700 border-slate-200 cursor-default"
                              >
                                RARC {code}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {remarkDescription("RARC", code)}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
