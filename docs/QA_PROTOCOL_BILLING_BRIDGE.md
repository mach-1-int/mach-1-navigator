# QA Protocol: The Billing Bridge

**Objective:** Prove that the system accurately aggregates loose "time logs" into compliant G-Code claims and exports them correctly — and that the post-blitz billing surfaces (charge-slip day-close, DAP pend/reprocess, denial work queue) hold their guarantees.

> **Status model (renamed):** Derived claims are now `DRAFT` / `VALIDATED` / `NEEDS_ATTENTION` (formerly READY / MISSING_DATA).
> - The **"Ready to Bill"** tab shows both **VALIDATED** claims (closed months, passed validation) and **DRAFT** claims — the current, still-accruing billing month — which carry an amber **"In-progress month"** badge next to the patient name.
> - The **"Needs Attention"** tab shows **NEEDS_ATTENTION** claims (validation errors listed in the Issues column).
> - The Revenue Cycle Manager now has **four tabs**: **Ready to Bill / Needs Attention / Denials / Ledger**. Exported claims move to the **Ledger** (see Scenario 6); DENIED records additionally surface in the **Denials** work queue (see Scenario 9).
>
> **Automated gates first:** `npm run verify:billing` (21 blocks), `npm run verify:claims` (43 checks), and `npm run verify:gellert` (12 checks — charge-slip derivation + DAP 835 round trip) must all be green before any hands-on pass here.

---

## Test Scenario 1: The "Guardrail" Check (Under-threshold)

**Goal:** Verify that the system prevents billing for patients who haven't met the 60-minute CMS requirement.

- [ ] **1. Setup:** Ensure you have a patient with zero recorded time for the current month, or use **Sam Underwood** (pt-billing) who has a single 45-minute note for the month.
- [ ] **2. Action:** If starting from 0 min, create a single note/time log for this patient with a duration of **45 minutes** (via Note Builder with Encounter Timer; completing the note creates the time log).
- [ ] **3. Navigate:** Go to **Revenue Cycle Manager** (Biller role or Admin/Executive → Revenue Cycle Manager). **Select payer "Medicare PIN (G-Codes)"** so the 60-minute threshold applies (Medicaid uses 8-min Rule of Eights and would show 45 min as billable).
- [ ] **4. Verify:**
  - Is the patient listed in the **"Needs Attention"** (Red) tab (status **NEEDS_ATTENTION**)?
  - Does the **Issues** column explicitly say: **"Insufficient Time (45/60 mins)"**?
  - **Crucial:** They do **not** appear in the "Ready to Bill" list.
- [ ] **5. Demo Talk Track:** *"First, we protect your audit rating. The system automatically holds back any claims that haven't hit the 60-minute federal threshold, so you don't waste time on denials."*

---

## Test Scenario 2: The "Logic Engine" Check (The Math)

**Goal:** Verify that the system correctly calculates Base Units (G0023) vs. Add-on Units (G0024).

- [ ] **1. Action:** Add a second note for the same patient for **30 minutes** (total **75 minutes**).
- [ ] **2. Verify:** Refresh the dashboard (or switch month and back). **Keep payer on "Medicare PIN (G-Codes)".**
  - Did the patient move to the **"Ready to Bill"** (Green) tab?
  - If the claim is for the **current month**, it shows as **DRAFT** with the amber **"In-progress month"** badge (still counts as ready/billable-in-progress); closed months show as **VALIDATED**.
  - Does the **Codes Generated** column show: **G0023 (1 Unit)**? (Correct: 75 < 90, so only base unit.)
- [ ] **3. Action:** Add a third note for **30 minutes** (total **105 minutes**).
- [ ] **4. Verify:** Refresh.
  - Does the **Codes Generated** column now show: **G0023 (1 Unit) + G0024 (1 Unit)**?
  - **Logic:** 105 min = 60 (Base) + 30 (Add-on) + 15 (remainder; no extra unit).
- [ ] **5. Demo Talk Track:** *"The system applies the complex CMS rounding rules for you. You never have to manually calculate G0024 units again."*

---

## Test Scenario 3: The "Validation" Check (Missing Data)

**Goal:** Verify the system catches clerical errors (missing Insurance ID).

- [ ] **1. Setup:** Find a patient with **>60 minutes** of time for the month (e.g. one already in "Ready to Bill").
- [ ] **2. Action:** Go to their **Patient Profile** → **Payer / Plan** card. Click **Edit** next to **Health Plan (Member ID)**. Clear the Health Plan field and click **Save**.
- [ ] **3. Navigate:** Go back to the **Revenue Cycle Manager** (Billing Dashboard).
- [ ] **4. Verify:**
  - Is the patient in the **"Needs Attention"** tab (status **NEEDS_ATTENTION**)?
  - Does the error say **"Missing Member ID"**?
