# Demo Walkthrough & Hands-On Testing Script

A single end-to-end script that exercises every feature of the platform in a
logical order, with expected results as checkboxes. Use it three ways:

- **Demo rehearsal** — follow Parts 1–9 in order; the Golden Thread (Part 2–4)
  is the core sales narrative.
- **Manual QA pass** — tick every checkbox; any miss is a regression.
- **Smoke test after changes** — run Part 0 (automated gates) plus whichever
  Part touches the code you changed.

The deeper per-feature protocols with demo talk tracks live alongside this
file: `QA_PROTOCOL_BILLING_BRIDGE.md`, `QA_PROTOCOL_SAFETY_MAP.md`,
`ENGINEERING_QA_CHECKLIST.md`.

---

## Part 0 — Setup & Automated Gates

**Setup**

1. `npm install`
2. Optional but recommended for the AI scribe: create `.env.local` with
   `GEMINI_API_KEY=<your key>`. Without it the scribe runs in clearly-labeled
   Demo Mode (that degraded path is itself tested in Part 4).
3. `npm run dev` → open http://localhost:3000 in **Chrome or Edge** (the Web
   Speech API needs a Chromium browser; everything else works anywhere).
4. Start from a clean slate: log in as **Admin (Alex Rivera)** → **Reset Demo
   Data** (top right) → confirm. You'll land back on the role selector.
   - ⚠️ State persists across refreshes now — reloading the page does NOT
     reset the demo. Always reset through Admin.

**Automated gates — all must pass before any hands-on session**

```
npx tsc --noEmit          # 0 errors
npm run lint              # 0 errors (warnings OK)
npm run verify:billing    # 21 blocks passed
npm run verify:safety-map # 12 passed
npm run verify:claims     # 43 passed
npm run build             # compiles
```

- [ ] All six commands green

---

## Part 1 — Referral Arrives (Supervisor: HL7 ingestion)

Log in as **Supervisor (Marcus Williams)** → sidebar **Referrals**.

1. Note the pending referral count.
2. Click **Simulate Incoming Referral** (⚡ toolbar button).
   - [ ] Toast: "New referral received from …" and a new referral appears at
         the top of the list
   - [ ] Selecting it shows a **raw HL7 message** (monospace block) above the
         structured PID/DG1/IN1/PV1 panels
3. Click **Paste HL7…** and paste any HL7v2 ADT message (copy the raw text
   from step 2's card if you don't have one). Click **Parse**.
   - [ ] Preview shows patient name, DOB, diagnosis + ICD codes, payer +
         member ID, ZIP, language, and an acuity badge
   - [ ] Deliberately mangle a segment (delete the IN1 line) and re-parse:
         amber **warnings** appear instead of a failure
   - [ ] Click **Ingest Referral** → it joins the pending list
4. Repeat "Simulate" a few times — the curated pool holds 12 personas
   including a Spanish speaker (Maria Garcia) and an L3 dialysis patient
   (Harold Simmons), and the feed **never re-produces anyone already in the
   system** (assigned patients and referrals of any status are excluded).
   Once the curated pool is used up, a combinatorial generator keeps
   producing unique people — you can run the ingest→assign loop back to back
   all day without resetting the database.
   - [ ] Simulate more referrals than you assign, repeatedly: no incoming
         referral ever duplicates an existing patient or queued referral

---

## Part 2 — Match & Assign (Supervisor: matching engine + intake)

Still on **Referrals**, select **Elena Rodriguez** (zip 85303, Spanish, L2).

1. Click **Match & Assign**.
   - [ ] All 11 navigators are ranked, not just 3
   - [ ] **Maria Gonzalez is #1**: "~4 mi" distance (computed, not hardcoded),
         "Spanish Speaker" credit, capacity headroom
   - [ ] **John Mitchell fails on distance** (~30 mi > his 20 mi radius,
         negative score) despite otherwise matching
   - [ ] An English-only navigator (e.g. Sarah Thompson) shows a **language
         hard-fail** for this Spanish-speaking patient
2. Assign to Maria.
   - [ ] Toast confirms; the referral leaves the pending queue; Maria's
         caseload increments (visible if you re-open Match & Assign for
         another referral)
