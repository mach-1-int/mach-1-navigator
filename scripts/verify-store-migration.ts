/**
 * Verification script: version-mismatch migration path (lib/store.ts)
 *
 * Exercises the v12 -> v13 migration (TimeLog.billingPeriod backfill) both as
 * a pure function and end-to-end through loadState(), and locks in that an
 * *unsupported* version gap still safely falls back to a reset instead of
 * persisting a half-migrated shape.
 *
 * Run: npm run verify:migration
 */

type AnyRecord = Record<string, unknown>

// loadState()/saveState() branch on `typeof window`, so a minimal shim has to
// be installed before lib/store.ts is imported. main() imports it dynamically
// so the shim below is guaranteed to run first.

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
}

const memoryStorage = new MemoryStorage()
;(globalThis as unknown as { window: AnyRecord }).window = {}
;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = memoryStorage

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

function timeLogsOf(state: AnyRecord): AnyRecord[] {
  return state.timeLogs as AnyRecord[]
}

function patientsOf(state: AnyRecord): AnyRecord[] {
  return state.patients as AnyRecord[]
}

async function main() {
  const { migrateState, migrateV12ToV13, loadState, createInitialState } = await import("../lib/store")

  // ==========================================================================
  // Fixture: a realistic v12 persisted state with mixed-shape time logs
  // ==========================================================================

  function buildV12Fixture(): AnyRecord {
    const base = JSON.parse(JSON.stringify(createInitialState())) as AnyRecord
    base._version = 12

    // Tag a patient with a unique marker so we can prove real user data (not
    // just seed data) survives the migration, rather than being silently
    // replaced by a fresh reseed that happens to look similar.
    const [firstPatient, ...restPatients] = patientsOf(base)
    base.patients = [
      { ...firstPatient, id: "marker-patient-v12", name: "Migration Marker Patient" },
      ...restPatients,
    ]

    // Old-shape time logs: some never got billingPeriod set (legacy write
    // path), some already have it (should be left byte-for-byte alone), one
    // has a falsy-but-present billingPeriod to make sure it's still backfilled.
    base.timeLogs = [
      {
        id: "tl-legacy-no-period",
        patientId: "marker-patient-v12",
        date: "2025-11-03",
        startTime: "2025-11-03T14:00:00.000Z",
        endTime: "2025-11-03T14:20:00.000Z",
        durationMinutes: 20,
        modality: "Phone",
        serviceType: "PIN",
        navigatorId: "nav-test",
        verified: true,
        // billingPeriod intentionally omitted
      },
      {
        id: "tl-has-period",
        patientId: "marker-patient-v12",
        date: "2025-12-10",
        startTime: "2025-12-10T09:00:00.000Z",
        endTime: "2025-12-10T09:45:00.000Z",
        durationMinutes: 45,
        modality: "In-Person",
        serviceType: "CHI",
        navigatorId: "nav-test",
        verified: false,
        billingPeriod: "2025-12",
      },
      {
        id: "tl-legacy-empty-string",
        patientId: "marker-patient-v12",
        date: "2026-01-15",
        startTime: "2026-01-15T10:00:00.000Z",
        endTime: "2026-01-15T10:30:00.000Z",
        durationMinutes: 30,
        modality: "Video",
        serviceType: "PIN",
        navigatorId: "nav-test",
        verified: true,
        billingPeriod: "",
      },
    ]

    return base
  }

  // ==========================================================================
  // Group A: migrateState() / migrateV12ToV13() as pure functions
  // ==========================================================================

  run("migrateV12ToV13 backfills missing billingPeriod from date", () => {
    const fixture = buildV12Fixture()
    const migrated = migrateV12ToV13(fixture)
    const log = timeLogsOf(migrated).find((l) => l.id === "tl-legacy-no-period")
    assert(!!log, "legacy log survives migration")
    assert(log!.billingPeriod === "2025-11", `billingPeriod derived as 2025-11 (got ${log!.billingPeriod})`)
  })

  run("migrateV12ToV13 backfills falsy (empty-string) billingPeriod", () => {
    const fixture = buildV12Fixture()
    const migrated = migrateV12ToV13(fixture)
    const log = timeLogsOf(migrated).find((l) => l.id === "tl-legacy-empty-string")
    assert(log!.billingPeriod === "2026-01", `empty billingPeriod backfilled to 2026-01 (got ${log!.billingPeriod})`)
  })

  run("migrateV12ToV13 leaves an already-populated billingPeriod untouched", () => {
    const fixture = buildV12Fixture()
    const migrated = migrateV12ToV13(fixture)
    const log = timeLogsOf(migrated).find((l) => l.id === "tl-has-period")
    assert(log!.billingPeriod === "2025-12", "existing billingPeriod (2025-12) is not overwritten")
  })

  run("migrateV12ToV13 drops no time log records and adds none", () => {
    const fixture = buildV12Fixture()
    const migrated = migrateV12ToV13(fixture)
    assert(
      timeLogsOf(migrated).length === timeLogsOf(fixture).length,
      `timeLogs count preserved (${timeLogsOf(fixture).length} in, ${timeLogsOf(migrated).length} out)`
    )
  })

  run("migrateV12ToV13 stamps _version to CURRENT_VERSION (13)", () => {
    const fixture = buildV12Fixture()
    const migrated = migrateV12ToV13(fixture)
    assert(migrated._version === 13, `_version is 13 (got ${migrated._version})`)
  })

  run("migrateV12ToV13 does not touch unrelated slices (no data loss)", () => {
    const fixture = buildV12Fixture()
    const migrated = migrateV12ToV13(fixture)
    for (const key of Object.keys(fixture)) {
      if (key === "timeLogs" || key === "_version") continue
      assert(
        JSON.stringify(migrated[key]) === JSON.stringify(fixture[key]),
        `slice "${key}" is unchanged`
      )
    }
  })

  run("migrateState round-trips a full v12 fixture end to end", () => {
    const fixture = buildV12Fixture()
    const migrated = migrateState(fixture, 12)
    assert(migrated._version === 13, "final _version is CURRENT_VERSION")
    assert(patientsOf(migrated).some((p) => p.id === "marker-patient-v12"), "marker patient survives")
    assert(
      timeLogsOf(migrated).every((l) => typeof l.billingPeriod === "string" && (l.billingPeriod as string).length > 0),
      "every time log has a non-empty billingPeriod after migration"
    )
  })

  run("migrateState throws (no silent guess) for an undocumented version gap", () => {
    const fixture = buildV12Fixture()
    fixture._version = 5
    let threw = false
    try {
      migrateState(fixture, 5)
    } catch {
      threw = true
    }
    assert(threw, "migrateState throws instead of guessing a transform for v5 -> v13")
  })

  // ==========================================================================
  // Group B: full loadState() integration, through mocked localStorage
  // ==========================================================================

  run("loadState() migrates a persisted v12 store instead of wiping it", () => {
    memoryStorage.setItem("mach1-navigator-store", JSON.stringify(buildV12Fixture()))

    const result = loadState()

    assert(result._version === 13, `loaded state is stamped v13 (got ${result._version})`)
    assert(
      result.patients.some((p) => p.id === "marker-patient-v12"),
      "marker patient present after loadState() — user data was migrated, not discarded"
    )
    const log = result.timeLogs.find((l) => l.id === "tl-legacy-no-period")
    assert(!!log, "legacy time log present after loadState()")
    assert(log!.billingPeriod === "2025-11", "legacy time log's billingPeriod backfilled through loadState()")
    const untouched = result.timeLogs.find((l) => l.id === "tl-has-period")
    assert(untouched!.billingPeriod === "2025-12", "pre-existing billingPeriod preserved through loadState()")
  })

  run("loadState() falls back to a fresh reset for an undocumented old version", () => {
    const fixture = buildV12Fixture()
    fixture._version = 3 // no migration registered this far back
    memoryStorage.setItem("mach1-navigator-store", JSON.stringify(fixture))

    const result = loadState()

    assert(result._version === 13, "reset state is still stamped CURRENT_VERSION")
    assert(
      !result.patients.some((p) => p.id === "marker-patient-v12"),
      "marker patient is gone — undocumented gap safely resets instead of persisting a guess"
    )
    assert(memoryStorage.getItem("mach1-navigator-store") === null, "localStorage was cleared on fallback reset")
  })

  console.log("\n==========================================")
  console.log(`Result: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
