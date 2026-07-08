/**
 * Verification script for lib/time-format.ts
 * Run: npm run verify:time-format
 */

import { formatTimeAgo } from "../lib/time-format"

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

console.log("lib/time-format.ts – Verification")
console.log("==================================")

const NOW = new Date("2026-07-08T12:00:00Z")
const minutesAgo = (mins: number) => new Date(NOW.getTime() - mins * 60000).toISOString()

run("Under a minute reads 'Just now'", () => {
  assert(formatTimeAgo(minutesAgo(0), NOW) === "Just now", "0 minutes ago")
  assert(formatTimeAgo(minutesAgo(0.5), NOW) === "Just now", "30 seconds ago")
})

run("Exactly 1 minute uses singular form", () => {
  assert(formatTimeAgo(minutesAgo(1), NOW) === "1 min ago", "1 minute ago")
})

run("2-59 minutes use plural form", () => {
  assert(formatTimeAgo(minutesAgo(2), NOW) === "2 mins ago", "2 minutes ago")
  assert(formatTimeAgo(minutesAgo(59), NOW) === "59 mins ago", "59 minutes ago")
})

run("Exactly 1 hour uses singular form", () => {
  assert(formatTimeAgo(minutesAgo(60), NOW) === "1 hour ago", "60 minutes ago")
})

run("Multiple hours use plural form", () => {
  assert(formatTimeAgo(minutesAgo(120), NOW) === "2 hours ago", "120 minutes ago")
  assert(formatTimeAgo(minutesAgo(600), NOW) === "10 hours ago", "600 minutes ago")
})

run("Defaults to the current time when `now` is omitted", () => {
  const label = formatTimeAgo(new Date().toISOString())
  assert(label === "Just now", `a just-created timestamp reads 'Just now' (got: ${label})`)
})

console.log("\n==================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
