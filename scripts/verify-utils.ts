/**
 * Verification script for shared lib/utils helpers.
 * Run: npx tsx scripts/verify-utils.ts
 */

import { getInitials } from "../lib/utils"

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

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
