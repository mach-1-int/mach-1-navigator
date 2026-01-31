"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Heart,
  Calendar,
  Pill,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  ChevronRight,
} from "lucide-react"
import { patients as mockPatients, navigators as mockNavigators } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { AMDSourceIndicator } from "@/components/amd-source-indicator"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"

export function PatientDashboard() {
  const { demoPatientId } = useRole()
  const { patients, navigators } = useDemoData()
  
  // Use demo patient if logged in as one, otherwise default to James Thompson
  const currentPatient = demoPatientId 
    ? patients.find(p => p.id === demoPatientId) || mockPatients[0]
    : mockPatients[0]
  const myNavigator = navigators.find((n) => n.id === currentPatient.assignedNavigator) || mockNavigators[0]

  const enrollmentDays = Math.floor(
    (new Date().getTime() - new Date(currentPatient.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const enrollmentMonths = Math.floor(enrollmentDays / 30)

  const upcomingMeds = currentPatient.medications.filter(
    (med) => new Date(med.nextRefillDate) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  )

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
        <CardContent className="flex items-center gap-6 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-card-foreground">Welcome{demoPatientId ? "" : " back"}, {currentPatient.name.split(" ")[0]}!</h2>
            <p className="text-muted-foreground">
              {demoPatientId 
                ? "You've been enrolled in the care program. Your navigator will be reaching out soon!"
                : `You've been in the care program for ${enrollmentMonths} months. Keep up the great work!`
              }
            </p>
          </div>
          <div className="hidden text-right md:block">
            <p className="text-sm text-muted-foreground">Health Plan</p>
            <p className="font-medium text-card-foreground">{currentPatient.healthPlan}</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Pill className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{currentPatient.medicationCompliance}%</p>
              <p className="text-sm text-muted-foreground">Medication Score</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-chart-2/10 p-3">
              <Calendar className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {currentPatient.upcomingAppointments.length}
              </p>
              <p className="text-sm text-muted-foreground">Upcoming Visits</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-chart-3/10 p-3">
              <Clock className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{enrollmentMonths}</p>
              <p className="text-sm text-muted-foreground">Months Enrolled</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div
              className={cn(
                "rounded-lg p-3",
                currentPatient.pcpCompliance ? "bg-primary/10" : "bg-warning/10"
              )}
            >
              {currentPatient.pcpCompliance ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <AlertCircle className="h-6 w-6 text-warning" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {currentPatient.pcpCompliance ? "Yes" : "Pending"}
              </p>
              <p className="text-sm text-muted-foreground">PCP Visit Status</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My Care Navigator */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Your Care Navigator</CardTitle>
            <CardDescription>Your dedicated health partner</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <User className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">{myNavigator?.name}</h3>
              <p className="mb-4 text-sm text-muted-foreground">Care Navigator</p>
              <div className="flex w-full gap-2">
                <Button className="flex-1 bg-transparent" variant="outline">
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
                <Button className="flex-1">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-card-foreground">Upcoming Appointments</CardTitle>
            <CardDescription>Your scheduled visits and calls</CardDescription>
          </CardHeader>
          <CardContent>
            {currentPatient.upcomingAppointments.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Calendar className="mb-2 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">No upcoming appointments scheduled</p>
                <Button className="mt-4 bg-transparent" variant="outline">
                  Request Appointment
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {currentPatient.upcomingAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="text-xs font-medium">
                          {new Date(apt.date).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-lg font-bold">{new Date(apt.date).getDate()}</span>
                      </div>
                      <div>
                        <p className="font-medium capitalize text-card-foreground">
                          {apt.type.replace("_", " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {apt.time} with {myNavigator?.name}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View Details
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Medications */}
      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-card-foreground">My Medications</CardTitle>
            <AMDSourceIndicator source="Epic EHR" />
          </div>
          <CardDescription>Track your prescriptions and refill dates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentPatient.medications.map((med) => {
              const daysUntilRefill = Math.ceil(
                (new Date(med.nextRefillDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              )
              const needsRefillSoon = daysUntilRefill <= 7

              return (
                <div
                  key={med.id}
                  className={cn(
                    "rounded-lg border p-4",
                    needsRefillSoon
                      ? "border-warning/30 bg-warning/5"
                      : "border-border bg-secondary/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          med.compliance ? "bg-primary/10" : "bg-destructive/10"
                        )}
                      >
                        <Pill className={cn("h-5 w-5", med.compliance ? "text-primary" : "text-destructive")} />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1.5 font-medium text-card-foreground">
                          {med.name}
                          <AMDSourceIndicator source="Epic EHR" />
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {med.dosage} - {med.frequency}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {needsRefillSoon ? (
                        <Badge variant="outline" className="border-warning text-warning">
                          Refill in {daysUntilRefill} days
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Next refill: {med.nextRefillDate}</Badge>
                      )}
                    </div>
                  </div>

                  {!med.compliance && (
                    <div className="mt-3 flex items-center gap-2 rounded bg-destructive/10 p-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Please contact your navigator about this medication
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Health Progress */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Your Health Journey</CardTitle>
          <CardDescription>Track your progress in the care program</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Medication Compliance</span>
                <span className="font-medium text-card-foreground">{currentPatient.medicationCompliance}%</span>
              </div>
              <Progress value={currentPatient.medicationCompliance} className="h-3" />
            </div>

            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Program Engagement</span>
                <span className="font-medium text-card-foreground">
                  {enrollmentMonths} of 12 months
                </span>
              </div>
              <Progress value={(enrollmentMonths / 12) * 100} className="h-3" />
            </div>

            <div className="rounded-lg bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">Great Progress!</p>
                  <p className="text-sm text-muted-foreground">
                    You're doing well on your health journey. Keep taking your medications and attending your appointments!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