3. Open the new patient's record (Supervisor → search the patient name in the
   **header search bar** → click the result).
   - [ ] Header search returns the patient; clicking navigates to their chart
4. On the patient chart, open the **Intake** form (Overview tab → intake card
   → button) and complete all 3 steps:
   - Step 1: pick PIN or CHI, set an **initiating visit date** — try a date
     13 months ago first:
     - [ ] Validation blocks it ("Referral Expired" / 12-month rule)
     - then set a recent date; check **consent** and **cost-share** boxes
   - Step 2: acuity domains — note the **barriers score is pre-suggested**
     when a risk assessment exists
   - Step 3: review → save
   - [ ] Toast confirms; patient's risk tier reflects the acuity level
5. From the chart, launch the **Assessment Wizard** (risk assessment card) and
   complete the 4 steps.
   - [ ] Live risk score updates as you toggle SDOH/clinical/mobility inputs
   - [ ] Saving writes an assessment note to the patient timeline

---

## Part 3 — Document the Visit (Navigator: AI scribe + timer)

Log in as **Navigator (Emily Rodriguez)**. (Reset note: Elena's assigned
navigator is Maria — for scribe testing just use any patient on Emily's
roster, e.g. James Thompson.)

1. Dashboard checks:
   - [ ] "Today's Appointments" shows real appointments dated **today**
   - [ ] Supervisor **nudge banners** appear (seeded nudges)
   - [ ] Header bell shows a real unread count
2. **My Patients** → open a patient → **Notes** tab → **Open Note Builder**.
3. Pick the recommended template. The **Encounter Timer** appears — click
   **Start**.
4. AI Recorder:
   - **With a mic:** click record and dictate a visit summary
     ("I visited the patient at home for about forty-five minutes…").
     - [ ] Live transcription appears; a toast offers to set the spoken
           duration
   - **Without a mic:** click **Load Sample** (flask icon) and pick one of the
     three canned transcripts.
5. Click **Generate Structured Note**.
   - **With `GEMINI_API_KEY`:**
     - [ ] Fields auto-fill; AI-filled fields carry a violet **AI** badge
     - [ ] Any fuzzy-matched field is amber with a **Confirm** button —
           signing is blocked until confirmed ("Confirm AI-suggested values
           before signing")
   - **Without the key:**
     - [ ] A persistent **amber Demo Mode banner** states values are canned
           demo data, not AI output — never a silent mislabel
6. **Degraded-mode drill** (do once): with a key configured, kill your network
   mid-generate.
   - [ ] **Red failure banner** with the error, a **Retry** button, and an
         explicit **"Use demo values instead"** option
7. **Crash-resilience drill** (do once): dictate/paste a transcript, wait ~2s,
   then refresh the browser and reopen the same patient + template.
   - [ ] A restore banner offers the unsaved dictation (Restore / Discard)
8. Stop the timer, confirm any flagged fields, review the generated narrative,
   and **sign/submit** the note.
   - [ ] Note appears in the Notes tab with **audit-proof start–end times**
         and timer provenance
   - [ ] A **verified time log** was created (it will appear in billing next)
9. Sidebar **Schedule**: create a new appointment that overlaps an existing
   one for the same patient.
   - [ ] Inline red conflict error; the Schedule button is blocked
   - [ ] Change the time: travel-time warnings (amber) allow scheduling
10. Switch the schedule to **map view**.
    - [ ] Real map (OpenStreetMap) with numbered stops in date+time order, a
          route line, and total miles/drive-time in the footer
    - [ ] A stop's popup has a **Navigate** link that opens Google Maps
          directions
11. **EVV**: check in to today's visit.
    - [ ] Browser asks for location; toast says "GPS verified" (or
          "approximate location" if denied — both acceptable)

---

## Part 4 — The Revenue Loop (Biller: claims lifecycle + EDI)

Log in as **Revenue Cycle Manager** (Biller). Keep the payer selector on
**Arizona Medicaid (H-Codes)** unless a step says otherwise.

1. Orientation:
   - [ ] Six metric cards including **Outstanding A/R** and **Paid** (both $0
         on a fresh reset)
   - [ ] Three tabs: **Ready to Bill / Needs Attention / Ledger**
2. **Needs Attention** tab — the guardrails:
   - [ ] **Mary Jenkins**: "Patient consent not documented" + missing ICD
         codes (she has no intake record — intentional)
   - [ ] **Frank Anderson**: "Unverified time (90 min) — supervisor review
         required" (seeded unverified log — unverified minutes can never
         reach export)
   - [ ] Switch payer to **Medicare PIN**: **Sam Underwood** appears with
         "Insufficient Time (45/60 mins)"; switch back to Medicaid and he's
         billable (Rule of Eights) — the same minutes, different payer rules
   - [ ] Click **Nudge** on any flagged claim → confirm → (verify later that
         the navigator received it)
