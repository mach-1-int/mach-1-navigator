# QA Protocol: The Billing Bridge

**Objective:** Prove that the system accurately aggregates loose "time logs" into compliant G-Code claims and exports them correctly.

---

## Test Scenario 1: The "Guardrail" Check (Under-threshold)

**Goal:** Verify that the system prevents billing for patients who haven't met the 60-minute CMS requirement.

- [ ] **1. Setup:** Ensure you have a patient with zero recorded time for the current month, or use **Sam Underwood** (pt-billing) who has a single 45-minute note for the month.
- [ ] **2. Action:** If starting from 0 min, create a single note/time log for this patient with a duration of **45 minutes** (via Note Builder with Encounter Timer; completing the note creates the time log).
- [ ] **3. Navigate:** Go to **Revenue Cycle Manager** (Biller role or Admin/Executive → Revenue Cycle Manager). **Select payer "Medicare PIN (G-Codes)"** so the 60-minute threshold applies (Medicaid uses 8-min Rule of Eights and would show 45 min as billable).
- [ ] **4. Verify:**
  - Is the patient listed in the **"Needs Attention"** (Red) tab?
  - Does the **Issues** column explicitly say: **"Insufficient Time (45/60 mins)"**?
  - **Crucial:** They do **not** appear in the "Ready to Bill" list.
- [ ] **5. Demo Talk Track:** *"First, we protect your audit rating. The system automatically holds back any claims that haven't hit the 60-minute federal threshold, so you don't waste time on denials."*

---

## Test Scenario 2: The "Logic Engine" Check (The Math)

**Goal:** Verify that the system correctly calculates Base Units (G0023) vs. Add-on Units (G0024).

- [ ] **1. Action:** Add a second note for the same patient for **30 minutes** (total **75 minutes**).
- [ ] **2. Verify:** Refresh the dashboard (or switch month and back). **Keep payer on "Medicare PIN (G-Codes)".**
  - Did the patient move to the **"Ready to Bill"** (Green) tab?
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
  - Is the patient in the **"Needs Attention"** tab?
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

## Troubleshooting Guide

| Issue | What to check |
|-------|----------------|
| **Math looks wrong?** | CMS rule: you need the **full 30 minutes** to trigger the next G0024 unit. 89 minutes = still just G0023 (1 Unit). 90 minutes = G0023 (1 Unit) + G0024 (1 Unit). |
| **45-min patient in Ready to Bill?** | Ensure payer is **"Medicare PIN (G-Codes)"** or **"Medicare CHI (G-Codes)"**. Under **"Arizona Medicaid (H-Codes)"**, 45 min is billable (Rule of Eights: 3 units). |
| **Export not downloading?** | Check the browser's pop-up blocker if the CSV doesn't appear. |
| **Diagnosis codes missing in CSV?** | Ensure the patient has at least one diagnosis (e.g. **primaryDiagnosis** or **icdCodes**) on their profile / Intake; otherwise the claim may show "Missing diagnosis codes" in Needs Attention. |
| **"Missing Member ID" not showing?** | Health Plan is used as Member ID. Clear **Health Plan** on the patient profile (Edit next to Health Plan in Payer/Plan card) and refresh the Billing Dashboard. |

---

## Quick Reference: Seed Data

- **Sam Underwood** (pt-billing): One 45-minute time log for 2026-01; use for Scenario 1 (under threshold) and Scenario 2 (add notes to reach 75 / 105 min).
- **Biller role:** Role selector → **Biller** (Revenue Cycle Manager) lands on the Billing Dashboard.
- **Payer dropdown:** Default is Arizona Medicaid (H-Codes). Use **Medicare PIN (G-Codes)** for 60-min guardrail and G0023/G0024 logic.
