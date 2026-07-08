"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { useState } from "react"
import {
  FileText,
  Phone,
  Stethoscope,
  ClipboardList,
  MessageSquare,
  Search,
  ChevronRight,
  Clock,
  User,
  Pin
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PatientNote } from "@/lib/types"

const noteTypeConfig: Record<PatientNote["type"], { icon: typeof FileText; label: string; color: string }> = {
  general: { icon: FileText, label: "General", color: "bg-muted text-muted-foreground" },
  clinical: { icon: Stethoscope, label: "Clinical", color: "bg-chart-1/10 text-chart-1" },
  phone: { icon: Phone, label: "Phone Call", color: "bg-chart-2/10 text-chart-2" },
  visit: { icon: ClipboardList, label: "Visit", color: "bg-chart-3/10 text-chart-3" },
  "follow-up": { icon: MessageSquare, label: "Follow-up", color: "bg-chart-4/10 text-chart-4" },
  supervision: { icon: Pin, label: "Supervision", color: "bg-amber-100 text-amber-700" },
}

export function ClinicalFeed() {
  const { navigateTo } = useRole()
  const { notes, patients, navigators } = useDemoData()
  const currentNavigator = navigators[0] // Emily Rodriguez
  const myPatients = patients.filter((p) => p.assignedNavigator === currentNavigator.id)
  const myPatientIds = new Set(myPatients.map(p => p.id))
  
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<PatientNote["type"] | "all">("all")

  // Get all notes for my patients, sorted by date
  const myNotes = notes
    .filter(note => myPatientIds.has(note.patientId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Apply filters
  const filteredNotes = myNotes.filter(note => {
    const patient = patients.find(p => p.id === note.patientId)
    const matchesSearch = !searchQuery || 
      patient?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === "all" || note.type === filterType
    return matchesSearch && matchesType
  })

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return "Just now"
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Supervision notes float above the feed, pinned
  const pinnedSupervisionNotes = filteredNotes.filter(note => note.type === "supervision")
  const feedNotes = filteredNotes.filter(note => note.type !== "supervision")

  // Group notes by date
  const groupedNotes = feedNotes.reduce((groups, note) => {
    const date = new Date(note.createdAt).toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(note)
    return groups
  }, {} as Record<string, typeof filteredNotes>)

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes by patient name or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as PatientNote["type"] | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(noteTypeConfig).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <config.icon className="h-3.5 w-3.5" />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Notes</p>
              <p className="text-2xl font-bold">{myNotes.length}</p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground/30" />
          </CardContent>
        </Card>
        {Object.entries(noteTypeConfig).map(([type, config]) => {
          const count = myNotes.filter(n => n.type === type).length
          return (
            <Card key={type} className={cn("border-l-4", type === "clinical" ? "border-l-chart-1" : type === "phone" ? "border-l-chart-2" : type === "visit" ? "border-l-chart-3" : type === "follow-up" ? "border-l-chart-4" : type === "supervision" ? "border-l-amber-400" : "border-l-muted")}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{config.label}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", config.color)}>
                  <config.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pinned Supervision Notes */}
      {pinnedSupervisionNotes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-700 mb-3 flex items-center gap-2">
            <Pin className="h-4 w-4" />
            Pinned — Supervision
          </h3>
          <div className="space-y-3">
            {pinnedSupervisionNotes.map((note) => {
              const patient = patients.find(p => p.id === note.patientId)
              return (
                <Card
                  key={note.id}
                  className="cursor-pointer transition-all hover:shadow-md border-l-4 border-l-amber-400 bg-amber-50/40"
                  onClick={() => navigateTo("patient-detail", { patientId: note.patientId })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-amber-100 text-amber-700">
                        <Pin className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">{patient?.name || "Unknown"}</h4>
                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                              Supervision
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(note.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{note.authorName}</span>
                            <span>•</span>
                            <span>{formatDate(note.createdAt)}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes Feed */}
      <div className="space-y-6">
        {Object.entries(groupedNotes).length === 0 && pinnedSupervisionNotes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No notes found</p>
              {searchQuery && (
                <Button variant="link" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedNotes).map(([date, dateNotes]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {date}
              </h3>
              <div className="space-y-3">
                {dateNotes.map((note) => {
                  const patient = patients.find(p => p.id === note.patientId)
                  const config = noteTypeConfig[note.type]
                  const Icon = config.icon
                  
                  return (
                    <Card 
                      key={note.id}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                      onClick={() => navigateTo("patient-detail", { patientId: note.patientId })}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Type Icon */}
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shrink-0", config.color)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-foreground">{patient?.name || "Unknown"}</h4>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {config.label}
                                </Badge>
                                {patient?.riskLevel === 3 && (
                                  <Badge variant="destructive" className="text-xs">High Risk</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatTimeAgo(note.createdAt)}</span>
                            </div>
                            
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {note.content}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span>{note.authorName}</span>
                                <span>•</span>
                                <span>{formatDate(note.createdAt)}</span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
