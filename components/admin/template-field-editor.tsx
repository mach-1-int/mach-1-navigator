"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowDown, ArrowUp, ShieldCheck, Trash2 } from "lucide-react"
import type { NoteFieldType, TemplateField } from "@/lib/types"
import {
  AUTO_FILL_SOURCE_OPTIONS,
  NOTE_FIELD_TYPE_OPTIONS,
  SHOW_IF_TARGET_TYPES,
  uniqueFieldId,
} from "@/lib/template-editor"

const NONE = "__none__"

interface TemplateFieldEditorProps {
  field: TemplateField
  index: number
  total: number
  siblings: TemplateField[] // other fields on the template (self excluded)
  syncIdWithLabel: boolean // new fields: id keeps following the label
  onChange: (field: TemplateField) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}

export function TemplateFieldEditor({
  field,
  index,
  total,
  siblings,
  syncIdWithLabel,
  onChange,
  onRemove,
  onMove,
}: TemplateFieldEditorProps) {
  const set = (patch: Partial<TemplateField>) => onChange({ ...field, ...patch })

  const typeMeta = NOTE_FIELD_TYPE_OPTIONS.find((t) => t.value === field.type)
  const gateTargets = siblings.filter((f) => SHOW_IF_TARGET_TYPES.includes(f.type))
  const gateTarget = field.showIf ? siblings.find((f) => f.id === field.showIf!.fieldId) : undefined
  const isSelectLike = field.type === "select" || field.type === "multi-select"
  const hasFixedOptions = isSelectLike && !field.optionsSource
  const takesPlaceholder = field.type === "text" || field.type === "textarea" || field.type === "time"

  const handleLabelChange = (label: string) => {
    const patch: Partial<TemplateField> = { label }
    if (syncIdWithLabel) {
      patch.id = uniqueFieldId(label, siblings.map((f) => f.id))
    }
    set(patch)
  }

  const handleTypeChange = (type: NoteFieldType) => {
    const patch: Partial<TemplateField> = { type }
    if (type === "provider") {
      patch.optionsSource = "providers"
    } else if (field.type === "provider") {
      patch.optionsSource = undefined
    }
    set(patch)
  }

  const handleGateTargetChange = (value: string) => {
    if (value === NONE) {
      set({ showIf: undefined })
      return
    }
    const target = siblings.find((f) => f.id === value)
    set({ showIf: { fieldId: value, equals: target?.type === "select" ? target.options?.[0] ?? "" : true } })
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-muted-foreground shrink-0">#{index + 1}</span>
          <code className="text-xs text-muted-foreground truncate">{field.id || "—"}</code>
          {field.neverSkip && (
            <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldCheck className="h-3 w-3" />
              never skip
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="h-3.5 w-3.5" />
            <span className="sr-only">Move up</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span className="sr-only">Move down</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Remove field</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={field.label} onChange={(e) => handleLabelChange(e.target.value)} placeholder="e.g. Pickup time" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Field type</Label>
          <Select value={field.type} onValueChange={(v) => handleTypeChange(v as NoteFieldType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_FIELD_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {typeMeta && <p className="text-[11px] text-muted-foreground">{typeMeta.hint}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Section</Label>
          <Input
            value={field.section ?? ""}
            onChange={(e) => set({ section: e.target.value || undefined })}
            placeholder="e.g. Transit, Encounter, Wrap-Up"
          />
        </div>
        <div className="flex items-end gap-6 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={field.required} onCheckedChange={(v) => set({ required: v })} />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!field.neverSkip} onCheckedChange={(v) => set({ neverSkip: v || undefined })} />
            Never skip
          </label>
        </div>
      </div>

      {isSelectLike && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Options source</Label>
            <Select
              value={field.optionsSource ?? "fixed"}
              onValueChange={(v) =>
                set({ optionsSource: v === "fixed" ? undefined : (v as TemplateField["optionsSource"]) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed options</SelectItem>
                <SelectItem value="providers">Provider directory</SelectItem>
                <SelectItem value="navigators">Navigator roster</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasFixedOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs">Options (one per line)</Label>
              <Textarea
                value={(field.options ?? []).join("\n")}
                onChange={(e) => set({ options: e.target.value.split("\n") })}
                onBlur={() => set({ options: (field.options ?? []).map((o) => o.trim()).filter(Boolean) })}
                rows={3}
                placeholder={"Housing\nFood security\nTransportation"}
              />
            </div>
          )}
        </div>
      )}

      {field.type === "attestation" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Attestation language (inserted verbatim when checked)</Label>
          <Textarea
            value={field.attestationText ?? ""}
            onChange={(e) => set({ attestationText: e.target.value })}
            rows={2}
            placeholder="Exact manual language, word for word."
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Narrative prefix</Label>
          <Input
            value={field.narrativePrefix ?? ""}
            onChange={(e) => set({ narrativePrefix: e.target.value || undefined })}
            placeholder="e.g. Navigator arrived at "
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Narrative suffix</Label>
          <Input
            value={field.narrativeSuffix ?? ""}
            onChange={(e) => set({ narrativeSuffix: e.target.value || undefined })}
            placeholder="e.g. . "
          />
        </div>
        {field.type === "multi-select" ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Joiner between selections</Label>
            <Input
              value={field.narrativeJoiner ?? ""}
              onChange={(e) => set({ narrativeJoiner: e.target.value || undefined })}
              placeholder=", "
            />
          </div>
        ) : takesPlaceholder ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Placeholder hint</Label>
            <Input
              value={field.placeholder ?? ""}
              onChange={(e) => set({ placeholder: e.target.value || undefined })}
              placeholder="e.g. 10:05AM"
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Show only when</Label>
          <div className="flex gap-2">
            <Select value={field.showIf?.fieldId ?? NONE} onValueChange={handleGateTargetChange}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Always shown</SelectItem>
                {gateTargets.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label || f.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.showIf && gateTarget?.type === "boolean" && (
              <Select
                value={field.showIf.equals === true ? "true" : "false"}
                onValueChange={(v) => set({ showIf: { fieldId: field.showIf!.fieldId, equals: v === "true" } })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">is Yes</SelectItem>
                  <SelectItem value="false">is No</SelectItem>
                </SelectContent>
              </Select>
            )}
            {field.showIf && gateTarget?.type === "select" && (
              <Select
                value={String(field.showIf.equals)}
                onValueChange={(v) => set({ showIf: { fieldId: field.showIf!.fieldId, equals: v } })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(gateTarget.options ?? []).map((o) => (
                    <SelectItem key={o} value={o}>
                      = {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {gateTargets.length === 0 && !field.showIf && (
            <p className="text-[11px] text-muted-foreground">Add a Yes/No or Select field above to gate this one.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Auto-fill from</Label>
          <div className="flex gap-2">
            <Select
              value={field.autoFill?.source ?? NONE}
              onValueChange={(v) =>
                set({
                  autoFill:
                    v === NONE
                      ? undefined
                      : { source: v as NonNullable<TemplateField["autoFill"]>["source"], key: field.autoFill?.key },
                })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No auto-fill</SelectItem>
                {AUTO_FILL_SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.autoFill && (
              <Input
                className="w-40"
                value={field.autoFill.key ?? ""}
                onChange={(e) =>
                  set({ autoFill: { source: field.autoFill!.source, key: e.target.value || undefined } })
                }
                placeholder="key (optional)"
              />
            )}
          </div>
          {field.autoFill && (
            <p className="text-[11px] text-muted-foreground">
              {AUTO_FILL_SOURCE_OPTIONS.find((s) => s.value === field.autoFill!.source)?.hint}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
