/**
 * Zones & geo — Gellert's coverage-zone model (they run 11; the demo seeds 6
 * Phoenix-metro zones) plus windshield-time (unbillable drive time) math.
 *
 * Owned by workstream B-C — signatures are FROZEN.
 */

import type { Appointment, GeoPoint, Navigator, Patient, User, Zone } from "./types"
import { AZ_ZIP_CENTROIDS, type GeoProvider } from "./geo"

// ============================================================================
// ZONE RESOLUTION
// ============================================================================

/** The zone containing a zip code (zips belong to at most one zone) */
export function zoneForZip(zones: Zone[], zip: string): Zone | undefined {
  return zones.find((z) => z.zipCodes.includes(zip))
}

/** Explicit Patient.zoneId wins; otherwise fall back to address-zip lookup */
export function resolveZoneForPatient(zones: Zone[], patient: Patient): Zone | undefined {
  if (patient.zoneId) {
    const byId = zones.find((z) => z.id === patient.zoneId)
    if (byId) return byId
  }
  const zip = patient.address?.zip
  return zip ? zoneForZip(zones, zip) : undefined
}

// ============================================================================
// ZONE COVERAGE (the institutionalized version of the weekly manual join)
// ============================================================================

export interface ZoneCoverage {
  zone: Zone
  activePatients: number
  assignedNavigators: number
  /** null when the zone has no assigned navigators */
  patientsPerNavigator: number | null
  /** Active patients but zero navigators assigned */
  uncovered: boolean
}

export function computeZoneCoverage(
  zones: Zone[],
  patients: Patient[],
  _navigators: Navigator[],
  users: User[]
): ZoneCoverage[] {
  // Resolve each patient once against the FULL zone list (explicit zoneId wins
  // over zip) so a patient can never be counted in two zones.
  const activeByZone = new Map<string, number>()
  for (const patient of patients) {
    if (patient.survivalStatus !== "active") continue
    const zone = resolveZoneForPatient(zones, patient)
    if (zone) activeByZone.set(zone.id, (activeByZone.get(zone.id) ?? 0) + 1)
  }

  return zones.map((zone) => {
    const activePatients = activeByZone.get(zone.id) ?? 0

    const assignedNavigators = users.filter(
      (u) => u.role === "navigator" && u.attributes?.zoneId === zone.id
    ).length

    return {
      zone,
      activePatients,
      assignedNavigators,
      patientsPerNavigator:
        assignedNavigators > 0 ? Math.round((activePatients / assignedNavigators) * 10) / 10 : null,
      uncovered: activePatients > 0 && assignedNavigators === 0,
    }
  })
}

// ============================================================================
// WINDSHIELD TIME (unbillable drive time between consecutive same-day stops)
// ============================================================================

export interface WindshieldDay {
  navigatorId: string
  date: string
  /** Σ driveTimeMinutes between consecutive stops; 0 for a 1-stop day */
  driveMinutes: number
  stops: number
}

/** Per-navigator rollup of WindshieldDay records */
export interface WindshieldSummary {
  navigatorId: string
  days: number
  totalDriveMinutes: number
  avgDriveMinutesPerDay: number
}

/** Appointment types that put a navigator on the road (calls don't drive) */
const TRAVEL_APPOINTMENT_TYPES = new Set<Appointment["type"]>(["home_visit", "clinic"])

/**
 * Per-navigator-per-day windshield time from same-day appointment stops
 * (patient lat/lng, else zip centroid). Labeled "windshield time (unbillable)"
 * everywhere it renders.
 *
 * Stops = non-cancelled in-person appointments with a resolvable point,
 * sorted by time; driveMinutes = Σ geoProvider.driveTimeMinutes between
 * consecutive stops (0 for a 1-stop day — home-base legs are not counted).
 */
