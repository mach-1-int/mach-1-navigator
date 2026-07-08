/**
 * Verification script for QA Protocol: The Safety Map
 * Run: npm run verify:safety-map
 */

import { initialNavigatorLocations, initialScheduleEvents, initialAppointments } from "../lib/initial-data"
import { deriveSafetyStatus, SAFETY_RULES } from "../lib/safety-status"
import { formatTimeAgo } from "../lib/time-format"
import type { NavigatorLocation, SOSEvent } from "../lib/types"
import { createVerifyHarness } from "./verify-harness"

const { assert, run, printSummary } = createVerifyHarness()

console.log("QA Protocol: The Safety Map – Verification")
console.log("==========================================")

// Scenario 1: Bird's Eye – at least 3 pins, Glendale (West), Mesa (East), Downtown
run("Scenario 1: At least 3 distinct pins", () => {
  assert(initialNavigatorLocations.length >= 3, `Have at least 3 locations (got ${initialNavigatorLocations.length})`)
})

run("Scenario 1: Pin in Glendale (West)", () => {
  const glendale = initialNavigatorLocations.find((loc) => loc.lng < -112.1 && loc.lat > 33.5)
  assert(!!glendale, "A pin exists in Glendale / West Valley (lng < -112.1)")
  assert(glendale!.navigatorName === "Maria Gonzalez", "Glendale pin is Maria Gonzalez")
  assert(glendale!.status === "ACTIVE", "Maria is ACTIVE (green pin)")
})

run("Scenario 1: Pin in Mesa (East)", () => {
  const mesa = initialNavigatorLocations.find((loc) => loc.lng > -112 && loc.lat < 33.5)
  assert(!!mesa, "A pin exists in Mesa / East Valley (lng > -112)")
  assert(mesa!.navigatorName === "John Mitchell", "Mesa pin is John Mitchell")
  assert(mesa!.status === "RISK_ALERT", "John is RISK_ALERT (red pin)")
})

run("Scenario 1: Pin in Downtown Phoenix", () => {
  const downtown = initialNavigatorLocations.find(
    (loc) => Math.abs(loc.lat - 33.4484) < 0.01 && Math.abs(loc.lng - -112.074) < 0.01
  )
  assert(!!downtown, "A pin exists in Downtown Phoenix")
  assert(downtown!.navigatorName === "Sarah Thompson", "Downtown pin is Sarah Thompson")
})

// Scenario 2: Risk Alert – Red pin (John), Status RISK ALERT, Last Check-in 2 hours ago
run("Scenario 2: Red pin is John with RISK_ALERT", () => {
  const john = initialNavigatorLocations.find((loc) => loc.navigatorId === "nav-john")
  assert(!!john, "John Mitchell exists in locations")
  assert(john!.status === "RISK_ALERT", "John has status RISK_ALERT (red, pulsing)")
})

run("Scenario 2: John's Last Check-in shows '2 hours ago'", () => {
  const john = initialNavigatorLocations.find((loc) => loc.navigatorId === "nav-john")
  assert(!!john, "John exists")
  const label = formatTimeAgo(john!.lastCheckIn)
  assert(label === "2 hours ago", `Last Check-in label is '2 hours ago' (got: ${label})`)
})

run("Scenario 2: Popup would show 'Status: RISK ALERT'", () => {
  const john = initialNavigatorLocations.find((loc) => loc.navigatorId === "nav-john")
  assert(!!john && john.status === "RISK_ALERT", "John has RISK_ALERT (popup shows 'Status: RISK ALERT')")
})

// Scenario 3: Find Navigator – Maria in sidebar, map pans to her
run("Scenario 3: Maria (Glendale) in list for pan-to-pin", () => {
  const maria = initialNavigatorLocations.find((loc) => loc.navigatorId === "nav-maria")
  assert(!!maria, "Maria Gonzalez exists (clickable in sidebar)")
  assert(maria!.lat === 33.5387 && maria!.lng === -112.1859, "Maria has Glendale coordinates for flyTo")
})

// Phoenix map center/bounds
run("Map: Phoenix metro center and bounds", () => {
  const lats = initialNavigatorLocations.map((l) => l.lat)
  const lngs = initialNavigatorLocations.map((l) => l.lng)
  assert(lats.every((lat) => lat > 33.3 && lat < 33.7), "All pins within Phoenix metro latitude")
  assert(lngs.every((lng) => lng > -112.3 && lng < -111.8), "All pins within Phoenix metro longitude")
})

// ============================================================================
// Derived-status rules (lib/safety-status.ts) - status is COMPUTED, not a flag
// ============================================================================

const deriveSeed = (loc: NavigatorLocation, sosEvents: SOSEvent[] = []) =>
  deriveSafetyStatus(loc, initialScheduleEvents, initialAppointments, sosEvents, new Date())

run("Derivation: seed statuses match deriveSafetyStatus", () => {
  initialNavigatorLocations.forEach((loc) => {
    const derived = deriveSeed(loc)
    assert(
      derived === loc.status,
      `${loc.navigatorName}: derived ${derived} === seeded ${loc.status}`
    )
  })
})

run("Derivation: an ACTIVE SOS forces RISK_ALERT", () => {
  const maria = initialNavigatorLocations.find((loc) => loc.navigatorId === "nav-maria")
  assert(!!maria, "Maria exists")
  assert(deriveSeed(maria!) === "ACTIVE", "Maria derives ACTIVE without an SOS")
  const sos: SOSEvent = {
    id: "sos-test",
    navigatorId: "nav-maria",
    navigatorName: "Maria Gonzalez",
    triggeredAt: new Date().toISOString(),
    lat: maria!.lat,
    lng: maria!.lng,
    status: "ACTIVE",
  }
  assert(deriveSeed(maria!, [sos]) === "RISK_ALERT", "Maria flips to RISK_ALERT with an ACTIVE SOS")
})

run("Derivation: Sarah's seed check-in is inside the idle window", () => {
  const sarah = initialNavigatorLocations.find((loc) => loc.navigatorId === "nav-sarah")
  assert(!!sarah, "Sarah exists")
  const ageMin = (Date.now() - new Date(sarah!.lastCheckIn).getTime()) / 60000
  assert(
    ageMin >= SAFETY_RULES.IDLE_AFTER_MIN,
    `Sarah's lastCheckIn is >= ${SAFETY_RULES.IDLE_AFTER_MIN} min old (got ${ageMin.toFixed(1)} min)`
  )
  assert(deriveSeed(sarah!) === "IDLE", "Sarah derives IDLE (stationary + stale check-in)")
})

printSummary(42)
