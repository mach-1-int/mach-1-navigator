# QA Protocol: The Safety Map

**Objective:** Verify that the Supervisor can identify risks immediately.

> **Automated gate first:** `npm run verify:safety-map` (12 checks — seed/derivation consistency, SOS-forces-alert) must be green before any hands-on pass here.

---

## Test Scenario 1: The "Bird's Eye" View

**Goal:** Confirm the map shows Phoenix metro with at least three distinct pins (Glendale, Mesa, Downtown).

- [ ] **1. Action:** Log in as **Supervisor** (Marcus Williams). Open the **Safety Map** tab from the sidebar.
- [ ] **2. Verify:**
  - Do you see a **map of Phoenix** (OpenStreetMap tiles, Phoenix metro area)?
  - Do you see **at least 3 distinct pins**?
- [ ] **3. Check:** Is there a pin in **Glendale (West)**, **Mesa (East)**, and **Downtown**?
  - **Glendale (West):** Green pin – Maria Gonzalez.
  - **Mesa (East):** Red pin – John Mitchell (Risk Alert).
  - **Downtown:** Gray/amber pin – Sarah Thompson.
- [ ] **4. Demo Talk Track:** *"Vivian, instead of calling 30 people to ask 'Where are you?', you just look at this screen. It covers the entire metro area."*

---

## Test Scenario 2: The "Risk Alert" (The Red Pin)

**Goal:** Verify the red pin is pulsing and the popup shows Status: RISK ALERT and Last Check-in: 2 hours ago.

- [ ] **1. Action:** Locate the **Red Pin** (John Mitchell).
- [ ] **2. Verify:** Is it **pulsing/highlighted**?
- [ ] **3. Action:** Click the pin to open the **Popup**.
- [ ] **4. Check:**
  - Does it say **"Status: RISK ALERT"**?
  - Does it show **"Last Check-in: 2 hours ago"**?
- [ ] **5. Demo Talk Track:** *"The system derives John's alert from a high-risk check-in with no checkout after 60 minutes — this is a live rule, not a flag. Every status on this screen is computed from check-in age, movement, visit risk, and SOS events (see `lib/safety-status.ts`), so you intervene the moment a rule fires."*

---

## Test Scenario 3: The "Find Navigator" Action

**Goal:** Verify clicking a navigator in the sidebar pans the map to their pin.

- [ ] **1. Action:** Look at the **Sidebar List** (left panel – "Field Team").
- [ ] **2. Action:** Click on **"Maria Gonzalez"** (who is in Glendale – West).
- [ ] **3. Verify:** Does the map **smoothly animate/pan** to center on her **Green** pin?
- [ ] **4. Demo Talk Track:** *"If you need to find someone specifically, just click their name. You see exactly what task they are working on."*

---

## Test Scenario 4: Live Simulation Toggle

**Goal:** Verify the "Simulate live activity" switch animates the fleet without breaking alerts.

- [ ] **1. Action:** In the **Team Status** card (left panel), flip on **"Simulate live activity"** (default off).
- [ ] **2. Verify (within ~10 seconds):**
  - Maria's and Sarah's pins **move** every few seconds (toward their next scheduled stop, or drifting slightly), speed and battery values change.
  - **John's red pin does NOT move** — navigators in RISK_ALERT are never simulated.
- [ ] **3. Check:** John's **"Last Check-in: 2 hours ago"** stays stale while pins move. Movement ticks do NOT count as check-ins (only every 6th tick emits a real check-in for ACTIVE navigators), so risk alerts never self-heal.
- [ ] **4. Action:** Flip the switch off. Movement stops; the **Refresh** button still re-derives every status against the current clock.

---

## Test Scenario 5: SOS End-to-End

**Goal:** Verify a navigator's SOS reaches the supervisor and can be acknowledged and resolved.

- [ ] **1. Action:** Switch to the **Navigator** role. On the dashboard header (or the Schedule toolbar), click the red **SOS** button.
- [ ] **2. Verify:** A confirmation dialog asks *"Send an emergency alert to your supervisor with your current location?"*. Confirm it. A toast shows **"SOS sent to supervisor"**. (The browser may prompt for location; denial is fine — the last known location is used.)
- [ ] **3. Action:** Switch to the **Supervisor** role → **Safety Map**.
- [ ] **4. Verify:**
  - A **deep-red pulsing SOS banner** with a siren icon sits ABOVE the risk banner, naming the navigator and how long ago it fired.
  - The navigator's map pin shows an **expanding red ring and an "SOS" badge**; its popup says **"SOS ACTIVE — acknowledge in the sidebar"**.
  - The navigator's derived status is **RISK_ALERT** (an unresolved SOS always wins).
- [ ] **5. Action:** Click **Acknowledge**. The banner turns subdued and records who acknowledged it, with a **Resolve** button.
- [ ] **6. Action:** Click **Resolve**. The banner clears and the navigator's status re-derives from normal rules.

---

## Test Scenario 6: EVV Check-In Appears on the Map

