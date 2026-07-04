"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { useToast } from "@/hooks/use-toast"
import { getCurrentPositionSafe } from "@/lib/geo"
import { Plus, Home, Phone, Video, Building, ChevronLeft, ChevronRight, AlertTriangle, Calendar, Clock, Map, List, LogIn, LogOut, MapPin, BadgeCheck, CalendarClock, Info, Users, Siren } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Appointment, NavigatorShift, DayOfWeek } from "@/lib/types"
import { RouteMap } from "./route-map"
import { appointmentDraftToEvent, todayISO } from "@/lib/schedule-utils"
import { validateScheduleEvent } from "@/lib/schedule-validation"

const TIME_SLOTS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", 
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"
]

const VISIT_TYPES: { value: Appointment["type"]; label: string; color: string }[] = [
  { value: "home_visit", label: "Home Visit", color: "bg-chart-1 text-white" },
  { value: "video_call", label: "Video Call", color: "bg-chart-2 text-white" },
  { value: "phone_call", label: "Phone Call", color: "bg-chart-3 text-white" },
  { value: "clinic", label: "Clinic Visit", color: "bg-chart-4 text-white" },
]

const appointmentTypeIcon = {
  home_visit: Home,
  phone_call: Phone,
  video_call: Video,
  clinic: Building,
}

const appointmentTypeColor = {
  home_visit: "bg-chart-1/10 border-chart-1 text-chart-1",
  video_call: "bg-chart-2/10 border-chart-2 text-chart-2",
  phone_call: "bg-chart-3/10 border-chart-3 text-chart-3",
  clinic: "bg-chart-4/10 border-chart-4 text-chart-4",
}

interface AppointmentWithPatient extends Appointment {
  patientName: string
  patientId: string
}

type ViewMode = "list" | "map" | "dual-track"

const DAY_MAP: Record<number, DayOfWeek> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
}

