"use client"

import { useState } from "react"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import type { UserRole } from "@/lib/types"
import { initialUsers as users } from "@/lib/initial-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Heart, BarChart3, Users, Stethoscope, UserCircle, Sparkles, ArrowRight, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const roleConfig: Record<UserRole, { icon: typeof BarChart3; description: string; color: string }> = {
  executive: {
    icon: BarChart3,
    description: "High-level visibility into revenue, billing units, and market expansion health",
    color: "text-chart-1",
  },
  supervisor: {
    icon: Users,
    description: "Navigator performance oversight, compliance tracking, and patient risk management",
    color: "text-chart-2",
  },
  navigator: {
    icon: Stethoscope,
    description: "Patient care management, scheduling, notes, and adverse event tracking",
    color: "text-chart-3",
  },
  patient: {
    icon: UserCircle,
    description: "Personal health tracking, appointments, and care team communication",
    color: "text-chart-4",
  },
  admin: {
    icon: Shield,
    description: "System configuration, payer rate management, and audit log monitoring",
    color: "text-chart-5",
  },
  biller: {
    icon: BarChart3,
    description: "Claims validation, payer toggle (Medicaid H-codes / Medicare G-codes), and CSV export",
    color: "text-emerald-600",
  },
}

export function RoleSelector() {
  const { setRole, loginAsUser, loginAsPatient } = useRole()
  const { getLastAssignedPatient, navigators } = useDemoData()
  const [navigatorModalOpen, setNavigatorModalOpen] = useState(false)

  const lastAssignedPatient = getLastAssignedPatient()
  const assignedNavigator = lastAssignedPatient
    ? navigators.find(n => n.id === lastAssignedPatient.assignedNavigator)
    : null

  // Get all navigator users
  const navigatorUsers = users.filter(u => u.role === "navigator")
  // Get non-navigator users (one per role)
  const otherUsers = users.filter(u => u.role !== "navigator")

  const handleNavigatorSelect = (userId: string) => {
    loginAsUser(userId)
    setNavigatorModalOpen(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Heart className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">Gellert Health</h1>
        <p className="text-center text-muted-foreground">Bringing Care Back to Healthcare</p>
      </div>

      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Select Your Role</h2>
        <p className="text-sm text-muted-foreground">Choose a persona to explore the dashboard</p>
      </div>

      {/* Recently Assigned Patient - Demo Flow */}
      {lastAssignedPatient && (
        <Card 
          className="mb-6 w-full max-w-4xl cursor-pointer border-primary/50 bg-gradient-to-r from-primary/10 to-chart-2/10 transition-all hover:border-primary hover:shadow-lg"
          onClick={() => loginAsPatient(lastAssignedPatient.id, lastAssignedPatient.name)}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Continue Demo Flow</h3>
                <Badge variant="secondary" className="text-xs">New Patient</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Log in as <span className="font-medium text-foreground">{lastAssignedPatient.name}</span> 
                {assignedNavigator && <span> (assigned to {assignedNavigator.name})</span>}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {/* Non-navigator roles */}
        {otherUsers.map((user) => {
          const config = roleConfig[user.role]
          const Icon = config.icon
          return (
            <Card
              key={user.id}
              className="group cursor-pointer border-border bg-card transition-all hover:border-primary hover:bg-card/80"
              onClick={() =>
                user.role === "patient"
                  ? loginAsPatient(user.id, user.name)
                  : setRole(user.role)
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-lg bg-secondary p-2", config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base capitalize text-card-foreground">{user.role}</CardTitle>
                    <p className="text-sm text-muted-foreground">{user.name}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">{config.description}</CardDescription>
              </CardContent>
            </Card>
          )
        })}

        {/* Navigator role - opens modal */}
        <Card
          className="group cursor-pointer border-border bg-card transition-all hover:border-primary hover:bg-card/80"
          onClick={() => setNavigatorModalOpen(true)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg bg-secondary p-2", roleConfig.navigator.color)}>
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base capitalize text-card-foreground">Navigator</CardTitle>
                <p className="text-sm text-muted-foreground">{navigatorUsers.length} navigators</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-muted-foreground">{roleConfig.navigator.description}</CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Navigator Selection Modal */}
      <Dialog open={navigatorModalOpen} onOpenChange={setNavigatorModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Navigator</DialogTitle>
            <DialogDescription>Choose which navigator to log in as</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {navigatorUsers.map((navUser) => {
              const navData = navigators.find(n => n.id === navUser.id)
              const isNewPatientAssigned = lastAssignedPatient?.assignedNavigator === navUser.id
              return (
                <div
                  key={navUser.id}
                  onClick={() => handleNavigatorSelect(navUser.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                    isNewPatientAssigned
                      ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                      : "border-border hover:border-primary hover:bg-secondary/50"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
                    isNewPatientAssigned ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"
                  )}>
                    {navUser.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{navUser.name}</p>
                      {isNewPatientAssigned && (
                        <Badge className="bg-emerald-500 text-white text-[10px] flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          New Patient
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {navData ? `${navData.patientCount} patients` : navUser.email}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Demo Mode: This prototype uses mock data to demonstrate platform capabilities
      </p>
    </div>
  )
}
