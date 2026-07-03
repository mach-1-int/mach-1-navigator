"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import {
  Database,
  FileCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Building2,
  User,
  Calendar,
  MapPin,
  Stethoscope,
  CreditCard,
  UserPlus,
  ChevronRight,
  Users,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { SimulatedHL7Feed } from "@/lib/referral-ingestion"
import type { Patient } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AMDSourceIndicator } from "@/components/amd-source-indicator"
import { HL7IngestDialog } from "@/components/supervisor/hl7-ingest-dialog"

// Rotation state lives at module level in referral-ingestion, so a single
// shared adapter instance is fine across re-renders.
const simulatedFeed = new SimulatedHL7Feed()

// Zod schema for intake form validation
const intakeFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().length(2, "State must be 2 characters"),
  zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),
  healthPlan: z.string().min(1, "Health plan is required"),
  memberId: z.string().min(1, "Member ID is required"),
  primaryDiagnosis: z.string().min(1, "Primary diagnosis is required"),
  icdCodes: z.string().optional(),
  riskLevel: z.enum(["1", "2", "3"]),
  assignedNavigator: z.string().min(1, "Navigator assignment is required"),
})

type IntakeFormValues = z.infer<typeof intakeFormSchema>

function getRiskBadge(riskScore: 1 | 2 | 3) {
  const config = {
    1: { label: "L1 - Low", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    2: { label: "L2 - Medium", className: "bg-amber-100 text-amber-700 border-amber-200" },
    3: { label: "L3 - High", className: "bg-red-100 text-red-700 border-red-200" },
  }
  return config[riskScore]
}

export function ReferralReviewView() {
  const { getPendingReferrals, navigators, acceptReferral, rejectReferral, ingestReferral } = useDemoData()
  const { navigateTo, currentUser } = useRole()
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hl7DialogOpen, setHl7DialogOpen] = useState(false)

  const pendingReferrals = getPendingReferrals()
  // Derived selection: fall back to the first pending referral when nothing is
  // explicitly selected (or the selection was accepted/rejected away)
  const selectedReferral =
    pendingReferrals.find(r => r.id === selectedReferralId) ?? pendingReferrals[0]

  // Get navigators for the logged-in supervisor's team
  const teamNavigators = navigators.filter((nav) => nav.supervisorId === currentUser?.id)

  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      name: "",
      dob: "",
      phone: "",
      email: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      healthPlan: "",
      memberId: "",
      primaryDiagnosis: "",
      icdCodes: "",
      riskLevel: "2",
      assignedNavigator: "",
    },
  })

  // Populate form when referral is selected
  useEffect(() => {
    if (selectedReferral?.rawData) {
      const rawData = selectedReferral.rawData
      form.reset({
        name: rawData.PID.patientName || "",
        dob: rawData.PID.dob || "",
        phone: rawData.PID.phone || "",
        email: rawData.PID.email || "",
        street: rawData.PID.address?.street || "",
        city: rawData.PID.address?.city || "",
        state: rawData.PID.address?.state || "",
        zip: rawData.PID.address?.zip || "",
        healthPlan: rawData.IN1.payerName || "",
        memberId: rawData.IN1.memberId || "",
        primaryDiagnosis: rawData.DG1.primaryDiagnosis || "",
        icdCodes: rawData.DG1.icdCodes?.join(", ") || "",
        riskLevel: String(selectedReferral.riskScore) as "1" | "2" | "3",
        assignedNavigator: "",
      })
    }
  }, [selectedReferral, form])

  const onSubmit = async (data: IntakeFormValues) => {
    if (!selectedReferral) return

    setIsSubmitting(true)

    const patientData: Partial<Patient> = {
      name: data.name,
      dob: data.dob,
      phone: data.phone,
      email: data.email || undefined,
      address: {
        street: data.street,
        city: data.city,
        state: data.state,
        zip: data.zip,
      },
      healthPlan: data.healthPlan,
      primaryDiagnosis: data.primaryDiagnosis,
      icdCodes: data.icdCodes ? data.icdCodes.split(",").map((c) => c.trim()) : undefined,
      riskLevel: parseInt(data.riskLevel) as 1 | 2 | 3,
    }

    const newPatient = acceptReferral(selectedReferral.id, patientData, data.assignedNavigator)

    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsSubmitting(false)

    if (newPatient) {
      // Navigate to the newly created patient profile
      navigateTo("patient-detail", { patientId: newPatient.id })
    }
  }

  const handleReject = () => {
    if (!selectedReferral) return
    rejectReferral(selectedReferral.id)
    setSelectedReferralId(null)
  }

  const handleSimulateIncoming = () => {
    const { parsed } = simulatedFeed.generateIncoming()
    ingestReferral(parsed.referral)
    toast.success(`New referral received from ${parsed.referral.rawData.PV1.facilityName}`)
  }

  const toolbar = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" className="gap-2" onClick={handleSimulateIncoming}>
        <Zap className="h-4 w-4" />
        Simulate Incoming Referral
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setHl7DialogOpen(true)}>
        <FileText className="h-4 w-4" />
        Paste HL7…
      </Button>
      <HL7IngestDialog open={hl7DialogOpen} onOpenChange={setHl7DialogOpen} />
    </div>
  )

  // Empty state when no pending referrals
  if (pendingReferrals.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-card-foreground">All Caught Up!</h3>
          <p className="text-muted-foreground mt-2">No pending referrals to review.</p>
        </div>
      </div>
    )
  }

  const rawData = selectedReferral?.rawData

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-180px)]">
      {toolbar}
      <div className="grid gap-6 lg:grid-cols-[350px_1fr] flex-1 min-h-0">
      {/* Left Pane - Referral List */}
      <Card className="bg-card flex flex-col h-full">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Pending Referrals</CardTitle>
            </div>
            <Badge variant="secondary">{pendingReferrals.length}</Badge>
          </div>
          <CardDescription>Select a referral to review</CardDescription>
        </CardHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <CardContent className="space-y-2 pt-0 pb-4">
            {pendingReferrals.map((referral) => {
              const isSelected = referral.id === selectedReferral?.id
              const risk = getRiskBadge(referral.riskScore)
              return (
                <div
                  key={referral.id}
                  className={cn(
                    "w-full rounded-lg border transition-all p-4",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedReferralId(referral.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-card-foreground truncate">
                            {referral.patientName}
                          </p>
                          {isSelected && (
                            <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {referral.diagnosis}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={cn("text-xs", risk.className)}>
                            {referral.riskScore === 3 && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {risk.label}
                          </Badge>
                          <AMDSourceIndicator source={referral.source} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{referral.referralSource}</span>
                    </div>
                  </button>
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full mt-3 gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigateTo("intake-workspace", { referralId: referral.id })
                    }}
                  >
                    <Users className="h-4 w-4" />
                    Match & Assign
                  </Button>
                </div>
              )
            })}
            </CardContent>
          </ScrollArea>
        </div>
      </Card>

      {/* Right Pane - Split View (Raw Data + Intake Form) */}
      {selectedReferral && rawData ? (
        <div className="grid gap-4 lg:grid-cols-2 overflow-hidden">
          {/* Raw AMD Data */}
          <Card className="bg-card overflow-hidden flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-card-foreground">Source: AMD Integration</CardTitle>
              </div>
              <CardDescription>Raw HL7 data from {selectedReferral.source}</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1">
              <CardContent className="space-y-4 pt-0">
                {/* Received timestamp */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Received: {new Date(selectedReferral.receivedAt).toLocaleString()}
                </div>

                <Separator />

                {/* Raw HL7v2 message (present when ingested via the HL7 adapter) */}
                {selectedReferral.rawHL7 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-semibold text-card-foreground">Raw HL7v2 Message</span>
                    </div>
                    <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre">
                      {selectedReferral.rawHL7.split(/\r\n|\r|\n/).join("\n")}
                    </pre>
                  </div>
                )}

                {/* PID Segment */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-card-foreground">PID - Patient Identification</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-1">
                    <div><span className="text-muted-foreground">Name:</span> {rawData.PID.patientName}</div>
                    <div><span className="text-muted-foreground">DOB:</span> {rawData.PID.dob}</div>
                    <div><span className="text-muted-foreground">Gender:</span> {rawData.PID.gender}</div>
                    {rawData.PID.ssn && <div><span className="text-muted-foreground">SSN:</span> {rawData.PID.ssn}</div>}
                    <div><span className="text-muted-foreground">Address:</span> {rawData.PID.address.street}</div>
                    <div className="pl-16">{rawData.PID.address.city}, {rawData.PID.address.state} {rawData.PID.address.zip}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {rawData.PID.phone}</div>
                    {rawData.PID.email && <div><span className="text-muted-foreground">Email:</span> {rawData.PID.email}</div>}
                  </div>
                </div>

                {/* DG1 Segment */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-semibold text-card-foreground">DG1 - Diagnosis</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-1">
                    <div><span className="text-muted-foreground">Primary:</span> {rawData.DG1.primaryDiagnosis}</div>
                    <div><span className="text-muted-foreground">ICD Codes:</span> {rawData.DG1.icdCodes.join(", ")}</div>
                    <div><span className="text-muted-foreground">Dx Date:</span> {rawData.DG1.diagnosisDate}</div>
                  </div>
                </div>

                {/* IN1 Segment */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold text-card-foreground">IN1 - Insurance</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-1">
                    <div><span className="text-muted-foreground">Payer:</span> {rawData.IN1.payerName}</div>
                    <div><span className="text-muted-foreground">Payer ID:</span> {rawData.IN1.payerId}</div>
                    <div><span className="text-muted-foreground">Member ID:</span> {rawData.IN1.memberId}</div>
                    {rawData.IN1.groupNumber && <div><span className="text-muted-foreground">Group #:</span> {rawData.IN1.groupNumber}</div>}
                  </div>
                </div>

                {/* PV1 Segment */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold text-card-foreground">PV1 - Visit Information</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-1">
                    <div><span className="text-muted-foreground">Facility:</span> {rawData.PV1.facilityName}</div>
                    {rawData.PV1.admitDate && <div><span className="text-muted-foreground">Admit:</span> {rawData.PV1.admitDate}</div>}
                    {rawData.PV1.dischargeDate && <div><span className="text-muted-foreground">Discharge:</span> {rawData.PV1.dischargeDate}</div>}
                    {rawData.PV1.attendingPhysician && <div><span className="text-muted-foreground">Attending:</span> {rawData.PV1.attendingPhysician}</div>}
                    <div><span className="text-muted-foreground">Referring:</span> {rawData.PV1.referringPhysician}</div>
                  </div>
                </div>
              </CardContent>
            </ScrollArea>
          </Card>

          {/* Intake Form */}
          <Card className="bg-card overflow-hidden flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-card-foreground">Mach 1 Intake Form</CardTitle>
              </div>
              <CardDescription>Review and edit before creating patient record</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1">
              <CardContent className="pt-0">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Patient Information */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Patient Information
                      </h3>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dob"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date of Birth</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="(555) 555-5555" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email (Optional)</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Address */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address
                      </h3>

                      <FormField
                        control={form.control}
                        name="street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-3">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={2} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="zip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP</FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={5} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Insurance */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Insurance
                      </h3>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="healthPlan"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Health Plan</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="memberId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Member ID</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Clinical */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        Clinical Information
                      </h3>

                      <FormField
                        control={form.control}
                        name="primaryDiagnosis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Diagnosis</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="icdCodes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ICD Codes</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="I50.9, J44.9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="riskLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Risk Level</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select risk level" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">Level 1 - Low</SelectItem>
                                  <SelectItem value="2">Level 2 - Medium</SelectItem>
                                  <SelectItem value="3">Level 3 - High</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Assignment */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-card-foreground">Navigator Assignment</h3>

                      <FormField
                        control={form.control}
                        name="assignedNavigator"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assign to Navigator</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select navigator..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {teamNavigators.map((nav) => (
                                  <SelectItem key={nav.id} value={nav.id}>
                                    {nav.name} ({nav.patientCount} patients)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={handleReject}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          "Creating..."
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Create Patient
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      ) : (
        <Card className="bg-card flex items-center justify-center">
          <CardContent className="text-center py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary mx-auto">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Select a referral from the list to review</p>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}