export function computeWindshieldTime(
  appointments: Appointment[],
  patients: Patient[],
  geoProvider: GeoProvider
): WindshieldDay[] {
  const patientById = new Map(patients.map((p) => [p.id, p]))

  const stopPoint = (patientId: string): GeoPoint | null => {
    const patient = patientById.get(patientId)
    if (!patient) return null
    if (patient.lat !== undefined && patient.lng !== undefined) {
      return { lat: patient.lat, lng: patient.lng }
    }
    const zip = patient.address?.zip
    return zip ? geoProvider.zipToPoint(zip) : null
  }

  const byNavigatorDay = new Map<string, { navigatorId: string; date: string; stops: { time: string; point: GeoPoint }[] }>()
  for (const apt of appointments) {
    if (apt.status === "cancelled") continue
    if (!TRAVEL_APPOINTMENT_TYPES.has(apt.type)) continue
    const point = stopPoint(apt.patientId)
    if (!point) continue
    const key = `${apt.navigatorId}|${apt.date}`
    const day = byNavigatorDay.get(key) ?? { navigatorId: apt.navigatorId, date: apt.date, stops: [] }
    day.stops.push({ time: apt.time, point })
    byNavigatorDay.set(key, day)
  }

  const days: WindshieldDay[] = []
  for (const { navigatorId, date, stops } of byNavigatorDay.values()) {
    stops.sort((a, b) => a.time.localeCompare(b.time))
    let driveMinutes = 0
    for (let i = 1; i < stops.length; i++) {
      driveMinutes += geoProvider.driveTimeMinutes(stops[i - 1].point, stops[i].point)
    }
    days.push({ navigatorId, date, driveMinutes, stops: stops.length })
  }

  return days.sort(
    (a, b) => a.navigatorId.localeCompare(b.navigatorId) || a.date.localeCompare(b.date)
  )
}

/** Per-navigator daily averages over a set of WindshieldDay records */
export function computeWindshieldAverages(days: WindshieldDay[]): WindshieldSummary[] {
  const byNavigator = new Map<string, { days: number; totalDriveMinutes: number }>()
  for (const day of days) {
    const entry = byNavigator.get(day.navigatorId) ?? { days: 0, totalDriveMinutes: 0 }
    entry.days++
    entry.totalDriveMinutes += day.driveMinutes
    byNavigator.set(day.navigatorId, entry)
  }

  return Array.from(byNavigator.entries())
    .map(([navigatorId, { days: dayCount, totalDriveMinutes }]) => ({
      navigatorId,
      days: dayCount,
      totalDriveMinutes,
      avgDriveMinutesPerDay: Math.round((totalDriveMinutes / dayCount) * 10) / 10,
    }))
    .sort((a, b) => a.navigatorId.localeCompare(b.navigatorId))
}

// ============================================================================
// MAP RENDERING (honest circle approximations; polygons need a real geo tier)
// ============================================================================

export interface ZoneRenderShape {
  zoneId: string
  name: string
  color: string
  center: GeoPoint
  radiusMiles: number
}

/**
 * Circle approximation per zone: centroid of member-zip centroids, radius =
 * max centroid->zip distance + 2 miles padding.
 */
export function zoneRenderShapes(zones: Zone[]): ZoneRenderShape[] {
  const shapes: ZoneRenderShape[] = []

  for (const zone of zones) {
    const points = zone.zipCodes
      .map((zip) => AZ_ZIP_CENTROIDS[zip])
      .filter((p): p is GeoPoint => !!p)
    if (points.length === 0) continue

    const center: GeoPoint = {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
    }

    // Straight-line miles (no road-winding factor — this is a render radius)
    const milesBetween = (a: GeoPoint, b: GeoPoint): number => {
      const toRad = (deg: number) => (deg * Math.PI) / 180
      const dLat = toRad(b.lat - a.lat)
      const dLng = toRad(b.lng - a.lng)
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
      return 2 * 3958.8 * Math.asin(Math.sqrt(h))
    }

    const maxDistance = Math.max(...points.map((p) => milesBetween(center, p)))
    shapes.push({
      zoneId: zone.id,
      name: zone.name,
      color: zone.color,
      center,
      radiusMiles: maxDistance + 2,
    })
  }

  return shapes
}
