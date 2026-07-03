"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, FileCheck2, FileUp } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { statusChipMeta } from "@/lib/claim-lifecycle"
import { parse835, X12ParseError, type Remittance835 } from "@/lib/edi/edi-835-parser"
import { matchRemittance, type RemittanceMatchResult } from "@/lib/edi/remittance-matcher"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface RemittanceImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-loaded 835 text (from "Generate Sample 835" -> "Import now") */
  preloadedText?: string | null
}

interface ParsedState {
  remit: Remittance835
  match: RemittanceMatchResult
}

/**
 * 835 ERA import dialog: load a file (or preloaded sample text), parse it,
 * preview matched/unmatched payments, then post remittances to the ledger.
 */
export function RemittanceImportDialog({
  open,
  onOpenChange,
  preloadedText,
}: RemittanceImportDialogProps) {
  const { claimRecords, applyRemittance } = useDemoData()
  const { currentUser } = useRole()

  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [parsed, setParsed] = useState<ParsedState | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset (and pick up any preloaded sample) each time the dialog opens.
  // State-during-render adjustment per react.dev "you might not need an effect".
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setText(preloadedText ?? "")
      setFileName(preloadedText ? "sample-remit.835" : "")
      setParsed(null)
      setError(null)
    }
  }

  const recordById = useMemo(() => {
    return new Map(claimRecords.map((r) => [r.id, r]))
  }, [claimRecords])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    setFileName(file.name)
    setParsed(null)
    setError(null)
  }, [])

  const handleParse = useCallback(() => {
    setError(null)
    setParsed(null)
    try {
      const remit = parse835(text)
      const match = matchRemittance(remit, claimRecords, fileName || undefined)
      setParsed({ remit, match })
    } catch (err) {
      if (err instanceof X12ParseError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : "Failed to parse 835 file")
      }
    }
  }, [text, fileName, claimRecords])

  const handleConfirm = useCallback(() => {
    if (!parsed) return
    const result = applyRemittance(
      {
        matches: parsed.match.matches.map((m) => ({
          claimRecordId: m.claimRecordId,
          resolvedStatus: m.resolvedStatus,
          remittance: m.remittance,
        })),
        unmatchedCount: parsed.match.unmatchedCount,
      },
      currentUser?.id ?? "biller1"
    )
    toast.success(
      `${result.applied} payment${result.applied !== 1 ? "s" : ""} applied, ${result.unmatched} unmatched`
    )
    onOpenChange(false)
  }, [parsed, applyRemittance, currentUser, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import 835 Remittance
          </DialogTitle>
          <DialogDescription>
            Load an electronic remittance advice (ERA) file to post payments and denials to the
            claims ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source: file input or pasted/preloaded text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">835 File</label>
            <Input type="file" accept=".835,.txt,.edi" onChange={handleFileChange} />
            {preloadedText && text === preloadedText && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <FileCheck2 className="h-3 w-3" />
                Generated sample 835 loaded — parse to preview
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              File content {fileName ? `(${fileName})` : ""}
            </label>
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setParsed(null)
                setError(null)
              }}
              placeholder="...or paste raw X12 835 content here"
              className="font-mono text-xs h-28"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleParse} disabled={text.trim() === ""}>
              Parse
            </Button>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Preview */}
          {parsed && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  {parsed.match.matches.length} matched
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    parsed.match.unmatchedCount > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {parsed.match.unmatchedCount} unmatched
                </Badge>
                {parsed.remit.payerName && (
                  <span className="text-muted-foreground">
                    from {parsed.remit.payerName} • total payment $
                    {parsed.remit.paymentAmount.toFixed(2)}
                  </span>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>CARC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.match.matches.map((m) => {
                    const record = recordById.get(m.claimRecordId)
                    const meta = statusChipMeta(m.resolvedStatus)
                    return (
                      <TableRow key={m.claimRecordId}>
                        <TableCell className="font-medium">
                          {record?.snapshot.patientName ?? m.claimRecordId}
                        </TableCell>
                        <TableCell className="text-right">
                          {record ? `$${record.billedAmount.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          ${m.remittance.paidAmount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("font-medium", meta.colorClasses)}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {m.remittance.carcCodes.length > 0
                            ? m.remittance.carcCodes.join(", ")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {parsed.match.unmatched.map((claim, idx) => (
                    <TableRow key={`unmatched-${idx}`} className="bg-amber-50/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          {claim.patientName ?? claim.patientControlNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        ${claim.chargedAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">${claim.paidAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200"
                        >
                          No matching claim
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {claim.adjustments.length > 0
                          ? claim.adjustments.map((a) => a.reasonCode).join(", ")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!parsed || parsed.match.matches.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Apply {parsed ? parsed.match.matches.length : 0} Payment
            {parsed && parsed.match.matches.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
