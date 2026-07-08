/**
 * Verify: Narrative Generator (characterization test)
 *
 * Run with: npm run verify:narrative-generator
 *
 * An ESLint complexity scan (temporary complexity:1 rule override across
 * app/, components/, lib/, hooks/, scripts/) found buildFieldSegment
 * (lib/narrative-generator.ts) at cyclomatic complexity 18 — the highest of
 * any remaining non-test, non-React-component function (React components
 * score higher but aren't practically characterization-testable without a
 * UI test framework this repo doesn't have; see PR #1's parseHL7v2 note).
 *
 * Split the per-field-type switch into one helper per NoteFieldType
 * (buildTextSegment, buildMultiSelectSegment, buildBooleanSegment,
 * buildDurationSegment), replacing the boolean case's nested if/else with
 * early returns. buildFieldSegment is now a plain dispatch (complexity
 * 18 -> 9); the largest helper (buildBooleanSegment) is 5.
 *
 * These assertions exercise buildFieldSegment only through the exported
 * generateNarrative, covering every NoteFieldType branch (including the
 * "supervisor-notified" false-case special-case and the joiner/empty/
 * zero-duration edge cases) plus validateResponses/isValidForm. Confirmed
 * to pass identically against both the pre- and post-refactor
 * implementation.
 */

import { generateNarrative, validateResponses, isValidForm } from "../lib/narrative-generator"
import type { NoteTemplate, TemplateField } from "../lib/types"

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function run(title: string, fn: () => void) {
  console.log(`\n--- ${title} ---`)
  try {
    fn()
  } catch (err) {
    failed++
    console.error(`  ✗ threw: ${err instanceof Error ? err.message : err}`)
  }
}

function field(overrides: Partial<TemplateField> & Pick<TemplateField, "id" | "type">): TemplateField {
  return {
    label: overrides.id,
    required: false,
    ...overrides,
  }
}

function template(fields: TemplateField[]): NoteTemplate {
  return {
    id: "tmpl-1",
    name: "Test Template",
    description: "",
    noteType: "visit",
    fields,
  }
}

// =============================================================================
run("Text-based fields (select/text/textarea): prefix + value + suffix", () => {
  const tmpl = template([
    field({ id: "reason", type: "select", narrativePrefix: "Reason for visit: ", narrativeSuffix: "." }),
    field({ id: "notes", type: "text" }),
    field({ id: "summary", type: "textarea", narrativePrefix: "Summary: " }),
  ])
  const narrative = generateNarrative(tmpl, { reason: "Follow-up", notes: "Stable", summary: "Doing well" })
  assert(
    narrative === "Reason for visit: Follow-up.StableSummary: Doing well",
    `text fields concatenate with prefix/suffix (got "${narrative}")`
  )
})

run("Empty/null/undefined/empty-array responses are skipped", () => {
  const tmpl = template([
    field({ id: "a", type: "text", narrativePrefix: "A: " }),
    field({ id: "b", type: "text", narrativePrefix: "B: " }),
    field({ id: "c", type: "text", narrativePrefix: "C: " }),
    field({ id: "d", type: "multi-select", narrativePrefix: "D: " }),
  ])
  const narrative = generateNarrative(tmpl, { a: undefined, b: null, c: "", d: [] })
  assert(narrative === "", `all-empty responses produce an empty narrative (got "${narrative}")`)
})

// =============================================================================
run("Multi-select: default and custom joiners, empty array yields nothing", () => {
  const tmpl = template([
    field({ id: "barriers", type: "multi-select", narrativePrefix: "Barriers: ", narrativeSuffix: "." }),
  ])
  const defaultJoiner = generateNarrative(tmpl, { barriers: ["Transportation", "Housing"] })
  assert(defaultJoiner === "Barriers: Transportation, Housing.", `default joiner is ", " (got "${defaultJoiner}")`)

  const customTmpl = template([
    field({ id: "barriers", type: "multi-select", narrativePrefix: "Barriers: ", narrativeJoiner: " and " }),
  ])
  const customJoiner = generateNarrative(customTmpl, { barriers: ["Transportation", "Housing"] })
  assert(customJoiner === "Barriers: Transportation and Housing", `custom joiner is honored (got "${customJoiner}")`)

  const empty = generateNarrative(tmpl, { barriers: [] })
  assert(empty === "", `empty multi-select array produces no segment (got "${empty}")`)
})

