/**
 * X12 Plumbing (shared)
 *
 * Low-level EDI X12 utilities shared by the 837P generator, the 835 parser,
 * and the 835 simulator: tokenizing raw interchanges into segments (reading
 * the separators from the ISA header itself), serializing segments back to
 * wire format, fixed-width envelope builders (ISA/GS/ST/SE/GE/IEA), and
 * X12 date helpers (CCYYMMDD <-> ISO, real month-end calculation).
 *
 * Pure functions only — no React, no storage, no ambient clock except where
 * an envelope generation timestamp is inherent (callers may inject one).
 */

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Structural X12 failure (missing/malformed ISA, missing transaction set, ...).
 * Tolerable irregularities are surfaced as warnings instead of thrown.
 */
export class X12ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "X12ParseError"
  }
}

// ============================================================================
// TYPES
// ============================================================================

/** Delimiters governing one interchange (declared in the ISA header) */
export interface X12Separators {
  element: string // ISA is "ISA" + element separator at index 3 (usually "*")
  component: string // ISA16 (usually ":")
  segment: string // char immediately after ISA16 (usually "~")
  repetition: string // ISA11 in 5010 (usually "^")
}

/** One parsed segment: `elements[0]` is the first data element (e.g. CLP01) */
export interface X12Segment {
  id: string
  elements: string[]
}

export interface ParsedX12 {
  segments: X12Segment[]
  separators: X12Separators
}

export const DEFAULT_SEPARATORS: X12Separators = {
  element: "*",
  component: ":",
  segment: "~",
  repetition: "^",
}

// ============================================================================
// PARSING / SERIALIZATION
// ============================================================================

/**
 * Locate the separators an ISA header declares for itself: the element
 * separator (index 3), the component separator (ISA16, the character
 * immediately after the 16th element separator), the segment terminator
 * (the character after that), and the ISA11 repetition separator (5010).
 *
 * @throws X12ParseError when the text is not a well-formed interchange
 */
function locateSeparators(raw: string): X12Separators {
  if (!raw.startsWith("ISA")) {
    throw new X12ParseError("Not an X12 interchange: missing ISA header")
  }
  if (raw.length < 106) {
    throw new X12ParseError("Malformed ISA segment: interchange too short")
  }

  const element = raw[3]

  // Walk to the 16th element separator; ISA16 (component separator) is the
  // single character after it, and the segment terminator follows ISA16.
  let sepCount = 0
  let lastSepIdx = -1
  for (let i = 3; i < raw.length; i++) {
    if (raw[i] === element) {
      sepCount++
      lastSepIdx = i
      if (sepCount === 16) break
    }
  }
  if (sepCount < 16 || lastSepIdx + 2 >= raw.length) {
    throw new X12ParseError("Malformed ISA segment: could not locate ISA16")
  }

  const component = raw[lastSepIdx + 1]
  const segment = raw[lastSepIdx + 2]

  // ISA11 (5010 repetition separator) is the 11th element
  const isaElements = raw.slice(4, lastSepIdx + 2).split(element)
  const repetition = isaElements[10] && isaElements[10].length === 1 ? isaElements[10] : "^"

  return { element, component, segment, repetition }
}

/**
 * Split a raw interchange into segments using the given separators.
 * Newlines (\n or \r\n) after segment terminators are tolerated and stripped;
 * empty chunks (trailing terminator, blank lines) are skipped.
 */
function tokenizeSegments(raw: string, seps: X12Separators): X12Segment[] {
  const segments: X12Segment[] = []
  for (const chunk of raw.split(seps.segment)) {
    const trimmed = chunk.replace(/^[\r\n\s]+/, "")
    if (!trimmed) continue
    const parts = trimmed.split(seps.element)
    const id = parts.shift() ?? ""
    if (!id) continue
    segments.push({ id, elements: parts })
  }
  return segments
}

/**
 * Tokenize a raw X12 interchange into segments.
 *
 * Separators are read from the ISA segment itself (see locateSeparators).
 *
 * @throws X12ParseError when the text is not a well-formed interchange
 */
export function parseX12(text: string): ParsedX12 {
  const raw = text.replace(/^\uFEFF/, "").replace(/^\s+/, "")
  const separators = locateSeparators(raw)
  const segments = tokenizeSegments(raw, separators)

  if (segments.length === 0 || segments[0].id !== "ISA") {
    throw new X12ParseError("Malformed interchange: ISA segment did not tokenize")
  }

  return { segments, separators }
}

/**
 * Serialize segments back to wire format. Each segment is followed by the
 * segment terminator and a newline for human readability (tolerated by
 * parseX12 and standard EDI tooling).
 */
export function serializeX12(segments: X12Segment[], seps: X12Separators = DEFAULT_SEPARATORS): string {
  return segments
    .map((s) => [s.id, ...s.elements].join(seps.element) + seps.segment)
    .join("\n") + "\n"
}

// ============================================================================
// ENVELOPE BUILDERS
// ============================================================================

/** Left-pad with zeros (control numbers) */
export function padControlNumber(n: number | string, width: number): string {
  return String(n).padStart(width, "0")
}

