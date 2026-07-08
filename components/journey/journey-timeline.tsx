"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, ClipboardCheck, LogOut, PhoneCall, Route } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { JOURNEY_PHASE_CONFIG } from "@/lib/journey"
import type { JourneyPhase } from "@/lib/types"

const PHASE_ICONS: Record<JourneyPhase, React.ReactNode> = {
  intake: <ClipboardCheck className="h-4 w-4" />,
  active: <Activity className="h-4 w-4" />,
  telenavigation: <PhoneCall className="h-4 w-4" />,
  exited: <LogOut className="h-4 w-4" />,
}

const PHASE_ICON_CLASSES: Record<JourneyPhase, string> = {
  intake: "bg-blue-50 border-blue-200 text-blue-600",
  active: "bg-emerald-50 border-emerald-200 text-emerald-600",
  telenavigation: "bg-violet-50 border-violet-200 text-violet-600",
  exited: "bg-slate-50 border-slate-200 text-slate-500",
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Vertical timeline of a patient's journey phase transitions (JourneyEvents),
 * referral conversion through exit. Same visual language as the Activity
 * Timeline tab in patient-profile.
 */
export function JourneyTimeline({ patientId }: { patientId: string }) {
  const { journeyEvents } = useDemoData()

  const events = journeyEvents
    .filter((event) => event.patientId === patientId)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Route className="h-4 w-4" />
          Journey Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No journey events recorded
          </p>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
            <div className="space-y-6">
              {events.map((event) => (
                <div key={event.id} className="relative flex gap-4">
                  <div
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${PHASE_ICON_CLASSES[event.toPhase]}`}
                  >
                    {PHASE_ICONS[event.toPhase]}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">
                        {event.fromPhase === "referral"
                          ? "Referral converted"
                          : `${JOURNEY_PHASE_CONFIG[event.fromPhase].label} → ${JOURNEY_PHASE_CONFIG[event.toPhase].label}`}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatEventDate(event.at)}
                      </span>
                    </div>
                    {event.reason && (
                      <p className="text-sm text-muted-foreground mt-1">{event.reason}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${JOURNEY_PHASE_CONFIG[event.toPhase].className}`}
                      >
                        {JOURNEY_PHASE_CONFIG[event.toPhase].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">by {event.actorName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