export function NavigatorSchedule() {
  const { patients, navigators, scheduleAppointment, updateAppointment, checkInAppointment, checkOutAppointment, getSupervisor, scheduleEvents, navigatorShifts, updateNavigatorLocation, triggerSOS, isHydrated } = useDemoData()
  const { currentUser } = useRole()
  const { toast } = useToast()
  const currentNavigator = navigators.find((n) => n.id === currentUser?.id) ?? navigators[0]
  const myPatients = patients.filter((p) => p.assignedNavigator === currentNavigator?.id)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithPatient | null>(null)
  const [selectedPatient, setSelectedPatient] = useState("")
  const [selectedType, setSelectedType] = useState<Appointment["type"]>("home_visit")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("dual-track")
  const [showTeamView, setShowTeamView] = useState(false)

  // Shifts from context (published only)
  const allShifts = navigatorShifts.filter((s) => s.isPublished)
  const myShifts = allShifts.filter((shift) => shift.navigatorId === currentNavigator?.id)

  // Live validation of the "New Appointment" draft against existing schedule events
  const draftValidation = useMemo(() => {
    if (!currentNavigator || !selectedPatient || !selectedDate || !selectedTime) return null
    const patient = patients.find((p) => p.id === selectedPatient)
    if (!patient) return null
    const draft = appointmentDraftToEvent(
      patient,
      currentNavigator.id,
      currentNavigator.name,
      selectedDate,
      selectedTime,
      selectedType
    )
    return validateScheduleEvent(draft, scheduleEvents)
  }, [currentNavigator, selectedPatient, selectedDate, selectedTime, selectedType, patients, scheduleEvents])

  const draftErrors = draftValidation?.conflicts.filter((c) => c.severity === "ERROR") ?? []
  const draftWarnings = draftValidation?.conflicts.filter((c) => c.severity === "WARNING") ?? []

  // Get current shift for today
  const getTodayShift = (): NavigatorShift | null => {
    const today = new Date()
    const dateStr = todayISO()
    const dayOfWeek = DAY_MAP[today.getDay()]

    return myShifts.find((shift) => {
      if (shift.startDate > dateStr) return false
      if (shift.endDate && shift.endDate < dateStr) return false
      if (!shift.days.includes(dayOfWeek)) return false
      return true
    }) || null
  }

  // Get shift for a specific date
  const getShiftForDate = (date: Date): NavigatorShift | null => {
    const dateStr = date.toISOString().split("T")[0]
    const dayOfWeek = DAY_MAP[date.getDay()]

    return myShifts.find((shift) => {
      if (shift.startDate > dateStr) return false
      if (shift.endDate && shift.endDate < dateStr) return false
      if (!shift.days.includes(dayOfWeek)) return false
      return true
    }) || null
  }

  // Get weekly shift summary
  const getWeeklyShiftSummary = () => {
    const shiftDays = new Set<DayOfWeek>()
    myShifts.forEach((shift) => {
      shift.days.forEach((day) => shiftDays.add(day))
    })
    return Array.from(shiftDays).sort((a, b) => {
      const order: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      return order.indexOf(a) - order.indexOf(b)
    })
  }

  const todayShift = getTodayShift()
  const weeklyShiftDays = getWeeklyShiftSummary()

  // Get the current week's dates (Mon-Fri)
  const getWeekDates = () => {
    const today = new Date()
    const currentDay = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (weekOffset * 7))
    
    const dates = []
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates()

  // Get all appointments for a specific date (include scheduled and in_progress)
  const getAppointmentsForDate = (date: Date, navigatorId?: string) => {
    const dateStr = date.toISOString().split('T')[0]
    const patientsToCheck = navigatorId
      ? patients.filter(p => p.assignedNavigator === navigatorId)
      : myPatients
    return patientsToCheck.flatMap(p =>
      p.upcomingAppointments
        .filter(apt => apt.date === dateStr && (apt.status === "scheduled" || apt.status === "in_progress"))
        .map(apt => ({
          ...apt,
          patientName: p.name,
          patientId: p.id
        }))
    ).sort((a, b) => {
      const timeA = TIME_SLOTS.indexOf(a.time)
      const timeB = TIME_SLOTS.indexOf(b.time)
      return timeA - timeB
    })
  }

  // Get shift for a specific date and navigator
  const getShiftForNavigator = (date: Date, navigatorId: string): NavigatorShift | null => {
    const dateStr = date.toISOString().split("T")[0]
    const dayOfWeek = DAY_MAP[date.getDay()]

    return allShifts.find((shift) => {
      if (shift.navigatorId !== navigatorId) return false
      if (shift.startDate > dateStr) return false
      if (shift.endDate && shift.endDate < dateStr) return false
      if (!shift.days.includes(dayOfWeek)) return false
      return true
    }) || null
  }

  // Get all appointments for map view (all dates for current navigator)
  const getAllAppointmentsForMap = () => {
    return myPatients.flatMap(p =>
      p.upcomingAppointments
        .filter(apt => apt.status === "scheduled" || apt.status === "in_progress")
        .map(apt => ({
          ...apt,
          patientName: p.name,
          patientId: p.id,
          patientLat: p.lat,
          patientLng: p.lng,
        }))
    ).sort((a, b) => {
      // Sort by date then time
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      const timeA = TIME_SLOTS.indexOf(a.time)
      const timeB = TIME_SLOTS.indexOf(b.time)
      return timeA - timeB
    })
  }

  const handleSchedule = () => {
    if (draftErrors.length > 0) return
    if (selectedPatient && selectedDate && selectedTime && selectedType) {
      scheduleAppointment(
        selectedPatient,
        selectedDate,
        selectedTime,
        selectedType,
        currentNavigator.id
      )
      setDialogOpen(false)
      setSelectedPatient("")
      setSelectedDate("")
      setSelectedTime("")
      setSelectedType("home_visit")
    }
  }

  const handleAppointmentClick = (appointment: AppointmentWithPatient) => {
    setSelectedAppointment(appointment)
    setDetailsDialogOpen(true)
  }

  const handleMarkComplete = () => {
    if (selectedAppointment) {
      updateAppointment(selectedAppointment.id, { status: "completed" })
      setDetailsDialogOpen(false)
      setSelectedAppointment(null)
    }
  }

  // EVV Check-In handler - real device GPS when available, fallback otherwise
  const handleCheckIn = async (appointment: AppointmentWithPatient) => {
    // Fallback coords: patient's location or a mock Phoenix location
    const patient = patients.find(p => p.id === appointment.patientId)
    const fallbackLocation = patient?.lat && patient?.lng
      ? { lat: patient.lat + (Math.random() - 0.5) * 0.001, lng: patient.lng + (Math.random() - 0.5) * 0.001 }
      : { lat: 33.4484, lng: -112.0740 }

    const point = await getCurrentPositionSafe()
    const location = point ?? fallbackLocation

    checkInAppointment(appointment.id, location)

    // Surface the field check-in on the supervisor safety map (real check-in)
    updateNavigatorLocation(currentNavigator.id, location.lat, location.lng, {
      touchCheckIn: true,
      currentTask: `Home Visit: ${appointment.patientName}`,
      currentPatientId: appointment.patientId,
      speed: 0,
    })

    toast({
      title: "Visit Started",
      description: (
        <div className="flex items-center gap-2">
          <MapPin className={cn("h-4 w-4", point ? "text-green-500" : "text-amber-500")} />
          <span>
            {point
              ? "Checked in (GPS verified)"
              : "Checked in (approximate location — GPS unavailable)"}
          </span>
        </div>
      ),
    })

    setDetailsDialogOpen(false)
    setSelectedAppointment(null)
  }

  // SOS handler - real device location when available
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

  // EVV Check-Out handler
  const handleCheckOut = (appointment: AppointmentWithPatient) => {
    checkOutAppointment(appointment.id)

    toast({
      title: "Visit Complete",
      description: (
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-green-500" />
          <span>Billing Unit Generated</span>
        </div>
      ),
    })

    setDetailsDialogOpen(false)
    setSelectedAppointment(null)
  }

  const formatDateHeader = (date: Date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' })
    const num = date.getDate()
    return { day, num }
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  if (!isHydrated || !currentNavigator) return null

  return (
    <div className="space-y-6">
      {/* Today's Shift Banner */}
      {todayShift ? (
        <Alert className="bg-green-50 border-green-200">
          <CalendarClock className="h-4 w-4 text-green-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium text-green-800">
                Today&apos;s Shift: {todayShift.startTime} - {todayShift.endTime}
              </span>
              {todayShift.region && (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  {todayShift.region.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Badge>
              )}
            </div>
            <div className="text-sm text-green-600">
              Weekly: {weeklyShiftDays.join(", ")}
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-gray-50 border-gray-200">
          <Info className="h-4 w-4 text-gray-500" />
          <AlertDescription className="text-gray-600">
            No shift scheduled for today.
            {weeklyShiftDays.length > 0 && (
              <span className="ml-2">Your regular days: {weeklyShiftDays.join(", ")}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(prev => prev - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(prev => prev + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">
            {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDates[4].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/30">
            <Button
              variant={viewMode === "dual-track" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode("dual-track")}
            >
              <CalendarClock className="h-4 w-4 mr-1.5" />
              Schedule
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-1.5" />
              List
            </Button>
            <Button
              variant={viewMode === "map" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode("map")}
            >
              <Map className="h-4 w-4 mr-1.5" />
              Map
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
          <Button
            variant={showTeamView ? "default" : "outline"}
            size="sm"
            onClick={() => setShowTeamView(!showTeamView)}
            className={showTeamView ? "bg-indigo-600 hover:bg-indigo-700" : ""}
          >
            {showTeamView ? "My Schedule" : "Team View"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Siren className="h-4 w-4 mr-1.5" />
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule New Appointment</DialogTitle>
                <DialogDescription>Select patient, visit type, and time slot</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Patient</label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {myPatients.map(patient => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Visit Type</label>
                  <Select value={selectedType} onValueChange={(v) => setSelectedType(v as Appointment["type"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", type.color)} />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Select value={selectedDate} onValueChange={setSelectedDate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a date" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDates.map(date => (
                        <SelectItem key={date.toISOString()} value={date.toISOString().split('T')[0]}>
                          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Scheduling conflicts (ERROR blocks, WARNING allows) */}
                {draftErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        {draftErrors.map((conflict, index) => (
                          <p key={index} className="text-sm">{conflict.message}</p>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                {draftWarnings.length > 0 && (
                  <Alert className="border-amber-300 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        {draftWarnings.map((conflict, index) => (
                          <p key={index} className="text-sm">{conflict.message}</p>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleSchedule}
                  disabled={!selectedPatient || !selectedDate || !selectedTime || draftErrors.length > 0}
                >
                  Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {VISIT_TYPES.map(type => {
          const Icon = appointmentTypeIcon[type.value]
          return (
            <div key={type.value} className="flex items-center gap-2 text-sm">
              <div className={cn("flex h-6 w-6 items-center justify-center rounded", appointmentTypeColor[type.value])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-muted-foreground">{type.label}</span>
            </div>
          )
        })}
      </div>

      {/* View Content */}
      {viewMode === "dual-track" && showTeamView ? (
        /* Team View - Shows all navigators' schedules */
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Schedule - {navigators.length} Navigators
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {navigators.map((nav) => {
                const navColor = nav.id === currentNavigator.id ? "bg-indigo-50" : "bg-white"
                return (
                  <div key={nav.id} className={cn("p-4", navColor)}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {nav.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium">{nav.name}</p>
                        <p className="text-xs text-muted-foreground">{getSupervisor(nav.supervisorId)?.region || "All Regions"}</p>
                      </div>
                      {nav.id === currentNavigator.id && (
                        <Badge variant="outline" className="ml-auto bg-indigo-100 text-indigo-700 border-indigo-300">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {weekDates.map((date) => {
                        const { day, num } = formatDateHeader(date)
                        const appointments = getAppointmentsForDate(date, nav.id)
                        const today = isToday(date)
                        const dayShift = getShiftForNavigator(date, nav.id)

                        return (
                          <div
                            key={date.toISOString()}
                            className={cn(
                              "rounded-lg border p-2 min-h-[80px]",
                              today ? "bg-primary/5 border-primary/30" : "bg-muted/20"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium">{day} {num}</span>
                              {dayShift && (
                                <Badge variant="outline" className="text-[8px] h-4 px-1 bg-green-50 text-green-600 border-green-200">
                                  {dayShift.startTime}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              {appointments.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground">-</p>
                              ) : (
                                appointments.slice(0, 3).map((apt) => {
                                  const Icon = appointmentTypeIcon[apt.type]
                                  return (
                                    <div
                                      key={apt.id}
                                      className={cn(
                                        "flex items-center gap-1 text-[10px] rounded px-1 py-0.5",
                                        appointmentTypeColor[apt.type]
                                      )}
                                    >
                                      <Icon className="h-2.5 w-2.5" />
                                      <span className="truncate">{apt.patientName.split(" ")[0]}</span>
                                    </div>
                                  )
                                })
                              )}
                              {appointments.length > 3 && (
                                <p className="text-[9px] text-muted-foreground">+{appointments.length - 3} more</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "dual-track" ? (
        /* Weekly Schedule View - Shows appointments in week grid with shift info */
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-5 divide-x divide-border">
              {weekDates.map((date) => {
                const { day, num } = formatDateHeader(date)
                const appointments = getAppointmentsForDate(date)
                const today = isToday(date)
                const dayShift = getShiftForDate(date)

                return (
                  <div key={date.toISOString()} className="min-h-[500px] flex flex-col">
                    {/* Day Header */}
                    <div className={cn(
                      "sticky top-0 p-3 border-b border-border text-center",
                      today ? "bg-primary/10" : "bg-muted/30"
                    )}>
                      <p className="text-xs text-muted-foreground uppercase">{day}</p>
                      <p className={cn(
                        "text-lg font-semibold mt-0.5",
                        today ? "text-primary" : "text-foreground"
                      )}>{num}</p>
                      {dayShift && (
                        <Badge variant="outline" className="mt-1 text-[10px] bg-green-50 text-green-700 border-green-200">
                          {dayShift.startTime} - {dayShift.endTime}
                        </Badge>
                      )}
                    </div>

                    {/* Appointments */}
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                      {appointments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">No appointments</p>
                      ) : (
                        appointments.map((apt) => {
                          const Icon = appointmentTypeIcon[apt.type]
                          const isInProgress = apt.status === "in_progress"
                          const patient = patients.find(p => p.id === apt.patientId)
                          const isHighRisk = patient?.riskLevel === 3 || patient?.securityRisk === "High"
                          return (
                            <div
                              key={apt.id}
                              onClick={() => handleAppointmentClick(apt)}
                              className={cn(
                                "rounded-lg border p-2.5 text-xs cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
                                appointmentTypeColor[apt.type],
                                isInProgress && "ring-2 ring-amber-400 ring-offset-1"
                              )}
                            >
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Icon className="h-3.5 w-3.5" />
                                <span className="font-semibold">{apt.time}</span>
                                {isInProgress && (
                                  <Badge className="ml-auto h-4 px-1 text-[9px] bg-amber-500">Active</Badge>
                                )}
                                {isHighRisk && (
                                  <Badge className="ml-auto h-4 px-1 text-[9px] bg-red-500 text-white">
                                    High Risk
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium truncate">{apt.patientName}</p>
                              <p className="text-[10px] opacity-70 capitalize mt-0.5">
                                {apt.type.replace("_", " ")}
                              </p>
                              {patient?.address && (
                                <p className="text-[10px] opacity-60 truncate mt-1">
                                  {patient.address.city}, {patient.address.zip}
                                </p>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "map" ? (
        /* Map View */
        <RouteMap
          appointments={getAllAppointmentsForMap()}
          patients={patients}
          onAppointmentClick={(apt) => handleAppointmentClick(apt as AppointmentWithPatient)}
        />
      ) : (
        /* List View - Weekly Calendar Grid */
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-5 divide-x divide-border">
              {weekDates.map((date) => {
                const { day, num } = formatDateHeader(date)
                const appointments = getAppointmentsForDate(date)
                const today = isToday(date)

                return (
                  <div key={date.toISOString()} className="min-h-[400px]">
                    {/* Day Header */}
                    <div className={cn(
                      "sticky top-0 p-3 border-b border-border text-center",
                      today ? "bg-primary/5" : "bg-muted/30"
                    )}>
                      <p className="text-xs text-muted-foreground uppercase">{day}</p>
                      <p className={cn(
                        "text-lg font-semibold mt-0.5",
                        today ? "text-primary" : "text-foreground"
                      )}>{num}</p>
                    </div>

                    {/* Appointments */}
                    <div className="p-2 space-y-2">
                      {appointments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No appointments</p>
                      ) : (
                        appointments.map((apt) => {
                          const Icon = appointmentTypeIcon[apt.type]
                          const isInProgress = apt.status === "in_progress"
                          return (
                            <div
                              key={apt.id}
                              onClick={() => handleAppointmentClick(apt)}
                              className={cn(
                                "rounded-lg border p-2 text-xs cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]",
                                appointmentTypeColor[apt.type],
                                isInProgress && "ring-2 ring-amber-400 ring-offset-1"
                              )}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <Icon className="h-3 w-3" />
                                <span className="font-medium">{apt.time}</span>
                                {isInProgress && (
                                  <Badge className="ml-auto h-4 px-1 text-[9px] bg-amber-500">Active</Badge>
                                )}
                              </div>
                              <p className="font-medium truncate">{apt.patientName}</p>
                              <p className="text-[10px] opacity-70 capitalize">{apt.type.replace("_", " ")}</p>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-4">
        {VISIT_TYPES.map(type => {
          const count = myPatients.flatMap(p => 
            p.upcomingAppointments.filter(apt => apt.type === type.value && apt.status === "scheduled")
          ).length
          const Icon = appointmentTypeIcon[type.value]
          return (
            <Card key={type.value} className={cn("border-l-4", `border-l-${type.value === "home_visit" ? "chart-1" : type.value === "video_call" ? "chart-2" : type.value === "phone_call" ? "chart-3" : "chart-4"}`)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{type.label}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", appointmentTypeColor[type.value])}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Appointment Details Dialog with EVV */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>View and manage this appointment</DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg",
                  appointmentTypeColor[selectedAppointment.type]
                )}>
                  {(() => {
                    const Icon = appointmentTypeIcon[selectedAppointment.type]
                    return <Icon className="h-6 w-6" />
                  })()}
                </div>
                <div>
                  <p className="font-semibold text-lg">{selectedAppointment.patientName}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedAppointment.type.replace("_", " ")}
                  </p>
                </div>
                {/* Status Badge */}
                {selectedAppointment.status === "in_progress" && (
                  <Badge className="ml-auto bg-amber-500">In Progress</Badge>
                )}
                {selectedAppointment.status === "completed" && (
                  <Badge className="ml-auto bg-green-500">Verified</Badge>
                )}
              </div>
              <div className="space-y-2 bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(selectedAppointment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedAppointment.time}</span>
                </div>
                {/* EVV Information */}
                {selectedAppointment.checkInTime && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <LogIn className="h-4 w-4" />
                    <span>Checked in: {new Date(selectedAppointment.checkInTime).toLocaleTimeString()}</span>
                  </div>
                )}
                {selectedAppointment.checkOutTime && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <LogOut className="h-4 w-4" />
                    <span>Checked out: {new Date(selectedAppointment.checkOutTime).toLocaleTimeString()}</span>
                  </div>
                )}
                {selectedAppointment.evvLocation && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <MapPin className="h-4 w-4" />
                    <span>GPS: {selectedAppointment.evvLocation.lat.toFixed(4)}, {selectedAppointment.evvLocation.lng.toFixed(4)}</span>
                  </div>
                )}
              </div>
              {selectedAppointment.notes && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Notes</p>
                  <p className="text-muted-foreground">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
            {/* EVV Workflow Buttons */}
            {selectedAppointment && selectedAppointment.status === "scheduled" && (
              <Button
                onClick={() => handleCheckIn(selectedAppointment)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Check In
              </Button>
            )}
            {selectedAppointment && selectedAppointment.status === "in_progress" && (
              <Button
                onClick={() => handleCheckOut(selectedAppointment)}
                className="bg-green-600 hover:bg-green-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Check Out
              </Button>
            )}
            {selectedAppointment && selectedAppointment.status === "completed" && (
              <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-2">
                <BadgeCheck className="h-4 w-4 mr-2" />
                Visit Verified
              </Badge>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
