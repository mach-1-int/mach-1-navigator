# Mach 1 Care Navigator — Comprehensive Current-State Overview

**Prepared:** 2026-07-03
**Purpose:** This document is a factual, code-verified snapshot of the Mach 1 Care Navigator platform (built for Gellert Health) as it exists in the repository today. It is intended to be fed to an LLM alongside demo video, screenshots, and meeting transcripts from the Gellert Health demo, so that the gap between **what the product currently is** and **what it should be** can be identified and turned into a PRD.

**How to read this document:** Every feature is flagged as one of:
- ✅ **REAL** — genuinely functional logic/integration
- 🎭 **SIMULATED** — works in the UI but is driven by seeded/mocked data or hardcoded values
- 🚧 **PLACEHOLDER** — a "Coming Soon" stub with no implementation

This distinction matters: the app is a high-fidelity demo. Much of it *looks* production-grade in a video but is stagecraft. The PRD work should treat SIMULATED items as "designed but not built" and REAL items as "built, needs hardening."

---

## 1. Product Identity

**Elevator pitch:** A multi-role healthcare navigation platform for CMS Community Health Integration (CHI) and Principal Illness Navigation (PIN) programs. Care coordinators ("Navigators") manage high-risk patients through home visits, AI-assisted encounter documentation, and medication tracking. Supervisors handle referral intake with a smart matching engine, monitor team safety in the field, and oversee compliance. A Revenue Cycle Manager converts navigator time logs into payer-compliant claims (Medicare G-codes / Arizona Medicaid H-codes). Executives track program ROI.

**The demo narrative ("Golden Thread"):** A referral arrives via a simulated HL7/EHR feed → the supervisor uses the Match & Assign engine (geography, language, caseload, acuity) → the navigator documents a home visit using an AI scribe (real speech-to-text + Gemini structuring) with an encounter timer → the time log flows into the Revenue Cycle Manager, which applies CMS billing rules (60-minute Medicare threshold, Rule of Eights for Medicaid) and exports clearinghouse-ready CSV claims → the patient sees their care plan and appointments in a patient portal.

**Setting:** All demo data is Phoenix, AZ metro (Glendale, Mesa, Downtown). Payers: Arizona Medicaid/AHCCCS, Medicare PIN, Medicare CHI, plus commercial plan rate cards.

---

## 2. Tech Stack & Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | shadcn/ui (Radix primitives), Tailwind CSS v4, Lucide icons, Geist fonts |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet (OpenStreetMap tiles) — supervisor safety map only |
| AI | `@google/generative-ai` — Gemini 2.5 Flash via server action; browser Web Speech API for transcription |
| Forms | react-hook-form + zod |
| State | Two React contexts; **no external state library, no database, no API routes** |
| Persistence | `localStorage` (key `mach1-navigator-store`), versioned with force-reseed on schema bump |
| Deployment | Dockerfile on DigitalOcean App Platform |

**Critical architectural facts:**
- **Single-page app with no routing.** `app/page.tsx` is the only route. "Views" are switched by React state (`navigation.view` in `RoleProvider`); there are no URLs, so no deep-linking or refresh-safe navigation.
- **No backend.** No API routes, no database, no auth. All domain logic runs client-side against a localStorage-persisted store (`lib/store.ts`, `lib/demo-data-context.tsx`). The only server-side code is the Gemini scribe server action.
- **Authentication is fake.** The login screen (`components/role-selector.tsx`) is a role picker; `setRole(role)` logs in as the first seeded user of that role. Session state is not persisted — a page refresh returns to the role picker (domain data survives; the session does not).
- **Date rebasing (new, uncommitted):** `lib/date-rebase.ts` shifts all operational seed dates (appointments, notes, time logs, referrals, shifts) forward by the gap between the authored anchor date (2026-01-30) and the real "today," so the demo always looks current. DOBs and enrollment dates are frozen. Applied in `createInitialState()`.

---

## 3. Roles & Navigation Map

