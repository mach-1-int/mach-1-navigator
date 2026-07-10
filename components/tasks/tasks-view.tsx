"use client"

/**
 * My Tasks (Gellert ops blitz — workstream G-3).
 * Groups the navigator's navigatorTasks into Overdue / Due today / Upcoming /
 * Done-recent, using lib/task-engine.ts for grouping semantics (overdueTasks
 * is DATE-based, never dueAt < now) and TASK_TYPE_CONFIG for icon/color/label.
 * Confirmation task types complete through an outcome picker (SOP 3.3);
 * dismissal always requires a note.
 */

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ListChecks, ChevronRight, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { overdueTasks, localDateOf, confirmationWindowForType, TASK_TYPE_CONFIG } from "@/lib/task-engine"
import { TASK_ICONS, TASK_ICON_FALLBACK } from "@/components/tasks/task-icons"
import type { NavigatorTask } from "@/lib/types"

const CONFIRMATION_OUTCOMES: { value: "confirmed" | "no_answer" | "reschedule_requested"; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "no_answer", label: "No answer" },
  { value: "reschedule_requested", label: "Reschedule requested" },
]

function TaskTypeIcon({ type, className }: { type: NavigatorTask["type"]; className?: string }) {
  const Icon = TASK_ICONS[TASK_TYPE_CONFIG[type].icon] ?? TASK_ICON_FALLBACK
  return <Icon className={className} />
}

interface TaskRowProps {
  task: NavigatorTask
  patientName: string
  overdue: boolean
  onOpenPatient: () => void
  onComplete: () => void
  onDismiss: () => void
}

