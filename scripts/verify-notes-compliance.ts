/**
 * Verification: Gellert Note System + AI Scribe compliance
 * Run: npm run verify:notes
 *
 * PHASE 0 STUB — trivially-passing scaffold checks only. Workstream N-A fills
 * in the rule-engine blocks (each rule's canonical violation, template
 * integrity, seed self-consistency) and N-B the auto-fill/same-day blocks.
 */

import { gellertNoteTemplates, MED_NO_TOUCH_LANGUAGE, TIME_FORMAT_REGEX } from "../lib/gellert-templates"
import { checkNoteCompliance, hasBlockingFindings } from "../lib/note-compliance"
import { templateIdForEncounterType, encounterTypeForAppointment } from "../lib/note-taxonomy"
import { createInitialState } from "../lib/store"

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
  } catch (e) {
    failed++
    console.error(`  ✗ ${(e as Error).message}`)
  }
}

console.log("Gellert Note Compliance – Verification (Phase 0 scaffold)")
console.log("==========================================================")

run("Scaffold: shared constants and the pattern template", () => {
  assert(MED_NO_TOUCH_LANGUAGE.includes("never touched"), "Med no-touch language is verbatim")
  assert(TIME_FORMAT_REGEX.test("10:05AM") && !TIME_FORMAT_REGEX.test("10am"), "Time format regex enforces H:MMAM/PM")
  const medical = gellertNoteTemplates.find((t) => t.id === "template-gellert-medical")
  assert(!!medical, "Medical Appointment ± Transit template present")
  assert(medical!.fields.some((f) => f.neverSkip), "Template carries neverSkip fields")
  const ids = medical!.fields.map((f) => f.id)
  assert(new Set(ids).size === ids.length, "Template field ids are unique")
})

run("Scaffold: taxonomy resolves every encounter type", () => {
  const types = [
    "phone_call", "medical_appointment", "behavioral_health", "lab_imaging",
    "medication_assistance", "sdoh", "multidisciplinary", "supervision",
  ] as const
  for (const t of types) {
    assert(templateIdForEncounterType(t).startsWith("template-gellert-"), `${t} -> template id`)
  }
  const legacy = encounterTypeForAppointment({
    id: "x", patientId: "p", navigatorId: "n", date: "2026-01-01", time: "10:00",
    type: "clinic", status: "scheduled",
  })
  assert(legacy === "medical_appointment", "Legacy clinic appointment maps to medical_appointment")
})

run("Scaffold: compliance engine stub is callable", () => {
  const findings = checkNoteCompliance({
    narrative: "Navigator arrived at 10:05AM.",
    responses: {},
    durationMinutes: 30,
    isBillable: true,
  })
  assert(Array.isArray(findings), "checkNoteCompliance returns findings array")
  assert(!hasBlockingFindings(findings), "Stub engine has no blocking findings")
})

run("Scaffold: store v13 exposes note-system slices + Gellert templates", () => {
  const state = createInitialState()
  assert(Array.isArray(state.providers), "createInitialState has providers")
  assert(Array.isArray(state.standingFacts), "createInitialState has standingFacts")
  assert(
    state.noteTemplates.some((t) => t.id === "template-gellert-medical"),
    "Gellert templates spread into noteTemplates"
  )
  assert(state._version >= 13, `store version ${state._version} >= 13`)
})

console.log("\n==========================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
