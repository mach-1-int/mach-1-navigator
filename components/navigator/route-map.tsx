"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Home, Phone, Video, Building, MapPin, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Appointment, Patient } from "@/lib/types"

// Map bounds for Phoenix Metro area (for positioning)
const MAP_BOUNDS = {
  north: 33.65,
  south: 33.35,
  west: -112.25,
  east: -111.75,
}

const appointmentTypeIcon = {
  home_visit: Home,
  phone_call: Phone,
  video_call: Video,
  clinic: Building,
}

const appointmentTypeColor = {
  home_visit: "bg-chart-1 border-chart-1",
  video_call: "bg-chart-2 border-chart-2",
  phone_call: "bg-chart-3 border-chart-3",
  clinic: "bg-chart-4 border-chart-4",
}

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
 * Convert lat/lng to percentage position on the map
 */
function coordsToPercent(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * 100
  const y = ((MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * 100
  return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) }
}

/**
 * Format time string for display
 */
function formatTime(time: string): string {
  // Handle both "10:00" and "10:00 AM" formats
  if (time.includes("AM") || time.includes("PM")) {
    return time
  }
  const [hours, minutes] = time.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

export function RouteMap({ appointments, patients, onAppointmentClick }: RouteMapProps) {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)

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
        // Sort by time
        const timeA = a.time.replace(/[^\d:]/g, "")
        const timeB = b.time.replace(/[^\d:]/g, "")
        return timeA.localeCompare(timeB)
      })
  }, [appointments, patients])

  // Calculate route line points (for visual effect)
  const routePoints = useMemo(() => {
    return enrichedAppointments.map((apt) => {
      if (apt.patientLat && apt.patientLng) {
        return coordsToPercent(apt.patientLat, apt.patientLng)
      }
      return null
    }).filter(Boolean) as { x: number; y: number }[]
  }, [enrichedAppointments])

  return (
    <Card className="relative overflow-hidden bg-card">
      {/* Map Background - Stylized placeholder */}
      <div className="relative h-[500px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
        {/* Grid overlay for map effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Map label */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-sm">
          <Navigation className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Phoenix Metro Area</span>
        </div>

        {/* Compass */}
        <div className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 bg-background/80 backdrop-blur-sm rounded-full border shadow-sm">
          <span className="text-xs font-bold text-primary">N</span>
        </div>

        {/* Route line connecting pins */}
        {routePoints.length > 1 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 5 }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 6 3, 0 6"
                  fill="hsl(var(--primary))"
                  opacity="0.6"
                />
              </marker>
            </defs>
            <polyline
              points={routePoints.map((p) => `${p.x}%,${p.y}%`).join(" ")}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeDasharray="8 4"
              opacity="0.5"
              markerMid="url(#arrowhead)"
            />
          </svg>
        )}

        {/* Appointment Pins */}
        <TooltipProvider delayDuration={0}>
          {enrichedAppointments.map((apt, index) => {
            if (!apt.patientLat || !apt.patientLng) return null

            const position = coordsToPercent(apt.patientLat, apt.patientLng)
            const Icon = appointmentTypeIcon[apt.type]
            const isHovered = hoveredPin === apt.id
            const isInProgress = apt.status === "in_progress"
            const isCompleted = apt.status === "completed"

            return (
              <Tooltip key={apt.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "absolute transform -translate-x-1/2 -translate-y-full transition-all duration-200 cursor-pointer group",
                      isHovered && "scale-110 z-20",
                      !isHovered && "z-10"
                    )}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                    }}
                    onMouseEnter={() => setHoveredPin(apt.id)}
                    onMouseLeave={() => setHoveredPin(null)}
                    onClick={() => onAppointmentClick?.(apt)}
                  >
                    {/* Pin shadow */}
                    <div
                      className={cn(
                        "absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-2 rounded-full bg-black/20 blur-sm transition-all",
                        isHovered && "w-5 h-2.5"
                      )}
                    />

                    {/* Pin body */}
                    <div className="relative">
                      {/* Number badge */}
                      <div
                        className={cn(
                          "absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md z-10",
                          isCompleted ? "bg-green-500" : isInProgress ? "bg-amber-500" : "bg-primary"
                        )}
                      >
                        {index + 1}
                      </div>

                      {/* Main pin */}
                      <div
                        className={cn(
                          "relative flex items-center justify-center w-10 h-10 rounded-full border-2 shadow-lg transition-all",
                          appointmentTypeColor[apt.type],
                          isCompleted && "opacity-60",
                          isInProgress && "ring-2 ring-amber-400 ring-offset-2"
                        )}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>

                      {/* Pin pointer */}
                      <div
                        className={cn(
                          "absolute left-1/2 -bottom-2 w-0 h-0 -translate-x-1/2",
                          "border-l-[8px] border-l-transparent",
                          "border-r-[8px] border-r-transparent",
                          "border-t-[10px]",
                          apt.type === "home_visit" && "border-t-chart-1",
                          apt.type === "video_call" && "border-t-chart-2",
                          apt.type === "phone_call" && "border-t-chart-3",
                          apt.type === "clinic" && "border-t-chart-4"
                        )}
                      />
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="p-3 max-w-xs"
                  sideOffset={15}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <span className="font-semibold">{formatTime(apt.time)}</span>
                      {isInProgress && (
                        <Badge className="bg-amber-500 text-xs">In Progress</Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-green-500 text-xs">Completed</Badge>
                      )}
                    </div>
                    <p className="font-medium">{apt.patientName}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {apt.type.replace("_", " ")}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </TooltipProvider>

        {/* No appointments message */}
        {enrichedAppointments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2 bg-background/80 backdrop-blur-sm rounded-lg p-6 border">
              <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No home visits scheduled for this period</p>
              <p className="text-xs text-muted-foreground">
                Only home visits with patient addresses are shown on the map
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Route Summary Footer */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
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
