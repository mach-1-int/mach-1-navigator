"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Car,
  Stethoscope,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScheduleEvent, EventStatus, NavigatorShift, Navigator, DayOfWeek } from "@/lib/types"
import { checkTravelConflict } from "@/lib/schedule-utils"

interface NavigatorCalendarProps {
  events: ScheduleEvent[]
  navigatorId: string
  navigatorName: string
  onEventStatusChange?: (eventId: string, newStatus: EventStatus) => void
  onEventReschedule?: (eventId: string, newStartTime: string, newEndTime: string) => void
  // Team view props (optional)
  teamNavigators?: Navigator[]
  shifts?: NavigatorShift[]
  showTeamToggle?: boolean
  onAddEvent?: () => void
}

const DAY_MAP: Record<number, DayOfWeek> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
}

interface TravelConflictInfo {
  eventId: string
  message: string
}

/**
 * Navigator Calendar Component - Dual-Track Layout
 *
 * Visual Rules:
 * - MEDICAL_VISIT: Blue left border (#3B82F6)
 * - NAVIGATOR_VISIT: Green solid background (#22C55E)
 * - High Safety Risk: Red badge with shield icon
 * - Travel Conflicts: Red warning banner
 */
export function NavigatorCalendar({
  events,
  navigatorId,
  navigatorName,
  onEventStatusChange,
  onEventReschedule,
  teamNavigators = [],
  shifts = [],
  showTeamToggle = false,
  onAddEvent,
}: NavigatorCalendarProps) {
  // Default to today - seed events are rebased to the current date anchor
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [showTeamView, setShowTeamView] = useState(false)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // Get day of week
  const getDayOfWeek = (date: Date): DayOfWeek => {
    return DAY_MAP[date.getDay()]
  }

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  // Format time for display
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Get day's date string in YYYY-MM-DD format
  const getDateString = (date: Date) => {
    return date.toISOString().split("T")[0]
  }

  // Filter events for the selected date and navigator (or team)
  const dayEvents = useMemo(() => {
    const dateStr = getDateString(selectedDate)
    return events
      .filter((event) => {
        const eventDate = event.startTime.split("T")[0]
        if (showTeamView) {
          // Show all team events
          return eventDate === dateStr
        }
        // Show only current navigator's events
        return event.navigatorId === navigatorId && eventDate === dateStr
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [events, navigatorId, selectedDate, showTeamView])

  // Get current navigator's shift for selected date
  const currentShift = useMemo(() => {
    const dateStr = getDateString(selectedDate)
    const dayOfWeek = getDayOfWeek(selectedDate)

    return shifts.find((shift) => {
      if (shift.navigatorId !== navigatorId) return false
      if (!shift.isPublished) return false
      if (shift.startDate > dateStr) return false
      if (shift.endDate && shift.endDate < dateStr) return false
      if (!shift.days.includes(dayOfWeek)) return false
      return true
    })
  }, [shifts, navigatorId, selectedDate])

  // Check for travel conflicts between events
  const travelConflicts = useMemo<TravelConflictInfo[]>(() => {
    const conflicts: TravelConflictInfo[] = []

    dayEvents.forEach((event) => {
      const result = checkTravelConflict(event, events)
      if (result.conflict && result.message) {
        conflicts.push({
          eventId: event.id,
          message: result.message,
        })
      }
    })

    return conflicts
  }, [dayEvents, events])

  // Navigate to previous day
  const goToPreviousDay = () => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    setSelectedDate(prev)
  }

  // Navigate to next day
  const goToNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setSelectedDate(next)
  }

  // Go to today
  const goToToday = () => {
    setSelectedDate(new Date())
  }

  // Handle EVV Check-In
  const handleCheckIn = (eventId: string) => {
    onEventStatusChange?.(eventId, "IN_PROGRESS")
  }

  // Get conflict for a specific event
  const getConflictForEvent = (eventId: string) => {
    return travelConflicts.find((c) => c.eventId === eventId)
  }

  // Get status badge variant
  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case "SCHEDULED":
        return <Badge variant="outline" className="bg-gray-100 text-gray-700">Scheduled</Badge>
      case "EN_ROUTE":
        return <Badge className="bg-yellow-500 text-white">En Route</Badge>
      case "IN_PROGRESS":
        return <Badge className="bg-blue-500 text-white">IN PROGRESS</Badge>
      case "COMPLETED":
        return <Badge className="bg-green-500 text-white">Completed</Badge>
      case "CANCELLED":
        return <Badge variant="outline" className="bg-gray-100 text-gray-500 line-through">Cancelled</Badge>
      case "NO_SHOW":
        return <Badge className="bg-red-500 text-white">No Show</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              {navigatorName}&apos;s Schedule
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Dual-track calendar for medical and navigation visits
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {onAddEvent && (
              <Button size="sm" onClick={onAddEvent}>
                <Plus className="h-4 w-4 mr-1" />
                Add Event
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">{formatDate(selectedDate)}</span>
            {currentShift && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                Shift: {currentShift.startTime} - {currentShift.endTime}
              </Badge>
            )}
            {!currentShift && shifts.length > 0 && (
              <Badge variant="outline" className="bg-gray-100 text-gray-500">
                No shift scheduled
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs">
            {showTeamToggle && (
              <div className="flex items-center gap-2 mr-2 pr-2 border-r">
                <Switch
                  id="team-view"
                  checked={showTeamView}
                  onCheckedChange={setShowTeamView}
                />
                <Label htmlFor="team-view" className="text-xs cursor-pointer">
                  Team View
                </Label>
              </div>
            )}
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 border-l-4 border-blue-500 bg-blue-50 rounded" />
              <span>Medical Visit</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500 rounded" />
              <span>Navigator Visit</span>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Travel Conflict Warnings */}
      {travelConflicts.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          {travelConflicts.map((conflict) => (
            <Alert key={conflict.eventId} variant="destructive" className="mb-2 last:mb-0 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <span className="font-semibold">⚠️ Insufficient Travel Time</span>
                {" — "}
                {conflict.message.replace(/^⚠️ Insufficient Travel Time\.?\s*/i, "")}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {dayEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No events scheduled for this day</p>
              </div>
            ) : (
              dayEvents.map((event) => {
                const conflict = getConflictForEvent(event.id)
                const isMedical = event.type === "MEDICAL_VISIT"
                const isNavigator = event.type === "NAVIGATOR_VISIT"
                const isExpanded = expandedEventId === event.id
                const isClickable = isNavigator

                return (
                  <Card
                    key={event.id}
                    role={isClickable ? "button" : undefined}
                    className={cn(
                      "relative overflow-hidden transition-all",
                      // Dual-track: White/Blue = Medical, Solid Green = Navigator
                      isMedical && "border-l-4 border-l-blue-500 bg-white",
                      isNavigator && "bg-green-600 text-white border-green-700",
                      isClickable && "cursor-pointer hover:opacity-95",
                      !isClickable && "cursor-default",
                      // Conflict styling
                      conflict && "ring-2 ring-red-500/50",
                      // Completed events
                      event.status === "COMPLETED" && "opacity-60",
                      event.status === "CANCELLED" && "opacity-40"
                    )}
                    onClick={() => isClickable && setExpandedEventId(isExpanded ? null : event.id)}
                  >
                    {/* High Safety Risk Badge - visible without clicking */}
                    {event.isHighSafetyRisk && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-amber-500 text-white flex items-center gap-1 border-0">
                          <ShieldAlert className="h-3 w-3" />
                          High Risk
                        </Badge>
                      </div>
                    )}

                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Type Icon */}
                        <div
                          className={cn(
                            "p-2 rounded-lg shrink-0",
                            isMedical && "bg-blue-100 text-blue-600",
                            isNavigator && "bg-green-500/80 text-white"
                          )}
                        >
                          {isMedical ? (
                            <Stethoscope className="h-5 w-5" />
                          ) : (
                            <Users className="h-5 w-5" />
                          )}
                        </div>

                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate">{event.title}</h4>
                            {getStatusBadge(event.status)}
                          </div>

                          <p className={cn("text-sm mb-2", isNavigator ? "text-green-100" : "text-muted-foreground")}>
                            {event.patientName}
                            {showTeamView && (
                              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                {event.navigatorName}
                              </span>
                            )}
                          </p>

                          {/* Time */}
                          <div className={cn("flex items-center gap-1 text-sm mb-1", isNavigator ? "text-green-100" : "text-muted-foreground")}>
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {formatTime(event.startTime)} - {formatTime(event.endTime)}
                            </span>
                          </div>

                          {/* Location */}
                          <div className={cn("flex items-center gap-1 text-sm mb-1", isNavigator ? "text-green-100" : "text-muted-foreground")}>
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">{event.location.name}</span>
                            <Badge variant="outline" className={cn("text-xs ml-1", isNavigator ? "border-green-400 text-green-100" : "")}>
                              {event.location.zipCode}
                            </Badge>
                          </div>

                          {/* Expanded: Map pin + Check In */}
                          {isExpanded && isNavigator && (
                            <div className="mt-3 pt-3 border-t border-green-500/50 space-y-3">
                              {/* Map pin - location */}
                              <div className="flex items-center gap-2 text-sm text-green-100">
                                <MapPin className="h-4 w-4 shrink-0" />
                                <span>📍 {event.location.address}</span>
                              </div>
                              {event.location.lat != null && event.location.lng != null && (
                                <div className="rounded-lg overflow-hidden bg-green-800/50 h-24 flex items-center justify-center text-green-200 text-xs">
                                  Map pin: {event.location.lat.toFixed(4)}, {event.location.lng.toFixed(4)}
                                </div>
                              )}
                              {event.status === "SCHEDULED" && (
                                <Button
                                  size="sm"
                                  className="bg-white text-green-700 hover:bg-green-50 border-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCheckIn(event.id)
                                  }}
                                >
                                  📍 Check In
                                </Button>
                              )}
                              {/* Reschedule to 11:00 to clear travel conflict */}
                              {conflict && onEventReschedule && event.status === "SCHEDULED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-green-400 text-green-100 hover:bg-green-500/30"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const date = event.startTime.slice(0, 10)
                                    onEventReschedule(event.id, `${date}T11:00:00-07:00`, `${date}T11:30:00-07:00`)
                                  }}
                                >
                                  Move to 11:00 AM
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Travel Time (collapsed) */}
                          {!isExpanded && event.estimatedTravelMinutes && (
                            <div className={cn("flex items-center gap-1 text-sm", isNavigator ? "text-green-100" : "text-muted-foreground")}>
                              <Car className="h-3.5 w-3.5" />
                              <span>~{event.estimatedTravelMinutes} min travel</span>
                            </div>
                          )}

                          {/* Description (collapsed) */}
                          {!isExpanded && event.description && (
                            <p className={cn("text-xs mt-2 line-clamp-2", isNavigator ? "text-green-100" : "text-muted-foreground")}>
                              {event.description}
                            </p>
                          )}

                          {/* Conflict Warning (inline, collapsed) */}
                          {!isExpanded && conflict && (
                            <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>{conflict.message}</span>
                            </div>
                          )}

                          {/* EVV Check-In (collapsed - only when not expanded) */}
                          {!isExpanded && isNavigator && event.status === "SCHEDULED" && (
                            <Button
                              size="sm"
                              className="mt-3 bg-white text-green-700 hover:bg-green-50 border-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCheckIn(event.id)
                              }}
                            >
                              📍 Check In
                            </Button>
                          )}

                          {/* In Progress indicator */}
                          {event.status === "IN_PROGRESS" && (
                            <div className="mt-2 flex items-center gap-1 text-sm text-green-200">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                              <span>IN PROGRESS</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Summary Footer */}
      <div className="border-t px-4 py-3 bg-gray-50 shrink-0">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span>
              <strong>{dayEvents.length}</strong> events
            </span>
            <span className="text-blue-600">
              <strong>{dayEvents.filter((e) => e.type === "MEDICAL_VISIT").length}</strong> medical
            </span>
            <span className="text-green-600">
              <strong>{dayEvents.filter((e) => e.type === "NAVIGATOR_VISIT").length}</strong> navigation
            </span>
          </div>
          {travelConflicts.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {travelConflicts.length} conflict{travelConflicts.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}
