/**
 * Verify: EDI 835 Parser
 *
 * Run with: npm run verify:edi-835-parser
 *
 * Characterization test for `parse835` (lib/edi/edi-835-parser.ts), added
 * when the function was refactored (its per-segment switch cases split into
 * standalone handlers to bring cyclomatic complexity down). Locks in the
 * pre-refactor behavior across every segment type it understands (BPR, TRN,
 * N1, CLP, CAS, NM1, SVC, LQ), its tolerated-irregularity warnings, and the
 * two structural failures it still throws on.
 */

import { parse835, X12ParseError } from "../lib/edi/edi-835-parser"
import { buildISA, buildGS, buildST, buildSE, buildGE, buildIEA, serializeX12 } from "../lib/edi/x12"
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

/** Assemble a full ISA...IEA interchange around a body of 835 segments. */
function interchange(body: X12Segment[], st: X12Segment = buildST("835", 1)): string {
  const isa = buildISA({ senderId: "PAYERTEST", receiverId: "MACH1NAV", controlNumber: 1 })
  const gs = buildGS({
    functionalCode: "HP",
    senderCode: "PAYERTEST",
    receiverCode: "MACH1NAV",
    controlNumber: 1,
    versionCode: "005010X221A1",
  })
  const se = buildSE(body.length + 2, 1)
  const ge = buildGE(1, 1)
  const iea = buildIEA(1, 1)
  return serializeX12([isa, gs, st, ...body, se, ge, iea])
}

function seg(id: string, elements: string[]): X12Segment {
  return { id, elements }
}

const fullClaimBody: X12Segment[] = [
  seg("BPR", ["I", "1250.00", "C", "CHK", "", "", "", "", "", "", "", "", "", "", "", "20260315"]),
  seg("TRN", ["1", "TRACE123", "1512345678"]),
  seg("N1", ["PR", "Mercy Care"]),
  seg("N1", ["PE", "Mach1 Integration LLC"]),
  seg("CLP", ["claim-001", "1", "150.00", "150.00", "0.00", "", "PAYERICN1"]),
  seg("CAS", ["CO", "45", "10.00", "1"]),
  seg("NM1", ["QC", "1", "Garcia", "Maria"]),
  seg("SVC", ["HC:G0023", "150.00", "150.00", "", "1"]),
  seg("LQ", ["HE", "N30"]),
]

// =============================================================================
run("Structural failures", () => {
  assert(
    (() => {
      try {
        parse835(interchange([], seg("ST", ["837", "0001"])))
        return false
      } catch (e) {
        return e instanceof X12ParseError && e.message === "Not an 835 remittance: missing ST*835 transaction set"
      }
    })(),
    "Wrong transaction type throws X12ParseError"
  )
  assert(
    (() => {
      try {
        parse835("not an interchange at all")
        return false
      } catch (e) {
        return e instanceof X12ParseError
      }
    })(),
    "Non-X12 text throws X12ParseError (from parseX12)"
  )
})

run("Fully populated claim loop", () => {
  const remit = parse835(interchange(fullClaimBody))
  assert(remit.warnings.length === 0, `No warnings (got: ${JSON.stringify(remit.warnings)})`)
  assert(remit.paymentAmount === 1250, `paymentAmount (got ${remit.paymentAmount})`)
  assert(remit.paymentMethod === "CHK", `paymentMethod (got "${remit.paymentMethod}")`)
  assert(remit.paymentDate === "2026-03-15", `paymentDate (got "${remit.paymentDate}")`)
  assert(remit.traceNumber === "TRACE123", `traceNumber (got "${remit.traceNumber}")`)
  assert(remit.payerName === "Mercy Care", `payerName (got "${remit.payerName}")`)
  assert(remit.payeeName === "Mach1 Integration LLC", `payeeName (got "${remit.payeeName}")`)
  assert(remit.claims.length === 1, "One claim parsed")
  const claim = remit.claims[0]
  assert(claim.patientControlNumber === "claim-001", "patientControlNumber")
  assert(claim.statusCode === "1", "statusCode")
  assert(claim.chargedAmount === 150 && claim.paidAmount === 150, "charged/paid amounts")
  assert(claim.patientResponsibility === 0, "patientResponsibility")
  assert(claim.payerClaimControlNumber === "PAYERICN1", "payerClaimControlNumber")
  assert(claim.patientName === "Garcia, Maria", `patientName (got "${claim.patientName}")`)
  assert(claim.adjustments.length === 1 && claim.adjustments[0].reasonCode === "45", "One CAS adjustment (CARC 45)")
  assert(claim.adjustments[0].amount === 10, "Adjustment amount")
  assert(claim.serviceLines.length === 1, "One service line")
  assert(claim.serviceLines[0].procedureCode === "G0023", `Composite qualifier stripped (got "${claim.serviceLines[0].procedureCode}")`)
  assert(claim.serviceLines[0].units === 1, "Service line units parsed")
  assert(claim.rarcCodes.join(",") === "N30", "One RARC code")
})

