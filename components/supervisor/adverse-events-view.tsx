"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  User,
  Users,
  Building2,
  Phone,
  PhoneCall,
  CalendarCheck,
  MessageCircle,
  HeartPulse,
  Stethoscope,
  Pill,
  BookOpen,
  ListChecks,
  XCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import { TASK_TYPE_CONFIG } from "@/lib/task-engine"
import { pcpDueStatus } from "@/lib/journey"
import { localDateOf } from "@/lib/task-engine"
import type { AdverseEvent, NavigatorTask } from "@/lib/types"

const TASK_ICONS: Record<string, LucideIcon> = {
  PhoneCall,
  CalendarCheck,
  AlertTriangle,
  MessageCircle,
  HeartPulse,
  Stethoscope,
  Pill,
  BookOpen,
}

const PCP_STATUS_STYLE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
  due_soon: "bg-amber-100 text-amber-700 border-amber-200",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
}

export function AdverseEventsView() {
  const { patients, navigators, adverseEvents, navigatorTasks, getUser, getSupervisor, generateAdverseEventTasks, completeTask, dismissTask } = useDemoData()
  const { navigateTo, currentUser } = useRole()
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [dismissingTaskId, setDismissingTaskId] = useState<string | null>(null)
  const [dismissNote, setDismissNote] = useState("")

  // Filter to the current supervisor's team patients
  const teamNavigators = navigators.filter(nav => nav.supervisorId === currentUser?.id)
  const teamPatients = patients.filter(p => 
    teamNavigators.some(n => n.id === p.assignedNavigator)
  )
  const teamAdverseEvents = adverseEvents.filter(ae =>
    teamPatients.some(p => p.id === ae.patientId)
  )

  // Categorize events
  const activeEvents = teamAdverseEvents.filter(ae => ae.status !== "ended")
  const inpatientEvents = teamAdverseEvents.filter(ae => ae.status === "currently_inpatient")
  const edEvents = teamAdverseEvents.filter(ae => ae.status === "currently_ed")
  const monitoringEvents = teamAdverseEvents.filter(ae => ae.status === "monitoring")
  const resolvedEvents = teamAdverseEvents.filter(ae => ae.status === "ended")

  const toggleExpanded = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  const getStatusConfig = (status: AdverseEvent["status"]) => {
    switch (status) {
      case "currently_inpatient":
        return { label: "Inpatient", color: "destructive" as const, icon: Building2, bgColor: "bg-destructive/10" }
      case "currently_ed":
        return { label: "In ED", color: "destructive" as const, icon: AlertTriangle, bgColor: "bg-destructive/10" }
      case "monitoring":
        return { label: "Monitoring", color: "default" as const, icon: Clock, bgColor: "bg-amber-100" }
      case "ended":
        return { label: "Resolved", color: "secondary" as const, icon: CheckCircle2, bgColor: "bg-emerald-100" }
    }
  }

  const getTypeLabel = (type: AdverseEvent["type"]) => {
    switch (type) {
      case "fall": return "Fall"
      case "infection": return "Infection"
      case "chronic_exacerbation": return "Chronic Exacerbation"
      case "other": return "Other"
    }
  }

  const getPatientInfo = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId)
    const navigator = patient ? navigators.find(n => n.id === patient.assignedNavigator) : null
    return { patient, navigator }
  }

  const handleGenerateTasks = (event: AdverseEvent, patientName: string) => {
    if (!currentUser) return
    const count = generateAdverseEventTasks(event.id, currentUser.id, currentUser.name)
    if (count > 0) {
      toast.success(`Generated ${count} response task${count === 1 ? "" : "s"} for ${patientName}`)
    } else {
      toast.info("No new response tasks to generate", { description: "This event's task set is already up to date." })
    }
  }

  const handleCompleteTask = (task: NavigatorTask, patientName: string) => {
    if (!currentUser) return
    completeTask(task.id, currentUser.id)
    toast.success(`${TASK_TYPE_CONFIG[task.type].label} marked done for ${patientName}`)
  }

  const handleDismissTask = (task: NavigatorTask) => {
    if (!currentUser || dismissNote.trim().length === 0) return
    dismissTask(task.id, currentUser.id, dismissNote.trim())
    toast.success(`${TASK_TYPE_CONFIG[task.type].label} dismissed`)
    setDismissingTaskId(null)
    setDismissNote("")
  }

  const renderResponseTasks = (event: AdverseEvent, patientName: string) => {
    const eventTasks = navigatorTasks
      .filter(t => t.adverseEventId === event.id)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-card-foreground flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          Response Tasks
        </h4>
        {eventTasks.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
            <p className="text-sm text-muted-foreground">No response tasks generated yet for this event.</p>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleGenerateTasks(event, patientName)
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate response tasks
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {eventTasks.map((task) => {
              const config = TASK_TYPE_CONFIG[task.type]
              const Icon = TASK_ICONS[config.icon] ?? ListChecks
              const isPcp = task.type === "post_discharge_pcp"
              const pcp = isPcp ? pcpDueStatus(localDateOf(task.dueAt)) : null
              const isDismissing = dismissingTaskId === task.id

              return (
                <div key={task.id} className="rounded-lg border border-border p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {new Date(task.dueAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isPcp && pcp && (
                        <Badge variant="outline" className={cn("text-xs", PCP_STATUS_STYLE[pcp.status])}>
                          {pcp.status === "overdue"
                            ? `${Math.abs(pcp.businessDaysRemaining)}bd overdue`
                            : `${pcp.businessDaysRemaining}bd left`}
                        </Badge>
                      )}
                      <Badge
                        variant={task.status === "open" ? "outline" : task.status === "done" ? "default" : "secondary"}
                        className="text-xs capitalize"
                      >
                        {task.status}
                      </Badge>
                      {task.status === "open" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleCompleteTask(task, patientName)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDismissingTaskId(isDismissing ? null : task.id)
                              setDismissNote("")
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {task.note && task.status !== "open" && (
                    <p className="text-xs text-muted-foreground pl-10">{task.note}</p>
                  )}
                  {isDismissing && (
                    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
                      <Textarea
                        placeholder="Reason for dismissing (required)..."
                        value={dismissNote}
                        onChange={(e) => setDismissNote(e.target.value)}
                        className="min-h-[60px] resize-none bg-card"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => handleDismissTask(task)} disabled={dismissNote.trim().length === 0}>
                          Confirm Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderEventCard = (event: AdverseEvent) => {
    const statusConfig = getStatusConfig(event.status)
    const StatusIcon = statusConfig.icon
    const isExpanded = expandedEvents.has(event.id)
    const { patient, navigator } = getPatientInfo(event.patientId)
    const supervisor = patient ? getSupervisor(patient.assignedSupervisor) : undefined
    const navigatorPhone = navigator ? getUser(navigator.id)?.phone : undefined
    const supervisorPhone = supervisor ? getUser(supervisor.id)?.phone : undefined

    return (
      <Collapsible 
        key={event.id} 
        open={isExpanded} 
        onOpenChange={() => toggleExpanded(event.id)}
      >
        <Card className={cn(
          "bg-card transition-all",
          event.status !== "ended" && "border-l-4",
          event.status === "currently_inpatient" && "border-l-destructive",
          event.status === "currently_ed" && "border-l-destructive",
          event.status === "monitoring" && "border-l-amber-500"
        )}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg",
                    statusConfig.bgColor
                  )}>
                    <StatusIcon className={cn(
                      "h-6 w-6",
                      event.status === "ended" ? "text-emerald-600" : 
                      event.status === "monitoring" ? "text-amber-600" : "text-destructive"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base text-card-foreground">
                        {patient?.name || "Unknown Patient"}
                      </CardTitle>
                      <Badge variant={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                    <CardDescription className="mt-1">
                      {getTypeLabel(event.type)} - {event.diagnosis}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-card-foreground">
                      Started: {new Date(event.startDate).toLocaleDateString()}
                    </p>
                    {event.endDate && (
                      <p className="text-xs text-muted-foreground">
                        Ended: {new Date(event.endDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Right Care:</span>
                    {event.rightCareFlag ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="border-t border-border pt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Event Details */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Event Details
                    </h4>
                    <div className="grid gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium text-card-foreground">{getTypeLabel(event.type)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Diagnosis</span>
                        <span className="font-medium text-card-foreground">{event.diagnosis}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Start Date</span>
                        <span className="font-medium text-card-foreground">
                          {new Date(event.startDate).toLocaleDateString()}
                        </span>
                      </div>
                      {event.endDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">End Date</span>
                          <span className="font-medium text-card-foreground">
                            {new Date(event.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Follow-up Status</span>
                        <Badge variant={
                          event.followUpStatus === "completed" ? "default" :
                          event.followUpStatus === "scheduled" ? "secondary" : "outline"
                        }>
                          {event.followUpStatus}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Right Care Flag</span>
                        <span className={cn(
                          "font-medium",
                          event.rightCareFlag ? "text-emerald-600" : "text-warning"
                        )}>
                          {event.rightCareFlag ? "Yes" : "Pending Review"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Care Team */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Assigned Care Team
                    </h4>
                    <div className="space-y-3">
                      {/* Navigator */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-card-foreground">{navigator?.name || "Unassigned"}</p>
                          <p className="text-xs text-muted-foreground">Care Navigator</p>
                        </div>
                        {navigatorPhone && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={`tel:${navigatorPhone}`} aria-label={`Call ${navigator?.name}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>

                      {/* Supervisor */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                          <Users className="h-5 w-5 text-secondary-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-card-foreground">{supervisor?.name ?? "Unassigned"}</p>
                          <p className="text-xs text-muted-foreground">Clinical Supervisor</p>
                        </div>
                        {supervisorPhone && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={`tel:${supervisorPhone}`} aria-label={`Call ${supervisor?.name}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Patient Quick Link */}
                    {patient && (
                      <Button 
                        variant="outline" 
                        className="w-full mt-4 bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigateTo("patient-detail", { patientId: patient.id })
                        }}
                      >
                        View Patient Record
                      </Button>
                    )}
                  </div>
                </div>

                {/* Response Tasks */}
                <div className="mt-6 border-t border-border pt-4">
                  {renderResponseTasks(event, patient?.name ?? "the patient")}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className={cn("bg-card", activeEvents.length > 0 && "border-destructive/50")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                activeEvents.length > 0 ? "bg-destructive/10" : "bg-muted"
              )}>
                <Activity className={cn(
                  "h-6 w-6",
                  activeEvents.length > 0 ? "text-destructive" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{activeEvents.length}</p>
                <p className="text-sm text-muted-foreground">Active Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("bg-card", inpatientEvents.length > 0 && "border-destructive/50")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                inpatientEvents.length > 0 ? "bg-destructive/10" : "bg-muted"
              )}>
                <Building2 className={cn(
                  "h-6 w-6",
                  inpatientEvents.length > 0 ? "text-destructive" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{inpatientEvents.length}</p>
                <p className="text-sm text-muted-foreground">Currently Inpatient</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{monitoringEvents.length}</p>
                <p className="text-sm text-muted-foreground">Monitoring</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{resolvedEvents.length}</p>
                <p className="text-sm text-muted-foreground">Resolved This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Events Section */}
      {activeEvents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Active Adverse Events
          </h3>
          <div className="space-y-3">
            {activeEvents.map(renderEventCard)}
          </div>
        </div>
      )}

      {/* Resolved Events Section */}
      {resolvedEvents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Recently Resolved
          </h3>
          <div className="space-y-3">
            {resolvedEvents.map(renderEventCard)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {teamAdverseEvents.length === 0 && (
        <Card className="bg-card">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">No Adverse Events</h3>
              <p className="text-muted-foreground max-w-md">
                There are no adverse events to display for your team at this time.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
