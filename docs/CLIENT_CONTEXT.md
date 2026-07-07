# Gellert Health — Durable Client Context

**Prepared:** 2026-07-07
**Purpose:** Permanent, repo-committed distillation of everything known about Gellert Health (the prospective client the Mach 1 Care Navigator demo is aimed at), so future sessions can do gap analyses, PRDs, and demo tailoring without re-uploading source materials.

**Sources distilled here:**
1. **Discovery meeting transcript (2026-07-07)** — Jed Rudd (Mach 1 Integration) on-site with **Mitch Lawrie (COO)**; **Sonya Edgar (Director of Administration / billing)** joined by phone and screen-shared Advanced MD and Optimum. Voice-recorded and transcribed by Jed.
2. **`Note Project.docx`** — Gellert's "Navigator Note-Taking Manual" (training guide for billable documentation, ~30 note types).
3. **`GH Playbook Draft - Shared V2.docx`** — "Health Navigation Operating Playbook" (DRAFT, internal review; Part I strategy/ops, Part II Navigator Field Guide). Note: this draft was substantially co-authored by Jed from prior sessions with Gellert; ⚑-flagged sections are open items awaiting Gellert leadership input.
4. **`WorkFlow2025.pdf`** — one-page process map: Referrals → Navigation → Graduation.

**Companion docs:** `docs/CURRENT_STATE_OVERVIEW.md` (what the demo app actually does), `docs/DEMO_WALKTHROUGH.md`.

---

## 1. Who's Who

### Gellert Health org (from playbook §9)

| Person | Role | Notes for engagement |
|---|---|---|
| **Vivi (Vivienne) Gellert** | CEO | Original champion — did design sessions with Jed; was impressed by rapid build-show cycles. Wants dashboards over minable clinical data. Media contact. |
| **Mitch Lawrie** | COO | Driving the systems evaluation. Former hospital CIO and occupational therapist; has implemented EMRs "at all levels" and converted paper→electronic + EDI setups. Deeply hands-on (built the manual navigator-zone system himself). |
| **Sonya Edgar** | Director of Administration | Does **all** billing herself today; also wears the compliance hat. The billing/RCM gatekeeper — her confidence is required for any system swap. |
| Dr. Wilson | CMO | Clinical oversight and quality. |
| Michelle Luizzi | Director of Navigation | Navigator team oversight, case review, SOP compliance, training. |
| Hugh Oxnard | CFO | Financial oversight. |
| Michael Armenta & Sarah Lewis | Navigation Supervisors | Day-to-day navigator supervision, case review. Supervision notes they write are the single most important note on a patient record (per Mitch). |
| Ashley Childre | HR Manager | |
| Gaby Vazquez | Executive Assistant (COO) | |
| "Dave" | (mentioned in transcript) | Mitch checks with him on the NDA. |

### Relationship state
- Gellert is **seriously considering a custom build** and, per Mitch verbatim: *"if we were to do anything custom, there's nobody else that we're talking to."*
- The only alternative under evaluation is **NetSmart MyEvolve** (configured commercial EHR/PM) — seen as very comprehensive but **overkill** for a company trying to simplify.
- Mach 1's positioning (stated in the meeting): skin-in-the-game build-show cycles ("give us a challenge, we come back with it working, and we show the guts underneath"), explicitly *not* vaporware/pretty-front-end demos; honest that rapid prototypes are not yet HIPAA-hardened.

---

## 2. Business Model (the essentials)

