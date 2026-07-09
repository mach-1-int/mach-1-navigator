"use client"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PenLine } from "lucide-react"
import type { PatientDocument } from "@/lib/types"

type Relationship = NonNullable<PatientDocument["signature"]>["relationship"]

const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: "patient", label: "Patient" },
  { value: "guardian", label: "Guardian" },
  { value: "representative", label: "Authorized representative" },
]

/**
 * Typed-name demo e-signature: attestation shown verbatim, relationship
 * select, typed name standing in for a signature, timestamp on sign.
 * Honest demo tier — labeled accordingly.
 */
export function SignaturePanel({
  attestationText,
  signedByName,
  onSignedByNameChange,
  relationship,
  onRelationshipChange,
  disabled,
}: {
  attestationText: string
  signedByName: string
  onSignedByNameChange: (value: string) => void
  relationship: Relationship
  onRelationshipChange: (value: Relationship) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <PenLine className="h-4 w-4" />
          Signature
        </p>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
          demo e-signature — DocuSign-class integration slots in later
        </Badge>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{attestationText}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="signature-typed-name" className="text-sm">
            Typed name (signature)
          </Label>
          <Input
            id="signature-typed-name"
            value={signedByName}
            disabled={disabled}
            onChange={(e) => onSignedByNameChange(e.target.value)}
            placeholder="Type full legal name"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Signing as</Label>
          <RadioGroup
            value={relationship}
            onValueChange={(v) => onRelationshipChange(v as Relationship)}
            className="flex flex-col gap-1.5 pt-1"
          >
            {RELATIONSHIPS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem value={r.value} id={`signature-rel-${r.value}`} disabled={disabled} />
                <Label htmlFor={`signature-rel-${r.value}`} className="text-sm font-normal cursor-pointer">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  )
}
