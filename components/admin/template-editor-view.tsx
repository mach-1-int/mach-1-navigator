"use client"

/**
 * Note Templates — the template editor (Gellert ops blitz G-1).
 *
 * List view of every note template (system manual templates vs custom, with
 * duplicate / edit / delete-with-in-use-guard) plus a full editor: metadata,
 * field list with add/remove/reorder, and a live narrative preview rendered
 * through the same generateNarrative that writes saved notes. Templates are
 * pure data — anything saved here is immediately available in the
 * note builder's template picker.
 */

import { useMemo, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Copy, FileText, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useDemoData } from "@/lib/demo-data-context"
import {
  ENCOUNTER_TYPE_OPTIONS,
  NOTE_TYPE_OPTIONS,
  duplicateTemplate,
  newTemplateId,
  validateTemplate,
} from "@/lib/template-editor"
import type { EncounterType, NoteTemplate, PatientNote, TemplateField } from "@/lib/types"
import { TemplateFieldEditor } from "./template-field-editor"
import { TemplatePreview } from "./template-preview"

interface FieldEntry {
  key: string // stable React key across reorders
  field: TemplateField
  isNew: boolean // added this session: id keeps following the label
}

interface DraftMeta {
  id: string // "" until first save of a brand-new template
  name: string
  description: string
  noteType: PatientNote["type"]
  encounterTypes: EncounterType[]
  billable: boolean
  manualSection: string
  isCustom?: boolean
}

