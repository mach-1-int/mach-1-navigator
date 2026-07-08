"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ADVERSE_EVENT_OVERLAY_CONFIG,
  JOURNEY_PHASE_CONFIG,
  getAdverseEventOverlay,
} from "@/lib/journey"
import type { Patient } from "@/lib/types"

interface PhaseChipProps {
  patient: Patient
  /** Compact mode for dense roster rows */
  compact?: boolean
  className?: string
}

/**
 * Journey phase badge with the derived adverse-event overlay dot.
 * Config lives in lib/journey.ts so the board, rosters, and the patient
 * header all render the same chip.
 */
export function PhaseChip({ patient, compact = false, className }: PhaseChipProps) {
  const config = JOURNEY_PHASE_CONFIG[patient.journeyPhase]
  const overlay = getAdverseEventOverlay(patient)

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Badge
        variant="outline"
        className={cn(config.className, compact && "text-[10px] px-1.5 py-0")}
      >
        {config.label}
      </Badge>
      {overlay && (
        <Badge
          variant="outline"
          className={cn(
            ADVERSE_EVENT_OVERLAY_CONFIG.className,
            "flex items-center gap-1",
            compact && "text-[10px] px-1.5 py-0",
          )}
          title={`Open adverse event: ${overlay.diagnosis} (${overlay.status.replace(/_/g, " ")})`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
          {ADVERSE_EVENT_OVERLAY_CONFIG.label}
        </Badge>
      )}
    </span>
  )
}
