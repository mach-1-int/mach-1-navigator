# Demo Walkthrough & Hands-On Testing Script

A single end-to-end script that exercises every feature of the platform in a
logical order, with expected results as checkboxes. Use it three ways:

- **Demo rehearsal** — follow Parts 1–9 in order for the platform tour; the
  Golden Thread (Parts 2–4) is the core lifecycle. **Parts 10–15 are the six
  Gellert beats** from the logic-transplant blitz ("you handed us your manual
  and your workflow map; days later the system enforces your manual and runs
  your workflow"). **Parts 16–22 are the seven Ops Blitz beats** ("you handed
  us your manual's remaining sections; days later the system runs your
  engagement cadence, your escalation loop, and your training program too") —
  all can be run standalone after a reset.
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
npm run verify:journey    # 5 passed + 9 passed (runs two scripts)
npm run verify:notes      # 7 passed
npm run verify:gellert    # 12 passed
npm run verify:ops        # chains 8 scripts, 67 blocks passed total:
                           #   verify-gellert-ops (10) + verify-ops-templates (6)
                           #   + verify-ops-documents (6) + verify-ops-tasks (10)
                           #   + verify-ops-escalations (6) + verify-ops-meds (6)
                           #   + verify-ops-comms (3) + verify-ops-onboarding (5)
npm run build             # compiles
```

- [ ] All ten commands green

---

## Part 1 — Referral Arrives (Supervisor: HL7 ingestion)

Log in as **Supervisor (Marcus Williams)** → sidebar **Referral CRM**.

1. Orientation: two tabs, **Pipeline** and **Funnel**. The pipeline list shows
   every referral with a status chip (Received / Accepted — Contact Due /
   Outreach / Agreed / Intake Scheduled / Converted / Ineligible /
   Unreachable / Declined).
2. Click **Simulate Incoming Referral** (⚡ toolbar button).
   - [ ] Toast: "New referral received from …" and a new referral appears
         with a **Received** chip
   - [ ] Selecting it shows a **raw HL7 message** (monospace block) with the
         structured PID/DG1/IN1/PV1 panels, and the right pane is the
         **Eligibility Review** decision tree (worked in Part 10)
3. Click **Paste HL7…** and paste any HL7v2 ADT message (copy the raw text
   from step 2's card if you don't have one). Click **Parse**.
   - [ ] Preview shows patient name, DOB, diagnosis + ICD codes, payer +
         member ID, ZIP, language, and an acuity badge
   - [ ] Deliberately mangle a segment (delete the IN1 line) and re-parse:
         amber **warnings** appear instead of a failure
   - [ ] Click **Ingest Referral** → it joins the pipeline as **Received**
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

## Part 2 — Match & Assign (Supervisor: matching engine + conversion)

The pipeline gates assignment: **Match & Assign appears only once a referral
reaches Agreed** — patients are created only when they accept services
(Gellert's own rule). Part 10 walks the full Received→Agreed pipeline; for a
quick assignment, use the seeded agreed referral.

Still on **Referral CRM**, select **David Jones** (Agreed chip — ESRD/CHF,
L3, zip 85001).

1. Click **Match & Assign** (button on the card).
   - [ ] All 11 navigators are ranked, not just 3
   - [ ] Distances read "~X mi" (computed from zip centroids, not hardcoded)
   - [ ] Navigators who share the referral's coverage zone carry a **zone
         chip** and a "Zone match: … +15 pts" reason; others show a
         cross-zone note
   - [ ] A **Spanish-speaking referral** (simulate Maria Garcia in Part 10)
         shows Spanish-speaker credit for bilingual navigators and a
         **language hard-fail** for English-only ones
   - [ ] Sanity check the guard: select a Received/Outreach referral — no
         Match & Assign button exists for it (the workspace itself also
         carries an amber guard banner if reached with a non-agreed referral)
2. Assign the top-ranked navigator.
   - [ ] Toast confirms; the referral chip flips to **Converted**; the
         right pane becomes a read-only "Converted to Patient" summary with a
         link to the new chart
3. Open the new patient's record (Supervisor → search the patient name in the
   **header search bar** → click the result).
   - [ ] Header search returns the patient; clicking navigates to their chart
   - [ ] The chart header carries an **Intake** journey-phase chip; the
         **Journey** tab shows the Intake 1 checklist and a **PCP due**
         countdown (7 business days, stamped at conversion — worked in
         Part 10)
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
   - [ ] Four tabs: **Ready to Bill / Needs Attention / Denials / Ledger**
         (the Denials work queue is exercised in Part 13)
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
   - [ ] **Generate Sample 835** is now a dropdown — pick **Standard remit
         (mixed)** → file downloads → toast offers **Import now** → import
         dialog opens pre-loaded → **Parse** (the **UHC DAP scenario** item
         is the Part 13 beat)
   - [ ] Preview shows matched payments with PAID/DENIED chips and CARC codes
   - [ ] **Apply** → toast "N payments applied, 0 unmatched"; chips update;
         **Paid** metric rises; expanded rows show paid/charged amounts and
         CARC/RARC codes with dictionary tooltips
7. **Honest duplicate handling**: generate the same mixed sample again →
   Import → Parse.
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
   - [ ] Daily units chart, referral sources, health-plan revenue, a compact
         **referral funnel** card, and performance tiers all derive from
         live data
   - [ ] **Revenue / Performance / Patients** menu items open real computed
         views (they were placeholders before the Gellert blitz — exercised
         in Part 14)
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

## Part 10 — Gellert Beat 1: The Workflow Map, Running

*The WorkFlow2025 page, live: referral → eligibility → outreach → agreement →
zone-aware assignment → intake → active navigation.* Best on a fresh reset.

Log in as **Supervisor (Marcus Williams)** → **Referral CRM**.

1. Click **Simulate Incoming Referral**.
   - [ ] On a fresh page load after a reset, the first simulated persona is
         **Maria Garcia** (Spanish speaker, Mercy Care, zip 85031) — the
         rotation is in-memory, so simulate earlier in the session and you'll
         get the next persona instead; any of them works for this beat
   - [ ] She lands in the pipeline as **Received**
2. Select her — the right pane is the **Eligibility Review** (5-gate
   short-circuit decision tree).
   - Answer the first gate **No** (don't submit):
     - [ ] "Ineligible at gate 1" banner names the mapped reason (Insurance
           not verified); the button reads **Close as Ineligible & Notify
           Referring Provider**; copy states no patient record is created
     - Flip the answer back to **Yes**
   - Answer all five gates **Yes**:
     - [ ] Panel notes "Accepting starts the 24–48h first-contact SLA clock"
     - [ ] Click **Accept — 48h Contact Clock Starts** → chip becomes
           **Accepted — Contact Due** with a green SLA countdown chip
3. The seeded pipeline shows both ends of the clock (dates rebase to "today"
   on every load):
   - [ ] **William Anderson**: red **"SLA breached"** chip (accepted 3 days
         ago, zero contact)
   - [ ] **George Taylor**: **Outreach** with a **3/7** attempts badge
4. Back on Maria Garcia — the right pane is now the **Outreach Log** (7
   attempt slots, auto-close at 7).
   - Log an attempt with disposition "No answer":
     - [ ] Attempt 1/7 records with channel + disposition; status flips to
           **Outreach**
   - Click **Patient Agreed**:
     - [ ] Status flips to **Agreed**; a **Match & Assign** button appears
5. **Match & Assign** → all 11 navigators ranked; zone chips + "Zone match …
   +15 pts" reasons; with Maria Garcia, Spanish-speaker credit vs language
   hard-fails → assign the top match.
   - [ ] The patient record is created only NOW — at agreement + assignment,
         never at referral receipt (Gellert's rule: no data on non-patients)
6. Open the new patient (header search) → **Journey** tab.
   - [ ] Header chip reads **Intake**; the **Intake 1 checklist** (8 items:
         onboarding packet, ROI, med reconciliation, health history,
         provider list, risk screening, photo, PCP scheduled) is empty
   - [ ] A **PCP due** badge counts down 7 business days from conversion
   - [ ] Check every Intake 1 item → **Complete Intake 1** activates
   - [ ] Intake 2's button reads **Complete Intake 2 → Active Navigation** —
         completing it flips the patient to Active
7. The no-show protocol, on the seeded intake patients:
   - [ ] **Walter Briggs** (Intake 2 scheduled) already carries **2
         no-shows**; his checklist warns that one more triggers the closure
         protocol
   - [ ] Click **Record No-Show** → the **"Third no-show — closure
         protocol"** confirmation dialog; confirming exits him **MIA**
         (skip or confirm — reset restores him)
   - [ ] **Rosa Delgado** shows a clean Intake 1 in progress
8. Sidebar **Journey Board**.
   - [ ] Kanban columns for the four phases — Intake / Active Navigation /
         Telenavigation / Exited — with every patient as a card; open
         adverse events badge their cards (derived overlay, never a stored
         phase); clicking a card opens the chart
9. **Referral CRM → Funnel** tab.
   - [ ] Funnel bars across the pipeline; the source scorecard shows
         **St. Joseph's as the dominant referrer**; conversion sits ~25%
         (Gellert reality: 20–30% — verify:journey locks the seed to that
         band)

---

## Part 11 — Gellert Beat 2: The Manual, Enforcing Itself

*Appointment type is known at scheduling time, so the right template — and
the right rules — are pre-selected.*

Log in as **Navigator (Emily Rodriguez)** → **Schedule**.

1. **New Appointment** for **James Thompson**: pick a time, and set
   **Encounter Type = Medical Appointment**.
   - [ ] The field's caption states it pre-selects the matching Gellert note
         template
2. Click the new appointment → detail dialog.
   - [ ] Shows "Encounter: Medical Appointment" and a **Document Visit**
         button
3. Click **Document Visit**.
   - [ ] The note builder opens with **Medical Appointment ± Transit**
         already selected — no template hunting
   - [ ] **Provider fields arrive pre-filled** with a sky-blue "Auto-filled
         from chart — Provider directory" badge: Dr. Jane Smith, Desert
         Family Medicine, 4045 W Main St (James's directory-linked PCP) —
         the cut-and-paste killer
   - [ ] Fields the manual forbids skipping carry a **Never skip** badge
4. Start the **Encounter Timer**. Open the AI Recorder's **Load Sample**
   (flask icon).
   - [ ] The sample list is filtered to this template — pick **"PCP Visit
         with Transit"**
5. **Generate Structured Note**.
   - [ ] Fields fill (violet **AI** badges with a key; labeled Demo Mode
         without one); times land in the manual's **H:MMAM/PM** format
         (10:05AM, not "10:05 am")
6. The **Manual Compliance panel** (right side) renders the full rule
   checklist with expandable citations from Gellert's own manual.
   - [ ] "Patient involvement documented" cites **"NO PATIENT INVOLVEMENT =
         NO BILLING"**
   - Clear the patient-involvement field:
     - [ ] The rule flips to a red **fail**; the footer reads "Resolve
           manual-compliance failures to sign"; the save button disables —
           the manual is the gate, not a suggestion
     - Restore the field (re-generate or retype) → rule passes again
   - [ ] "Closes with the day total" enforces a literal "Total = X minutes."
         that must match the timer
7. Stop the timer, confirm any flagged fields, review the third-person
   narrative, and click **Save Note & Time Log**.
   - [ ] The signed note creates a verified time log (billing sees it in
         Part 12)
8. Bonus checks (any patient chart → Notes):
   - [ ] **Supervision notes** are pinned at the top of the record and the
         clinical feed with amber badging — never buried
   - [ ] A second billable note on the same patient-day shows a **same-day
         continuation** banner: it links to the primary note and creates
         **no** second time log (the day total lives once)

---

## Part 12 — Gellert Beat 3: Sonya's Day-Close

*The face sheet you can't lose — miss printing nothing, ever.*

Stay logged in as **Navigator (Emily Rodriguez)** → dashboard.

1. Scroll to **Today's Charge Slips** (below the progress card).
   - [ ] One row per patient with today's minutes and **per-day Rule of
         Eights units** — derived from time logs, so it can't drift from
         billing
   - [ ] **Helen Garcia's row is amber**: "6 min — below the 8-minute
         billable minimum. Stack activities for this patient into one visit
         window…" — the coaching hint, 0 units (the seeded 6-minute
         patient-day)
   - [ ] The note signed in Part 11 appears in James Thompson's slip
2. Click **Sign & Submit Day**.
   - [ ] Per-slip toasts (patient — minutes = units + billing code), then a
         "Day closed" toast: N charge slips signed — X daily units submitted
   - [ ] The panel flips to its **Day closed** state; signing is idempotent
         (verify:gellert locks this)
3. Honest math note (a demo talking point, not a bug): daily charge-slip
   units and monthly claim units legitimately diverge under per-day vs
   per-month Rule of Eights — UI copy always says **"daily units (charge
   slips)"** vs **"claim units"**.
   - [ ] Biller → Ready to Bill rows show an informational "N unsigned
         slip-days" badge — never a validation block

---

## Part 13 — Gellert Beat 4: The DAP Remit (UHC's False Denial, Fixed)

*Sonya's exact pain: UHC changed the remark code identifying the 1% DAP
incentive, and AMD posts the payments as denials. Here it pends, classifies,
and reprocesses in about 60 seconds.*

Prerequisite: claims exist in the Ledger — run Part 4 steps 3 and 5 first
(Export 837P → Simulate Clearinghouse to ACCEPTED).

Log in as **Revenue Cycle Manager** → **Ledger** tab.

1. **Generate Sample 835** dropdown → **UHC DAP scenario (unknown incentive
   code)**.
   - [ ] Toast: "UHC DAP sample 835 generated for N claims" → **Import now**
   - [ ] The generated 835 pays every claim at **101% of billed** with a
         negative CO-144 adjustment and remark N807 — codes the seed
         dictionary deliberately does NOT contain
2. Import dialog → **Parse**.
   - [ ] Matched rows highlight amber: "Unknown remark codes: 144, N807 —
         will pend for review"
3. **Apply**.
   - [ ] Toast: "0 payments applied, N pended for review, 0 unmatched" —
         nothing misposts as a denial
   - [ ] Ledger shows amber **Needs Review** badges and a "N pended for
         review" chip; the status filter gains a **Needs Review** option
4. Expand a pended row → **"Remittance pended for review"** block.
   - [ ] Shows the held resolution (PAID at $X vs billed $Y) and each
         unknown code with an **Add code to dictionary** button
   - Click it for **144** → the inline **Add Code to Dictionary** dialog →
     set classification **Adjustment** → **Add to Dictionary**. Repeat for
     **N807** (classification Informational fits) — the biller never leaves
     the ledger
5. Click **Reprocess pended remits**.
   - [ ] Toast: "N pended remittances posted"
   - [ ] Rows go **PAID** with a green **+1% DAP** badge next to the paid
         amount (101% of billed)
6. Downstream proof:
   - [ ] Executive → **Revenue** view: the **"DAP Incentive Recovered
         (CARC 144)"** callout totals the recovered increment
   - [ ] Admin → Remark Codes: 144/N807 now sit in the dictionary with their
         classification (one-click maintenance, Sonya's manual-dictionary
         pain reduced to a single dialog)
   - [ ] Regression: a **Standard remit (mixed)** import never pends —
         verify:gellert locks it

---

## Part 14 — Gellert Beat 5: One NPI, Eleven Navigators

*AMD reports by provider; Gellert has one NPI. These three views are the
per-navigator reporting that single-NPI billing can't produce today.*

Log in as **Executive (Dr. Sarah Chen)**.

1. Sidebar **Performance**.
   - [ ] Per-navigator productivity table: **avg units/day vs level targets
         (L1 16 · L2 18 · L3 20)** with attainment, trend sparklines, and
         day-close rate — computed from the same charge-slip derivation the
         navigators sign, so productivity and billing can never disagree
   - [ ] A **"Windshield time (unbillable)"** column — Mitch's named margin
         lever, computed from consecutive same-day stops
   - [ ] The Playbook KPI list: 48h referral acceptance, units/day
         attainment, daily-billing-by-EOD, PCP compliance, post-discharge
         follow-up, no-show rate, ED trend — all computed; **"Patient Guide
         by Friday 4pm"** renders as an honest labeled placeholder ("signal
         not yet captured") because that module doesn't exist yet
2. Sidebar **Revenue**.
   - [ ] Collections vs billed, denial rate, Outstanding A/R with aging
         buckets, payer mix, caseload distribution, referrals by acuity —
         and the DAP callout from Part 13
3. Sidebar **Patients** (Vivi's minable-data ask).
   - [ ] **Condition click-boxes** (ICD-prefix cohorts — diabetes, heart
         failure, CKD, behavioral health…), risk-tier distribution, and
         SDOH barrier prevalence from documented Z-codes
   - [ ] Clicking any cohort filters an inline patient list — structured
         answers to "how many diabetic patients, how many visits", not
         prose

---

## Part 15 — Gellert Beat 6: Graduation, Telenavigation, Exit

*WorkFlow2025 phases 5–6: graduate, keep a monthly line in, re-engage or
exit through the five documented pathways.*

1. **Flag readiness** — as **Navigator (Emily Rodriguez)**, open **James
   Thompson** → **Journey** tab → Graduation & Program Status card.
   - [ ] Click **Flag Graduation Readiness**, add a note → amber "awaiting
         supervisor confirmation" banner; the navigator role sees "Only a
         supervisor can confirm graduation"
2. **Confirm** — as **Supervisor**, open the same patient → Journey tab.
   - [ ] **Confirm Graduation → Telenavigation** → the header phase chip
         flips to **Telenavigation**; the Journey Board card moves columns;
         a monthly check-in cadence starts
3. **The overdue check-in** — log in as **Navigator David Chen** (use the
   navigator picker on the role selector; Helen Garcia is his patient).
   - [ ] Dashboard banner: "1 telenavigation check-in overdue" naming
         **Helen Garcia** with "Check-in ~5d overdue" (seeded 35 days since
         last check-in; rebased live)
4. Open Helen → **Journey** tab.
   - [ ] **Record Monthly Check-in** → dialog documents the call and writes
         a phone note; the cadence clock resets (banner clears)
   - [ ] **Re-engage Patient** (alternate path) → documented reason returns
         her to **Active Navigation**
5. **Exit pathways** — on any non-exited patient's Journey tab, click
   **Exit Program…**.
   - [ ] The dialog offers the **five documented pathways**:
         patient-initiated, ineligibility, MIA, deceased, safety
   - [ ] **Patient-initiated requires supervisor confirmation** (a navigator
         cannot complete it alone)
   - [ ] The seeded exited patient **Gloria Sandoval** shows the read-only
         terminal state: "Exited — Patient-initiated", with her journey
         history in the timeline

---

## Part 16 — Ops Blitz Beat 1: A Custom Template in 60 Seconds

*"You don't file a ticket to change a note type; you edit it."*

Log in as **Admin (Alex Rivera)** → sidebar **Note Templates**.

1. Orientation:
   - [ ] Header reads "Note Templates" with subtitle "**{N} templates on file
         ({N} system, {N} custom)** — duplicate a manual template to build a
         practice-specific variant without a code change"
   - [ ] Table columns: Template / Encounter types / Fields / Notes written /
         Actions
2. Pick the **Medical Appointment ± Transit** row → click **Duplicate**
   (Copy icon).
   - [ ] Toast: `Editing a copy of "Medical Appointment ± Transit" — nothing
         is saved until you hit Save`
   - [ ] The editor opens on the new copy, name suffixed **"(Copy)"**
3. In the field editor, rename the template (e.g. "Medical Appointment —
   Home Visit Variant") and add a field via **"Add field"**.
   - [ ] New field row lets you set label, field type, section, and the
         **Required**/**Never skip** switches
   - [ ] The **"Live narrative preview"** panel (Eye icon) updates as you
         edit — it renders sample responses through the same
         `generateNarrative` engine that writes saved notes, and surfaces
         any validation problems under **"Fix before saving"**
4. Click **"Save template"**.
   - [ ] Toast: `Saved "{name}"` — "Live in the note builder's template
         picker now."
   - [ ] Back on the list, the new row shows under **custom** with a "Notes
         written: 0" count
5. Try to delete a system template that already has notes against it (e.g.
   **Medical Appointment ± Transit** itself, used in Part 11).
   - [ ] The **Delete** action (Trash2 icon) is disabled with a tooltip
         reading "**{N} saved notes were written from this template**"
   - [ ] If you force a delete attempt on any in-use template, the outcome is
         `Cannot delete "{name}" — existing notes were written from it` — the
         in-use guard is real, not cosmetic
6. Delete the new custom copy instead (0 notes written).
   - [ ] Confirm dialog: `Delete "{name}"?` with body text ending
         "Templates referenced by saved notes cannot be deleted." → confirm
         button **"Delete template"**
   - [ ] Toast: `Deleted "{name}"`

---

## Part 17 — Ops Blitz Beat 2: Documents, E-Sign, and the Billing Gate

*Playbook §4: "no billing before signed Patient Agreement" — now a real
claim-validation error, not prose.*

Log in as **Supervisor (Marcus Williams)** → header search → open **Walter
Briggs**.

1. Journey tab → Intake 2 checklist.
   - [ ] Items with a mapped document (ROI, medication list, patient photo,
         onboarding packet, navigation contract, intake survey) show a status
         badge (Not started / Draft / Completed / Signed) and an **"Open
         document"** button instead of a bare checkbox
   - [ ] ROI/photo/med-list/packet already read **Signed**/**Completed** —
         Walter's Intake 1 side is done
   - [ ] The **navigation contract** row reads **Draft** — this is the live
         demo beat
2. Click **"Open document"** on the navigation contract row.
   - [ ] The dialog shows the **Patient Navigation Agreement** form with an
         amber banner: "**Billing gate: navigation time cannot bill for this
         patient until this agreement is signed.**"
3. Scroll to the signature panel.
   - [ ] Badge reads "**demo e-signature — DocuSign-class integration slots
         in later**" — honestly labeled, not pretending to be DocuSign
   - [ ] A "Signing as" radio: Patient / Guardian / Authorized representative
   - [ ] A **"Typed name (signature)"** field
4. Type "Walter Briggs", select **Patient**, click **"Sign Agreement"**.
   - [ ] Toast: `Patient Navigation Agreement signed by Walter Briggs` —
         "Billing gate open for this patient."
   - [ ] The form now reads "Signed by Walter Briggs (Patient) on {date} —
         billing gate open."
   - [ ] Back on the checklist, the row flips to **Signed**
5. Prove the gate was real: as **Revenue Cycle Manager (Biller)**, before
   Walter's contract is signed his patient-month would show **"Patient
   Agreement not signed"** in Needs Attention if he had billable time logged
   (the validation is a real `claims-engine` error, not UI copy) — after
   signing, that error clears.
6. Bonus: open **Rosa Delgado** (fresh conversion) — her Intake 1 items are
   all **Not started**, showing the honest empty state before any document
   work begins.

---

## Part 18 — Ops Blitz Beat 3: The Navigator's Task Morning

*SOPs 3.3/3.6/3.10 — confirmations, no-show recovery, and post-visit
follow-up, running as a worklist instead of memory.*

Log in as **Navigator (Emily Rodriguez)** → sidebar **My Tasks**.

1. Orientation:
   - [ ] Header: "My Tasks" with subtitle "**{N} open task(s) — {N}
         overdue**"
   - [ ] Four sections in order: **Overdue** (red), **Due today**,
         **Upcoming**, **Done recently** (last 10)
2. Work the **Overdue** lane first (the red one) — pick a confirmation task.
   - [ ] Card shows a destructive **"Overdue"** badge, the task type label
         (e.g. "48-hour confirmation"), a due timestamp, and two buttons:
         **"Complete"** and **"Dismiss"**
3. Click **"Complete"**.
   - [ ] Dialog title **"Complete task"**; for confirmation tasks an
         **Outcome** radio group offers exactly **Confirmed** / **No
         answer** / **Reschedule requested**, plus an optional **"Note
         (optional)"** field
   - [ ] Confirm with **"Mark complete"**
4. Switch to **Schedule** and open the same patient's appointment.
   - [ ] The **"Confirmation touches"** section shows 48-hour / 24-hour /
         Day-of rows; the one you just completed is now green with a
         **Confirmed** badge — completing from Tasks and confirming from
         Schedule write to the same `confirmations[]` array, so they can
         never double-count
   - [ ] Any row still open shows a **"Confirm now"** button — click it on a
         different row and watch the toast: "**Confirmation recorded**" /
         "{window} touch confirmed."
5. Back in **My Tasks**, find a **"Dismiss"** action on any task.
   - [ ] Dialog **"Dismiss task"** requires a note (placeholder: "Why is this
         task being dismissed?"); the **"Dismiss"** button stays disabled
         until you type one
6. Dashboard check: navigate to **Overview**.
   - [ ] A "**{N} task(s) due today**" strip appears (with an "— {N}
         overdue" suffix when applicable) and a **"View all"** button jumps
         back into My Tasks

---

## Part 19 — Ops Blitz Beat 4: Adverse-Event Response Tasks

*SOPs 4.1–4.6 — one click turns a closed adverse event into the full
response-task set, including the post-discharge PCP business-day countdown.*

Log in as **Supervisor (Marcus Williams)** → sidebar **Adverse Events**.

1. Find **Dorothy Martinez** (UTI, ended 2026-01-18) — she has no response
   tasks generated yet (fresh seed).
   - [ ] A **"Generate response tasks"** button is visible on her event card
2. Click it.
   - [ ] Toast: "**Generated {N} response task(s) for Dorothy Martinez**"
   - [ ] Task rows appear: **post-event contact** (already past-due, since
         the event predates today), and — because the event has an
         `endDate` — **post-discharge PCP visit**, **post-discharge med
         reconciliation**, **risk-reduction education**
3. Inspect the post-discharge PCP task.
   - [ ] Its due badge reads in **business days** (e.g. "{n}bd left" or
         "{n}bd overdue") — the same `pcpDueStatus` math as the intake-side
         PCP countdown, but anchored to the adverse event's discharge date,
         not intake
4. Each task row offers **Complete**/**Dismiss** exactly like My Tasks.
   - [ ] Completing the med-reconciliation task is a natural segue into Part
         20 (open Dorothy's Medications tab next)
5. Contrast with **Frank Anderson** (fall, ended 2026-01-22) — his response
   set was already generated at seed time, so no "Generate response tasks"
   button appears; his tasks show a mix of **Done** and **open** rows,
   demonstrating the steady-state view after the initial generation.

---

## Part 20 — Ops Blitz Beat 5: The Escalation Closed Loop

*Field guide §1.2 — a first-class escalation object, distinct from SOS, that
closes the loop: raise → acknowledge → resolve.*

1. As **Navigator (Maria Santos — use the navigator picker on the role
   selector)**, open **Frank Anderson**'s chart → **Notes**/Clinical Feed
   tab.
   - [ ] A **"Raise Escalation"** button is available on the feed
2. Click it.
   - [ ] Dialog title **"Raise Escalation — Frank Anderson"**; description
         states "The assigned supervisor is nudged immediately"
   - [ ] Reason options: Repeated no-shows / Clinical risk / Unresolved SDOH
         barrier / Safety concern / Other
   - Pick a reason, add a description, submit.
     - [ ] Toast: "**Escalation raised for Frank Anderson**" — "The assigned
           supervisor has been nudged."
3. Switch to **Supervisor (Marcus Williams)** — the seeded **open**
   escalation on Frank Anderson's household (`esc-pt5-sdoh`, an SDOH/utility
   case) is the fastest live example if you skip step 1–2.
   - [ ] Status badge **"Open"**; an **"Acknowledge"** button is visible
4. Click **"Acknowledge"**.
   - [ ] Status flips to **"Acknowledged"**; the button row now offers
         **"Resolve"**
5. Click **"Resolve"**.
   - [ ] A required resolution-note textarea appears; the confirm button
         (**"Confirm Resolution"**) stays disabled until you type a note
   - [ ] Submitting flips status to **"Resolved"** and stamps
         acknowledged/resolved by + at
6. For contrast, open the seeded **resolved** escalation on Robert Wilson
   (`esc-pt3-clinical`) — it shows the full closed-loop history: raised →
   acknowledged (same day) → resolved (three days later) with its
   resolution note intact, read-only.

---

## Part 21 — Ops Blitz Beat 6: Onboarding Tracker & the Certification Bump

*Playbook §10 — the 90-day developmental period, made visible, with the
comp/target consequence of certifying built in.*

Log in as **Supervisor (Marcus Williams)** → sidebar **Navigators**.

1. Directory table.
   - [ ] A new **"Onboarding"** column shows a badge per navigator:
         **Developmental** (with "{N}d in program"), **Certified**, or
         **Lead**
2. Click into **Sarah Thompson** (`nav-sarah` — true new hire, 0 milestones
   complete) → her onboarding card.
   - [ ] 8-milestone curriculum in order: Week-1 orientation, CPSS exam,
         Gellert exam, Weeks 2-4 shadowing, **30-day review**, **60-day
         review**, **90-day review**, **Certification**
   - [ ] Her **next milestone** is Week-1 orientation (nothing completed yet)
   - [ ] A **shadowing checklist** (7 items: home visit, transport with
         in-transit coaching, medical appointment ± transit, BH appointment,
         Intake 1/2 visit, a day-close alongside a mentor, first solo note
         reviewed against the manual)
3. Contrast with **Sarah Johnson** (`nav7`) — seeded at the 60-day-review
   stage, several milestones already complete with `completedAt` stamps.
4. Open **David Chen**'s (`nav2`) onboarding card — already `certified`/lead.
   - [ ] His certification milestone shows completed
   - [ ] His units target sits at 18+/day (already ramped)
5. Back on a **developmental** navigator's card, inspect the certification
   milestone row.
   - [ ] Text states the consequence explicitly: **"+$2,500"** compensation
         and "Completing this bumps units target **16 → 18**/day"
   - [ ] The action button reads **"Certify"** — clicking it (on a demo
         navigator, not a real seeded one you want to preserve) flips status
         to `certified` and ramps the units target live

---

## Part 22 — Ops Blitz Beat 7: The Wallboard

*Playbook §9.1 — the daily-KPI screen for the office, live from demo data.*

Log in as **Executive (Dr. Sarah Chen)** or **Supervisor (Marcus Williams)**
→ sidebar **Wallboard**.

1. - [ ] Header **"Daily KPI Board"**, subtitle "Real-time operational
         metrics"; footer caption "Daily KPI board — Gellert playbook §9.1 ·
         live from demo data"
2. Seven tiles, all computed from live state (not random):
   - [ ] **Units Today** — top 3 navigators by avg units/day
   - [ ] **Day-Close Rate (30d)** — %
   - [ ] **Referral Conversion** — %
   - [ ] **Open Tasks** — count of open `NavigatorTask`s (drops as you clear
         My Tasks in Part 18)
   - [ ] **Open Escalations** — count of non-resolved escalations (drops
         after Part 20's resolve)
   - [ ] **Active Census** — active patient count
   - [ ] **Telenav Overdue** — patients whose telenav check-in is overdue
         (Helen Garcia, from Part 15)
3. Confirm liveness: complete a task in Part 18 or resolve an escalation in
   Part 20 first, then reload the Wallboard — **Open Tasks**/**Open
   Escalations** reflect the change (best demoed as the closing beat after
   Parts 18–20, to show the board isn't a static mock).
4. Confirm role scope: the **navigator** role has no Wallboard sidebar item
   — it's an executive/supervisor office screen, per the playbook's meeting
   cadence, not a personal dashboard.

---

## Appendix — Known Demo Constraints

- No backend: state is one browser's localStorage. Two tabs share it (that's
  how the SOS drill works); two machines don't.
- Clearinghouse, HL7 feed, and geocoding are simulators behind adapter
  interfaces — the demo loop is fully self-contained by design.
- The scribe needs Chrome/Edge for live dictation; Load Sample covers other
  browsers.
- Seed dates rebase to "today" on each fresh load, so the demo never looks
  stale (that's how the SLA-breached referral, the overdue telenavigation
  check-in, and today's unsigned charge slips are live on every reset); DOBs
  and enrollment dates stay fixed.
- Outreach attempts are manual attestations (no telephony/SMS integration).
  Provider communications (intake/exit/ineligible/unreachable) are real
  rendered/editable messages with a per-referral history, but sending is
  explicitly labeled **"Send (simulated)"** — no fax/Direct-messaging
  transport exists yet.
- Document e-signatures (ROI, navigation contract) are a **typed-name demo
  signature**, honestly badged "demo e-signature — DocuSign-class
  integration slots in later" — not a real e-sign provider.
- The UHC DAP 835 is simulator-generated (no live UHC remit), and zone map
  shapes are circle approximations — real polygons come with a real geo
  provider.
