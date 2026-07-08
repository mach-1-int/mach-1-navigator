"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Clock,
  User,
  Calendar,
  FileText,
  Phone,
  Video,
  Users,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PatientNote } from "@/lib/types"

interface ExpandableNoteCardProps {
  note: PatientNote
}

const NOTE_TYPE_CONFIG = {
  clinical: { label: "Clinical", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope },
  visit: { label: "Visit", className: "bg-green-100 text-green-700 border-green-200", icon: Users },
  phone: { label: "Phone", className: "bg-purple-100 text-purple-700 border-purple-200", icon: Phone },
  "follow-up": { label: "Follow-up", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Calendar },
  general: { label: "General", className: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
  supervision: { label: "Supervision", className: "bg-amber-100 text-amber-700 border-amber-200", icon: FileText },
}

const MODALITY_ICONS = {
  "In-Person": Users,
  "Phone": Phone,
  "Video": Video,
}

export function ExpandableNoteCard({ note }: ExpandableNoteCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const typeConfig = NOTE_TYPE_CONFIG[note.type] || NOTE_TYPE_CONFIG.general
  const TypeIcon = typeConfig.icon

  // Extract billing metadata
  const modality = note.responses?._modality as string | undefined
  const barrierAddressed = note.responses?._barrierAddressed as string | undefined
  const ModalityIcon = modality ? MODALITY_ICONS[modality as keyof typeof MODALITY_ICONS] : null

  // Get structured responses (excluding internal _fields)
  const structuredResponses = note.responses
    ? Object.entries(note.responses).filter(([key]) => !key.startsWith("_"))
    : []

  // Truncate content for preview
  const previewContent = note.content.length > 150
    ? note.content.slice(0, 150) + "..."
    : note.content

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "transition-all",
        isOpen && "ring-2 ring-primary/20 shadow-md"
      )}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left">
            <CardContent className="p-4">
              {/* Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-md shrink-0",
                    typeConfig.className.replace("text-", "bg-").split(" ")[0]
                  )}>
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Type & Template Badge Row */}
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-xs", typeConfig.className)}>
                        {typeConfig.label}
                      </Badge>
                      {note.templateName && (
                        <span className="text-xs text-muted-foreground truncate">
                          {note.templateName}
                        </span>
                      )}
                    </div>

                    {/* Preview Content */}
                    <p className={cn(
                      "text-sm text-muted-foreground",
                      !isOpen && "line-clamp-2"
                    )}>
                      {isOpen ? "" : previewContent}
                    </p>

                    {/* Meta Row */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {note.authorName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(note.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {/* Show visit time range if available (audit-proof) */}
                      {note.startTime && note.endTime ? (
                        <span className="flex items-center gap-1 text-blue-600 font-medium">
                          <Clock className="h-3 w-3" />
                          {new Date(note.startTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                          {" - "}
                          {new Date(note.endTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                          {note.duration && <span className="text-muted-foreground ml-1">({note.duration} min)</span>}
                        </span>
                      ) : note.duration ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {note.duration} min
                        </span>
                      ) : null}
                      {modality && (
                        <span className="flex items-center gap-1">
                          {ModalityIcon && <ModalityIcon className="h-3 w-3" />}
                          {modality}
                        </span>
                      )}
                      {note.timeSource && note.timeSource !== "timer" && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-200">
                          {note.timeSource === "manual" ? "Manual" : "Edited"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expand/Collapse Indicator */}
                <div className={cn(
                  "p-1 rounded-md transition-colors shrink-0",
                  isOpen ? "bg-primary/10" : "bg-muted"
                )}>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0">
            <Separator className="mb-4" />

            {/* Full Content */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  FULL NOTE
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                  {note.content}
                </p>
              </div>

              {/* Billing Info */}
              {(modality || barrierAddressed || note.duration || note.startTime) && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                    BILLING DETAILS
                  </h4>
                  {/* Visit Time - Prominently displayed for audit compliance */}
                  {note.startTime && note.endTime && (
                    <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 mb-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Visit Time</p>
                      <p className="font-semibold text-blue-800">
                        {new Date(note.startTime).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                        {" - "}
                        {new Date(note.endTime).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                        {note.duration && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({note.duration} minutes)
                          </span>
                        )}
                      </p>
                      {note.timeSource && note.timeSource !== "timer" && (
                        <p className="text-xs text-amber-600 mt-1">
                          {note.timeSource === "manual" ? "Times entered manually" : "Times were adjusted"}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {modality && (
                      <Badge variant="secondary" className="text-xs">
                        {ModalityIcon && <ModalityIcon className="h-3 w-3 mr-1" />}
                        {modality}
                      </Badge>
                    )}
                    {!note.startTime && note.duration && (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {note.duration} minutes
                      </Badge>
                    )}
                    {barrierAddressed && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {barrierAddressed}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Structured Responses */}
              {structuredResponses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    STRUCTURED DATA
                  </h4>
                  <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                    {structuredResponses.map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/-/g, " ")}
                        </span>
                        <span className="font-medium">
                          {Array.isArray(value) ? value.join(", ") : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

interface ExpandableNoteListProps {
  notes: PatientNote[]
  emptyMessage?: string
}

export function ExpandableNoteList({ notes, emptyMessage = "No notes available" }: ExpandableNoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <ExpandableNoteCard key={note.id} note={note} />
      ))}
    </div>
  )
}
