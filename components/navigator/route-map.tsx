"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation, Clock } from "lucide-react"
import type { Appointment, Patient } from "@/lib/types"
import { geo } from "@/lib/geo"
import type { RouteStop } from "./route-map-component"

// Real Leaflet map, loaded client-side only (Leaflet touches `window`)
const RouteMapComponent = dynamic(() => import("./route-map-component"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/30">
      <div className="text-center text-muted-foreground">
        <MapPin className="h-8 w-8 mx-auto mb-2 animate-pulse" />
        <p>Loading route map...</p>
      </div>
    </div>
  ),
})

interface RouteMapAppointment extends Appointment {
  patientName: string
  patientLat?: number
  patientLng?: number
}

interface RouteMapProps {
  appointments: RouteMapAppointment[]
  patients: Patient[]
  onAppointmentClick?: (appointment: RouteMapAppointment) => void
}

/**
 * Parse a 12-hour ("9:00 AM") or 24-hour ("14:00") time string to minutes
 * since midnight. Handles the 12 AM (00:xx) and 12 PM (12:xx) edge cases.
 */
function timeToMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return 0
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === "PM" && hours !== 12) hours += 12
  if (meridiem === "AM" && hours === 12) hours = 0
  return hours * 60 + minutes
}

export function RouteMap({ appointments, patients, onAppointmentClick }: RouteMapProps) {
  // Enrich appointments with patient coordinates and sort by time
  const enrichedAppointments = useMemo(() => {
    return appointments
      .map((apt) => {
        const patient = patients.find((p) => p.id === apt.patientId)
        return {
          ...apt,
          patientLat: patient?.lat,
          patientLng: patient?.lng,
        }
      })
      .filter((apt) => apt.patientLat && apt.patientLng) // Only show appointments with coordinates
      .sort((a, b) => {
        // Visit order: date first, then real clock time. A lexicographic
        // time-string compare would put "1:00 PM" before "9:00 AM" and
        // interleave different days' stops.
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return timeToMinutes(a.time) - timeToMinutes(b.time)
      })
  }, [appointments, patients])

  // Stops for the Leaflet map, in visit order
  const stops = useMemo<RouteStop[]>(() => {
    return enrichedAppointments.map((apt) => ({
      id: apt.id,
      patientName: apt.patientName,
      time: apt.time,
      type: apt.type,
      status: apt.status,
      lat: apt.patientLat!,
      lng: apt.patientLng!,
    }))
  }, [enrichedAppointments])

  // Total route distance + estimated drive time (sum of consecutive-stop legs)
  const routeTotals = useMemo(() => {
    let miles = 0
    let minutes = 0
    for (let i = 1; i < stops.length; i++) {
      const from = { lat: stops[i - 1].lat, lng: stops[i - 1].lng }
      const to = { lat: stops[i].lat, lng: stops[i].lng }
      miles += geo.distanceMiles(from, to)
      minutes += geo.driveTimeMinutes(from, to)
    }
    return { miles, minutes }
  }, [stops])

  const handleStopClick = (stopId: string) => {
    const apt = enrichedAppointments.find((a) => a.id === stopId)
    if (apt) onAppointmentClick?.(apt)
  }

  return (
    <Card className="relative overflow-hidden bg-card">
      {/* Real map (OpenStreetMap tiles via Leaflet) */}
      <div className="relative h-[500px]">
        {enrichedAppointments.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
            <div className="text-center space-y-2 bg-background/80 backdrop-blur-sm rounded-lg p-6 border">
              <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No home visits scheduled for this period</p>
              <p className="text-xs text-muted-foreground">
                Only home visits with patient addresses are shown on the map
              </p>
            </div>
          </div>
        ) : (
          <RouteMapComponent stops={stops} onStopClick={handleStopClick} />
        )}
      </div>

      {/* Route Summary Footer */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">
                {enrichedAppointments.length} stop{enrichedAppointments.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 border-t-2 border-dashed border-primary opacity-50" />
              <span className="text-sm text-muted-foreground">Route path</span>
            </div>
            {stops.length > 1 && (
              <>
                <div className="flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {routeTotals.miles.toFixed(1)} mi total
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    ~{routeTotals.minutes} min drive
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            {enrichedAppointments.filter(a => a.status === "completed").length > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {enrichedAppointments.filter(a => a.status === "completed").length} completed
              </Badge>
            )}
            {enrichedAppointments.filter(a => a.status === "in_progress").length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {enrichedAppointments.filter(a => a.status === "in_progress").length} in progress
              </Badge>
            )}
            {enrichedAppointments.filter(a => a.status === "scheduled").length > 0 && (
              <Badge variant="outline">
                {enrichedAppointments.filter(a => a.status === "scheduled").length} remaining
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
