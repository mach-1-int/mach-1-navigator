"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Square,
  Clock,
  Pencil,
  AlertCircle,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface EncounterTimerProps {
  onTimeChange: (data: EncounterTimeData) => void
  initialData?: EncounterTimeData
  disabled?: boolean
}

export interface EncounterTimeData {
  startTime: string | null // ISO timestamp
  endTime: string | null // ISO timestamp
  durationMinutes: number
  isRunning: boolean
  timeSource?: "timer" | "manual" | "edited" // How time was captured
}

/**
 * Format time for display (e.g., "10:30 AM")
 */
function formatTimeDisplay(isoString: string | null): string {
  if (!isoString) return "--:-- --"
  const date = new Date(isoString)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/**
 * Format time for input field (HH:mm format)
 */
function formatTimeForInput(isoString: string | null): string {
  if (!isoString) return ""
  const date = new Date(isoString)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

/**
 * Parse time input (HH:mm) to ISO string using today's date
 */
function parseTimeInput(timeStr: string, referenceDate?: Date): string {
  const [hours, minutes] = timeStr.split(":").map(Number)
  const date = referenceDate ? new Date(referenceDate) : new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

/**
 * Calculate duration in minutes between two ISO timestamps
 */
function calculateDuration(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.max(0, Math.round((end - start) / 1000 / 60))
}

export function EncounterTimer({
  onTimeChange,
  initialData,
  disabled = false,
}: EncounterTimerProps) {
  const [startTime, setStartTime] = useState<string | null>(initialData?.startTime ?? null)
  const [endTime, setEndTime] = useState<string | null>(initialData?.endTime ?? null)
  const [isRunning, setIsRunning] = useState(initialData?.isRunning ?? false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [timeSource, setTimeSource] = useState<"timer" | "manual" | "edited">(initialData?.timeSource ?? "timer")

  // Inline editing state
  const [editingField, setEditingField] = useState<"start" | "end" | "duration" | null>(null)
  const [editValue, setEditValue] = useState("")

  // Quick duration input (for when timer not started)
  const [quickDuration, setQuickDuration] = useState("")

  // Calculate duration
  const durationMinutes = isRunning
    ? Math.floor(elapsedSeconds / 60)
    : calculateDuration(startTime, endTime)

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && startTime) {
      interval = setInterval(() => {
        const now = new Date().getTime()
        const start = new Date(startTime).getTime()
        setElapsedSeconds(Math.floor((now - start) / 1000))
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, startTime])

  // Notify parent of changes
  useEffect(() => {
    onTimeChange({
      startTime,
      endTime,
      durationMinutes,
      isRunning,
      timeSource,
    })
  }, [startTime, endTime, durationMinutes, isRunning, timeSource, onTimeChange])

  const handleStart = useCallback(() => {
    const now = new Date().toISOString()
    setStartTime(now)
    setEndTime(null)
    setIsRunning(true)
    setElapsedSeconds(0)
    setTimeSource("timer")
  }, [])

  const handleStop = useCallback(() => {
    const now = new Date().toISOString()
    setEndTime(now)
    setIsRunning(false)
  }, [])

  // Start editing a field
  const handleStartEdit = (field: "start" | "end" | "duration") => {
    if (isRunning || disabled) return

    if (field === "start") {
      setEditValue(formatTimeForInput(startTime))
    } else if (field === "end") {
      setEditValue(formatTimeForInput(endTime))
    } else if (field === "duration") {
      setEditValue(durationMinutes > 0 ? durationMinutes.toString() : "")
    }
    setEditingField(field)
  }

  // Save edited value
  const handleSaveEdit = () => {
    if (!editingField) return

    if (editingField === "start" && editValue) {
      const newStartTime = parseTimeInput(editValue)
      setStartTime(newStartTime)
      // If we have end time, recalculate (keep end time fixed)
      if (startTime && !endTime) {
        setTimeSource("edited")
      } else {
        setTimeSource(startTime ? "edited" : "manual")
      }
    } else if (editingField === "end" && editValue) {
      const newEndTime = parseTimeInput(editValue)
      setEndTime(newEndTime)
      setIsRunning(false)
      setTimeSource(startTime ? "edited" : "manual")
    } else if (editingField === "duration" && editValue) {
      const minutes = parseInt(editValue)
      if (!isNaN(minutes) && minutes > 0) {
        // If we have start time, calculate end time
        if (startTime) {
          const start = new Date(startTime)
          const newEndTime = new Date(start.getTime() + minutes * 60 * 1000).toISOString()
          setEndTime(newEndTime)
          setIsRunning(false)
          setTimeSource("edited")
        } else {
          // No start time - set end as now, start as now - duration
          const now = new Date()
          const newEndTime = now.toISOString()
          const newStartTime = new Date(now.getTime() - minutes * 60 * 1000).toISOString()
          setStartTime(newStartTime)
          setEndTime(newEndTime)
          setIsRunning(false)
          setTimeSource("manual")
        }
      }
    }

    setEditingField(null)
    setEditValue("")
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingField(null)
    setEditValue("")
  }

  // Handle key press in edit field
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit()
    } else if (e.key === "Escape") {
      handleCancelEdit()
    }
  }

  // Handle quick duration entry (e.g., "20" minutes)
  const handleQuickDuration = useCallback(() => {
    const minutes = parseInt(quickDuration)
    if (isNaN(minutes) || minutes <= 0) return

    // Calculate end time as now, start time as now - minutes
    const now = new Date()
    const newEndTime = now.toISOString()
    const newStartTime = new Date(now.getTime() - minutes * 60 * 1000).toISOString()

    setStartTime(newStartTime)
    setEndTime(newEndTime)
    setIsRunning(false)
    setTimeSource("manual")
    setQuickDuration("")
  }, [quickDuration])

  // Format elapsed time as MM:SS
  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Validation
  const isValidDuration = durationMinutes >= 1 || isRunning || (!startTime && !endTime)
  const isDurationExcessive = durationMinutes > 480 // 8 hours

  return (
    <Card className={cn(
      "border-2 transition-colors",
      isRunning
        ? "border-green-500 bg-green-50/50"
        : startTime && endTime
          ? "border-blue-200 bg-blue-50/30"
          : "border-muted"
    )}>
      <CardContent className="py-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className={cn(
            "p-2 rounded-lg",
            isRunning ? "bg-green-100" : "bg-muted"
          )}>
            <Clock className={cn(
              "h-4 w-4",
              isRunning ? "text-green-600 animate-pulse" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <p className="text-sm font-semibold">Visit Time</p>
            <p className="text-xs text-muted-foreground">Required for billing</p>
          </div>
          {isRunning && (
            <Badge variant="default" className="bg-green-600 animate-pulse ml-auto">
              Recording: {formatElapsed(elapsedSeconds)}
            </Badge>
          )}
        </div>

        {/* Time Fields Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Start Time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Start Time
            </label>
            {editingField === "start" ? (
              <Input
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleSaveEdit}
                autoFocus
                className="h-10"
              />
            ) : (
              <button
                onClick={() => handleStartEdit("start")}
                disabled={isRunning || disabled}
                className={cn(
                  "w-full h-10 px-3 rounded-md border text-left flex items-center justify-between group",
                  "bg-background hover:bg-muted/50 transition-colors",
                  isRunning || disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  !startTime && "text-muted-foreground"
                )}
              >
                <span className="font-medium">{formatTimeDisplay(startTime)}</span>
                {!isRunning && !disabled && (
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            )}
          </div>

          {/* End Time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              End Time
            </label>
            {editingField === "end" ? (
              <Input
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleSaveEdit}
                autoFocus
                className="h-10"
              />
            ) : (
              <button
                onClick={() => handleStartEdit("end")}
                disabled={isRunning || disabled}
                className={cn(
                  "w-full h-10 px-3 rounded-md border text-left flex items-center justify-between group",
                  "bg-background hover:bg-muted/50 transition-colors",
                  isRunning || disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  !endTime && "text-muted-foreground"
                )}
              >
                <span className="font-medium">
                  {isRunning ? "In progress..." : formatTimeDisplay(endTime)}
                </span>
                {!isRunning && !disabled && (
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Duration
            </label>
            {editingField === "duration" ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={handleSaveEdit}
                  autoFocus
                  min="1"
                  max="480"
                  className="h-10"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            ) : (
              <button
                onClick={() => handleStartEdit("duration")}
                disabled={isRunning || disabled}
                className={cn(
                  "w-full h-10 px-3 rounded-md border text-left flex items-center justify-between group",
                  "bg-background hover:bg-muted/50 transition-colors",
                  isRunning || disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                )}
              >
                <span className={cn(
                  "font-medium",
                  durationMinutes > 0 ? "text-blue-700" : "text-muted-foreground"
                )}>
                  {isRunning ? `${Math.floor(elapsedSeconds / 60)} min` :
                   durationMinutes > 0 ? `${durationMinutes} min` : "-- min"}
                </span>
                {!isRunning && !disabled && (
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          {/* Quick Duration Input - shows when no times set */}
          {!isRunning && !startTime && !endTime && (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground">Enter duration:</span>
              <Input
                type="number"
                placeholder="minutes"
                value={quickDuration}
                onChange={(e) => setQuickDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickDuration()
                }}
                className="w-20 h-9"
                min="1"
                max="480"
                disabled={disabled}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickDuration}
                disabled={disabled || !quickDuration}
              >
                Set
              </Button>
              <span className="text-muted-foreground mx-2">or</span>
            </div>
          )}

          {/* Start/Stop Button */}
          <div className="ml-auto">
            {!isRunning ? (
              <Button
                onClick={handleStart}
                disabled={disabled}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Timer
              </Button>
            ) : (
              <Button
                onClick={handleStop}
                disabled={disabled}
                variant="destructive"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Timer
              </Button>
            )}
          </div>
        </div>

        {/* Helper text */}
        {!isRunning && (startTime || endTime) && (
          <div className="mt-3 flex items-start gap-2 text-muted-foreground text-xs">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Click any time field to edit. Times are required for audit compliance.
              {timeSource === "edited" && " (Times were manually adjusted)"}
              {timeSource === "manual" && " (Times entered manually)"}
            </span>
          </div>
        )}

        {/* Validation Warnings */}
        {!isRunning && startTime && endTime && !isValidDuration && (
          <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 p-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">
              Duration must be at least 1 minute for billing purposes.
            </span>
          </div>
        )}

        {isDurationExcessive && (
          <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 p-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">
              Duration exceeds 8 hours. Please verify the times are correct.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
