"use client"

/**
 * Live-activity simulator for the Navigator Safety Map.
 *
 * While enabled, nudges every navigator whose DERIVED status is not
 * RISK_ALERT toward their next scheduled stop (fallback: random-walk
 * jitter), varying speed and draining battery. Movement ticks pass
 * `touchCheckIn: false` so pure position updates never stamp
 * `lastCheckIn` - otherwise stale-check-in alerts would self-heal while
 * pins move. Every 6th tick, ACTIVE navigators emit a real check-in.
 */

import { useEffect, useRef } from "react"
import { useDemoData } from "@/lib/demo-data-context"
import { deriveSafetyStatus } from "@/lib/safety-status"

const TICK_MS = 4000
const CHECKIN_EVERY_TICKS = 6
const STEP_DEG = 0.002
const BATTERY_DRAIN_PER_TICK = 0.2

export function useSafetySimulation(enabled: boolean) {
  const { navigatorLocations, scheduleEvents, appointments, sosEvents, updateNavigatorLocation } =
    useDemoData()

  // The interval reads live slices through refs so it never needs re-arming
  // (re-arming on every tick would reset the every-6th-tick cadence).
  const dataRef = useRef({ navigatorLocations, scheduleEvents, appointments, sosEvents })
  const updateRef = useRef(updateNavigatorLocation)
  useEffect(() => {
    dataRef.current = { navigatorLocations, scheduleEvents, appointments, sosEvents }
    updateRef.current = updateNavigatorLocation
  }, [navigatorLocations, scheduleEvents, appointments, sosEvents, updateNavigatorLocation])

  useEffect(() => {
    // SSR guard: intervals only make sense in the browser
    if (!enabled || typeof window === "undefined") return

    let tick = 0
    const interval = window.setInterval(() => {
      tick++
      const now = new Date()
      const { navigatorLocations, scheduleEvents, appointments, sosEvents } = dataRef.current

      navigatorLocations.forEach((loc) => {
        const status = deriveSafetyStatus(loc, scheduleEvents, appointments, sosEvents, now)
        // Never move a navigator in RISK_ALERT (John stays put for the demo)
        if (status === "RISK_ALERT") return

        // Steer toward the navigator's next scheduled event with coordinates
        const nextEvent = scheduleEvents
          .filter(
            (evt) =>
              evt.navigatorId === loc.navigatorId &&
              evt.location.lat != null &&
              evt.location.lng != null &&
              (evt.status === "SCHEDULED" || evt.status === "EN_ROUTE")
          )
          .sort((a, b) => a.startTime.localeCompare(b.startTime))[0]

        let lat: number
        let lng: number
        if (nextEvent?.location.lat != null && nextEvent.location.lng != null) {
          const dLat = nextEvent.location.lat - loc.lat
          const dLng = nextEvent.location.lng - loc.lng
          lat = loc.lat + Math.sign(dLat) * Math.min(Math.abs(dLat), STEP_DEG)
          lng = loc.lng + Math.sign(dLng) * Math.min(Math.abs(dLng), STEP_DEG)
        } else {
          // Random-walk jitter when there is no upcoming stop
          lat = loc.lat + (Math.random() - 0.5) * 2 * STEP_DEG
          lng = loc.lng + (Math.random() - 0.5) * 2 * STEP_DEG
        }

        const speed = Math.round(Math.random() * 35)
        const batteryLevel = Math.max(
          0,
          Math.round(((loc.batteryLevel ?? 100) - BATTERY_DRAIN_PER_TICK) * 10) / 10
        )
        // Every 6th tick, ACTIVE navigators emit a real check-in
        const emitCheckIn = tick % CHECKIN_EVERY_TICKS === 0 && status === "ACTIVE"

        updateRef.current(loc.navigatorId, lat, lng, {
          touchCheckIn: emitCheckIn,
          speed,
          batteryLevel,
        })
      })
    }, TICK_MS)

    return () => window.clearInterval(interval)
  }, [enabled])
}
