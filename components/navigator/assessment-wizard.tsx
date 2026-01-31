"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Home,
  Utensils,
  Car,
  AlertTriangle,
  Building2,
  Pill,
  Activity,
  ClipboardCheck,
  Save,
  ChevronRight,
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { RISK_WEIGHTS, calculateRiskScore, calculateRiskTier } from "@/lib/store"
import type { RiskAssessmentData } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AssessmentWizardProps {
  patientId: string
}

type WizardStep = "social" | "clinical" | "mobility" | "summary"

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: "social", label: "Social Determinants", icon: <Home className="h-4 w-4" /> },
  { id: "clinical", label: "Clinical Status", icon: <Activity className="h-4 w-4" /> },
  { id: "mobility", label: "Mobility", icon: <Activity className="h-4 w-4" /> },
  { id: "summary", label: "Summary", icon: <ClipboardCheck className="h-4 w-4" /> },
]

export function AssessmentWizard({ patientId }: AssessmentWizardProps) {
  const { getPatient, submitAssessment } = useDemoData()
  const { goBack, currentUser } = useRole()
  const [currentStep, setCurrentStep] = useState<WizardStep>("social")
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [socialDeterminants, setSocialDeterminants] = useState({
    housingInsecurity: false,
    foodInsecurity: false,
    transportationIssues: false,
  })

  const [clinicalStatus, setClinicalStatus] = useState({
    recentFall: false,
    hospitalizedLast30Days: false,
    polypharmacy: false,
  })

  const [mobility, setMobility] = useState<"independent" | "walker" | "wheelchair" | "bedbound">("independent")

  const patient = getPatient(patientId)

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Patient not found</p>
        <Button variant="outline" onClick={goBack} className="mt-4 bg-transparent">
          Go Back
        </Button>
      </div>
    )
  }

  // Calculate current risk score
  const assessmentData = { socialDeterminants, clinicalStatus, mobility }
  const riskScore = calculateRiskScore(assessmentData)
  const calculatedTier = calculateRiskTier(riskScore)

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    const fullAssessmentData: Omit<RiskAssessmentData, "riskScore" | "calculatedTier" | "completedAt"> = {
      socialDeterminants,
      clinicalStatus,
      mobility,
      completedBy: currentUser?.id || "nav1",
    }

    submitAssessment(patientId, fullAssessmentData, currentUser?.id || "nav1")

    // Simulate async save
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsSaving(false)
    goBack()
  }

  const getRiskColor = (tier: 1 | 2 | 3) => {
    switch (tier) {
      case 1:
        return "text-emerald-600"
      case 2:
        return "text-amber-600"
      case 3:
        return "text-red-600"
    }
  }

  const getRiskBgColor = (tier: 1 | 2 | 3) => {
    switch (tier) {
      case 1:
        return "bg-emerald-100"
      case 2:
        return "bg-amber-100"
      case 3:
        return "bg-red-100"
    }
  }

  const getRiskLabel = (tier: 1 | 2 | 3) => {
    switch (tier) {
      case 1:
        return "Low Risk"
      case 2:
        return "Medium Risk"
      case 3:
        return "High Risk"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={goBack} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-card-foreground">Risk Assessment</h2>
            <p className="text-muted-foreground">Initial Home Visit - {patient.name}</p>
          </div>
        </div>
        <Badge variant="secondary">
          Chart: {patient.chartNumber}
        </Badge>
      </div>

      {/* Progress Stepper */}
      <Card className="bg-card">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Progress bar */}
            <Progress value={progressPercent} className="h-2" />

            {/* Step indicators */}
            <div className="flex justify-between">
              {STEPS.map((step, index) => {
                const isActive = step.id === currentStep
                const isCompleted = index < currentStepIndex
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-colors",
                      isActive && "text-primary font-medium",
                      isCompleted && "text-muted-foreground",
                      !isActive && !isCompleted && "text-muted-foreground/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                        isActive && "border-primary bg-primary text-primary-foreground",
                        isCompleted && "border-primary bg-primary/10 text-primary",
                        !isActive && !isCompleted && "border-muted-foreground/30"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel - Form */}
        <div className="lg:col-span-2">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                {STEPS[currentStepIndex].icon}
                {STEPS[currentStepIndex].label}
              </CardTitle>
              <CardDescription>
                {currentStep === "social" && "Assess social determinants of health that may impact care"}
                {currentStep === "clinical" && "Evaluate recent clinical events and medication status"}
                {currentStep === "mobility" && "Determine the patient's mobility level"}
                {currentStep === "summary" && "Review assessment results and confirm risk level"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Step 1: Social Determinants */}
              {currentStep === "social" && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    {/* Housing Insecurity */}
                    <div className="flex items-start space-x-4 p-4 rounded-lg border bg-muted/30">
                      <Checkbox
                        id="housing"
                        checked={socialDeterminants.housingInsecurity}
                        onCheckedChange={(checked) =>
                          setSocialDeterminants((prev) => ({
                            ...prev,
                            housingInsecurity: checked === true,
                          }))
                        }
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="housing" className="text-base font-medium cursor-pointer">
                            <Home className="h-4 w-4 inline-block mr-2 text-muted-foreground" />
                            Housing Insecurity
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            +{RISK_WEIGHTS.housingInsecurity} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Patient lacks stable housing, lives in substandard conditions, or is at risk of homelessness
                        </p>
                      </div>
                    </div>

                    {/* Food Insecurity */}
                    <div className="flex items-start space-x-4 p-4 rounded-lg border bg-muted/30">
                      <Checkbox
                        id="food"
                        checked={socialDeterminants.foodInsecurity}
                        onCheckedChange={(checked) =>
                          setSocialDeterminants((prev) => ({
                            ...prev,
                            foodInsecurity: checked === true,
                          }))
                        }
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="food" className="text-base font-medium cursor-pointer">
                            <Utensils className="h-4 w-4 inline-block mr-2 text-muted-foreground" />
                            Food Insecurity
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            +{RISK_WEIGHTS.foodInsecurity} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Patient has limited access to nutritious food or worries about running out of food
                        </p>
                      </div>
                    </div>

                    {/* Transportation Issues */}
                    <div className="flex items-start space-x-4 p-4 rounded-lg border bg-muted/30">
                      <Checkbox
                        id="transport"
                        checked={socialDeterminants.transportationIssues}
                        onCheckedChange={(checked) =>
                          setSocialDeterminants((prev) => ({
                            ...prev,
                            transportationIssues: checked === true,
                          }))
                        }
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="transport" className="text-base font-medium cursor-pointer">
                            <Car className="h-4 w-4 inline-block mr-2 text-muted-foreground" />
                            Transportation Issues
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            +{RISK_WEIGHTS.transportationIssues} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Patient has difficulty getting to medical appointments or pharmacy due to lack of transportation
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Clinical Status */}
              {currentStep === "clinical" && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    {/* Recent Fall */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <Label htmlFor="fall" className="text-base font-medium cursor-pointer">
                            Recent Fall
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            +{RISK_WEIGHTS.recentFall} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Patient has experienced a fall in the past 90 days
                        </p>
                      </div>
                      <Switch
                        id="fall"
                        checked={clinicalStatus.recentFall}
                        onCheckedChange={(checked) =>
                          setClinicalStatus((prev) => ({
                            ...prev,
                            recentFall: checked,
                          }))
                        }
                      />
                    </div>

                    {/* Hospitalized */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-red-500" />
                          <Label htmlFor="hospital" className="text-base font-medium cursor-pointer">
                            Hospitalized in Last 30 Days
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            +{RISK_WEIGHTS.hospitalizedLast30Days} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Patient was admitted to hospital or ED within the last 30 days
                        </p>
                      </div>
                      <Switch
                        id="hospital"
                        checked={clinicalStatus.hospitalizedLast30Days}
                        onCheckedChange={(checked) =>
                          setClinicalStatus((prev) => ({
                            ...prev,
                            hospitalizedLast30Days: checked,
                          }))
                        }
                      />
                    </div>

                    {/* Polypharmacy */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4 text-purple-500" />
                          <Label htmlFor="polypharmacy" className="text-base font-medium cursor-pointer">
                            Polypharmacy (5+ Medications)
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            +{RISK_WEIGHTS.polypharmacy} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Patient is currently taking 5 or more prescription medications
                        </p>
                      </div>
                      <Switch
                        id="polypharmacy"
                        checked={clinicalStatus.polypharmacy}
                        onCheckedChange={(checked) =>
                          setClinicalStatus((prev) => ({
                            ...prev,
                            polypharmacy: checked,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Mobility */}
              {currentStep === "mobility" && (
                <div className="space-y-6">
                  <RadioGroup value={mobility} onValueChange={(v) => setMobility(v as typeof mobility)}>
                    <div className="space-y-4">
                      {/* Independent */}
                      <div
                        className={cn(
                          "flex items-center space-x-4 p-4 rounded-lg border transition-colors cursor-pointer",
                          mobility === "independent" ? "bg-primary/5 border-primary" : "bg-muted/30"
                        )}
                        onClick={() => setMobility("independent")}
                      >
                        <RadioGroupItem value="independent" id="independent" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="independent" className="text-base font-medium cursor-pointer">
                              Independent
                            </Label>
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                              +{RISK_WEIGHTS.mobility.independent} pts
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Patient can walk and move around without assistance
                          </p>
                        </div>
                      </div>

                      {/* Walker */}
                      <div
                        className={cn(
                          "flex items-center space-x-4 p-4 rounded-lg border transition-colors cursor-pointer",
                          mobility === "walker" ? "bg-primary/5 border-primary" : "bg-muted/30"
                        )}
                        onClick={() => setMobility("walker")}
                      >
                        <RadioGroupItem value="walker" id="walker" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="walker" className="text-base font-medium cursor-pointer">
                              Walker / Cane
                            </Label>
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                              +{RISK_WEIGHTS.mobility.walker} pts
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Patient requires a walker, cane, or similar assistive device for mobility
                          </p>
                        </div>
                      </div>

                      {/* Wheelchair */}
                      <div
                        className={cn(
                          "flex items-center space-x-4 p-4 rounded-lg border transition-colors cursor-pointer",
                          mobility === "wheelchair" ? "bg-primary/5 border-primary" : "bg-muted/30"
                        )}
                        onClick={() => setMobility("wheelchair")}
                      >
                        <RadioGroupItem value="wheelchair" id="wheelchair" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="wheelchair" className="text-base font-medium cursor-pointer">
                              Wheelchair
                            </Label>
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                              +{RISK_WEIGHTS.mobility.wheelchair} pts
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Patient primarily uses a wheelchair for mobility
                          </p>
                        </div>
                      </div>

                      {/* Bedbound */}
                      <div
                        className={cn(
                          "flex items-center space-x-4 p-4 rounded-lg border transition-colors cursor-pointer",
                          mobility === "bedbound" ? "bg-primary/5 border-primary" : "bg-muted/30"
                        )}
                        onClick={() => setMobility("bedbound")}
                      >
                        <RadioGroupItem value="bedbound" id="bedbound" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="bedbound" className="text-base font-medium cursor-pointer">
                              Bedbound
                            </Label>
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                              +{RISK_WEIGHTS.mobility.bedbound} pts
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Patient is primarily confined to bed and requires assistance for all mobility
                          </p>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Step 4: Summary */}
              {currentStep === "summary" && (
                <div className="space-y-6">
                  {/* Risk Score Display */}
                  <div className={cn("p-6 rounded-lg text-center", getRiskBgColor(calculatedTier))}>
                    <div className={cn("text-6xl font-bold", getRiskColor(calculatedTier))}>
                      {riskScore}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Risk Score (0-100)</div>
                    <Badge className={cn("mt-3", getRiskColor(calculatedTier), getRiskBgColor(calculatedTier))}>
                      Tier {calculatedTier} - {getRiskLabel(calculatedTier)}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Assessment Summary */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-card-foreground">Assessment Summary</h4>

                    {/* Social Determinants */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Social Determinants
                      </h5>
                      <div className="grid gap-2 pl-6">
                        <SummaryItem
                          label="Housing Insecurity"
                          value={socialDeterminants.housingInsecurity}
                          points={RISK_WEIGHTS.housingInsecurity}
                        />
                        <SummaryItem
                          label="Food Insecurity"
                          value={socialDeterminants.foodInsecurity}
                          points={RISK_WEIGHTS.foodInsecurity}
                        />
                        <SummaryItem
                          label="Transportation Issues"
                          value={socialDeterminants.transportationIssues}
                          points={RISK_WEIGHTS.transportationIssues}
                        />
                      </div>
                    </div>

                    {/* Clinical Status */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Clinical Status
                      </h5>
                      <div className="grid gap-2 pl-6">
                        <SummaryItem
                          label="Recent Fall"
                          value={clinicalStatus.recentFall}
                          points={RISK_WEIGHTS.recentFall}
                        />
                        <SummaryItem
                          label="Hospitalized < 30 Days"
                          value={clinicalStatus.hospitalizedLast30Days}
                          points={RISK_WEIGHTS.hospitalizedLast30Days}
                        />
                        <SummaryItem
                          label="Polypharmacy (5+ meds)"
                          value={clinicalStatus.polypharmacy}
                          points={RISK_WEIGHTS.polypharmacy}
                        />
                      </div>
                    </div>

                    {/* Mobility */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Mobility
                      </h5>
                      <div className="pl-6 flex items-center justify-between">
                        <span className="text-sm capitalize">{mobility}</span>
                        <Badge variant="outline" className="text-xs">
                          +{RISK_WEIGHTS.mobility[mobility]} pts
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6 mt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentStepIndex === 0}
                  className="bg-transparent"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentStep !== "summary" ? (
                  <Button onClick={handleNext}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Assessment
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Live Score */}
        <div className="space-y-4">
          <Card className="bg-card sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-card-foreground text-lg">Live Risk Score</CardTitle>
              <CardDescription>Updates as you complete the assessment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score Gauge */}
              <div className={cn("p-4 rounded-lg text-center", getRiskBgColor(calculatedTier))}>
                <div className={cn("text-4xl font-bold", getRiskColor(calculatedTier))}>
                  {riskScore}
                </div>
                <div className="text-xs text-muted-foreground">out of 100</div>
              </div>

              {/* Risk Tier */}
              <div className="text-center">
                <Badge
                  className={cn(
                    "text-sm px-3 py-1",
                    calculatedTier === 1 && "bg-emerald-100 text-emerald-700",
                    calculatedTier === 2 && "bg-amber-100 text-amber-700",
                    calculatedTier === 3 && "bg-red-100 text-red-700"
                  )}
                >
                  Tier {calculatedTier}: {getRiskLabel(calculatedTier)}
                </Badge>
              </div>

              <Separator />

              {/* Score Breakdown */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-card-foreground">Score Breakdown</h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Social Determinants</span>
                    <span className="font-medium">
                      {(socialDeterminants.housingInsecurity ? RISK_WEIGHTS.housingInsecurity : 0) +
                        (socialDeterminants.foodInsecurity ? RISK_WEIGHTS.foodInsecurity : 0) +
                        (socialDeterminants.transportationIssues ? RISK_WEIGHTS.transportationIssues : 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clinical Status</span>
                    <span className="font-medium">
                      {(clinicalStatus.recentFall ? RISK_WEIGHTS.recentFall : 0) +
                        (clinicalStatus.hospitalizedLast30Days ? RISK_WEIGHTS.hospitalizedLast30Days : 0) +
                        (clinicalStatus.polypharmacy ? RISK_WEIGHTS.polypharmacy : 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mobility</span>
                    <span className="font-medium">{RISK_WEIGHTS.mobility[mobility]}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Risk Scale Legend */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-card-foreground">Risk Tiers</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>0-30: Low Risk (Tier 1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span>31-60: Medium Risk (Tier 2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>61-100: High Risk (Tier 3)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Patient Info Card */}
          <Card className="bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-card-foreground text-lg">Patient Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{patient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DOB</span>
                <span className="font-medium">{patient.dob}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Health Plan</span>
                <span className="font-medium">{patient.healthPlan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Tier</span>
                <Badge variant="secondary">L{patient.riskLevel}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryItem({ label, value, points }: { label: string; value: boolean; points: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {value ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
        )}
        <span className={value ? "text-card-foreground" : "text-muted-foreground"}>{label}</span>
      </div>
      {value && (
        <Badge variant="outline" className="text-xs">
          +{points} pts
        </Badge>
      )}
    </div>
  )
}
