"use client"

/**
 * Note Templates — template editor (Phase 0 placeholder).
 * Workstream G-1 replaces this with the full editor: template list with
 * system/custom badges, field editor, live narrative preview, duplicate/
 * delete with in-use guard. CRUD lands through saveNoteTemplate /
 * deleteNoteTemplate on the demo-data context.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"

export function TemplateEditorView() {
  const { noteTemplates } = useDemoData()
  const customCount = noteTemplates.filter((t) => t.isCustom).length

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <FileText className="h-5 w-5" />
          Note Templates
        </CardTitle>
        <CardDescription>
          {noteTemplates.length} templates on file ({noteTemplates.length - customCount} system, {customCount} custom)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          The template editor is landing in this blitz (workstream G-1): create, duplicate, and edit
          note templates — fields, narrative language, encounter-type mapping — without a code change.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {noteTemplates.map((t) => (
            <Badge key={t.id} variant="outline" className="font-normal">
              {t.name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
