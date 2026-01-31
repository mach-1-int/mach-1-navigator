"use client"

import React from "react"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Home,
  Video,
  PhoneCall,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  User,
  Users,
  FileText,
  RefreshCw,
  ArrowLeft,
  Bell,
  Send,
  ClipboardCheck,
  Plus,
  X,
  Stethoscope,
  Edit,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AMDSourceIndicator } from "@/components/amd-source-indicator"
import { CarePlanTab } from "@/components/patient/care-plan-tab"
import { NoteBuilder } from "@/components/notes/note-builder"
import { IntakeForm } from "@/components/intake/intake-form"
import { BillingProgressBar } from "@/components/patient/billing-progress-bar"
import { NoteDetailModal } from "@/components/notes/note-detail-modal"
import { NotesSplitView } from "@/components/notes/notes-split-view"
import { ExpandableNoteList } from "@/components/notes/expandable-note-card"
import type { Patient, AdverseEvent, Appointment, PatientNote } from "@/lib/types"

// Extended patient data with contact info (mocked)
interface PatientContactInfo {
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  emergencyContact: string
  emergencyPhone: string
}

// Timeline event type
interface TimelineEvent {
  id: string
  date: string
  time?: string
  type: "appointment" | "adverse_event" | "note" | "milestone"
  title: string
  description: string
  status?: string
  icon: React.ReactNode
}

// Mock contact info
const mockContactInfo: Record<string, PatientContactInfo> = {
  pt1: {
    phone: "(602) 555-0142",
    email: "james.t@email.com",
    address: "4521 W Glendale Ave",
    city: "Phoenix",
    state: "AZ",
    zip: "85301",
    emergencyContact: "Mary Thompson (Spouse)",
    emergencyPhone: "(602) 555-0143",
  },
  pt2: {
    phone: "(520) 555-0198",
    email: "dorothy.m@email.com",
    address: "1823 E Broadway Blvd",
    city: "Tucson",
    state: "AZ",
    zip: "85719",
    emergencyContact: "Carlos Martinez (Son)",
    emergencyPhone: "(520) 555-0199",
  },
  pt3: {
    phone: "(480) 555-0167",
    email: "robert.w@email.com",
    address: "7890 N Scottsdale Rd",
    city: "Scottsdale",
    state: "AZ",
    zip: "85253",
    emergencyContact: "Patricia Wilson (Daughter)",
    emergencyPhone: "(480) 555-0168",
  },
  pt4: {
    phone: "(623) 555-0134",
    email: "helen.g@email.com",
    address: "2456 W Bell Rd",
    city: "Surprise",
    state: "AZ",
    zip: "85374",
    emergencyContact: "Michael Garcia (Son)",
    emergencyPhone: "(623) 555-0135",
  },
  pt5: {
    phone: "(602) 555-0189",
    email: "frank.a@email.com",
    address: "9012 S Central Ave",
    city: "Phoenix",
    state: "AZ",
    zip: "85042",
    emergencyContact: "Susan Anderson (Daughter)",
    emergencyPhone: "(602) 555-0190",
  },
}

