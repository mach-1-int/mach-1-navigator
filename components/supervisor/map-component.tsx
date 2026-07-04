"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { NavigatorLocation, SafetyStatus } from "@/lib/types"

// Relative time for popup (QA: "Last Check-in: 2 hours ago")
function formatLastCheckIn(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "Just now"
  if (diffMins === 1) return "1 min ago"
  if (diffMins < 60) return `${diffMins} mins ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours === 1) return "1 hour ago"
  return `${diffHours} hours ago`
}

// Icons are cached per (status, isSOS) — only 6 combinations exist. Building
// a fresh divIcon per marker per render would make react-leaflet tear down
// and rebuild the marker DOM on every simulation tick / clock refresh,
// restarting the pulse animations mid-cycle for no visual change.
const iconCache = new Map<string, L.DivIcon>()

// Fix for default marker icons in Leaflet with Next.js
const createCustomIcon = (status: SafetyStatus, isSOS: boolean) => {
  const cacheKey = `${status}:${isSOS}`
  const cached = iconCache.get(cacheKey)
  if (cached) return cached

  const colors: Record<SafetyStatus, string> = {
    ACTIVE: "#059669", // emerald-600
    IDLE: "#6b7280", // gray-500 (changed from amber for better visibility)
    RISK_ALERT: "#dc2626", // red-600
  }

  const color = colors[status]

  // Different animation classes based on status
  const animationClass = status === "RISK_ALERT"
    ? "risk-pulse"
    : status === "ACTIVE"
    ? "active-pulse"
    : ""

  const icon = L.divIcon({
    className: "custom-marker",
    html: `
      ${isSOS ? `
        <div class="sos-ring" style="
          position: absolute;
          top: -6px;
          left: -6px;
          width: 44px;
          height: 44px;
          border: 3px solid #b91c1c;
          border-radius: 50%;
        "></div>
        <div style="
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #b91c1c;
          color: white;
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 0.5px;
          padding: 1px 5px;
          border-radius: 9999px;
          border: 1px solid white;
          z-index: 10;
        ">SOS</div>
      ` : ""}
      <div class="${animationClass}" style="
        width: 32px;
        height: 32px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      ${status === "RISK_ALERT" ? `
        <div class="risk-badge" style="
          position: absolute;
          top: -8px;
          right: -8px;
          width: 20px;
          height: 20px;
          background-color: #dc2626;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: white; font-size: 12px; font-weight: bold;">!</span>
        </div>
      ` : ""}
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  })

  iconCache.set(cacheKey, icon)
  return icon
}

// Component to fly to selected location
function FlyToLocation({ location }: { location: NavigatorLocation | null }) {
  const map = useMap()

  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 14, {
        duration: 1,
      })
    }
  }, [location, map])

  return null
}

interface MapComponentProps {
  /** Locations arrive with `status` already replaced by the derived status */
  locations: NavigatorLocation[]
  selectedNavigatorId: string | null
  onSelectNavigator: (navigatorId: string) => void
  /** Navigators with a live (ACTIVE/ACKNOWLEDGED) SOS - extra ring + badge */
  sosNavigatorIds?: Set<string>
  /** Phone per navigatorId (resolved by parent from users); no phone = no Call Now */
  phones?: Record<string, string | undefined>
}

export default function MapComponent({
  locations,
  selectedNavigatorId,
  onSelectNavigator,
  sosNavigatorIds,
  phones,
}: MapComponentProps) {
  const selectedLocation = selectedNavigatorId
    ? locations.find((loc) => loc.navigatorId === selectedNavigatorId)
    : null

  // Phoenix metro center as default
  const defaultCenter: [number, number] = [33.4484, -112.0740]
  const defaultZoom = 10 // Zoom level to show all Phoenix metro area

  // Calculate bounds to fit all markers
  const bounds = locations.length > 0
    ? L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]))
    : null

  // Status badge colors and labels (QA: popup must say "Status: RISK ALERT")
  const statusConfig: Record<SafetyStatus, { label: string; bgColor: string; textColor: string }> = {
    ACTIVE: { label: "Active", bgColor: "#d1fae5", textColor: "#065f46" },
    IDLE: { label: "Idle", bgColor: "#fef3c7", textColor: "#92400e" },
    RISK_ALERT: { label: "RISK ALERT", bgColor: "#fee2e2", textColor: "#991b1b" },
  }

  return (
    <>
      <style jsx global>{`
        /* Green pulse for ACTIVE status */
        @keyframes activePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(5, 150, 105, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(5, 150, 105, 0);
          }
        }
        .active-pulse {
          animation: activePulse 2s infinite;
        }

        /* Vigorous red pulse for RISK_ALERT status */
        @keyframes riskPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.9);
            transform: scale(1);
          }
          25% {
            box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.6);
            transform: scale(1.05);
          }
          50% {
            box-shadow: 0 0 0 15px rgba(220, 38, 38, 0);
            transform: scale(1);
          }
          75% {
            box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.6);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.9);
            transform: scale(1);
          }
        }
        .risk-pulse {
          animation: riskPulse 0.8s infinite;
        }

        /* Pulsing badge animation */
        @keyframes badgePulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.8;
          }
        }
        .risk-badge {
          animation: badgePulse 0.5s infinite;
        }

        /* Expanding ring for an active SOS */
        @keyframes sosRing {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        .sos-ring {
          animation: sosRing 1s infinite;
        }

        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .leaflet-popup-content {
          margin: 0;
          min-width: 220px;
        }
        .custom-marker {
          background: transparent;
          border: none;
        }
        .call-now-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 8px 12px;
          margin-top: 8px;
          background-color: #2563eb;
          color: white !important;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background-color 0.2s;
        }
        .call-now-btn:hover {
          background-color: #1d4ed8;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 500;
        }
      `}</style>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }}
        bounds={bounds || undefined}
        boundsOptions={{ padding: [50, 50] }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((location) => {
          const isSOS = sosNavigatorIds?.has(location.navigatorId) ?? false
          const phone = phones?.[location.navigatorId]
          return (
            <Marker
              key={location.id}
              position={[location.lat, location.lng]}
              icon={createCustomIcon(location.status, isSOS)}
              eventHandlers={{
                click: () => onSelectNavigator(location.navigatorId),
              }}
            >
              <Popup>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-sm">{location.navigatorName}</span>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: statusConfig[location.status].bgColor,
                        color: statusConfig[location.status].textColor,
                      }}
                    >
                      Status: {statusConfig[location.status].label}
                    </span>
                  </div>
                  {isSOS && (
                    <p className="text-xs font-bold mb-2" style={{ color: "#b91c1c" }}>
                      SOS ACTIVE — acknowledge in the sidebar
                    </p>
                  )}
                  {location.currentTask && (
                    <p className="text-xs text-gray-600 mb-2">{location.currentTask}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Last Check-in: {formatLastCheckIn(location.lastCheckIn)}
                  </p>
                  {location.batteryLevel !== undefined && (
                    <p className="text-xs text-gray-500 mb-1">Battery: {location.batteryLevel}%</p>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`} className="call-now-btn">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      Call Now
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        <FlyToLocation location={selectedLocation || null} />
      </MapContainer>
    </>
  )
}
