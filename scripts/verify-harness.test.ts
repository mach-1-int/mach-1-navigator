/**
 * Verify: shared verify-harness assert/run/summary behavior
 * Run: npm run verify:harness
 */

import { createVerifyHarness } from "./verify-harness"

const { assert, run, printSummary } = createVerifyHarness()

run("assert() passes silently on a true condition", () => {
  const inner = createVerifyHarness()
  inner.assert(true, "true is true")
  assert(true, "no throw for a passing assertion")
})

run("assert() throws a FAIL-prefixed error on a false condition", () => {
  const inner = createVerifyHarness()
  let threw = false
  try {
    inner.assert(false, "should fail")
  } catch (e) {
    threw = true
    assert((e as Error).message === "FAIL: should fail", "thrown error carries the FAIL-prefixed message")
  }
  assert(threw, "assert(false, ...) throws")
})

run("run() catches a thrown assertion and tallies it as a failure, not a crash", () => {
  const inner = createVerifyHarness()
  inner.run("inner failing block", () => {
    inner.assert(false, "inner failure")
  })
  assert(inner.counts().passed === 0, "failing block does not count as passed")
  assert(inner.counts().failed === 1, "failing block increments failed")
})

run("run() tallies a clean block as passed", () => {
  const inner = createVerifyHarness()
  inner.run("inner passing block", () => {
    inner.assert(true, "inner success")
  })
  assert(inner.counts().passed === 1, "passing block increments passed")
  assert(inner.counts().failed === 0, "passing block does not count as failed")
})

run("run() tallies multiple blocks independently across passes and failures", () => {
  const inner = createVerifyHarness()
  inner.run("first", () => inner.assert(true, "ok"))
  inner.run("second", () => inner.assert(false, "not ok"))
  inner.run("third", () => inner.assert(true, "ok"))
  const counts = inner.counts()
  assert(counts.passed === 2, `two passing blocks tally (got ${counts.passed})`)
  assert(counts.failed === 1, `one failing block tallies (got ${counts.failed})`)
})

printSummary(60)
