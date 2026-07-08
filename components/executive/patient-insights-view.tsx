"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, Activity, HeartPulse, HandHeart, X } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { getICD10Code } from "@/lib/icd10-codes"
import { cn } from "@/lib/utils"
import type { Patient } from "@/lib/types"

const CONDITION_GROUPS = [
  { id: "diabetes", label: "Diabetes", prefixes: ["E08", "E09", "E10", "E11", "E13"] },
  { id: "hypertension", label: "Hypertension", prefixes: ["I10", "I11", "I12", "I13", "I15"] },
  { id: "copd", label: "COPD", prefixes: ["J44"] },
  { id: "oncology", label: "Oncology", prefixes: ["C"] },
  { id: "behavioral", label: "Behavioral Health", prefixes: ["F"] },
]

const RISK_TIERS = [
  { level: 1 as const, label: "L1 · Low", className: "bg-emerald-100 text-emerald-700" },
  { level: 2 as const, label: "L2 · Medium", className: "bg-amber-100 text-amber-700" },
  { level: 3 as const, label: "L3 · High", className: "bg-red-100 text-red-700" },
]

type InsightFilter =
  | { type: "condition"; id: string; label: string }
  | { type: "risk"; level: 1 | 2 | 3; label: string }
  | { type: "barrier"; code: string; label: string }

function matchesCondition(patient: Patient, prefixes: string[]): boolean {
  return !!patient.icdCodes?.some((code) =>
    prefixes.some((prefix) => code.toUpperCase().startsWith(prefix))
  )
}

function matchedCodes(patient: Patient, prefixes: string[]): string[] {
  return (patient.icdCodes ?? []).filter((code) =>
    prefixes.some((prefix) => code.toUpperCase().startsWith(prefix))
  )
}

