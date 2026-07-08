/**
 * Shared assertion harness for the scripts/verify-*.ts scripts.
 *
 * Each verify script exercises a different slice of the app, but they all
 * report results the same way: throw-to-fail assertions, named blocks that
 * catch and tally, and a final pass/fail summary that exits non-zero on
 * failure (so `npm run verify:*` fails CI).
 */

export interface VerifyHarness {
  assert: (condition: boolean, message: string) => void
  run: (name: string, fn: () => void) => void
  printSummary: (bannerWidth?: number) => void
  counts: () => { passed: number; failed: number }
}

export function createVerifyHarness(): VerifyHarness {
  let passed = 0
  let failed = 0

  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(`FAIL: ${message}`)
    console.log(`  ✓ ${message}`)
  }

  const run = (name: string, fn: () => void) => {
    try {
      console.log(`\n--- ${name} ---`)
      fn()
      passed++
    } catch (e) {
      failed++
      console.error(`  ✗ ${(e as Error).message}`)
    }
  }

  const printSummary = (bannerWidth = 45) => {
    console.log(`\n${"=".repeat(bannerWidth)}`)
    console.log(`Result: ${passed} passed, ${failed} failed`)
    process.exit(failed > 0 ? 1 : 0)
  }

  const counts = () => ({ passed, failed })

  return { assert, run, printSummary, counts }
}
