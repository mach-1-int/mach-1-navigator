/**
 * Claim Lifecycle + EDI pipeline
 *
 * Proves:
 * 1. The transition matrix permits exactly the legal lifecycle paths
 * 2. Export creates immutable, versioned ClaimRecord snapshots
 * 3. The 837P generator emits real month-end dates, the org NPI, and no
 *    hardcoded provider strings
 * 4. A simulated 835 round-trips through the parser and the matcher resolves
 *    100% of payments by CLP01
 * 5. The billing progress engine is payer-aware (Rule of Eights vs base+add-on)
 */

import { describe, it, expect } from "vitest"
import { getPayerConfig } from "../lib/payer-config"
import {
  CLAIM_TRANSITIONS,
  canTransition,
  createClaimRecords,
  transitionClaimRecord,
  getActiveClaimRecordKeys,
} from "../lib/claim-lifecycle"
import { generate837P } from "../lib/edi/edi-837p-generator"
import { parse835 } from "../lib/edi/edi-835-parser"
import { generateSample835 } from "../lib/edi/edi-835-simulator"
import { matchRemittance } from "../lib/edi/remittance-matcher"
import { generateMonthlyClaims, filterClaimsByMonth } from "../lib/claims-engine"
import { calculateMonthlyBillingProgress } from "../lib/billing-engine"
import {
  initialNavigators,
  initialPatients,
  initialTimeLogs,
  initialIntakeRecords,
  initialPayers,
  initialOrganizationSettings,
} from "../lib/initial-data"
import type { ClaimRecord, ClaimStatus } from "../lib/types"

// Shared fixtures: claims from raw (unrebased) seeds are past-month VALIDATED
const medicaid = getPayerConfig("medicaid-bh")
const allClaims = generateMonthlyClaims(
  initialNavigators,
  initialPatients,
  initialTimeLogs,
  medicaid,
  initialIntakeRecords
)
const validated = filterClaimsByMonth(allClaims, "2026-01").filter((c) => c.status === "VALIDATED")

function exportFixture(): ClaimRecord[] {
  return createClaimRecords(validated, initialPayers, medicaid, "837P", "verify-script", [])
}

describe("Transition matrix", () => {
  it("permits the legal lifecycle paths", () => {
    expect(canTransition("EXPORTED", "SUBMITTED")).toBe(true)
    expect(canTransition("SUBMITTED", "ACCEPTED")).toBe(true)
    expect(canTransition("SUBMITTED", "REJECTED")).toBe(true)
    expect(canTransition("ACCEPTED", "PAID")).toBe(true)
    expect(canTransition("ACCEPTED", "DENIED")).toBe(true)
  })

  it("rejects illegal / terminal transitions", () => {
    expect(canTransition("EXPORTED", "PAID")).toBe(false)
    expect(canTransition("PAID", "DENIED")).toBe(false)
    expect(canTransition("REJECTED", "SUBMITTED")).toBe(false)
  })

  it("never transitions derived (pre-export) statuses", () => {
    const derived: ClaimStatus[] = ["DRAFT", "NEEDS_ATTENTION", "VALIDATED"]
    derived.forEach((s) => {
      expect(CLAIM_TRANSITIONS[s]).toHaveLength(0)
    })
  })
})

describe("ClaimRecord snapshots + versioned rebill ids", () => {
  it("has enough VALIDATED claims in the fixture to export", () => {
    expect(validated.length).toBeGreaterThanOrEqual(2)
  })

  it("creates one EXPORTED record per exported claim with -v1 ids and a single history entry", () => {
    const records = exportFixture()
    expect(records).toHaveLength(validated.length)
    expect(records.every((r) => r.status === "EXPORTED")).toBe(true)
    expect(records.every((r) => r.id.endsWith("-v1"))).toBe(true)
    expect(
      records.every((r) => r.statusHistory.length === 1 && r.statusHistory[0].status === "EXPORTED")
    ).toBe(true)
  })

  it("bumps the version on rebill of an already-exported claim", () => {
    const records = exportFixture()
    const rebill = createClaimRecords([validated[0]], initialPayers, medicaid, "CSV", "verify-script", records)
    expect(rebill[0].id.endsWith("-v2")).toBe(true)
  })

  it("freezes the snapshot at export time, independent of later mutation of the source claim", () => {
    const records = exportFixture()
    const before = JSON.stringify(records[0].snapshot)
    const originalMinutes = validated[0].totalMinutes
    validated[0].totalMinutes = 99999
    expect(JSON.stringify(records[0].snapshot)).toBe(before)
    validated[0].totalMinutes = originalMinutes
  })

  it("tracks active record keys and releases them when a record is voided", () => {
    const records = exportFixture()
    const keys = getActiveClaimRecordKeys(records)
    expect(keys.size).toBe(records.length)
    const voided = { ...records[0], voided: true }
    const keysAfterVoid = getActiveClaimRecordKeys([voided, ...records.slice(1)])
    expect(keysAfterVoid.size).toBe(records.length - 1)
  })
})

