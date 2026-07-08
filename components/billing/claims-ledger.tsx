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
  AlertTriangle,
  BookOpenCheck,
  BookPlus,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileUp,
  MoreHorizontal,
  RefreshCcw,
  RotateCcw,
  Search,
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { canTransition, statusChipMeta } from "@/lib/claim-lifecycle"
import { getPayerConfig } from "@/lib/payer-config"
import { classifyRemitCodes, type ClassifiedRemitCode } from "@/lib/remittance-review"
import { classificationMeta } from "@/components/billing/denial-work-queue"
import { generate837P } from "@/lib/edi/edi-837p-generator"
import { generateSample835, type RemitScenario } from "@/lib/edi/edi-835-simulator"
import { defaultClearinghouse } from "@/lib/clearinghouse/adapter"
import { triggerFileDownload } from "@/lib/csv-exporter"
import { localTodayISO } from "@/lib/date-rebase"
import { RemittanceImportDialog } from "@/components/billing/remittance-import-dialog"
import type { BillableClaim, ClaimRecord, ClaimStatus, RemarkClassification } from "@/lib/types"
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

/**
 * Pseudo-status for the DAP review queue: records whose remittance is HELD on
 * unknown remark codes (pendedRemittance set). Not a ClaimStatus — the state
 * machine is untouched; these records sit at ACCEPTED until reprocessed.
 */
