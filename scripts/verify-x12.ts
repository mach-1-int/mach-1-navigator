/**
 * Verify: X12 Plumbing
 *
 * Run with: npm run verify:x12
 *
 * Characterization test for `parseX12` (lib/edi/x12.ts), added when the
 * function was refactored (separator-location and segment-tokenizing split
 * into standalone helpers to bring cyclomatic complexity down, 16 -> 3).
 * Locks in the pre-refactor behavior: separator detection (including
 * non-default separators and the ISA11 repetition-separator fallback),
 * segment tokenization (including tolerated newlines/blank chunks), and the
 * structural failures it still throws on.
 */

import {
  parseX12,
  serializeX12,
  buildISA,
  buildGS,
  buildST,
  buildSE,
  buildGE,
  buildIEA,
  X12ParseError,
  DEFAULT_SEPARATORS,
} from "../lib/edi/x12"
import type { X12Segment } from "../lib/edi/x12"

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

/** Assemble a full ISA...IEA interchange around a body of segments. */
function interchange(body: X12Segment[], separators?: import("../lib/edi/x12").X12Separators): string {
  const isa = buildISA({ senderId: "PAYERTEST", receiverId: "MACH1NAV", controlNumber: 1, separators })
  const gs = buildGS({
    functionalCode: "HP",
    senderCode: "PAYERTEST",
    receiverCode: "MACH1NAV",
    controlNumber: 1,
    versionCode: "005010X221A1",
  })
  const st = buildST("835", 1)
  const se = buildSE(body.length + 2, 1)
  const ge = buildGE(1, 1)
  const iea = buildIEA(1, 1)
  return serializeX12([isa, gs, st, ...body, se, ge, iea], separators)
}

run("Well-formed interchange: default separators detected, segments tokenized", () => {
  const raw = interchange([{ id: "TRN", elements: ["1", "12345", "1999999999"] }])
  const { segments, separators } = parseX12(raw)

  assert(JSON.stringify(separators) === JSON.stringify(DEFAULT_SEPARATORS), "default separators detected")
  assert(segments[0].id === "ISA", "first segment is ISA")
  assert(segments[segments.length - 1].id === "IEA", "last segment is IEA")
  const trn = segments.find((s) => s.id === "TRN")
  assert(!!trn && JSON.stringify(trn.elements) === JSON.stringify(["1", "12345", "1999999999"]), "TRN elements preserved")
})

run("BOM and leading whitespace are stripped before parsing", () => {
  const raw = "﻿  \n" + interchange([{ id: "TRN", elements: ["1", "12345", "1999999999"] }])
  const { segments } = parseX12(raw)
  assert(segments[0].id === "ISA", "ISA still detected as first segment after stripping BOM/whitespace")
})

run("Non-default separators (element '|' component '^' segment '\\' repetition '#') round-trip", () => {
  const seps = { element: "|", component: "^", segment: "\\", repetition: "#" }
  const raw = interchange([{ id: "TRN", elements: ["1", "12345"] }], seps)
  const { segments, separators } = parseX12(raw)
  assert(JSON.stringify(separators) === JSON.stringify(seps), `custom separators detected (got ${JSON.stringify(separators)})`)
  const trn = segments.find((s) => s.id === "TRN")
  assert(!!trn && JSON.stringify(trn.elements) === JSON.stringify(["1", "12345"]), "TRN elements preserved with custom element separator")
})

run("ISA11 repetition separator falls back to '^' when not a single character", () => {
  // buildISA always writes a valid single-char ISA11; simulate a 5010-noncompliant
  // interchange by overwriting ISA's raw text with an empty ISA11 field.
  const isa = buildISA({ senderId: "PAYERTEST", receiverId: "MACH1NAV", controlNumber: 1 })
  isa.elements[10] = "" // ISA11
  const raw = serializeX12([isa])
  const { separators } = parseX12(raw)
  assert(separators.repetition === "^", `repetition falls back to '^' (got "${separators.repetition}")`)
})

run("Newlines after segment terminators and blank chunks are tolerated", () => {
  const raw = interchange([{ id: "TRN", elements: ["1", "12345"] }]) + "\n\n"
  const { segments } = parseX12(raw)
  assert(segments.every((s) => s.id.length > 0), "no empty/blank segments produced")
})

run("Missing ISA header throws", () => {
  let isX12ParseError = false
  let message = ""
  try {
    parseX12("GS*HP*PAYERTEST*MACH1NAV*20260101*1200*1*X*005010X221A1~")
  } catch (e) {
    isX12ParseError = e instanceof X12ParseError
    message = e instanceof Error ? e.message : String(e)
  }
  assert(isX12ParseError, "throws X12ParseError")
  assert(message === "Not an X12 interchange: missing ISA header", `exact error message (got "${message}")`)
})

run("Interchange shorter than 106 chars throws", () => {
  let threw = false
  let message = ""
  try {
    parseX12("ISA*00*          *00*          *ZZ*PAYERTEST      ~")
  } catch (e) {
    threw = true
    message = e instanceof Error ? e.message : String(e)
  }
  assert(threw, "throws on short interchange")
  assert(message === "Malformed ISA segment: interchange too short", `exact error message (got "${message}")`)
})

run("ISA with fewer than 16 element separators throws 'could not locate ISA16'", () => {
  // 106+ chars but only a handful of '*' separators, so the 16th is never found.
  const raw = "ISA" + "*".repeat(3) + "X".repeat(120)
  let threw = false
  let message = ""
  try {
    parseX12(raw)
  } catch (e) {
    threw = true
    message = e instanceof Error ? e.message : String(e)
  }
  assert(threw, "throws when ISA16 cannot be located")
  assert(message === "Malformed ISA segment: could not locate ISA16", `exact error message (got "${message}")`)
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