Six roles: `executive`, `supervisor`, `navigator`, `patient`, `admin`, `biller`. Demo personas: Dr. Sarah Chen (Executive), Marcus Williams (Supervisor), Emily Rodriguez (Navigator), James Thompson & Elena Rodriguez (Patients), Alex Rivera (Admin), "Revenue Cycle Manager" (Biller).

| Role | Sidebar views | Status |
|---|---|---|
| **Executive** | Overview, Revenue Cycle Manager, Revenue, Performance, Patients | Overview + RCM real; **Revenue, Performance, Patients are 🚧 placeholders** (3 of 5 menu items) |
| **Supervisor** | Overview, Safety Map, Referrals, Navigators, Team Schedule, Compliance, Adverse Events, Messages | All implemented |
| **Navigator** | Overview, My Patients, Schedule, Notes (Clinical Feed), Messages | All implemented (My Patients is new, uncommitted) |
| **Patient** | My Health, Appointments, Medications, Messages, My Profile | All implemented |
| **Admin** | Overview, Revenue Cycle Manager, Payer Rates, Audit Log | Implemented (Payer Rates & Audit Log are tabs of one AdminDashboard component) |
| **Biller** | Revenue Cycle Manager | Implemented |

Deep-link-only views (reached by clicking through, no menu item): patient detail record, navigator detail, referral intake form, Match & Assign workspace, assessment wizard.

Dead UI: the header search input does nothing; the notification bell shows a hardcoded "3"; the sidebar Settings button does nothing.

---

## 4. Data Model (entities in `lib/types.ts`)

**People & org:** User (id, role, email, optional NavigatorAttributes: home zip, service radius, languages, caseload/max, acuity capabilities L1–L3) · Navigator (KPI record: monthly/MTD units, compliance %, adverse events, engagement — separate from User, same IDs) · Supervisor (region, navigatorIds).

**Clinical:** Patient (risk level 1–3, survival status, assigned navigator/supervisor, health plan, medications, adverse events, ICD-10 codes, primary diagnosis, lat/lng, billingTrack PIN|CHI, address/phone/email) · AdverseEvent (fall/infection/chronic_exacerbation/other; inpatient/ED/monitoring/ended; rightCareFlag) · Medication (dosage, frequency, refill date, compliance flag) · RiskAssessmentData (SDOH + clinical + mobility → 0–100 score → tier 1–3).

**Referral & intake:** Referral (status, denormalized demographics, zip/language/requiredAcuity for matching, plus `rawData` — fake HL7 PID/DG1/IN1/PV1 segments) · IntakeRecord (consent, service type PIN/CHI, initiating-visit date with CMS 12-month validation, AcuityScore — 4 domains × 0–3 → 0–12 → Low/Mod/High, identified barrier Z-codes).

**Documentation:** PatientNote (typed, plus template responses, narrative, duration, start/end times, timeSource timer|manual|edited, linked timeLogId) · NoteTemplate/TemplateField (dynamic form schema with narrative prefix/suffix generation) · TimeLog (duration, modality In-Person/Phone/Video, serviceType, activityType → H-code mapping, verified flag, billingPeriod YYYY-MM).

**Billing:** PayerConfig (base minimum minutes, unit increment, base/add-on codes, Rule of Eights flag, revenue rates) · CPTDefinition (G-codes) · HCodeDefinition · ZCode (17 SDOH codes) · BillableClaim (READY / MISSING_DATA / EXPORTED, validation errors) · PayerRate (per-plan $/unit rate card) · MonthlyTimeSummary · BillingEncounter.

**Care plans:** CareTemplate (3 seeded: heart failure, COPD, diabetes) · CarePlan · GoalTracking with metric data points.

**Scheduling:** ScheduleEvent (dual-track MEDICAL_VISIT / NAVIGATOR_VISIT, EVV check-in/out, high-safety-risk flag, travel/pickup) · NavigatorShift (days, times, published flag) · TimeOffRequest.

**Safety:** NavigatorLocation (lat/lng, lastCheckIn, status ACTIVE/IDLE/RISK_ALERT, current task, battery, speed).

**Messaging:** SupervisorMessage (legacy "nudge") and Message (unified DM) — two overlapping systems; nudges write to both.

