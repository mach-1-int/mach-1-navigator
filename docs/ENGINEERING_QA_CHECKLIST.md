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
- **Maria Gonzalez** (85301 – Glendale) → ranked **#1**, card shows **"~3 miles away"**.
- **John Mitchell** (85201 – Mesa) → ranked **lower**, score **&lt;50%** (e.g. "Too Far" / outside service area).

**Steps:**
1. On Referrals, click **"Match & Assign"** on **Elena Rodriguez** (or any referral with Zip **85303**).
2. **Check Maria’s card:** Does it say **"~3 miles away"** (or similar)?
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
