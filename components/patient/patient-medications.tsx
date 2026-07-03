"use client"

import { differenceInDays, parseISO, format } from "date-fns"
import { Pill, AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import type { Medication } from "@/lib/types"

// Deterministic hash from a medication id — stable across renders (no randomness)
function hashMedicationId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// 1-2 missed day indices (0-6) derived from the medication id
function getMissedDayIndices(medicationId: string): Set<number> {
  const hash = hashMedicationId(medicationId)
  return new Set([hash % 7, (hash >> 3) % 7])
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]

function MedicationWeekRow({ medication }: { medication: Medication }) {
  const missedDays = medication.compliance ? new Set<number>() : getMissedDayIndices(medication.id)

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        {medication.compliance ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
        )}
        <span className="text-sm font-medium truncate">{medication.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {DAY_LABELS.map((label, dayIndex) => (
          <div key={dayIndex} className="flex flex-col items-center gap-1">
            <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                missedDays.has(dayIndex)
                  ? "border border-red-300 bg-red-100"
                  : "bg-green-500"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function ComplianceTracker({ medications }: { medications: Medication[] }) {
  const compliantMeds = medications.filter(m => m.compliance).length
  const totalMeds = medications.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Weekly Compliance
        </CardTitle>
        <CardDescription>
          How consistently you&apos;re taking your medications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">
            {compliantMeds} of {totalMeds} medications on track
          </span>
          <Badge
            variant={
              compliantMeds === totalMeds
                ? "default"
                : compliantMeds >= totalMeds / 2
                  ? "secondary"
                  : "destructive"
            }
          >
            {compliantMeds === totalMeds
              ? "On Track"
              : compliantMeds >= totalMeds / 2
                ? "Needs Attention"
                : "Action Needed"}
          </Badge>
        </div>
        {totalMeds === 0 ? (
          <p className="text-sm text-muted-foreground">No medications to track yet.</p>
        ) : (
          <div className="space-y-3">
            {medications.map(medication => (
              <MedicationWeekRow key={medication.id} medication={medication} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Estimated from your medication refill compliance — not a daily log.
        </p>
      </CardContent>
    </Card>
  )
}

function MedicationCard({ medication }: { medication: Medication }) {
  const today = new Date()
  const refillDate = parseISO(medication.nextRefillDate)
  const daysUntilRefill = differenceInDays(refillDate, today)

  const getRefillStatus = () => {
    if (daysUntilRefill < 0) {
      return { label: "Refill Overdue", variant: "destructive" as const, urgent: true }
    } else if (daysUntilRefill <= 3) {
      return { label: "Refill Soon", variant: "secondary" as const, urgent: true }
    } else if (daysUntilRefill <= 7) {
      return { label: "Refill Coming", variant: "outline" as const, urgent: false }
    }
    return { label: "On Track", variant: "default" as const, urgent: false }
  }

  const refillStatus = getRefillStatus()

  return (
    <Card className={refillStatus.urgent ? "border-orange-200 bg-orange-50/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${medication.compliance ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              <Pill className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{medication.name}</span>
                {!medication.compliance && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Missed
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {medication.dosage} • {medication.frequency}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={refillStatus.variant}>{refillStatus.label}</Badge>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Next Refill:</span>
            <span className="font-medium">{format(refillDate, "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={`font-medium ${daysUntilRefill < 0 ? "text-red-600" : daysUntilRefill <= 3 ? "text-orange-600" : "text-muted-foreground"}`}>
              {daysUntilRefill < 0
                ? `${Math.abs(daysUntilRefill)} days overdue`
                : daysUntilRefill === 0
                  ? "Today"
                  : daysUntilRefill === 1
                    ? "Tomorrow"
                    : `${daysUntilRefill} days`
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PatientMedications() {
  const { currentUser } = useRole()
  const { getPatient } = useDemoData()

  if (!currentUser) return null

  const patient = getPatient(currentUser.id)
  const medications = patient?.medications || []

  // Sort medications by refill urgency
  const sortedMedications = [...medications].sort((a, b) => {
    const daysA = differenceInDays(parseISO(a.nextRefillDate), new Date())
    const daysB = differenceInDays(parseISO(b.nextRefillDate), new Date())
    return daysA - daysB
  })

  const needsRefillSoon = medications.filter(m => {
    const daysUntilRefill = differenceInDays(parseISO(m.nextRefillDate), new Date())
    return daysUntilRefill <= 7
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Medications</h2>
        <p className="text-muted-foreground">Track your medications and upcoming refills</p>
      </div>

      {/* Compliance Tracker */}
      <ComplianceTracker medications={medications} />

      {/* Refill Alerts */}
      {needsRefillSoon.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Refills Needed Soon</p>
                <p className="text-sm text-orange-700">
                  {needsRefillSoon.length === 1
                    ? `${needsRefillSoon[0].name} needs to be refilled soon.`
                    : `${needsRefillSoon.length} medications need refills within the next week.`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Medications List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Medications</CardTitle>
          <CardDescription>
            Your prescribed medications and refill schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedMedications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No medications on file</p>
              <p className="text-sm">Your navigator will help you manage your prescriptions</p>
            </div>
          ) : (
            sortedMedications.map(medication => (
              <MedicationCard key={medication.id} medication={medication} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