/** Right-pad with spaces to an exact fixed width (ISA fields), truncating overflow */
function fixedWidth(value: string, width: number): string {
  return value.slice(0, width).padEnd(width, " ")
}

export interface ISAOptions {
  senderId: string // ISA06 (space-padded to 15)
  receiverId: string // ISA08 (space-padded to 15)
  controlNumber: number // ISA13 (zero-padded to 9)
  usageIndicator?: "P" | "T" // ISA15, default "P"
  date?: Date // interchange generation timestamp (defaults to now)
  separators?: X12Separators
}

/**
 * Build the fixed-width ISA interchange header. Every field is padded to its
 * exact X12 width (ISA02/ISA04 10 chars, ISA06/ISA08 15 chars, etc.) so the
 * segment is always 106 characters including its terminator.
 */
export function buildISA(opts: ISAOptions): X12Segment {
  const seps = opts.separators ?? DEFAULT_SEPARATORS
  const d = opts.date ?? new Date()
  const yymmdd =
    String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  const hhmm = String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0")

  return {
    id: "ISA",
    elements: [
      "00", // ISA01 auth qualifier
      fixedWidth("", 10), // ISA02 auth info
      "00", // ISA03 security qualifier
      fixedWidth("", 10), // ISA04 security info
      "ZZ", // ISA05 sender qualifier
      fixedWidth(opts.senderId, 15), // ISA06 sender id
      "ZZ", // ISA07 receiver qualifier
      fixedWidth(opts.receiverId, 15), // ISA08 receiver id
      yymmdd, // ISA09 date
      hhmm, // ISA10 time
      seps.repetition, // ISA11 repetition separator (5010)
      "00501", // ISA12 version
      padControlNumber(opts.controlNumber, 9), // ISA13 control number
      "0", // ISA14 ack requested
      opts.usageIndicator ?? "P", // ISA15 usage
      seps.component, // ISA16 component separator
    ],
  }
}

export interface GSOptions {
  functionalCode: "HC" | "HP" // HC = 837 claims, HP = 835 payment advice
  senderCode: string
  receiverCode: string
  controlNumber: number
  versionCode: string // e.g. "005010X222A1" (837P) / "005010X221A1" (835)
  date?: Date
}

/** Build the GS functional group header */
export function buildGS(opts: GSOptions): X12Segment {
  const d = opts.date ?? new Date()
  const ccyymmdd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  const hhmm = String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0")

  return {
    id: "GS",
    elements: [
      opts.functionalCode,
      opts.senderCode,
      opts.receiverCode,
      ccyymmdd,
      hhmm,
      String(opts.controlNumber),
      "X",
      opts.versionCode,
    ],
  }
}

/** Build the ST transaction set header (control number zero-padded to 4) */
export function buildST(transactionType: "837" | "835", controlNumber: number, implementationRef?: string): X12Segment {
  const elements = [transactionType, padControlNumber(controlNumber, 4)]
  if (implementationRef) elements.push(implementationRef)
  return { id: "ST", elements }
}

/** Build the SE transaction set trailer (segmentCount includes ST and SE) */
export function buildSE(segmentCount: number, controlNumber: number): X12Segment {
  return { id: "SE", elements: [String(segmentCount), padControlNumber(controlNumber, 4)] }
}

/** Build the GE functional group trailer */
export function buildGE(transactionCount: number, controlNumber: number): X12Segment {
  return { id: "GE", elements: [String(transactionCount), String(controlNumber)] }
}

/** Build the IEA interchange trailer */
export function buildIEA(groupCount: number, controlNumber: number): X12Segment {
  return { id: "IEA", elements: [String(groupCount), padControlNumber(controlNumber, 9)] }
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * ISO date (or ISO timestamp) -> X12 CCYYMMDD.
 * "2026-01-31" / "2026-01-31T10:00:00Z" -> "20260131"
 */
export function toCCYYMMDD(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "")
}

/**
 * X12 CCYYMMDD -> ISO date. "20260131" -> "2026-01-31".
 * Returns the input unchanged when it is not an 8-digit date.
 */
export function fromCCYYMMDD(ccyymmdd: string): string {
  if (!/^\d{8}$/.test(ccyymmdd)) return ccyymmdd
  return `${ccyymmdd.slice(0, 4)}-${ccyymmdd.slice(4, 6)}-${ccyymmdd.slice(6, 8)}`
}

/**
 * Real last day of a billing month. "2026-02" -> "2026-02-28",
 * "2024-02" -> "2024-02-29" — never approximated.
 */
export function lastDayOfMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number)
  if (!year || !month || month < 1 || month > 12) {
    throw new X12ParseError(`Invalid billing month: ${yyyyMm}`)
  }
  // Day 0 of the NEXT month is the final day of this month
  const lastDay = new Date(year, month, 0).getDate()
  return `${yyyyMm}-${String(lastDay).padStart(2, "0")}`
}

/** First day of a billing month. "2026-02" -> "2026-02-01" */
export function firstDayOfMonth(yyyyMm: string): string {
  return `${yyyyMm}-01`
}

// ============================================================================
// MISC FORMATTING
// ============================================================================

/** Format a monetary amount for X12 (2 decimal places, no thousands separators) */
export function formatAmount(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** Round to cents (avoids float drift when summing line amounts) */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
