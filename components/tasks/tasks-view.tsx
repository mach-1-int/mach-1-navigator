"use client"

/**
 * My Tasks (Phase 0 placeholder).
 * Workstream G-3 replaces this with the full engagement view: tasks grouped
 * overdue / today / upcoming with TASK_TYPE_CONFIG icons and colors,
 * confirmation outcome picker, and dismiss-with-note. Data flows through the
 * navigatorTasks slice + generateDueTasks/completeTask/dismissTask actions.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ListChecks } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { useRole } from "@/lib/role-context"
import { overdueTasks } from "@/lib/task-engine"

export function TasksView() {
  const { navigatorTasks } = useDemoData()
  const { currentUser } = useRole()

  const mine = navigatorTasks.filter((t) => t.navigatorId === currentUser?.id)
  const open = mine.filter((t) => t.status === "open")
  const overdue = overdueTasks(open)

  return (
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
      <CardContent>
        <p className="text-sm text-muted-foreground">
          The full task list is landing in this blitz (workstream G-3): appointment confirmations
          (48h / 24h / day-of), no-show recovery, post-visit follow-ups, and adverse-event response
          tasks — grouped by urgency with one-tap completion.
        </p>
      </CardContent>
    </Card>
  )
}
