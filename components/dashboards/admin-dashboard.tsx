"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { useToast } from "@/hooks/use-toast"
import {
  DollarSign,
  Settings,
  History,
  Edit2,
  Check,
  X,
  Shield,
  FileText,
  LogIn,
  LogOut,
  UserPlus,
  ClipboardList,
  AlertCircle,
  BookText,
  Building2,
  Calendar,
  Plus,
  RotateCcw,
  ListChecks,
  FileSignature,
  Pill,
  Megaphone,
  Send,
  GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditAction, OrganizationSettings, Payer, RemarkClassification, RemarkCode } from "@/lib/types"
import { classificationMeta } from "@/components/billing/denial-work-queue"

// Action type configuration for audit log display
const actionConfig: Record<AuditAction, { label: string; icon: typeof Edit2; color: string }> = {
  check_in: { label: "Check In", icon: LogIn, color: "bg-blue-100 text-blue-700 border-blue-200" },
  check_out: { label: "Check Out", icon: LogOut, color: "bg-green-100 text-green-700 border-green-200" },
  note_created: { label: "Note Created", icon: FileText, color: "bg-purple-100 text-purple-700 border-purple-200" },
  note_updated: { label: "Note Updated", icon: Edit2, color: "bg-purple-100 text-purple-700 border-purple-200" },
  payer_rate_updated: { label: "Rate Updated", icon: DollarSign, color: "bg-amber-100 text-amber-700 border-amber-200" },
  payer_updated: { label: "Payer Updated", icon: DollarSign, color: "bg-amber-100 text-amber-700 border-amber-200" },
  care_plan_applied: { label: "Care Plan", icon: ClipboardList, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  referral_accepted: { label: "Referral Accepted", icon: Check, color: "bg-green-100 text-green-700 border-green-200" },
  referral_rejected: { label: "Referral Rejected", icon: X, color: "bg-red-100 text-red-700 border-red-200" },
  referral_ingested: { label: "Referral Received", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-200" },
  assessment_completed: { label: "Assessment", icon: ClipboardList, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  appointment_scheduled: { label: "Scheduled", icon: Calendar, color: "bg-blue-100 text-blue-700 border-blue-200" },
  appointment_cancelled: { label: "Cancelled", icon: AlertCircle, color: "bg-red-100 text-red-700 border-red-200" },
  patient_created: { label: "Patient Created", icon: UserPlus, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  login: { label: "Login", icon: LogIn, color: "bg-slate-100 text-slate-700 border-slate-200" },
  logout: { label: "Logout", icon: LogOut, color: "bg-slate-100 text-slate-700 border-slate-200" },
  claim_exported: { label: "Claim Exported", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-200" },
  claim_status_changed: { label: "Claim Status", icon: History, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  remittance_imported: { label: "Remittance", icon: DollarSign, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  remark_code_updated: { label: "Remark Code", icon: Edit2, color: "bg-amber-100 text-amber-700 border-amber-200" },
  org_settings_updated: { label: "Org Settings", icon: Settings, color: "bg-slate-100 text-slate-700 border-slate-200" },
  sos_triggered: { label: "SOS Triggered", icon: AlertCircle, color: "bg-red-100 text-red-700 border-red-200" },
  sos_acknowledged: { label: "SOS Acknowledged", icon: Check, color: "bg-orange-100 text-orange-700 border-orange-200" },
  sos_resolved: { label: "SOS Resolved", icon: Check, color: "bg-green-100 text-green-700 border-green-200" },
  // Journey engine (Gellert WorkFlow2025)
  eligibility_completed: { label: "Eligibility Check", icon: ClipboardList, color: "bg-blue-100 text-blue-700 border-blue-200" },
  outreach_attempt_logged: { label: "Outreach Attempt", icon: UserPlus, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  referral_closed: { label: "Referral Closed", icon: X, color: "bg-slate-100 text-slate-700 border-slate-200" },
  intake_visit_completed: { label: "Intake Visit", icon: Check, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  intake_no_show: { label: "Intake No-Show", icon: AlertCircle, color: "bg-amber-100 text-amber-700 border-amber-200" },
  provider_notified: { label: "Provider Notified", icon: Building2, color: "bg-blue-100 text-blue-700 border-blue-200" },
  graduation_flagged: { label: "Graduation Flagged", icon: ClipboardList, color: "bg-violet-100 text-violet-700 border-violet-200" },
  graduation_confirmed: { label: "Graduation Confirmed", icon: Check, color: "bg-violet-100 text-violet-700 border-violet-200" },
  telenav_check_in: { label: "Telenav Check-In", icon: Calendar, color: "bg-violet-100 text-violet-700 border-violet-200" },
  patient_reengaged: { label: "Patient Re-Engaged", icon: UserPlus, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  program_exited: { label: "Program Exited", icon: LogOut, color: "bg-slate-100 text-slate-700 border-slate-200" },
  // Gellert billing mode
  charge_slip_signed: { label: "Charge Slip Signed", icon: FileText, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  remittance_pended: { label: "Remittance Pended", icon: AlertCircle, color: "bg-amber-100 text-amber-700 border-amber-200" },
  remittance_reprocessed: { label: "Remittance Reprocessed", icon: RotateCcw, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  denial_work_status_changed: { label: "Denial Work Status", icon: History, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  // Gellert ops blitz (tasks / documents / meds / escalations / comms / training)
  task_completed: { label: "Task Completed", icon: ListChecks, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  task_dismissed: { label: "Task Dismissed", icon: X, color: "bg-slate-100 text-slate-700 border-slate-200" },
  document_completed: { label: "Document Completed", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-200" },
  document_signed: { label: "Document Signed", icon: FileSignature, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  med_reconciliation_recorded: { label: "Med Reconciliation", icon: Pill, color: "bg-violet-100 text-violet-700 border-violet-200" },
  escalation_raised: { label: "Escalation Raised", icon: Megaphone, color: "bg-red-100 text-red-700 border-red-200" },
  escalation_acknowledged: { label: "Escalation Acknowledged", icon: Check, color: "bg-orange-100 text-orange-700 border-orange-200" },
  escalation_resolved: { label: "Escalation Resolved", icon: Check, color: "bg-green-100 text-green-700 border-green-200" },
  provider_comm_sent: { label: "Provider Comm Sent", icon: Send, color: "bg-blue-100 text-blue-700 border-blue-200" },
  onboarding_milestone_completed: { label: "Onboarding Milestone", icon: GraduationCap, color: "bg-violet-100 text-violet-700 border-violet-200" },
}

/** Blank form used before the org settings load into the edit dialog */
type OrgFormFields = {
  organizationName: string
  npi: string
  taxId: string
  taxonomyCode: string
  submitterId: string
  supervisingProviderName: string
  supervisingProviderNpi: string
  street: string
  city: string
  state: string
  zip: string
  contactPhone: string
}

function orgSettingsToForm(settings: OrganizationSettings): OrgFormFields {
  return {
    organizationName: settings.organizationName,
    npi: settings.npi,
    taxId: settings.taxId,
    taxonomyCode: settings.taxonomyCode,
    submitterId: settings.submitterId,
    supervisingProviderName: settings.supervisingProvider.name,
    supervisingProviderNpi: settings.supervisingProvider.npi,
    street: settings.address.street,
    city: settings.address.city,
    state: settings.address.state,
    zip: settings.address.zip,
    contactPhone: settings.contactPhone,
  }
}

export function AdminDashboard() {
  const {
    payers,
    auditLogs,
    updatePayer,
    calculateDynamicRevenue,
    resetDemo,
    remarkCodes,
    organizationSettings,
    addRemarkCode,
    updateRemarkCode,
    updateOrganizationSettings,
  } = useDemoData()
  const { currentUser, navigation, logout } = useRole()
  const { toast } = useToast()

  const [editingRate, setEditingRate] = useState<Payer | null>(null)
  const [editValue, setEditValue] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  // Remark code dialogs
  const [editingRemark, setEditingRemark] = useState<RemarkCode | null>(null)
  const [remarkCodeValue, setRemarkCodeValue] = useState("")
  const [remarkDescriptionValue, setRemarkDescriptionValue] = useState("")
  const [addRemarkOpen, setAddRemarkOpen] = useState(false)
  const [newRemarkType, setNewRemarkType] = useState<"CARC" | "RARC">("CARC")
  const [remarkClassificationValue, setRemarkClassificationValue] =
    useState<RemarkClassification>("informational")

  // Organization settings dialog
  const [orgDialogOpen, setOrgDialogOpen] = useState(false)
  const [orgForm, setOrgForm] = useState<OrgFormFields>(() =>
    orgSettingsToForm(organizationSettings)
  )

  // Determine which tab to show based on navigation
  const activeTab = navigation.view === "admin-audit-log" ? "audit" : "rates"

  // Controlled tab state, synced to sidebar navigation via the "adjust state
  // during render" previous-value pattern (no setState-in-useEffect).
  const [tab, setTab] = useState(activeTab)
  const [prevView, setPrevView] = useState(navigation.view)
  if (navigation.view !== prevView) {
    setPrevView(navigation.view)
    setTab(activeTab)
  }

  const handleEditClick = (rate: Payer) => {
    setEditingRate(rate)
    setEditValue(rate.ratePerUnit.toFixed(2))
    setDialogOpen(true)
  }

  const handleSaveRate = () => {
    if (!editingRate || !currentUser) return

    const newRate = parseFloat(editValue)
    if (isNaN(newRate) || newRate < 0) {
      toast({
        title: "Invalid Rate",
        description: "Please enter a valid positive number",
        variant: "destructive",
      })
      return
    }

    updatePayer(editingRate.id, { ratePerUnit: newRate }, currentUser.id, currentUser.name)

    toast({
      title: "Rate Updated",
      description: `${editingRate.name} rate updated to $${newRate.toFixed(2)}`,
    })

    setDialogOpen(false)
    setEditingRate(null)
    setEditValue("")
  }

  const dynamicRevenue = calculateDynamicRevenue()

  const handleResetDemo = () => {
    resetDemo()
    toast({
      title: "Demo Data Reset",
      description: "All data has been restored to initial state",
    })
    setResetDialogOpen(false)
    logout() // Return to role selector
  }

  // ---- Remark code handlers ----

  const handleEditRemarkClick = (code: RemarkCode) => {
    setEditingRemark(code)
    setRemarkCodeValue(code.code)
    setRemarkDescriptionValue(code.description)
    setRemarkClassificationValue(code.classification ?? "informational")
  }

  const handleSaveRemark = () => {
    if (!editingRemark || !currentUser) return
    if (!remarkCodeValue.trim() || !remarkDescriptionValue.trim()) {
      toast({
        title: "Missing Fields",
        description: "Code and description are required",
        variant: "destructive",
      })
      return
    }
    updateRemarkCode(
      editingRemark.id,
      {
        code: remarkCodeValue.trim(),
        description: remarkDescriptionValue.trim(),
        classification: remarkClassificationValue,
      },
      currentUser.id,
      currentUser.name
    )
    toast({
      title: "Remark Code Updated",
      description: `${editingRemark.type} ${remarkCodeValue.trim()} saved`,
    })
    setEditingRemark(null)
  }

  const handleAddRemarkClick = () => {
    setNewRemarkType("CARC")
    setRemarkCodeValue("")
    setRemarkDescriptionValue("")
    setRemarkClassificationValue("informational")
    setAddRemarkOpen(true)
  }

  const handleAddRemark = () => {
    if (!currentUser) return
    if (!remarkCodeValue.trim() || !remarkDescriptionValue.trim()) {
      toast({
        title: "Missing Fields",
        description: "Code and description are required",
        variant: "destructive",
      })
      return
    }
    addRemarkCode(
      {
        type: newRemarkType,
        code: remarkCodeValue.trim(),
        description: remarkDescriptionValue.trim(),
        classification: remarkClassificationValue,
      },
      currentUser.id,
      currentUser.name
    )
    toast({
      title: "Remark Code Added",
      description: `${newRemarkType} ${remarkCodeValue.trim()} added to the dictionary`,
    })
    setAddRemarkOpen(false)
  }

  // ---- Organization settings handlers ----

  const handleEditOrgClick = () => {
    setOrgForm(orgSettingsToForm(organizationSettings))
    setOrgDialogOpen(true)
  }

  const handleSaveOrg = () => {
    if (!currentUser) return
    updateOrganizationSettings(
      {
        organizationName: orgForm.organizationName.trim(),
        npi: orgForm.npi.trim(),
        taxId: orgForm.taxId.trim(),
        taxonomyCode: orgForm.taxonomyCode.trim(),
        submitterId: orgForm.submitterId.trim(),
        contactPhone: orgForm.contactPhone.trim(),
        address: {
          street: orgForm.street.trim(),
          city: orgForm.city.trim(),
          state: orgForm.state.trim(),
          zip: orgForm.zip.trim(),
        },
        supervisingProvider: {
          name: orgForm.supervisingProviderName.trim(),
          npi: orgForm.supervisingProviderNpi.trim(),
        },
      },
      currentUser.id,
      currentUser.name
    )
    toast({
      title: "Organization Settings Updated",
      description: "Claim exports will use the updated billing provider details",
    })
    setOrgDialogOpen(false)
  }

  const setOrgField = (field: keyof OrgFormFields, value: string) => {
    setOrgForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Governance settings and system activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setResetDialogOpen(true)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Demo Data
          </Button>
          <Badge variant="outline" className="text-primary border-primary">
            <Settings className="h-3 w-3 mr-1" />
            System Admin
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Payer Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{payers.length}</p>
            <p className="text-xs text-muted-foreground">Configured payers</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dynamic Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">${dynamicRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">From completed visits</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Audit Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{auditLogs.length}</p>
            <p className="text-xs text-muted-foreground">System activities logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="rates" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payer Rates
          </TabsTrigger>
          <TabsTrigger value="remarks" className="flex items-center gap-2">
            <BookText className="h-4 w-4" />
            Remark Codes
          </TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Payer Rates Tab */}
        <TabsContent value="rates">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Payer Rate Configuration</CardTitle>
              <CardDescription>
                Manage revenue rates per completed visit for each payer. Changes affect Executive Dashboard revenue calculations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Payer Name</TableHead>
                    <TableHead className="text-right text-muted-foreground">Rate Per Unit</TableHead>
                    <TableHead className="text-muted-foreground">Last Updated</TableHead>
                    <TableHead className="text-right text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payers.map((rate) => (
                    <TableRow key={rate.id} className="border-border">
                      <TableCell className="font-medium text-card-foreground">
                        {rate.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-lg font-semibold text-emerald-600">
                          ${rate.ratePerUnit.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(rate.lastUpdated).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(rate)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remark Codes Tab */}
        <TabsContent value="remarks">
          <Card className="bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-card-foreground">Remark Code Dictionary</CardTitle>
                  <CardDescription>
                    CARC/RARC adjudication codes used when posting 835 remittances and denials
                  </CardDescription>
                </div>
                <Button onClick={handleAddRemarkClick}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Code
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground w-24">Type</TableHead>
                    <TableHead className="text-muted-foreground w-24">Code</TableHead>
                    <TableHead className="text-muted-foreground">Description</TableHead>
                    <TableHead className="text-muted-foreground w-32">Classification</TableHead>
                    <TableHead className="text-right text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remarkCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No remark codes configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    remarkCodes.map((code) => (
                      <TableRow key={code.id} className="border-border">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              code.type === "CARC"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            )}
                          >
                            {code.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-card-foreground">
                          {code.code}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {code.description}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(classificationMeta(code.classification).colorClasses)}
                          >
                            {classificationMeta(code.classification).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRemarkClick(code)}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card className="bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-card-foreground">Organization Settings</CardTitle>
                  <CardDescription>
                    Billing provider identity used by CSV and 837P claim exports
                  </CardDescription>
                </div>
                <Button onClick={handleEditOrgClick}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Organization Name</p>
                    <p className="font-medium text-card-foreground">
                      {organizationSettings.organizationName}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">NPI</p>
                      <p className="font-mono text-card-foreground">{organizationSettings.npi}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tax ID</p>
                      <p className="font-mono text-card-foreground">
                        {organizationSettings.taxId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Taxonomy Code</p>
                      <p className="font-mono text-card-foreground">
                        {organizationSettings.taxonomyCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Submitter ID</p>
                      <p className="font-mono text-card-foreground">
                        {organizationSettings.submitterId}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Supervising Provider</p>
                    <p className="font-medium text-card-foreground">
                      {organizationSettings.supervisingProvider.name}{" "}
                      <span className="font-mono text-sm text-muted-foreground">
                        (NPI {organizationSettings.supervisingProvider.npi})
                      </span>
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="text-card-foreground">
                      {organizationSettings.address.street}
                      <br />
                      {organizationSettings.address.city}, {organizationSettings.address.state}{" "}
                      {organizationSettings.address.zip}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Phone</p>
                    <p className="text-card-foreground">{organizationSettings.contactPhone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="text-card-foreground">
                      {new Date(organizationSettings.lastUpdated).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">System Activity Log</CardTitle>
              <CardDescription>
                Chronological record of all system events and user actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No activity logged yet
                  </p>
                ) : (
                  auditLogs.map((log) => {
                    const config = actionConfig[log.action]
                    const Icon = config?.icon || History

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30"
                      >
                        {/* Timestamp */}
                        <div className="text-xs text-muted-foreground whitespace-nowrap w-32">
                          <p className="font-medium">
                            {new Date(log.timestamp).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p>
                            {new Date(log.timestamp).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        {/* User Info */}
                        <div className="flex-shrink-0 w-36">
                          <p className="font-medium text-card-foreground truncate">
                            {log.userName}
                          </p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.userRole}
                          </Badge>
                        </div>

                        {/* Action Badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "flex items-center gap-1 flex-shrink-0",
                            config?.color
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {config?.label || log.action}
                        </Badge>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          {log.details && (
                            <p className="text-sm text-muted-foreground truncate">
                              {log.details}
                            </p>
                          )}
                          {log.entityType && (
                            <p className="text-xs text-muted-foreground/70">
                              {log.entityType}: {log.entityId}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Rate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payer Rate</DialogTitle>
            <DialogDescription>
              Update the rate per completed visit for {editingRate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payer</label>
              <p className="text-lg font-semibold">{editingRate?.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate Per Unit ($)</label>
              <div className="flex items-center gap-2">
                <span className="text-lg text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="font-mono text-lg"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Current rate: ${editingRate?.ratePerUnit.toFixed(2)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRate}>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Remark Code Dialog */}
      <Dialog open={editingRemark !== null} onOpenChange={(open) => !open && setEditingRemark(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Remark Code</DialogTitle>
            <DialogDescription>
              Update the {editingRemark?.type} code definition
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <p className="font-semibold">{editingRemark?.type}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input
                value={remarkCodeValue}
                onChange={(e) => setRemarkCodeValue(e.target.value)}
                className="font-mono"
                placeholder="e.g., 45 or N30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={remarkDescriptionValue}
                onChange={(e) => setRemarkDescriptionValue(e.target.value)}
                placeholder="Description shown on remittance details"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Classification</label>
              <Select
                value={remarkClassificationValue}
                onValueChange={(v) => setRemarkClassificationValue(v as RemarkClassification)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informational">Informational</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="denial">Denial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRemark(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRemark}>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Remark Code Dialog */}
      <Dialog open={addRemarkOpen} onOpenChange={setAddRemarkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Remark Code</DialogTitle>
            <DialogDescription>
              Add a CARC or RARC code to the adjudication dictionary
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={newRemarkType}
                onValueChange={(v) => setNewRemarkType(v as "CARC" | "RARC")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CARC">CARC — Claim Adjustment Reason Code</SelectItem>
                  <SelectItem value="RARC">RARC — Remittance Advice Remark Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input
                value={remarkCodeValue}
                onChange={(e) => setRemarkCodeValue(e.target.value)}
                className="font-mono"
                placeholder="e.g., 45 or N30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={remarkDescriptionValue}
                onChange={(e) => setRemarkDescriptionValue(e.target.value)}
                placeholder="Description shown on remittance details"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Classification</label>
              <Select
                value={remarkClassificationValue}
                onValueChange={(v) => setRemarkClassificationValue(v as RemarkClassification)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informational">Informational</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="denial">Denial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRemarkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRemark}>
              <Plus className="h-4 w-4 mr-2" />
              Add Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Settings Dialog */}
      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Organization Settings</DialogTitle>
            <DialogDescription>
              Billing provider details stamped onto exported claims (CSV and 837P)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization Name</label>
              <Input
                value={orgForm.organizationName}
                onChange={(e) => setOrgField("organizationName", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">NPI</label>
                <Input
                  value={orgForm.npi}
                  onChange={(e) => setOrgField("npi", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tax ID</label>
                <Input
                  value={orgForm.taxId}
                  onChange={(e) => setOrgField("taxId", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Taxonomy Code</label>
                <Input
                  value={orgForm.taxonomyCode}
                  onChange={(e) => setOrgField("taxonomyCode", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Submitter ID</label>
                <Input
                  value={orgForm.submitterId}
                  onChange={(e) => setOrgField("submitterId", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Supervising Provider Name</label>
                <Input
                  value={orgForm.supervisingProviderName}
                  onChange={(e) => setOrgField("supervisingProviderName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Supervising Provider NPI</label>
                <Input
                  value={orgForm.supervisingProviderNpi}
                  onChange={(e) => setOrgField("supervisingProviderNpi", e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Street Address</label>
              <Input
                value={orgForm.street}
                onChange={(e) => setOrgField("street", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <Input
                  value={orgForm.city}
                  onChange={(e) => setOrgField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State</label>
                <Input
                  value={orgForm.state}
                  onChange={(e) => setOrgField("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ZIP</label>
                <Input
                  value={orgForm.zip}
                  onChange={(e) => setOrgField("zip", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Phone</label>
              <Input
                value={orgForm.contactPhone}
                onChange={(e) => setOrgField("contactPhone", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOrg}>
              <Check className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Demo Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              Reset Demo Data
            </DialogTitle>
            <DialogDescription>
              This will clear all data and restore the initial demo state. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              The following will be reset:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>All patient data and appointments</li>
              <li>Care plans and goal tracking</li>
              <li>Payer rates to default values</li>
              <li>Audit logs and notes</li>
              <li>All referrals and messages</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetDemo}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