type LedgerStatusFilter = ClaimStatus | "ALL" | "NEEDS_REVIEW"

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
    addRemarkCode,
    reprocessPendedRemittances,
    getNavigatorDisplayName,
  } = useDemoData()
  const { currentUser } = useRole()

  const userId = currentUser?.id ?? "biller1"
  const userName = currentUser?.name ?? "Biller"

  // Filters
  const [statusFilter, setStatusFilter] = useState<LedgerStatusFilter>("ALL")
  const [search, setSearch] = useState("")

  // Row expansion
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Import dialog + generated sample 835 kept in state for "Import now"
  const [importOpen, setImportOpen] = useState(false)
  const [preloadedText, setPreloadedText] = useState<string | null>(null)

  // "Add code to dictionary" inline dialog (biller can't reach the admin view)
  const [addCodeDialog, setAddCodeDialog] = useState<{
    code: string
    type: "CARC" | "RARC"
  } | null>(null)
  const [addCodeDescription, setAddCodeDescription] = useState("")
  const [addCodeClassification, setAddCodeClassification] =
    useState<RemarkClassification>("adjustment")

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

  const needsReviewCount = useMemo(() => {
    return claimRecords.filter((r) => !r.voided && r.pendedRemittance).length
  }, [claimRecords])

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase()
    return [...claimRecords]
      .filter((r) =>
        statusFilter === "ALL"
          ? true
          : statusFilter === "NEEDS_REVIEW"
            ? !r.voided && !!r.pendedRemittance
            : r.status === statusFilter
      )
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

  /** Join remit codes against the dictionary (descriptions + classifications) */
  const classifyCodes = useCallback(
    (codes: string[]): ClassifiedRemitCode[] => classifyRemitCodes(codes, remarkCodes),
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
  // PEND REVIEW ACTIONS (DAP false-denial guardrail)
  // ==========================================================================

  const openAddCodeDialog = useCallback((code: string) => {
    setAddCodeDescription("")
    setAddCodeClassification("adjustment")
    setAddCodeDialog({ code, type: /^[a-z]/i.test(code) ? "RARC" : "CARC" })
  }, [])

  const confirmAddCode = useCallback(() => {
    if (!addCodeDialog) return
    if (!addCodeDescription.trim()) {
      toast.error("Please enter a description for the code")
      return
    }
    addRemarkCode(
      {
        type: addCodeDialog.type,
        code: addCodeDialog.code,
        description: addCodeDescription.trim(),
        classification: addCodeClassification,
      },
      userId,
      userName
    )
    toast.success(`${addCodeDialog.type} ${addCodeDialog.code} added to the dictionary`, {
      description: `Classified: ${addCodeClassification} — reprocess pended remits to post`,
    })
    setAddCodeDialog(null)
  }, [addCodeDialog, addCodeDescription, addCodeClassification, addRemarkCode, userId, userName])

  const handleReprocess = useCallback(() => {
    const result = reprocessPendedRemittances(userId)
    if (result.reprocessed === 0) {
      toast.info("No pended remittances resolved", {
        description:
          result.stillPended > 0
            ? `${result.stillPended} still pended — add the unknown codes to the dictionary first`
            : "Nothing is pended for review",
      })
      return
    }
    toast.success(
      `${result.reprocessed} pended remittance${result.reprocessed === 1 ? "" : "s"} posted`,
      {
        description:
          result.stillPended > 0
            ? `${result.stillPended} still pended on unknown codes`
            : "Review queue is clear",
      }
    )
  }, [reprocessPendedRemittances, userId])

  // ==========================================================================
  // HEADER ACTIONS (835 round trip)
  // ==========================================================================

  const handleGenerateSample835 = useCallback((scenario: RemitScenario) => {
    const eligible = claimRecords.filter(
      (r) => !r.voided && (r.status === "SUBMITTED" || r.status === "ACCEPTED")
    )
    if (eligible.length === 0) {
      toast.error("No submitted or accepted claims to adjudicate", {
        description: "Submit claims to the clearinghouse first",
      })
      return
    }

    const text = generateSample835(eligible, payers, { scenario })
    const date = localTodayISO()
    const suffix = scenario === "DAP_ADJUSTMENT" ? "dap" : "mixed"
    triggerFileDownload(text, `sample-remit-${suffix}-${date}.835`, "text/plain")
    setPreloadedText(text)

    toast.success(
      scenario === "DAP_ADJUSTMENT"
        ? `UHC DAP sample 835 generated for ${eligible.length} claims`
        : `Sample 835 generated for ${eligible.length} claims`,
      {
        description:
          scenario === "DAP_ADJUSTMENT"
            ? "Every claim paid at 101% with CARC 144 / RARC N807 — unknown to the dictionary"
            : undefined,
        action: {
          label: "Import now",
          onClick: () => setImportOpen(true),
        },
      }
    )
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <FileDown className="h-4 w-4 mr-2" />
                    Generate Sample 835
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleGenerateSample835("MIXED")}>
                    Standard remit (mixed)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleGenerateSample835("DAP_ADJUSTMENT")}>
                    UHC DAP scenario (unknown incentive code)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              onValueChange={(v) => setStatusFilter(v as LedgerStatusFilter)}
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
                <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
              </SelectContent>
            </Select>
            {needsReviewCount > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-300 cursor-pointer"
                onClick={() => setStatusFilter("NEEDS_REVIEW")}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {needsReviewCount} pended for review
              </Badge>
            )}
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
                      onAddCode={openAddCodeDialog}
                      onReprocess={handleReprocess}
                      classifyCodes={classifyCodes}
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

      {/* Add Code to Dictionary Dialog (inline — biller can't reach the admin view) */}
      <Dialog open={addCodeDialog !== null} onOpenChange={(open) => !open && setAddCodeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Code to Dictionary</DialogTitle>
            <DialogDescription>
              Classify the unknown remark code so the pended remittance can post correctly
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <p className="font-mono font-semibold pt-1">{addCodeDialog?.code}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={addCodeDialog?.type ?? "CARC"}
                  onValueChange={(v) =>
                    setAddCodeDialog((prev) =>
                      prev ? { ...prev, type: v as "CARC" | "RARC" } : prev
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CARC">CARC — Claim Adjustment Reason Code</SelectItem>
                    <SelectItem value="RARC">RARC — Remittance Advice Remark Code</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={addCodeDescription}
                onChange={(e) => setAddCodeDescription(e.target.value)}
                placeholder="e.g., Incentive adjustment (Differential Adjustment Payment)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Classification</label>
              <Select
                value={addCodeClassification}
                onValueChange={(v) => setAddCodeClassification(v as RemarkClassification)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informational">Informational</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="denial">Denial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCodeDialog(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAddCode}>
              <BookPlus className="h-4 w-4 mr-2" />
              Add to Dictionary
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
  onAddCode: (code: string) => void
  onReprocess: () => void
  classifyCodes: (codes: string[]) => ClassifiedRemitCode[]
  getNavigatorDisplayName: (id: string) => string
}

/** Remit-code badge with dictionary description + classification tooltip */
function RemitCodeBadge({ classified, kind }: { classified: ClassifiedRemitCode; kind: "CARC" | "RARC" }) {
  const meta = classificationMeta(classified.classification)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-xs cursor-default",
            kind === "CARC"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-50 text-slate-700 border-slate-200"
          )}
        >
          {kind} {classified.code}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1">
        <p>{classified.description}</p>
        <Badge variant="outline" className={cn("text-xs", meta.colorClasses)}>
          {meta.label}
        </Badge>
      </TooltipContent>
    </Tooltip>
  )
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
  onAddCode,
  onReprocess,
  classifyCodes,
  getNavigatorDisplayName,
}: ClaimsLedgerRowProps) {
  const canReopen =
    !record.voided && (record.status === "REJECTED" || record.status === "DENIED")

  const pend = !record.voided ? record.pendedRemittance : undefined
  const isDapPaid =
    record.status === "PAID" &&
    !!record.remittance &&
    record.remittance.carcCodes.includes("144") &&
    record.remittance.paidAmount > record.billedAmount

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
          <span className="inline-flex items-center gap-1.5">
            {isDapPaid && (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                +1% DAP
              </Badge>
            )}
            {record.remittance ? `$${record.remittance.paidAmount.toFixed(2)}` : "—"}
          </span>
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5">
            <StatusChip status={record.status} />
            {pend && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-50 text-amber-700 border-amber-300"
              >
                Needs Review
              </Badge>
            )}
          </span>
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
                    {isDapPaid && (
                      <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-medium pt-1">
                        <BookOpenCheck className="h-3.5 w-3.5 shrink-0" />
                        +1% incentive adjustment (CARC 144 — classified:{" "}
                        {classifyCodes(["144"])[0]?.classification ?? "adjustment"})
                      </p>
                    )}
                    {(record.remittance.carcCodes.length > 0 ||
                      record.remittance.rarcCodes.length > 0) && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {classifyCodes(record.remittance.carcCodes).map((classified) => (
                          <RemitCodeBadge
                            key={`carc-${classified.code}`}
                            classified={classified}
                            kind="CARC"
                          />
                        ))}
                        {classifyCodes(record.remittance.rarcCodes).map((classified) => (
                          <RemitCodeBadge
                            key={`rarc-${classified.code}`}
                            classified={classified}
                            kind="RARC"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pended remittance (DAP review queue) */}
              {pend && (
                <div className="md:col-span-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Remittance pended for review
                  </p>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Would post:</span>{" "}
                      <span className="font-medium">{pend.resolvedStatus}</span>
                      <span className="text-muted-foreground"> at </span>
                      <span className="font-medium text-emerald-600">
                        ${pend.remittance.paidAmount.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        (billed ${record.billedAmount.toFixed(2)}) — held on unknown remark code
                        {pend.unknownCodes.length === 1 ? "" : "s"}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {pend.unknownCodes.map((code) => (
                        <span key={code} className="inline-flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-100 text-amber-700 border-amber-300 font-mono"
                          >
                            {code}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onAddCode(code)}
                          >
                            <BookPlus className="h-3 w-3 mr-1" />
                            Add code to dictionary
                          </Button>
                        </span>
                      ))}
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={onReprocess}
                      >
                        <RefreshCcw className="h-3 w-3 mr-1" />
                        Reprocess pended remits
                      </Button>
                    </div>
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
