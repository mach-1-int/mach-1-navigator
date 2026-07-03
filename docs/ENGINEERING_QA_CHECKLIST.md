# Engineering QA Checklist — 4 Logic Pillars

Run this before anyone sees the screen. It validates **Distance**, **Language**, **Load**, and **State Change**.

---

## Setup

1. **Role:** Supervisor (Marcus Williams).
2. **Navigate:** Sidebar → **Referrals** (Pending Referrals).
3. **Test data:** Use referral **Elena Rodriguez** (Zip **85303**, Language **Spanish**) for Tests A & B. Use **Mike Smith** (Zip **85201**, Mesa) for Test C if needed.

---

## Test A: The "Geography" Logic (Maria vs. John)

**Scenario:** Incoming Patient is in **85303** (West Valley).

**Expected:**
- **Maria Gonzalez** (85301 – Glendale) → ranked **#1**, card shows **"~4 miles away"**.
- **John Mitchell** (85201 – Mesa) → ranked **lower**, score **&lt;50%** (e.g. "Too Far" / outside service area).

**Steps:**
1. On Referrals, click **"Match & Assign"** on **Elena Rodriguez** (or any referral with Zip **85303**).
2. **Check Maria’s card:** Does it say **"~4 miles away"** (or similar)?
3. **Check John’s card:** Is his score significantly lower (e.g. **&lt;50%**) and/or does it show **"Too Far"**?

**Pass / Fail:** _________

---

## Test B: The "Language" Hard Filter

**Scenario:** Incoming Patient requires **Spanish**.

**Expected:**
- **Maria** (Speaks Spanish) → **High score**, card has **"Spanish Speaker"** badge.
- **Sarah** (English only) → **Critical penalty** (score nearly **0** or negative). Sarah drops to the **bottom** of the list.

**Steps:**
1. With the same referral (e.g. Elena) open in **Match & Assign**, confirm **Language** is **Spanish** (or use the **Language** dropdown in the left pane to set **Spanish**).
2. **Verify Maria’s card** has a **"Spanish Speaker"** badge.
3. **Verify Sarah’s card** is at the **bottom** and score is **nearly 0 or negative** (e.g. "Language Mismatch").

**Pass / Fail:** _________

---

## Test C: The "Burnout" Prevention (Load Balancing)

**Scenario:** Incoming Patient is in **85201** (Mesa).  
**Context:** John is in Mesa (close) but has **48/50** caseload. Sarah is further but has **10/50** caseload.

**Expected:**
- **John** should **not** be an automatic 100% match; he should be **penalized** for high capacity.
- **Sarah** may rank **higher** or **competitive** despite distance because she has capacity.
- **Visual:** John’s **caseload progress bar** is **Red** or **Yellow** (high capacity).

**Steps:**
1. Select (or create) a referral with Zip **85201** (Mesa) and open **Match & Assign**.
2. **Check John’s card:** Is his **Caseload** bar **Red** or **Yellow** (48/50)?
3. **Check:** Is John’s match score **not** 100%? Is Sarah competitive or higher?

**Pass / Fail:** _________

---

## Test D: The "State Change" (The Assign Button)

**Steps:**
1. From **Match & Assign** for a pending referral, click **"Assign Referral"** on **Maria’s card**.
2. **Verify:** Does the referral **disappear** from the **Pending** list? (You are taken back to Referrals; that referral should no longer be pending.)
3. **Navigate:** Sidebar → **Team / Navigators** (Navigator Directory).
4. **Verify:** Does **Maria Gonzalez’s** caseload show **36** (was 35)?
5. **Verify:** Open **Maria’s** profile/detail view. Does the **new patient** appear in **Maria’s "My Patients"** list?

**Pass / Fail:** _________

---

## Summary

| Test | Pillar       | Pass / Fail |
|------|--------------|-------------|
| A    | Geography    | _____       |
| B    | Language     | _____       |
| C    | Load         | _____       |
| D    | State Change | _____       |

---

## Implementation Notes

- **Match & Assign** is available from **Referrals** → **"Match & Assign"** on each referral row; it opens **IntakeWorkspace** with ranked navigator cards.
- **Matching engine:** `lib/matching-logic.ts` (distance, language, capacity, acuity).
- **Live caseload:** Navigator cards use **live** `patientCount` from state after assignments.
- **Language override:** Left pane **Matching Criteria** → **Language** dropdown toggles effective language for ranking (for Test B).

---

## Distances are computed

Matching distances and travel times are no longer a hardcoded mock table — they come from a **haversine geo adapter** (`lib/geo.ts`): great-circle distance between zip centroids × a 1.3 road-winding factor, with a metro-average speed heuristic for drive times.

- **Maria** 85301 → 85303 ≈ **4 mi** (within her radius).
- **John** 85201 → 85303 ≈ **30 mi** — a **hard fail** beyond his **20 mi** service-area radius (−100 score).
- Consequence for Test A: the old **"~3 miles"** expectation is now **"~4 miles"**.
- Unknown zips fall back to 20 mi / 30 min (matches the old mock-table defaults).

---

## AI Scribe degraded modes

Verify the AI Recorder / Note Builder fails safe in each mode:

1. **No API key:** Unset `GEMINI_API_KEY` and restart. Dictating shows an **amber "Demo Mode" banner** — values are canned mock output and are clearly labeled as such (not passed off as AI).
2. **Network failure:** Kill the network mid-request. A **red failure banner** appears with a **Retry** button and a **"Use demo values instead"** fallback action.
3. **Refresh mid-dictation:** Refresh the page while a dictation is in progress. On return, a **restore banner** offers the **saved transcript** (Restore action recovers the unsaved draft).

---

## HL7 ingestion

From the Supervisor **Referrals** view:

1. **"Simulate Incoming Referral"** creates a live referral from a **rotating pool** of sample HL7 messages (deterministic rotation; every generated message round-trips through the real parser).
2. **"Paste HL7…"** opens a dialog that parses **arbitrary HL7v2** referral messages, surfacing parse **warnings** for malformed or missing segments.
3. The **raw HL7v2 message** renders on the referral card (Raw HL7 section) for ingested referrals, so the source payload is always inspectable.