**Goal:** Verify a field check-in updates the supervisor safety map in real time.

- [ ] **1. Action:** As **Navigator**, open **Schedule**, click a `scheduled` appointment and press **Check In**.
- [ ] **2. Verify:** Toast says **"Checked in (GPS verified)"** (real device GPS) or **"Checked in (approximate location — GPS unavailable)"** (fallback to the patient's coordinates).
- [ ] **3. Action:** Switch to **Supervisor** → **Safety Map**.
- [ ] **4. Verify:** The navigator's pin sits at the check-in location, the card shows the task **"Home Visit: [patient name]"**, and **"Last Check-in"** reads **"Just now"** — EVV check-ins are real check-ins and reset the check-in clock.

---

## Test Scenario 7: Zone Overlays & Zone Filter

**Goal:** Verify Gellert's coverage zones render on the map and the Field Team list filters by zone.

- [ ] **1. Action:** In the **Field Team** card header (left panel), flip the **"Show zones"** switch (layers icon).
- [ ] **2. Verify:**
  - Semi-transparent colored **circles** appear over the metro — one per seeded zone: **Central Phoenix, North Phoenix, West Valley, East Valley, Tempe / Scottsdale, South Phoenix** (6 zones seeded; Gellert runs 11).
  - A **"Coverage Zones"** legend renders on the map with each zone's color and name.
  - Shapes are honest **circle approximations** (zip-centroid + padded radius) — real polygons come with a real geo provider. This is a talking point, not a bug.
- [ ] **3. Action:** Use the zone dropdown next to the switch (default **"All zones"**) and pick **West Valley**.
- [ ] **4. Verify:**
  - The **Field Team list narrows to Maria Gonzalez** (the only seeded field navigator in West Valley); with zones shown, only the **West Valley circle** stays on the map.
  - Map **pins are NOT hidden** by the filter — it scopes the sidebar list and the zone shapes, never the live safety picture.
  - Pick **East Valley** → the list shows only **John Mitchell**; **Central Phoenix** → only **Sarah Thompson**. A zone with no located navigator shows **"No navigators assigned to this zone"**.
- [ ] **5. Reset:** Set the filter back to **All zones** and flip **Show zones** off — the map returns to Scenario 1's baseline.
- [ ] **6. Demo Talk Track:** *"Mitch, these are your coverage zones drawn onto the live safety picture — who covers where, and who's actually out there right now. The weekly manual join of zones to people is now a toggle."*

---

## Troubleshooting: Maps

| Issue | What to check |
|-------|----------------|
| **Map looks broken / grey tiles** | A global CSS fix for Leaflet is in `app/globals.css`: `.leaflet-container { width: 100%; height: 100%; min-height: 400px; z-index: 1; }`. If tiles still fail, ensure `leaflet/dist/leaflet.css` is imported where the map is used. |
| **Markers missing or wrong** | The app uses **divIcon** (CSS circles), not default Leaflet marker images, to avoid asset loading issues in Next.js. Green = Active, Red = Risk Alert, Gray = Idle. |
| **Only 1–2 pins visible** | Seed data has three navigators: Maria (Glendale), John (Mesa), Sarah (Downtown). Ensure you're on the **Supervisor** role and that `navigatorLocations` is loaded from the store/demo context. |
| **"Last Check-in" shows wrong time** | Popup uses relative time (e.g. "2 hours ago"). John's seed `lastCheckIn` is set to 2 hours ago; if you see "1 hour ago" or "3 hours ago", the demo data may have been changed or the clock shifted. |
| **Map doesn't pan when clicking sidebar** | The map uses a `FlyToLocation` component keyed by `selectedNavigatorId`. Clicking a card in the left list should set selection and trigger `map.flyTo()`. If it doesn't, check that the Safety Map is using the same `selectedNavigatorId` state for both the list and the map. |

---

## Quick Reference: Seed Data

Statuses below are **derived live** by `deriveSafetyStatus` (`lib/safety-status.ts`) — the seeded values are only a snapshot that the rules reproduce. Rules: unresolved SOS → RISK_ALERT; high-risk visit overdue 60+ min → RISK_ALERT; check-in older than 90 min → RISK_ALERT; stationary with check-in 15+ min old → IDLE; else ACTIVE.

| Navigator       | Location   | Status     | Last Check-in | Pin color |
|----------------|------------|------------|----------------|-----------|
| Maria Gonzalez | Glendale   | ACTIVE     | 10 mins ago    | Green     |
| John Mitchell  | Mesa       | RISK_ALERT | 2 hours ago    | Red       |
| Sarah Thompson | Downtown   | IDLE       | 20 mins ago    | Gray      |

**Role:** Supervisor (Marcus Williams) → Sidebar → **Safety Map**.

**Zones:** Maria — West Valley · John — East Valley · Sarah — Central Phoenix (`zoneId` on their user attributes; overlays/filter in Scenario 7).

**Note:** The **"Call Now"** button in a pin's popup is a real `tel:` link — it opens the device dialer with the navigator's phone number (hidden when no phone is on file).
