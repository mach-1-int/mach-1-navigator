"use client"

import { useState, useEffect } from "react"
import { TeamCalendar } from "./team-calendar"
import { AddShiftModal } from "./add-shift-modal"
import { loadState, saveState } from "@/lib/store"
import type { NavigatorShift, ScheduleEvent, Navigator } from "@/lib/types"

interface SchedulingViewProps {
  supervisorId: string
}

/**
 * Scheduling View for Supervisors
 *
 * Features:
 * - Team Calendar showing all navigators
 * - Add Shift modal for creating navigator schedules
 * - View and manage all team events
 */
export function SchedulingView({ supervisorId }: SchedulingViewProps) {
  const [showAddShift, setShowAddShift] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [navigators, setNavigators] = useState<Navigator[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [shifts, setShifts] = useState<NavigatorShift[]>([])

  // Load state on mount
  useEffect(() => {
    const state = loadState()
    setNavigators(state.navigators)
    setEvents(state.scheduleEvents)
    setShifts(state.navigatorShifts)
  }, [])

  // Get navigators for this supervisor's team
  const teamNavigators = navigators.filter(
    (nav) => nav.supervisorId === supervisorId || nav.supervisorId === "sup1" // Include sup1 team for demo
  )

  // Handle adding a new shift
  const handleAddShift = (shift: NavigatorShift, _publish: boolean) => {
    const state = loadState()
    const newShifts = [...state.navigatorShifts, shift]
    saveState({ ...state, navigatorShifts: newShifts })
    setShifts(newShifts)
  }

  // Handle clicking an event
  const handleEventClick = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    // Could open an event detail modal here
    console.log("Event clicked:", event)
  }

  return (
    <div className="h-[calc(100vh-140px)]">
      <TeamCalendar
        navigators={teamNavigators}
        events={events}
        shifts={shifts}
        supervisorId={supervisorId}
        onAddShift={() => setShowAddShift(true)}
        onEventClick={handleEventClick}
      />

      <AddShiftModal
        open={showAddShift}
        onOpenChange={setShowAddShift}
        navigators={teamNavigators}
        supervisorId={supervisorId}
        onAddShift={handleAddShift}
      />
    </div>
  )
}
