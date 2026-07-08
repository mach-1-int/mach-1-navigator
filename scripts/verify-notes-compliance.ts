/**
 * Verification: Gellert Note System + AI Scribe compliance
 * Run: npm run verify:notes
 *
 * Blocks:
 * 1. Rule engine — each rule's canonical violation trips; known-good passes all
 * 2. Template integrity — all 8 Gellert templates, ids, neverSkip, showIf, taxonomy
 * 3. Self-consistency (money assertion) — every seeded Gellert note passes its own engine
 * 4. Auto-fill — provider/standing-fact resolution + repeat-visit recall
 * 5. Same-day model — primary detection, chain integrity, continuation invariants
 * 6. Seeds referential integrity — every reference resolves; supervision authorship
 *
 * Blocks 3/4/6 depend on N-B's seeds/autofill lib — they skip with a clear
 * "pending N-B" message when those haven't landed, so the suite passes standalone.
 */

import {
  gellertNoteTemplates,
  isGellertTemplate,
  INVOLVEMENT_FIELD_BY_TEMPLATE,
  MED_NO_TOUCH_LANGUAGE,
  TIME_FORMAT_REGEX,
  WITH_PATIENT_UNTIL_PHRASE,
} from "../lib/gellert-templates"
import { checkNoteCompliance, hasBlockingFindings, COMPLIANCE_RULES } from "../lib/note-compliance"
import { templateIdForEncounterType, encounterTypeForAppointment } from "../lib/note-taxonomy"
import { generateNarrative } from "../lib/narrative-generator"
import { buildAutoFillContext, resolveTemplateAutoFill, findPreviousNoteForProvider } from "../lib/note-autofill"
import { findSameDayPrimaryNote, getLinkedNoteChain, dayTotalMinutes } from "../lib/same-day-notes"
import { createInitialState } from "../lib/store"
import type { Appointment, EncounterType, NoteTemplate, PatientNote, Provider } from "../lib/types"

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  ✓ ${message}`)
}

const skip = (message: string) => {
  console.log(`  ○ SKIPPED: ${message}`)
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

const state = createInitialState()

const templateById = new Map<string, NoteTemplate>(state.noteTemplates.map((t) => [t.id, t]))
const medicalTemplate = gellertNoteTemplates.find((t) => t.id === "template-gellert-medical")!
const bhTemplate = gellertNoteTemplates.find((t) => t.id === "template-gellert-bh")!
const medAssistTemplate = gellertNoteTemplates.find((t) => t.id === "template-gellert-med-assist")!

const fixtureProvider: Provider = {
  id: "prov-fixture-1",
  name: "Dr. Jane Smith",
  credential: "MD",
  specialty: "Family Medicine",
  practiceName: "Desert Family Medicine",
  address: { street: "4045 W Main St", city: "Phoenix", state: "AZ", zip: "85004" },
  phone: "602-555-0141",
  type: "pcp",
}

const goodMedicalResponses: Record<string, unknown> = {
  "transport-provided": true,
  "pickup-time": "9:40AM",
  "pickup-location": "the patient's home",
  "arrival-time": "10:05AM",
  "office-provider": fixtureProvider.id,
  "provider-guidance": "increase walking to 30 minutes daily and continue metformin as prescribed.",
  "patient-response": 'stated "I can do that," and agreed to the plan.',
  "follow-up-date": "March 4",
  "follow-up-time": "2:30PM",
  "with-patient-until": "11:15AM",
  duration: 50,
}

const check = (
  narrative: string,
  overrides: Partial<Parameters<typeof checkNoteCompliance>[0]> = {}
) =>
  checkNoteCompliance({
    narrative,
    template: medicalTemplate,
    responses: goodMedicalResponses,
    durationMinutes: 50,
    isBillable: true,
    ...overrides,
  })

const findingFor = (findings: ReturnType<typeof checkNoteCompliance>, ruleId: string) =>
  findings.find((f) => f.ruleId === ruleId)

console.log("Gellert Note Compliance – Verification")
console.log("==========================================================")

// ============================================================================
// BLOCK 1 — Rule engine
// ============================================================================

run("Block 1: known-good narrative passes every rule", () => {
  assert(COMPLIANCE_RULES.length === 9, `9 compliance rules registered (found ${COMPLIANCE_RULES.length})`)
  const narrative = generateNarrative(medicalTemplate, goodMedicalResponses, {
    providers: [fixtureProvider],
  })
  assert(narrative.includes("Dr. Jane Smith, MD at Desert Family Medicine"), "Provider field renders full display string")
  assert(narrative.includes(`${WITH_PATIENT_UNTIL_PHRASE} 11:15AM.`), "Closing presence phrase generated")
  assert(narrative.includes("Total = 50 minutes."), "Closing total generated")
  const findings = check(narrative)
  const notPassing = findings.filter((f) => f.level !== "pass")
  assert(
    notPassing.length === 0,
    `Known-good narrative passes all rules (violations: ${notPassing.map((f) => f.ruleId).join(", ") || "none"})`
  )
})

run("Block 1: each rule's canonical violation trips", () => {
  // 1. patient-involvement (fail, blocking)
  const noInvolvement = check("Navigator and patient arrived at the office at 10:05AM. Total = 50 minutes.", {
    responses: { ...goodMedicalResponses, "patient-response": "" },
  })
  assert(findingFor(noInvolvement, "patient-involvement")?.level === "fail", "patient-involvement: empty field fails")
  assert(hasBlockingFindings(noInvolvement), "patient-involvement failure is blocking")

  // 2. third-person (warn) — but quoted first person is allowed
  const firstPerson = check('I drove the patient to the clinic. Patient agreed. Total = 50 minutes.')
  assert(findingFor(firstPerson, "third-person")?.level === "warn", "third-person: 'I drove' warns")
  const quotedFirstPerson = check(
    `Patient stated "I feel much better." Navigator was with the patient until 11:15AM. Total = 50 minutes.`
  )
  assert(findingFor(quotedFirstPerson, "third-person")?.level === "pass", "third-person: quoted 'I' is exempt")

  // 3. time-format (warn): 3pm, 15:00, 3:03 pm all flagged
  for (const bad of ["Navigator arrived at 3pm.", "Navigator arrived at 15:00.", "Navigator arrived at 3:03 pm."]) {
    const f = findingFor(check(`${bad} Patient agreed. Total = 50 minutes.`), "time-format")
    assert(f?.level === "warn", `time-format: "${bad}" warns`)
  }
  assert(TIME_FORMAT_REGEX.test("10:05AM") && !TIME_FORMAT_REGEX.test("10am"), "TIME_FORMAT_REGEX enforces H:MMAM/PM")

  // 4. total-minutes-close (fail on billable): missing or drifted total
  const noTotal = check("Navigator and patient arrived at 10:05AM. Patient agreed to the plan.")
  assert(findingFor(noTotal, "total-minutes-close")?.level === "fail", "total-minutes-close: missing total fails")
  const drifted = check("Patient agreed to the plan. Total = 45 minutes.", { durationMinutes: 50 })
  assert(findingFor(drifted, "total-minutes-close")?.level === "fail", "total-minutes-close: narrative/timer drift fails")

  // 5. med-no-touch (fail, med-assistance only)
  const noAttestation = check("Patient filled the pillbox. Patient agreed. Total = 30 minutes.", {
    template: medAssistTemplate,
    durationMinutes: 30,
  })
  assert(findingFor(noAttestation, "med-no-touch")?.level === "fail", "med-no-touch: missing verbatim language fails")
  const withAttestation = check(
    `Patient filled the pillbox. ${MED_NO_TOUCH_LANGUAGE} Patient agreed. ${WITH_PATIENT_UNTIL_PHRASE} 9:45AM. Total = 30 minutes.`,
    { template: medAssistTemplate, durationMinutes: 30 }
  )
  assert(findingFor(withAttestation, "med-no-touch")?.level === "pass", "med-no-touch: verbatim language passes")

  // 6. bh-safety-screen (fail, BH only)
  const noScreen = check("Patient was seen. Patient agreed. Total = 50 minutes.", {
    template: bhTemplate,
    responses: { ...goodMedicalResponses, "safety-screen": [] },
  })
  assert(findingFor(noScreen, "bh-safety-screen")?.level === "fail", "bh-safety-screen: unanswered screen fails")

  // 7. with-patient-until (warn, in-person templates)
  const noPresence = check("Navigator and patient arrived at 10:05AM. Patient agreed. Total = 50 minutes.")
  assert(findingFor(noPresence, "with-patient-until")?.level === "warn", "with-patient-until: missing phrase warns")

  // 8. aggression-documented (warn without direct quotes)
  const aggression = check("Patient yelled and threw a cup at the wall. Patient agreed. Total = 50 minutes.")
  assert(findingFor(aggression, "aggression-documented")?.level === "warn", "aggression: incident without quotes warns")
  const quotedAggression = check(
    `Patient yelled "get out of my house" and threw a cup. Patient agreed. ${WITH_PATIENT_UNTIL_PHRASE} 11:15AM. Total = 50 minutes.`
  )
  assert(findingFor(quotedAggression, "aggression-documented")?.level === "pass", "aggression: quoted incident passes")

  // 9. transport-duplication (warn only when a same-day primary exists)
  const dupTransport = check("Navigator drove the patient to the clinic. Patient agreed. Total = 50 minutes.", {
    sameDayPrimaryExists: true,
  })
  assert(findingFor(dupTransport, "transport-duplication")?.level === "warn", "transport-duplication: transport in continuation warns")
  const firstNoteTransport = check("Navigator drove the patient to the clinic. Patient agreed. Total = 50 minutes.", {
    sameDayPrimaryExists: false,
  })
  assert(findingFor(firstNoteTransport, "transport-duplication")?.level === "pass", "transport-duplication: first note of the day passes")
})

// ============================================================================
// BLOCK 2 — Template integrity
// ============================================================================

run("Block 2: template integrity", () => {
  assert(gellertNoteTemplates.length === 8, `All 8 Gellert templates present (found ${gellertNoteTemplates.length})`)
  const templateIds = gellertNoteTemplates.map((t) => t.id)
  assert(new Set(templateIds).size === 8, "Template ids are unique")

  for (const template of gellertNoteTemplates) {
    const fieldIds = template.fields.map((f) => f.id)
    assert(new Set(fieldIds).size === fieldIds.length, `${template.name}: field ids are unique`)
    for (const field of template.fields) {
      if (field.neverSkip) {
        if (!field.required) throw new Error(`FAIL: ${template.name}: neverSkip field "${field.id}" must be required`)
      }
      if (field.showIf && !fieldIds.includes(field.showIf.fieldId)) {
        throw new Error(`FAIL: ${template.name}: showIf target "${field.showIf.fieldId}" missing`)
      }
      if (field.type === "attestation" && !field.attestationText) {
        throw new Error(`FAIL: ${template.name}: attestation field "${field.id}" lacks attestationText`)
      }
    }
    console.log(`  ✓ ${template.name}: neverSkip/showIf/attestation integrity`)
  }

  const encounterTypes: EncounterType[] = [
    "phone_call", "medical_appointment", "behavioral_health", "lab_imaging",
    "medication_assistance", "sdoh", "multidisciplinary", "supervision",
  ]
  for (const et of encounterTypes) {
    const id = templateIdForEncounterType(et)
    assert(templateIds.includes(id), `Encounter type "${et}" resolves to a real template (${id})`)
  }

  const legacyTypes: Appointment["type"][] = ["home_visit", "phone_call", "video_call", "clinic"]
  for (const legacy of legacyTypes) {
    const et = encounterTypeForAppointment({
      id: "x", patientId: "p", navigatorId: "n", date: "2026-01-01", time: "10:00",
      type: legacy, status: "scheduled",
    })
    assert(encounterTypes.includes(et), `Legacy appointment type "${legacy}" maps to "${et}"`)
  }

  const nonBillable = gellertNoteTemplates.filter((t) => t.billable === false).map((t) => t.id).sort()
  assert(
    nonBillable.join(",") === "template-gellert-multidisciplinary,template-gellert-supervision",
    "Exactly supervision + multidisciplinary continuation are non-billable"
  )

  for (const template of gellertNoteTemplates) {
    if (template.billable === false) continue
    const durationField = template.fields.find((f) => f.type === "time-duration")
    assert(
      !!durationField && durationField.narrativePrefix === " Total = ",
      `${template.name}: billable template closes with " Total = X minutes."`
    )
    const involvementId = INVOLVEMENT_FIELD_BY_TEMPLATE[template.id]
    assert(
      !!involvementId && template.fields.some((f) => f.id === involvementId),
      `${template.name}: designated patient-involvement field exists (${involvementId})`
    )
  }

  assert(
    state.noteTemplates.filter((t) => isGellertTemplate(t)).length === 8,
    "All 8 Gellert templates spread into store noteTemplates"
  )
  assert(state._version >= 13, `store version ${state._version} >= 13`)
})

// ============================================================================
// BLOCK 3 — Self-consistency (the money assertion)
// ============================================================================

run("Block 3: every seeded Gellert note passes its own compliance engine", () => {
  const gellertSeedNotes = state.notes.filter(
    (n) => n.templateId?.startsWith("template-gellert-") && n.responses
  )
  if (gellertSeedNotes.length === 0) {
    skip("no Gellert seed notes yet — pending N-B seeds (Phase 2 unskips)")
    return
  }
  for (const note of gellertSeedNotes) {
    const template = templateById.get(note.templateId!)
    if (!template) throw new Error(`FAIL: seed note ${note.id} references missing template ${note.templateId}`)
    const narrative = generateNarrative(template, note.responses!, { providers: state.providers })
    const findings = checkNoteCompliance({
      narrative,
      template,
      responses: note.responses!,
      durationMinutes: note.duration ?? 0,
      isBillable: note.billable !== false,
      sameDayPrimaryExists: !!note.linkedNoteId,
    })
    const fails = findings.filter((f) => f.level === "fail")
    if (fails.length > 0) {
      throw new Error(
        `FAIL: seed note ${note.id} (${template.name}) fails: ${fails.map((f) => `${f.ruleId}: ${f.message}`).join(" | ")}`
      )
    }
  }
  assert(true, `${gellertSeedNotes.length} seeded Gellert notes regenerate + pass with zero fails`)
})

// ============================================================================
// BLOCK 4 — Auto-fill
// ============================================================================

run("Block 4: auto-fill resolves from chart + previous-note recall", () => {
  if (state.providers.length === 0) {
    skip("no seeded providers yet — pending N-B seeds (Phase 2 unskips)")
    return
  }
  const patient = state.patients.find((p) => (p.providerIds?.length ?? 0) > 0)
  if (!patient) {
    skip("no patient linked to providers yet — pending N-B seeds (Phase 2 unskips)")
    return
  }
  const ctx = buildAutoFillContext({
    patient,
    providers: state.providers,
    standingFacts: state.standingFacts.find((f) => f.patientId === patient.id),
    previousNotes: state.notes.filter((n) => n.patientId === patient.id),
  })
  const resolved = resolveTemplateAutoFill(medicalTemplate, ctx)
  if (Object.keys(resolved).length === 0) {
    skip("resolveTemplateAutoFill resolves nothing yet — pending N-B autofill lib (Phase 2 unskips)")
    return
  }
  assert(
    resolved["office-provider"] !== undefined &&
      state.providers.some((p) => p.id === resolved["office-provider"].value),
    "office-provider auto-fills to a real provider id"
  )
  for (const [fieldId, resolution] of Object.entries(resolved)) {
    if (!["provider-directory", "standing-facts", "previous-note", "appointment"].includes(resolution.source)) {
      throw new Error(`FAIL: auto-fill for "${fieldId}" carries unknown source "${resolution.source}"`)
    }
  }
  assert(true, "Every auto-fill resolution carries a valid provenance source")

  const providerId = String(resolved["office-provider"].value)
  const recalled = findPreviousNoteForProvider(state.notes, patient.id, providerId)
  if (recalled) {
    assert(recalled.patientId === patient.id, "Previous-note recall returns the same patient's note")
  } else {
    skip("no seeded prior note for this provider — pending N-B seeds (Phase 2 unskips)")
  }
})

// ============================================================================
// BLOCK 5 — Same-day multi-note model
// ============================================================================

run("Block 5: same-day primary/continuation model", () => {
  const base = {
    patientId: "pt-fixture",
    authorId: "nav-1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator" as const,
    type: "visit" as const,
  }
  const primary: PatientNote = {
    ...base,
    id: "note-primary",
    content: "Primary note with transit.",
    createdAt: "2026-03-04T09:15:00.000Z",
    duration: 50,
    timeLogId: "tl-1",
    carriesDayTotal: true,
  }
  const continuation: PatientNote = {
    ...base,
    id: "note-continuation",
    content: "Afternoon appointment content only.",
    createdAt: "2026-03-04T14:30:00.000Z",
    linkedNoteId: "note-primary",
    billable: false,
  }
  const quickNote: PatientNote = {
    ...base,
    id: "note-quick",
    content: "Untimed quick note.",
    createdAt: "2026-03-04T08:00:00.000Z",
    type: "general",
  }
  const otherDay: PatientNote = {
    ...base,
    id: "note-other-day",
    content: "Different day.",
    createdAt: "2026-03-05T10:00:00.000Z",
    duration: 30,
    timeLogId: "tl-2",
  }
  const fixture = [continuation, quickNote, primary, otherDay]

  assert(
    findSameDayPrimaryNote(fixture, "pt-fixture", "2026-03-04")?.id === "note-primary",
    "Primary detection: carriesDayTotal note wins"
  )
  assert(
    findSameDayPrimaryNote([continuation, quickNote], "pt-fixture", "2026-03-04") === undefined,
    "Untimed quick notes and continuations never anchor a patient-day"
  )
  const chain = getLinkedNoteChain(fixture, "note-continuation")
  assert(
    chain.length === 2 && chain[0].id === "note-primary" && chain[1].id === "note-continuation",
    "Chain resolves from a continuation up to its primary, in order"
  )
  assert(dayTotalMinutes(fixture, "pt-fixture", "2026-03-04") === 50, "Day total counts billable minutes only (50)")

  // Seed invariants (defensive until N-B lands the linked pair)
  const seedContinuations = state.notes.filter((n) => n.linkedNoteId)
  if (seedContinuations.length === 0) {
    skip("no seeded continuation notes yet — pending N-B seeds (Phase 2 unskips)")
  } else {
    for (const note of seedContinuations) {
      if (note.billable !== false) throw new Error(`FAIL: continuation ${note.id} must be billable: false`)
      if (note.timeLogId) throw new Error(`FAIL: continuation ${note.id} must not carry a timeLogId`)
      if (!state.notes.some((n) => n.id === note.linkedNoteId)) {
        throw new Error(`FAIL: continuation ${note.id} links to missing note ${note.linkedNoteId}`)
      }
    }
    assert(true, `${seedContinuations.length} seeded continuations: non-billable, no timeLogId, valid links`)

    const dayTotalsSeen = new Map<string, number>()
    for (const note of state.notes.filter((n) => n.carriesDayTotal)) {
      const key = `${note.patientId}|${note.createdAt.slice(0, 10)}`
      dayTotalsSeen.set(key, (dayTotalsSeen.get(key) ?? 0) + 1)
    }
    const dupes = [...dayTotalsSeen.entries()].filter(([, count]) => count > 1)
    assert(dupes.length === 0, "Exactly one carriesDayTotal note per patient-day in seeds")
  }
})

// ============================================================================
// BLOCK 6 — Seeds referential integrity
// ============================================================================

run("Block 6: seed referential integrity", () => {
  const gellertSeedNotes = state.notes.filter((n) => n.templateId?.startsWith("template-gellert-"))
  if (gellertSeedNotes.length === 0) {
    skip("no Gellert seed notes yet — pending N-B seeds (Phase 2 unskips)")
    return
  }

  const patientIds = new Set(state.patients.map((p) => p.id))
  const authorIds = new Set([
    ...state.users.map((u) => u.id),
    ...state.navigators.map((n) => n.id),
    ...state.supervisors.map((s) => s.id),
  ])
  const providerIds = new Set(state.providers.map((p) => p.id))
  const navigatorIds = new Set(state.navigators.map((n) => n.id))

  for (const note of gellertSeedNotes) {
    if (!patientIds.has(note.patientId)) throw new Error(`FAIL: note ${note.id}: unknown patientId ${note.patientId}`)
    if (!authorIds.has(note.authorId)) throw new Error(`FAIL: note ${note.id}: unknown authorId ${note.authorId}`)
    if (!templateById.has(note.templateId!)) throw new Error(`FAIL: note ${note.id}: unknown templateId ${note.templateId}`)
    const template = templateById.get(note.templateId!)!
    for (const field of template.fields) {
      if (field.type !== "provider") continue
      const value = note.responses?.[field.id]
      if (typeof value === "string" && value !== "" && !providerIds.has(value)) {
        throw new Error(`FAIL: note ${note.id}: provider field "${field.id}" references unknown provider ${value}`)
      }
    }
    if (note.subjectNavigatorId && !navigatorIds.has(note.subjectNavigatorId)) {
      throw new Error(`FAIL: note ${note.id}: unknown subjectNavigatorId ${note.subjectNavigatorId}`)
    }
  }
  assert(true, `${gellertSeedNotes.length} Gellert seed notes: patient/author/template/provider refs resolve`)

  const supervisionSeeds = gellertSeedNotes.filter((n) => n.type === "supervision")
  if (supervisionSeeds.length === 0) {
    skip("no seeded supervision notes yet — pending N-B seeds (Phase 2 unskips)")
  } else {
    for (const note of supervisionSeeds) {
      const author = state.users.find((u) => u.id === note.authorId)
      const isSupervisorAuthor = note.authorRole === "supervisor" || author?.role === "supervisor"
      if (!isSupervisorAuthor) {
        throw new Error(`FAIL: supervision note ${note.id} not authored by a supervisor (${note.authorRole})`)
      }
      if (note.billable !== false) throw new Error(`FAIL: supervision note ${note.id} must be billable: false`)
      if (note.timeLogId) throw new Error(`FAIL: supervision note ${note.id} must not carry a timeLogId`)
    }
    assert(true, `${supervisionSeeds.length} supervision seeds: supervisor-authored, non-billable, no time log`)
  }
})

console.log("\n==========================================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