3. **Ready to Bill** tab:
   - [ ] Current-month claims carry an amber **"In-progress month"** badge
   - [ ] Select all → **Export 837P**
   - [ ] One `.837` file downloads **per payer** (open one: `ISA*…`, real
         X12, org NPI, no placeholder provider names)
   - [ ] Exported claims leave the working tabs; **Outstanding A/R** rises;
         the Ledger tab badge counts them
4. **Double-billing guard**: switch the payer selector to Medicare PIN.
   - [ ] The exported patient-months do **NOT** reappear as exportable
5. **Ledger** tab:
   - [ ] Rows show status chips (EXPORTED), billed amounts, codes
   - [ ] Expand a row: full status-history timeline
   - [ ] Row action **Simulate Clearinghouse** → ~1s → chip becomes
         **ACCEPTED** (a claim with a UNK-prefixed member ID would be
         REJECTED with a reason)
6. **835 remittance round trip**:
   - [ ] **Generate Sample 835** → file downloads → toast offers **Import
         now** → import dialog opens pre-loaded → **Parse**
   - [ ] Preview shows matched payments with PAID/DENIED chips and CARC codes
   - [ ] **Apply** → toast "N payments applied, 0 unmatched"; chips update;
         **Paid** metric rises; expanded rows show paid/charged amounts and
         CARC/RARC codes with dictionary tooltips
7. **Honest duplicate handling**: Generate Sample 835 again → Import → Parse.
   - [ ] Everything shows as **unmatched** (records are terminal); applying
         reports **0 applied** — never a false success
8. **Denial → rebill**: find a DENIED row (the MIXED sample denies ~15%; rerun
   the sample loop if needed).
   - [ ] **Reopen for Rebill** voids the record and the patient-month returns
         to the working tabs
9. **Post-export activity guard**: as the Navigator, sign another timed note
   for a patient whose claim you exported; return to the Biller.
   - [ ] Amber **"Unbilled activity since export"** banner names the patient
         and the new minutes, with a **Reopen for rebill** button
10. **Manual payment**: on an ACCEPTED row → **Record Manual Payment** →
    enter an amount.
    - [ ] Row goes PAID and the **Paid column shows the amount** (not "—");
          the Paid metric includes it

---

## Part 5 — Field Safety (Supervisor: safety map + SOS)

Log in as **Supervisor** → **Safety Map**.

1. Baseline:
   - [ ] Real Phoenix map with 3 pins: Maria **green/pulsing (ACTIVE)**, John
         **red/pulsing with "!" (RISK ALERT)**, Sarah **gray (IDLE)**
   - [ ] John's popup: high-acuity visit, last check-in ~2 hours ago, low
         battery — his alert is **derived by rules** (high-risk visit >60 min
         without checkout / no check-in >90 min), not a stored flag
   - [ ] **Call Now** in a popup is a real `tel:` link
2. Toggle **Simulate live activity**.
   - [ ] Maria/Sarah's pins drift and speeds change every few seconds
   - [ ] **John never moves and never self-heals** — stale-alert integrity
3. **SOS end-to-end**: in a second browser tab, log in as **Navigator** →
   dashboard → red **SOS** button → confirm (allow location).
   - [ ] Navigator sees "SOS sent to supervisor"
   - [ ] Supervisor tab: deep-red pulsing **SOS alarm banner** with the
         navigator's name; their pin gains an SOS ring
   - [ ] **Acknowledge** subdues the banner; **Resolve** clears it; both
         appear in the Admin audit log
