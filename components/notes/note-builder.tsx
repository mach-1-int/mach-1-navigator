"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import {
  FileText,
  Check,
  X,
  ChevronRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Edit3,
  RotateCcw,
  Target,
  Link2,
  Database,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { localTodayISO } from "@/lib/date-rebase"
import { generateNarrative, validateResponses } from "@/lib/narrative-generator"
import { isGellertTemplate, PROVIDER_FIELD_TYPE_FILTER } from "@/lib/gellert-templates"
import { checkNoteCompliance, hasBlockingFindings } from "@/lib/note-compliance"
import { buildAutoFillContext, resolveTemplateAutoFill, type AutoFillSource } from "@/lib/note-autofill"
import { findSameDayPrimaryNote } from "@/lib/same-day-notes"
import { EncounterTimer, type EncounterTimeData } from "./encounter-timer"
import { AiRecorder, type AutoFillResult } from "./ai-recorder"
import { CompliancePanel } from "./compliance-panel"
import type { TemplateFieldContext } from "@/lib/gemini-scribe"
import type { TemplateField, UserRole, ZCode, TimeLog } from "@/lib/types"

interface NoteBuilderProps {
  patientId: string
  patientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onNoteCreated?: () => void
  defaultTemplateId?: string
  appointmentId?: string
}

interface FieldRendererProps {
  field: TemplateField
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  dynamicOptions?: { value: string; label: string }[]
}

const AUTO_FILL_SOURCE_LABELS: Record<AutoFillSource, string> = {
  "provider-directory": "Provider directory",
  "standing-facts": "Standing patient facts",
  "previous-note": "From last visit",
  appointment: "From appointment",
}

// Billing modality type (derived from contact-method field)
type Modality = "In-Person" | "Phone" | "Video"