- [ ] **5. Fix:** Open the patient profile again → Edit Health Plan → re-enter the plan (e.g. "Mercy Care") → Save. Return to Billing Dashboard and confirm the patient is back in **"Ready to Bill"**.

---

## Test Scenario 4: The "Bridge" Check (CSV Export)

**Goal:** Verify the physical file is formatted for the Clearinghouse.

- [ ] **1. Action:** In the **"Ready to Bill"** tab, select the checkbox next to your valid patient.
- [ ] **2. Action:** Click **"Export Selected (X)"** (or "Export to CSV").
- [ ] **3. Verify:** Open the downloaded file in Excel/Numbers. Check:
  - **Patient_Name:** Correct?
  - **Member_ID:** Present?
  - **Date_Of_Service:** Last day of the month (e.g. **01/31/2026**)?
  - **CPT_Code:** G0023 / G0024 as expected?
  - **Diagnosis_1–4:** Diagnosis/ICD codes (e.g. Z59.0, E11.9) included?
- [ ] **4. Demo Talk Track:** *"This file is pre-formatted to match your AdvancedMD import specs. It's a simple drag-and-drop to get paid."*

---

## Test Scenario 5: The "Consent Guardrail" Check

**Goal:** Verify that claims cannot go out for patients without a documented intake/consent record.

- [ ] **1. Setup:** Use **Mary Jenkins** (pt-validation-test). She is seeded with billable time but **no intake record** (and therefore no documented consent).
- [ ] **2. Navigate:** Go to the **Revenue Cycle Manager** → **"Needs Attention"** tab.
- [ ] **3. Verify:**
  - Mary Jenkins's claim is listed in **Needs Attention**.
  - The **Issues** column includes **"Patient consent not documented"** (alongside her missing-ICD/diagnosis error).
  - She does **not** appear in "Ready to Bill".
- [ ] **4. Fix (optional):** Complete an **Intake** for Mary (consent + initiating visit) and confirm the consent error clears on the Billing Dashboard.
- [ ] **5. Demo Talk Track:** *"Claims can't go out without documented consent. The system holds the claim and tells you exactly what compliance documentation is missing — before the payer does."*

---

## Test Scenario 6: The "Full Revenue Loop" (837P → Clearinghouse → 835)

**Goal:** Verify the end-to-end lifecycle: export, submission, adjudication, and payment posting.

- [ ] **1. Export:** In the **"Ready to Bill"** tab, select one or more valid claims and click **Export 837P**.
  - A **.837P file downloads**.
  - The exported claims **move to the "Ledger" tab**.
  - The **Outstanding A/R** metric **rises** by the exported amount.
- [ ] **2. Clearinghouse:** In the **Ledger** tab, open the row actions menu (⋯) on an **EXPORTED** claim and click **"Simulate Clearinghouse"**.
  - Clean claims are **accepted** (status → ACCEPTED).
  - Claims with an **UNK member ID** would be **rejected** — this is the scrub working.
- [ ] **3. Remittance:** **"Generate Sample 835"** (Ledger header) is now a **dropdown** — pick **"Standard remit (mixed)"**. (The **"UHC DAP scenario (unknown incentive code)"** item is Scenario 8.)
  - A sample .835 file downloads and a toast appears with an **"Import now"** action.
  - Click **Import now** → the **import dialog** opens pre-loaded → click **Parse**.
  - The **preview** shows per-claim **PAID / DENIED** outcomes.
- [ ] **4. Apply:** Click **Apply**.
  - Toast reads **"N payments applied, 0 pended for review, 0 unmatched"**.
  - Statuses post to the Ledger with **CARC/RARC detail** (adjustment/remark codes with dictionary tooltips) on each row.
  - The **Paid** metric **rises**.
  - **DENIED** rows offer **"Reopen for Rebill"** in the row actions menu, returning the claim to the working tabs — and every DENIED record also lands in the **Denials** work queue (Scenario 9).
- [ ] **5. Demo Talk Track:** *"That's the entire revenue loop — export, clearinghouse scrub, remittance, and payment posting — with denials routed straight back into rework, all in one screen."*

---

## Test Scenario 7: The "Day-Close" Check (Sonya's Charge Slips)

**Goal:** Verify the navigator's end-of-day charge-slip signing derives from time logs (per-day Rule of Eights) and stays honest against monthly claims.

