"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Appointment } from "@/lib/types"

/**
 * A route stop with resolved coordinates, in visit order.
 * Built by the RouteMap wrapper from appointments + patients.
 */
export interface RouteStop {
  id: string
  patientName: string
  time: string
  type: Appointment["type"]
  status: Appointment["status"]
  lat: number
  lng: number
}

interface RouteMapComponentProps {
  stops: RouteStop[]
  onStopClick?: (stopId: string) => void
}

// Status colors: scheduled = primary blue, in_progress = amber (pulse),
// completed = green at 60% opacity
const STATUS_STYLE: Record<string, { color: string; opacity: number; pulse: boolean; label: string; badgeBg: string; badgeText: string }> = {
  scheduled: { color: "#2563eb", opacity: 1, pulse: false, label: "Scheduled", badgeBg: "#dbeafe", badgeText: "#1e40af" },
  in_progress: { color: "#f59e0b", opacity: 1, pulse: true, label: "In Progress", badgeBg: "#fef3c7", badgeText: "#92400e" },
  completed: { color: "#16a34a", opacity: 0.6, pulse: false, label: "Completed", badgeBg: "#dcfce7", badgeText: "#166534" },
}
const FALLBACK_STYLE = { color: "#6b7280", opacity: 1, pulse: false, label: "Other", badgeBg: "#f3f4f6", badgeText: "#374151" }

function formatTime(time: string): string {
  if (time.includes("AM") || time.includes("PM")) return time
  const [hours, minutes] = time.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

// Numbered circle marker in stop order, colored by status
const createStopIcon = (stopNumber: number, status: Appointment["status"]) => {
  const style = STATUS_STYLE[status] ?? FALLBACK_STYLE
  return L.divIcon({
    className: "route-stop-marker",
    html: `
      <div class="${style.pulse ? "stop-pulse" : ""}" style="
        width: 30px;
        height: 30px;
        background-color: ${style.color};
        opacity: ${style.opacity};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 13px;
        font-weight: bold;
      ">${stopNumber}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  })
}

// Fit the viewport to all stops whenever the route changes
function FitToStops({ stops }: { stops: RouteStop[] }) {
  const map = useMap()

  useEffect(() => {
    if (stops.length === 0) return
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
  }, [stops, map])

  return null
}

export default function RouteMapComponent({ stops, onStopClick }: RouteMapComponentProps) {
  // Phoenix metro center as default
  const defaultCenter: [number, number] = [33.4484, -112.0740]
  const defaultZoom = 10

  const routePositions = stops.map((s) => [s.lat, s.lng] as [number, number])

  return (
    <>
      <style jsx global>{`
        @keyframes stopPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
          }
        }
        .stop-pulse {
          animation: stopPulse 1.5s infinite;
        }
        .route-stop-marker {
          background: transparent;
          border: none;
        }
        .route-navigate-btn {
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
        .route-navigate-btn:hover {
          background-color: #1d4ed8;
        }
        .route-status-badge {
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
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Dashed route path through stops in visit order */}
        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#2563eb",
              weight: 3,
              opacity: 0.6,
              dashArray: "8 6",
            }}
          />
        )}

        {stops.map((stop, index) => {
          const style = STATUS_STYLE[stop.status] ?? FALLBACK_STYLE
          return (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={createStopIcon(index + 1, stop.status)}
              eventHandlers={{
                click: () => onStopClick?.(stop.id),
              }}
            >
              <Popup>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm">Stop #{index + 1}</span>
                    <span
                      className="route-status-badge"
                      style={{ backgroundColor: style.badgeBg, color: style.badgeText }}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-1">{stop.patientName}</p>
                  <p className="text-xs text-gray-600">{formatTime(stop.time)}</p>
                  <p className="text-xs text-gray-500 capitalize">{stop.type.replace("_", " ")}</p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="route-navigate-btn"
                  >
                    Navigate
                  </a>
                </div>
              </Popup>
            </Marker>
          )
        })}

        <FitToStops stops={stops} />
      </MapContainer>
    </>
  )
}
