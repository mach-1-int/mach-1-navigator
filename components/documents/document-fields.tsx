"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { DocumentFieldDef } from "@/lib/document-definitions"

/**
 * Generic field renderer driven entirely by DOCUMENT_DEFINITIONS — no
 * per-type hardcoding. "med_rows" is handled separately by med-list-form.tsx.
 */
export function DocumentField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: DocumentFieldDef
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}) {
  const id = `doc-field-${field.id}`

  if (field.type === "boolean") {
    return (
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
      </div>
    )
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm">
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} className="bg-card">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm">
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>
    )
  }

  if (field.type === "date") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm">
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          id={id}
          type="date"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  // "text"
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type="text"
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** Required non-med_rows fields must be non-empty/true to allow completion. */
export function requiredFieldsSatisfied(fields: DocumentFieldDef[], values: Record<string, unknown>): boolean {
  return fields
    .filter((f) => f.required && f.type !== "med_rows")
    .every((f) => {
      const v = values[f.id]
      if (f.type === "boolean") return v === true
      return typeof v === "string" && v.trim().length > 0
    })
}
