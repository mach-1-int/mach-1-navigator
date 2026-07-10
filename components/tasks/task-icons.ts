import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  HeartPulse,
  ListChecks,
  MessageCircle,
  PhoneCall,
  Pill,
  Stethoscope,
  type LucideIcon,
} from "lucide-react"

/**
 * Shared lucide name -> component map for TASK_TYPE_CONFIG.icon strings.
 * lib/task-engine.ts stays icon-library agnostic (string names); views resolve
 * them here so the mapping lives in exactly one place.
 */
export const TASK_ICONS: Record<string, LucideIcon> = {
  PhoneCall,
  CalendarCheck,
  AlertTriangle,
  MessageCircle,
  HeartPulse,
  Stethoscope,
  Pill,
  BookOpen,
}

/** Fallback icon when a TASK_TYPE_CONFIG.icon name has no map entry. */
export const TASK_ICON_FALLBACK: LucideIcon = ListChecks
