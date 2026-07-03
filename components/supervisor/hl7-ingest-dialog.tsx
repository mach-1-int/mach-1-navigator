"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, FileText, Inbox, User } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { parseHL7v2, type ParsedReferralResult } from "@/lib/referral-ingestion"
import { cn } from "@/lib/utils"

const ACUITY_BADGE_CLASSES: Record<"L1" | "L2" | "L3", string> = {
  L1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  L2: "bg-amber-100 text-amber-700 border-amber-200",
  L3: "bg-red-100 text-red-700 border-red-200",
}

interface HL7IngestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HL7IngestDialog({ open, onOpenChange }: HL7IngestDialogProps) {
  const { ingestReferral } = useDemoData()
  const [rawMessage, setRawMessage] = useState("")
  const [parsed, setParsed] = useState<ParsedReferralResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const resetState = () => {
    setRawMessage("")
    setParsed(null)
    setParseError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  const handleParse = () => {
    setParsed(null)
    setParseError(null)
    try {
      setParsed(parseHL7v2(rawMessage))
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Failed to parse HL7 message")
    }
  }

  const handleIngest = () => {
    if (!parsed) return
    ingestReferral(parsed.referral)
    toast.success(`Referral ingested for ${parsed.referral.patientName}`)
    handleOpenChange(false)
  }

  const referral = parsed?.referral

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Paste HL7 Referral
          </DialogTitle>
          <DialogDescription>
            Paste a raw HL7v2 message (ADT^A04 or REF^I12) to parse and ingest as a pending referral.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={rawMessage}
            onChange={(e) => {
              setRawMessage(e.target.value)
              setParsed(null)
              setParseError(null)
            }}
            placeholder={"MSH|^~\\&|AMDEHR|Banner Estrella Medical Center|...\nPID|1||MC556677889^^^MC-AZ||Garcia^Maria||19570614|F|||..."}
            className="font-mono text-xs min-h-40 max-h-64"
            spellCheck={false}
          />

          {parseError && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {parseError}
            </p>
          )}

          {parsed && referral && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-card-foreground">{referral.patientName}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", ACUITY_BADGE_CLASSES[referral.requiredAcuity])}
                  >
                    {referral.requiredAcuity === "L3" && <AlertTriangle className="h-3 w-3 mr-1" />}
                    Acuity {referral.requiredAcuity}
                  </Badge>
                </div>

                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">DOB:</span> {referral.dob || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gender:</span> {referral.rawData.PID.gender}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Diagnosis:</span> {referral.diagnosis}
                    {referral.rawData.DG1.icdCodes.length > 0 && (
                      <span className="text-muted-foreground"> ({referral.rawData.DG1.icdCodes.join(", ")})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payer:</span> {referral.healthPlan || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Member ID:</span>{" "}
                    {referral.rawData.IN1.memberId || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">ZIP:</span> {referral.zipCode || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Language:</span>{" "}
                    {referral.language === "es" ? "Spanish (es)" : "English (en)"}
                  </div>
                </div>

                {parsed.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3 space-y-1">
                    {parsed.warnings.map((warning) => (
                      <p
                        key={warning}
                        className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleParse} disabled={!rawMessage.trim()}>
            Parse
          </Button>
          <Button onClick={handleIngest} disabled={!parsed} className="gap-2">
            <Inbox className="h-4 w-4" />
            Ingest Referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
