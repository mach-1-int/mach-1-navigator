/**
 * Verification script for shared lib/utils helpers.
 * Run: npx tsx scripts/verify-utils.ts
 */

import { getInitials } from "../lib/utils"
import { createVerifyHarness } from "./verify-harness"

const { assert, run, printSummary } = createVerifyHarness()

console.log("lib/utils – Verification")
console.log("=============================================")

run("getInitials: two-word name", () => {
  assert(getInitials("Dorothy Martinez") === "DM", "'Dorothy Martinez' -> 'DM'")
})

run("getInitials: lowercase name is uppercased", () => {
  assert(getInitials("maria gonzalez") === "MG", "'maria gonzalez' -> 'MG'")
})

run("getInitials: single name", () => {
  assert(getInitials("Cher") === "C", "'Cher' -> 'C'")
})

run("getInitials: three or more words truncates to 2 initials", () => {
  assert(getInitials("Mary Jane Watson") === "MJ", "'Mary Jane Watson' -> 'MJ'")
})

run("getInitials: collapses repeated whitespace", () => {
  assert(getInitials("  James   Thompson  ") === "JT", "'  James   Thompson  ' -> 'JT'")
})

run("getInitials: empty string yields empty initials", () => {
  assert(getInitials("") === "", "'' -> ''")
})

printSummary(45)
