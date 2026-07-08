/* eslint-disable @typescript-eslint/no-unused-vars -- Phase 0 stub signatures are frozen; params intentionally unused */
/**
 * Zones & geo — Gellert's coverage-zone model (they run 11; the demo seeds 6
 * Phoenix-metro zones) plus windshield-time (unbillable drive time) math.
 *
 * Owned by workstream B-C after Phase 0 — signatures are FROZEN.
 * zoneForZip/resolveZoneForPatient/computeZoneCoverage/zoneRenderShapes ship
 * working; computeWindshieldTime is a stub B-C implements first (half-day).
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
  return zones.map((zone) => {
    const activePatients = patients.filter(
      (p) => p.survivalStatus === "active" && resolveZoneForPatient([zone], p)?.id === zone.id
    ).length

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

/**
 * Per-navigator-per-day windshield time from same-day appointment stops
 * (patient lat/lng, else zip centroid). Labeled "windshield time (unbillable)"
 * everywhere it renders.
 *
 * PHASE 0 STUB — B-C implements (sort same-day stops by time, sum
 * geoProvider.driveTimeMinutes between consecutive stop points).
 */
export function computeWindshieldTime(
  _appointments: Appointment[],
  _patients: Patient[],
  _geoProvider: GeoProvider
): WindshieldDay[] {
  return []
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
