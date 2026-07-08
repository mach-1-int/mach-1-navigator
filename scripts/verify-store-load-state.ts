/**
 * Verify: Store persistence (characterization test for loadState)
 *
 * Run with: npm run verify:store
 *
 * Locks down loadState's behavior across the extracted merge helpers
 * (mergeCoreState/mergeBillingState/mergeSchedulingAndSafetyState via
 * orFallback, and the tryLoadPersistedState version/structure gate):
 * missing/outdated/malformed storage all fall back to fresh seed data,
 * a valid save merges per-field with `||` (not `??`) fallback semantics,
 * and navigatorLocations is always re-seeded fresh regardless of what
 * was persisted.
 *
 * loadState/saveState/clearPersistedState branch on `typeof window`, so
 * this script installs minimal window/localStorage stand-ins before
 * exercising them (tsx runs under plain Node, which has neither).
 */

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  get size(): number {
    return this.store.size
  }
  soleKey(): string {
    const keys = [...this.store.keys()]
    if (keys.length !== 1) throw new Error(`expected exactly one storage key, got ${keys.length}`)
    return keys[0]
  }
}

const storage = new MemoryStorage()
;(globalThis as unknown as { window: unknown }).window = {}
;(globalThis as unknown as { localStorage: Storage }).localStorage = storage as unknown as Storage

import { loadState, saveState, clearPersistedState, createInitialState } from "../lib/store"

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

// Establishes the real storage key without hardcoding STORAGE_KEY (private to store.ts).
clearPersistedState()
saveState(createInitialState())
const STORAGE_KEY = storage.soleKey()
const currentVersion = createInitialState()._version
clearPersistedState()

run("No saved state falls back to a fresh initial state", () => {
  const state = loadState()
  assert(state.patients.length === createInitialState().patients.length, "patients match fresh seed count")
  assert(state._version === currentVersion, "version stamped to current")
})

run("Malformed JSON in storage is caught and falls back to fresh state", () => {
  storage.setItem(STORAGE_KEY, "{not valid json")
  const state = loadState()
  assert(state.patients.length === createInitialState().patients.length, "falls back to fresh seed on parse error")
  clearPersistedState()
})

run("Outdated version resets and clears storage", () => {
  const stale = { ...createInitialState(), _version: 1 }
  storage.setItem(STORAGE_KEY, JSON.stringify(stale))
  const state = loadState()
  assert(state._version === currentVersion, "version reset to current")
  assert(storage.size === 0, "stale entry is cleared from storage")
})

run("Missing required structure falls back without clearing storage", () => {
  storage.setItem(STORAGE_KEY, JSON.stringify({ _version: currentVersion, notes: [] }))
  const state = loadState()
  assert(state.patients.length === createInitialState().patients.length, "falls back to fresh seed")
  assert(storage.size === 1, "invalid entry is left in storage (matches pre-refactor behavior)")
  clearPersistedState()
})

run("Valid save merges per-field, preserving falsy `||` fallback semantics", () => {
  const seeded = {
    ...createInitialState(),
    patients: [], // falsy-empty array stays as an empty array (arrays are truthy)
    activePayerConfigId: "", // falsy string DOES fall back (matches `||`, not `??`)
    navigatorLocations: [{ id: "fake-loc", navigatorId: "nope" }] as unknown as ReturnType<typeof createInitialState>["navigatorLocations"],
  }
  delete (seeded as { timeLogs?: unknown }).timeLogs

  storage.setItem(STORAGE_KEY, JSON.stringify(seeded))
  const state = loadState()
  const fresh = createInitialState()

  assert(state.patients.length === 0, "empty persisted array is kept as-is (truthy, no fallback)")
  assert(state.activePayerConfigId === fresh.activePayerConfigId, "falsy empty string falls back to seed default")
  assert(state.timeLogs.length === fresh.timeLogs.length, "missing field falls back to seed default")
  assert(
    JSON.stringify(state.navigatorLocations) === JSON.stringify(fresh.navigatorLocations),
    "navigatorLocations always re-seeded fresh, ignoring persisted value"
  )
  assert(state._version === currentVersion, "version stamped to current")
  clearPersistedState()
})

run("typeof window === 'undefined' short-circuits to a fresh state", () => {
  const win = (globalThis as unknown as { window?: unknown }).window
  delete (globalThis as unknown as { window?: unknown }).window
  const state = loadState()
  assert(state.patients.length === createInitialState().patients.length, "returns fresh state with no window")
  ;(globalThis as unknown as { window: unknown }).window = win
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
