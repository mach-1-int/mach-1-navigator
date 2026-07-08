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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { localTodayISO } from "@/lib/date-rebase"
import { generateNarrative, validateResponses } from "@/lib/narrative-generator"
import { EncounterTimer, type EncounterTimeData } from "./encounter-timer"
import { AiRecorder, type AutoFillResult } from "./ai-recorder"
import type { TemplateFieldContext } from "@/lib/gemini-scribe"
import type { TemplateField, UserRole, ZCode, TimeLog } from "@/lib/types"

interface NoteBuilderProps {
  patientId: string
  patientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onNoteCreated?: () => void
}

// Union of every shape a template field's response value can take, keyed
// off NoteFieldType: select/text/textarea -> string, multi-select ->
// string[], boolean -> boolean, time-duration -> number.
type FieldValue = string | string[] | boolean | number

interface FieldRendererProps {
  field: TemplateField
  value: FieldValue | undefined
  onChange: (value: FieldValue) => void
  error?: string
}

// Billing modality type (derived from contact-method field)
type Modality = "In-Person" | "Phone" | "Video"

function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  switch (field.type) {
    case "select":
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
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
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

  // Derive modality from contact-method field for billing
  const modality = useMemo((): Modality | "" => {
    const contactMethod = responses["contact-method"] as string | undefined
    if (!contactMethod) return ""
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
  }, [responses])

  // Manual override state
  const [isManualOverride, setIsManualOverride] = useState(false)
  const [manualNarrative, setManualNarrative] = useState("")

  // AI auto-fill state
  const [aiAutoFillCount, setAiAutoFillCount] = useState<number | null>(null)
  const [aiIsMock, setAiIsMock] = useState(false)
  const [aiHasAutoFilled, setAiHasAutoFilled] = useState(false)
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set())
  const [unconfirmedLowConfidence, setUnconfirmedLowConfidence] = useState<Set<string>>(new Set())

  const selectedTemplate = useMemo(() => {
    return noteTemplates.find((t) => t.id === selectedTemplateId)
  }, [noteTemplates, selectedTemplateId])

  // Convert template fields to context for AI scribe
  const templateFieldsContext: TemplateFieldContext[] = useMemo(() => {
    if (!selectedTemplate) return []
    return selectedTemplate.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      options: field.options,
      required: field.required,
    }))
  }, [selectedTemplate])

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

    // Include billing fields in the narrative
    const billingPrefix = modality ? `Patient seen via ${modality}. ` : ""
    const barrierText = barrierAddressed ? `Addressed barrier: ${barrierAddressed}. ` : ""
    const goalText = goalAlignment ? `Aligned with care plan goal: ${goalAlignment}. ` : ""

    const templateNarrative = generateNarrative(selectedTemplate, responses)
    return `${billingPrefix}${barrierText}${goalText}${templateNarrative}`
  }, [selectedTemplate, responses, modality, barrierAddressed, goalAlignment])

  // The narrative to display (either auto-generated or manual)
  const displayNarrative = isManualOverride ? manualNarrative : autoGeneratedNarrative

  // Validation state
  const canSave = useMemo(() => {
    // Check mandatory billing requirements
    if (!modality) return false
    if (encounterTime.durationMinutes < 1 && !encounterTime.isRunning) return false
    if (!displayNarrative) return false
    return true
  }, [modality, encounterTime.durationMinutes, encounterTime.isRunning, displayNarrative])

  // Reset state when dialog opens (render-time "previous value" pattern, no effect needed)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelectedTemplateId("")
      setResponses({})
      setErrors({})
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
    // A manual edit takes ownership of the field: clear AI provenance flags
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
    const { data, fieldsMatched, isMock, fieldConfidence } = result

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
  }, [toast])

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

    // Validate billing fields
    if (!modality) {
      newErrors._modality = "Modality is required for billing"
    }

    if (encounterTime.durationMinutes < 1 && !encounterTime.isRunning) {
      newErrors._duration = "Duration must be at least 1 minute"
    }

    // Block signing while low-confidence AI suggestions remain unconfirmed
    if (unconfirmedLowConfidence.size > 0) {
      newErrors._aiConfirm = "Confirm AI-suggested values before signing"
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

      // 1. Create the TimeLog entry for billing (do this first to get the ID)
      let timeLogId: string | undefined
      if (duration > 0) {
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

      // 2. Create the Note with audit-proof time data
      addNoteFromTemplate(
        patientId,
        selectedTemplate.id,
        finalResponses,
        currentUser.id,
        currentUser.name,
        currentUser.role as UserRole,
        duration,
        {
          startTime,
          endTime,
          timeLogId,
          timeSource,
        }
      )

      // 3. Clean up any cached draft (e.g. autosaved dictation) for this note
      const draft = getNoteDraft(patientId, selectedTemplate.id)
      if (draft) {
        deleteNoteDraft(draft.id)
      }

      toast({
        title: "Note Created",
        description: `${selectedTemplate.name} note and time log added successfully`,
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
                Golden Encounter Note
              </DialogTitle>
              <DialogDescription>
                CMS G0023 Compliant Documentation for {patientName}
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
          {/* Sticky Encounter Timer */}
          {selectedTemplateId && (
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
                  <Select value="" onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Quick select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {noteTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {noteTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary hover:shadow-md",
                        template.id === "template-standard-navigation" && "ring-2 ring-primary/50 border-primary"
                      )}
                      onClick={() => setSelectedTemplateId(template.id)}
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
                        Fill in the required fields below
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplateId("")
                        setResponses({})
                        setErrors({})
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

                  {/* AI Scribe Recorder */}
                  <AiRecorder
                    templateFields={templateFieldsContext}
                    patientId={patientId}
                    templateId={selectedTemplateId}
                    onAutoFill={handleAiAutoFill}
                    onDurationDetected={handleDurationDetected}
                    currentDuration={encounterTime.durationMinutes}
                    isTimerRunning={encounterTime.isRunning}
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

                  {/* Template Fields */}
                  <div className="space-y-5">
                    {selectedTemplate?.fields.map((field) => {
                      const isAiFilled = aiFilledFields.has(field.id)
                      const needsConfirm = unconfirmedLowConfidence.has(field.id)
                      return (
                        <div
                          key={field.id}
                          className={cn(
                            isAiFilled && "border-l-2 pl-3",
                            isAiFilled && (needsConfirm ? "border-l-amber-400" : "border-l-violet-400")
                          )}
                        >
                          {isAiFilled && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <Badge
                                variant="outline"
                                className="h-5 gap-1 text-xs bg-violet-50 text-violet-700 border-violet-300"
                              >
                                <Sparkles className="h-3 w-3" />
                                AI
                              </Badge>
                              {needsConfirm && (
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
                            value={responses[field.id] as FieldValue | undefined}
                            onChange={(value) => handleFieldChange(field.id, value)}
                            error={errors[field.id]}
                          />
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

                    {/* Billing Summary */}
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
                  {!canSave && !encounterTime.isRunning && "Complete required fields to save"}
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
                  Save Note & Time Log
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
