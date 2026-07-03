"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Clock,
  AlertTriangle,
  Stethoscope,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScheduleEvent, NavigatorShift, Navigator, DayOfWeek } from "@/lib/types"

interface TeamCalendarProps {
  navigators: Navigator[]
  events: ScheduleEvent[]
  shifts: NavigatorShift[]
  supervisorId: string
  onAddShift: () => void
  onEventClick?: (event: ScheduleEvent) => void
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7) // 7 AM to 6 PM

const DAY_MAP: Record<number, DayOfWeek> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
}

export function TeamCalendar({
  navigators,
  events,
  shifts,
  supervisorId,
  onAddShift,
  onEventClick,
}: TeamCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"day" | "week">("day")

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  // Get day string in YYYY-MM-DD format
  const getDateString = (date: Date) => {
    return date.toISOString().split("T")[0]
  }

  // Get day of week
  const getDayOfWeek = (date: Date): DayOfWeek => {
    return DAY_MAP[date.getDay()]
  }

  // Check if navigator has shift on given date
  const hasShiftOnDate = (navigatorId: string, date: Date): NavigatorShift | null => {
    const dateStr = getDateString(date)
    const dayOfWeek = getDayOfWeek(date)

    return shifts.find((shift) => {
      if (shift.navigatorId !== navigatorId) return false
      if (!shift.isPublished) return false
      if (shift.startDate > dateStr) return false
      if (shift.endDate && shift.endDate < dateStr) return false
      if (!shift.days.includes(dayOfWeek)) return false
      return true
    }) || null
  }

  // Get events for a navigator on a date
  const getNavigatorEvents = (navigatorId: string, date: Date): ScheduleEvent[] => {
    const dateStr = getDateString(date)
    return events.filter((event) => {
      const eventDate = event.startTime.split("T")[0]
      return event.navigatorId === navigatorId && eventDate === dateStr
    })
  }

  // Get position and height for event in the timeline
  const getEventStyle = (event: ScheduleEvent) => {
    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60
    const duration = endHour - startHour

    const top = ((startHour - 7) / 12) * 100 // 7 AM start
    const height = (duration / 12) * 100

    return {
      top: `${Math.max(0, top)}%`,
      height: `${Math.min(height, 100 - top)}%`,
    }
  }

  // Format time
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Navigate dates
  const goToPreviousDay = () => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - (viewMode === "week" ? 7 : 1))
    setSelectedDate(prev)
  }

  const goToNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + (viewMode === "week" ? 7 : 1))
    setSelectedDate(next)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  // Get week dates (Mon-Sun) for the selected date
  const getWeekDates = (date: Date): Date[] => {
    const dayOfWeek = date.getDay()
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7)) // Adjust to get Monday

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  const weekDates = getWeekDates(selectedDate)

  // Format week range for display
  const formatWeekRange = (dates: Date[]) => {
    const start = dates[0]
    const end = dates[6]
    const startMonth = start.toLocaleDateString("en-US", { month: "short" })
    const endMonth = end.toLocaleDateString("en-US", { month: "short" })
    const year = end.toLocaleDateString("en-US", { year: "numeric" })

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`
  }

  // Check if a date is today
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Get event count for a navigator on a date
  const getEventCount = (navigatorId: string, date: Date): number => {
    return getNavigatorEvents(navigatorId, date).length
  }

  // Calculate team stats for the day
  const dayStats = useMemo(() => {
    const dateStr = getDateString(selectedDate)
    const dayEvents = events.filter((e) => e.startTime.split("T")[0] === dateStr)

    return {
      totalEvents: dayEvents.length,
      medicalVisits: dayEvents.filter((e) => e.type === "MEDICAL_VISIT").length,
      navigatorVisits: dayEvents.filter((e) => e.type === "NAVIGATOR_VISIT").length,
      highRiskVisits: dayEvents.filter((e) => e.isHighSafetyRisk).length,
      navigatorsScheduled: navigators.filter((n) => hasShiftOnDate(n.id, selectedDate)).length,
    }
  }, [events, selectedDate, navigators, shifts])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Team Calendar
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {navigators.length} navigators • {dayStats.navigatorsScheduled} scheduled today
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week")}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={onAddShift}>
              <Plus className="h-4 w-4 mr-1" />
              Add Shift
            </Button>
          </div>
        </div>

        {/* Date and Stats */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-semibold">
            {viewMode === "week" ? formatWeekRange(weekDates) : formatDate(selectedDate)}
          </span>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <Stethoscope className="h-3 w-3 text-blue-500" />
              <span>{dayStats.medicalVisits} medical</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-green-500" />
              <span>{dayStats.navigatorVisits} navigation</span>
            </div>
            {dayStats.highRiskVisits > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{dayStats.highRiskVisits} high risk</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {viewMode === "day" ? (
          /* Day View */
          <div className="flex h-full">
            {/* Time Column */}
            <div className="w-16 border-r bg-gray-50 shrink-0">
              <div className="h-12 border-b" /> {/* Header spacer */}
              <div className="relative" style={{ height: "calc(100% - 48px)" }}>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full text-xs text-muted-foreground text-right pr-2"
                    style={{ top: `${((hour - 7) / 12) * 100}%` }}
                  >
                    {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigator Columns */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex min-w-max h-full">
                {navigators.map((navigator) => {
                  const shift = hasShiftOnDate(navigator.id, selectedDate)
                  const navEvents = getNavigatorEvents(navigator.id, selectedDate)

                  return (
                    <div
                      key={navigator.id}
                      className="w-48 border-r flex flex-col shrink-0"
                    >
                      {/* Navigator Header */}
                      <div className="h-12 px-2 py-1 border-b bg-gray-50 flex flex-col justify-center">
                        <span className="font-medium text-sm truncate">{navigator.name}</span>
                        {shift ? (
                          <span className="text-xs text-green-600">
                            {shift.startTime} - {shift.endTime}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No shift</span>
                        )}
                      </div>

                      {/* Timeline */}
                      <div className="flex-1 relative bg-white">
                        {/* Hour lines */}
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="absolute w-full border-t border-gray-100"
                            style={{ top: `${((hour - 7) / 12) * 100}%` }}
                          />
                        ))}

                        {/* Shift background */}
                        {shift && (
                          <div
                            className="absolute left-0 right-0 bg-green-50/50 border-l-2 border-green-400"
                            style={{
                              top: `${((parseInt(shift.startTime.split(":")[0]) - 7) / 12) * 100}%`,
                              height: `${((parseInt(shift.endTime.split(":")[0]) - parseInt(shift.startTime.split(":")[0])) / 12) * 100}%`,
                            }}
                          />
                        )}

                        {/* Events */}
                        {navEvents.map((event) => {
                          const style = getEventStyle(event)
                          const isMedical = event.type === "MEDICAL_VISIT"

                          return (
                            <div
                              key={event.id}
                              className={cn(
                                "absolute left-1 right-1 rounded px-1 py-0.5 cursor-pointer overflow-hidden",
                                "text-xs transition-all hover:ring-2 hover:ring-offset-1",
                                isMedical
                                  ? "bg-blue-100 border-l-2 border-blue-500 hover:ring-blue-300"
                                  : "bg-green-100 border-l-2 border-green-500 hover:ring-green-300",
                                event.isHighSafetyRisk && "ring-1 ring-red-400"
                              )}
                              style={style}
                              onClick={() => onEventClick?.(event)}
                            >
                              <div className="font-medium truncate flex items-center gap-1">
                                {event.isHighSafetyRisk && (
                                  <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                                )}
                                {event.title}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {formatTime(event.startTime)}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {event.patientName}
                              </div>
                            </div>
                          )
                        })}

                        {/* No shift overlay */}
                        {!shift && (
                          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center">
                            <span className="text-xs text-muted-foreground bg-white px-2 py-1 rounded shadow-sm">
                              Off
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Week View */
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  <th className="w-40 px-3 py-2 text-left text-sm font-medium text-muted-foreground border-b border-r">
                    Navigator
                  </th>
                  {weekDates.map((date) => {
                    const dayName = date.toLocaleDateString("en-US", { weekday: "short" })
                    const dayNum = date.getDate()
                    const today = isToday(date)

                    return (
                      <th
                        key={date.toISOString()}
                        className={cn(
                          "px-2 py-2 text-center text-sm font-medium border-b border-r min-w-[120px]",
                          today ? "bg-blue-50" : "bg-gray-50"
                        )}
                      >
                        <div className={cn("text-xs", today ? "text-blue-600" : "text-muted-foreground")}>
                          {dayName}
                        </div>
                        <div className={cn(
                          "text-lg font-semibold",
                          today && "text-blue-600"
                        )}>
                          {dayNum}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {navigators.map((navigator) => (
                  <tr key={navigator.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 border-b border-r bg-gray-50/50">
                      <div className="font-medium text-sm">{navigator.name}</div>
                      <div className="text-xs text-muted-foreground">Navigator</div>
                    </td>
                    {weekDates.map((date) => {
                      const shift = hasShiftOnDate(navigator.id, date)
                      const navEvents = getNavigatorEvents(navigator.id, date)
                      const eventCount = navEvents.length
                      const hasHighRisk = navEvents.some((e) => e.isHighSafetyRisk)
                      const medicalCount = navEvents.filter((e) => e.type === "MEDICAL_VISIT").length
                      const navVisitCount = navEvents.filter((e) => e.type === "NAVIGATOR_VISIT").length
                      const today = isToday(date)

                      return (
                        <td
                          key={date.toISOString()}
                          className={cn(
                            "px-2 py-2 border-b border-r align-top min-h-[80px]",
                            today && "bg-blue-50/30",
                            !shift && "bg-gray-100/50"
                          )}
                        >
                          {shift ? (
                            <div className="space-y-1">
                              {/* Shift time */}
                              <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                                <Clock className="h-3 w-3" />
                                {shift.startTime} - {shift.endTime}
                              </div>

                              {/* Event summary */}
                              {eventCount > 0 ? (
                                <div className="space-y-1">
                                  {medicalCount > 0 && (
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                                      <span className="text-xs">{medicalCount} medical</span>
                                    </div>
                                  )}
                                  {navVisitCount > 0 && (
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-green-500" />
                                      <span className="text-xs">{navVisitCount} nav visit</span>
                                    </div>
                                  )}
                                  {hasHighRisk && (
                                    <div className="flex items-center gap-1 text-red-600">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span className="text-xs">High risk</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground italic">
                                  No visits
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full min-h-[60px]">
                              <span className="text-xs text-muted-foreground">Off</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Legend Footer */}
      <div className="border-t px-4 py-2 bg-gray-50 shrink-0">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-50 border-l-2 border-green-400 rounded" />
            <span>Shift scheduled</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 border-l-2 border-blue-500 rounded" />
            <span>Medical Visit</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border-l-2 border-green-500 rounded" />
            <span>Navigator Visit</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span>High Risk</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
