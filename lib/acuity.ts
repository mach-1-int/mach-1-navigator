/**
 * Acuity Mapping
 *
 * One chain from clinical intake to operational tiers:
 *   4-domain AcuityScore (0-12, components/intake/acuity-calculator.ts)
 *     -> level Low | Moderate | High
 *     -> matching-engine line L1 | L2 | L3 (NavigatorAttributes.acuityCapabilities)
 *     -> patient riskLevel 1 | 2 | 3
 */

import type { AcuityScore } from "./types"

export type AcuityLine = "L1" | "L2" | "L3"

/** Intake acuity level -> matching-engine acuity line */
export function acuityLevelToLine(level: AcuityScore["level"]): AcuityLine {
  switch (level) {
    case "Low":
      return "L1"
    case "Moderate":
      return "L2"
    case "High":
      return "L3"
  }
}

/** Intake acuity level -> patient risk tier */
export function acuityLevelToRiskLevel(level: AcuityScore["level"]): 1 | 2 | 3 {
  switch (level) {
    case "Low":
      return 1
    case "Moderate":
      return 2
    case "High":
      return 3
  }
}

/** Matching-engine acuity line -> patient risk tier */
export function lineToRiskLevel(line: AcuityLine): 1 | 2 | 3 {
  switch (line) {
    case "L1":
      return 1
    case "L2":
      return 2
    case "L3":
      return 3
  }
}
