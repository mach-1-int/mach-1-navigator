"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Camera, CheckCircle2, Save, Trash2 } from "lucide-react"
import { DOCUMENT_DEFINITIONS } from "@/lib/document-definitions"
import type { PatientDocument } from "@/lib/types"

/**
 * Patient identification photo — file input → data URL (camera-capable via
 * capture="environment" on supporting mobile browsers, no native camera API).
 */
export function PhotoCapture({
  doc,
  onSaveDraft,
  onComplete,
}: {
  doc: PatientDocument
  onSaveDraft: (fields: Record<string, unknown>, photoDataUrl?: string) => void
  onComplete: (fields: Record<string, unknown>, photoDataUrl?: string) => void
}) {
  const def = DOCUMENT_DEFINITIONS.patient_photo
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [consent, setConsent] = useState(doc.fields?.["consent-to-photo"] === true)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(doc.photoDataUrl)

  const isDone = doc.status === "completed" || doc.status === "signed"
  const canComplete = consent && !!photoDataUrl

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : undefined)
    reader.readAsDataURL(file)
  }

  const buildFields = (): Record<string, unknown> => ({ "consent-to-photo": consent })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="photo-consent"
          checked={consent}
          disabled={isDone}
          onCheckedChange={(checked) => setConsent(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="photo-consent" className="text-sm font-normal cursor-pointer">
          {def.fields[0].label}
          <span className="text-destructive"> *</span>
        </Label>
      </div>

      <div className="space-y-2">
        {photoDataUrl ? (
          <div className="relative w-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoDataUrl} alt="Patient photo on file" className="w-40 h-40 rounded-lg object-cover border border-border" />
            {!isDone && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow"
                onClick={() => setPhotoDataUrl(undefined)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <div className="w-40 h-40 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
            <Camera className="h-8 w-8" />
          </div>
        )}
        {!isDone && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Camera className="h-4 w-4" />
              {photoDataUrl ? "Retake Photo" : "Take / Upload Photo"}
            </Button>
          </>
        )}
      </div>

      {!isDone && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onSaveDraft(buildFields(), photoDataUrl)} className="gap-1.5">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button size="sm" onClick={() => onComplete(buildFields(), photoDataUrl)} disabled={!canComplete} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Complete
          </Button>
        </div>
      )}
    </div>
  )
}
