"use client"

import { useState } from "react"
import { TeamCalendar } from "./team-calendar"
import { AddShiftModal } from "./add-shift-modal"
import { useDemoData } from "@/lib/demo-data-context"
import type { NavigatorShift, ScheduleEvent } from "@/lib/types"

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
  const { scheduleEvents, navigatorShifts, getTeamNavigators, addShift, isHydrated } = useDemoData()
  const [showAddShift, setShowAddShift] = useState(false)
  const [, setSelectedEvent] = useState<ScheduleEvent | null>(null)

  // Get navigators for this supervisor's team (supervisorId = logged-in user)
  const teamNavigators = getTeamNavigators(supervisorId)

  // Handle adding a new shift (persistence goes through context)
  const handleAddShift = (shift: Omit<NavigatorShift, "id" | "createdAt" | "updatedAt">) => {
    addShift(shift)
  }

  // Handle clicking an event
  const handleEventClick = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    // Could open an event detail modal here
  }

  if (!isHydrated) return null

  return (
    <div className="h-[calc(100vh-140px)]">
      <TeamCalendar
        navigators={teamNavigators}
        events={scheduleEvents}
        shifts={navigatorShifts}
        supervisorId={supervisorId}
        onAddShift={() => setShowAddShift(true)}
        onEventClick={handleEventClick}
      />

      <AddShiftModal
        open={showAddShift}
        onOpenChange={setShowAddShift}
        navigators={teamNavigators}
        supervisorId={supervisorId}
        existingShifts={navigatorShifts}
        onAddShift={handleAddShift}
      />
    </div>
  )
}
