"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Phone,
  Mail
} from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { cn, getInitials } from "@/lib/utils"

interface NavigatorDetailViewProps {
  navigatorId: string
}

export function NavigatorDetailView({ navigatorId }: NavigatorDetailViewProps) {
  const { navigators, patients, adverseEvents, getNudgesForNavigator, getUser, getSupervisor } = useDemoData()
  const { goBack, navigateTo } = useRole()

  const navigator = navigators.find(n => n.id === navigatorId)
  const navigatorUser = getUser(navigatorId)
  const navPatients = patients.filter(p => p.assignedNavigator === navigatorId)
  const navAdverseEvents = adverseEvents.filter(ae => 
    navPatients.some(p => p.id === ae.patientId)
  )
  const messages = getNudgesForNavigator(navigatorId)
  
  if (!navigator) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Navigator not found</p>
        <Button variant="outline" onClick={goBack} className="mt-4 bg-transparent">Go Back</Button>
      </div>
    )
  }

  // Calculate compliance gaps
  const medicationRisks = navPatients.filter(p => p.medicationCompliance < 80)
  const pcpMissed = navPatients.filter(p => !p.pcpCompliance)
  const highRiskPatients = navPatients.filter(p => p.riskLevel === 3)
  const activeAdverseEvents = navAdverseEvents.filter(ae => ae.status !== "ended")

  // Performance metrics
  const performanceMetrics = [
    { label: "MTD Units", value: navigator.mtdUnits, target: 280, format: "number" },
    { label: "Med Compliance", value: navigator.medicationCompliance, target: 95, format: "percent" },
    { label: "PCP Compliance", value: navigator.pcpCompliance, target: 90, format: "percent" },
    { label: "High-Five %", value: navigator.highFivePercentage, target: 85, format: "percent" },
  ]

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={goBack} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Navigator Directory
      </Button>

      {/* Navigator Header Card */}
      <Card className="bg-card">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {getInitials(navigator.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-card-foreground">{navigator.name}</h2>
                <Badge variant="secondary">{navigator.lengthOfService} months</Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                Care Navigator - {getSupervisor(navigator.supervisorId)?.region ?? "—"}
              </p>
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{navigatorUser?.phone ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{navigatorUser?.email ?? "—"}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {performanceMetrics.map((metric) => {
                const isBelow = metric.value < metric.target
                return (
                  <div key={metric.label} className="text-center">
                    <p className={cn(
                      "text-2xl font-bold",
                      isBelow ? "text-warning" : "text-card-foreground"
                    )}>
                      {metric.value}{metric.format === "percent" ? "%" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">Target: {metric.target}{metric.format === "percent" ? "%" : ""}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-card-foreground">{navPatients.length}</p>
                <p className="text-sm text-muted-foreground">Active Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("bg-card", medicationRisks.length > 0 && "border-warning/50")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className={cn("h-5 w-5", medicationRisks.length > 0 ? "text-warning" : "text-muted-foreground")} />
              <div>
                <p className="text-2xl font-bold text-card-foreground">{medicationRisks.length}</p>
                <p className="text-sm text-muted-foreground">Medication Risks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("bg-card", pcpMissed.length > 0 && "border-destructive/50")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className={cn("h-5 w-5", pcpMissed.length > 0 ? "text-destructive" : "text-muted-foreground")} />
              <div>
                <p className="text-2xl font-bold text-card-foreground">{pcpMissed.length}</p>
                <p className="text-sm text-muted-foreground">PCP Missed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("bg-card", activeAdverseEvents.length > 0 && "border-destructive/50")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className={cn("h-5 w-5", activeAdverseEvents.length > 0 ? "text-destructive" : "text-muted-foreground")} />
              <div>
                <p className="text-2xl font-bold text-card-foreground">{activeAdverseEvents.length}</p>
                <p className="text-sm text-muted-foreground">Active Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Details */}
      <Tabs defaultValue="patients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="patients">Patient Roster</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Gaps</TabsTrigger>
          <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
        </TabsList>

        {/* Patient Roster Tab */}
        <TabsContent value="patients">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Current Patient Roster</CardTitle>
              <CardDescription>{navPatients.length} patients assigned</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Patient</TableHead>
                    <TableHead className="text-center text-muted-foreground">Risk Level</TableHead>
                    <TableHead className="text-center text-muted-foreground">Med Compliance</TableHead>
                    <TableHead className="text-center text-muted-foreground">PCP Status</TableHead>
                    <TableHead className="text-center text-muted-foreground">Last Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {navPatients.map((patient) => (
                    <TableRow 
                      key={patient.id} 
                      className="border-border cursor-pointer hover:bg-muted/50"
                      onClick={() => navigateTo("patient-detail", { patientId: patient.id })}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-card-foreground">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.chartNumber}</p>
                        </div>
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
                        <div className="flex items-center justify-center gap-2">
                          <Progress 
                            value={patient.medicationCompliance} 
                            className={cn("h-2 w-16", patient.medicationCompliance < 80 && "[&>div]:bg-warning")}
                          />
                          <span className={cn(
                            "text-sm",
                            patient.medicationCompliance < 80 ? "text-warning" : "text-card-foreground"
                          )}>
                            {patient.medicationCompliance}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {patient.pcpCompliance ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {new Date(patient.lastContactDate).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Gaps Tab */}
        <TabsContent value="compliance">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Medication Risks */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Medication Compliance Risks
                </CardTitle>
                <CardDescription>Patients below 80% compliance</CardDescription>
              </CardHeader>
              <CardContent>
                {medicationRisks.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 py-4">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>All patients meeting compliance targets</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medicationRisks.map(patient => (
                      <div 
                        key={patient.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20 cursor-pointer hover:bg-warning/20"
                        onClick={() => navigateTo("patient-detail", { patientId: patient.id })}
                      >
                        <div>
                          <p className="font-medium text-card-foreground">{patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {patient.medications.filter(m => !m.compliance).length} medications non-compliant
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                          {patient.medicationCompliance}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PCP Follow-up Missed */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <XCircle className="h-5 w-5 text-destructive" />
                  PCP Follow-up Missed
                </CardTitle>
                <CardDescription>Patients needing PCP visit</CardDescription>
              </CardHeader>
              <CardContent>
                {pcpMissed.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 py-4">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>All patients have completed PCP follow-up</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pcpMissed.map(patient => (
                      <div 
                        key={patient.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20 cursor-pointer hover:bg-destructive/20"
                        onClick={() => navigateTo("patient-detail", { patientId: patient.id })}
                      >
                        <div>
                          <p className="font-medium text-card-foreground">{patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Last contact: {new Date(patient.lastContactDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="destructive">Needs F/U</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Supervisor Messages</CardTitle>
              <CardDescription>Nudges and instructions sent to this navigator</CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {messages.map(message => (
                    <div 
                      key={message.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        message.readStatus ? "bg-card border-border" : "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={message.type === "nudge" ? "default" : "secondary"}>
                            {message.type}
                          </Badge>
                          <span className="text-sm font-medium text-card-foreground">
                            Re: {message.patientName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-card-foreground">{message.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">From: {message.senderName}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