export function TemplateEditorView() {
  const { noteTemplates, notes, saveNoteTemplate, deleteNoteTemplate } = useDemoData()

  const [meta, setMeta] = useState<DraftMeta | null>(null)
  const [entries, setEntries] = useState<FieldEntry[]>([])
  const [deleteTarget, setDeleteTarget] = useState<NoteTemplate | null>(null)
  const keySeq = useRef(0)
  const nextKey = () => `field-entry-${keySeq.current++}`

  const workingTemplate = useMemo((): NoteTemplate | null => {
    if (!meta) return null
    return {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      noteType: meta.noteType,
      encounterTypes: meta.encounterTypes.length > 0 ? meta.encounterTypes : undefined,
      billable: meta.billable,
      manualSection: meta.manualSection.trim() || undefined,
      isCustom: meta.isCustom,
      fields: entries.map((e) => e.field),
    }
  }, [meta, entries])

  const openEditor = (template: NoteTemplate) => {
    setMeta({
      id: template.id,
      name: template.name,
      description: template.description,
      noteType: template.noteType,
      encounterTypes: template.encounterTypes ?? [],
      billable: template.billable !== false,
      manualSection: template.manualSection ?? "",
      isCustom: template.isCustom,
    })
    setEntries(template.fields.map((field) => ({ key: nextKey(), field, isNew: false })))
  }

  const handleNew = () => {
    openEditor({
      id: "",
      name: "",
      description: "",
      noteType: "visit",
      billable: true,
      isCustom: true,
      fields: [],
    })
  }

  const handleDuplicate = (template: NoteTemplate) => {
    const copy = duplicateTemplate(template, noteTemplates.map((t) => t.id))
    openEditor(copy)
    toast.info(`Editing a copy of "${template.name}" — nothing is saved until you hit Save`)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const deleted = deleteNoteTemplate(deleteTarget.id)
    if (deleted) {
      toast.success(`Deleted "${deleteTarget.name}"`)
    } else {
      toast.error(`Cannot delete "${deleteTarget.name}" — existing notes were written from it`)
    }
    setDeleteTarget(null)
  }

  const handleSave = () => {
    if (!workingTemplate || !meta) return
    const template: NoteTemplate = { ...workingTemplate }
    if (!template.id) {
      template.id = newTemplateId(template.name || "untitled", noteTemplates.map((t) => t.id))
    }
    const errors = validateTemplate(template)
    if (errors.length > 0) {
      toast.error(errors[0], { description: errors.length > 1 ? `+ ${errors.length - 1} more — see the preview pane` : undefined })
      return
    }
    saveNoteTemplate(template)
    toast.success(`Saved "${template.name}"`, { description: "Live in the note builder's template picker now." })
    setMeta(null)
    setEntries([])
  }

  const addField = () => {
    setEntries((prev) => [
      ...prev,
      {
        key: nextKey(),
        field: {
          id: "",
          label: "",
          type: "text",
          required: false,
          section: prev[prev.length - 1]?.field.section,
        },
        isNew: true,
      },
    ])
  }

  const updateField = (key: string, field: TemplateField) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, field } : e)))
  }

  const removeField = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key))
  }

  const moveField = (key: string, direction: -1 | 1) => {
    setEntries((prev) => {
      const index = prev.findIndex((e) => e.key === key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  if (meta && workingTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => setMeta(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Templates
            </Button>
            <h2 className="text-lg font-semibold truncate">{meta.name.trim() || "New template"}</h2>
            {meta.id && !meta.isCustom ? (
              <Badge variant="secondary">System</Badge>
            ) : (
              <Badge className="bg-violet-600 hover:bg-violet-600 text-white">Custom</Badge>
            )}
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-1.5" />
            Save template
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_420px] items-start">
          <div className="space-y-4">
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Template details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={meta.name}
                      onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                      placeholder="e.g. PCP Visit (Transit)"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Note type</Label>
                    <Select
                      value={meta.noteType}
                      onValueChange={(v) => setMeta({ ...meta, noteType: v as PatientNote["type"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={meta.description}
                    onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                    rows={2}
                    placeholder="What is this template for? Shown in the note builder's picker."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Manual section reference</Label>
                    <Input
                      value={meta.manualSection}
                      onChange={(e) => setMeta({ ...meta, manualSection: e.target.value })}
                      placeholder="e.g. Manual §3 — Medical Appointments"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={meta.billable} onCheckedChange={(v) => setMeta({ ...meta, billable: v })} />
                      Billable encounter
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pre-selected for encounter types</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                    {ENCOUNTER_TYPE_OPTIONS.map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={meta.encounterTypes.includes(o.value)}
                          onCheckedChange={(checked) =>
                            setMeta({
                              ...meta,
                              encounterTypes: checked
                                ? [...meta.encounterTypes, o.value]
                                : meta.encounterTypes.filter((t) => t !== o.value),
                            })
                          }
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-card-foreground">Fields</CardTitle>
                    <CardDescription>
                      In narrative order — each field renders prefix + response + suffix.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addField}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add field
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {entries.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No fields yet — add the first field to start shaping the narrative.
                  </p>
                )}
                {entries.map((entry, index) => (
                  <TemplateFieldEditor
                    key={entry.key}
                    field={entry.field}
                    index={index}
                    total={entries.length}
                    siblings={entries.filter((e) => e.key !== entry.key).map((e) => e.field)}
                    syncIdWithLabel={entry.isNew}
                    onChange={(field) => updateField(entry.key, field)}
                    onRemove={() => removeField(entry.key)}
                    onMove={(direction) => moveField(entry.key, direction)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="xl:sticky xl:top-4">
            <TemplatePreview template={workingTemplate} />
          </div>
        </div>
      </div>
    )
  }

  const customCount = noteTemplates.filter((t) => t.isCustom).length

  return (
    <>
      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <FileText className="h-5 w-5" />
                Note Templates
              </CardTitle>
              <CardDescription>
                {noteTemplates.length} templates on file ({noteTemplates.length - customCount} system,{" "}
                {customCount} custom) — duplicate a manual template to build a practice-specific variant without a
                code change.
              </CardDescription>
            </div>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1.5" />
              New template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Encounter types</TableHead>
                <TableHead className="text-right">Fields</TableHead>
                <TableHead className="text-right">Notes written</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {noteTemplates.map((template) => {
                const usageCount = notes.filter((n) => n.templateId === template.id).length
                return (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.isCustom ? (
                          <Badge className="bg-violet-600 hover:bg-violet-600 text-white">Custom</Badge>
                        ) : (
                          <Badge variant="secondary">System</Badge>
                        )}
                        {template.billable === false && (
                          <Badge variant="outline" className="font-normal">
                            Non-billable
                          </Badge>
                        )}
                      </div>
                      {template.manualSection && (
                        <p className="text-xs text-muted-foreground mt-0.5">{template.manualSection}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(template.encounterTypes ?? []).map((et) => (
                          <Badge key={et} variant="outline" className="font-normal text-xs">
                            {ENCOUNTER_TYPE_OPTIONS.find((o) => o.value === et)?.label ?? et}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{template.fields.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{usageCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)}>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Duplicate
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditor(template)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={usageCount > 0}
                          title={usageCount > 0 ? `${usageCount} saved notes were written from this template` : undefined}
                          onClick={() => setDeleteTarget(template)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && !deleteTarget.isCustom
                ? "This is a system template from the Note-Taking Manual. Deleting it removes it from the note builder for every navigator."
                : "This removes the template from the note builder for every navigator."}{" "}
              Templates referenced by saved notes cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