- [ ] **1. Setup:** Log in as **Navigator (Emily Rodriguez)** and scroll the dashboard to the **"Today's Charge Slips"** panel (below the progress card). Seed data guarantees unsigned slips for today on every fresh reset.
- [ ] **2. Verify:**
  - One row per patient seen today, each showing **minutes · units · billing code** (e.g. "45 min · 3 units H0038") — **per-day Rule of Eights** units derived live from time logs, so the panel can never drift from billing.
  - **Helen Garcia's row is amber** with the coaching hint: **"6 min — below the 8-minute billable minimum. Stack activities for this patient into one visit window to capture the unit."** (seeded 6-minute patient-day; 0 units).
  - Each unsigned row has its own **Sign** button; the panel header shows the day's patient and unit totals.
- [ ] **3. Action:** Click **Sign & Submit Day**.
  - Toast: **"Day closed"** — *N charge slips signed — X daily units submitted*.
  - The header button is replaced by a green **"Day closed"** badge — signing is idempotent (`verify:gellert` locks this).
- [ ] **4. Cross-check (Biller):** Revenue Cycle Manager → **Ready to Bill**: patient-months with unsigned days show an informational **"N unsigned slip-days"** badge — never a validation block. Daily charge-slip units and monthly claim units may legitimately diverge (per-day vs per-month Rule of Eights); UI copy always distinguishes **"daily units (charge slips)"** from **claim units**.
- [ ] **5. Demo Talk Track:** *"This is the face sheet you can't lose. Every patient you touched today is already on a charge slip with the units computed — you sign the day, billing sees it instantly, and a six-minute phone call gets a coaching hint instead of silently earning zero units."*

---

## Test Scenario 8: The "DAP Pend" Check (UHC's False Denial, Fixed)

**Goal:** Verify a remit carrying unknown remark codes **pends for review** instead of misposting as a denial, then classifies and reprocesses to PAID — Sonya's exact UHC pain, fixed.

- [ ] **1. Setup:** You need claims in the Ledger at SUBMITTED/ACCEPTED — run Scenario 6 steps 1–2 first. Stay on the **Ledger** tab.
- [ ] **2. Action:** **Generate Sample 835** dropdown → **"UHC DAP scenario (unknown incentive code)"**.
  - Toast: **"UHC DAP sample 835 generated for N claims"** — every claim paid at **101% of billed** with a negative **CARC 144** adjustment and **RARC N807**, codes the seed dictionary deliberately does **not** contain. Click **Import now**.
- [ ] **3. Parse:** Matched rows highlight amber: **"Unknown remark codes: 144, N807 — will pend for review"**; the preview header counts **"N will pend for review"**.
- [ ] **4. Apply:**
  - Toast: **"0 payments applied, N pended for review, 0 unmatched"** — nothing misposts as a denial.
  - The Ledger shows amber **"Needs Review"** badges, a **"N pended for review"** chip, and the status filter gains a **Needs Review** option.
- [ ] **5. Classify:** Expand a pended row → the **"Remittance pended for review"** block shows the held resolution (would post PAID at $X vs billed $Y) and each unknown code with an **"Add code to dictionary"** button.
  - Click it for **144** → the inline **Add Code to Dictionary** dialog → enter a description, set classification **Adjustment** → **Add to Dictionary**. Repeat for **N807** (classification **Informational**). The biller never leaves the ledger.
- [ ] **6. Reprocess:** Click **"Reprocess pended remits"**.
  - Toast: **"N pended remittances posted"**; rows go **PAID** with a green **"+1% DAP"** badge next to the paid amount (101% of billed).
- [ ] **7. Downstream:** Executive → **Revenue** shows the **"DAP Incentive Recovered (CARC 144)"** callout; Admin → **Remark Codes** now lists 144/N807 with their classification. Regression: a **Standard remit (mixed)** import never pends (`verify:gellert` locks it).
- [ ] **8. Demo Talk Track:** *"Sonya, this is your exact UHC pain. UHC changed the remark code on the 1% DAP incentive, and AMD posts those bonus payments as denials. Here the unknown code pends instead of misposting — you classify it once, in one dialog, click reprocess, and every payment posts at 101% with the incentive totaled on the executive dashboard. Manual dictionary maintenance becomes one click."*

---

## Test Scenario 9: The "Denial Work Queue" Check

**Goal:** Verify denied claims land in a persistent collections worklist with aging and work-status tracking — the queue AMD never gave Gellert.

