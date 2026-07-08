/**
 * Remittance review — the DAP false-denial guardrail.
 *
 * Before an 835 remittance posts, its CARC/RARC codes are checked against the
 * admin-managed remark-code dictionary. Any UNKNOWN code pends the remittance
 * for biller review instead of silently misposting (Sonya's UHC DAP pain:
 * a +1% incentive adjustment posting as a denial).
 */

import type { RemarkClassification, RemarkCode, RemittanceInfo } from "./types"

/** All CARC + RARC codes on a remittance that are absent from the dictionary */
export function findUnknownCodes(remittance: RemittanceInfo, remarkCodes: RemarkCode[]): string[] {
  const known = new Set(remarkCodes.map((rc) => rc.code.toUpperCase()))
  const seen = new Set<string>()
  const unknown: string[] = []
  for (const code of [...remittance.carcCodes, ...remittance.rarcCodes]) {
    const normalized = code.toUpperCase()
    if (!known.has(normalized) && !seen.has(normalized)) {
      seen.add(normalized)
      unknown.push(code)
    }
  }
  return unknown
}

export interface ClassifiedRemitCode {
  code: string
  type?: RemarkCode["type"]
  description: string
  classification?: RemarkClassification
  known: boolean
}

/** Join remit codes against the dictionary for display (tooltips, pend detail) */
export function classifyRemitCodes(codes: string[], remarkCodes: RemarkCode[]): ClassifiedRemitCode[] {
  return codes.map((code) => {
    const entry = remarkCodes.find((rc) => rc.code.toUpperCase() === code.toUpperCase())
    return {
      code,
      type: entry?.type,
      description: entry?.description ?? "Unknown code — not in dictionary",
      classification: entry?.classification,
      known: !!entry,
    }
  })
}
