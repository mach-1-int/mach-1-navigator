"use client"

import { useState, useEffect } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Database,
  FileCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
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
  Send,
  PhoneCall,
  TrendingUp,
  Filter,
  ShieldCheck,
  MessageSquare,
  CalendarClock,
} from "lucide-react"
import { toast } from "sonner"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { SimulatedHL7Feed } from "@/lib/referral-ingestion"
import {
  REFERRAL_PIPELINE_ORDER,
  INELIGIBILITY_REASON_LABELS,
  isTerminalReferralStatus,
  referralStatusMeta,
} from "@/lib/referral-pipeline"
import type { Patient, ProviderCommunication, Referral } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AMDSourceIndicator } from "@/components/amd-source-indicator"
import { HL7IngestDialog } from "@/components/supervisor/hl7-ingest-dialog"
import { EligibilityChecklist } from "@/components/supervisor/eligibility-checklist"
import { OutreachLog, OutreachSlaChip } from "@/components/supervisor/outreach-log"
import { ReferralFunnelView } from "@/components/supervisor/referral-funnel"
import { ProviderCommDialog } from "@/components/supervisor/provider-comm-dialog"

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
  const {
    navigators,
    patients,
    referrals,
    appointments,
    providerCommunications,
    acceptReferral,
    ingestReferral,
    confirmDecisionCapacity,
    scheduleIntakeVisit,
  } = useDemoData()
  const { navigateTo, currentUser, navigation } = useRole()
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(
    navigation.params?.referralId ?? null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hl7DialogOpen, setHl7DialogOpen] = useState(false)

  // Status-grouped pipeline list (working stages first, then closes)
  const groups = REFERRAL_PIPELINE_ORDER
    .map((status) => ({ status, items: referrals.filter((r) => r.status === status) }))
    .filter((g) => g.items.length > 0)
  const workingReferrals = referrals.filter((r) => !isTerminalReferralStatus(r.status))

  // Derived selection: fall back to the first working referral (pipeline order)
  // when nothing is explicitly selected or the selection no longer exists
  const selectedReferral =
    referrals.find((r) => r.id === selectedReferralId) ??
    groups.flatMap((g) => g.items).find((r) => !isTerminalReferralStatus(r.status)) ??
    groups[0]?.items[0]

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
    } else {
      toast.error("Patient has not agreed to services yet", {
        description: "Complete eligibility and outreach before conversion.",
      })
    }
  }

  const handleSimulateIncoming = () => {
    // Never re-produce someone already in the system: active/assigned
    // patients and referrals of ANY status (pending, accepted, rejected)
    // are excluded, so repeat demo runs always get a fresh person.
    const existingNames = [
      ...patients.map((p) => p.name),
      ...referrals.map((r) => r.patientName),
    ]
    const { parsed } = simulatedFeed.generateIncoming(existingNames)
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

  return (
    <Tabs defaultValue="pipeline" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-2">
            <Filter className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Funnel
          </TabsTrigger>
        </TabsList>
        {toolbar}
      </div>

      <TabsContent value="funnel" className="mt-0">
        <ReferralFunnelView />
      </TabsContent>

      <TabsContent value="pipeline" className="mt-0">
        {referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">All Caught Up!</h3>
            <p className="text-muted-foreground mt-2">No referrals in the pipeline.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[350px_1fr] h-[calc(100vh-230px)] min-h-0">
            {/* Left Pane - Status-Grouped Referral List */}
            <Card className="bg-card flex flex-col h-full">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    <CardTitle className="text-card-foreground">Referral Pipeline</CardTitle>
                  </div>
                  <Badge variant="secondary">{workingReferrals.length} working</Badge>
                </div>
                <CardDescription>Grouped by pipeline stage</CardDescription>
              </CardHeader>
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <CardContent className="space-y-4 pt-0 pb-4">
                    {groups.map(({ status, items }) => {
                      const meta = referralStatusMeta(status)
                      return (
                        <div key={status} className="space-y-2">
                          <div className="flex items-center justify-between sticky top-0 bg-card py-1">
                            <Badge variant="outline" className={cn("text-xs", meta.colorClasses)}>
                              {meta.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{items.length}</span>
                          </div>
                          {items.map((referral) => (
                            <ReferralListItem
                              key={referral.id}
                              referral={referral}
                              isSelected={referral.id === selectedReferral?.id}
                              onSelect={() => setSelectedReferralId(referral.id)}
                              onMatchAssign={() => navigateTo("intake-workspace", { referralId: referral.id })}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </CardContent>
                </ScrollArea>
              </div>
            </Card>

            {/* Right Pane - Raw Data + Per-Status Panel */}
            {selectedReferral && selectedReferral.rawData ? (
              <div className="grid gap-4 lg:grid-cols-2 overflow-hidden">
                <RawReferralData referral={selectedReferral} />
                <StatusPanel
                  referral={selectedReferral}
                  patients={patients}
                  appointments={appointments}
                  providerCommunications={providerCommunications}
                  form={form}
                  onSubmit={onSubmit}
                  isSubmitting={isSubmitting}
                  teamNavigators={teamNavigators}
                  onMatchAssign={() => navigateTo("intake-workspace", { referralId: selectedReferral.id })}
                  onViewPatient={(patientId) => navigateTo("patient-detail", { patientId })}
                  confirmDecisionCapacity={confirmDecisionCapacity}
                  scheduleIntakeVisit={scheduleIntakeVisit}
                />
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
        )}
      </TabsContent>
    </Tabs>
  )
}

// ============================================================================
// LIST ITEM
// ============================================================================

function ReferralListItem({
  referral,
  isSelected,
  onSelect,
  onMatchAssign,
}: {
  referral: Referral
  isSelected: boolean
  onSelect: () => void
  onMatchAssign: () => void
}) {
  const risk = getRiskBadge(referral.riskScore)
  const showSla = referral.status === "accepted" || (referral.status === "outreach" && referral.outreachAttempts.length === 0)
  const readyToAssign = referral.status === "agreed" || referral.status === "intake_scheduled"

  return (
    <div
      className={cn(
        "w-full rounded-lg border transition-all p-4",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        isTerminalReferralStatus(referral.status) && !isSelected && "opacity-70"
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-card-foreground truncate">{referral.patientName}</p>
              {isSelected && <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />}
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{referral.diagnosis}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={cn("text-xs", risk.className)}>
                {referral.riskScore === 3 && <AlertTriangle className="h-3 w-3 mr-1" />}
                {risk.label}
              </Badge>
              {showSla && <OutreachSlaChip referral={referral} />}
              {referral.status === "outreach" && referral.outreachAttempts.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <PhoneCall className="h-3 w-3" />
                  {referral.outreachAttempts.length}/7
                </Badge>
              )}
              <AMDSourceIndicator source={referral.source} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{referral.referralSource}</span>
        </div>
      </button>
      {readyToAssign && (
        <Button
          size="sm"
          variant="default"
          className="w-full mt-3 gap-2"
          onClick={(e) => {
            e.stopPropagation()
            onMatchAssign()
          }}
        >
          <Users className="h-4 w-4" />
          Match &amp; Assign
        </Button>
      )}
    </div>
  )
}

// ============================================================================
// RAW AMD DATA PANE
// ============================================================================

function RawReferralData({ referral }: { referral: Referral }) {
  const rawData = referral.rawData
  return (
    <Card className="bg-card overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle className="text-card-foreground">Source: AMD Integration</CardTitle>
        </div>
        <CardDescription>Raw HL7 data from {referral.source}</CardDescription>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4 pt-0">
          {/* Received timestamp */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Received: {new Date(referral.receivedAt).toLocaleString()}
          </div>

          <Separator />

          {/* Raw HL7v2 message (present when ingested via the HL7 adapter) */}
          {referral.rawHL7 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-card-foreground">Raw HL7v2 Message</span>
              </div>
              <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre">
                {referral.rawHL7.split(/\r\n|\r|\n/).join("\n")}
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
  )
}

// ============================================================================
// PER-STATUS RIGHT PANEL
// ============================================================================

function StatusPanel({
  referral,
  patients,
  appointments,
  providerCommunications,
  form,
  onSubmit,
  isSubmitting,
  teamNavigators,
  onMatchAssign,
  onViewPatient,
  confirmDecisionCapacity,
  scheduleIntakeVisit,
}: {
  referral: Referral
  patients: Patient[]
  appointments: { id: string; date: string; time: string }[]
  providerCommunications: ProviderCommunication[]
  form: UseFormReturn<IntakeFormValues>
  onSubmit: (data: IntakeFormValues) => Promise<void>
  isSubmitting: boolean
  teamNavigators: { id: string; name: string; patientCount: number }[]
  onMatchAssign: () => void
  onViewPatient: (patientId: string) => void
  confirmDecisionCapacity: (referralId: string, by: string) => void
  scheduleIntakeVisit: (referralId: string, date: string, time: string, navigatorId: string) => void
}) {
  switch (referral.status) {
    case "received":
      return <EligibilityChecklist referral={referral} />
    case "accepted":
    case "outreach":
      return <OutreachLog referral={referral} />
    case "agreed":
    case "intake_scheduled":
      return (
        <IntakeConversionForm
          referral={referral}
          appointments={appointments}
          providerCommunications={providerCommunications}
          form={form}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          teamNavigators={teamNavigators}
          onMatchAssign={onMatchAssign}
          confirmDecisionCapacity={confirmDecisionCapacity}
          scheduleIntakeVisit={scheduleIntakeVisit}
        />
      )
    default:
      return (
        <ClosedReferralSummary
          referral={referral}
          patients={patients}
          providerCommunications={providerCommunications}
          onViewPatient={onViewPatient}
        />
      )
  }
}

// ============================================================================
// COMMUNICATIONS HISTORY STRIP
// ============================================================================

const COMM_TYPE_SHORT_LABELS: Record<ProviderCommunication["type"], string> = {
  intake_notification: "Intake",
  exit_notification: "Exit",
  ineligible_notification: "Ineligible",
  unreachable_notification: "Unreachable",
}

function CommunicationsHistoryStrip({
  referral,
  providerCommunications,
}: {
  referral: Referral
  providerCommunications: ProviderCommunication[]
}) {
  const comms = providerCommunications
    .filter((c) => c.referralId === referral.id || (referral.patientId && c.patientId === referral.patientId))
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

  if (comms.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-card-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Communications
      </p>
      <div className="space-y-1.5">
        {comms.map((comm) => (
          <div key={comm.id} className="rounded-lg bg-muted/50 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-card-foreground truncate">{comm.subject}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {COMM_TYPE_SHORT_LABELS[comm.type]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5">
              {new Date(comm.sentAt).toLocaleString()} · {comm.sentByName}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// TERMINAL STATUS — READ-ONLY SUMMARY
// ============================================================================

function closedReferralCommType(referral: Referral): ProviderCommunication["type"] {
  if (referral.closeReason === "ineligible") return "ineligible_notification"
  if (referral.closeReason === "unreachable") return "unreachable_notification"
  return "exit_notification"
}

function ClosedReferralSummary({
  referral,
  patients,
  providerCommunications,
  onViewPatient,
}: {
  referral: Referral
  patients: Patient[]
  providerCommunications: ProviderCommunication[]
  onViewPatient: (patientId: string) => void
}) {
  const meta = referralStatusMeta(referral.status)
  const convertedPatient = referral.patientId ? patients.find((p) => p.id === referral.patientId) : undefined
  const isSuccess = referral.status === "converted"
  const [commDialogOpen, setCommDialogOpen] = useState(false)
  const commType = closedReferralCommType(referral)
  // declined referrals aren't a defined ProviderCommunication type — the dialog
  // only applies to ineligible/unreachable (playbook Phase-1 closes)
  const canNotify = referral.closeReason === "ineligible" || referral.closeReason === "unreachable"

  return (
    <Card className="bg-card overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <FileCheck className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle className="text-card-foreground">
              {isSuccess ? "Converted to Patient" : "Referral Closed"}
            </CardTitle>
          </div>
          <Badge variant="outline" className={cn("text-xs", meta.colorClasses)}>
            {meta.label}
          </Badge>
        </div>
        <CardDescription>Read-only pipeline record</CardDescription>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Received</span>
              <span className="text-card-foreground">{new Date(referral.receivedAt).toLocaleDateString()}</span>
            </div>
            {referral.acceptedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Eligibility accepted</span>
                <span className="text-card-foreground">{new Date(referral.acceptedAt).toLocaleDateString()}</span>
              </div>
            )}
            {referral.agreedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Patient agreed</span>
                <span className="text-card-foreground">{new Date(referral.agreedAt).toLocaleDateString()}</span>
              </div>
            )}
            {referral.closedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Closed</span>
                <span className="text-card-foreground">{new Date(referral.closedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {referral.eligibility && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-card-foreground">Eligibility Outcome</p>
                <div className="flex items-center gap-2">
                  {referral.eligibility.outcome === "eligible" ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      Eligible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                      Ineligible — {INELIGIBILITY_REASON_LABELS[referral.eligibility.ineligibilityReason ?? "insurance"]}
                    </Badge>
                  )}
                </div>
                {referral.eligibility.notes && (
                  <p className="text-xs text-muted-foreground">{referral.eligibility.notes}</p>
                )}
              </div>
            </>
          )}

          {referral.outreachAttempts.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-card-foreground">Outreach</p>
                <p className="text-xs text-muted-foreground">
                  {referral.outreachAttempts.length} attempt{referral.outreachAttempts.length === 1 ? "" : "s"} logged
                  {referral.status === "unreachable" && " — maximum reached, auto-closed"}
                </p>
              </div>
            </>
          )}

          <Separator />

          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border p-3",
              referral.providerNotifiedAt
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
            )}
          >
            <div className="flex items-center gap-2">
              <Send className={cn("h-4 w-4 shrink-0", referral.providerNotifiedAt ? "text-emerald-600" : "text-amber-600")} />
              <p className="text-xs text-muted-foreground">
                {referral.providerNotifiedAt
                  ? `Referring provider notified ${new Date(referral.providerNotifiedAt).toLocaleString()}`
                  : "Referring provider notification pending"}
              </p>
            </div>
            {canNotify && (
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0 bg-transparent" onClick={() => setCommDialogOpen(true)}>
                <Send className="h-3.5 w-3.5" />
                {referral.providerNotifiedAt ? "Resend" : "Notify"}
              </Button>
            )}
          </div>

          {canNotify && (
            <ProviderCommDialog
              open={commDialogOpen}
              onOpenChange={setCommDialogOpen}
              type={commType}
              entity={{ referralId: referral.id }}
              referral={referral}
            />
          )}

          <CommunicationsHistoryStrip referral={referral} providerCommunications={providerCommunications} />

          {isSuccess && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium text-card-foreground">
                {convertedPatient ? convertedPatient.name : referral.patientName} is now an active patient record
              </p>
              {convertedPatient && (
                <Button size="sm" variant="outline" className="w-full gap-2 bg-transparent" onClick={() => onViewPatient(convertedPatient.id)}>
                  <User className="h-4 w-4" />
                  View Patient Profile
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  )
}

// ============================================================================
// AGREED / INTAKE_SCHEDULED — CONVERSION FORM (the golden thread)
// ============================================================================

function IntakeConversionForm({
  referral,
  appointments,
  providerCommunications,
  form,
  onSubmit,
  isSubmitting,
  teamNavigators,
  onMatchAssign,
  confirmDecisionCapacity,
  scheduleIntakeVisit,
}: {
  referral: Referral
  appointments: { id: string; date: string; time: string }[]
  providerCommunications: ProviderCommunication[]
  form: UseFormReturn<IntakeFormValues>
  onSubmit: (data: IntakeFormValues) => Promise<void>
  isSubmitting: boolean
  teamNavigators: { id: string; name: string; patientCount: number }[]
  onMatchAssign: () => void
  confirmDecisionCapacity: (referralId: string, by: string) => void
  scheduleIntakeVisit: (referralId: string, date: string, time: string, navigatorId: string) => void
}) {
  const { currentUser } = useRole()
  // Seeded intake_scheduled referrals may carry no intakeAppointmentId —
  // fall back to a generic "on the books" note when the link is missing
  const intakeAppointment = referral.intakeAppointmentId
    ? appointments.find((a) => a.id === referral.intakeAppointmentId)
    : undefined

  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [scheduleNavigator, setScheduleNavigator] = useState("")

  const capacityConfirmed = !!referral.decisionCapacityConfirmed

  const handleConfirmCapacity = () => {
    if (!currentUser) return
    confirmDecisionCapacity(referral.id, currentUser.id)
    toast.success("Decision-making capacity confirmed", {
      description: "SOP 1.7 — Intake 1 can now be scheduled.",
    })
  }

  const handleScheduleIntake = () => {
    if (!scheduleDate || !scheduleTime || !scheduleNavigator) {
      toast.error("Date, time, and navigator are required to schedule Intake 1")
      return
    }
    scheduleIntakeVisit(referral.id, scheduleDate, scheduleTime, scheduleNavigator)
  }

  return (
    <Card className="bg-card overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Convert to Patient</CardTitle>
          </div>
          <Badge variant="outline" className={cn("text-xs", referralStatusMeta(referral.status).colorClasses)}>
            {referralStatusMeta(referral.status).label}
          </Badge>
        </div>
        <CardDescription>
          Patient agreed to services — review and edit before creating the record
        </CardDescription>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="pt-0 space-y-4">
          {/* SOP 1.7 — decision-making capacity gate, required before Intake 1 scheduling */}
          <div
            className={cn(
              "rounded-lg border p-3 space-y-2",
              capacityConfirmed
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
            )}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id={`capacity-${referral.id}`}
                checked={capacityConfirmed}
                disabled={capacityConfirmed}
                onCheckedChange={(checked) => checked && handleConfirmCapacity()}
              />
              <label htmlFor={`capacity-${referral.id}`} className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                Confirm decision-making capacity (SOP 1.7)
              </label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {capacityConfirmed
                ? `Confirmed ${new Date(referral.decisionCapacityConfirmed!.confirmedAt).toLocaleString()}`
                : "Required before Intake 1 can be scheduled."}
            </p>
          </div>

          {referral.status === "intake_scheduled" ? (
            <div className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/50 dark:border-cyan-900 dark:bg-cyan-950/20 p-3">
              <Calendar className="h-4 w-4 text-cyan-600 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {intakeAppointment
                  ? `Intake 1 scheduled ${new Date(`${intakeAppointment.date}T12:00:00`).toLocaleDateString()} at ${intakeAppointment.time}`
                  : "Intake 1 is on the books — appointment details pending sync"}
              </p>
            </div>
          ) : (
            <div className={cn("rounded-lg border p-3 space-y-2", !capacityConfirmed && "opacity-60")}>
              <p className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                Schedule Intake 1
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} disabled={!capacityConfirmed} />
                <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} disabled={!capacityConfirmed} />
              </div>
              <Select value={scheduleNavigator} onValueChange={setScheduleNavigator} disabled={!capacityConfirmed}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign navigator…" />
                </SelectTrigger>
                <SelectContent>
                  {teamNavigators.map((nav) => (
                    <SelectItem key={nav.id} value={nav.id}>
                      {nav.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="w-full gap-2 bg-transparent"
                disabled={!capacityConfirmed}
                onClick={handleScheduleIntake}
              >
                <CalendarClock className="h-4 w-4" />
                Schedule Intake 1
              </Button>
            </div>
          )}

          <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={onMatchAssign}>
            <Users className="h-4 w-4" />
            Match &amp; Assign (Smart Matching)
          </Button>

          <CommunicationsHistoryStrip referral={referral} providerCommunications={providerCommunications} />

          <Separator />

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
              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
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
  )
}
