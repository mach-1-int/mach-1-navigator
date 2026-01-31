"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Clock,
  User,
  Calendar,
  FileText,
  Phone,
  Video,
  Users,
  Stethoscope,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PatientNote } from "@/lib/types"

interface NotesSplitViewProps {
  notes: PatientNote[]
  emptyMessage?: string
}

const NOTE_TYPE_CONFIG = {
  clinical: { label: "Clinical", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope },
  visit: { label: "Visit", className: "bg-green-100 text-green-700 border-green-200", icon: Users },
  phone: { label: "Phone", className: "bg-purple-100 text-purple-700 border-purple-200", icon: Phone },
  "follow-up": { label: "Follow-up", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Calendar },
  general: { label: "General", className: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
}

const MODALITY_ICONS = {
  "In-Person": Users,
  "Phone": Phone,
  "Video": Video,
}

export function NotesSplitView({ notes, emptyMessage = "No notes available" }: NotesSplitViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  // Auto-select first note on mount or when notes change
  useEffect(() => {
    if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].id)
    } else if (notes.length > 0 && !notes.find(n => n.id === selectedNoteId)) {
      setSelectedNoteId(notes[0].id)
    }
  }, [notes, selectedNoteId])

  const selectedNote = notes.find(n => n.id === selectedNoteId)

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-[400px]">
      {/* Left Pane - Notes List */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Clinical Notes
            <Badge variant="secondary" className="ml-auto">{notes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="p-2 space-y-1">
            {notes.map((note) => {
              const isSelected = note.id === selectedNoteId
              const typeConfig = NOTE_TYPE_CONFIG[note.type] || NOTE_TYPE_CONFIG.general
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedNoteId(note.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all",
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-xs", typeConfig.className)}>
                          {typeConfig.label}
                        </Badge>
                        {isSelected && <ChevronRight className="h-3 w-3 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {note.content.slice(0, 100)}...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(note.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {" · "}
                        {note.authorName}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Right Pane - Note Detail */}
      <Card className="overflow-hidden">
        {selectedNote ? (
          <>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {selectedNote.templateName || "Clinical Note"}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {selectedNote.authorName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(selectedNote.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                {selectedNote.duration && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedNote.duration} min
                  </Badge>
                )}
              </div>
            </CardHeader>
            <ScrollArea className="h-[calc(100%-72px)]">
              <div className="p-4 space-y-4">
                {/* Billing Metadata */}
                {(() => {
                  const modality = selectedNote.responses?._modality as string | undefined
                  const barrierAddressed = selectedNote.responses?._barrierAddressed as string | undefined
                  if (!modality && !barrierAddressed) return null
                  const ModalityIcon = modality ? MODALITY_ICONS[modality as keyof typeof MODALITY_ICONS] : null
                  return (
                    <div className="flex flex-wrap gap-2">
                      {modality && (
                        <Badge variant="secondary" className="text-xs">
                          {ModalityIcon && <ModalityIcon className="h-3 w-3 mr-1" />}
                          {modality}
                        </Badge>
                      )}
                      {barrierAddressed && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {barrierAddressed.split(":")[0]}
                        </Badge>
                      )}
                    </div>
                  )
                })()}

                {/* Note Content */}
                <div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedNote.content}
                  </p>
                </div>

                {/* Structured Responses */}
                {selectedNote.responses && Object.keys(selectedNote.responses).filter(k => !k.startsWith("_")).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        STRUCTURED DATA
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(selectedNote.responses)
                          .filter(([key]) => !key.startsWith("_"))
                          .map(([key, value]) => (
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
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Select a note to view details</p>
          </div>
        )}
      </Card>
    </div>
  )
}
