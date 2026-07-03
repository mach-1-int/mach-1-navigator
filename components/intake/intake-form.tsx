"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { useToast } from "@/hooks/use-toast"
import {
  calculateAcuity,
  getAcuityLevelColor,
  validateInitiatingVisitDate,
  ACUITY_DOMAINS,
  type AcuityInputs,
} from "./acuity-calculator"
import type { ZCode, ServiceType, AcuityScore } from "@/lib/types"

interface IntakeFormProps {
  patientId: string
  patientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onIntakeComplete?: () => void
}

const STEPS = [
  { id: 1, title: "Eligibility", description: "Verify consent and initiating visit" },
  { id: 2, title: "Acuity Assessment", description: "Calculate patient complexity" },
  { id: 3, title: "Review & Save", description: "Confirm and create record" },
]

export function IntakeForm({
  patientId,
  patientName,
  open,
  onOpenChange,
  onIntakeComplete,
}: IntakeFormProps) {
  const { zCodes, createIntakeRecord, getPatient } = useDemoData()
  const { currentUser } = useRole()
  const { toast } = useToast()

  const patient = getPatient(patientId)

  // Step tracking
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Eligibility
  const [initiatingVisitDate, setInitiatingVisitDate] = useState<Date>()
  const [consentObtained, setConsentObtained] = useState(false)
  const [costShareNotified, setCostShareNotified] = useState(false)
  const [serviceType, setServiceType] = useState<ServiceType>(patient?.billingTrack || "CHI")

  // Z-Codes from Risk Assessment (pre-populated)
  const [selectedZCodes, setSelectedZCodes] = useState<ZCode[]>([])

  // Step 2: Acuity
  const [acuityInputs, setAcuityInputs] = useState<AcuityInputs>({
    clinical: 0,
    psychosocial: 0,
    barriers: 0,
    literacy: 0,
  })

  // Derived values
  const dateValidation = useMemo(() => {
    if (!initiatingVisitDate) return null
    return validateInitiatingVisitDate(initiatingVisitDate)
  }, [initiatingVisitDate])

  const calculatedAcuity = useMemo(() => {
    return calculateAcuity(acuityInputs)
  }, [acuityInputs])

  // Check if Risk Assessment has been completed
  const hasRiskAssessment = !!patient?.riskAssessment

  // Get Z-codes suggested from Risk Assessment SDOH data
  const riskAssessmentZCodes = useMemo(() => {
    if (!patient?.riskAssessment?.socialDeterminants) return []
    const sdoh = patient.riskAssessment.socialDeterminants
    const suggestedCodes: ZCode[] = []

    if (sdoh.housingInsecurity) {
      const code = zCodes.find(z => z.code === "Z59.0" || z.category === "Housing")
      if (code) suggestedCodes.push(code)
    }
    if (sdoh.foodInsecurity) {
      const code = zCodes.find(z => z.code === "Z59.4" || z.category === "Food")
      if (code) suggestedCodes.push(code)
    }
    if (sdoh.transportationIssues) {
      const code = zCodes.find(z => z.code === "Z59.8" || z.category === "Transport")
      if (code) suggestedCodes.push(code)
    }

    return suggestedCodes
  }, [patient?.riskAssessment, zCodes])

  // Calculate suggested barrier score from Risk Assessment
  const suggestedBarrierScore = useMemo(() => {
    if (!patient?.riskAssessment?.socialDeterminants) return 0
    const sdoh = patient.riskAssessment.socialDeterminants
    let score = 0
    if (sdoh.housingInsecurity) score += 1
    if (sdoh.foodInsecurity) score += 1
    if (sdoh.transportationIssues) score += 1
    return Math.min(score, 3) as 0 | 1 | 2 | 3
  }, [patient?.riskAssessment])

  // Reset form when dialog opens - pre-populate from Risk Assessment if available
  useEffect(() => {
    if (open) {
      setCurrentStep(1)
      setInitiatingVisitDate(undefined)
      setConsentObtained(false)
      setCostShareNotified(false)
      setServiceType(patient?.billingTrack || "CHI")

      // Pre-populate Z-codes from Risk Assessment
      setSelectedZCodes(riskAssessmentZCodes)

      // Pre-populate barrier score from Risk Assessment
      setAcuityInputs({
        clinical: 0,
        psychosocial: 0,
        barriers: suggestedBarrierScore,
        literacy: 0,
      })
    }
  }, [open, patient?.billingTrack, riskAssessmentZCodes, suggestedBarrierScore])

  // Validation for each step
  const canProceedStep1 = consentObtained && costShareNotified && initiatingVisitDate && !dateValidation?.error
  const canProceedStep2 = true // Acuity fields have defaults

  const handleSubmit = () => {
    if (!currentUser || !initiatingVisitDate) return

    try {
      createIntakeRecord({
        patientId,
        date: new Date().toISOString(),
        initiatingVisitDate: initiatingVisitDate.toISOString(),
        consentObtained: true,
        consentDate: new Date().toISOString(),
        serviceType,
        acuity: calculatedAcuity,
        identifiedBarriers: selectedZCodes,
        primaryNavigatorId: currentUser.id,
      })

      toast({
        title: "Intake Complete",
        description: `Intake assessment for ${patientName} has been saved successfully.`,
      })

      onOpenChange(false)
      onIntakeComplete?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save intake assessment",
        variant: "destructive",
      })
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Service Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Service Type</Label>
              <p className="text-sm text-muted-foreground">
                Select the billing track for this patient
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Card
                  className={cn(
                    "cursor-pointer transition-all",
                    serviceType === "PIN"
                      ? "border-primary ring-2 ring-primary/30"
                      : "hover:border-muted-foreground/50"
                  )}
                  onClick={() => setServiceType("PIN")}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      PIN
                      {serviceType === "PIN" && <Check className="h-4 w-4 text-primary" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Principal Illness Navigation - Complex medical management, oncology, serious illness
                    </p>
                  </CardContent>
                </Card>
                <Card
                  className={cn(
                    "cursor-pointer transition-all",
                    serviceType === "CHI"
                      ? "border-primary ring-2 ring-primary/30"
                      : "hover:border-muted-foreground/50"
                  )}
                  onClick={() => setServiceType("CHI")}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      CHI
                      {serviceType === "CHI" && <Check className="h-4 w-4 text-primary" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Community Health Integration - SDOH focus, social support, care coordination
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator />

            {/* Initiating Visit Date */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Initiating Visit Date <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                The date of the first billable navigation encounter
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !initiatingVisitDate && "text-muted-foreground",
                      dateValidation?.error && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {initiatingVisitDate ? format(initiatingVisitDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={initiatingVisitDate}
                    onSelect={setInitiatingVisitDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dateValidation?.error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {dateValidation.error}
                </p>
              )}
              {dateValidation?.warning && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {dateValidation.warning}
                </p>
              )}
            </div>

            <Separator />

            {/* Consent */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Required Consent <span className="text-destructive">*</span>
              </Label>
              <Card className={cn("border-2", consentObtained && costShareNotified ? "border-green-200 bg-green-50/50" : "")}>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="consent"
                      checked={consentObtained}
                      onCheckedChange={(checked) => setConsentObtained(checked === true)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="consent" className="cursor-pointer font-medium">
                        Patient Consent Obtained
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Patient has been informed about and consented to navigation services
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="costShare"
                      checked={costShareNotified}
                      onCheckedChange={(checked) => setCostShareNotified(checked === true)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="costShare" className="cursor-pointer font-medium">
                        Cost-Share Notification Provided
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Patient notified of potential cost-sharing responsibilities (CMS requirement)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            {/* Acuity Preview */}
            <Card className={cn("border-2", getAcuityLevelColor(calculatedAcuity.level))}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Calculated Acuity</p>
                    <p className="text-2xl font-bold">{calculatedAcuity.totalScore}/12</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-lg px-4 py-1", getAcuityLevelColor(calculatedAcuity.level))}
                  >
                    {calculatedAcuity.level}
                  </Badge>
                </div>
                <Progress
                  value={(calculatedAcuity.totalScore / 12) * 100}
                  className="mt-3"
                />
              </CardContent>
            </Card>

            <Separator />

            {/* Domain Scores */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Acuity Domain Scores</Label>

              {(Object.keys(ACUITY_DOMAINS) as Array<keyof typeof ACUITY_DOMAINS>).map((domain) => {
                const domainInfo = ACUITY_DOMAINS[domain]
                const value = acuityInputs[domain]
                return (
                  <Card key={domain}>
                    <CardContent className="py-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="font-medium">{domainInfo.label}</Label>
                            <p className="text-xs text-muted-foreground">
                              {domainInfo.description}
                            </p>
                          </div>
                          <Badge variant="outline" className="font-mono">
                            {value}/3
                          </Badge>
                        </div>
                        <Select
                          value={value.toString()}
                          onValueChange={(val) =>
                            setAcuityInputs((prev) => ({
                              ...prev,
                              [domain]: parseInt(val) as 0 | 1 | 2 | 3,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {domainInfo.options.map((option) => (
                              <SelectItem key={option.value} value={option.value.toString()}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono w-6 justify-center">
                                    {option.value}
                                  </Badge>
                                  <span>{option.label}</span>
                                  <span className="text-muted-foreground">- {option.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {/* Barrier score from Risk Assessment */}
              {hasRiskAssessment && suggestedBarrierScore > 0 && suggestedBarrierScore !== acuityInputs.barriers && (
                <Card className="bg-blue-50/50 border-blue-200">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">
                          Based on Risk Assessment, suggested barrier score: <strong>{suggestedBarrierScore}</strong>
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAcuityInputs((prev) => ({ ...prev, barriers: suggestedBarrierScore }))
                        }
                      >
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Intake Summary
                </CardTitle>
                <CardDescription>
                  Review the assessment before saving
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Patient Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Patient</p>
                    <p className="font-medium">{patientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Service Type</p>
                    <Badge variant="outline">{serviceType === "PIN" ? "Principal Illness Navigation" : "Community Health Integration"}</Badge>
                  </div>
                </div>

                <Separator />

                {/* Eligibility */}
                <div className="space-y-2">
                  <p className="font-medium">Eligibility</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Initiating Visit</p>
                      <p>{initiatingVisitDate ? format(initiatingVisitDate, "PPP") : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Consent Status</p>
                      <div className="flex items-center gap-1">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Obtained</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* SDOH - from Risk Assessment */}
                <div className="space-y-2">
                  <p className="font-medium">
                    Identified Barriers
                    {hasRiskAssessment && (
                      <span className="text-xs font-normal text-muted-foreground ml-2">(from Risk Assessment)</span>
                    )}
                  </p>
                  {selectedZCodes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedZCodes.map((zCode) => (
                        <Badge key={zCode.code} variant="outline">
                          {zCode.code}: {zCode.description}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {hasRiskAssessment
                        ? "No barriers identified in Risk Assessment"
                        : "No barriers documented - complete Risk Assessment first"}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Acuity */}
                <div className="space-y-2">
                  <p className="font-medium">Acuity Assessment</p>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className={cn("text-lg px-4 py-1", getAcuityLevelColor(calculatedAcuity.level))}
                    >
                      {calculatedAcuity.level}
                    </Badge>
                    <span className="text-2xl font-bold">{calculatedAcuity.totalScore}/12</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Clinical</p>
                      <p className="font-bold">{calculatedAcuity.clinical}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Psychosocial</p>
                      <p className="font-bold">{calculatedAcuity.psychosocial}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Barriers</p>
                      <p className="font-bold">{calculatedAcuity.barriers}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Literacy</p>
                      <p className="font-bold">{calculatedAcuity.literacy}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Intake Assessment
          </DialogTitle>
          <DialogDescription>
            {patientName} - Step {currentStep} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                      currentStep > step.id
                        ? "bg-primary text-primary-foreground"
                        : currentStep === step.id
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <p className="text-xs mt-1 text-center max-w-[80px]">{step.title}</p>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-12 mx-2",
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {currentStep < STEPS.length ? (
                <Button
                  onClick={() => setCurrentStep((prev) => Math.min(STEPS.length, prev + 1))}
                  disabled={
                    (currentStep === 1 && !canProceedStep1) ||
                    (currentStep === 2 && !canProceedStep2)
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit}>
                  <Check className="h-4 w-4 mr-1" />
                  Complete Intake
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
