"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardList,
  Activity,
  Scale,
  Heart,
  Pill,
  Footprints,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import type { GoalTracking, CarePlan, CareTemplate } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CarePlanTabProps {
  patientId: string
}

// Get icon for metric type
function getMetricIcon(unit: string) {
  switch (unit.toLowerCase()) {
    case "lbs":
      return Scale
    case "mmhg":
    case "%":
      return Heart
    case "mg/dl":
    case "mg":
      return Pill
    case "steps":
      return Footprints
    default:
      return Activity
  }
}

// Get status color
function getStatusColor(status: GoalTracking["status"]) {
  switch (status) {
    case "on_track":
      return "text-emerald-600"
    case "warning":
      return "text-amber-600"
    case "critical":
      return "text-red-600"
    case "not_started":
      return "text-muted-foreground"
  }
}

function getStatusBgColor(status: GoalTracking["status"]) {
  switch (status) {
    case "on_track":
      return "bg-emerald-100"
    case "warning":
      return "bg-amber-100"
    case "critical":
      return "bg-red-100"
    case "not_started":
      return "bg-muted"
  }
}

function getStatusIcon(status: GoalTracking["status"]) {
  switch (status) {
    case "on_track":
      return CheckCircle2
    case "warning":
      return AlertTriangle
    case "critical":
      return XCircle
    case "not_started":
      return Minus
  }
}

// Render helpers (module scope) so icon components are not created during render
function renderStatusIcon(status: GoalTracking["status"], className: string) {
  const Icon = getStatusIcon(status)
  return <Icon className={className} />
}

function renderMetricIcon(unit: string, className: string) {
  const Icon = getMetricIcon(unit)
  return <Icon className={className} />
}