function FieldRenderer({ field, value, onChange, error, dynamicOptions }: FieldRendererProps) {
  switch (field.type) {
    case "select": {
      const selectOptions = field.options ?? dynamicOptions?.map((o) => o.label) ?? []
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <Select value={value as string || ""} onValueChange={onChange}>
            <SelectTrigger id={field.id} className={cn(error && "border-destructive ring-destructive")}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )
    }

    case "time":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={field.id}
              value={(value as string) || ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={(e) => {
                const normalized = e.target.value.trim().replace(/\s+/g, "").toUpperCase()
                if (normalized !== e.target.value) onChange(normalized)
              }}
              placeholder={field.placeholder || "3:03PM"}
              className={cn("w-32", error && "border-destructive ring-destructive")}
            />
            <span className="text-xs text-muted-foreground">H:MMAM/PM — colon required</span>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "provider":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <Select value={value as string || ""} onValueChange={onChange}>
            <SelectTrigger id={field.id} className={cn(error && "border-destructive ring-destructive")}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {(dynamicOptions ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(dynamicOptions ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No providers in the directory yet</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "attestation":
      return (
        <div className={cn(
          "flex items-start gap-3 p-3 border rounded-lg",
          value === true ? "border-emerald-300 bg-emerald-50/50" : "bg-muted/30",
          error && "border-destructive"
        )}>
          <Checkbox
            id={field.id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor={field.id} className="flex items-center gap-1 cursor-pointer">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <p className="text-xs text-muted-foreground italic">
              &ldquo;{field.attestationText}&rdquo;
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      )

    case "multi-select":
      const selectedValues = (value as string[]) || []
      return (
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <div className={cn(
            "flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30 min-h-[80px]",
            error && "border-destructive"
          )}>
            {field.options?.map((option) => {
              const isSelected = selectedValues.includes(option)
              return (
                <Badge
                  key={option}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    isSelected && "bg-primary",
                    !isSelected && "hover:bg-primary/10"
                  )}
                  onClick={() => {
                    if (isSelected) {
                      onChange(selectedValues.filter((v) => v !== option))
                    } else {
                      onChange([...selectedValues, option])
                    }
                  }}
                >
                  {option}
                  {isSelected && <Check className="ml-1 h-3 w-3" />}
                </Badge>
              )
            })}
          </div>
          {selectedValues.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedValues.length} selected
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "text":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={field.id}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={cn(error && "border-destructive ring-destructive")}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "textarea":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id={field.id}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={cn("min-h-[100px]", error && "border-destructive ring-destructive")}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "boolean":
      return (
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <Label htmlFor={field.id} className="flex items-center gap-1 cursor-pointer">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <Switch
            id={field.id}
            checked={(value as boolean) || false}
            onCheckedChange={onChange}
          />
        </div>
      )

    case "time-duration":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={field.id}
              type="number"
              min="0"
              max="480"
              value={(value as number) || ""}
              onChange={(e) => onChange(parseInt(e.target.value) || 0)}
              placeholder="0"
              className={cn("w-24", error && "border-destructive ring-destructive")}
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    default:
      return null
  }
}

export function NoteBuilder({
  patientId,
  patientName,
  open,
  onOpenChange,
  onNoteCreated,
  defaultTemplateId,
  appointmentId,
}: NoteBuilderProps) {
  const {
    noteTemplates,
    addNoteFromTemplate,
    getPatientIntake,
    getPatient,
    getPatientCarePlan,
    addTimeLog,
    getNoteDraft,
    deleteNoteDraft,
    notes,
    providers,
    navigators,
    appointments,
    getStandingFacts,
  } = useDemoData()
  const { currentUser } = useRole()
  const { toast } = useToast()

  // Get patient data
  const patient = getPatient(patientId)
  const patientIntake = getPatientIntake(patientId)
  const carePlan = getPatientCarePlan(patientId)

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Chart auto-fill provenance (sky styling, parallel to violet AI provenance)
  const [autoFilledFields, setAutoFilledFields] = useState<Map<string, AutoFillSource>>(new Map())
  const [wasPreSelected, setWasPreSelected] = useState(false)

  // Encounter timer state
  const [encounterTime, setEncounterTime] = useState<EncounterTimeData>({
    startTime: null,
    endTime: null,
    durationMinutes: 0,
    isRunning: false,
  })

  // CMS Billing fields (modality derived from contact-method template field)
  const [barrierAddressed, setBarrierAddressed] = useState<string>("")
  const [goalAlignment, setGoalAlignment] = useState<string>("")

  const selectedTemplate = useMemo(() => {
    return noteTemplates.find((t) => t.id === selectedTemplateId)
  }, [noteTemplates, selectedTemplateId])

  const isGellert = isGellertTemplate(selectedTemplate)
  const isBillableTemplate = selectedTemplate?.billable !== false

  // Derive modality from contact-method field for billing; Gellert templates
  // carry no contact-method field — their encounter type implies the modality
  const modality = useMemo((): Modality | "" => {
    const contactMethod = responses["contact-method"] as string | undefined
    if (!contactMethod) {
      const encounterType = selectedTemplate?.encounterTypes?.[0]
      if (encounterType) return encounterType === "phone_call" ? "Phone" : "In-Person"
      return ""
    }
    // Map template contact method options to billing modality
    if (contactMethod.toLowerCase().includes("face") || contactMethod.toLowerCase().includes("person")) {
      return "In-Person"
    }
    if (contactMethod.toLowerCase().includes("tele") || contactMethod.toLowerCase().includes("video")) {
      return "Video"
    }
    if (contactMethod.toLowerCase().includes("phone")) {
      return "Phone"
    }
    return ""
  }, [responses, selectedTemplate])

  // Manual override state
  const [isManualOverride, setIsManualOverride] = useState(false)
  const [manualNarrative, setManualNarrative] = useState("")

  // AI auto-fill state
  const [aiAutoFillCount, setAiAutoFillCount] = useState<number | null>(null)
  const [aiIsMock, setAiIsMock] = useState(false)
  const [aiHasAutoFilled, setAiHasAutoFilled] = useState(false)
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set())
  const [unconfirmedLowConfidence, setUnconfirmedLowConfidence] = useState<Set<string>>(new Set())

  // Supervision notes are a supervisor/admin instrument — hide the template otherwise
  const visibleTemplates = useMemo(() => {
    return noteTemplates.filter(
      (t) => t.noteType !== "supervision" || currentUser?.role === "supervisor" || currentUser?.role === "admin"
    )
  }, [noteTemplates, currentUser])

  // Resolve dynamic optionsSource fields (provider directory / navigator roster)
  // here so FieldRenderer stays dumb
  const dynamicFieldOptions = useMemo(() => {
    if (!selectedTemplate) return {} as Record<string, { value: string; label: string }[]>
    const map: Record<string, { value: string; label: string }[]> = {}
    const linkedIds = new Set(patient?.providerIds ?? [])
    for (const field of selectedTemplate.fields) {
      if (field.optionsSource === "providers") {
        const typeFilter = PROVIDER_FIELD_TYPE_FILTER[field.id]
        const pool = providers.filter((p) => !typeFilter || p.type === typeFilter)
        const sorted = [...pool].sort((a, b) => Number(linkedIds.has(b.id)) - Number(linkedIds.has(a.id)))
        map[field.id] = sorted.map((p) => ({ value: p.id, label: `${p.name} — ${p.practiceName}` }))
      } else if (field.optionsSource === "navigators") {
        map[field.id] = navigators.map((n) => ({ value: n.name, label: n.name }))
      }
    }
    return map
  }, [selectedTemplate, providers, navigators, patient])

  // Same-day multi-note model: is there already a billable primary note today?
  const sameDayPrimary = useMemo(() => {
    return findSameDayPrimaryNote(notes, patientId, localTodayISO())
  }, [notes, patientId])

  // Convert template fields to context for AI scribe
  const templateFieldsContext: TemplateFieldContext[] = useMemo(() => {
    if (!selectedTemplate) return []
    return selectedTemplate.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      options: field.options ?? dynamicFieldOptions[field.id]?.map((o) => o.label),
      required: field.required,
    }))
  }, [selectedTemplate, dynamicFieldOptions])

  // Get patient's active Z-codes from intake
  const activeBarriers: ZCode[] = useMemo(() => {
    return patientIntake?.identifiedBarriers || []
  }, [patientIntake])

  // Get care plan goals for alignment
  const carePlanGoals = useMemo(() => {
    return carePlan?.activeGoals.map((g) => ({
      id: g.id,
      description: g.description,
    })) || []
  }, [carePlan])

  // Generate narrative preview using the standalone utility
  const autoGeneratedNarrative = useMemo(() => {
    if (!selectedTemplate) return ""

    const templateNarrative = generateNarrative(selectedTemplate, responses, { providers })

    // Gellert notes are the manual's exact format — no billing preamble
    // (the preview must match what addNoteFromTemplate saves)
    if (isGellertTemplate(selectedTemplate)) return templateNarrative

    // Include billing fields in the narrative
    const billingPrefix = modality ? `Patient seen via ${modality}. ` : ""
    const barrierText = barrierAddressed ? `Addressed barrier: ${barrierAddressed}. ` : ""
    const goalText = goalAlignment ? `Aligned with care plan goal: ${goalAlignment}. ` : ""

    return `${billingPrefix}${barrierText}${goalText}${templateNarrative}`
  }, [selectedTemplate, responses, providers, modality, barrierAddressed, goalAlignment])

  // The narrative to display (either auto-generated or manual)
  const displayNarrative = isManualOverride ? manualNarrative : autoGeneratedNarrative

  // The manual, enforcing itself: run every applicable rule against the draft
  const complianceFindings = useMemo(() => {
    if (!selectedTemplate) return []
    return checkNoteCompliance({
      narrative: displayNarrative,
      template: selectedTemplate,
      responses,
      durationMinutes: encounterTime.durationMinutes,
      isBillable: isBillableTemplate,
      sameDayPrimaryExists: !!sameDayPrimary,
    })
  }, [selectedTemplate, displayNarrative, responses, encounterTime.durationMinutes, isBillableTemplate, sameDayPrimary])

  const complianceBlocked = hasBlockingFindings(complianceFindings)

  // Validation state
  const canSave = useMemo(() => {
    // Check mandatory billing requirements (relaxed for non-billable templates)
    if (isBillableTemplate) {
      if (!modality) return false
      if (encounterTime.durationMinutes < 1 && !encounterTime.isRunning) return false
    }
    if (!displayNarrative) return false
    if (complianceBlocked) return false
    return true
  }, [isBillableTemplate, modality, encounterTime.durationMinutes, encounterTime.isRunning, displayNarrative, complianceBlocked])

  // Select a template and apply chart auto-fill (the cut-and-paste killer):
  // provider directory, standing patient facts, the linked appointment, and
  // previous-note recall, each with provenance for the sky badges
  const applyTemplateSelection = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setResponses({})
    setErrors({})
    setAutoFilledFields(new Map())
    const template = noteTemplates.find((t) => t.id === templateId)
    if (!template) return
    const ctx = buildAutoFillContext({
      patient,
      providers,
      standingFacts: getStandingFacts(patientId),
      previousNotes: notes.filter((n) => n.patientId === patientId),
      appointment: appointments.find((a) => a.id === appointmentId),
    })
    const resolved = resolveTemplateAutoFill(template, ctx)
    const nextResponses: Record<string, unknown> = {}
    const provenance = new Map<string, AutoFillSource>()
    for (const [fieldId, resolution] of Object.entries(resolved)) {
      if (resolution.value === undefined || resolution.value === null || resolution.value === "") continue
      nextResponses[fieldId] = resolution.value
      provenance.set(fieldId, resolution.source)
    }
    if (provenance.size > 0) {
      setResponses(nextResponses)
      setAutoFilledFields(provenance)
    }
  }

  // Reset state when dialog opens (render-time "previous value" pattern, no effect needed)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelectedTemplateId("")
      setResponses({})
      setErrors({})
      setAutoFilledFields(new Map())
      setWasPreSelected(false)
      setEncounterTime({
        startTime: null,
        endTime: null,
        durationMinutes: 0,
        isRunning: false,
      })
      setBarrierAddressed("")
      setGoalAlignment("")
      setIsManualOverride(false)
      setManualNarrative("")
      setAiAutoFillCount(null)
      setAiIsMock(false)
      setAiHasAutoFilled(false)
      setAiFilledFields(new Set())
      setUnconfirmedLowConfidence(new Set())
      // Launched from an appointment: pre-select the matching Gellert template
      if (defaultTemplateId && noteTemplates.some((t) => t.id === defaultTemplateId)) {
        applyTemplateSelection(defaultTemplateId)
        setWasPreSelected(true)
      }
    }
  }

  const handleTimeChange = useCallback((data: EncounterTimeData) => {
    setEncounterTime(data)

    // Auto-fill duration field if it exists in the template
    if (selectedTemplate && data.durationMinutes > 0 && !data.isRunning) {
      const durationField = selectedTemplate.fields.find((f) => f.type === "time-duration")
      if (durationField) {
        setResponses((prev) => ({ ...prev, [durationField.id]: data.durationMinutes }))
      }
    }
  }, [selectedTemplate])

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
    // A manual edit takes ownership of the field: clear AI + auto-fill provenance
    setAutoFilledFields((prev) => {
      if (!prev.has(fieldId)) return prev
      const next = new Map(prev)
      next.delete(fieldId)
      return next
    })
    setAiFilledFields((prev) => {
      if (!prev.has(fieldId)) return prev
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
    setUnconfirmedLowConfidence((prev) => {
      if (!prev.has(fieldId)) return prev
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
  }

  // Confirm an AI-suggested low-confidence value as correct
  const handleConfirmField = (fieldId: string) => {
    setUnconfirmedLowConfidence((prev) => {
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
  }

  // Handler for AI scribe auto-fill
  const handleAiAutoFill = useCallback((result: AutoFillResult) => {
    const { fieldsMatched, isMock, fieldConfidence } = result
    const data = { ...result.data }

    // Provider fields store ids — map AI-returned labels/names back to the directory
    for (const field of selectedTemplate?.fields ?? []) {
      if (field.type !== "provider") continue
      const value = data[field.id]
      if (typeof value !== "string" || value === "" || providers.some((p) => p.id === value)) continue
      const byLabel = dynamicFieldOptions[field.id]?.find((o) => o.label === value)
      const byName = providers.find((p) => value.toLowerCase().includes(p.name.toLowerCase()))
      if (byLabel) data[field.id] = byLabel.value
      else if (byName) data[field.id] = byName.id
    }

    // Update responses with AI-extracted data
    setResponses((prev) => ({ ...prev, ...data }))

    // Clear any errors for auto-filled fields
    setErrors((prev) => {
      const newErrors = { ...prev }
      Object.keys(data).forEach((key) => {
        delete newErrors[key]
      })
      return newErrors
    })

    // Track AI provenance for needs-review styling and confirm flow
    setAiFilledFields(new Set(Object.keys(data)))
    setUnconfirmedLowConfidence(
      new Set(
        Object.entries(fieldConfidence ?? {})
          .filter(([, confidence]) => confidence === "low")
          .map(([fieldId]) => fieldId)
      )
    )

    setAiAutoFillCount(fieldsMatched)
    setAiIsMock(isMock)
    setAiHasAutoFilled(true)

    toast({
      title: "AI Auto-filled Fields",
      description: `${fieldsMatched} field${fieldsMatched !== 1 ? "s" : ""} populated from transcript`,
    })

    // Clear the auto-fill indicator after animation
    setTimeout(() => {
      setAiAutoFillCount(null)
    }, 3000)
  }, [toast, selectedTemplate, providers, dynamicFieldOptions])

  // Handler for when AI detects duration in transcript (e.g., "20 minutes")
  const handleDurationDetected = useCallback((detectedMinutes: number) => {
    console.log("🕐 handleDurationDetected called:", { detectedMinutes, currentDuration: encounterTime.durationMinutes });

    // Only offer to set if timer hasn't been used or duration is different
    if (encounterTime.durationMinutes === 0 || encounterTime.durationMinutes !== detectedMinutes) {
      // Use sonner toast which supports action buttons better
      sonnerToast(`Duration detected: ${detectedMinutes} minutes`, {
        description: "Would you like to set this as your visit duration?",
        action: {
          label: "Set Duration",
          onClick: () => {
            // Calculate start/end times based on detected duration
            const now = new Date()
            const endTime = now.toISOString()
            const startTime = new Date(now.getTime() - detectedMinutes * 60 * 1000).toISOString()

            setEncounterTime({
              startTime,
              endTime,
              durationMinutes: detectedMinutes,
              isRunning: false,
            })

            sonnerToast.success(`Visit duration set to ${detectedMinutes} minutes`)
          },
        },
        duration: 10000, // Show for 10 seconds so user has time to click
      })
    }
  }, [encounterTime.durationMinutes])

  const handleToggleManualOverride = () => {
    if (!isManualOverride) {
      setManualNarrative(autoGeneratedNarrative)
    }
    setIsManualOverride(!isManualOverride)
  }

  const handleResetToAutoGenerated = () => {
    setManualNarrative(autoGeneratedNarrative)
  }

  const validateForm = (): boolean => {
    if (!selectedTemplate) return false

    const newErrors: Record<string, string> = {}

    // Validate template fields
    const templateErrors = validateResponses(selectedTemplate, responses)
    Object.assign(newErrors, templateErrors)

    // Validate billing fields (non-billable templates carry no billing requirements)
    if (isBillableTemplate) {
      if (!modality) {
        newErrors._modality = "Modality is required for billing"
      }

      if (encounterTime.durationMinutes < 1 && !encounterTime.isRunning) {
        newErrors._duration = "Duration must be at least 1 minute"
      }
    }

    // Block signing while low-confidence AI suggestions remain unconfirmed
    if (unconfirmedLowConfidence.size > 0) {
      newErrors._aiConfirm = "Confirm AI-suggested values before signing"
    }

    // The manual is the gate: blocking compliance findings stop the signature
    if (complianceBlocked) {
      newErrors._compliance = "Resolve manual-compliance failures before signing"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!selectedTemplate || !currentUser) return

    // Stop timer if still running
    if (encounterTime.isRunning) {
      toast({
        title: "Timer Running",
        description: "Please stop the timer before saving the note.",
        variant: "destructive",
      })
      return
    }

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      // Get duration
      const duration = encounterTime.durationMinutes

      // Prepare responses with billing metadata (never mutate the responses state object)
      const finalResponses: Record<string, unknown> = {
        ...responses,
        ...(isManualOverride ? { _manualNarrative: manualNarrative } : {}),
        _modality: modality,
        _barrierAddressed: barrierAddressed,
        _goalAlignment: goalAlignment,
      }

      // Calculate times for audit-proof logging
      const now = new Date()
      const endTime = encounterTime.endTime || now.toISOString()
      const startTime = encounterTime.startTime || new Date(now.getTime() - duration * 60 * 1000).toISOString()
      const timeSource = encounterTime.timeSource || "timer"

      // Same-day continuation: link to the primary note; totals stay there
      const isContinuation = selectedTemplate.id === "template-gellert-multidisciplinary" && !!sameDayPrimary

      // 1. Create the TimeLog entry for billing (do this first to get the ID).
      // Non-billable templates (supervision, multidisciplinary continuation)
      // NEVER create a TimeLog — that is the manual's double-billing guard.
      let timeLogId: string | undefined
      if (isBillableTemplate && duration > 0) {
        const today = localTodayISO()
        const timeLogData: Omit<TimeLog, "id"> = {
          patientId,
          date: today,
          startTime,
          endTime,
          durationMinutes: duration,
          modality: modality as TimeLog["modality"],
          serviceType: patient?.billingTrack || "CHI",
          navigatorId: currentUser.id,
          // A signed encounter note with audit-proof start/end times IS the
          // verification mechanism in this product: the timer provenance and
          // signature stand in for a separate supervisor sign-off step.
          // Unverified logs (imports, manual corrections) are held out of
          // billing by the claims engine until reviewed.
          verified: true,
          verifiedBy: currentUser.id,
          verifiedAt: new Date().toISOString(),
          billingPeriod: today.slice(0, 7), // YYYY-MM (local calendar)
        }
        const createdTimeLog = addTimeLog(timeLogData)
        timeLogId = createdTimeLog?.id
      }

      // 2. Create the Note with audit-proof time data + Gellert note metadata
      const subjectNavigatorId =
        selectedTemplate.noteType === "supervision"
          ? navigators.find((n) => n.name === responses["navigator-discussed"])?.id
          : undefined

      addNoteFromTemplate(
        patientId,
        selectedTemplate.id,
        finalResponses,
        currentUser.id,
        currentUser.name,
        currentUser.role as UserRole,
        isBillableTemplate ? duration : undefined,
        {
          startTime,
          endTime,
          timeLogId,
          timeSource,
        },
        {
          linkedNoteId: isContinuation ? sameDayPrimary?.id : undefined,
          carriesDayTotal: isGellert && isBillableTemplate && !sameDayPrimary ? true : undefined,
          billable: isBillableTemplate ? undefined : false,
          appointmentId,
          subjectNavigatorId,
        }
      )

      // 3. Clean up any cached draft (e.g. autosaved dictation) for this note
      const draft = getNoteDraft(patientId, selectedTemplate.id)
      if (draft) {
        deleteNoteDraft(draft.id)
      }

      toast({
        title: "Note Created",
        description: isBillableTemplate
          ? `${selectedTemplate.name} note and time log added successfully`
          : `${selectedTemplate.name} note added (non-billable — no time log created)`,
      })

      onOpenChange(false)
      onNoteCreated?.()
    } catch {
      toast({
        title: "Error",
        description: "Failed to create note",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[1400px] w-[95vw] !max-h-[90vh] h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {isGellert ? "Gellert Encounter Note" : "Golden Encounter Note"}
              </DialogTitle>
              <DialogDescription>
                {isGellert && selectedTemplate?.manualSection
                  ? `Gellert Note Manual — ${selectedTemplate.manualSection} — ${patientName}`
                  : `CMS G0023 Compliant Documentation for ${patientName}`}
              </DialogDescription>
            </div>
            {patient?.billingTrack && (
              <Badge
                variant="outline"
                className={patient.billingTrack === "PIN"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
                }
              >
                {patient.billingTrack === "PIN" ? "Principal Illness" : "Community Health"}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Sticky Encounter Timer (non-billable notes carry no encounter time) */}
          {selectedTemplateId && isBillableTemplate && (
            <div className="px-6 py-3 border-b bg-muted/30">
              <EncounterTimer
                onTimeChange={handleTimeChange}
                initialData={encounterTime}
              />
            </div>
          )}

          {/* Template Selector */}
          {!selectedTemplateId ? (
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Select a note template to get started:
                  </p>
                  <Select value="" onValueChange={applyTemplateSelection}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Quick select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {visibleTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary hover:shadow-md",
                        template.id === "template-standard-navigation" && "ring-2 ring-primary/50 border-primary"
                      )}
                      onClick={() => applyTemplateSelection(template.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {template.id === "template-standard-navigation" && (
                          <Badge variant="default" className="w-fit text-xs">
                            Recommended
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="line-clamp-2">{template.description}</CardDescription>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {template.noteType}
                          </Badge>
                          {isGellertTemplate(template) && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              Gellert Manual
                            </Badge>
                          )}
                          {template.billable === false && (
                            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                              Non-billable
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {template.fields.length} fields
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
          ) : (
            /* Split View: Left (Inputs) | Right (Preview) */
            <div className="flex flex-1 min-h-0">
              {/* Left Panel - Form Inputs */}
              <div className="flex-1 overflow-y-auto border-r">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedTemplate?.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {wasPreSelected
                          ? "Template pre-selected from the appointment type"
                          : "Fill in the required fields below"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplateId("")
                        setResponses({})
                        setErrors({})
                        setAutoFilledFields(new Map())
                        setWasPreSelected(false)
                        setBarrierAddressed("")
                        setGoalAlignment("")
                        setIsManualOverride(false)
                        setManualNarrative("")
                        setAiAutoFillCount(null)
                        setAiIsMock(false)
                        setAiHasAutoFilled(false)
                        setAiFilledFields(new Set())
                        setUnconfirmedLowConfidence(new Set())
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Change Template
                    </Button>
                  </div>

                  {/* Same-day multi-note model: warn before a second billable note */}
                  {sameDayPrimary && isGellert && isBillableTemplate && (
                    <Alert className="border-sky-300 bg-sky-50 text-sky-800">
                      <Link2 className="h-4 w-4 text-sky-600" />
                      <AlertTitle>Second note today</AlertTitle>
                      <AlertDescription className="text-sky-700">
                        A billable note already exists for {patientName} today ({sameDayPrimary.templateName || "note"}).
                        Later notes carry appointment content only — linked, non-billable, totals stay on the primary note.
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 border-sky-300 text-sky-700 hover:bg-sky-100 block"
                          onClick={() => applyTemplateSelection("template-gellert-multidisciplinary")}
                        >
                          Switch to Multidisciplinary Continuation
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Continuation confirmation: this note will link to the primary */}
                  {sameDayPrimary && selectedTemplate?.id === "template-gellert-multidisciplinary" && (
                    <Alert className="border-sky-300 bg-sky-50 text-sky-800">
                      <Link2 className="h-4 w-4 text-sky-600" />
                      <AlertTitle>Same-day continuation</AlertTitle>
                      <AlertDescription className="text-sky-700">
                        Will be linked to today&apos;s primary note ({sameDayPrimary.templateName || "note"}) as
                        non-billable appointment content. No time log will be created.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* AI Scribe Recorder */}
                  <AiRecorder
                    templateFields={templateFieldsContext}
                    patientId={patientId}
                    templateId={selectedTemplateId}
                    onAutoFill={handleAiAutoFill}
                    onDurationDetected={handleDurationDetected}
                    currentDuration={encounterTime.durationMinutes}
                    isTimerRunning={encounterTime.isRunning}
                    sampleFilter={(sample) =>
                      !sample.templateIds ||
                      sample.templateIds.includes(selectedTemplateId) ||
                      (!!sample.encounterType && !!selectedTemplate?.encounterTypes?.includes(sample.encounterType))
                    }
                    noteContext={{
                      templateName: selectedTemplate?.name,
                      encounterType: selectedTemplate?.encounterTypes?.[0],
                      patientName,
                    }}
                  />

                  {/* Demo Mode warning: values are canned, not AI output */}
                  {aiIsMock && (
                    <Alert className="border-amber-300 bg-amber-50 text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle>Demo Mode: AI unavailable (no API key)</AlertTitle>
                      <AlertDescription className="text-amber-700">
                        Values below are canned demo data, not AI output.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* AI Auto-fill Success Indicator */}
                  {aiAutoFillCount !== null && !aiIsMock && (
                    <div className="flex items-center gap-2 p-3 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300 bg-green-50 border border-green-200 text-green-700">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        AI Auto-filled {aiAutoFillCount} field{aiAutoFillCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  {/* Care Plan Linking (optional billing enhancements) */}
                  {(activeBarriers.length > 0 || carePlanGoals.length > 0) && (
                    <Card className={cn(
                      "transition-all duration-300",
                      (barrierAddressed || goalAlignment)
                        ? "border-emerald-500 bg-emerald-50/50"
                        : "border-muted bg-muted/30"
                    )}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className={cn(
                            "h-4 w-4 transition-colors",
                            (barrierAddressed || goalAlignment) ? "text-emerald-600" : "text-muted-foreground"
                          )} />
                          Care Plan Linking
                          {(barrierAddressed || goalAlignment) && (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Linked
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                          {/* Barrier Addressed (from intake Z-codes) */}
                          {activeBarriers.length > 0 && (
                            <div className="space-y-2">
                              <Label className={cn(
                                "flex items-center gap-1",
                                barrierAddressed && "text-emerald-700"
                              )}>
                                Barrier Addressed
                                {barrierAddressed && <Check className="h-3 w-3 text-emerald-600" />}
                              </Label>
                              <Select
                                value={barrierAddressed || "none"}
                                onValueChange={(val) => setBarrierAddressed(val === "none" ? "" : val)}
                              >
                                <SelectTrigger className={cn(
                                  barrierAddressed && "border-emerald-300 bg-white"
                                )}>
                                  <SelectValue placeholder="Select barrier addressed..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {activeBarriers.map((barrier) => (
                                    <SelectItem key={barrier.code} value={`${barrier.code}: ${barrier.description}`}>
                                      <span className="font-mono mr-2">{barrier.code}</span>
                                      {barrier.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Patient&apos;s identified barriers from intake
                              </p>
                            </div>
                          )}

                          {/* Goal Alignment */}
                          {carePlanGoals.length > 0 && (
                            <div className="space-y-2">
                              <Label className={cn(
                                "flex items-center gap-1",
                                goalAlignment && "text-emerald-700"
                              )}>
                                Goal Alignment
                                {goalAlignment && <Check className="h-3 w-3 text-emerald-600" />}
                              </Label>
                              <Select
                                value={goalAlignment || "none"}
                                onValueChange={(val) => setGoalAlignment(val === "none" ? "" : val)}
                              >
                                <SelectTrigger className={cn(
                                  goalAlignment && "border-emerald-300 bg-white"
                                )}>
                                  <SelectValue placeholder="Link to care plan goal..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {carePlanGoals.map((goal) => (
                                    <SelectItem key={goal.id} value={goal.description}>
                                      {goal.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Separator />

                  {/* Template Fields (showIf-gated, grouped by manual section) */}
                  <div className="space-y-5">
                    {(selectedTemplate?.fields ?? [])
                      .filter((field) => !field.showIf || responses[field.showIf.fieldId] === field.showIf.equals)
                      .map((field, index, visibleFields) => {
                      const isAiFilled = aiFilledFields.has(field.id)
                      const autoFillSource = autoFilledFields.get(field.id)
                      const needsConfirm = unconfirmedLowConfidence.has(field.id)
                      const sectionHeader =
                        field.section && field.section !== visibleFields[index - 1]?.section
                          ? field.section
                          : null
                      return (
                        <div key={field.id}>
                          {sectionHeader && (
                            <div className="flex items-center gap-2 mb-3 mt-1">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {sectionHeader}
                              </span>
                              <Separator className="flex-1" />
                            </div>
                          )}
                          <div
                            className={cn(
                              (isAiFilled || autoFillSource) && "border-l-2 pl-3",
                              isAiFilled && (needsConfirm ? "border-l-amber-400" : "border-l-violet-400"),
                              !isAiFilled && autoFillSource && "border-l-sky-400"
                            )}
                          >
                          {(isAiFilled || autoFillSource || field.neverSkip) && (
                            <div className="flex items-center gap-2 mb-1.5">
                              {isAiFilled && (
                                <Badge
                                  variant="outline"
                                  className="h-5 gap-1 text-xs bg-violet-50 text-violet-700 border-violet-300"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  AI
                                </Badge>
                              )}
                              {!isAiFilled && autoFillSource && (
                                <Badge
                                  variant="outline"
                                  className="h-5 gap-1 text-xs bg-sky-50 text-sky-700 border-sky-300"
                                >
                                  <Database className="h-3 w-3" />
                                  Auto-filled from chart — {AUTO_FILL_SOURCE_LABELS[autoFillSource]}
                                </Badge>
                              )}
                              {field.neverSkip && (
                                <Badge
                                  variant="outline"
                                  className="h-5 text-xs bg-rose-50 text-rose-700 border-rose-300"
                                >
                                  Never skip
                                </Badge>
                              )}
                              {isAiFilled && needsConfirm && (
                                <>
                                  <span className="text-xs text-amber-700">
                                    Low confidence - please verify
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                    onClick={() => handleConfirmField(field.id)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Confirm
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                          <FieldRenderer
                            field={field}
                            value={responses[field.id]}
                            onChange={(value) => handleFieldChange(field.id, value)}
                            error={errors[field.id]}
                            dynamicOptions={dynamicFieldOptions[field.id]}
                          />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right Panel - Narrative Preview & Billing Summary */}
              <div className="w-[400px] shrink-0 flex flex-col bg-muted/20 overflow-hidden">
                <div className="p-4 border-b bg-background shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Generated Narrative</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {isManualOverride && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetToAutoGenerated}
                          className="text-muted-foreground h-8"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      )}
                      <Button
                        variant={isManualOverride ? "default" : "outline"}
                        size="sm"
                        onClick={handleToggleManualOverride}
                        className="h-8"
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        {isManualOverride ? "Manual" : "Edit"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {/* Narrative Display/Editor */}
                    <Card className={cn(
                      "bg-background",
                      isManualOverride && "ring-2 ring-primary/30"
                    )}>
                      <CardContent className="p-4">
                        {isManualOverride ? (
                          <Textarea
                            value={manualNarrative}
                            onChange={(e) => setManualNarrative(e.target.value)}
                            className="min-h-[200px] bg-background resize-none border-0 focus-visible:ring-0 p-0"
                            placeholder="Enter your custom narrative..."
                          />
                        ) : (
                          displayNarrative ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap min-h-[120px]">
                              {displayNarrative}
                            </p>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[120px] text-center">
                              <AlertCircle className="h-5 w-5" />
                              <span className="text-sm italic">
                                Fill in the fields to generate the narrative...
                              </span>
                            </div>
                          )
                        )}
                      </CardContent>
                    </Card>

                    {isManualOverride && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Edit3 className="h-3 w-3" />
                        Manual override active
                      </p>
                    )}

                    {/* ICD-10 awareness: AI cannot supply a diagnosis, flag if missing */}
                    {aiHasAutoFilled && (!patient?.icdCodes || patient.icdCodes.length === 0) && (
                      <Alert className="border-amber-300 bg-amber-50 text-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle>No ICD-10 diagnosis on file</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          Required for billing. Add diagnosis codes on the patient profile.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Manual Compliance checklist (the manual, enforcing itself) */}
                    {selectedTemplate && (
                      <CompliancePanel findings={complianceFindings} template={selectedTemplate} />
                    )}

                    {/* Non-billable notes: no billing summary, no time log */}
                    {!isBillableTemplate && (
                      <Alert className="border-gray-300 bg-muted/40">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Non-billable note</AlertTitle>
                        <AlertDescription>
                          {selectedTemplate?.noteType === "supervision"
                            ? "Supervision notes are never billed and create no time log."
                            : "Continuation notes create no time log — the day total stays on the primary note."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Billing Summary */}
                    {isBillableTemplate && (
                    <Card className="bg-blue-50/50 border-blue-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Billing Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className={cn(
                            "font-medium",
                            encounterTime.durationMinutes < 1 && !encounterTime.isRunning
                              ? "text-destructive"
                              : "text-foreground"
                          )}>
                            {encounterTime.isRunning ? "Recording..." : `${encounterTime.durationMinutes} min`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Modality:</span>
                          <span className={cn(
                            "font-medium",
                            !modality ? "text-destructive" : "text-foreground"
                          )}>
                            {modality || "Not selected"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Service Type:</span>
                          <span className="font-medium">{patient?.billingTrack || "CHI"}</span>
                        </div>
                        {barrierAddressed && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Barrier:</span>
                            <span className="font-medium truncate max-w-[150px]">{barrierAddressed}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    )}

                    {/* Validation Errors */}
                    {Object.keys(errors).length > 0 && (
                      <Card className="border-destructive bg-destructive/5">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-destructive">
                                Please fix the following errors:
                              </p>
                              <ul className="mt-1 text-sm text-destructive list-disc list-inside">
                                {Object.values(errors).map((error, idx) => (
                                  <li key={idx}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {selectedTemplateId && (
                <span>
                  {encounterTime.isRunning && "Timer running... "}
                  {!canSave && !encounterTime.isRunning && (
                    complianceBlocked
                      ? "Resolve manual-compliance failures to sign"
                      : "Complete required fields to save"
                  )}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {selectedTemplateId && (
                <Button
                  onClick={handleSubmit}
                  disabled={!canSave || encounterTime.isRunning}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isBillableTemplate ? "Save Note & Time Log" : "Save Note"}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