run("BPR16 malformed date warns and omits paymentDate", () => {
  const body = [seg("BPR", ["I", "100.00", "C", "CHK", "", "", "", "", "", "", "", "", "", "", "", "not-a-date"])]
  const remit = parse835(interchange(body))
  assert(
    remit.warnings.includes('BPR16 "not-a-date" is not CCYYMMDD; payment date omitted'),
    "Warns on malformed BPR16"
  )
  assert(remit.paymentDate === undefined, "paymentDate left undefined")
})

run("Non-numeric monetary amount warns and treats as 0", () => {
  const body = [seg("CLP", ["claim-002", "1", "garbage", "0.00", "0.00"])]
  const remit = parse835(interchange(body))
  assert(
    remit.warnings.some((w) => w.startsWith('Non-numeric amount "garbage"')),
    "Warns on non-numeric CLP03"
  )
  assert(remit.claims[0].chargedAmount === 0, "Non-numeric amount treated as 0")
})

run("CLP missing CLP01 is skipped; trailing segments become orphans", () => {
  const body = [seg("CLP", ["", "1", "100.00", "100.00", "0.00"]), seg("CAS", ["CO", "45", "10.00"])]
  const remit = parse835(interchange(body))
  assert(
    remit.warnings.includes("CLP segment missing CLP01 patient control number; skipped"),
    "Warns on missing CLP01"
  )
  assert(remit.claims.length === 0, "No claim added for the skipped CLP")
  assert(remit.warnings.includes("CAS segment outside a claim loop; ignored"), "Trailing CAS is orphaned")
})

run("CLP missing CLP02 status code still adds the claim", () => {
  const body = [seg("CLP", ["claim-003", "", "100.00", "100.00", "0.00"])]
  const remit = parse835(interchange(body))
  assert(
    remit.warnings.includes("CLP for claim-003 missing CLP02 status code"),
    "Warns on missing CLP02"
  )
  assert(remit.claims.length === 1 && remit.claims[0].statusCode === "", "Claim still added with empty statusCode")
})

run("CAS carries multiple reason/amount triples in one segment", () => {
  const body = [
    seg("CLP", ["claim-004", "1", "200.00", "170.00", "0.00"]),
    seg("CAS", ["CO", "45", "20.00", "1", "97", "10.00", "1"]),
  ]
  const remit = parse835(interchange(body))
  const adj = remit.claims[0].adjustments
  assert(adj.length === 2, `Two adjustments from one CAS segment (got ${adj.length})`)
  assert(adj[0].reasonCode === "45" && adj[0].amount === 20, "First triple")
  assert(adj[1].reasonCode === "97" && adj[1].amount === 10, "Second triple")
})

run("SVC without a qualifier prefix uses the raw composite", () => {
  const body = [
    seg("CLP", ["claim-005", "1", "50.00", "50.00", "0.00"]),
    seg("SVC", ["G0023", "50.00", "50.00", "", "not-a-number"]),
  ]
  const remit = parse835(interchange(body))
  const line = remit.claims[0].serviceLines[0]
  assert(line.procedureCode === "G0023", `Unqualified composite used as-is (got "${line.procedureCode}")`)
  assert(line.units === undefined, "Non-numeric units left undefined")
})

run("SVC/LQ/NM1 outside a claim loop", () => {
  const remitSvc = parse835(interchange([seg("SVC", ["G0023", "50.00", "50.00"])]))
  assert(remitSvc.warnings.includes("SVC segment outside a claim loop; ignored"), "Orphan SVC warns")

  const remitLq = parse835(interchange([seg("LQ", ["HE", "N30"])]))
  assert(remitLq.warnings.includes("LQ segment outside a claim loop; ignored"), "Orphan LQ warns")

  const remitNm1 = parse835(interchange([seg("NM1", ["QC", "1", "Garcia", "Maria"])]))
  assert(remitNm1.claims.length === 0, "Orphan NM1 has no claim loop to attach to")
  assert(!remitNm1.warnings.some((w) => w.includes("NM1")), "NM1 outside a loop does not warn (matches original: silently ignored)")
})

run("NM1 with a non-QC qualifier is ignored", () => {
  const body = [
    seg("CLP", ["claim-006", "1", "50.00", "50.00", "0.00"]),
    seg("NM1", ["82", "1", "ProviderName", ""]),
  ]
  const remit = parse835(interchange(body))
  assert(remit.claims[0].patientName === undefined, "patientName stays undefined for non-QC NM1")
})

run("LQ with a non-HE qualifier is ignored; duplicate RARC codes are deduped", () => {
  const body = [
    seg("CLP", ["claim-007", "1", "50.00", "50.00", "0.00"]),
    seg("LQ", ["XX", "N30"]),
    seg("LQ", ["HE", "N30"]),
    seg("LQ", ["HE", "N30"]),
  ]
  const remit = parse835(interchange(body))
  assert(remit.claims[0].rarcCodes.join(",") === "N30", `Non-HE ignored, duplicate deduped (got ${JSON.stringify(remit.claims[0].rarcCodes)})`)
})

run("No CLP loops at all", () => {
  const remit = parse835(interchange([seg("TRN", ["1", "TRACE999", "1512345678"])]))
  assert(remit.claims.length === 0, "No claims")
  assert(remit.warnings.includes("835 contained no CLP claim payment loops"), "Warns when there are zero claim loops")
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