- [ ] **1. Setup:** Create DENIED rows: run the Scenario 6 remittance loop — the mixed sample denies ~15% of claims (rerun the export → clearinghouse → 835 loop if none denied), or use **"Mark Claim Denied"** in a Ledger row's actions menu.
- [ ] **2. Navigate:** **Denials** tab (its badge counts DENIED records).
- [ ] **3. Verify:**
  - Columns: **Patient / Month / Billed / Denial Codes / Aging / Work Status / Action**.
  - Denial codes render as **CARC/RARC chips** whose tooltips show the dictionary description plus classification (informational / adjustment / denial).
  - **Aging buckets**: 0–7 days (neutral), 8–30 days (amber), 31+ days (red), with exact day counts; rows sort oldest first.
  - Header filters for **CARC**, **work status**, and **aging bucket** all narrow the list.
- [ ] **4. Action:** Change a row's **Work Status** (New → In Review → Corrected → Resubmitted). A toast confirms and the status persists.
- [ ] **5. Action:** Click **"Reopen for rebill"** on a denial.
  - Toast confirms; the record is voided, the patient-month returns to the working tabs, and the row leaves the queue.
- [ ] **6. Bonus:** While remits are pended (Scenario 8), the queue shows a **"N remittances pended for review"** strip on top pointing back to the Ledger's Needs Review queue.
- [ ] **7. Demo Talk Track:** *"AMD makes you work denials live during remit posting or lose them. Here every denial lands in a persistent worklist with aging buckets — nothing ages out silently, and rework is one click back into the billing tabs."*

---

## Troubleshooting Guide

| Issue | What to check |
|-------|----------------|
| **Math looks wrong?** | CMS rule: you need the **full 30 minutes** to trigger the next G0024 unit. 89 minutes = still just G0023 (1 Unit). 90 minutes = G0023 (1 Unit) + G0024 (1 Unit). |
| **45-min patient in Ready to Bill?** | Ensure payer is **"Medicare PIN (G-Codes)"** or **"Medicare CHI (G-Codes)"**. Under **"Arizona Medicaid (H-Codes)"**, 45 min is billable (Rule of Eights: 3 units). |
| **Export not downloading?** | Check the browser's pop-up blocker if the CSV doesn't appear. |
| **Diagnosis codes missing in CSV?** | Ensure the patient has at least one diagnosis (e.g. **primaryDiagnosis** or **icdCodes**) on their profile / Intake; otherwise the claim may show "Missing diagnosis codes" in Needs Attention. |
| **"Missing Member ID" not showing?** | Health Plan is used as Member ID. Clear **Health Plan** on the patient profile (Edit next to Health Plan in Payer/Plan card) and refresh the Billing Dashboard. |
| **Patient progress bar doesn't show the 60-minute Medicare bar?** | The patient billing progress bar is **payer-aware**. Under the default **Arizona Medicaid (H-Codes)** config it shows **Rule-of-Eights units** ("8 min = 1st unit"), not the 60-minute Medicare bar. Switch the payer to a Medicare config to see the base + add-on (60-min) bar. |
| **Second 835 import shows everything unmatched?** | Correct behavior: claim records are terminal — a remit can only post once. Re-applying reports **0 applied** instead of a false success. |
| **"Reprocess pended remits" says still pended?** | Every unknown code on a pended remit must be in the dictionary first — add each code via **Add code to dictionary** (Scenario 8 step 5), then reprocess. |
| **Day-close panel says "No time logged today"?** | Charge slips derive from **today's** time logs for the logged-in navigator. Sign a timed note first, or reset demo data — Emily Rodriguez carries seeded unsigned slips for today (dates rebase to "today" on load). |

---

## Quick Reference: Seed Data

- **Sam Underwood** (pt-billing): One 45-minute time log for 2026-01; use for Scenario 1 (under threshold) and Scenario 2 (add notes to reach 75 / 105 min).
- **Mary Jenkins** (pt-validation-test): Billable time but **no intake record** — use for Scenario 5 (consent guardrail; also shows missing diagnosis codes).
- **Frank Anderson** (pt5): seeded **unverified 90-minute** time log — a permanent "Needs Attention" resident ("Unverified time (90 min) — supervisor review required"; unverified minutes can never reach export).
- **Helen Garcia** (pt4): seeded **6-minute patient-day for today** on Emily Rodriguez's time logs — the amber sub-8-minute coaching hint in Scenario 7.
- **Biller role:** Role selector → **Biller** (Revenue Cycle Manager) lands on the Billing Dashboard with four tabs: **Ready to Bill / Needs Attention / Denials / Ledger**.
- **Payer dropdown:** Default is Arizona Medicaid (H-Codes). Use **Medicare PIN (G-Codes)** for 60-min guardrail and G0023/G0024 logic.
- **Remark-code dictionary:** deliberately omits **CARC 144 / RARC N807** — their absence is the Scenario 8 demo beat.