export function PatientInsightsView() {
  const { patients, intakeRecords, appointments, isHydrated } = useDemoData()
  const [filter, setFilter] = useState<InsightFilter | null>(null)

  const visitCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const apt of appointments) {
      if (apt.status !== "completed") continue
      counts.set(apt.patientId, (counts.get(apt.patientId) ?? 0) + 1)
    }
    return counts
  }, [appointments])

  const totalVisits = useMemo(
    () => [...visitCounts.values()].reduce((sum, n) => sum + n, 0),
    [visitCounts]
  )

  const conditionCounts = useMemo(
    () =>
      CONDITION_GROUPS.map((group) => ({
        ...group,
        count: patients.filter((p) => matchesCondition(p, group.prefixes)).length,
      })),
    [patients]
  )

  const riskCounts = useMemo(
    () =>
      RISK_TIERS.map((tier) => ({
        ...tier,
        count: patients.filter((p) => p.riskLevel === tier.level).length,
      })),
    [patients]
  )

  const barrierPrevalence = useMemo(() => {
    const byCode = new Map<
      string,
      { code: string; description: string; category: string; patientIds: Set<string> }
    >()
    for (const intake of intakeRecords) {
      for (const zCode of intake.identifiedBarriers) {
        const entry = byCode.get(zCode.code) ?? {
          code: zCode.code,
          description: zCode.description,
          category: zCode.category,
          patientIds: new Set<string>(),
        }
        entry.patientIds.add(intake.patientId)
        byCode.set(zCode.code, entry)
      }
    }
    return [...byCode.values()].sort((a, b) => b.patientIds.size - a.patientIds.size)
  }, [intakeRecords])

  const patientsWithBarriers = useMemo(() => {
    const ids = new Set<string>()
    for (const barrier of barrierPrevalence) barrier.patientIds.forEach((id) => ids.add(id))
    return ids.size
  }, [barrierPrevalence])

  const filteredPatients = useMemo(() => {
    if (!filter) return []
    if (filter.type === "condition") {
      const group = CONDITION_GROUPS.find((g) => g.id === filter.id)
      return group ? patients.filter((p) => matchesCondition(p, group.prefixes)) : []
    }
    if (filter.type === "risk") {
      return patients.filter((p) => p.riskLevel === filter.level)
    }
    const barrier = barrierPrevalence.find((b) => b.code === filter.code)
    return barrier ? patients.filter((p) => barrier.patientIds.has(p.id)) : []
  }, [filter, patients, barrierPrevalence])

  const filterPrefixes =
    filter?.type === "condition"
      ? CONDITION_GROUPS.find((g) => g.id === filter.id)?.prefixes ?? []
      : []

  const activeCensus = patients.filter((p) => p.survivalStatus === "active").length
  const maxBarrierCount = barrierPrevalence[0]?.patientIds.size ?? 0

  if (!isHydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading patient insights...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Population stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Census"
          value={activeCensus}
          subtitle={`of ${patients.length} total patients`}
          icon={Users}
        />
        <StatCard
          title="Completed Visits"
          value={totalVisits}
          subtitle="all appointment types"
          icon={Activity}
        />
        <StatCard
          title="High-Risk Patients"
          value={riskCounts.find((t) => t.level === 3)?.count ?? 0}
          subtitle="L3 risk tier"
          icon={HeartPulse}
          variant="destructive"
        />
        <StatCard
          title="Patients with SDOH Barriers"
          value={patientsWithBarriers}
          subtitle={`${barrierPrevalence.length} distinct Z-codes documented`}
          icon={HandHeart}
          variant="warning"
        />
      </div>

      {/* Condition click-boxes */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Conditions</CardTitle>
          <CardDescription>
            ICD-10 prefix cohorts across the census — click a box to see the patients behind the
            number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {conditionCounts.map((group) => {
              const selected = filter?.type === "condition" && filter.id === group.id
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() =>
                    setFilter(
                      selected ? null : { type: "condition", id: group.id, label: group.label }
                    )
                  }
                  className={cn(
                    "rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50",
                    selected && "border-primary ring-2 ring-primary/30"
                  )}
                >
                  <p className="text-3xl font-bold text-card-foreground">{group.count}</p>
                  <p className="mt-1 text-sm font-medium text-card-foreground">{group.label}</p>
                  <p className="text-xs text-muted-foreground">
                    ICD-10 {group.prefixes.length > 1 ? `${group.prefixes[0]}–${group.prefixes[group.prefixes.length - 1]}` : `${group.prefixes[0]}*`}
                  </p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk tier distribution */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Risk-Tier Distribution</CardTitle>
            <CardDescription>Acuity tiers across all patients — click to filter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {riskCounts.map((tier) => {
                const selected = filter?.type === "risk" && filter.level === tier.level
                return (
                  <button
                    key={tier.level}
                    type="button"
                    onClick={() =>
                      setFilter(
                        selected ? null : { type: "risk", level: tier.level, label: tier.label }
                      )
                    }
                    className={cn(
                      "rounded-lg border border-border bg-card p-4 text-center transition-colors hover:bg-muted/50",
                      selected && "border-primary ring-2 ring-primary/30"
                    )}
                  >
                    <p className="text-3xl font-bold text-card-foreground">{tier.count}</p>
                    <Badge variant="secondary" className={cn("mt-2", tier.className)}>
                      {tier.label}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* SDOH barrier prevalence */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">SDOH Barrier Prevalence</CardTitle>
            <CardDescription>
              Z-codes documented at intake — click a barrier to filter
            </CardDescription>
          </CardHeader>
          <CardContent>
            {barrierPrevalence.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No SDOH barriers documented in intake records yet
              </p>
            ) : (
              <div className="space-y-2">
                {barrierPrevalence.map((barrier) => {
                  const selected = filter?.type === "barrier" && filter.code === barrier.code
                  return (
                    <button
                      key={barrier.code}
                      type="button"
                      onClick={() =>
                        setFilter(
                          selected
                            ? null
                            : { type: "barrier", code: barrier.code, label: barrier.description }
                        )
                      }
                      className={cn(
                        "w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50",
                        selected && "border-primary ring-2 ring-primary/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-card-foreground">
                            {barrier.description}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {barrier.code}
                          </Badge>
                        </div>
                        <span className="text-sm font-semibold text-card-foreground">
                          {barrier.patientIds.size}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{
                            width: `${maxBarrierCount > 0 ? (barrier.patientIds.size / maxBarrierCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inline patient list panel */}
      <Card className="bg-card">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-card-foreground">
              {filter ? `Patients — ${filter.label}` : "Patient Drill-Down"}
            </CardTitle>
            <CardDescription>
              {filter
                ? `${filteredPatients.length} matching patient${filteredPatients.length === 1 ? "" : "s"} · inline roster — patient charts are not accessible from the executive workspace`
                : "Select a condition, risk tier, or barrier above to see the matching patients"}
            </CardDescription>
          </div>
          {filter && (
            <Button variant="ghost" size="sm" onClick={() => setFilter(null)} className="gap-1">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </CardHeader>
        {filter && (
          <CardContent>
            {filteredPatients.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No patients match this filter</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Patient</TableHead>
                    <TableHead className="text-center text-muted-foreground">Risk</TableHead>
                    <TableHead className="text-center text-muted-foreground">Phase</TableHead>
                    <TableHead className="text-center text-muted-foreground">Visits</TableHead>
                    <TableHead className="text-muted-foreground">
                      {filter.type === "condition" ? "Matched Diagnoses" : "Primary Diagnosis"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id} className="border-border">
                      <TableCell>
                        <p className="font-medium text-card-foreground">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.chartNumber}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            patient.riskLevel === 3 && "bg-red-100 text-red-700",
                            patient.riskLevel === 2 && "bg-amber-100 text-amber-700",
                            patient.riskLevel === 1 && "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          L{patient.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="capitalize">
                          {patient.journeyPhase}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-card-foreground">
                        {visitCounts.get(patient.id) ?? 0}
                      </TableCell>
                      <TableCell>
                        {filter.type === "condition" ? (
                          <div className="space-y-0.5">
                            {matchedCodes(patient, filterPrefixes).map((code) => (
                              <p key={code} className="text-xs text-muted-foreground">
                                <span className="font-mono text-card-foreground">{code}</span>{" "}
                                {getICD10Code(code)?.description ?? patient.primaryDiagnosis ?? ""}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {patient.primaryDiagnosis ?? "—"}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
