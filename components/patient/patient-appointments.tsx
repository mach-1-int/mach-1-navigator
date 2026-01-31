"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Calendar, Clock, Home, Phone, Video, Building2, CalendarClock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import type { Appointment } from "@/lib/types"

const visitTypeConfig: Record<Appointment["type"], { icon: typeof Home; label: string; color: string }> = {
  home_visit: { icon: Home, label: "Home Visit", color: "bg-blue-100 text-blue-700" },
  phone_call: { icon: Phone, label: "Phone Call", color: "bg-green-100 text-green-700" },
  video_call: { icon: Video, label: "Video Call", color: "bg-purple-100 text-purple-700" },
  clinic: { icon: Building2, label: "Clinic Visit", color: "bg-orange-100 text-orange-700" },
}

const statusConfig: Record<Appointment["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Upcoming", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  no_show: { label: "Missed", variant: "outline" },
}

export function PatientAppointments() {
  const { currentUser, navigateTo, setDraftMessage } = useRole()
  const { getAppointmentsByPatient, getNavigator } = useDemoData()
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [rescheduleRequested, setRescheduleRequested] = useState<Set<string>>(new Set())

  if (!currentUser) return null

  const appointments = getAppointmentsByPatient(currentUser.id)
  const upcomingAppointments = appointments
    .filter(apt => apt.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const pastAppointments = appointments
    .filter(apt => apt.status !== "scheduled")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const handleRescheduleRequest = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setRescheduleDialogOpen(true)
  }

  const confirmRescheduleRequest = () => {
    if (!selectedAppointment || !currentUser) return

    const navigator = getNavigator(selectedAppointment.navigatorId)
    if (!navigator) return

    const appointmentDate = format(parseISO(selectedAppointment.date), "MMMM d, yyyy")
    const message = `I need to reschedule my appointment on ${appointmentDate} at ${selectedAppointment.time}. Please let me know what other times are available.`

    // Set draft message and navigate to messages view
    setDraftMessage({
      recipientId: navigator.id,
      content: message
    })
    
    setRescheduleRequested(prev => new Set(prev).add(selectedAppointment.id))
    setRescheduleDialogOpen(false)
    setSelectedAppointment(null)
    
    // Navigate to messages tab
    navigateTo("messages")
  }

  const renderAppointmentCard = (appointment: Appointment, showReschedule = false) => {
    const navigator = getNavigator(appointment.navigatorId)
    const config = visitTypeConfig[appointment.type]
    const status = statusConfig[appointment.status]
    const Icon = config.icon
    const isRescheduleRequested = rescheduleRequested.has(appointment.id)

    return (
      <Card key={appointment.id} className="relative overflow-hidden">
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.color.split(" ")[0]}`} />
        <CardContent className="p-4 pl-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg ${config.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{config.label}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Meet with {navigator?.name || "Your Navigator"}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(parseISO(appointment.date), "EEEE, MMMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {appointment.time}
                  </span>
                </div>
                {appointment.notes && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    {appointment.notes}
                  </p>
                )}
              </div>
            </div>
            {showReschedule && (
              <div className="flex-shrink-0">
                {isRescheduleRequested ? (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    <CalendarClock className="h-3 w-3 mr-1" />
                    Request Sent
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRescheduleRequest(appointment)}
                  >
                    <CalendarClock className="h-4 w-4 mr-1" />
                    Request Reschedule
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Appointments</h2>
        <p className="text-muted-foreground">View and manage your upcoming visits</p>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
          <CardDescription>
            Your scheduled visits with your care navigator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming appointments scheduled</p>
              <p className="text-sm">Your navigator will contact you to schedule your next visit</p>
            </div>
          ) : (
            upcomingAppointments.map(apt => renderAppointmentCard(apt, true))
          )}
        </CardContent>
      </Card>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Past Appointments</CardTitle>
            <CardDescription>
              Your previous visits and their outcomes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pastAppointments.map(apt => renderAppointmentCard(apt, false))}
          </CardContent>
        </Card>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogDescription>
              Send a message to your navigator to reschedule this appointment.
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="py-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="font-medium">Current Appointment</p>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(selectedAppointment.date), "EEEE, MMMM d, yyyy")} at {selectedAppointment.time}
                </p>
                <p className="text-sm text-muted-foreground">
                  {visitTypeConfig[selectedAppointment.type].label}
                </p>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Your navigator will receive a message and contact you with available times.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRescheduleRequest}>
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