- **What they do:** Human peer-support health navigation for **AHCCCS** (Arizona Medicaid)-enrolled adults, referred by **Arizona Complete Health** or ACH-approved providers. Navigators are **non-clinical**: they don't diagnose, don't treat, never touch medications — they accompany, coach, transport, coordinate, and document. Diagnoses come from the referral source or the patient's first PCP visit.
- **Revenue:** effectively **one billing code** — peer support services (**H0038**, unit-based, **15 minutes per unit**), billed **every day**. Sonya: "we have one bill income." Gellert is a **single provider entity with one NPI**; every claim goes out under it.
- **Productivity targets:** **16/18/20 units/day** depending on navigator level (full caseload). Sub-8-minute interactions don't bill, so navigators must intelligently stack activity per patient.
- **Referral funnel:** 30+ referral sources; a handful generate the majority — **St. Joe's Hospitals is by far the biggest**; Valley Wise Hospital also named; payers **Mercy Care** and **United Healthcare** also refer directly (and want outcome scores, since engaged patients cost them less). Only **20–30% of referrals convert to intakes** (unreachable, declines, wrong insurance, etc.).
- **UHC DAP:** Arizona Medicaid's 1% Differential Adjustment Payment (SDOH referral incentive) is worth roughly **one navigator's salary per year** to Gellert — and it's ending within a couple of months of the meeting. (It's also the source of an active billing-system pain; see §5.)
- **Navigator comp (playbook):** $47,500 base; +$2,500 Certified Health Navigator; +$2,500 Lead Navigator (max $52,500).
- **Patient journey (workflow map + playbook):** Referral & eligibility (outreach within 24–48h of acceptance, **7-attempt max**) → Intake 1 & 2 (**3 no-shows max**, PCP scheduled **within 7 business days**) → Active Navigation (multi-touch appointment confirmation 48h/24h/day-of; Patient Guide due **Friday 4pm** weekly; billing submitted **end of every day**) → Adverse-event response (post-discharge PCP within 7 days) → **Graduation to "Telenavigation"** (monthly check-ins, re-engagement path) or Program Exit (ineligibility, patient-initiated, MIA, deceased, safety).
- Patients are **not entered into Advanced MD until they accept services** — deliberately, to avoid accumulating data on non-patients. That's a key reason referral management lives in a separate system.

---

## 3. Jed's Goals / Challenges / Path-Forward Framework

Jed's own synthesis (opened the meeting with it; Mitch validated with one major addition):

**Goals:** increase the number of navigators; capture all available (billable) activity; get navigators closer to care; grow billables per navigator (efficiency — onboard faster, reach higher bill rates sooner); as a result, increase referrals from area providers.

**Current challenges:** it takes **weeks to learn the systems**; billable-activity growth is slow; the job inherently burns people out and the broken systems add fuel; current systems are **fragmented**; and Gellert **cannot demonstrate the value of its services to referral sources** with data.

**Path forward:** an integrated navigator system that (1) provides a modern, intuitive interface; (2) reduces onboarding friction; (3) automatically triggers key process and documentation steps; (4) improves billable-unit progress and productivity; (5) demonstrates value through quantifiable data that only exists because the system captures integrated variables. Result: staff onboard faster, produce more, stay longer; providers and payers see demonstrated value.

**Mitch's key correction:** it must be **end-to-end** — the referral is the front end. Capturing referrals and converting them to intakes is where the navigator's work begins, and referral→intake is currently the most disconnected part of the stack.

