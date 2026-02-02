# QA Protocol: The Safety Map

**Objective:** Verify that the Supervisor can identify risks immediately.

---

## Test Scenario 1: The "Bird's Eye" View

**Goal:** Confirm the map shows Phoenix metro with at least three distinct pins (Glendale, Mesa, Downtown).

- [ ] **1. Action:** Log in as **Supervisor** (Vivian). Open the **Safety Map** tab from the sidebar.
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
- [ ] **5. Demo Talk Track:** *"The system flagged John automatically because he checked into a high-risk home visit 2 hours ago and hasn't checked out. This allows you to intervene instantly."*

---

## Test Scenario 3: The "Find Navigator" Action

**Goal:** Verify clicking a navigator in the sidebar pans the map to their pin.

- [ ] **1. Action:** Look at the **Sidebar List** (left panel – "Field Team").
- [ ] **2. Action:** Click on **"Maria Gonzalez"** (who is in Glendale – West).
- [ ] **3. Verify:** Does the map **smoothly animate/pan** to center on her **Green** pin?
- [ ] **4. Demo Talk Track:** *"If you need to find someone specifically, just click their name. You see exactly what task they are working on."*

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

| Navigator       | Location   | Status     | Last Check-in | Pin color |
|----------------|------------|------------|----------------|-----------|
| Maria Gonzalez | Glendale   | ACTIVE     | 10 mins ago    | Green     |
| John Mitchell  | Mesa       | RISK_ALERT | 2 hours ago    | Red       |
| Sarah Thompson | Downtown   | IDLE       | 5 mins ago     | Gray      |

**Role:** Supervisor (Vivian) → Sidebar → **Safety Map**.