// Format date for sparkline
function formatChartDate(dateString: string) {
  const date = new Date(dateString)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// Get trend direction based on history
function getTrend(history: { value: number }[], direction: "below" | "above" | "between") {
  if (history.length < 2) return "stable"
  const recent = history.slice(-3)
  const first = recent[0].value
  const last = recent[recent.length - 1].value
  const diff = last - first

  // For "below" targets, going down is improving
  if (direction === "below") {
    if (diff < -2) return "improving"
    if (diff > 2) return "worsening"
  }
  // For "above" targets, going up is improving
  if (direction === "above") {
    if (diff > 2) return "improving"
    if (diff < -2) return "worsening"
  }
  return "stable"
}

export function CarePlanTab({ patientId }: CarePlanTabProps) {
  const { careTemplates, getPatientCarePlan, applyCareTemplate, logGoalMetric } = useDemoData()
  const { currentUser } = useRole()
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [inputValues, setInputValues] = useState<Record<string, string>>({})

  const carePlan = getPatientCarePlan(patientId)

  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      applyCareTemplate(patientId, selectedTemplate)
      setSelectedTemplate("")
    }
  }

  const handleLogValue = (goalId: string) => {
    const value = parseFloat(inputValues[goalId])
    if (!isNaN(value) && currentUser) {
      logGoalMetric(patientId, goalId, value, currentUser.id)
      setInputValues((prev) => ({ ...prev, [goalId]: "" }))
    }
  }

  // If no care plan, show template selector
  if (!carePlan) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <ClipboardList className="h-5 w-5 text-primary" />
            Select Care Pathway
          </CardTitle>
          <CardDescription>
            No active care plan. Choose a pathway template to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="template-select">Care Pathway</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger id="template-select" className="w-full">
                <SelectValue placeholder="Select a care pathway..." />
              </SelectTrigger>
              <SelectContent>
                {careTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {template.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <TemplatePreview
              template={careTemplates.find((t) => t.id === selectedTemplate)!}
            />
          )}

          <Button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate}
            className="w-full"
          >
            <Target className="h-4 w-4 mr-2" />
            Apply Pathway
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show active care plan with goal tracking
  return (
    <div className="space-y-6">
      {/* Care Plan Header */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <ClipboardList className="h-5 w-5 text-primary" />
                {carePlan.templateName}
              </CardTitle>
              <CardDescription>
                Started {new Date(carePlan.startDate).toLocaleDateString()} |{" "}
                {carePlan.activeGoals.length} goals tracking
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                carePlan.status === "active" && "bg-emerald-50 text-emerald-700 border-emerald-200"
              )}
            >
              {carePlan.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Goal Tracking Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {carePlan.activeGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            inputValue={inputValues[goal.id] || ""}
            onInputChange={(value) =>
              setInputValues((prev) => ({ ...prev, [goal.id]: value }))
            }
            onLogValue={() => handleLogValue(goal.id)}
          />
        ))}
      </div>

      {/* Task Summary */}
      {carePlan.activeTasks.length > 0 && (
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-card-foreground">Daily Tasks</CardTitle>
            <CardDescription>
              {carePlan.activeTasks.filter((t) => t.frequency === "daily").length} daily tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {carePlan.activeTasks
                .filter((t) => t.frequency === "daily")
                .slice(0, 5)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        task.category === "vitals" && "bg-blue-500",
                        task.category === "medication" && "bg-purple-500",
                        task.category === "activity" && "bg-green-500",
                        task.category === "nutrition" && "bg-orange-500",
                        task.category === "education" && "bg-cyan-500"
                      )}
                    />
                    <span className="text-sm">{task.description}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Template Preview Component
function TemplatePreview({ template }: { template: CareTemplate }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div>
        <h4 className="font-medium text-card-foreground">{template.name}</h4>
        <p className="text-sm text-muted-foreground">{template.description}</p>
      </div>

      <Separator />

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-card-foreground">Goals ({template.goals.length})</h5>
        <div className="space-y-1">
          {template.goals.map((goal) => (
            <div key={goal.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-3 w-3" />
              <span>{goal.description}</span>
              <Badge variant="outline" className="text-xs ml-auto">
                {goal.direction === "below" ? "<" : ">"} {goal.targetValue} {goal.metricUnit}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-card-foreground">Tasks ({template.tasks.length})</h5>
        <div className="flex flex-wrap gap-1">
          {template.tasks.map((task) => (
            <Badge key={task.id} variant="secondary" className="text-xs">
              {task.category}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

// Goal Card Component with Sparkline
function GoalCard({
  goal,
  inputValue,
  onInputChange,
  onLogValue,
}: {
  goal: GoalTracking
  inputValue: string
  onInputChange: (value: string) => void
  onLogValue: () => void
}) {
  const trend = getTrend(goal.history, goal.direction)

  // Prepare chart data
  const chartData = goal.history.slice(-7).map((dp) => ({
    date: formatChartDate(dp.date),
    value: dp.value,
  }))

  const latestValue = goal.history.length > 0 ? goal.history[goal.history.length - 1].value : null

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", getStatusBgColor(goal.status))}>
              {renderMetricIcon(goal.metricUnit, cn("h-4 w-4", getStatusColor(goal.status)))}
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-card-foreground">
                {goal.description}
              </CardTitle>
              <CardDescription className="text-xs">
                Target: {goal.direction === "below" ? "<" : ">"} {goal.targetValue} {goal.metricUnit}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {renderStatusIcon(goal.status, cn("h-4 w-4", getStatusColor(goal.status)))}
            {trend === "improving" && <TrendingDown className="h-4 w-4 text-emerald-600" />}
            {trend === "worsening" && <TrendingUp className="h-4 w-4 text-red-600" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Value */}
        <div className="flex items-baseline gap-2">
          <span className={cn("text-3xl font-bold", getStatusColor(goal.status))}>
            {latestValue !== null ? latestValue : "--"}
          </span>
          <span className="text-sm text-muted-foreground">{goal.metricUnit}</span>
        </div>

        {/* Sparkline Chart */}
        {chartData.length > 1 && (
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value} ${goal.metricUnit}`, "Value"]}
                />
                <ReferenceLine
                  y={goal.targetValue}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                {goal.warningThreshold && (
                  <ReferenceLine
                    y={goal.warningThreshold}
                    stroke="hsl(var(--warning))"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={
                    goal.status === "on_track"
                      ? "#10b981"
                      : goal.status === "warning"
                      ? "#f59e0b"
                      : goal.status === "critical"
                      ? "#ef4444"
                      : "#6b7280"
                  }
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Log Value Input */}
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder={`Enter ${goal.metricUnit}...`}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") onLogValue()
            }}
          />
          <Button size="sm" onClick={onLogValue} disabled={!inputValue}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
