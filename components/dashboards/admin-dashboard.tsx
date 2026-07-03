"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { useToast } from "@/hooks/use-toast"
import {
  DollarSign,
  Settings,
  History,
  Edit2,
  Check,
  X,
  Shield,
  FileText,
  LogIn,
  LogOut,
  UserPlus,
  ClipboardList,
  AlertCircle,
  Calendar,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditAction, Payer } from "@/lib/types"

// Action type configuration for audit log display
const actionConfig: Record<AuditAction, { label: string; icon: typeof Edit2; color: string }> = {
  check_in: { label: "Check In", icon: LogIn, color: "bg-blue-100 text-blue-700 border-blue-200" },
  check_out: { label: "Check Out", icon: LogOut, color: "bg-green-100 text-green-700 border-green-200" },
  note_created: { label: "Note Created", icon: FileText, color: "bg-purple-100 text-purple-700 border-purple-200" },
  note_updated: { label: "Note Updated", icon: Edit2, color: "bg-purple-100 text-purple-700 border-purple-200" },
  payer_rate_updated: { label: "Rate Updated", icon: DollarSign, color: "bg-amber-100 text-amber-700 border-amber-200" },
  payer_updated: { label: "Payer Updated", icon: DollarSign, color: "bg-amber-100 text-amber-700 border-amber-200" },
  care_plan_applied: { label: "Care Plan", icon: ClipboardList, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  referral_accepted: { label: "Referral Accepted", icon: Check, color: "bg-green-100 text-green-700 border-green-200" },
  referral_rejected: { label: "Referral Rejected", icon: X, color: "bg-red-100 text-red-700 border-red-200" },
  referral_ingested: { label: "Referral Received", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-200" },
  assessment_completed: { label: "Assessment", icon: ClipboardList, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  appointment_scheduled: { label: "Scheduled", icon: Calendar, color: "bg-blue-100 text-blue-700 border-blue-200" },
  appointment_cancelled: { label: "Cancelled", icon: AlertCircle, color: "bg-red-100 text-red-700 border-red-200" },
  patient_created: { label: "Patient Created", icon: UserPlus, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  login: { label: "Login", icon: LogIn, color: "bg-slate-100 text-slate-700 border-slate-200" },
  logout: { label: "Logout", icon: LogOut, color: "bg-slate-100 text-slate-700 border-slate-200" },
  claim_exported: { label: "Claim Exported", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-200" },
  claim_status_changed: { label: "Claim Status", icon: History, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  remittance_imported: { label: "Remittance", icon: DollarSign, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  remark_code_updated: { label: "Remark Code", icon: Edit2, color: "bg-amber-100 text-amber-700 border-amber-200" },
  org_settings_updated: { label: "Org Settings", icon: Settings, color: "bg-slate-100 text-slate-700 border-slate-200" },
  sos_triggered: { label: "SOS Triggered", icon: AlertCircle, color: "bg-red-100 text-red-700 border-red-200" },
  sos_acknowledged: { label: "SOS Acknowledged", icon: Check, color: "bg-orange-100 text-orange-700 border-orange-200" },
  sos_resolved: { label: "SOS Resolved", icon: Check, color: "bg-green-100 text-green-700 border-green-200" },
}

export function AdminDashboard() {
  const { payers, auditLogs, updatePayer, calculateDynamicRevenue, resetDemo } = useDemoData()
  const { currentUser, navigation, logout } = useRole()
  const { toast } = useToast()

  const [editingRate, setEditingRate] = useState<Payer | null>(null)
  const [editValue, setEditValue] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  // Determine which tab to show based on navigation
  const activeTab = navigation.view === "admin-audit-log" ? "audit" : "rates"

  const handleEditClick = (rate: Payer) => {
    setEditingRate(rate)
    setEditValue(rate.ratePerUnit.toFixed(2))
    setDialogOpen(true)
  }

  const handleSaveRate = () => {
    if (!editingRate || !currentUser) return

    const newRate = parseFloat(editValue)
    if (isNaN(newRate) || newRate < 0) {
      toast({
        title: "Invalid Rate",
        description: "Please enter a valid positive number",
        variant: "destructive",
      })
      return
    }

    updatePayer(editingRate.id, { ratePerUnit: newRate }, currentUser.id, currentUser.name)

    toast({
      title: "Rate Updated",
      description: `${editingRate.name} rate updated to $${newRate.toFixed(2)}`,
    })

    setDialogOpen(false)
    setEditingRate(null)
    setEditValue("")
  }

  const dynamicRevenue = calculateDynamicRevenue()

  const handleResetDemo = () => {
    resetDemo()
    toast({
      title: "Demo Data Reset",
      description: "All data has been restored to initial state",
    })
    setResetDialogOpen(false)
    logout() // Return to role selector
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Governance settings and system activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setResetDialogOpen(true)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Demo Data
          </Button>
          <Badge variant="outline" className="text-primary border-primary">
            <Settings className="h-3 w-3 mr-1" />
            System Admin
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Payer Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{payers.length}</p>
            <p className="text-xs text-muted-foreground">Configured payers</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dynamic Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">${dynamicRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">From completed visits</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Audit Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">{auditLogs.length}</p>
            <p className="text-xs text-muted-foreground">System activities logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="rates" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payer Rates
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Payer Rates Tab */}
        <TabsContent value="rates">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Payer Rate Configuration</CardTitle>
              <CardDescription>
                Manage revenue rates per completed visit for each payer. Changes affect Executive Dashboard revenue calculations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Payer Name</TableHead>
                    <TableHead className="text-right text-muted-foreground">Rate Per Unit</TableHead>
                    <TableHead className="text-muted-foreground">Last Updated</TableHead>
                    <TableHead className="text-right text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payers.map((rate) => (
                    <TableRow key={rate.id} className="border-border">
                      <TableCell className="font-medium text-card-foreground">
                        {rate.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-lg font-semibold text-emerald-600">
                          ${rate.ratePerUnit.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(rate.lastUpdated).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(rate)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">System Activity Log</CardTitle>
              <CardDescription>
                Chronological record of all system events and user actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No activity logged yet
                  </p>
                ) : (
                  auditLogs.map((log) => {
                    const config = actionConfig[log.action]
                    const Icon = config?.icon || History

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30"
                      >
                        {/* Timestamp */}
                        <div className="text-xs text-muted-foreground whitespace-nowrap w-32">
                          <p className="font-medium">
                            {new Date(log.timestamp).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p>
                            {new Date(log.timestamp).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        {/* User Info */}
                        <div className="flex-shrink-0 w-36">
                          <p className="font-medium text-card-foreground truncate">
                            {log.userName}
                          </p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.userRole}
                          </Badge>
                        </div>

                        {/* Action Badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "flex items-center gap-1 flex-shrink-0",
                            config?.color
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {config?.label || log.action}
                        </Badge>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          {log.details && (
                            <p className="text-sm text-muted-foreground truncate">
                              {log.details}
                            </p>
                          )}
                          {log.entityType && (
                            <p className="text-xs text-muted-foreground/70">
                              {log.entityType}: {log.entityId}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Rate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payer Rate</DialogTitle>
            <DialogDescription>
              Update the rate per completed visit for {editingRate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payer</label>
              <p className="text-lg font-semibold">{editingRate?.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate Per Unit ($)</label>
              <div className="flex items-center gap-2">
                <span className="text-lg text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="font-mono text-lg"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Current rate: ${editingRate?.ratePerUnit.toFixed(2)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRate}>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Demo Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              Reset Demo Data
            </DialogTitle>
            <DialogDescription>
              This will clear all data and restore the initial demo state. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              The following will be reset:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>All patient data and appointments</li>
              <li>Care plans and goal tracking</li>
              <li>Payer rates to default values</li>
              <li>Audit logs and notes</li>
              <li>All referrals and messages</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetDemo}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