function TaskRow({ task, patientName, overdue, onOpenPatient, onComplete, onDismiss }: TaskRowProps) {
  const config = TASK_TYPE_CONFIG[task.type]
  const isDone = task.status !== "open"

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        overdue ? "border-destructive/40 bg-destructive/5" : "border-border bg-secondary/30"
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", config.color)}>
        <TaskTypeIcon type={task.type} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPatient}
            className="truncate text-sm font-medium text-card-foreground hover:underline"
          >
            {patientName}
          </button>
          {overdue && (
            <Badge variant="destructive" className="text-[10px]">
              Overdue
            </Badge>
          )}
          {isDone && task.status === "done" && (
            <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700">
              Done
            </Badge>
          )}
          {isDone && task.status === "dismissed" && (
            <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">
              Dismissed
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{config.label}</p>
        <p className="text-[11px] text-muted-foreground">
          {isDone
            ? `${task.status === "done" ? "Completed" : "Dismissed"} ${task.completedAt ? new Date(task.completedAt).toLocaleString() : ""}`
            : `Due ${new Date(task.dueAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
          {task.outcome ? ` — ${task.outcome.replace(/_/g, " ")}` : ""}
        </p>
        {task.note && <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{task.note}&rdquo;</p>}
      </div>
      {!isDone && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={onComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-muted-foreground" onClick={onDismiss}>
            <XCircle className="h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" onClick={onOpenPatient} />
    </div>
  )
}

function TaskGroup({
  title,
  tasks,
  overdueIds,
  patientName,
  onOpenPatient,
  onComplete,
  onDismiss,
  emptyLabel,
}: {
  title: string
  tasks: NavigatorTask[]
  overdueIds: Set<string>
  patientName: (patientId: string) => string
  onOpenPatient: (patientId: string) => void
  onComplete: (task: NavigatorTask) => void
  onDismiss: (task: NavigatorTask) => void
  emptyLabel?: string
}) {
  if (tasks.length === 0 && !emptyLabel) return null
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
        {title}
        <Badge variant="outline" className="text-[10px]">
          {tasks.length}
        </Badge>
      </h3>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              patientName={patientName(task.patientId)}
              overdue={overdueIds.has(task.id)}
              onOpenPatient={() => onOpenPatient(task.patientId)}
              onComplete={() => onComplete(task)}
              onDismiss={() => onDismiss(task)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TasksView() {
  const { navigatorTasks, patients, completeTask, dismissTask, generateDueTasks } = useDemoData()
  const { currentUser, navigateTo } = useRole()

  useEffect(() => {
    generateDueTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [completingTask, setCompletingTask] = useState<NavigatorTask | null>(null)
  const [outcome, setOutcome] = useState<"confirmed" | "no_answer" | "reschedule_requested">("confirmed")
  const [completeNote, setCompleteNote] = useState("")
  const [dismissingTask, setDismissingTask] = useState<NavigatorTask | null>(null)
  const [dismissNote, setDismissNote] = useState("")

  const patientName = (patientId: string) => patients.find((p) => p.id === patientId)?.name ?? patientId

  const mine = useMemo(
    () => navigatorTasks.filter((t) => t.navigatorId === currentUser?.id),
    [navigatorTasks, currentUser?.id]
  )
  const open = mine.filter((t) => t.status === "open")
  const overdue = overdueTasks(open)
  const overdueIds = new Set(overdue.map((t) => t.id))

  const today = localDateOf(new Date())
  const dueToday = open.filter((t) => !overdueIds.has(t.id) && localDateOf(t.dueAt) === today)
  const upcoming = open
    .filter((t) => !overdueIds.has(t.id) && localDateOf(t.dueAt) > today)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const overdueSorted = [...overdue].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const doneRecent = mine
    .filter((t) => t.status !== "open")
    .sort((a, b) => Date.parse(b.completedAt ?? b.createdAt) - Date.parse(a.completedAt ?? a.createdAt))
    .slice(0, 10)

  const openCompleteDialog = (task: NavigatorTask) => {
    setCompletingTask(task)
    setOutcome("confirmed")
    setCompleteNote("")
  }

  const openDismissDialog = (task: NavigatorTask) => {
    setDismissingTask(task)
    setDismissNote("")
  }

  const handleConfirmComplete = () => {
    if (!completingTask || !currentUser) return
    const isConfirmation = confirmationWindowForType(completingTask.type) !== null
    completeTask(
      completingTask.id,
      currentUser.id,
      isConfirmation ? outcome : undefined,
      completeNote.trim() || undefined
    )
    setCompletingTask(null)
  }

  const handleConfirmDismiss = () => {
    if (!dismissingTask || !currentUser || !dismissNote.trim()) return
    dismissTask(dismissingTask.id, currentUser.id, dismissNote.trim())
    setDismissingTask(null)
  }

  const isConfirmationTask = completingTask ? confirmationWindowForType(completingTask.type) !== null : false

  return (
    <div className="space-y-6">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <ListChecks className="h-5 w-5" />
            My Tasks
          </CardTitle>
          <CardDescription>
            {open.length} open task{open.length === 1 ? "" : "s"}
            {overdue.length > 0 ? ` — ${overdue.length} overdue` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <TaskGroup
            title="Overdue"
            tasks={overdueSorted}
            overdueIds={overdueIds}
            patientName={patientName}
            onOpenPatient={(patientId) => navigateTo("patient-detail", { patientId })}
            onComplete={openCompleteDialog}
            onDismiss={openDismissDialog}
          />
          <TaskGroup
            title="Due today"
            tasks={dueToday}
            overdueIds={overdueIds}
            patientName={patientName}
            onOpenPatient={(patientId) => navigateTo("patient-detail", { patientId })}
            onComplete={openCompleteDialog}
            onDismiss={openDismissDialog}
            emptyLabel="Nothing due today."
          />
          <TaskGroup
            title="Upcoming"
            tasks={upcoming}
            overdueIds={overdueIds}
            patientName={patientName}
            onOpenPatient={(patientId) => navigateTo("patient-detail", { patientId })}
            onComplete={openCompleteDialog}
            onDismiss={openDismissDialog}
            emptyLabel="No upcoming tasks."
          />
          <TaskGroup
            title="Done recently"
            tasks={doneRecent}
            overdueIds={overdueIds}
            patientName={patientName}
            onOpenPatient={(patientId) => navigateTo("patient-detail", { patientId })}
            onComplete={openCompleteDialog}
            onDismiss={openDismissDialog}
            emptyLabel="No recent activity."
          />
        </CardContent>
      </Card>

      {/* Complete task dialog */}
      <Dialog open={!!completingTask} onOpenChange={(open) => !open && setCompletingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete task</DialogTitle>
            <DialogDescription>
              {completingTask ? TASK_TYPE_CONFIG[completingTask.type].label : ""} for{" "}
              {completingTask ? patientName(completingTask.patientId) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isConfirmationTask && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Outcome</Label>
                <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
                  {CONFIRMATION_OUTCOMES.map((o) => (
                    <div key={o.value} className="flex items-center gap-2">
                      <RadioGroupItem value={o.value} id={`outcome-${o.value}`} />
                      <Label htmlFor={`outcome-${o.value}`} className="font-normal">
                        {o.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Note (optional)</Label>
              <Textarea
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                placeholder="Add context for the record..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletingTask(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss task dialog */}
      <Dialog open={!!dismissingTask} onOpenChange={(open) => !open && setDismissingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss task</DialogTitle>
            <DialogDescription>
              {dismissingTask ? TASK_TYPE_CONFIG[dismissingTask.type].label : ""} for{" "}
              {dismissingTask ? patientName(dismissingTask.patientId) : ""} — a note is required.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value)}
              placeholder="Why is this task being dismissed?"
              className="min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissingTask(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDismiss} disabled={!dismissNote.trim()}>
              <XCircle className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
