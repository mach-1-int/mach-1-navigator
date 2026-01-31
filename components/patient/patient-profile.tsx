"use client"

import { User, Users, Target, Heart, Activity, Shield, Phone, Mail } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"

// Hardcoded health goals for demo
const healthGoals = [
  {
    id: "goal1",
    title: "Medication Adherence",
    description: "Take all prescribed medications as directed",
    progress: 85,
    status: "in_progress" as const,
  },
  {
    id: "goal2",
    title: "Blood Pressure Control",
    description: "Maintain blood pressure below 130/80",
    progress: 70,
    status: "in_progress" as const,
  },
  {
    id: "goal3",
    title: "Regular PCP Visits",
    description: "Complete quarterly check-ups with primary care provider",
    progress: 100,
    status: "completed" as const,
  },
  {
    id: "goal4",
    title: "Daily Activity",
    description: "30 minutes of light activity, 5 days per week",
    progress: 60,
    status: "in_progress" as const,
  },
]

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function CareTeamCard({
  name,
  role,
  email,
}: {
  name: string
  role: string
  email?: string
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
      <Avatar className="h-12 w-12">
        <AvatarFallback className="bg-primary/10 text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{name}</p>
        <p className="text-sm text-muted-foreground">{role}</p>
        {email && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Mail className="h-3 w-3" />
            <span className="truncate">{email}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function HealthGoalCard({
  goal,
}: {
  goal: typeof healthGoals[0]
}) {
  const getStatusBadge = () => {
    if (goal.status === "completed") {
      return <Badge variant="default">Completed</Badge>
    }
    if (goal.progress >= 75) {
      return <Badge variant="secondary">Almost There</Badge>
    }
    return <Badge variant="outline">In Progress</Badge>
  }

  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-medium">{goal.title}</span>
        </div>
        {getStatusBadge()}
      </div>
      <p className="text-sm text-muted-foreground">{goal.description}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{goal.progress}%</span>
        </div>
        <Progress value={goal.progress} className="h-2" />
      </div>
    </div>
  )
}

export function PatientProfile() {
  const { currentUser } = useRole()
  const { getPatient, getNavigator, navigators } = useDemoData()

  if (!currentUser) return null

  const patient = getPatient(currentUser.id)
  if (!patient) return null

  const navigator = getNavigator(patient.assignedNavigator)

  // Get supervisor from navigator's supervisorId
  // Since we don't have a getSupervisor helper, we'll look it up from initial data pattern
  const supervisorId = navigator?.supervisorId
  // For demo, use hardcoded supervisor info based on typical structure
  const supervisorName = supervisorId === "sup1" ? "Marcus Williams" :
                         supervisorId === "sup2" ? "Jennifer Adams" :
                         supervisorId === "sup3" ? "Robert Kim" : "Care Supervisor"

  const riskLevelConfig = {
    1: { label: "Low Risk", color: "bg-green-100 text-green-700" },
    2: { label: "Moderate Risk", color: "bg-yellow-100 text-yellow-700" },
    3: { label: "High Risk", color: "bg-red-100 text-red-700" },
  }

  const riskConfig = riskLevelConfig[patient.riskLevel]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
        <p className="text-muted-foreground">Your care information and health goals</p>
      </div>

      {/* Patient Info Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {getInitials(patient.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{patient.name}</h3>
                <p className="text-muted-foreground">Chart #: {patient.chartNumber}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={riskConfig.color}>
                  <Shield className="h-3 w-3 mr-1" />
                  {riskConfig.label}
                </Badge>
                <Badge variant="outline">
                  <Heart className="h-3 w-3 mr-1" />
                  {patient.healthPlan}
                </Badge>
                <Badge variant="outline">
                  <Activity className="h-3 w-3 mr-1" />
                  {patient.medicationCompliance}% Med Compliance
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Enrolled since {new Date(patient.enrollmentDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Care Team */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            My Care Team
          </CardTitle>
          <CardDescription>
            The team dedicated to supporting your health journey
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {navigator && (
            <CareTeamCard
              name={navigator.name}
              role="Care Navigator"
              email={`${navigator.name.toLowerCase().replace(" ", ".")}@gellert.health`}
            />
          )}
          <CareTeamCard
            name={supervisorName}
            role="Care Supervisor"
            email={`${supervisorName.toLowerCase().replace(" ", ".")}@gellert.health`}
          />
        </CardContent>
      </Card>

      {/* Health Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Health Goals
          </CardTitle>
          <CardDescription>
            Your personalized care plan goals and progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {healthGoals.map((goal) => (
              <HealthGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patient.medicationCompliance}%</p>
                <p className="text-sm text-muted-foreground">Medication Compliance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${patient.pcpCompliance ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patient.pcpCompliance ? "Yes" : "No"}</p>
                <p className="text-sm text-muted-foreground">PCP Compliance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Date(patient.lastContactDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                <p className="text-sm text-muted-foreground">Last Contact</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
