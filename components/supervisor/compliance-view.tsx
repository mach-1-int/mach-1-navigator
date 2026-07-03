"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle2,
  Pill,
  Stethoscope,
  ChevronRight,
  TrendingDown,
  Calendar
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { cn } from "@/lib/utils"

export function ComplianceView() {
  const { patients, navigators } = useDemoData()
  const { navigateTo, currentUser } = useRole()

  // Filter to the logged-in supervisor's team
  const teamNavigators = navigators.filter(nav => nav.supervisorId === currentUser?.id)
  const teamPatients = patients.filter(p => 
    teamNavigators.some(n => n.id === p.assignedNavigator)
  )

  // Compliance categories
  const medicationRisks = teamPatients.filter(p => p.medicationCompliance < 80)
  const pcpMissed = teamPatients.filter(p => !p.pcpCompliance)
  const lowCompliance = teamPatients.filter(p => p.medicationCompliance < 50)
  const moderateCompliance = teamPatients.filter(p => p.medicationCompliance >= 50 && p.medicationCompliance < 80)

  // Calculate overall stats
  const avgMedCompliance = teamPatients.length > 0 
    ? Math.round(teamPatients.reduce((sum, p) => sum + p.medicationCompliance, 0) / teamPatients.length)
    : 0
  const pcpComplianceRate = teamPatients.length > 0
    ? Math.round((teamPatients.filter(p => p.pcpCompliance).length / teamPatients.length) * 100)
    : 0

  const getNavigatorName = (navigatorId: string) => {
    return navigators.find(n => n.id === navigatorId)?.name || "Unknown"
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Pill className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{avgMedCompliance}%</p>
                <p className="text-sm text-muted-foreground">Avg Med Compliance</p>
              </div>
            </div>
            <Progress value={avgMedCompliance} className="mt-3 h-2" />
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                <Stethoscope className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{pcpComplianceRate}%</p>
                <p className="text-sm text-muted-foreground">PCP Compliance Rate</p>
              </div>
            </div>
            <Progress value={pcpComplianceRate} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className={cn("bg-card", medicationRisks.length > 0 && "border-warning/50")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                medicationRisks.length > 0 ? "bg-warning/10" : "bg-muted"
              )}>
                <AlertTriangle className={cn(
                  "h-6 w-6",
                  medicationRisks.length > 0 ? "text-warning" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{medicationRisks.length}</p>
                <p className="text-sm text-muted-foreground">Medication Risks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("bg-card", pcpMissed.length > 0 && "border-destructive/50")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                pcpMissed.length > 0 ? "bg-destructive/10" : "bg-muted"
              )}>
                <XCircle className={cn(
                  "h-6 w-6",
                  pcpMissed.length > 0 ? "text-destructive" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-3xl font-bold text-card-foreground">{pcpMissed.length}</p>
                <p className="text-sm text-muted-foreground">PCP Missed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Compliance Lists */}
      <Tabs defaultValue="medication" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="medication" className="gap-2">
            <Pill className="h-4 w-4" />
            Medication Risks ({medicationRisks.length})
          </TabsTrigger>
          <TabsTrigger value="pcp" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            PCP Follow-up ({pcpMissed.length})
          </TabsTrigger>
        </TabsList>

        {/* Medication Risks Tab */}
        <TabsContent value="medication" className="space-y-4">
          {/* Critical - Below 50% */}
          {lowCompliance.length > 0 && (
            <Card className="bg-card border-destructive/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-destructive">Critical - Below 50%</CardTitle>
                </div>
                <CardDescription>Immediate intervention required</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowCompliance.map(patient => {
                    const navigator = getNavigatorName(patient.assignedNavigator)
                    const nonCompliantMeds = patient.medications.filter(m => !m.compliance)
                    
                    return (
                      <div 
                        key={patient.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20 cursor-pointer hover:bg-destructive/10 transition-colors"
                        onClick={() => navigateTo("patient-detail", { patientId: patient.id })}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-card-foreground">{patient.name}</p>
                            <Badge variant="secondary" className="bg-red-100 text-red-700">L{patient.riskLevel}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Navigator: {navigator} | {nonCompliantMeds.length} medication{nonCompliantMeds.length !== 1 ? "s" : ""} non-compliant
                          </p>
                          {nonCompliantMeds.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {nonCompliantMeds.slice(0, 3).map(med => (
                                <Badge key={med.id} variant="outline" className="text-xs bg-background">
                                  {med.name}
                                </Badge>
                              ))}
                              {nonCompliantMeds.length > 3 && (
                                <Badge variant="outline" className="text-xs bg-background">
                                  +{nonCompliantMeds.length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-destructive">{patient.medicationCompliance}%</p>
                            <Progress value={patient.medicationCompliance} className="h-2 w-24 mt-1 [&>div]:bg-destructive" />
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning - 50-80% */}
          {moderateCompliance.length > 0 && (
            <Card className="bg-card border-warning/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <CardTitle className="text-warning">Warning - 50-80%</CardTitle>
                </div>
                <CardDescription>Requires attention and follow-up</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {moderateCompliance.map(patient => {
                    const navigator = getNavigatorName(patient.assignedNavigator)
                    
                    return (
                      <div 
                        key={patient.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-warning/5 border border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors"
                        onClick={() => navigateTo("patient-detail", { patientId: patient.id })}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-card-foreground">{patient.name}</p>
                            <Badge variant="secondary" className={cn(
                              patient.riskLevel === 3 && "bg-red-100 text-red-700",
                              patient.riskLevel === 2 && "bg-amber-100 text-amber-700",
                              patient.riskLevel === 1 && "bg-emerald-100 text-emerald-700"
                            )}>L{patient.riskLevel}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Navigator: {navigator} | Chart: {patient.chartNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-warning">{patient.medicationCompliance}%</p>
                            <Progress value={patient.medicationCompliance} className="h-2 w-24 mt-1 [&>div]:bg-warning" />
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {medicationRisks.length === 0 && (
            <Card className="bg-card">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground">All Patients Compliant</h3>
                  <p className="text-muted-foreground max-w-md">
                    All patients in your team are meeting medication compliance targets. Great work!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PCP Follow-up Tab */}
        <TabsContent value="pcp" className="space-y-4">
          <Card className="bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-destructive" />
                <CardTitle className="text-card-foreground">PCP Follow-up Missed</CardTitle>
              </div>
              <CardDescription>Patients requiring PCP visit after hospitalization/ED</CardDescription>
            </CardHeader>
            <CardContent>
              {pcpMissed.length === 0 ? (
                <div className="flex flex-col items-center gap-3 text-center py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground">All PCP Follow-ups Complete</h3>
                  <p className="text-muted-foreground max-w-md">
                    All patients have completed their required PCP follow-up visits.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pcpMissed.map(patient => {
                    const navigator = getNavigatorName(patient.assignedNavigator)
                    const daysSinceContact = Math.floor(
                      (new Date().getTime() - new Date(patient.lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
                    )
                    
                    return (
                      <div 
                        key={patient.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20 cursor-pointer hover:bg-destructive/10 transition-colors"
                        onClick={() => navigateTo("patient-detail", { patientId: patient.id })}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-card-foreground">{patient.name}</p>
                            <Badge variant="secondary" className={cn(
                              patient.riskLevel === 3 && "bg-red-100 text-red-700",
                              patient.riskLevel === 2 && "bg-amber-100 text-amber-700",
                              patient.riskLevel === 1 && "bg-emerald-100 text-emerald-700"
                            )}>L{patient.riskLevel}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Navigator: {navigator} | Last contact: {daysSinceContact} days ago
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Needs Follow-up
                          </Badge>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
