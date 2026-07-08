"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Clock,
  User,
  Calendar,
  FileText,
  Phone,
  Video,
  Users,
  Stethoscope,
  AlertCircle,
  Pin,
  Link2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PatientNote } from "@/lib/types"

interface NoteDetailModalProps {
  note: PatientNote | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NOTE_TYPE_CONFIG = {
  clinical: { label: "Clinical", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope },
  visit: { label: "Visit", className: "bg-green-100 text-green-700 border-green-200", icon: Users },
  phone: { label: "Phone", className: "bg-purple-100 text-purple-700 border-purple-200", icon: Phone },
  "follow-up": { label: "Follow-up", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Calendar },
  general: { label: "General", className: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
  supervision: { label: "Supervision", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Pin },
}

const MODALITY_ICONS = {
  "In-Person": Users,
  "Phone": Phone,
  "Video": Video,
}

export function NoteDetailModal({ note, open, onOpenChange }: NoteDetailModalProps) {
  if (!note) return null

  const typeConfig = NOTE_TYPE_CONFIG[note.type] || NOTE_TYPE_CONFIG.general
  const TypeIcon = typeConfig.icon

  // Extract billing metadata from responses
  const modality = note.responses?._modality as string | undefined
  const barrierAddressed = note.responses?._barrierAddressed as string | undefined
  const goalAlignment = note.responses?._goalAlignment as string | undefined
  const ModalityIcon = modality ? MODALITY_ICONS[modality as keyof typeof MODALITY_ICONS] : null

  // Get structured responses (excluding internal _fields)
  const structuredResponses = note.responses
    ? Object.entries(note.responses).filter(([key]) => !key.startsWith("_"))
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[800px] w-[90vw] !max-h-[85vh] !h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", typeConfig.className.replace("text-", "bg-").split(" ")[0])}>
                <TypeIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", typeConfig.className)}>
                    {note.type === "supervision" && <Pin className="h-3 w-3 mr-1" />}
                    {typeConfig.label}
                  </Badge>
                  {note.linkedNoteId && (
                    <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200">
                      <Link2 className="h-3 w-3 mr-1" />
                      Same-day continuation
                    </Badge>
                  )}
                  {note.billable === false && (
                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                      Non-billable
                    </Badge>
                  )}
                  {note.templateName && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {note.templateName}
                    </span>
                  )}
                </DialogTitle>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {note.authorName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(note.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 py-4 pr-4">
            {/* Billing & Time Information (if present) */}
            {(modality || note.duration || note.startTime || barrierAddressed) && (
              <Card className="bg-blue-50/50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Billing Information
                    {note.timeSource && note.timeSource !== "timer" && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                        {note.timeSource === "manual" ? "Manual Entry" : "Edited"}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {/* Visit Time - Prominently displayed for audit compliance */}
                    {(note.startTime || note.endTime) && (
                      <div className="col-span-2 bg-white/60 rounded-lg p-2 border border-blue-100">
                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Visit Time</p>
                        <p className="font-semibold text-blue-800">
                          {note.startTime ? new Date(note.startTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          }) : "--:--"}
                          {" "}-{" "}
                          {note.endTime ? new Date(note.endTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          }) : "--:--"}
                          {note.duration && (
                            <span className="text-sm font-normal text-muted-foreground ml-2">
                              ({note.duration} min)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    {/* Duration fallback if no start/end times */}
                    {!note.startTime && !note.endTime && note.duration && (
                      <div>
                        <p className="text-muted-foreground text-xs">Duration</p>
                        <p className="font-medium">{note.duration} minutes</p>
                      </div>
                    )}
                    {modality && (
                      <div>
                        <p className="text-muted-foreground text-xs">Modality</p>
                        <p className="font-medium flex items-center gap-1">
                          {ModalityIcon && <ModalityIcon className="h-3 w-3" />}
                          {modality}
                        </p>
                      </div>
                    )}
                    {barrierAddressed && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Barrier Addressed</p>
                        <p className="font-medium font-mono text-xs">{barrierAddressed}</p>
                      </div>
                    )}
                    {goalAlignment && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Goal Alignment</p>
                        <p className="font-medium text-xs">{goalAlignment}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Content */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Note Content
              </h3>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Structured Responses (if from template) */}
            {structuredResponses.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Structured Data
                </h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="grid gap-3">
                      {structuredResponses.map(([key, value]) => (
                        <div key={key} className="flex justify-between items-start border-b border-border/50 pb-2 last:border-0 last:pb-0">
                          <span className="text-sm text-muted-foreground capitalize">
                            {key.replace(/-/g, " ")}
                          </span>
                          <span className="text-sm font-medium text-right max-w-[60%]">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
