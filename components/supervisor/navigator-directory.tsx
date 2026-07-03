"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Users, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { cn } from "@/lib/utils"

export function NavigatorDirectory() {
  const { navigators, patients, getNudgesForNavigator } = useDemoData()
  const { navigateTo } = useRole()
  
  // Filter navigators under supervisor 1
  const teamNavigators = navigators.filter(nav => nav.supervisorId === "sup1")
  
  // Calculate additional metrics for each navigator
  const navigatorMetrics = teamNavigators.map(nav => {
    const navPatients = patients.filter(p => p.assignedNavigator === nav.id)
    const avgCompliance = navPatients.length > 0 
      ? Math.round(navPatients.reduce((sum, p) => sum + p.medicationCompliance, 0) / navPatients.length)
      : 0
    const pendingMessages = getNudgesForNavigator(nav.id).filter(m => !m.readStatus).length
    
    // Mock average visit time (would come from real data)
    const avgVisitTime = 35 + Math.floor(Math.random() * 20) // 35-55 minutes
    
    // Determine load status
    const loadStatus = nav.patientCount > 50 ? "high" : nav.patientCount > 35 ? "medium" : "low"
    
    return {
      ...nav,
      avgCompliance,
      avgVisitTime,
      loadStatus,
      pendingMessages,
      patientList: navPatients
    }
  })

  const getLoadBadge = (status: string) => {
    switch (status) {
      case "high":
        return { label: "High Load", className: "bg-red-100 text-red-700" }
      case "medium":
        return { label: "Moderate", className: "bg-amber-100 text-amber-700" }
      default:
        return { label: "Optimal", className: "bg-emerald-100 text-emerald-700" }
    }
  }

  const getComplianceTrend = (compliance: number) => {
    if (compliance >= 95) return { icon: TrendingUp, color: "text-emerald-600" }
    if (compliance >= 85) return { icon: Minus, color: "text-amber-600" }
    return { icon: TrendingDown, color: "text-red-600" }
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{teamNavigators.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {Math.round(navigatorMetrics.reduce((sum, n) => sum + n.avgCompliance, 0) / navigatorMetrics.length)}%
                </p>
                <p className="text-sm text-muted-foreground">Avg Compliance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {navigatorMetrics.reduce((sum, n) => sum + n.patientCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {Math.round(navigatorMetrics.reduce((sum, n) => sum + n.avgVisitTime, 0) / navigatorMetrics.length)} min
                </p>
                <p className="text-sm text-muted-foreground">Avg Visit Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigator Table */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Navigator Directory</CardTitle>
          <CardDescription>Click a row to view detailed navigator profile</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Navigator</TableHead>
                <TableHead className="text-center text-muted-foreground">Current Load</TableHead>
                <TableHead className="text-center text-muted-foreground">Compliance %</TableHead>
                <TableHead className="text-center text-muted-foreground">Avg Visit Time</TableHead>
                <TableHead className="text-center text-muted-foreground">MTD Units</TableHead>
                <TableHead className="text-center text-muted-foreground">Messages</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {navigatorMetrics.map((navigator) => {
                const loadBadge = getLoadBadge(navigator.loadStatus)
                const trend = getComplianceTrend(navigator.avgCompliance)
                const TrendIcon = trend.icon
                
                return (
                  <TableRow 
                    key={navigator.id} 
                    className="border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => navigateTo("navigator-detail", { navigatorId: navigator.id })}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium text-card-foreground">
                          {navigator.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground">{navigator.name}</p>
                          <p className="text-xs text-muted-foreground">{navigator.lengthOfService} months experience</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium text-card-foreground">{navigator.patientCount} patients</span>
                        <Badge variant="secondary" className={loadBadge.className}>
                          {loadBadge.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress 
                          value={navigator.avgCompliance} 
                          className={cn("h-2 w-20", navigator.avgCompliance < 85 && "[&>div]:bg-warning")}
                        />
                        <span className={cn("text-sm font-medium", navigator.avgCompliance < 85 ? "text-warning" : "text-card-foreground")}>
                          {navigator.avgCompliance}%
                        </span>
                        <TrendIcon className={cn("h-4 w-4", trend.color)} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-card-foreground">
                      {navigator.avgVisitTime} min
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-medium",
                        navigator.mtdUnits < 200 ? "text-destructive" : "text-card-foreground"
                      )}>
                        {navigator.mtdUnits}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {navigator.pendingMessages > 0 ? (
                        <Badge variant="destructive">{navigator.pendingMessages}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