function getRiskLevelBadge(level: 1 | 2 | 3) {
  const variants = {
    1: { label: "L1 - Low Risk", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
    2: { label: "L2 - Medium Risk", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
    3: { label: "L3 - High Risk", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  }
  return variants[level]
}

function getAppointmentIcon(type: Appointment["type"]) {
  const icons = {
    home_visit: <Home className="h-4 w-4" />,
    phone_call: <PhoneCall className="h-4 w-4" />,
    video_call: <Video className="h-4 w-4" />,
    clinic: <Building2 className="h-4 w-4" />,
  }
  return icons[type]
}

function calculateAge(dob: string): number {
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface PatientProfileProps {
  patientId: string
}

export function PatientProfile({ patientId }: PatientProfileProps) {
  const { goBack, currentUser, navigateTo } = useRole()
  const { patients, navigators, adverseEvents, getPatientNotes, addNote, sendNudge, getPatientIntake, updatePatient } = useDemoData()
  const [noteText, setNoteText] = useState("")
  const [noteType, setNoteType] = useState<PatientNote["type"]>("general")
  const [nudgeOpen, setNudgeOpen] = useState(false)
  const [nudgeText, setNudgeText] = useState("")
  const [noteBuilderOpen, setNoteBuilderOpen] = useState(false)
  const [intakeFormOpen, setIntakeFormOpen] = useState(false)
  const [selectedNote, setSelectedNote] = useState<PatientNote | null>(null)
  const [icdDialogOpen, setIcdDialogOpen] = useState(false)
  const [newIcdCode, setNewIcdCode] = useState("")
  const [newDiagnosis, setNewDiagnosis] = useState("")
  
  // Check if user is a supervisor
  const isSupervisor = currentUser?.role === "supervisor"
  
  // Get data from demo context
  const patient = patients.find((p) => p.id === patientId)
  const contactInfo = mockContactInfo[patientId]
  const notes = getPatientNotes(patientId)
  const patientAdverseEvents = adverseEvents.filter((ae) => ae.patientId === patientId)
  const patientIntake = getPatientIntake(patientId)
  
  // Get supervisor from mock for now (not in demo context)
  const supervisorData: Record<string, { id: string; name: string; region: string }> = {
    sup1: { id: "sup1", name: "Maria Santos", region: "Phoenix Metro" },
    sup2: { id: "sup2", name: "Michael Thompson", region: "Tucson" },
    sup3: { id: "sup3", name: "Lisa Chen", region: "Mesa/Tempe" },
  }
  
  const handleAddNote = () => {
    if (noteText.trim() && patient) {
      const navigator = navigators.find((n) => n.id === patient.assignedNavigator)
      addNote(
        patientId,
        noteText.trim(),
        noteType,
        navigator?.id || "nav1",
        navigator?.name || "Navigator",
        "navigator"
      )
      setNoteText("")
    }
  }

  const handleSendNudge = () => {
    if (nudgeText.trim() && patient && currentUser) {
      sendNudge(
        patient.assignedNavigator,
        patient.id,
        patient.name,
        nudgeText.trim(),
        currentUser.id,
        currentUser.name
      )
      setNudgeText("")
      setNudgeOpen(false)
    }
  }

  const navigator = useMemo(() => {
    if (!patient) return null
    return navigators.find((n) => n.id === patient.assignedNavigator)
  }, [patient])

  const supervisor = useMemo(() => {
    if (!patient) return null
    return supervisorData[patient.assignedSupervisor]
  }, [patient])

  // Group notes by type for different display approaches
  const groupedNotes = useMemo(() => {
    const visitNotes = notes.filter(n => n.type === "visit")
    const clinicalNotes = notes.filter(n => n.type === "clinical")
    const otherNotes = notes.filter(n => ["phone", "follow-up", "general"].includes(n.type))
    return { visitNotes, clinicalNotes, otherNotes }
  }, [notes])

  // Build timeline events
  const timelineEvents = useMemo((): TimelineEvent[] => {
    if (!patient) return []

    const events: TimelineEvent[] = []

    // Add appointments
    patient.upcomingAppointments.forEach((apt) => {
      events.push({
        id: apt.id,
        date: apt.date,
        time: apt.time,
        type: "appointment",
        title: `${apt.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}`,
        description: apt.notes || `Scheduled ${apt.type.replace("_", " ")} with navigator`,
        status: apt.status,
        icon: getAppointmentIcon(apt.type),
      })
    })

    // Add adverse events
    patientAdverseEvents.forEach((ae) => {
      events.push({
        id: ae.id,
        date: ae.startDate,
        type: "adverse_event",
        title: ae.diagnosis,
        description: `Type: ${ae.type.replace("_", " ")} | Status: ${ae.status.replace("_", " ")}`,
        status: ae.status,
        icon: <AlertTriangle className="h-4 w-4" />,
      })
    })

    // Add notes as events
    notes.forEach((note) => {
      const noteDate = new Date(note.createdAt)
      events.push({
        id: note.id,
        date: noteDate.toISOString().split('T')[0],
        time: noteDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        type: "note",
        title: `Note by ${note.authorName}`,
        description: note.content.substring(0, 100) + (note.content.length > 100 ? "..." : ""),
        icon: <FileText className="h-4 w-4" />,
      })
    })

    // Sort by date descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [patient, patientAdverseEvents, notes])

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Patient not found</p>
      </div>
    )
  }

  const age = calculateAge(patient.dob)
  const riskBadge = getRiskLevelBadge(patient.riskLevel)

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={goBack} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Context */}
      <div className="space-y-4">
        {/* Patient Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {patient.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{patient.name}</h2>
              <p className="text-muted-foreground text-sm">
                {age} years old | DOB: {formatDate(patient.dob)}
              </p>
              <p className="text-muted-foreground text-sm mb-3">Chart: {patient.chartNumber}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge className={riskBadge.className}>{riskBadge.label}</Badge>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  AMD Sync: Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Assessment Card - Navigator Only */}
        {currentUser?.role === "navigator" && (
          <Card className={patient.riskAssessment ? "border-emerald-200" : "border-amber-200"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.riskAssessment ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Score</span>
                    <Badge
                      variant="outline"
                      className={
                        patient.riskAssessment.calculatedTier === 1
                          ? "bg-emerald-50 text-emerald-700"
                          : patient.riskAssessment.calculatedTier === 2
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }
                    >
                      {patient.riskAssessment.riskScore}/100 (Tier {patient.riskAssessment.calculatedTier})
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Completed: {new Date(patient.riskAssessment.completedAt).toLocaleDateString()}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent"
                    onClick={() => navigateTo("assessment-wizard", { patientId: patient.id })}
                  >
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Reassess
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Assessment Required</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Complete the initial risk assessment during the home visit.
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => navigateTo("assessment-wizard", { patientId: patient.id })}
                  >
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Start Assessment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactInfo && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contactInfo.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{contactInfo.email}</span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{contactInfo.address}</p>
                    <p>
                      {contactInfo.city}, {contactInfo.state} {contactInfo.zip}
                    </p>
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Emergency Contact</p>
                  <p className="font-medium">{contactInfo.emergencyContact}</p>
                  <p className="text-muted-foreground">{contactInfo.emergencyPhone}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payer/Plan Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payer / Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Health Plan</span>
              <span className="text-sm font-medium">{patient.healthPlan}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Enrolled</span>
              <span className="text-sm font-medium">{formatDate(patient.enrollmentDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Contact</span>
              <span className="text-sm font-medium">{formatDate(patient.lastContactDate)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Med Compliance</span>
              <div className="flex items-center gap-2">
                <Badge variant={patient.medicationCompliance >= 90 ? "default" : "destructive"} className="font-mono">
                  {patient.medicationCompliance}%
                </Badge>
                {isSupervisor && patient.medicationCompliance < 90 && (
                  <Dialog open={nudgeOpen} onOpenChange={setNudgeOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Nudge Navigator">
                        <Bell className="h-3 w-3 text-warning" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nudge Navigator</DialogTitle>
                        <DialogDescription>
                          Send a message to {navigator?.name} about {patient.name}'s medication compliance.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <Textarea
                          placeholder="Enter your instruction or reminder for the navigator..."
                          value={nudgeText}
                          onChange={(e) => setNudgeText(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNudgeOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendNudge} disabled={!nudgeText.trim()}>
                          <Send className="h-4 w-4 mr-2" />
                          Send Nudge
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">PCP Compliance</span>
              <div className="flex items-center gap-2">
                {patient.pcpCompliance ? (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Yes
                  </Badge>
                ) : (
                  <>
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      No
                    </Badge>
                    {isSupervisor && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Nudge Navigator">
                            <Bell className="h-3 w-3 text-warning" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Nudge Navigator</DialogTitle>
                            <DialogDescription>
                              Send a message to {navigator?.name} about {patient.name}'s PCP compliance.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <Textarea
                              placeholder="Enter your instruction or reminder for the navigator..."
                              value={nudgeText}
                              onChange={(e) => setNudgeText(e.target.value)}
                              className="min-h-[100px]"
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setNudgeText("")}>Cancel</Button>
                            <Button onClick={handleSendNudge} disabled={!nudgeText.trim()}>
                              <Send className="h-4 w-4 mr-2" />
                              Send Nudge
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diagnosis / ICD-10 Codes Card */}
        <Card className={patient.icdCodes && patient.icdCodes.length > 0 ? "border-green-200" : "border-amber-200"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Diagnosis Codes
              </CardTitle>
              <Dialog open={icdDialogOpen} onOpenChange={setIcdDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit ICD Codes">
                    <Edit className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Diagnosis Codes</DialogTitle>
                    <DialogDescription>
                      Add or remove ICD-10 diagnosis codes for {patient.name}. These are required for billing.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Current ICD Codes */}
                    <div>
                      <Label className="text-sm font-medium">Current ICD-10 Codes</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {patient.icdCodes && patient.icdCodes.length > 0 ? (
                          patient.icdCodes.map((code) => (
                            <Badge key={code} variant="secondary" className="flex items-center gap-1">
                              {code}
                              <button
                                type="button"
                                onClick={() => {
                                  const newCodes = patient.icdCodes?.filter(c => c !== code) || []
                                  updatePatient(patient.id, { icdCodes: newCodes })
                                }}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No codes added yet</span>
                        )}
                      </div>
                    </div>

                    {/* Add New Code */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Add ICD-10 Code</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., E11.9, I10"
                          value={newIcdCode}
                          onChange={(e) => setNewIcdCode(e.target.value.toUpperCase())}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (newIcdCode.trim()) {
                              const currentCodes = patient.icdCodes || []
                              if (!currentCodes.includes(newIcdCode.trim())) {
                                updatePatient(patient.id, {
                                  icdCodes: [...currentCodes, newIcdCode.trim()]
                                })
                              }
                              setNewIcdCode("")
                            }
                          }}
                          disabled={!newIcdCode.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Common codes: E11.9 (Diabetes), I10 (Hypertension), I50.9 (Heart Failure), N18.6 (ESRD)
                      </p>
                    </div>

                    {/* Primary Diagnosis */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Primary Diagnosis</Label>
                      <Input
                        placeholder="e.g., Type 2 Diabetes (E11.9)"
                        value={newDiagnosis || patient.primaryDiagnosis || ""}
                        onChange={(e) => setNewDiagnosis(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setIcdDialogOpen(false)
                      setNewIcdCode("")
                      setNewDiagnosis("")
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      if (newDiagnosis.trim()) {
                        updatePatient(patient.id, { primaryDiagnosis: newDiagnosis.trim() })
                      }
                      setIcdDialogOpen(false)
                      setNewIcdCode("")
                      setNewDiagnosis("")
                    }}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {patient.primaryDiagnosis && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Primary</span>
                <p className="text-sm font-medium">{patient.primaryDiagnosis}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">ICD-10 Codes</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {patient.icdCodes && patient.icdCodes.length > 0 ? (
                  patient.icdCodes.map((code) => (
                    <Badge key={code} variant="outline" className="font-mono text-xs">
                      {code}
                    </Badge>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-xs">No diagnosis codes - required for billing</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Action (Tabs) */}
      <div className="lg:col-span-2">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="care-plan">Care Plan</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="care-team">Care Team</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Status</span>
                  </div>
                  <p className="text-lg font-semibold capitalize mt-1">{patient.survivalStatus}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Appointments</span>
                  </div>
                  <p className="text-lg font-semibold mt-1">{patient.upcomingAppointments.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Medications</span>
                  </div>
                  <p className="text-lg font-semibold mt-1">{patient.medications.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Adverse Events</span>
                  </div>
                  <p className="text-lg font-semibold mt-1">{patientAdverseEvents.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Billing/Intake Status Card */}
            <Card className={patientIntake ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Intake & Billing Status
                  </CardTitle>
                  {patient.billingTrack && (
                    <Badge variant="outline" className={patient.billingTrack === "PIN" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                      {patient.billingTrack === "PIN" ? "Principal Illness" : "Community Health"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {patientIntake ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Intake Completed</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Acuity Level</p>
                        <Badge variant="outline" className={
                          patientIntake.acuity.level === "High"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : patientIntake.acuity.level === "Moderate"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-green-50 text-green-700 border-green-200"
                        }>
                          {patientIntake.acuity.level} ({patientIntake.acuity.totalScore}/12)
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Consent</p>
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Obtained
                        </span>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Barriers</p>
                        <span>{patientIntake.identifiedBarriers.length} documented</span>
                      </div>
                    </div>
                    {patientIntake.identifiedBarriers.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {patientIntake.identifiedBarriers.map((zCode) => (
                          <Badge key={zCode.code} variant="secondary" className="text-xs">
                            {zCode.code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Intake Assessment Required</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Complete the intake assessment to establish billing eligibility and document patient acuity.
                    </p>
                    <Button onClick={() => setIntakeFormOpen(true)} size="sm" className="w-full">
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Start Intake Assessment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing Progress Bar - Only shows after intake is complete */}
            {patientIntake && (
              <BillingProgressBar
                patientId={patient.id}
                showDetails={true}
              />
            )}

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {patient.upcomingAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {patient.upcomingAppointments.map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">{getAppointmentIcon(apt.type)}</div>
                          <div>
                            <p className="font-medium text-sm capitalize">{apt.type.replace("_", " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(apt.date)} at {apt.time}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {apt.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No upcoming appointments</p>
                )}
              </CardContent>
            </Card>

            {/* Medications */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Current Medications</CardTitle>
                  <AMDSourceIndicator source="Epic EHR" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {patient.medications.map((med) => (
                    <div key={med.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <span className="inline-flex items-center gap-1.5 font-medium text-sm">
                          {med.name}
                          <AMDSourceIndicator source="Epic EHR" />
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {med.dosage} - {med.frequency}
                        </p>
                        <p className="text-xs text-muted-foreground">Refill: {formatDate(med.nextRefillDate)}</p>
                      </div>
                      {med.compliance ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Compliant
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Non-Compliant
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Care Plan Tab */}
          <TabsContent value="care-plan" className="mt-4">
            <CarePlanTab patientId={patientId} />
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

                    <div className="space-y-6">
                      {timelineEvents.map((event, index) => (
                        <div key={event.id} className="relative flex gap-4">
                          {/* Icon */}
                          <div
                            className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                              event.type === "adverse_event"
                                ? "bg-red-50 border-red-200 text-red-600"
                                : event.type === "appointment"
                                  ? "bg-blue-50 border-blue-200 text-blue-600"
                                  : "bg-muted border-border text-muted-foreground"
                            }`}
                          >
                            {event.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 pb-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{event.title}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(event.date)}
                                {event.time && ` at ${event.time}`}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                            {event.status && (
                              <Badge variant="outline" className="mt-2 capitalize text-xs">
                                {event.status.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}

                      {timelineEvents.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No timeline events</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-4 space-y-4">
            {/* Add Note */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Add Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Note Builder Button */}
                <Button
                  onClick={() => setNoteBuilderOpen(true)}
                  className="w-full"
                  variant="default"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Open Note Builder
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or quick note</span>
                  </div>
                </div>

                {/* Quick Note Fallback */}
                <div className="space-y-3">
                  <Select value={noteType} onValueChange={(value: PatientNote["type"]) => setNoteType(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Note Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Note</SelectItem>
                      <SelectItem value="clinical">Clinical Note</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="visit">Visit Note</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Type a quick note..."
                    className="min-h-[80px]"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={handleAddNote} disabled={!noteText.trim()}>
                      Save Quick Note
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Note Builder Dialog */}
            <NoteBuilder
              patientId={patient.id}
              patientName={patient.name}
              open={noteBuilderOpen}
              onOpenChange={setNoteBuilderOpen}
            />

            {/* Notes Display - Three Approaches by Type */}
            {notes.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground text-center">No notes yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Visit Notes - Modal Approach (Option A) */}
                {groupedNotes.visitNotes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Home className="h-4 w-4 text-purple-600" />
                        Visit Notes ({groupedNotes.visitNotes.length})
                        <Badge variant="outline" className="ml-auto text-xs">Click to expand</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {groupedNotes.visitNotes.map((note) => (
                          <button
                            key={note.id}
                            type="button"
                            onClick={() => setSelectedNote(note)}
                            className="w-full text-left p-3 bg-purple-50/50 hover:bg-purple-100/50 rounded-lg border border-purple-100 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  Visit
                                </Badge>
                                {note.templateName && (
                                  <span className="text-xs text-muted-foreground">{note.templateName}</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {note.content.slice(0, 100)}...
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{note.authorName}</p>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Clinical Notes - Split-Pane Approach (Option B) */}
                {groupedNotes.clinicalNotes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        Clinical Notes ({groupedNotes.clinicalNotes.length})
                        <Badge variant="outline" className="ml-auto text-xs">Split view</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <NotesSplitView
                        notes={groupedNotes.clinicalNotes}
                        emptyMessage="No clinical notes"
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Other Notes - Expandable Cards (Option C) */}
                {groupedNotes.otherNotes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Other Notes ({groupedNotes.otherNotes.length})
                        <Badge variant="outline" className="ml-auto text-xs">Expandable</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ExpandableNoteList
                        notes={groupedNotes.otherNotes}
                        emptyMessage="No other notes"
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Note Detail Modal for Visit Notes */}
            <NoteDetailModal
              note={selectedNote}
              open={!!selectedNote}
              onOpenChange={(open) => !open && setSelectedNote(null)}
            />
          </TabsContent>

          {/* Care Team Tab */}
          <TabsContent value="care-team" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Navigator */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Assigned Navigator
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {navigator ? (
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {navigator.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{navigator.name}</p>
                        <p className="text-sm text-muted-foreground">Care Navigator</p>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline">
                            <Phone className="h-3 w-3 mr-1" />
                            Call
                          </Button>
                          <Button size="sm" variant="outline">
                            <Mail className="h-3 w-3 mr-1" />
                            Message
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No navigator assigned</p>
                  )}
                </CardContent>
              </Card>

              {/* Supervisor */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Supervisor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {supervisor ? (
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {supervisor.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{supervisor.name}</p>
                        <p className="text-sm text-muted-foreground">Clinical Supervisor</p>
                        <p className="text-xs text-muted-foreground mt-1">{supervisor.region} Region</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No supervisor assigned</p>
                  )}
                </CardContent>
              </Card>

              {/* Care Team Stats */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Navigator Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {navigator && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{navigator.patientCount}</p>
                        <p className="text-xs text-muted-foreground">Total Patients</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{navigator.mtdUnits}</p>
                        <p className="text-xs text-muted-foreground">MTD Units</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{navigator.medicationCompliance}%</p>
                        <p className="text-xs text-muted-foreground">Med Compliance</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{navigator.highFivePercentage}%</p>
                        <p className="text-xs text-muted-foreground">High-Five %</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      </div>

      {/* Intake Form Dialog - Outside tabs so it can be opened from any tab */}
      <IntakeForm
        patientId={patient.id}
        patientName={patient.name}
        open={intakeFormOpen}
        onOpenChange={setIntakeFormOpen}
      />
    </div>
  )
}