**The value-demonstration problem (strategic):** Gellert struggles to show referrers (e.g., St. Joe's) that engaging Gellert increases their patients' welfare and decreases cost — at zero cost to the referrer (insurance pays). Payer referrers (Mercy Care, UHC) explicitly want scores. Jed floated pursuing **St. Joe's ADT feed**; Mitch will ask whether the relationship allows it (business barrier more than technical; ADT is lightweight PII — though pulling diagnosis codes edges into PHI). Note Gellert already independently re-verifies diagnosis and insurance on every referral regardless.

---

## 4. Current Systems Landscape

### Advanced MD ("AMD") — EHR + Practice Management (the core system)
Designed for behavioral-health providers; heavily customized by Gellert (peer-support carve-out, custom note templates, the H0038 unit-code billing). Two halves: EMR/EHR + PM (financial). **Sonya's verdict: works fine at today's scale, would not survive doubling the business.**

How billing actually flows today:
1. Navigator completes the note, totals minutes, clicks to a **charge slip** tab, enters units for H0038, signs.
2. Charge crosses to the PM side; Sonya runs scrubbing edits (CCI etc.) before claims go out **daily**.
3. Remits come back as **835 files into an AMD tab**. Anything denied does **not** auto-post — it forces review.
4. Sonya works denials **in real time as she posts remits** (no collections module purchased → no denial queue). She checks the payer portal for the reason, corrects in AMD, resubmits as a corrected claim the same evening. Occasionally corrects on the payer website directly.
5. **The detailed note never accompanies the claim** — documentation is audit backup only ("we just paid you $100,000 for these 10 patients; show us the documentation supports it").

### Optimum — the referral system (the weak link)
An Access-style referral database built a couple of years ago; was meant to grow into replacing AMD and never did. Reality:
- Mostly **hand-keyed** (PDF scraping exists but usually fails).
- The **referral dashboard is the only reporting**; Mitch mainly uses the raw "all referrals" view.
- Referral-time data (address, insurance, access number) is **never updated afterward** → goes stale/obsolete; **no connection to AMD** whatsoever.
- Chart number (Gellert-internal) vs. access number mismatch forces spreadsheet "shenanigans" for any cross-system join.
- Its navigator map is "worthless."
- The referral team over-captures medical information (which is **not billable** when they do it) instead of the minimum needed to schedule the navigator (whose time **is** billable) — a workflow-design insight for the future system.
- Referral→intake handoff is manual: referral team schedules the intake, then someone re-keys it into the AMD scheduler.

### Mitch's manual zone system (workaround worth honoring)
Weekly, Mitch joins Optimum addresses + Sonya's chart↔access mapping into a mapping service he set up, with **11 manually drawn navigator zones**. Only way to see navigator/patient geography. There has been no logical management of patient→navigator assignment, so navigators (driving their own cars) crisscross the metro — unbillable drive time is a named margin lever.

### Everything else
- **NetSmart MyEvolve** — under active evaluation (only alternative). Concerns raised by Sonya: conversion risk (prior conversions left them running two systems for years; not all billing/medical-record data converts), their proprietary clearinghouse **RevConnect** (dismissive answers about Change-Healthcare-style breach contingencies and payer-preferred clearinghouse interop), and vendors' inability to answer whether **ICD/CPT/HCPCS and remark-code sets auto-update** with CMS releases. In AMD today, unknown remark codes must be **manually added** when they appear on a remit.
- **Clearinghouse history:** during the Change Healthcare breach, AMD swapped everything to **Availity** and claims kept flowing — Sonya cites this as the bar for resilience.
- **Timeero** — navigator daily login/logout + location tracking.
- **Connectivity pain:** navigators toggle phone mobile-hotspots to connect laptops in the field. Mitch trialed a dedicated wireless router (~$30/mo/navigator) and navigators were "overjoyed." Verizon contract renegotiation under evaluation. (Small QoL wins matter a lot to this team.)
- **Unite Us** — SDOH referral tracking (navigators register and use it).
- Playbook explicitly states the goal: **"Replace Optimum/AMD with consolidated EMR/EHR."**

---

## 5. Pain Points (consolidated)

**Billing / RCM (Sonya):**
- No collections/denial queue — denials worked live during remit posting; fine at today's volume, not at 2×.
- **UHC DAP false denials:** UHC changed the remark code identifying the 1% DAP payment; AMD can't account for it, so legitimate payments post as denials Sonya must manually push through.
- Remark-code dictionary requires manual maintenance.
- Per-navigator productivity is **not reportable**: AMD reports by provider, Gellert has one provider/NPI. The only capture is a **day-close "face sheet"** — miss printing it once and that day's per-navigator numbers are gone. Everything lands in a manual spreadsheet.
- AMD "analytics" can't mine every data element; canned reports are decent, custom pulls hit walls.

**Documentation / navigator experience (Mitch):**
- ~30 note types, all hand-typed into dated AMD template UIs with dropdowns — a big reason **training takes weeks**.
- **Duplicative entry:** provider name / practice / practice address must be cut-and-pasted into every note, even the same PCP three visits running (navigators keep a separate provider-contact-list document just to copy from).
- Standard patient facts (colonoscopy/mammogram status, diabetic status) are re-entered per note; Mitch is hand-building AMD dashboard fields to auto-populate them — the future system should make this native.
- Care-protocol checkboxes (peer-support qualification) are compliance-critical and easy to miss.
- Same-day multi-appointment days are complicated (note linking so only one note carries the billable total; worse with two navigators covering one patient in a day).
- Supervision notes — the most important note on a chart — are buried like any other note.
- The AMD scheduler is quirky (e.g., must switch to week view before filtering to one navigator). Whether staff reliably use appointment statuses (check-in/check-out/cancel/no-show) is unknown.

**Referral ops:** everything in §4 Optimum, plus the 20–30% conversion rate itself as an improvement target (playbook flags referral-team script/process revamp).

---

## 6. Requirements & Feature Asks (synthesized)

From the transcript + playbook §7 "Technology Enablement":

**Must-have capabilities (playbook, verbatim list):**
1. Referral-to-Active-Patient Management (CRM) — referral management, patient onboarding, navigator assignment
2. Patient Guides & Dashboards
3. Patient profile and **AI-enabled note taking**
4. Patient engagement tracking
5. Patient acuity-level tracking
6. Billing platform — unit tracking and reporting
7. Dashboards & BI reporting — operational, financial, role-based, referral, QA & compliance, referral-source analysis, case-manager feedback

**AI future state (playbook):** automate documentation with audit-compliance validation; patient engagement platform (text/chat); predict no-show risk and intervene; suggest optimal outreach timing; identify high-risk patients.

**Emphasis from the meeting:**
- **The AI scribe is the "coup de grâce"** (Mitch's words): HIPAA-compliant Scribe-like capture of the encounter conversation, transcribed and shaped — via training/tuning — into the correct note form for the appointment type. Critically, **appointment type is known at scheduling time**, so the right template can be pre-selected for the AI.
- End-to-end in one system: referral capture → eligibility → intake scheduling & navigator assignment → navigation/scheduling → notes → charge → claim → remit → reporting.
- Per-navigator (per-user) productivity reporting despite single-NPI billing.
- A real denial/collections queue.
- Structured, minable clinical data for **Vivi's dashboards** (today it's flat text; she wants e.g. "how many diabetic patients, how many visits, are they improving" — click-boxes over prose).
- Auto-populate repeated fields (providers, standing patient facts) everywhere.
- Zone/geo-aware patient→navigator assignment (institutionalize Mitch's 11-zone workaround; reduce unbillable travel).
- Code-set hygiene: ICD/CPT/HCPCS/remark codes updating with CMS releases, without manual dictionary maintenance.
- Clearinghouse resilience (multi-clearinghouse failover, à la AMD→Availity).
- Field connectivity friendliness (works well over navigator hotspots/routers).

**Engagement-model principles (playbook ⚑):** prefer Agile over Waterfall; prefer configured-with-customization over full custom *(note: this bias predates the custom conversation with Mach 1)*; architect for continued modernization; RESTful APIs where systems aren't integrated; regression-testing capability for custom solutions.

---

## 7. Compliance & Documentation Rules (from the Note-Taking Manual)

These constrain any notes/AI-scribe feature — the manual is effectively the spec for AI note generation:

- **Patient involvement must appear in every note. No patient involvement = no billing.** (The manual sets this in caps.)
- Third person only ("Navigator", he/she/they — never "I"/"we"); complete sentences; chronological; direct quotes for patient statements.
- Every timestamp uses a colon and AM/PM (e.g., 3:03PM); every note closes with end time and **total minutes**.
- Note-type taxonomy: phone call, medical appointment (± transit), behavioral health (± transit; SI/HI/AH/VH screening required), lab/imaging, medication assistance, SDOH, multidisciplinary — each with required "never skip" elements and copy-ready templates.
- **Medication no-touch rule** with required language: patient refills the container independently with verbal direction; navigator never touches medications.
- **Multidisciplinary days:** transport + peer-support narrative lives only in the first same-day note; later notes carry only their own appointment content (duplication = documentation risk).
- Zero-tolerance aggression policy: incidents (profanity, threats, thrown objects) must be documented, with direct quotes when relevant.
- Billing rules (field guide): one charge slip per patient per day, attached to a scheduled appointment; billing daily by end of day; nothing billable before the signed Patient Agreement; no billing texts/emails/voicemail-only calls or patient-absent drive time; screenshot on arrival/departure to document time.
- HIPAA practices: "secmsg" subject-line convention, no hospital/guest WiFi, first-name-last-initial phone contacts, no SSNs collected.

---

## 8. Engagement State & Next Steps (as of 2026-07-07)

**Agreed path (Jed proposed, Mitch accepted):**
1. **Define a scoped "prove-it" challenge** — a boxed test Gellert cares about; Mach 1 builds and demos it (with the guts shown) to earn the next step.
2. **Paid deep discovery** at "a very affordable price" — screen-by-screen walkthroughs at full depth.
3. **Full tip-to-tail plan** out of discovery, with quick-hit models built along the way for confidence in scary areas.

**Action items:**
- *Mitch:* send NDA (checking with Dave whether one exists; Jed signs off), send the Note Project doc (✅ done), the playbook (✅ done), and a one-page workflow (✅ done — `WorkFlow2025.pdf`); follow-up email to set next steps; ask internally about a **St. Joe's ADT feed**.
- *Jed:* sign NDA (and BAA if real patient data ever enters scope); do a **clean pass aligning the GH Playbook draft to their actual workflow** and use it as the walkthrough template for whatever system version gets stood up; propose the prove-it challenge definition.
- *Open questions for Sonya:* exactly what data accompanies outbound claims (answered in-meeting at a high level: bill only, notes are audit backup — but she wanted to verify details); 835 receipt mechanics beyond "a tab in AMD."
- *Open questions for Mitch:* St. Joe's ADT feasibility; whether appointment statuses are reliably used; caseload tier definitions (⚑ TBD in playbook, along with graduation criteria, telenavigation protocol, adverse-event protocol, program-exit protocol, ongoing-training framework — all flagged as needing leadership input).

---

## 9. Demo ↔ Gellert Gap Notes (for future gap-analysis sessions)

The Mach 1 demo (`docs/CURRENT_STATE_OVERVIEW.md`) is already directionally aligned in striking ways — referral ingestion with matching/assignment (incl. distance/geography), AI scribe with template-driven notes and honest failure modes, EVV, verified time logs → claims, 837P/835 lifecycle **with a denial/rebill queue** (the exact thing Sonya lacks), per-navigator operational visibility, and role dashboards.

Known divergences to reconcile when tailoring to Gellert:

| Demo today | Gellert reality |
|---|---|
| CMS CHI/PIN program framing (G-codes) alongside AHCCCS H-codes | Single code: **H0038** peer support, 15-min units, one NPI, billed daily; charge-slip-per-patient-per-day concept |
| HL7v2 ADT ingest feed | Referrals arrive as PDFs/forms into Optimum, hand-keyed; ADT feed is an *aspiration* (St. Joe's) — the demo's HL7 path is the future-state story, not current state |
| Acuity/risk tiers exist | Also needed: **telenavigation/graduation phase** and program-exit pathways (workflow map phases 5–6) — no demo concept yet |
| Generic encounter note templates | **~30 Gellert note types** with the manual's hard compliance rules (patient involvement, third person, total minutes, med no-touch language) as the AI-scribe output spec |
| No supervision-note concept | Supervision notes must exist and surface at the top of the patient record |
| Match & Assign scores distance from zip centroids | Institutionalize **zone-based assignment** (Mitch's 11 zones) and unbillable-travel reduction reporting |
| Executive dashboards computed from demo data | Vivi's ask: minable clinical/SDOH structured data (condition counts, visit counts, improvement trends); payer-facing value story (referral-source ROI) |
| Remark codes admin table exists | Add the auto-update story (code sets tracking CMS releases) and the UHC-DAP-style "payment misclassified as denial" handling as a demo beat |

---

*Update this file whenever new client information arrives (meetings, emails, documents). It is the single durable source of Gellert Health context for this repo.*