describe("Illegal transitions are rejected", () => {
  it("returns null for an illegal transition and appends history for a legal one", () => {
    const [record] = exportFixture()
    expect(transitionClaimRecord(record, "PAID", "x")).toBeNull()
    const submitted = transitionClaimRecord(record, "SUBMITTED", "verify")!
    expect(submitted.status).toBe("SUBMITTED")
    expect(submitted.statusHistory).toHaveLength(2)
    expect(submitted.submittedAt).toBeDefined()
  })
})

describe("837P generation", () => {
  it("produces a valid X12 837P with real dates, org NPI, and no hardcoded providers", () => {
    const records = exportFixture()
    const payer = initialPayers.find((p) => p.payerConfigId === medicaid.id)!
    const x12 = generate837P(records, {
      patients: initialPatients,
      navigators: initialNavigators,
      payer,
      payerConfig: medicaid,
      orgSettings: initialOrganizationSettings,
    })
    expect(x12.startsWith("ISA")).toBe(true)
    expect(x12).toContain("ST*837*")
    expect(x12).toContain(initialOrganizationSettings.npi)
    expect(x12).not.toContain("Dr. Supervising MD")
    expect(x12).toContain(`CLM*${records[0].id}*`)
    // Real month-end: January 2026 ends on the 31st, never the -28 approximation
    expect(x12).toContain("20260131")
    const dtpSlice = x12.slice(x12.indexOf("DTP*434"), x12.indexOf("DTP*434") + 40)
    expect(/2026012[0-8][~*]/.test(dtpSlice)).toBe(false)
  })
})

describe("835 round-trip + matcher", () => {
  it("carries one CLP per record and parses with zero warnings", () => {
    const records = exportFixture().map((r) => transitionClaimRecord(r, "SUBMITTED", "verify")!)
    const era = generateSample835(records, initialPayers, { scenario: "MIXED", seed: 42 })
    const remit = parse835(era)
    expect(remit.claims).toHaveLength(records.length)
    expect(remit.warnings).toHaveLength(0)
  })

  it("resolves 100% of payments by CLP01 with populated CARC/RARC arrays", () => {
    const records = exportFixture().map((r) => transitionClaimRecord(r, "SUBMITTED", "verify")!)
    const era = generateSample835(records, initialPayers, { scenario: "MIXED", seed: 42 })
    const remit = parse835(era)
    const result = matchRemittance(remit, records)
    expect(result.matches).toHaveLength(records.length)
    expect(result.unmatchedCount).toBe(0)
    expect(result.matches.every((m) => m.resolvedStatus === "PAID" || m.resolvedStatus === "DENIED")).toBe(true)
    expect(
      result.matches.every((m) => m.remittance.carcCodes !== undefined && m.remittance.rarcCodes !== undefined)
    ).toBe(true)
  })

  it("is deterministic for a given seed, and DENY_ALL denies everything", () => {
    const records = exportFixture().map((r) => transitionClaimRecord(r, "SUBMITTED", "verify")!)
    const era = generateSample835(records, initialPayers, { scenario: "MIXED", seed: 42 })
    const era2 = generateSample835(records, initialPayers, { scenario: "MIXED", seed: 42 })
    const body = (s: string) => s.slice(s.indexOf("ST*"))
    expect(body(era)).toBe(body(era2))

    const denyAll = parse835(generateSample835(records, initialPayers, { scenario: "DENY_ALL", seed: 1 }))
    expect(denyAll.claims.every((c) => c.statusCode === "4" || c.paidAmount === 0)).toBe(true)
  })

  it("never re-matches a duplicate 835 import against already-terminal records", () => {
    const records = exportFixture().map((r) => transitionClaimRecord(r, "SUBMITTED", "verify")!)
    const era = generateSample835(records, initialPayers, { scenario: "MIXED", seed: 42 })
    const remit = parse835(era)
    const terminalRecords = records.map((r) => {
      const accepted = transitionClaimRecord(r, "ACCEPTED", "verify")!
      return transitionClaimRecord(accepted, "PAID", "verify")!
    })
    const reimport = matchRemittance(remit, terminalRecords)
    expect(reimport.matches).toHaveLength(0)
    expect(reimport.unmatchedCount).toBe(records.length)
  })
})

describe("Payer-aware billing progress", () => {
  it("runs Medicaid in Rule-of-Eights mode (45 min = 3 units)", () => {
    const medicaidProgress = calculateMonthlyBillingProgress(initialTimeLogs, "pt-billing", medicaid, 1, 2026)
    expect(medicaidProgress.mode).toBe("RULE_OF_EIGHTS")
    expect(medicaidProgress.unitsEarned).toBe(3)
  })

  it("runs Medicare in base+add-on mode (45 min unbillable, 105 min = base + add-on)", () => {
    const pin = getPayerConfig("medicare-pin")
    const medicareProgress = calculateMonthlyBillingProgress(initialTimeLogs, "pt-billing", pin, 1, 2026)
    expect(medicareProgress.mode).toBe("BASE_PLUS_ADDON")
    expect(medicareProgress.unitsEarned).toBe(0)
    const pt1Progress = calculateMonthlyBillingProgress(initialTimeLogs, "pt1", pin, 1, 2026)
    expect(pt1Progress.unitsEarned).toBeGreaterThanOrEqual(2)
  })
})
