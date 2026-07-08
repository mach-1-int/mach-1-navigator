# Engineering QA Checklist — 4 Logic Pillars + Gellert Engines

Run this before anyone sees the screen. It validates **Distance**, **Language**, **Load**, and **State Change**, plus manual-UI spot checks on the engines added in the Gellert logic transplant.

**Automated gates first — all six suites must be green:**

```
npm run verify:billing    # 21 blocks
npm run verify:safety-map # 12 checks
npm run verify:claims     # 43 checks
npm run verify:journey    # 5 + 9 checks (runs two scripts)
npm run verify:notes      # 7 checks
npm run verify:gellert    # 12 checks
```

---

## Setup

1. **Role:** Supervisor (Marcus Williams).
2. **Navigate:** Sidebar → **Referral CRM** (Pipeline tab).
3. **Pipeline gate:** Match & Assign exists **only for Agreed referrals** — the 9-state pipeline (Received → Accepted → Outreach → Agreed → …) is the front door. Non-agreed referrals show no Match & Assign button, and the workspace itself carries an amber guard banner ("Outreach in progress — patient has not agreed to services") with every Assign button reading **"Awaiting Patient Agreement"**.
4. **Test data:**
   - **David Jones** (seeded **Agreed**, zip **85001**, L3) — ready-made Match & Assign entry; Sarah Thompson (85001, L3-certified, 10/50) should top his ranking.
   - For Tests A & B, walk **Maria Garcia** (Spanish, zip **85031**, West Valley) through the pipeline: **Simulate Incoming Referral** (she's first in the rotation after a reset) → answer all five eligibility gates **Yes** → **Accept — 48h Contact Clock Starts** → log an outreach attempt → **Patient Agreed** → **Match & Assign**.
   - For Test C, walk **Mike Smith** (seeded **Received**, zip **85201**, Mesa) to Agreed the same way.
   - Note: the old test referral **Elena Rodriguez** is now seeded **Converted** (terminal — she is patient pt-elena); terminal referrals show a read-only summary, not Match & Assign.

---

## Test A: The "Geography" Logic (Maria vs. John)

**Scenario:** Incoming Patient is in **85031** (Maryvale — West Valley).

**Expected:**
- **Maria Gonzalez** (85301 – Glendale) → ranked **#1**, card shows **"~4 miles away"** plus a **West Valley — same zone** chip and a "Zone match: West Valley +15 pts" reason.
- **John Mitchell** (85201 – Mesa) → ranked **lower**, score **&lt;50%** with **"Too Far"** (26 mi &gt; his 20 mi service radius — hard fail).

**Steps:**
1. Open **Match & Assign** on the agreed Maria Garcia referral (Setup step 4). **All 11 navigators** are ranked, not just 3.
2. **Check Maria's card:** Does it say **"~4 miles away"**? Does it carry the emerald **"West Valley — same zone"** zone chip and the **+15 pts** zone-match reason?
3. **Check John's card:** Is his score significantly lower (e.g. **&lt;50%**) and does it show **"Too Far"**? His zone chip reads East Valley (cross-zone, informational only).

**Pass / Fail:** _________

---

## Test B: The "Language" Hard Filter

**Scenario:** Incoming Patient requires **Spanish**.

**Expected:**
- **Maria** (Speaks Spanish) → **High score**, card has **"Spanish Speaker"** badge.
- **Sarah** (English only) → **Critical penalty** (score nearly **0** or negative), card shows **"Language Mismatch"**. Sarah drops toward the **bottom** of the list.

**Steps:**
1. With the same referral (Maria Garcia) open in **Match & Assign**, confirm **Language** is **Spanish** (or use the **Language** dropdown in the left pane's **Matching Criteria** card to force **Spanish** on any referral).
2. **Verify Maria's card** has a **"Spanish Speaker"** badge.
3. **Verify Sarah's card** shows **"Language Mismatch"** with a score **nearly 0 or negative**.

**Pass / Fail:** _________

---

## Test C: The "Burnout" Prevention (Load Balancing)

**Scenario:** Incoming Patient is in **85201** (Mesa).
**Context:** John is in Mesa (close, and same East Valley zone) but has **48/50** caseload. Sarah is further but has **10/50** caseload.

**Expected:**
- **John** should **not** be an automatic 100% match despite 0 distance + zone credit; he is **penalized** for high capacity.
- **Sarah** ranks **competitive or higher** despite distance because she has capacity.
- **Visual:** John's **caseload progress bar** is **Red** (≥90% capacity; amber starts at 70%).

**Steps:**
1. Walk **Mike Smith** (Received, zip 85201) to Agreed (Setup step 4) and open **Match & Assign**.
2. **Check John's card:** Is his **Caseload** bar **Red** (48/50)?
3. **Check:** Is John's match score **not** 100%? Is Sarah competitive or higher?

**Pass / Fail:** _________

---

## Test D: The "State Change" (The Assign Button)

**Steps:**
1. From **Match & Assign** for an **agreed** referral, click **"Assign Referral"** on **Maria's card**.
2. **Verify:** The referral's pipeline chip flips to **Converted** (it stays in the list — terminal state, not deletion); the right pane becomes a read-only "Converted to Patient" summary with a link to the new chart. The patient record is created **only now** — at agreement + assignment, never at referral receipt.
3. **Navigate:** Sidebar → **Navigators** (Navigator Directory).
4. **Verify:** Does **Maria Gonzalez's** caseload show **36** (was 35)?
5. **Verify:** Open **Maria's** profile/detail view. Does the **new patient** appear in **Maria's roster**? The new chart's header carries an **Intake** journey-phase chip and a **PCP due** countdown (7 business days from conversion).

**Pass / Fail:** _________

---

## Test E: Referral Pipeline Transitions (pointer row)

The 9-state transition matrix (`lib/referral-pipeline.ts`) is replayed exhaustively by `verify:journey`; the manual angle is that **illegal transitions are structurally impossible in the UI**.

**Steps:**
1. Select a **Received** referral → the right pane is the 5-gate **Eligibility Review**; no outreach log, no Match & Assign.
2. Answer a gate **No** → "Ineligible at gate N" banner; the only action is **Close as Ineligible & Notify Referring Provider**.
3. Accept a referral (all gates Yes → **Accept — 48h Contact Clock Starts**) → the pane becomes the 7-slot **Outreach Log**; still no Match & Assign until **Patient Agreed**.
4. Select a terminal referral (Converted / Ineligible / Declined / Unreachable) → read-only summary; no mutating actions.

**Pass / Fail:** _________

---

## Test F: Journey Phase Machine (pointer row)

Phase transitions (`lib/journey.ts`, intake → active → telenavigation ⇄ active → exited) are matrix-checked by `verify:journey`; manual angle:

**Steps:**
1. **Journey Board** (supervisor sidebar): four kanban columns — Intake / Active Navigation / Telenavigation / Exited; adverse events render as card **badges** (derived overlay), never as a column.
2. On an intake patient's **Journey** tab: **Complete Intake 2 → Active Navigation** flips the header phase chip and moves the board card.
3. Graduation is two-step: navigator **flags readiness**, only a supervisor sees **Confirm Graduation → Telenavigation**.
4. **Exit Program…** offers exactly the five documented pathways; patient-initiated requires supervisor confirmation.

**Pass / Fail:** _________

---

## Test G: Note Compliance Blocking (pointer row)

The nine manual-citing rules (`lib/note-compliance.ts`) are locked by `verify:notes` (every seeded Gellert note passes the engine); manual angle:

**Steps:**
1. Note builder on a Gellert template → the **Manual Compliance** panel lists every rule with expandable manual citations.
2. Clear the patient-involvement field → the rule flips to a red **fail**, the footer reads **"Resolve manual-compliance failures to sign"**, and the save button disables. Restore the field → it passes again.
3. Fields the manual forbids skipping carry a **"Never skip"** badge.

**Pass / Fail:** _________

---

## Test H: Chart Auto-fill (pointer row)

Autofill resolution (`lib/note-autofill.ts` — provider directory, standing facts, previous-note recall) is checked by `verify:notes`; manual angle:

**Steps:**
1. Schedule a **Medical Appointment** encounter for James Thompson → open it → **Document Visit**.
2. The note builder opens with the matching template pre-selected and provider fields pre-filled, each carrying a sky-blue **"Auto-filled from chart — Provider directory"** badge (distinct from the violet **AI** badge).
3. Manually edit an auto-filled field → the badge clears (manual edit takes ownership).

**Pass / Fail:** _________

---

## Test I: Windshield Time (pointer row)

Unbillable drive minutes between consecutive same-day in-person stops (`computeWindshieldTime` in `lib/zones.ts`, via the geo adapter) are fixture-checked by `verify:gellert`; manual angle:

**Steps:**
1. Executive → **Performance**: the per-navigator table has a **"Windshield time (unbillable)"** column with real minutes-per-day values or "—" (never random).
2. Sanity: navigators with multiple same-day in-person visits show non-zero windshield time; phone-only days contribute none.

**Pass / Fail:** _________

---

## Summary

| Test | Pillar / Engine            | Pass / Fail |
|------|----------------------------|-------------|
| A    | Geography (+ zone credit)  | _____       |
| B    | Language                   | _____       |
| C    | Load                       | _____       |
| D    | State Change               | _____       |
| E    | Referral pipeline matrix   | _____       |
| F    | Journey phase machine      | _____       |
| G    | Note compliance blocking   | _____       |
| H    | Chart auto-fill            | _____       |
| I    | Windshield time            | _____       |

---

## Implementation Notes

- **Match & Assign** is available from **Referral CRM** → the **Match & Assign** button on an **Agreed** referral's card (or "Match & Assign (Smart Matching)" in the conversion pane); it opens **IntakeWorkspace** with ranked navigator cards. Non-agreed referrals have no button, and the workspace guards with an amber banner + disabled "Awaiting Patient Agreement" buttons.
- **Matching engine:** `lib/matching-logic.ts` (distance 40, capacity 30, language 20, acuity 10, **zone +15**). The workspace passes the zone list, so every card carries a zone chip; same-zone cards get the emerald "— same zone" variant and the "+15 pts" reason.
- **Live caseload:** Navigator cards use **live** `patientCount` from state after assignments (`getNavigatorsWithAttributes` overlays it onto the seeded attributes).
- **Language override:** Left pane **Matching Criteria** → **Language** dropdown toggles effective language for ranking (for Test B).
- **Pipeline / journey engines:** `lib/referral-pipeline.ts` (REFERRAL_TRANSITIONS matrix, 5-gate order, 7-attempt auto-close, SLA thresholds) and `lib/journey.ts` (PHASE_TRANSITIONS, Intake 1/2 checklists, 3-no-show closure) — both replayed by `verify:journey`, including seeded histories after date-rebase.

---

## Distances are computed

Matching distances and travel times are no longer a hardcoded mock table — they come from a **haversine geo adapter** (`lib/geo.ts`): great-circle distance between zip centroids × a 1.3 road-winding factor, with a metro-average speed heuristic for drive times.

- **Maria** 85301 → 85031 ≈ **4 mi** (within her 15 mi radius); 85301 → 85303 is also ≈ 4 mi.
- **John** 85201 → 85031 ≈ **26 mi** — a **hard fail** beyond his **20 mi** service-area radius (−100 score); 85201 → 85303 ≈ 30 mi, same fail.
- Unknown zips fall back to 20 mi / 30 min (matches the old mock-table defaults).
- Zone shapes on maps are **circle approximations** from the same centroids — real polygons come with a real geo provider.

---

## AI Scribe degraded modes

Verify the AI Recorder / Note Builder fails safe in each mode:

1. **No API key:** Unset `GEMINI_API_KEY` and restart. Dictating shows an **amber "Demo Mode" banner** — values are canned mock output and are clearly labeled as such (not passed off as AI).
2. **Network failure:** Kill the network mid-request. A **red failure banner** appears with a **Retry** button and a **"Use demo values instead"** fallback action.
3. **Refresh mid-dictation:** Refresh the page while a dictation is in progress. On return, a **restore banner** offers the **saved transcript** (Restore action recovers the unsaved draft).

---

## HL7 ingestion

From the Supervisor **Referral CRM** view:

1. **"Simulate Incoming Referral"** creates a live **Received** referral from a curated pool of **12 personas** (every generated ADT^A04 message round-trips through the real parser). The feed **never re-produces anyone already in the system** — assigned patients and referrals of any status are excluded — and once the curated pool is exhausted, a **combinatorial generator** keeps producing unique people, so the ingest→assign loop can run all day without a reset.
2. **"Paste HL7…"** opens a dialog that parses **arbitrary HL7v2** referral messages, surfacing parse **warnings** for malformed or missing segments.
3. The **raw HL7v2 message** renders on the referral card (Raw HL7 section) for ingested referrals, so the source payload is always inspectable.
