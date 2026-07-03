"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  FileText,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Users,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import type { PatientNote } from "@/lib/types"

type RiskFilter = "all" | "1" | "2" | "3"

export function NavigatorPatients() {
  const { navigateTo, currentUser } = useRole()
  const { patients, navigators, addNote, getPatientNotes, lastAssignedPatientId } = useDemoData()

  // Resolve the logged-in navigator (fall back to first for safety)
  const currentNavigator = navigators.find((n) => n.id === currentUser?.id) || navigators[0]

  const [search, setSearch] = useState("")
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all")
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")
  const [noteType, setNoteType] = useState<PatientNote["type"]>("general")

  const myPatients = patients
    .filter((p) => p.assignedNavigator === currentNavigator.id)
    .sort((a, b) => {
      if (a.id === lastAssignedPatientId) return -1
      if (b.id === lastAssignedPatientId) return 1
      return b.riskLevel - a.riskLevel
    })

  const filteredPatients = myPatients.filter((p) => {
    const matchesRisk = riskFilter === "all" || String(p.riskLevel) === riskFilter
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.chartNumber.toLowerCase().includes(q) ||
      p.healthPlan.toLowerCase().includes(q)
    return matchesRisk && matchesSearch
  })

  const highRiskCount = myPatients.filter((p) => p.riskLevel === 3).length
  const gapCount = myPatients.filter(
    (p) => Math.floor((Date.now() - new Date(p.lastContactDate).getTime()) / (1000 * 60 * 60 * 24)) > 14,
  ).length

  const selectedPatientNotes = selectedPatient ? getPatientNotes(selectedPatient) : []

  const handleSaveNote = () => {
    if (selectedPatient && noteText.trim()) {
      addNote(
        selectedPatient,
        noteText.trim(),
        noteType,
        currentNavigator.id,
        currentNavigator.name,
        "navigator",
      )
      setNoteText("")
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{myPatients.length}</p>
              <p className="text-xs text-muted-foreground">Total Patients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{highRiskCount}</p>
              <p className="text-xs text-muted-foreground">High Risk (L3)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{gapCount}</p>
              <p className="text-xs text-muted-foreground">Contact Gaps (&gt;14d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">My Patients</CardTitle>
          <CardDescription>
            Search your roster, then click a patient to add a quick note or open the full profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search + filter toolbar */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, chart number, or health plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <Select value={riskFilter} onValueChange={(v: RiskFilter) => setRiskFilter(v)}>
              <SelectTrigger className="w-full sm:w-44 bg-card">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="3">High Risk (L3)</SelectItem>
                <SelectItem value="2">Medium Risk (L2)</SelectItem>
                <SelectItem value="1">Low Risk (L1)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Roster */}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                <div className="col-span-5">Patient</div>
                <div className="col-span-3 text-center">Last Contact</div>
                <div className="col-span-4 text-right">Next Visit</div>
              </div>

              {filteredPatients.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                  No patients match your search.
                </div>
              ) : (
                filteredPatients.map((patient) => {
                  const nextAppointment = patient.upcomingAppointments
                    .filter((apt) => apt.status === "scheduled")
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
                  const daysSinceContact = Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(patient.lastContactDate).getTime()) / (1000 * 60 * 60 * 24),
                    ),
                  )
                  const contactWarning = daysSinceContact > 14

                  return (
                    <div
                      key={patient.id}
                      onClick={() => setSelectedPatient(selectedPatient === patient.id ? null : patient.id)}
                      className={cn(
                        "grid grid-cols-12 gap-2 cursor-pointer items-center rounded-lg border p-3 transition-colors",
                        selectedPatient === patient.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-secondary/50",
                      )}
                    >
                      <div className="col-span-5 flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium shrink-0",
                            patient.riskLevel === 3
                              ? "bg-destructive/10 text-destructive"
                              : patient.riskLevel === 2
                                ? "bg-warning/10 text-warning"
                                : "bg-primary/10 text-primary",
                          )}
                        >
                          L{patient.riskLevel}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-card-foreground text-sm truncate">{patient.name}</p>
                            {patient.id === lastAssignedPatientId && (
                              <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 animate-pulse flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" />
                                New
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {patient.chartNumber} · {patient.healthPlan}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-3 text-center">
                        <p
                          className={cn(
                            "text-xs font-medium",
                            contactWarning ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago`}
                        </p>
                        {contactWarning && <p className="text-[10px] text-destructive">Gap detected</p>}
                      </div>

                      <div className="col-span-4 flex items-center justify-end gap-2">
                        {nextAppointment ? (
                          <div className="text-right">
                            <p className="text-xs font-medium text-card-foreground">
                              {new Date(nextAppointment.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {nextAppointment.type.replace("_", " ")}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-warning text-warning">
                            No visit scheduled
                          </Badge>
                        )}
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                            selectedPatient === patient.id && "rotate-90",
                          )}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Quick Note panel */}
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              {selectedPatient ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-medium text-card-foreground">
                        Quick Note - {patients.find((p) => p.id === selectedPatient)?.name}
                      </h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateTo("patient-detail", { patientId: selectedPatient })}
                      className="gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Profile
                    </Button>
                  </div>

                  <Select value={noteType} onValueChange={(value: PatientNote["type"]) => setNoteType(value)}>
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue placeholder="Note Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Note</SelectItem>
                      <SelectItem value="clinical">Clinical Note</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="visit">Visit Note</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>

                  <Textarea
                    placeholder="Enter visit notes, observations, or follow-up items..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="min-h-[100px] resize-none bg-card"
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleSaveNote} disabled={!noteText.trim()}>
                      Save Note
                    </Button>
                    <Button variant="outline" onClick={() => setNoteText("")}>
                      Clear
                    </Button>
                  </div>

                  {selectedPatientNotes.length > 0 && (
                    <div className="border-t border-border pt-4 mt-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recent Notes</p>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {selectedPatientNotes.slice(0, 3).map((note) => (
                          <div key={note.id} className="rounded bg-card p-2 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {note.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(note.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-card-foreground line-clamp-2">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground">
                  <p>Select a patient to add notes</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
