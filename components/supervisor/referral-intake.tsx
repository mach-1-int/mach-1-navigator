"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  ArrowLeft,
  ArrowRight,
  Database,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Building2,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Stethoscope,
  CreditCard
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import type { Referral, Patient } from "@/lib/types"
import { cn } from "@/lib/utils"

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

interface ReferralIntakeProps {
  referralId: string
}

export function ReferralIntake({ referralId }: ReferralIntakeProps) {
  const { referrals, navigators, acceptReferral, rejectReferral } = useDemoData()
  const { goBack, navigateTo } = useRole()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const referral = referrals.find((r) => r.id === referralId)

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

  // Populate form with referral data when available
  useEffect(() => {
    if (referral?.rawData) {
      const rawData = referral.rawData
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
        riskLevel: String(referral.riskScore) as "1" | "2" | "3",
        assignedNavigator: "",
      })
    }
  }, [referral, form])

  if (!referral) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Referral not found</p>
        <Button variant="outline" onClick={goBack} className="mt-4 bg-transparent">
          Go Back
        </Button>
      </div>
    )
  }

  if (referral.status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
        <p className="text-muted-foreground">This referral has already been processed</p>
        <Badge variant="secondary" className="mt-2">
          Status: {referral.status}
        </Badge>
        <Button variant="outline" onClick={goBack} className="mt-4 bg-transparent">
          Go Back
        </Button>
      </div>
    )
  }

  const onSubmit = async (data: IntakeFormValues) => {
    setIsSubmitting(true)

    // Transform form data to Patient partial
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

    const newPatient = acceptReferral(referralId, patientData, data.assignedNavigator)

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsSubmitting(false)

    if (newPatient) {
      // Navigate to the newly created patient profile
      navigateTo("patient-detail", { patientId: newPatient.id })
    }
  }

  const handleReject = () => {
    rejectReferral(referralId)
    goBack()
  }

  const rawData = referral.rawData

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
            <h2 className="text-2xl font-bold text-card-foreground">Referral Intake</h2>
            <p className="text-muted-foreground">Review and accept referral from {referral.source}</p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            referral.riskScore === 3 && "bg-red-100 text-red-700",
            referral.riskScore === 2 && "bg-amber-100 text-amber-700",
            referral.riskScore === 1 && "bg-emerald-100 text-emerald-700"
          )}
        >
          Risk Level {referral.riskScore}
        </Badge>
      </div>

      {/* Split Screen Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Pane - Raw AMD Data */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Source: AMD Integration</CardTitle>
            </div>
            <CardDescription>Raw HL7 data feed from {referral.source}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Received timestamp */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Received: {new Date(referral.receivedAt).toLocaleString()}
            </div>

            <Separator />

            {/* PID Segment - Patient Identification */}
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

            {/* DG1 Segment - Diagnosis */}
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

            {/* IN1 Segment - Insurance */}
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

            {/* PV1 Segment - Visit Info */}
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
        </Card>

        {/* Right Pane - Mach 1 Intake Form */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Mach 1 Intake Form</CardTitle>
            </div>
            <CardDescription>Review and edit patient information before creating record</CardDescription>
          </CardHeader>
          <CardContent>
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
                          <FormLabel>ICD Codes (comma-separated)</FormLabel>
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
                            {navigators.map((nav) => (
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
                    Reject Referral
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
                        Create Patient Record
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
