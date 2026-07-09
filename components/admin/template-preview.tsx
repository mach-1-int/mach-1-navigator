"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Eye } from "lucide-react"
import { useDemoData } from "@/lib/demo-data-context"
import { generateNarrative } from "@/lib/narrative-generator"
import { sampleResponses, validateTemplate } from "@/lib/template-editor"
import type { NoteTemplate } from "@/lib/types"

interface TemplatePreviewProps {
  template: NoteTemplate
}

/**
 * Live narrative preview: plausible sample responses per field type run
 * through the same generateNarrative that renders saved notes, so what the
 * admin sees here is the exact saved-form output.
 */
export function TemplatePreview({ template }: TemplatePreviewProps) {
  const { providers } = useDemoData()

  const { narrative, errors, sectionNames } = useMemo(() => {
    const responses = sampleResponses(template, providers)
    return {
      narrative: generateNarrative(template, responses, { providers }),
      errors: validateTemplate(template),
      sectionNames: [...new Set(template.fields.map((f) => f.section).filter(Boolean))] as string[],
    }
  }, [template, providers])

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
          <Eye className="h-4 w-4" />
          Live narrative preview
        </CardTitle>
        <CardDescription>
          Sample responses per field type, rendered through the same engine that writes saved notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          {narrative ? (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{narrative}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No narrative yet — add fields with narrative prefixes/suffixes to see the note take shape.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {template.fields.length} field{template.fields.length === 1 ? "" : "s"}
          </span>
          {template.fields.some((f) => f.neverSkip) && (
            <span>· {template.fields.filter((f) => f.neverSkip).length} never-skip</span>
          )}
          {sectionNames.map((s) => (
            <Badge key={s} variant="outline" className="font-normal">
              {s}
            </Badge>
          ))}
          <Badge variant={template.billable === false ? "secondary" : "default"} className="font-normal">
            {template.billable === false ? "Non-billable" : "Billable"}
          </Badge>
        </div>

        {errors.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Fix before saving
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {errors.map((e) => (
                <li key={e} className="text-xs text-destructive">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