**Governance:** AuditLog with 13 action types (check-in/out, note CRUD, payer rate changes, referral decisions, logins…).

---

## 5. Feature Inventory by Domain

### 5.1 Referral Intake & Matching Engine (Supervisor)

- **Referral queue** 🎭 — 6 seeded referrals styled as an incoming "AMD Integration / Epic EHR" HL7 feed. The HL7 segments are cosmetic seed objects; there is **no real EHR integration**.
- **Match & Assign workspace** ✅ logic / 🎭 inputs — real scoring algorithm (`lib/matching-logic.ts`, max 100 pts): distance (+40 in radius, −100 hard fail outside), capacity (+30 scaled by open caseload), language (+20 match, −50 hard fail for non-English patients), acuity capability (+10). Ranked navigator cards with distance, caseload bars, language badges. **However, distances come from a hardcoded zip-pair lookup table** (default 20 mi) — no geocoding. QA-validated scenarios: Spanish-speaking West-Valley patient ranks Maria (Glendale, bilingual) #1; John (Mesa) fails on distance; Sarah (English-only) collapses on language; John at 48/50 caseload gets burnout-penalized.
- **Manual intake form** ✅ — react-hook-form + zod; pre-populates from referral data; accept converts referral → full Patient record; reject supported. (There are actually two overlapping manual-intake implementations plus the match workspace — consolidation needed.)
- **Clinical intake (eligibility + acuity)** ✅ — 3-step dialog: PIN/CHI eligibility with CMS initiating-visit 12-month validation and consent capture → 4-domain acuity scoring (clinical/psychosocial/barriers/literacy, 0–12) with barrier score auto-suggested from the patient's SDOH assessment and Z-codes auto-suggested from barriers → review. **Gap:** this acuity score is not fed back into the matching engine (which uses the referral's `requiredAcuity` L1–L3 instead).

### 5.2 Navigator Experience

- **Dashboard** ✅ — supervisor nudge banners, new-patient alert, MTD units vs target (280/month), today's appointments, medication alerts (non-compliant or refill ≤7 days), patient roster with contact-gap warnings (>14 days), inline quick-note panel. ⚠️ "Today's Appointments" stat filters on a hardcoded date.
- **My Patients** ✅ (new, uncommitted) — dedicated roster page: search (name/chart/plan), risk filter, summary stats (total / high-risk / contact gaps), quick notes.
- **Schedule** ✅ UI / 🎭 data — list, map, and dual-track calendar views; add appointments; EVV-style check-in/check-out (check-out increments MTD units; GPS defaults to hardcoded Phoenix coordinates). Travel-conflict detection (30-min gap between different zips) with a demo-scripted "Move to 11:00 AM" fix. Calendar defaults to a pinned demo date.
- **Route map** 🎭 — **not a real map**: a stylized gradient panel with pins projected onto hardcoded Phoenix bounds and an SVG route line. (Leaflet is installed but only used by the supervisor safety map.)
- **Assessment wizard** ✅ — 4-step risk assessment (SDOH → clinical → mobility → summary) with live weighted risk scoring → tier 1–3; persists to the patient record.
- **Clinical feed** ✅ — all notes across patients with search/filter.

### 5.3 AI Scribe & Encounter Documentation (the "Golden Encounter Note")

This is the most technically real part of the product:

1. **Note Builder** ✅ — template-driven dynamic form (6 seeded templates; select/multi-select/text/boolean/duration fields), branded "CMS G0023 Compliant Documentation."
2. **Encounter Timer** ✅ — real stopwatch with editable start/end/duration and provenance tracking (`timer` vs `manual` vs `edited` — displayed as audit badges on notes).
3. **AI Recorder** ✅ — **real microphone transcription** via the browser Web Speech API (Chrome/Edge; falls back to paste-in textarea). A regex scans the transcript for spoken durations ("about 45 minutes") and offers to set visit duration.
4. **Gemini structuring** ✅ with 🎭 fallback — server action `parseEncounterTranscript` sends the transcript + template field definitions to **Gemini 2.5 Flash** (env var `GEMINI_API_KEY`), gets validated JSON back, and auto-fills every template field. **Without an API key (or on any error), it silently returns hardcoded mock data tagged "Demo Mode."**
5. **Narrative generator** ✅ — deterministic prose builder (per-field prefix/suffix concatenation) with manual override; prepends billing context (modality, barrier addressed, care-plan goal alignment).
6. **Care-plan linking** ✅ — notes can be tagged to an intake barrier Z-code and an active care-plan goal.
7. **Billing bridge** ✅ — saving a note with duration creates a `TimeLog` (modality, service type from patient's PIN/CHI track, billing period) that feeds the Revenue Cycle Manager.
8. **ICD-10 coding** ✅ — ~528-code searchable dataset with combobox pickers on the patient record; validation warns when diagnosis codes are missing (blocks claims).

Unused asset: `lib/sample-transcripts.ts` has 3 canned demo transcripts (transportation barrier, food insecurity, med education) that are **not wired into the UI**.

### 5.4 Billing / Revenue Cycle

- **Claims engine** ✅ — payer-agnostic: groups time logs by patient+month, applies the active `PayerConfig`:
  - **Arizona Medicaid (H-codes)** — default. Rule of Eights (<8 min = 0 units; then 15-min units), H0038/H2015/H0023 selected by dominant activity type, $18.50/unit.
  - **Medicare PIN** — 60-min base G0023 ($125) + 30-min add-on G0024 ($62.50).
  - **Medicare CHI** — G0019/G0022, same thresholds/rates.
- **Revenue Cycle Manager UI** ✅ — payer + month selectors; metric cards; two-tab workflow: **Ready to Bill** (multi-select → CSV export in CMS-1500/837P-ish format with per-code rows) and **Needs Attention** (validation errors: insufficient time "45/60 mins", missing member ID, missing ICD codes) with a **Nudge** button that messages the responsible navigator.
- **Guardrail demo** ✅ — seeded patient Sam Underwood (45 min) is held out of Ready-to-Bill under Medicare but billable under Medicaid; scripted QA protocol proves G0023/G0024 unit math (75 min → 1 base; 105 min → 1 base + 1 add-on).
- **Verification** ✅ — `npm run verify:billing` runs ~40 assertions covering payer configs, unit math, validation messages, and CSV format.
- **Known inconsistencies** ⚠️ — **four different revenue models coexist**: the claims engine/payer config ($125/$62.50), the patient billing progress bar's own hardcoded "2024 CMS" table ($78/$39/$72/$36), the ROI dashboard's flat $100/hour heuristic, and a legacy aggregator's defaults. The patient-facing billing progress bar is **hardcoded to Medicare 60-min logic and ignores the active payer**, so it can disagree with the Claims Manager. A richer legacy aggregator (consent checks, initiating-visit validation, Z-code diagnoses) exists but is unwired. Claims have no post-export lifecycle (no submitted/paid/denied). Member IDs are synthesized; rendering provider is hardcoded "Dr. Supervising MD."

### 5.5 Supervisor Oversight

- **Team dashboard** ✅/🎭 — KPI cards, embedded referral queue, compliance gauges (team-averaged), navigator scorecards (low performer <220 units highlighted), adverse-event tracking. Scoped by a hardcoded supervisor ID.
- **Safety Map** ✅ map / 🎭 data — **real Leaflet/OpenStreetMap map** of Phoenix with custom status pins: green pulsing (active), gray (idle), red vigorously-pulsing with "!" (RISK ALERT — seeded as "checked into a high-risk home visit 2 hours ago, no check-out, battery 15%"). Sidebar navigator list pans the map; popups show last check-in and battery. **All locations are seeded — no real geolocation, no real check-in threshold logic, the "Call Now" button has no handler, Refresh fetches nothing, and there is no SOS/panic feature.** `npm run verify:safety-map` asserts the seed-data invariants.
- **Navigator directory & detail** ✅/🎭 — team table (load status, compliance, MTD units, unread messages) drilling into a detail view (roster, compliance gaps, nudge history). ⚠️ Average visit time is `35 + random(20)`; phone/email/region are synthesized.
- **Compliance view** ✅ — medication-risk tiers (critical <50%, warning 50–80%) and PCP follow-up gaps; read-only analytics.
- **Adverse events view** ✅ — collapsible event cards by status with care-team info (supervisor name hardcoded).
- **Team scheduling** ✅ — day/week team calendar with shift bands and event blocks; Add Shift modal (region, recurrence, day-of-week, publish flag). ⚠️ Calendar caps at first 6 navigators; the "Add" vs "Add and Publish" buttons have their publish flags swapped; a richer validation module (overlap/travel-time/double-booking/safety-risk rules) exists but is mostly unwired; travel times come from a hardcoded zip-pair matrix.

### 5.6 Patient Portal

✅ Health dashboard (welcome, stats, care-navigator contact card), appointments (upcoming/past with reschedule-request → pre-filled chat message), medications with refill dates, care-plan tab with Recharts goal-trend graphs, profile. 🎭 Health goals on the profile are 4 hardcoded statics; the weekly "compliance tracker" is a demo proxy computed from the medication compliance ratio. Demo persona Elena Rodriguez (new, uncommitted) supports a direct patient-portal login from the role selector.

### 5.7 Messaging

✅ UI / 🎭 transport — role-aware chat (supervisor↔navigators, navigator↔supervisor/biller/patients, patient↔navigator), threads, unread counts, nudges with "View Patient Record" deep links, draft-message handoff from other screens. Entirely in-memory/localStorage — no real-time transport, no notifications.

### 5.8 Admin / Governance

✅ Payer rate card management (edits flow into the executive revenue calc and write audit entries), audit log viewer (13 action types), demo reset. Dynamic revenue = completed visits × matched payer rate (⚠️ payer names between the rate card and patient records only partially match; fuzzy matching falls back to $150).

### 5.9 Executive Dashboards

- **Classic dashboard** 🎭 — the headline numbers are static seed (`$714,000` revenue, 12.5% growth, 400 patients, all charts): only a small "dynamic revenue" delta from completed demo appointments and live referral counts move.
- **ROI / Program Health dashboard** ✅/🎭 — genuinely computed: active patient count, est. monthly revenue ($100/hr heuristic), unassigned referral rate, burnout risk (% navigators >90% caseload), caseload distribution chart, stale referrals >48h. Hardcoded: compliance rate (98%) and average turnaround (2.4 days).

---

## 6. Demo Infrastructure

- **Seed data** (`lib/initial-data.ts`, ~2,260 lines): 10 users, 11 navigators (3 with full matching attributes: Maria Gonzalez — Glendale/bilingual/35 of 50; John Mitchell — Mesa/English/48 of 50; Sarah Thompson — Downtown/English/10 of 50), 8 hand-crafted patients (including QA fixtures: Sam Underwood for the billing guardrail, Mary Jenkins with intentionally missing ICD codes, Elena Rodriguez for the portal demo), 6 referrals built to exercise the matching engine, 17 time logs authored to hit specific billing thresholds, 3 navigator locations for the safety map, plus care plans, templates, shifts, audit logs.
- **Date rebasing** (uncommitted) keeps all of this looking current on any demo day.
- **Demo reset** — one click in Admin restores initial state.
- **QA scripts** — written demo runbooks with talk tracks (`docs/QA_PROTOCOL_BILLING_BRIDGE.md`, `docs/QA_PROTOCOL_SAFETY_MAP.md`, `docs/ENGINEERING_QA_CHECKLIST.md` for the matching engine) and two automated verifiers (`npm run verify:billing`, `npm run verify:safety-map`).

---

## 7. Uncommitted Work in Progress (current working tree)

1. **Date rebasing** — `lib/date-rebase.ts` + store integration (schema bumped to v10) so demo data never looks stale.
2. **Navigator "My Patients" page** — new dedicated roster view replacing the dashboard fallback.
3. **Elena Rodriguez patient-portal persona** — full patient record + pharmacy-pickup appointment; role selector now logs patient cards in as that specific patient.
4. **Gemini model upgrade** — scribe moved from `gemini-1.5-flash` to `gemini-2.5-flash`.
5. **Billing demo tuning** — time-log adjustments so James Thompson totals 105 min (base + add-on demo) and Robert Wilson lands in "Needs Attention" under Medicare (45 min).
6. Minor: negative "days since contact" clamped to 0.

---

## 8. Master Real-vs-Simulated Table

| Capability | Verdict |
|---|---|
| Speech-to-text transcription | ✅ Real (Web Speech API, Chrome/Edge) |
| Gemini transcript → structured note | ✅ Real with API key; 🎭 silent mock fallback without |
| CMS billing math (G-codes, Rule of Eights) | ✅ Real, test-covered |
| Claims CSV export | ✅ Real format; 🎭 synthesized member IDs, no clearinghouse |
| Matching engine scoring | ✅ Real algorithm; 🎭 hardcoded zip-distance table |
| ICD-10 search/coding | ✅ Real (~528-code local dataset) |
| Encounter timer & audit provenance | ✅ Real |
| Supervisor safety map | ✅ Real map; 🎭 all positions/statuses seeded, no live GPS, no SOS |
| Navigator route map | 🎭 Fake stylized map (not Leaflet) |
| EHR/HL7 "AMD Integration" | 🎭 Cosmetic labels on seed data |
| EVV check-in GPS | 🎭 Hardcoded Phoenix coords fallback |
| Messaging | 🎭 In-memory only, no transport |
| Authentication / sessions | 🎭 Role picker, nothing persisted |
| Data persistence | 🎭 localStorage only — no database, no server, no multi-user |
| Executive headline KPIs | 🎭 Mostly static seed values |
| Notifications (bell, badges) | 🎭 Hardcoded |
| Exec Revenue/Performance/Patients views | 🚧 "Coming Soon" placeholders |

---

## 9. Known Gaps & Tech Debt (candidate PRD inputs)

**Product-level gaps (no implementation at all):**
- Real authentication, sessions, RBAC enforcement (roles are cosmetic; any visitor can be anyone)
- Backend/database/API — everything is one browser's localStorage; zero multi-user capability
- Real EHR/HL7/FHIR referral ingestion (currently cosmetic)
- Real geolocation for the safety map + actual check-in/check-out and SOS/escalation mechanics
- Claims lifecycle past export (submitted/accepted/denied/paid, remittance)
- Real-time messaging, push notifications, the notification bell
- Geocoding/routing (all distances and travel times are lookup tables)
- HIPAA posture: audit log exists as a demo, but there's no access control, encryption story, or server-side anything
- Mobile: fixed 256px sidebar desktop layout; field navigators would need mobile/responsive or native
- Three executive placeholder views (Revenue, Performance, Patients)

**Consistency debt (built twice or contradicting itself):**
- Four coexisting revenue models with different rates; patient billing bar ignores the active payer
- Two messaging systems (legacy nudges vs unified DMs); two-plus referral-intake implementations
- Intake acuity score (0–12) disconnected from matching acuity (L1–L3)
- Navigator identity (User) vs KPI record (Navigator) duality with partially mismatched IDs; hardcoded ID→name maps in billing
- Richer scheduling validator and billing aggregator exist but are unwired
- Payer-name mismatches between rate cards and patient records
- Supervisor scoping hardcoded to one supervisor; team calendar capped at 6 navigators; publish buttons swapped in Add Shift

---

## 10. Suggested Framing for the Gap Analysis

When comparing this document against the Gellert Health demo recording/transcripts, useful questions per feature:
1. Was the feature **shown** in the demo, and did the talk track promise more than the SIMULATED reality (e.g., "the system flagged John automatically" — the flag is seed data)?
2. Which SIMULATED items did Gellert react to most strongly? Those are the highest-priority "make it real" PRD items (likely candidates: safety map live tracking, EHR referral ingestion, claims lifecycle, multi-user persistence).
3. Which REAL items need hardening rather than building (AI scribe fallback transparency, billing model unification, matching engine with real geocoding)?
4. What did Gellert ask for that has **no counterpart at all** in section 9's gap list? Those are net-new PRD scope.