4. **EVV on the map**: with the navigator tab, check in to a visit (Part 3
   step 11).
   - [ ] The supervisor map reflects the check-in (task/position update)

---

## Part 6 — Supervisor Oversight

1. **Overview**: KPI cards, compliance gauges, navigator scorecards,
   adverse-event tracking — all against live data.
2. **Navigators** directory:
   - [ ] **Avg visit time** shows real values or "—" (never random)
   - [ ] Drill into a navigator: real phone/email, region from their
         supervisor record, roster, compliance gaps, nudge history
3. **Team Schedule**:
   - [ ] Calendar shows the whole team (no 6-navigator cap)
   - [ ] **Add Shift**: create a shift overlapping an existing one for the
         same navigator → inline red conflict blocks submit
   - [ ] Buttons read **"Save as Draft"** / **"Add and Publish Shift"** and
         publish semantics are correct (published shifts appear on the
         navigator's schedule)
4. **Compliance** and **Adverse Events** views render team-scoped live data;
   care-team contacts resolve real names with working `tel:` links.

---

## Part 7 — Patient Portal

From the role selector, click a **patient card** (James Thompson or Elena
Rodriguez) — it logs in as that specific patient.

1. - [ ] **My Health**: greeting, care-navigator contact card, upcoming
         appointments (real dates), medications
2. - [ ] **My Profile**: health goals come from the patient's real care plan;
         a patient without one sees "No active care plan goals yet…" (honest
         empty state, not fake goals)
3. - [ ] **Medications**: per-medication 7-dot weekly grid with the caption
         "Estimated from your medication refill compliance — not a daily log"
4. - [ ] **Appointments**: request a reschedule → chat opens pre-filled to
         the navigator
5. - [ ] **Messages**: patient can message only their navigator

---

## Part 8 — Messaging & Nudge Integrity

1. As **Supervisor** → Messages:
   - [ ] Contact list shows **all 6** team navigators
2. Send a **nudge** from a patient chart (or use the biller nudge from Part
   4.2), then log in as the target **Navigator**:
   - [ ] Nudge banner on the dashboard; header bell counts it
   - [ ] Open the chat thread with the supervisor and read an unrelated
         message: **the nudge stays unread** (banner/count unchanged)
   - [ ] Click **View Patient Record** on the nudge (in chat) or dismiss it
         on the dashboard: **now** it clears — nudges require explicit action

---

## Part 9 — Executive & Admin

1. **Executive (Dr. Sarah Chen)** → Overview:
   - [ ] "Est. Revenue (current month)" is a **computed** figure with a
         claims/visits breakdown — it moves after Part 4 (compare before and
         after an export/payment cycle if you want proof)
   - [ ] Daily units chart, referral sources, health-plan revenue, and
         performance tiers all derive from live data
   - [ ] Known limitation: **Revenue / Performance / Patients** menu items
         are "Coming Soon" placeholders
   - [ ] **Revenue Cycle Manager** is reachable from the executive sidebar
2. **Admin (Alex Rivera)**:
   - [ ] Sidebar **Payer Rates** and **Audit Log** actually switch tabs
   - [ ] Edit a payer rate → executive revenue reflects it; the change is
         audit-logged
   - [ ] **Remark Codes**: add a CARC code → it appears in ledger tooltips
   - [ ] **Organization**: edit the supervising provider → subsequent CSV/
         837P exports carry the new name/NPI
   - [ ] **Audit Log** shows the session's trail: referral ingestion,
         assignments, notes, claim exports, remittance, SOS lifecycle
3. Finish: **Reset Demo Data** to leave the environment clean.
   - [ ] Everything returns to seed state; role selector reappears

---

## Appendix — Known Demo Constraints

- No backend: state is one browser's localStorage. Two tabs share it (that's
  how the SOS drill works); two machines don't.
- Clearinghouse, HL7 feed, and geocoding are simulators behind adapter
  interfaces — the demo loop is fully self-contained by design.
- The scribe needs Chrome/Edge for live dictation; Load Sample covers other
  browsers.
- Seed dates rebase to "today" on each fresh load, so the demo never looks
  stale; DOBs and enrollment dates stay fixed.
