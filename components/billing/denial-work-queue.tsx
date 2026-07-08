"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldAlert } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { classifyRemitCodes, type ClassifiedRemitCode } from "@/lib/remittance-review"
import { localTodayISO } from "@/lib/date-rebase"
import type { ClaimRecord, ClaimWorkStatus, RemarkClassification } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ============================================================================
// SHARED META (classification badges + aging buckets)
// ============================================================================

/** Badge styling per remark-code classification (shared with the ledger/admin) */
export function classificationMeta(classification?: RemarkClassification): {
  label: string
  colorClasses: string
} {
  switch (classification) {
    case "informational":
      return {
        label: "informational",
        colorClasses:
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800",
      }
    case "adjustment":
      return {
        label: "adjustment",
        colorClasses:
          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-900",
      }
    case "denial":
      return {
        label: "denial",
        colorClasses:
          "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-900",
      }
    default:
      return {
        label: "unclassified",
        colorClasses:
          "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-900",
      }
  }
}

export type AgingBucket = "0-7" | "8-30" | "31+"

/** Aging bucket for a denial that has sat N days since its remit date */
export function denialAgingBucket(days: number): AgingBucket {
  if (days <= 7) return "0-7"
  if (days <= 30) return "8-30"
  return "31+"
}

/** Whole days since an ISO date/timestamp (never negative) */
export function daysSinceISO(iso: string, todayIso: string = localTodayISO()): number {
  const from = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime()
  const to = new Date(`${todayIso}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((to - from) / 86400000))
}

/** The date a denial starts aging from: remit date, else the DENIED event */
function denialAgingStart(record: ClaimRecord): string {
  if (record.remittance?.remitDate) return record.remittance.remitDate
  const deniedEvent = [...record.statusHistory].reverse().find((e) => e.status === "DENIED")
  return deniedEvent?.at ?? record.exportedAt
}

const WORK_STATUS_META: Record<ClaimWorkStatus, { label: string; colorClasses: string }> = {
  new: { label: "New", colorClasses: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  in_review: { label: "In Review", colorClasses: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  corrected: { label: "Corrected", colorClasses: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  resubmitted: { label: "Resubmitted", colorClasses: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
}

const WORK_STATUSES: ClaimWorkStatus[] = ["new", "in_review", "corrected", "resubmitted"]

const AGING_BUCKET_META: Record<AgingBucket, { label: string; colorClasses: string }> = {
  "0-7": { label: "0–7 days", colorClasses: "bg-muted text-muted-foreground" },
  "8-30": { label: "8–30 days", colorClasses: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  "31+": { label: "31+ days", colorClasses: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
}

/** Remark-code chip with dictionary description + classification tooltip */
function RemitCodeChip({ classified, kind }: { classified: ClassifiedRemitCode; kind: "CARC" | "RARC" }) {
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

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Denial Work Queue — a persistent collections worklist for DENIED claims
 * (the queue AMD never gave Gellert: denials there are worked live during
 * remit posting). Pended remittances surface in a review strip on top.
 */
export function DenialWorkQueue() {
  const { claimRecords, remarkCodes, setClaimWorkStatus, reopenClaimRecord } = useDemoData()
  const { currentUser } = useRole()

  const userId = currentUser?.id ?? "biller1"

  const [carcFilter, setCarcFilter] = useState<string>("ALL")
  const [workStatusFilter, setWorkStatusFilter] = useState<ClaimWorkStatus | "ALL">("ALL")
  const [agingFilter, setAgingFilter] = useState<AgingBucket | "ALL">("ALL")

  const pendedRecords = useMemo(
    () => claimRecords.filter((r) => !r.voided && r.pendedRemittance),
    [claimRecords]
  )

  const deniedRecords = useMemo(() => {
    return claimRecords
      .filter((r) => !r.voided && r.status === "DENIED")
      .map((record) => {
        const agingDays = daysSinceISO(denialAgingStart(record))
        return { record, agingDays, bucket: denialAgingBucket(agingDays) }
      })
      .sort((a, b) => b.agingDays - a.agingDays)
  }, [claimRecords])

  const presentCarcCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const { record } of deniedRecords) {
      for (const code of record.remittance?.carcCodes ?? []) codes.add(code)
    }
    return [...codes].sort()
  }, [deniedRecords])

  const visibleRows = useMemo(() => {
    return deniedRecords
      .filter(
        ({ record }) =>
          carcFilter === "ALL" || (record.remittance?.carcCodes ?? []).includes(carcFilter)
      )
      .filter(({ record }) => workStatusFilter === "ALL" || (record.workStatus ?? "new") === workStatusFilter)
      .filter(({ bucket }) => agingFilter === "ALL" || bucket === agingFilter)
  }, [deniedRecords, carcFilter, workStatusFilter, agingFilter])

  const handleWorkStatus = (record: ClaimRecord, next: ClaimWorkStatus) => {
    setClaimWorkStatus(record.id, next, userId)
    toast.success(`${record.snapshot.patientName} marked ${WORK_STATUS_META[next].label}`)
  }

  const handleReopen = (record: ClaimRecord) => {
    reopenClaimRecord(record.id, userId)
    toast.success("Claim reopened for rebill", {
      description: `${record.snapshot.patientName} (${record.snapshot.month}) returned to the working tabs`,
    })
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Pended-review strip */}
        {pendedRecords.length > 0 && (
          <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {pendedRecords.length} remittance{pendedRecords.length === 1 ? "" : "s"} pended for
                review
              </CardTitle>
              <CardDescription>
                Held on unknown remark codes instead of misposting — classify the codes in the
                Ledger&apos;s Needs Review queue, then reprocess.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {pendedRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-card px-3 py-2 dark:border-amber-900"
                >
                  <span className="text-sm">
                    <span className="font-medium">{record.snapshot.patientName}</span>
                    <span className="text-muted-foreground">
                      {" "}— {record.snapshot.month} · would post{" "}
                      {record.pendedRemittance!.resolvedStatus} at $
                      {record.pendedRemittance!.remittance.paidAmount.toFixed(2)}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {record.pendedRemittance!.unknownCodes.map((code) => (
                      <Badge
                        key={code}
                        variant="outline"
                        className="text-xs bg-amber-100 text-amber-700 border-amber-300"
                      >
                        {code}
                      </Badge>
                    ))}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Denial worklist */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  Denial Work Queue
                </CardTitle>
                <CardDescription>
                  A persistent collections worklist — work denials on your schedule instead of live
                  during remit posting
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={carcFilter} onValueChange={setCarcFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="CARC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All CARCs</SelectItem>
                    {presentCarcCodes.map((code) => (
                      <SelectItem key={code} value={code}>
                        CARC {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={workStatusFilter}
                  onValueChange={(v) => setWorkStatusFilter(v as ClaimWorkStatus | "ALL")}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Work status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All work statuses</SelectItem>
                    {WORK_STATUSES.map((ws) => (
                      <SelectItem key={ws} value={ws}>
                        {WORK_STATUS_META[ws].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={agingFilter}
                  onValueChange={(v) => setAgingFilter(v as AgingBucket | "ALL")}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Aging" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All ages</SelectItem>
                    {(Object.keys(AGING_BUCKET_META) as AgingBucket[]).map((bucket) => (
                      <SelectItem key={bucket} value={bucket}>
                        {AGING_BUCKET_META[bucket].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visibleRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                <p>
                  {deniedRecords.length === 0
                    ? "No denied claims — the queue is clear."
                    : "No denials match the current filters."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                    <TableHead>Denial Codes</TableHead>
                    <TableHead>Aging</TableHead>
                    <TableHead>Work Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map(({ record, agingDays, bucket }) => {
                    const carcs = classifyRemitCodes(record.remittance?.carcCodes ?? [], remarkCodes)
                    const rarcs = classifyRemitCodes(record.remittance?.rarcCodes ?? [], remarkCodes)
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.snapshot.patientName}
                        </TableCell>
                        <TableCell className="text-sm">{record.snapshot.month}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${record.billedAmount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {carcs.length === 0 && rarcs.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {carcs.map((c) => (
                                <RemitCodeChip key={`carc-${c.code}`} classified={c} kind="CARC" />
                              ))}
                              {rarcs.map((c) => (
                                <RemitCodeChip key={`rarc-${c.code}`} classified={c} kind="RARC" />
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn("font-medium", AGING_BUCKET_META[bucket].colorClasses)}
                            >
                              {AGING_BUCKET_META[bucket].label}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {agingDays}d
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={record.workStatus ?? "new"}
                            onValueChange={(v) => handleWorkStatus(record, v as ClaimWorkStatus)}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WORK_STATUSES.map((ws) => (
                                <SelectItem key={ws} value={ws}>
                                  {WORK_STATUS_META[ws].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReopen(record)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Reopen for rebill
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
