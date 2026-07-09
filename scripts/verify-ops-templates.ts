/**
 * Verification: G-1 Template Editor (Gellert ops blitz)
 * Run: npx tsx scripts/verify-ops-templates.ts
 *
 * Blocks: id slugging, template validation, duplicate uniqueness, the
 * save/update roundtrip (pure mirror of the context's saveNoteTemplate),
 * the delete guard vs seeded notes, and the live-preview sample responses
 * rendering every system template through generateNarrative.
 *
 * Integration merges these blocks into scripts/verify-gellert-ops.ts.
 */

import {
  NOTE_FIELD_TYPE_OPTIONS,
  canDeleteTemplate,
  duplicateTemplate,
  isTemplateInUse,
  newTemplateId,
  sampleResponses,
  slugifyLabel,
  uniqueFieldId,
  upsertTemplate,
  validateTemplate,
} from "../lib/template-editor"
import { generateNarrative, validateResponses } from "../lib/narrative-generator"
import {
  MED_NO_TOUCH_LANGUAGE,
  TIME_FORMAT_REGEX,
  gellertNoteTemplates,
} from "../lib/gellert-templates"
import { initialNoteTemplates, initialNotes, initialProviders } from "../lib/initial-data"
import type { NoteFieldType, NoteTemplate } from "../lib/types"

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  ✓ ${message}`)
}

let passed = 0
let failed = 0

function run(name: string, fn: () => void) {
  try {
    console.log(`\n--- ${name} ---`)
    fn()
    passed++
  } catch (err) {
    failed++
    console.error(err instanceof Error ? err.message : err)
  }
}

const medicalTemplate = gellertNoteTemplates.find((t) => t.id === "template-gellert-medical")!

const customTemplate = (overrides: Partial<NoteTemplate> = {}): NoteTemplate => ({
  id: "template-custom-test",
  name: "Test Template",
  description: "test",
  noteType: "visit",
  fields: [
    { id: "start-time", label: "Start time", type: "time", required: true, narrativePrefix: "Started at ", narrativeSuffix: ". " },
    { id: "summary", label: "Summary", type: "textarea", required: true, narrativePrefix: "Summary: ", narrativeSuffix: "." },
  ],
  ...overrides,
})

// ============================================================================
// BLOCK 1: ID SLUGGING
// ============================================================================

run("Block 1: slugifyLabel + uniqueFieldId + newTemplateId", () => {
  assert(slugifyLabel("Pickup location") === "pickup-location", "label slugs to kebab-case")
  assert(slugifyLabel("  Safety screen — patient denied!  ") === "safety-screen-patient-denied", "punctuation collapses to single dashes, ends trimmed")
  assert(slugifyLabel("???") === "field", "all-punctuation labels fall back to 'field'")
  assert(uniqueFieldId("Pickup time", []) === "pickup-time", "unique label keeps its slug")
  assert(uniqueFieldId("Pickup time", ["pickup-time"]) === "pickup-time-2", "colliding slug gets -2")
  assert(uniqueFieldId("Pickup time", ["pickup-time", "pickup-time-2"]) === "pickup-time-3", "suffix increments past taken ids")
  const existing = initialNoteTemplates.map((t) => t.id)
  const id = newTemplateId("PCP Visit (Transit)", existing)
  assert(id === "template-custom-pcp-visit-transit", "new template ids are template-custom-<slug>")
  assert(newTemplateId("PCP Visit (Transit)", [...existing, id]) === `${id}-2`, "template id collisions get numeric suffixes")
})

// ============================================================================
// BLOCK 2: TEMPLATE VALIDATION
// ============================================================================

run("Block 2: validateTemplate", () => {
  for (const template of gellertNoteTemplates) {
    assert(validateTemplate(template).length === 0, `system template "${template.name}" validates clean`)
  }
  assert(validateTemplate(customTemplate()).length === 0, "well-formed custom template validates clean")

  assert(
    validateTemplate(customTemplate({ name: "  " })).some((e) => e.includes("name")),
    "blank name rejected"
  )
  assert(
    validateTemplate(customTemplate({ fields: [] })).some((e) => e.includes("at least one field")),
    "zero fields rejected"
  )

  const dup = customTemplate()
  dup.fields = [dup.fields[0], { ...dup.fields[1], id: "start-time" }]
  assert(
    validateTemplate(dup).some((e) => e.includes("Duplicate field id")),
    "duplicate field ids rejected"
  )

  const badAttestation = customTemplate()
  badAttestation.fields.push({ id: "attest", label: "Attestation", type: "attestation", required: true })
  assert(
    validateTemplate(badAttestation).some((e) => e.includes("attestation")),
    "attestation without attestationText rejected"
  )
  badAttestation.fields[2].attestationText = MED_NO_TOUCH_LANGUAGE
  assert(validateTemplate(badAttestation).length === 0, "attestation with exact language accepted")

  const badGate = customTemplate()
  badGate.fields[1] = { ...badGate.fields[1], showIf: { fieldId: "no-such-field", equals: true } }
  assert(
    validateTemplate(badGate).some((e) => e.includes("no-such-field")),
    "showIf pointing at a missing field rejected"
  )
  const selfGate = customTemplate()
  selfGate.fields[1] = { ...selfGate.fields[1], showIf: { fieldId: "summary", equals: true } }
  assert(
    validateTemplate(selfGate).some((e) => e.includes("gated by itself")),
    "showIf pointing at itself rejected"
  )

  const emptySelect = customTemplate()
  emptySelect.fields.push({ id: "pick", label: "Pick", type: "select", required: false, options: ["  "] })
  assert(
    validateTemplate(emptySelect).some((e) => e.includes("at least one option")),
    "select without usable options rejected"
  )
  emptySelect.fields[2] = { ...emptySelect.fields[2], options: undefined, optionsSource: "navigators" }
  assert(validateTemplate(emptySelect).length === 0, "select with a dynamic optionsSource needs no fixed options")
})

// ============================================================================
// BLOCK 3: DUPLICATE UNIQUENESS
// ============================================================================

run("Block 3: duplicateTemplate", () => {
  const ids = initialNoteTemplates.map((t) => t.id)
  const copy = duplicateTemplate(medicalTemplate, ids)
  assert(copy.id === "template-gellert-medical-copy", "copy id gets the -copy suffix")
  assert(copy.isCustom === true, "copy is flagged custom")
  assert(copy.name === "Medical Appointment ± Transit (Copy)", "copy name marks itself")
  assert(copy.fields.length === medicalTemplate.fields.length, "all fields carried over")
  assert(validateTemplate(copy).length === 0, "the copy validates clean as-is")

  copy.fields[0].label = "CHANGED"
  assert(medicalTemplate.fields[0].label !== "CHANGED", "copy is deep — mutating it never touches the source template")

  const second = duplicateTemplate(medicalTemplate, [...ids, copy.id])
  assert(second.id === "template-gellert-medical-copy-2", "second duplicate gets a distinct id")
  const third = duplicateTemplate(medicalTemplate, [...ids, copy.id, second.id])
  assert(third.id === "template-gellert-medical-copy-3", "third duplicate keeps incrementing")
})

// ============================================================================
// BLOCK 4: SAVE / UPDATE ROUNDTRIP (pure mirror of saveNoteTemplate)
// ============================================================================

run("Block 4: upsertTemplate roundtrip", () => {
  const before = [...initialNoteTemplates]
  const fresh = customTemplate({ isCustom: undefined })

  const created = upsertTemplate(before, fresh)
  assert(created.length === before.length + 1, "create appends the new template")
  const saved = created.find((t) => t.id === fresh.id)!
  assert(saved.isCustom === true, "newly created templates are stamped isCustom")
  assert(before.every((t, i) => created[i] === t), "existing templates untouched on create")

  const renamed = { ...saved, name: "PCP Visit (Transit)" }
  const updated = upsertTemplate(created, renamed)
  assert(updated.length === created.length, "update never duplicates")
  assert(updated.find((t) => t.id === fresh.id)!.name === "PCP Visit (Transit)", "update overwrites by id")

  // The demo beat: duplicate the manual medical template, rename, tweak, save
  const copy = duplicateTemplate(medicalTemplate, updated.map((t) => t.id))
  copy.name = "PCP Visit (Transit)"
  copy.fields = copy.fields.map((f) =>
    f.id === "provider-guidance" ? { ...f, label: "PCP guidance / instructions" } : f
  )
  assert(validateTemplate(copy).length === 0, "demo-beat copy validates after the tweak")
  const withCopy = upsertTemplate(updated, copy)
  assert(withCopy.some((t) => t.id === copy.id && t.isCustom), "demo-beat copy lands in the picker set")
})

// ============================================================================
// BLOCK 5: DELETE GUARD VS SEEDED NOTES
// ============================================================================

run("Block 5: delete guard", () => {
  assert(
    initialNotes.some((n) => n.templateId === "template-gellert-medical"),
    "seed notes reference the medical template (guard precondition)"
  )
  assert(isTemplateInUse("template-gellert-medical", initialNotes), "in-use detection sees seeded notes")
  assert(
    !canDeleteTemplate("template-gellert-medical", initialNoteTemplates, initialNotes),
    "template referenced by a seed note cannot be deleted"
  )
  assert(
    !canDeleteTemplate("template-does-not-exist", initialNoteTemplates, initialNotes),
    "missing template id cannot be deleted (returns false, matching the context action)"
  )
  const withCustom = upsertTemplate(initialNoteTemplates, customTemplate())
  assert(
    canDeleteTemplate("template-custom-test", withCustom, initialNotes),
    "unreferenced custom template can be deleted"
  )
})

// ============================================================================
// BLOCK 6: LIVE PREVIEW SAMPLES -> generateNarrative
// ============================================================================

run("Block 6: sampleResponses render every system template", () => {
  assert(
    NOTE_FIELD_TYPE_OPTIONS.length === 9 && new Set(NOTE_FIELD_TYPE_OPTIONS.map((o) => o.value)).size === 9,
    "the editor's type palette covers all nine NoteFieldType values"
  )

  for (const template of gellertNoteTemplates) {
    const responses = sampleResponses(template, initialProviders)
    const narrative = generateNarrative(template, responses, { providers: initialProviders })
    assert(narrative.trim().length > 0, `"${template.name}" preview renders a narrative`)
    const formErrors = validateResponses(template, responses)
    assert(
      Object.keys(formErrors).length === 0,
      `"${template.name}" samples satisfy the note builder's own field validation`
    )
  }

  const medical = sampleResponses(medicalTemplate, initialProviders)
  assert(medical["transport-provided"] === true, "showIf gates are forced open so transit language previews")
  const narrative = generateNarrative(medicalTemplate, medical, { providers: initialProviders })
  assert(narrative.includes("Navigator provided transport"), "gated transit sentence appears in the preview")
  assert(
    TIME_FORMAT_REGEX.test(String(medical["pickup-time"])),
    "sampled clock times honor the manual H:MMAM/PM format"
  )
  assert(
    narrative.includes(initialProviders[0].name),
    "provider fields resolve to the directory display string, not a raw id"
  )

  const medAssist = gellertNoteTemplates.find((t) => t.id === "template-gellert-med-assist")!
  const medAssistNarrative = generateNarrative(
    medAssist,
    sampleResponses(medAssist, initialProviders),
    { providers: initialProviders }
  )
  assert(
    medAssistNarrative.includes(MED_NO_TOUCH_LANGUAGE),
    "attestation preview carries the manual's exact no-touch language verbatim"
  )

  const perType = sampleResponses(
    customTemplate({
      fields: (["select", "multi-select", "text", "boolean", "time-duration", "textarea", "time", "provider", "attestation"] as NoteFieldType[]).map(
        (type, i) => ({
          id: `f-${type}`,
          label: `Field ${i}`,
          type,
          required: false,
          options: type === "select" || type === "multi-select" ? ["A", "B", "C"] : undefined,
          attestationText: type === "attestation" ? "Attested verbatim." : undefined,
        })
      ),
    }),
    initialProviders
  )
  assert(perType["f-select"] === "A", "select samples the first option")
  assert(Array.isArray(perType["f-multi-select"]) && (perType["f-multi-select"] as string[]).length === 2, "multi-select samples two options")
  assert(typeof perType["f-time-duration"] === "number" && (perType["f-time-duration"] as number) > 0, "duration samples positive minutes")
  assert(perType["f-attestation"] === true, "attestation samples checked")
  assert(perType["f-provider"] === initialProviders[0].id, "provider samples a real directory id")
})

console.log("\n=======================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
