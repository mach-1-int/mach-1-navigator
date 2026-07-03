/**
 * Geo Adapter
 *
 * Pluggable distance/travel-time provider. The default HaversineGeoProvider is
 * the simulator tier: great-circle distance with a road-winding factor and a
 * metro-average speed heuristic. A future RoutingApiGeoProvider (Google Maps /
 * Mapbox) implements the same interface behind a precomputed cache — the
 * interface is synchronous BY DESIGN because callers (matching engine,
 * schedule validation) are pure sync functions in render paths.
 */

import type { GeoPoint } from "./types"

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface GeoProvider {
  distanceMiles(a: GeoPoint, b: GeoPoint): number
  driveTimeMinutes(a: GeoPoint, b: GeoPoint): number
  zipToPoint(zip: string): GeoPoint | null
  zipDistanceMiles(zipA: string, zipB: string): number
  zipDriveTimeMinutes(zipA: string, zipB: string): number
}

// ============================================================================
// ZIP CENTROIDS (simulator tier - Arizona metro zips used by seed data,
// plus common Phoenix-metro zips so pasted HL7 referrals resolve)
// ============================================================================

export const AZ_ZIP_CENTROIDS: Record<string, GeoPoint> = {
  // Phoenix metro
  "85001": { lat: 33.4484, lng: -112.074 }, // Central Phoenix
  "85008": { lat: 33.4655, lng: -111.9963 }, // East Phoenix
  "85012": { lat: 33.5091, lng: -112.0713 }, // Central Corridor
  "85021": { lat: 33.5595, lng: -112.0937 }, // North Phoenix
  "85031": { lat: 33.4949, lng: -112.1697 }, // Maryvale
  "85032": { lat: 33.6252, lng: -112.0056 }, // Paradise Valley Village
  "85034": { lat: 33.434, lng: -112.029 }, // Sky Harbor
  "85044": { lat: 33.3062, lng: -112.0119 }, // Ahwatukee
  "85201": { lat: 33.4152, lng: -111.8315 }, // Mesa West
  "85204": { lat: 33.3942, lng: -111.7893 }, // Mesa
  "85251": { lat: 33.4942, lng: -111.9182 }, // Scottsdale
  "85281": { lat: 33.4255, lng: -111.94 }, // Tempe
  "85296": { lat: 33.3103, lng: -111.7431 }, // Gilbert
  "85301": { lat: 33.5387, lng: -112.1859 }, // Glendale
  "85303": { lat: 33.51, lng: -112.22 }, // West Glendale
  "85308": { lat: 33.662, lng: -112.1863 }, // North Glendale
  "85339": { lat: 33.3387, lng: -112.1663 }, // Laveen
  "85351": { lat: 33.6056, lng: -112.2845 }, // Sun City
  "85383": { lat: 33.75, lng: -112.26 }, // North Peoria
  // Tucson
  "85701": { lat: 32.2217, lng: -110.9265 }, // Downtown Tucson
  "85710": { lat: 32.214, lng: -110.8253 }, // East Tucson
}

// ============================================================================
// HAVERSINE PROVIDER (default)
// ============================================================================

const EARTH_RADIUS_MILES = 3958.8
// Roads are not great circles; empirical metro winding factor.
const ROAD_WINDING_FACTOR = 1.3
// Blended metro average incl. surface streets and freeway segments.
const METRO_AVG_MPH = 24
const MIN_DRIVE_MINUTES = 5

// Documented fallbacks for unknown zips (match the old mock-table defaults so
// unseeded zips behave the same as before the adapter swap).
export const UNKNOWN_ZIP_DISTANCE_MILES = 20
export const UNKNOWN_ZIP_DRIVE_MINUTES = 30

export class HaversineGeoProvider implements GeoProvider {
  distanceMiles(a: GeoPoint, b: GeoPoint): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
    const greatCircle = 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h))
    return greatCircle * ROAD_WINDING_FACTOR
  }

  driveTimeMinutes(a: GeoPoint, b: GeoPoint): number {
    const miles = this.distanceMiles(a, b)
    const minutes = (miles / METRO_AVG_MPH) * 60
    // Round to 5-minute increments, floor at MIN_DRIVE_MINUTES
    return Math.max(MIN_DRIVE_MINUTES, Math.round(minutes / 5) * 5)
  }

  zipToPoint(zip: string): GeoPoint | null {
    return AZ_ZIP_CENTROIDS[zip] ?? null
  }

  zipDistanceMiles(zipA: string, zipB: string): number {
    if (zipA === zipB) return 0
    const a = this.zipToPoint(zipA)
    const b = this.zipToPoint(zipB)
    if (!a || !b) return UNKNOWN_ZIP_DISTANCE_MILES
    return this.distanceMiles(a, b)
  }

  zipDriveTimeMinutes(zipA: string, zipB: string): number {
    if (zipA === zipB) return MIN_DRIVE_MINUTES
    const a = this.zipToPoint(zipA)
    const b = this.zipToPoint(zipB)
    if (!a || !b) return UNKNOWN_ZIP_DRIVE_MINUTES
    return this.driveTimeMinutes(a, b)
  }
}

/** Singleton provider - swap for a routing-API-backed implementation later. */
export const geo: GeoProvider = new HaversineGeoProvider()

// ============================================================================
// BROWSER GEOLOCATION
// ============================================================================

/**
 * Get the device position, resolving null (never rejecting) on denial,
 * timeout, or unsupported environments so callers can fall back gracefully.
 */
export function getCurrentPositionSafe(timeoutMs = 5000): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000 }
    )
  })
}