// =============================================================================
run("Boolean fields: true phrase, generic false phrase, supervisor-notified special case", () => {
  const trueField = template([field({ id: "reviewed", type: "boolean", narrativePrefix: "Care plan was " })])
  const truthy = generateNarrative(trueField, { reviewed: true })
  assert(truthy === "Care plan was reviewed and discussed", `true uses the contextual phrase (got "${truthy}")`)

  const falseField = template([field({ id: "reviewed", type: "boolean", narrativePrefix: "Care plan was " })])
  const falsy = generateNarrative(falseField, { reviewed: false })
  assert(falsy === "Care plan was not reviewed", `generic false phrase (got "${falsy}")`)

  const supervisorField = template([
    field({ id: "supervisor-notified", type: "boolean", narrativePrefix: "Supervisor " }),
  ])
  const supervisorFalse = generateNarrative(supervisorField, { "supervisor-notified": false })
  assert(
    supervisorFalse === "Supervisor was not notified",
    `supervisor-notified false uses its special phrase (got "${supervisorFalse}")`
  )

  const noPrefixField = template([field({ id: "flag", type: "boolean" })])
  const falseNoPrefix = generateNarrative(noPrefixField, { flag: false })
  assert(falseNoPrefix === "", `false with no prefix produces no segment (got "${falseNoPrefix}")`)
})

// =============================================================================
run("Time-duration fields: only positive numbers are included", () => {
  const tmpl = template([
    field({ id: "duration", type: "time-duration", narrativePrefix: "Duration: ", narrativeSuffix: " min." }),
  ])
  const positive = generateNarrative(tmpl, { duration: 45 })
  assert(positive === "Duration: 45 min.", `positive duration is included (got "${positive}")`)

  const zero = generateNarrative(tmpl, { duration: 0 })
  assert(zero === "", `zero duration is excluded (got "${zero}")`)

  const negative = generateNarrative(tmpl, { duration: -5 })
  assert(negative === "", `negative duration is excluded (got "${negative}")`)
})

// =============================================================================
run("Unknown field type falls through to an empty segment", () => {
  const tmpl = template([field({ id: "mystery", type: "unknown-type" as TemplateField["type"], narrativePrefix: "X: " })])
  const narrative = generateNarrative(tmpl, { mystery: "value" })
  assert(narrative === "", `unrecognized field type yields no segment (got "${narrative}")`)
})

// =============================================================================
run("Fields are joined in template order with no separator", () => {
  const tmpl = template([
    field({ id: "a", type: "text", narrativePrefix: "First. " }),
    field({ id: "b", type: "text", narrativePrefix: "Second." }),
  ])
  const narrative = generateNarrative(tmpl, { a: "one", b: "two" })
  assert(narrative === "First. oneSecond.two", `segments concatenate directly, in field order (got "${narrative}")`)
})

// =============================================================================
run("validateResponses / isValidForm", () => {
  const tmpl = template([
    field({ id: "required-text", type: "text", required: true, label: "Required Text" }),
    field({ id: "required-multi", type: "multi-select", required: true, label: "Required Multi" }),
    field({ id: "required-duration", type: "time-duration", required: true, label: "Required Duration" }),
    field({ id: "optional-text", type: "text", required: false, label: "Optional Text" }),
  ])

  const missingAll = validateResponses(tmpl, {})
  assert(missingAll["required-text"] === "Required Text is required", "missing required text field errors")
  assert(missingAll["required-duration"] === "Required Duration is required", "missing required duration errors")
  assert(!("optional-text" in missingAll), "optional field never errors")
  assert(!isValidForm(tmpl, {}), "form with missing required fields is invalid")

  const emptyMulti = validateResponses(tmpl, {
    "required-text": "ok",
    "required-multi": [],
    "required-duration": 10,
  })
  assert(
    emptyMulti["required-multi"] === "Select at least one required multi",
    `empty multi-select on a required field errors (got "${emptyMulti["required-multi"]}")`
  )

  const zeroDuration = validateResponses(tmpl, {
    "required-text": "ok",
    "required-multi": ["a"],
    "required-duration": 0,
  })
  assert(
    zeroDuration["required-duration"] === "Required Duration must be greater than 0",
    `zero duration on a required field errors (got "${zeroDuration["required-duration"]}")`
  )

  const allValid = validateResponses(tmpl, {
    "required-text": "ok",
    "required-multi": ["a"],
    "required-duration": 10,
  })
  assert(Object.keys(allValid).length === 0, "no errors when every required field is satisfied")
  assert(isValidForm(tmpl, {
    "required-text": "ok",
    "required-multi": ["a"],
    "required-duration": 10,
  }), "isValidForm is true when validateResponses has no errors")
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
