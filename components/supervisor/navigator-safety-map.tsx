"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  AlertTriangle,
  MapPin,
  Clock,
  Phone,
  User,
  Battery,
  Navigation,
  RefreshCw,
  ChevronRight,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import type { NavigatorLocation, SafetyStatus } from "@/lib/types"
import dynamic from "next/dynamic"

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import("./map-component"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/30 rounded-lg">
      <div className="text-center text-muted-foreground">
        <MapPin className="h-8 w-8 mx-auto mb-2 animate-pulse" />
        <p>Loading map...</p>
      </div>
    </div>
  ),
})

const STATUS_CONFIG: Record<SafetyStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  ACTIVE: {
    label: "Active",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    borderColor: "border-emerald-300",
  },
  IDLE: {
    label: "Idle",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-300",
  },
  RISK_ALERT: {
    label: "Risk Alert",
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
}

function formatTimeAgo(isoTimestamp: string): string {
  const now = new Date()
  const then = new Date(isoTimestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "Just now"
  if (diffMins === 1) return "1 min ago"
  if (diffMins < 60) return `${diffMins} mins ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours === 1) return "1 hour ago"
  return `${diffHours} hours ago`
}

interface NavigatorCardProps {
  location: NavigatorLocation
  isSelected: boolean
  onSelect: () => void
  onViewPatient?: (patientId: string) => void
}

function NavigatorCard({ location, isSelected, onSelect, onViewPatient }: NavigatorCardProps) {
  const config = STATUS_CONFIG[location.status]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        location.status === "RISK_ALERT" && !isSelected && "border-red-300 bg-red-50/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("p-1.5 rounded-full", config.bgColor)}>
            <User className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{location.navigatorName}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(location.lastCheckIn)}
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] px-1.5 shrink-0", config.bgColor, config.color, config.borderColor)}
        >
          {config.label}
        </Badge>
      </div>

      {location.currentTask && (
        <p className="mt-2 text-xs text-muted-foreground truncate pl-8">
          {location.currentTask}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3 pl-8 text-xs text-muted-foreground">
        {location.speed !== undefined && location.speed > 0 && (
          <span className="flex items-center gap-1">
            <Navigation className="h-3 w-3" />
            {location.speed} mph
          </span>
        )}
        {location.batteryLevel !== undefined && (
          <span className={cn(
            "flex items-center gap-1",
            location.batteryLevel < 20 && "text-red-600"
          )}>
            <Battery className="h-3 w-3" />
            {location.batteryLevel}%
          </span>
        )}
      </div>

      {location.currentPatientId && onViewPatient && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 text-xs w-full justify-between"
          onClick={(e) => {
            e.stopPropagation()
            onViewPatient(location.currentPatientId!)
          }}
        >
          View Patient Record
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </button>
  )
}

export function NavigatorSafetyMap() {
  const { navigatorLocations, patients } = useDemoData()
  const { navigateTo } = useRole()
  const [selectedNavigatorId, setSelectedNavigatorId] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Sort locations by status priority (RISK_ALERT first, then IDLE, then ACTIVE)
  const sortedLocations = useMemo(() => {
    const statusOrder: Record<SafetyStatus, number> = {
      RISK_ALERT: 0,
      IDLE: 1,
      ACTIVE: 2,
    }
    return [...navigatorLocations].sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status]
    )
  }, [navigatorLocations])

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = { ACTIVE: 0, IDLE: 0, RISK_ALERT: 0 }
    navigatorLocations.forEach((loc) => {
      counts[loc.status]++
    })
    return counts
  }, [navigatorLocations])

  const selectedLocation = selectedNavigatorId
    ? navigatorLocations.find((loc) => loc.navigatorId === selectedNavigatorId)
    : null

  const handleRefresh = () => {
    // In a real app, this would fetch fresh data from the server
    setLastRefresh(new Date())
  }

  const handleViewPatient = (patientId: string) => {
    navigateTo("patient-detail", { patientId })
  }

  // Auto-select first RISK_ALERT if any
  useEffect(() => {
    if (!selectedNavigatorId) {
      const riskAlert = navigatorLocations.find((loc) => loc.status === "RISK_ALERT")
      if (riskAlert) {
        setSelectedNavigatorId(riskAlert.navigatorId)
      }
    }
  }, [navigatorLocations, selectedNavigatorId])

  return (
    <div className="h-[calc(100vh-12rem)] grid grid-cols-[350px_1fr] gap-4">
      {/* Left Panel - Navigator List */}
      <div className="flex flex-col gap-4">
        {/* Status Summary */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Team Status</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className={cn("p-2 rounded-lg text-center", STATUS_CONFIG.ACTIVE.bgColor)}>
                <p className={cn("text-xl font-bold", STATUS_CONFIG.ACTIVE.color)}>
                  {statusCounts.ACTIVE}
                </p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
              <div className={cn("p-2 rounded-lg text-center", STATUS_CONFIG.IDLE.bgColor)}>
                <p className={cn("text-xl font-bold", STATUS_CONFIG.IDLE.color)}>
                  {statusCounts.IDLE}
                </p>
                <p className="text-[10px] text-muted-foreground">Idle</p>
              </div>
              <div className={cn("p-2 rounded-lg text-center", STATUS_CONFIG.RISK_ALERT.bgColor)}>
                <p className={cn("text-xl font-bold", STATUS_CONFIG.RISK_ALERT.color)}>
                  {statusCounts.RISK_ALERT}
                </p>
                <p className="text-[10px] text-muted-foreground">At Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Alert Banner */}
        {statusCounts.RISK_ALERT > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">
                {statusCounts.RISK_ALERT} Navigator{statusCounts.RISK_ALERT > 1 ? "s" : ""} Need Attention
              </p>
              <p className="text-xs text-red-600">No check-in for 30+ minutes</p>
            </div>
          </div>
        )}

        {/* Navigator List */}
        <Card className="flex-1 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Field Team ({navigatorLocations.length})
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100%-3.5rem)]">
            <div className="p-3 pt-0 space-y-2">
              {sortedLocations.map((location) => (
                <NavigatorCard
                  key={location.id}
                  location={location}
                  isSelected={selectedNavigatorId === location.navigatorId}
                  onSelect={() => setSelectedNavigatorId(location.navigatorId)}
                  onViewPatient={handleViewPatient}
                />
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Right Panel - Map */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Live Map View</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-emerald-500" />
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-3.5rem)]">
          <MapComponent
            locations={navigatorLocations}
            selectedNavigatorId={selectedNavigatorId}
            onSelectNavigator={setSelectedNavigatorId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
