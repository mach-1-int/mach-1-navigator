"use client"

import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Activity,
  Calendar,
  AlertTriangle,
  Pill,
  Phone,
  Video,
  Home,
  Building,
  FileText,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Bell,
  Siren,
  X,
  PhoneCall,
  ListChecks,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { useToast } from "@/hooks/use-toast"
import { getCurrentPositionSafe } from "@/lib/geo"
import { AMDSourceIndicator } from "@/components/amd-source-indicator"
import { DayClosePanel } from "@/components/navigator/day-close-panel"
import { daysSince, todayISO } from "@/lib/schedule-utils"
import { telenavCheckInStatus } from "@/lib/journey"
import { ExternalLink } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PatientNote } from "@/lib/types"
import { overdueTasks, localDateOf, TASK_TYPE_CONFIG } from "@/lib/task-engine"

export function NavigatorDashboard() {
  const { navigateTo, currentUser } = useRole()
  const { patients, navigators, navigatorTasks, addNote, getPatientNotes, lastAssignedPatientId, getNudgesForNavigator, markDirectMessageRead, triggerSOS, generateDueTasks } = useDemoData()
  const { toast } = useToast()
  // Use the logged-in user if available, otherwise fall back to first navigator
  const currentNavigator = navigators.find(n => n.id === currentUser?.id) || navigators[0]

  useEffect(() => {
    generateDueTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Sort patients to show newly assigned first
  const myPatients = patients
    .filter((p) => p.assignedNavigator === currentNavigator.id)
    .sort((a, b) => {
      // New patient always first
      if (a.id === lastAssignedPatientId) return -1
      if (b.id === lastAssignedPatientId) return 1
      // Then by risk level (high risk first)
      return b.riskLevel - a.riskLevel
    })
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")
  const [noteType, setNoteType] = useState<PatientNote["type"]>("general")
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set())

  // Get unread nudges for this navigator
  const navigatorMessages = getNudgesForNavigator(currentNavigator.id)
  const unreadNudges = navigatorMessages.filter(m => !m.readStatus && !dismissedNudges.has(m.id))

  const handleDismissNudge = (nudgeId: string) => {
    markDirectMessageRead(nudgeId)
    setDismissedNudges(prev => new Set([...prev, nudgeId]))
  }

  const handleSaveNote = () => {
    if (selectedPatient && noteText.trim()) {
      addNote(
        selectedPatient,
        noteText.trim(),
        noteType,
        currentNavigator.id,
        currentNavigator.name,
        "navigator"
      )
      setNoteText("")
    }
  }

  // SOS trigger - real device location when available
  const handleSOS = async () => {
    const point = await getCurrentPositionSafe()
    triggerSOS(currentNavigator.id, point ?? undefined)
    toast({
      title: "SOS sent to supervisor",
      description: (
        <div className="flex items-center gap-2">
          <Siren className="h-4 w-4 text-red-500" />
          <span>Your supervisor has been alerted with your current location.</span>
        </div>
      ),
    })
  }

  const selectedPatientNotes = selectedPatient ? getPatientNotes(selectedPatient) : []

  const upcomingAppointments = myPatients
    .flatMap((p) =>
      p.upcomingAppointments.map((apt) => ({
        ...apt,
        patientName: p.name,
        patientRisk: p.riskLevel,
      }))
    )
    .filter((apt) => apt.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

  const medicationAlerts = myPatients.flatMap((p) =>
    p.medications
      .filter((med) => !med.compliance || new Date(med.nextRefillDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      .map((med) => ({
        ...med,
        patientName: p.name,
        patientId: p.id,
      }))
  )

  const appointmentTypeIcon = {
    home_visit: Home,
    phone_call: Phone,
    video_call: Video,
    clinic: Building,
  }

  const targetUnits = 280
  const progressPercentage = Math.min((currentNavigator.mtdUnits / (targetUnits / 2)) * 100, 100)

  // Telenavigation check-ins due or overdue for this navigator's patients
  const telenavAlerts = patients
    .filter((p) => p.assignedNavigator === currentNavigator.id)
    .map((p) => ({ p, s: telenavCheckInStatus(p) }))
    .filter((x): x is { p: typeof x.p; s: NonNullable<typeof x.s> } => x.s !== null && x.s.status !== "ok")
  const hasOverdueTelenav = telenavAlerts.some((x) => x.s.status === "overdue")

  // Check if there's a newly assigned patient for this navigator
  const newlyAssignedPatient = lastAssignedPatientId
    ? myPatients.find(p => p.id === lastAssignedPatientId)
    : null

  // Tasks due today (Gellert ops blitz — overdue is DATE-based, never dueAt < now)
  const myOpenTasks = navigatorTasks.filter((t) => t.navigatorId === currentNavigator.id && t.status === "open")
  const myOverdueTasks = overdueTasks(myOpenTasks)
  const overdueTaskIds = new Set(myOverdueTasks.map((t) => t.id))
  const today = localDateOf(new Date())
  const tasksDueToday = [
    ...myOverdueTasks,
    ...myOpenTasks.filter((t) => !overdueTaskIds.has(t.id) && localDateOf(t.dueAt) === today),
  ].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))

  return (
    <div className="space-y-6">
      {/* Header action area */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Welcome back, {currentNavigator.name.split(" ")[0]}</h2>
          <p className="text-sm text-muted-foreground">Here&apos;s your field overview for today</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Siren className="h-4 w-4 mr-2" />
              SOS
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send SOS alert?</AlertDialogTitle>
              <AlertDialogDescription>
                Send an emergency alert to your supervisor with your current location?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleSOS}>
                Send SOS
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Telenavigation Check-in Alerts */}
      {telenavAlerts.length > 0 && (
        <div
          className={cn(
            "rounded-lg border p-4",
            hasOverdueTelenav ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-white shrink-0",
                hasOverdueTelenav ? "bg-red-500" : "bg-amber-500"
              )}
            >
              <PhoneCall className="h-5 w-5" />
            </div>
            <p className={cn("font-semibold", hasOverdueTelenav ? "text-red-900" : "text-amber-900")}>
              {telenavAlerts.length} telenavigation check-in{telenavAlerts.length === 1 ? "" : "s"}{" "}
              {hasOverdueTelenav ? "overdue" : "due"}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {telenavAlerts.map(({ p, s }) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between rounded-md border bg-white/60 px-3 py-2",
                  s.status === "overdue" ? "border-red-200" : "border-amber-200"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs shrink-0",
                      s.status === "overdue"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    )}
                  >
                    {s.status === "overdue"
                      ? `Check-in ${Math.abs(s.daysUntilDue)}d overdue`
                      : `due ${new Date(`${s.nextDue}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "shrink-0 ml-3",
                    s.status === "overdue"
                      ? "border-red-300 text-red-700 hover:bg-red-100"
                      : "border-amber-300 text-amber-700 hover:bg-amber-100"
                  )}
                  onClick={() => navigateTo("patient-detail", { patientId: p.id })}
                >
                  Open Profile
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supervisor Nudge Alerts */}
      {unreadNudges.length > 0 && (
        <div className="space-y-2">
          {unreadNudges.map((nudge) => (
            <div
              key={nudge.id}
              className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white shrink-0">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-900 flex items-center gap-2">
                    Supervisor Nudge
                    <Badge className="bg-amber-500 text-white">Action Required</Badge>
                  </p>
                  <p className="text-sm text-amber-700 truncate">
                    <span className="font-medium">{nudge.patientName}:</span> {nudge.content}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    From {nudge.senderName} • {new Date(nudge.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => nudge.patientId && navigateTo("patient-detail", { patientId: nudge.patientId })}
                >
                  View Patient
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                  onClick={() => handleDismissNudge(nudge.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Patient Alert Banner */}
      {newlyAssignedPatient && (
        <div
          className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors"
          onClick={() => navigateTo("patient-detail", { patientId: newlyAssignedPatient.id })}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900 flex items-center gap-2">
                New Patient Assigned
                <Badge className="bg-emerald-500 text-white animate-pulse">Action Required</Badge>
              </p>
              <p className="text-sm text-emerald-700">
                {newlyAssignedPatient.name} - {newlyAssignedPatient.primaryDiagnosis}
              </p>
            </div>
          </div>
          <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
            View Patient
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Personal Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="MTD Units"
          value={currentNavigator.mtdUnits}
          subtitle={`Target: ${targetUnits / 2} (half month)`}
          icon={Activity}
          variant={currentNavigator.mtdUnits >= targetUnits / 2 ? "success" : "warning"}
        />
        <StatCard
          title="My Patients"
          value={myPatients.length}
          subtitle={`${myPatients.filter((p) => p.riskLevel === 3).length} high risk`}
          icon={Activity}
        />
        <StatCard
          title="Today's Appointments"
          value={upcomingAppointments.filter((a) => a.date === todayISO()).length}
          subtitle="scheduled for today"
          icon={Calendar}
        />
        <StatCard
          title="Supervisor Nudges"
          value={navigatorMessages.filter(m => !m.readStatus).length}
          subtitle={navigatorMessages.filter(m => !m.readStatus).length === 1 ? "needs attention" : "need attention"}
          icon={Bell}
          variant={navigatorMessages.filter(m => !m.readStatus).length > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Medication Alerts"
          value={medicationAlerts.length}
          subtitle="require attention"
          icon={Pill}
          variant={medicationAlerts.length > 0 ? "warning" : "default"}
        />
      </div>

      {/* Progress Card */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Monthly Progress</CardTitle>
          <CardDescription>Track your billing units toward monthly target</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">MTD Progress</span>
              <span className="font-medium text-card-foreground">
                {currentNavigator.mtdUnits} / {targetUnits} units
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {progressPercentage >= 50
                ? "You're on track for this month!"
                : `${Math.round((targetUnits / 2 - currentNavigator.mtdUnits))} more units needed to stay on pace`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tasks due today strip */}
      {tasksDueToday.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <p className="font-medium text-card-foreground">
                {tasksDueToday.length} task{tasksDueToday.length === 1 ? "" : "s"} due today
                {myOverdueTasks.length > 0 ? ` — ${myOverdueTasks.length} overdue` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateTo("tasks")}>
              View all
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="mt-3 space-y-1.5">
            {tasksDueToday.slice(0, 3).map((task) => {
              const patient = patients.find((p) => p.id === task.patientId)
              const config = TASK_TYPE_CONFIG[task.type]
              const isOverdue = overdueTaskIds.has(task.id)
              return (
                <div
                  key={task.id}
                  onClick={() => navigateTo("patient-detail", { patientId: task.patientId })}
                  className="flex cursor-pointer items-center justify-between rounded-md border bg-card px-3 py-2 text-sm hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{patient?.name ?? task.patientId}</span>
                    <span className="text-xs text-muted-foreground truncate">{config.label}</span>
                  </div>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      Overdue
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Day-Close / Charge Slips */}
      <DayClosePanel navigatorId={currentNavigator.id} navigatorName={currentNavigator.name} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming Schedule */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Upcoming Appointments</CardTitle>
            <CardDescription>Your next scheduled patient interactions</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground">No upcoming appointments</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((apt) => {
                  const Icon = appointmentTypeIcon[apt.type]
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3 transition-colors hover:bg-secondary"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-card-foreground">{apt.patientName}</p>
                            {apt.patientRisk === 3 && (
                              <Badge variant="destructive" className="text-xs">
                                High Risk
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {apt.type.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium text-card-foreground">{apt.date}</p>
                          <p className="text-xs text-muted-foreground">{apt.time}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medication Alerts */}
        <Card className="bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Medication Alerts
              </CardTitle>
              <AMDSourceIndicator source="Epic EHR" />
            </div>
            <CardDescription>Patients needing medication follow-up</CardDescription>
          </CardHeader>
          <CardContent>
            {medicationAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span>All medications on track</span>
              </div>
            ) : (
              <div className="space-y-3">
                {medicationAlerts.map((alert) => (
                  <div
                    key={`${alert.patientId}-${alert.id}`}
                    className="rounded-lg border border-warning/30 bg-warning/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-card-foreground">{alert.patientName}</p>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          {alert.name} - {alert.dosage}
                          <AMDSourceIndicator source="Epic EHR" />
                        </span>
                      </div>
                      <div className="text-right">
                        {!alert.compliance ? (
                          <Badge variant="destructive">Non-Compliant</Badge>
                        ) : (
                          <Badge variant="outline" className="border-warning text-warning">
                            Refill {alert.nextRefillDate}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patient List with Quick Notes */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">My Patients</CardTitle>
          <CardDescription>Click on a patient to add notes. View last contact and next visit at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              {/* Column Headers */}
              <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                <div className="col-span-5">Patient</div>
                <div className="col-span-3 text-center">Last Contact</div>
                <div className="col-span-4 text-right">Next Visit</div>
              </div>
              {myPatients.map((patient) => {
                const nextAppointment = patient.upcomingAppointments
                  .filter(apt => apt.status === "scheduled")
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
                const daysSinceContact = daysSince(patient.lastContactDate)
                const contactWarning = daysSinceContact > 14
                
                return (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(selectedPatient === patient.id ? null : patient.id)}
                    className={cn(
                      "grid grid-cols-12 gap-2 cursor-pointer items-center rounded-lg border p-3 transition-colors",
                      selectedPatient === patient.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-secondary/50"
                    )}
                  >
                    {/* Patient Info - 5 cols */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium shrink-0",
                          patient.riskLevel === 3
                            ? "bg-destructive/10 text-destructive"
                            : patient.riskLevel === 2
                              ? "bg-warning/10 text-warning"
                              : "bg-primary/10 text-primary"
                        )}
                      >
                        L{patient.riskLevel}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-card-foreground text-sm truncate">{patient.name}</p>
                          {patient.id === lastAssignedPatientId && (
                            <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 animate-pulse flex items-center gap-0.5">
                              <Sparkles className="h-2.5 w-2.5" />
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{patient.chartNumber}</p>
                      </div>
                    </div>
                    
                    {/* Last Contact - 3 cols */}
                    <div className="col-span-3 text-center">
                      <p className={cn(
                        "text-xs font-medium",
                        contactWarning ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago`}
                      </p>
                      {contactWarning && (
                        <p className="text-[10px] text-destructive">Gap detected</p>
                      )}
                    </div>
                    
                    {/* Next Visit - 4 cols */}
                    <div className="col-span-4 flex items-center justify-end gap-2">
                      {nextAppointment ? (
                        <div className="text-right">
                          <p className="text-xs font-medium text-card-foreground">
                            {new Date(nextAppointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-muted-foreground capitalize">
                            {nextAppointment.type.replace("_", " ")}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-warning text-warning">
                          No visit scheduled
                        </Badge>
                      )}
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                          selectedPatient === patient.id && "rotate-90"
                        )}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Notes Panel */}
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              {selectedPatient ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-medium text-card-foreground">
                        Quick Note - {patients.find((p) => p.id === selectedPatient)?.name}
                      </h3>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateTo("patient-detail", { patientId: selectedPatient })}
                      className="gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Profile
                    </Button>
                  </div>
                  
                  {/* Note Type Selector */}
                  <Select value={noteType} onValueChange={(value: PatientNote["type"]) => setNoteType(value)}>
                    <SelectTrigger className="w-full bg-card">
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
                    placeholder="Enter visit notes, observations, or follow-up items..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="min-h-[100px] resize-none bg-card"
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleSaveNote} disabled={!noteText.trim()}>
                      Save Note
                    </Button>
                    <Button variant="outline" onClick={() => setNoteText("")}>
                      Clear
                    </Button>
                  </div>
                  
                  {/* Recent Notes */}
                  {selectedPatientNotes.length > 0 && (
                    <div className="border-t border-border pt-4 mt-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recent Notes</p>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {selectedPatientNotes.slice(0, 3).map((note) => (
                          <div key={note.id} className="rounded bg-card p-2 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {note.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(note.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-card-foreground line-clamp-2">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground">
                  <p>Select a patient to add notes</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
