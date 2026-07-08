# Mach 1 Care Navigator — Comprehensive Current-State Overview

**Prepared:** 2026-07-08 (supersedes the 2026-07-06 edition, which described the post-hardening / pre-Gellert-transplant demo)
**Purpose:** A factual, code-verified snapshot of the Mach 1 Care Navigator platform (built for Gellert Health). Written to be fed to an LLM alongside demo recordings, transcripts, and planning documents so gap analyses and PRDs are grounded in what the code actually does.

**What changed since the last edition:** the "Gellert logic transplant" — a four-phase blitz that encoded Gellert's three operating documents directly into the platform. Pillar 1 (WorkFlow2025 map + Playbook SOPs): a full referral CRM with a 9-state pipeline, 5-gate eligibility decision tree, 7-attempt outreach log with a 24–48h first-contact SLA clock, and a post-conversion patient journey engine (Intake 1 & 2 checklists, PCP-within-7-business-days countdown, 3-no-show MIA closure, graduation → telenavigation → re-engage/exit through the five documented pathways) with a live kanban Journey Board. Pillar 2 (the Note-Taking Manual): eight Gellert note templates, a compliance rules engine that cites the manual and blocks signing on hard failures, chart auto-fill of provider/standing-fact fields, supervision notes pinned to the top of the record, and a same-day continuation-note model. Pillar 3 (Sonya's billing world + Playbook §5 + Mitch's zones): daily charge slips with a Sign & Submit day-close, DAP pend/reprocess handling for unknown remark codes, a denial work queue, per-navigator productivity vs 16/18/20 level targets, coverage zones with windshield-time math, and the three formerly-placeholder executive views built for real. Three new verify suites joined the original three.

**How to read this document:** every capability is flagged:
- ✅ **REAL** — genuinely functional logic; would need hardening, not building, for production
- 🎭 **SIMULATED** — works in the UI but is driven by seeded data or a simulator standing in for an external counterparty
- 🚧 **PLACEHOLDER** — a "Coming Soon" stub

The architecture remains **deliberately demo-tier in one dimension**: there is no backend. That decision was made explicitly (backend migration deferred); everything else was built with clean seams so the swap is contained.

---

## 1. Product Identity

**Elevator pitch:** A multi-role healthcare navigation platform for CMS Community Health Integration (CHI) and Principal Illness Navigation (PIN) programs, now tailored to Gellert Health's peer-support navigation model. Referrals run a real CRM pipeline (eligibility → SLA-clocked outreach → agreement → zone-aware assignment); patients move through the WorkFlow2025 journey phases (intake checklists → active navigation → graduation to telenavigation → documented exit); navigators document encounters with an AI scribe whose output is validated against Gellert's own note-taking manual and close their billing day by signing charge slips; a Revenue Cycle Manager walks claims through a full X12 lifecycle including a denial work queue and DAP incentive pend/reprocess; executives get real Performance, Revenue, and Patient-insight views computed from live data.

**The demo narrative ("Golden Thread"), extended:** an HL7 referral arrives (paste or simulate) → the 5-gate eligibility tree accepts it, starting the 48h contact clock → outreach attempts are logged (7 max, auto-close unreachable) until the patient agrees → Match & Assign scores every navigator on geography/language/caseload/acuity **plus same-zone credit** → conversion creates the patient in Intake phase with the Intake 1 & 2 checklists and a PCP-within-7-business-days deadline → the navigator schedules a typed encounter, hits **Document Visit**, and the pre-selected Gellert template is dictated, AI-structured, auto-filled from the provider directory/standing facts, checked against the manual's compliance rules, and signed → the signed note creates a verified time log → at day's end the navigator signs the day's charge slips (per-day Rule of Eights units, sub-8-minute coaching hints) → the Revenue Cycle Manager exports a real 837P, adjudicates via the clearinghouse simulator, imports an 835 — including the UHC DAP scenario, where an unknown incentive code pends for review instead of misposting, gets classified, and reprocesses to PAID at 101% → denials land in a work queue with aging buckets → the executive Performance/Revenue/Patients views move.

**Setting:** Phoenix, AZ metro seed data. Payers: Arizona Medicaid/AHCCCS (H-codes, Rule of Eights), Medicare PIN/CHI (G-codes), plus commercial rate cards — unified into one `Payer` entity with aliases and EDI IDs. Six coverage zones seeded (Gellert runs 11).

---

## 2. Tech Stack & Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | shadcn/ui (Radix), Tailwind CSS v4, Lucide, Geist |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet (OpenStreetMap) — supervisor safety map (now with zone overlays) AND navigator route map |
| AI | Gemini 2.5 Flash via a server action (`GEMINI_API_KEY`); browser Web Speech API for dictation; prompt now enforces the Gellert manual's style (third person, H:MMAM/PM times, chronological, direct quotes) |
| EDI | In-repo X12 modules: 837P generator, 835 parser, remittance matcher, deterministic 835 simulator (incl. a DAP_ADJUSTMENT scenario with negative CAS adjustments) |
| Geo | Haversine adapter (`lib/geo.ts`) behind a `GeoProvider` interface; AZ zip centroid table; browser geolocation helper; zone model layered on top (`lib/zones.ts`) |
| State | React context (`lib/demo-data-context.tsx`) over a versioned localStorage store — **no external state lib, no database, no API routes** (one Gemini server action) |
| Quality gates | Six verify suites — `verify:billing` (21), `verify:safety-map` (12), `verify:claims` (43), `verify:journey` (5 + 9 across two scripts), `verify:notes` (7), `verify:gellert` (12) — plus tsc/eslint at zero errors |
| Deployment | Dockerfile on DigitalOcean App Platform |

**Architectural facts that shape any roadmap:**
- **Single-page app, no routing.** `app/page.tsx` is the only route; views are React state. No URLs/deep links.
- **No backend.** All domain logic is client-side against localStorage (debounced writes + `beforeunload` flush; schema-versioned reseed, **now v13** — the Gellert blitz bumped it once for journey/providers/standing-facts/charge-slips/zones slices). *Deliberate seams for the future swap:* every mutation flows through context actions; business logic lives in pure `lib/` modules (referral pipeline, journey engine, note compliance, charge slips, zones, productivity, and playbook KPIs are all backend-portable, same as the claims/EDI/geo/safety modules before them); external integrations sit behind adapter interfaces.
- **Authentication is a role picker.** No sessions, no RBAC enforcement. Six roles: executive, supervisor, navigator, patient, admin, biller.
- **Demo-time semantics are centralized.** `lib/date-rebase.ts` shifts operational seed dates to the local calendar "today" on load (DOBs/enrollment frozen) — which is how the seeded SLA-breached referral, the overdue telenavigation check-in, and today's unsigned charge slips are live tension on every fresh load.
- **Persistence is trustworthy.** State survives refresh; demos reset via Admin → Reset Demo Data.
- **Domain state machines are explicit.** Referral statuses (`lib/referral-pipeline.ts`) and journey phases (`lib/journey.ts`) use transition matrices exactly like the claim lifecycle — illegal transitions are structurally impossible, and the verify suites replay every seeded history through the matrices.

---

## 3. Roles & Views

| Role | Views | Status |
|---|---|---|
| **Executive** | Overview (live-computed, + compact referral funnel), **Revenue Analytics** ✅, **Performance Metrics** ✅, **Patient Management (insights)** ✅, Revenue Cycle Manager | All real — the three former placeholders were built in this blitz |
| **Supervisor** | Overview (+ Pipeline Health card), Safety Map (+ zone overlays), **Referral CRM** (pipeline + funnel tabs, HL7 ingest), **Journey Board** (WorkFlow2025 kanban), Navigators (+ Zone Coverage), Team Schedule, Compliance, Adverse Events, Messages, Match & Assign workspace (+ zone chips, agreed-referral guard) | All real |
| **Navigator** | Overview (+ SOS, telenavigation due/overdue banner, **Today's Charge Slips day-close panel**), My Patients (+ journey-phase chips/filter), Schedule (+ encounter types, **Document Visit**, route map, EVV), Notes/Clinical Feed (supervision notes pinned), Messages, Assessment Wizard | All real |
| **Patient** | My Health, Appointments, Medications, Messages, My Profile | All real |
| **Admin** | Overview, Payer management, Remark Codes (+ classification), Organization settings, Audit Log (39 action types), Revenue Cycle Manager, Reset Demo | All real |
| **Biller** | Revenue Cycle Manager — **4 tabs**: Ready to Bill / Needs Attention / **Denials** (work queue) / Ledger (+ DAP pend review) | All real |

Header: live unread badge (messages + nudges) and a working patient search for supervisor/navigator roles.

---

## 4. Feature Inventory

### 4.1 Referral CRM (Supervisor) — front of funnel
- **HL7v2 ingestion** ✅ — real parser (MSH/PID/DG1/IN1/PV1, warnings-not-throws) behind a `ReferralSourceAdapter` interface. "Paste HL7…" accepts arbitrary messages; "Simulate Incoming Referral" generates round-trip-verified ADT^A04 messages (12 curated personas, then a combinatorial fallback — never duplicates an existing person). 🎭 The *feed* is simulated; a FHIR R4 adapter stub marks the future integration slot.
- **9-state pipeline** ✅ — received → ineligible / accepted → outreach → unreachable / declined / agreed → intake_scheduled → converted, enforced by a transition matrix (`lib/referral-pipeline.ts`). The right-hand pane is status-aware: eligibility checklist for received, outreach log for accepted/outreach, conversion form for agreed, read-only summary for terminal states.
- **5-gate eligibility decision tree** ✅ — insurance / service area / medical need / level of care / age, short-circuiting: the first "No" names the ineligibility reason and offers **Close as Ineligible & Notify Referring Provider**; all-Yes offers **Accept — 48h Contact Clock Starts**. 🎭 *Provider "notification" is an audit event + toast* — there is no fax/Direct-messaging transport.
- **Outreach engine with SLA clock** ✅ — up to 7 logged attempts (channel, disposition, note), a color-coded SLA chip (green <24h, amber 24–48h, red breached — computed from `acceptedAt`), a **Patient Agreed** fast path at any attempt, and auto-close to unreachable at the 7th failed attempt. One seeded referral (William Anderson) loads SLA-breached; another (George Taylor) sits at 3/7 attempts. 🎭 Attempts are *manual attestations* — no telephony/SMS integration.
- **Funnel & source scorecard** ✅ — funnel bars across the pipeline plus a per-source conversion scorecard (seeds weight St. Joseph's as the dominant source; overall conversion ≈ 25%, matching Gellert's stated 20–30%). A compact funnel card also renders on the executive overview.
- **Conversion semantics encode Gellert's rule** ✅ — a patient record is created **only at assignment of an agreed referral** (`acceptReferral` guards on agreed/intake_scheduled), mirroring "not entered into AMD until they accept services." Conversion stamps `journeyPhase: "intake"`, builds the Intake 1 checklist, and sets `pcpDueBy` = today + 7 business days.
- **Match & Assign** ✅ — the scoring engine (distance/caseload/language/acuity) now takes zones: **+15 same-zone credit** with a match reason, zone chips on match cards, and a guard banner that blocks assignment until the referral is agreed. Distances remain haversine-from-zip-centroids (🎭 simulator tier).

### 4.2 Patient Journey Engine
- **Stored phases + transition matrix** ✅ — intake → active → telenavigation ⇄ active → exited (`lib/journey.ts`); adverse events are a **derived overlay**, never a stored phase. Seeded journey histories replay legally through the matrix (verify:journey).
- **Journey Board (supervisor)** ✅ — kanban of the four phases, one card per patient with phase-relevant stats and adverse-event badges; click-through to the chart. This is the WorkFlow2025 page, live.
- **Journey tab on the patient chart** ✅ — phase chip in the header; tab composes IntakeChecklist (intake phase), GraduationPanel, and JourneyTimeline.
- **Intake 1 & 2 checklists** ✅ — 8-item and 3-item checklists per the playbook, per-item check-off, **Complete Intake 2 → Active Navigation**, PCP-deadline countdown badge (business-day aware), a **Record No-Show** counter where the third no-show invokes the closure protocol (MIA exit, confirmed via dialog), and a **Notify Referring Provider** CTA (🎭 audit event + toast, as above).
- **Graduation → telenavigation** ✅ — navigator **flags graduation readiness**; supervisor **confirms** (Confirm Graduation → Telenavigation); telenavigation runs a monthly check-in cadence with due/overdue status. One seeded patient (Helen Garcia) loads ~5 days overdue, surfacing a banner on her navigator's dashboard with **Record Monthly Check-in** and **Re-engage Patient** actions.
- **Program exit** ✅ — the five documented pathways (patient-initiated, ineligibility, MIA, deceased, safety); patient-initiated requires supervisor confirmation; exit also sets survival status inactive.

### 4.3 Gellert Note System & AI Scribe
- **Eight Gellert templates** ✅ (`lib/gellert-templates.ts`) — Phone Call, Medical Appointment ± Transit, Behavioral Health ± Transit (SI/HI/AH/VH screen), Lab/Imaging, Medication Assistance (verbatim no-touch attestation), SDOH/Resource Navigation, Multidisciplinary Continuation (non-billable), Supervision Note (non-billable) — with section groupings, never-skip flags, and third-person narrative fragments closing with "Total = X minutes."
- **Compliance engine** ✅ (`lib/note-compliance.ts`) — nine rules, each carrying a **direct manual citation**, rendered as a full checklist panel in the note builder. Blocking (fail) rules stop the signature: empty patient involvement ("NO PATIENT INVOLVEMENT = NO BILLING"), narrative total ≠ timer total, missing med no-touch language, unanswered BH safety screen. Warning rules: first person outside quotes, non-manual time formats, missing closing presence phrase, aggression language without quotes, transport narrative duplicated into a continuation note.
- **Chart auto-fill (the cut-and-paste killer)** ✅ (`lib/note-autofill.ts`) — provider name/practice/address from a 9-entry provider directory, standing patient facts (the seeded diabetic-with-colonoscopy-due patient is Mitch's exact anecdote), appointment context, and previous-note recall for repeat visits to the same provider. Auto-filled fields carry a sky-blue "Auto-filled from chart" badge (distinct from the violet AI badge); a manual edit takes ownership.
- **Encounter-type-aware scheduling → documentation** ✅ — New Appointment captures an encounter type; the appointment card's **Document Visit** button opens the note builder with the correct Gellert template pre-selected (appointment type is known at scheduling time — Mitch's key insight).
- **AI scribe** ✅ — dictation (Web Speech API) or Load Sample (three Gellert-tagged transcripts written to hit every never-skip field); Gemini structuring now enforces manual style (third person "Navigator", H:MMAM/PM, chronological, direct quotes, attestation truthfulness, provider options constrained to the directory). Honest failure modes preserved: labeled Demo Mode without a key (mock data covers the Gellert field ids), red failure banner with Retry on errors, per-field confirmation for fuzzy matches.
- **Supervision notes** ✅ — supervisor/admin-authored, non-billable, no time log; **pinned** at the top of the patient record and in a pinned section of the clinical feed with amber badging (the manual's "most important note on the chart").
- **Same-day continuation model** ✅ — a second billable-template note on the same patient-day becomes a linked continuation: the primary note carries the day total, the continuation creates **no TimeLog** (double-billing structurally prevented), and the compliance engine warns if transport narrative repeats.
- **Signed billable notes still create verified time logs** ✅ — the audit-proof timer + signature remains the verification mechanism feeding billing.

### 4.4 Revenue Cycle (Biller/Admin/Executive)
- **Claims engine, lifecycle, EDI, ledger** ✅ — unchanged from the prior edition (payer-agnostic validation guardrails, immutable ClaimRecord snapshots, real 837P/835, three-tier remittance matching, clearinghouse simulator behind an adapter).
- **Daily charge slips & day-close (Sonya's face sheet)** ✅ (`lib/charge-slips.ts`) — TimeLogs remain the single source of billing truth; a charge slip is a navigator's signature over a *derived* navigator-patient-day grouping with **per-day Rule of Eights units**. The navigator dashboard's "Today's Charge Slips" panel lists per-patient rows with units, an amber coaching hint on sub-8-minute days (a 6-minute patient-day is seeded), and **Sign & Submit Day**; signing persists the slip (frozen timeLogIds) and closes the day. ~7 workdays of slip history are seeded at ~90% same-day signing. **Units-math honesty:** Gellert bills daily, the claims engine bills monthly — Σ(daily units) ≠ monthly claim units in general, so UI copy distinguishes "daily units (charge slips)" from "claim units" and a verify block locks the contract. Ready-to-Bill rows show an *informational* "N unsigned slip-days" badge (never a validation error).
- **DAP pend/reprocess (the UHC false-denial fix)** ✅ code / 🎭 counterparty — the 835 simulator gained a **DAP_ADJUSTMENT scenario**: every claim paid at 101% with a negative CAS CO-144 adjustment and RARC N807. The seed remark-code dictionary **deliberately omits 144/N807** — their absence is the demo beat. Importing that remit **pends** the affected claims (advance to ACCEPTED + `pendedRemittance`; toast reports applied/pended/unmatched) instead of misposting; the ledger's **Needs Review** filter surfaces them; the expanded pend detail offers **Add code to dictionary** (inline dialog with an informational/adjustment/denial classification — the biller never has to leave the view) and **Reprocess pended remits**, which posts PAID with a **"+1% DAP"** badge on the paid amount. The Revenue Analytics view totals "DAP Incentive Recovered (CARC 144)." 🎭 The DAP 835 itself is simulator-generated — no live UHC remit.
- **Denial work queue** ✅ — a fourth **Denials** tab in the Revenue Cycle Manager: a persistent collections worklist of DENIED records with CARC/RARC + classification badges, aging buckets (0–7 / 8–30 / 31+ days), a per-claim work-status select, and one-click **Reopen for rebill**. This is the collections module Sonya's AMD setup lacks.
- **Remark-code classification** ✅ — the admin dictionary and seed codes now carry informational/adjustment/denial classifications, shown in ledger tooltips. 🎭 The dictionary is still manually maintained — no CMS code-set auto-sync (see gaps).

### 4.5 Playbook KPIs & Executive Views (all three now real)
- **Performance Metrics** ✅ — "the always-available face sheet": per-navigator table of avg units/day vs **level targets (L1 16 · L2 18 · L3 20)** with attainment, trend sparklines, day-close rate, and a **windshield time (unbillable)** column; plus the Playbook §5 KPI list — referral-accepted-within-48h, units/day attainment, daily-billing-submitted-by-EOD, PCP compliance, post-discharge follow-up, no-show rate, ED trend are **computed**, while "Patient Guide by Friday 4pm" renders as an **honest labeled placeholder** ("signal not yet captured" — the Patient Guide module doesn't exist). Per-navigator daily units reuse the charge-slip derivation, so productivity and billing are the same math by construction — the answer to per-navigator reporting under a single NPI.
- **Revenue Analytics** ✅ — collections vs billed, denial rate, Outstanding A/R with aging, payer mix, the DAP-incentive-recovered callout, caseload distribution, referrals by acuity (folds in the useful parts of the removed orphan ROI dashboard).
- **Patient Management (insights)** ✅ — Vivi's minable-data ask: ICD-prefix **condition click-boxes**, risk-tier distribution, SDOH barrier prevalence from documented Z-codes, visit counts; clicking any cohort filters an inline patient list.

### 4.6 Zones & Geo
- **Zone model** ✅ (`lib/zones.ts`) — 6 seeded Phoenix-metro zones (Gellert runs 11); patients/navigators resolve to zones by explicit id or address zip. **Zone Coverage card** in the Navigator Directory (per-zone census vs assigned navigators, uncovered-zone flag) — the institutionalized version of Mitch's weekly manual join; zone column on the roster.
- **Zone-aware matching** ✅ — +15 same-zone scoring credit with a visible match reason and zone chips in the Match & Assign workspace.
- **Windshield time** ✅ — per-navigator-per-day unbillable drive minutes summed across consecutive same-day in-person stops (via the geo adapter), labeled "windshield time (unbillable)" in the Performance view — the named margin lever.
- **Map overlays** ✅ shapes / 🎭 fidelity — zone circles + legend on the supervisor safety map (Show Zones toggle, zone filter). **Zone shapes are circle approximations** (centroid + padded radius); real polygons come with a real geo provider.
- Safety map, SOS, EVV, route map: unchanged ✅ (rules-computed status; 🎭 no real GPS transport without a backend).

### 4.7 Patient Portal, Messaging, Admin
Unchanged from the prior edition: portal ✅; messaging ✅ UI / 🎭 transport; admin governance ✅ (audit log grew to 39 action types with 15 new journey/billing actions).

---

## 5. Verification Infrastructure

Six suites, all green, plus tsc/eslint at zero errors:

- `npm run verify:billing` — **21 blocks**: payer configs, unit math, validation guardrails, seed referential integrity, persistence-version lock (now v13).
- `npm run verify:safety-map` — **12 checks**: seed/derivation consistency, SOS-forces-alert.
- `npm run verify:claims` — **43 checks**: transition matrix, snapshot immutability, 837P content, 835 round-trip, duplicate-import lock.
- `npm run verify:journey` — **5 + 9 checks** (two scripts): pipeline transition matrix, 5-gate short-circuit order, outreach auto-close at 7, SLA thresholds, funnel conversion within [20%, 35%], seeded referral/journey histories replay legally through the matrices (including after date-rebase), no-show closure protocol, telenavigation cadence.
- `npm run verify:notes` — **7 checks**: the money assertion — **every seeded Gellert note passes the compliance engine it demos** — plus template/field integrity, autofill resolution, supervision-note invariants (non-billable, no time log).
- `npm run verify:gellert` — **12 checks**: charge-slip derivation integrity, per-day Rule of Eights, signing idempotence, day-close rate, the daily-vs-monthly divergence contract, DAP 835 round-trip (negative CAS parses), pend/reprocess, MIXED-scenario no-pend regression, zone fixtures, store v13 lock.

QA runbooks: `QA_PROTOCOL_BILLING_BRIDGE.md`, `QA_PROTOCOL_SAFETY_MAP.md`, `ENGINEERING_QA_CHECKLIST.md`; `DEMO_WALKTHROUGH.md` is the unified end-to-end script and now includes the six Gellert demo beats (Parts 10–15).

---

## 6. Master Real-vs-Simulated Table

| Capability | Verdict |
|---|---|
| Speech-to-text dictation | ✅ Real (Web Speech API, Chrome/Edge) |
| Gemini note structuring (Gellert-style prompt) | ✅ Real with API key; labeled Demo Mode without (never mislabeled) |
| Referral pipeline (eligibility, outreach SLA, transition matrix) | ✅ Real state machine; 🎭 outreach attempts are manual attestations (no telephony/SMS), provider notifications are audit-event + toast stand-ins |
| Patient journey engine (phases, checklists, graduation/telenav/exit) | ✅ Real state machine + business-day math |
| Note compliance engine (manual citations, blocking rules) | ✅ Real — seeded notes pass their own engine (verify:notes) |
| Chart auto-fill (providers, standing facts, previous notes) | ✅ Real resolution logic over seeded directory data |
| Charge slips / day-close (per-day Rule of Eights) | ✅ Real derivation from TimeLogs; slips are signatures, not a second source of truth |
| CMS billing math + validation guardrails | ✅ Real, 21+43+12 automated checks |
| Claim lifecycle (export→submit→adjudicate→pay/deny→rebill) | ✅ Real state machine, immutable snapshots |
| DAP pend → classify → reprocess | ✅ Real code path; 🎭 the DAP 835 is simulator-generated |
| Denial work queue (aging, work status, reopen) | ✅ Real over live claim records |
| 837P generation / 835 parsing / remittance matching | ✅ Real X12 code; 🎭 clearinghouse is a simulator behind an adapter interface |
| HL7v2 referral parsing | ✅ Real parser; 🎭 feed is simulated (FHIR adapter stubbed) |
| Matching engine (+ zone credit) | ✅ Real scoring, live caseloads; 🎭 distances from zip centroids |
| Zones & windshield time | ✅ Real coverage/drive-time math; 🎭 zone shapes are circle approximations |
| Executive Revenue / Performance / Patients views | ✅ Real — computed from live data (placeholders eliminated) |
| Playbook KPIs | ✅ Computed, except "Patient Guide by Friday 4pm" — an honest labeled placeholder |
| Safety status rules + SOS + EVV geolocation | ✅ Real; 🎭 continuous positions simulated (no GPS transport without a backend) |
| Route & safety maps | ✅ Real Leaflet/OSM |
| ICD-10 coding | ✅ Real (~528-code dataset) |
| Persistence | ✅ Survives refresh; 🎭 localStorage only — single browser, no multi-user |
| Auth/sessions/RBAC | 🎭 Role picker only |
| Messaging transport, notifications | 🎭 In-memory |

---

## 7. Remaining Gaps (the honest roadmap)

**Requires a backend (the one deferred decision):** real auth/RBAC and sessions; database + API (multi-user, durable, HIPAA-relevant); real-time transport (live GPS, push notifications, live messaging); server-side audit integrity.

**Requires external counterparties (adapter slots already exist):** live clearinghouse credentials (`ClearinghouseAdapter`); live hospital HL7/FHIR feeds (`ReferralSourceAdapter`); routing/geocoding API (`GeoProvider` — also unlocks real zone polygons and road-accurate windshield time); EDI 270/271 eligibility (not yet stubbed); telephony/SMS integration so outreach attempts are captured rather than attested; a real provider-notification channel (fax/Direct messaging) behind the current audit-event + toast stand-in.

**In-app work not yet done:**
- **Patient Guide module** — the weekly Friday-4pm guide (playbook must-have #2) has no capture surface; its KPI is a labeled placeholder by design.
- **Daily vs monthly units reconciliation** — Σ(charge-slip daily units) and monthly claim units legitimately diverge under per-day vs per-month Rule of Eights; the divergence is labeled and verify-locked, but a reconciliation report that *explains* the delta per patient-month is future work (today it's a demo talking point).
- **CMS code-set auto-update** — remark-code classification made dictionary maintenance one click from the pend queue, but ICD/CPT/HCPCS/CARC-RARC sets still don't sync with CMS releases automatically (a Gellert must-ask).
- Carried forward: URL routing/deep links; mobile/responsive layout (field navigators need mobile); supervisor time-log verification UI (guardrail exists, review workflow doesn't); per-patient payer-driven claim generation (global payer selector remains); recurring appointments; care-plan authoring beyond the three seeded templates.

**Out of app scope but in the client relationship:** the referral team's scripts/process revamp (a playbook improvement target) and telenavigation billing rules (⚑ TBD with Gellert leadership) — the app models telenavigation cadence but takes no position on its billability.

---

## 8. Repo Map (orientation for an LLM)

- `lib/` — all business logic, backend-portable. *Pre-existing:* `claims-engine`, `claim-lifecycle`, `payer-config`, `billing-engine`, `edi/` (x12, 837P, 835 parser/simulator + DAP scenario, matcher), `clearinghouse/adapter`, `geo`, `safety-status`, `matching-logic` (now zone-aware), `acuity`, `referral-ingestion`, `executive-metrics`, `analytics-utils`, `schedule-utils`/`schedule-validation`, `narrative-generator` (now time/attestation/provider segments), `gemini-scribe` (server action, Gellert style block), `date-rebase`, `store` (v13), `demo-data-context`, `initial-data`, `types`. *New this blitz:* `referral-pipeline`, `referral-funnel`, `journey`, `business-days`, `note-taxonomy`, `gellert-templates`, `note-compliance`, `note-autofill`, `same-day-notes`, `charge-slips`, `remittance-review`, `zones`, `navigator-productivity`, `playbook-kpis`, `sample-transcripts` (+3 Gellert transcripts).
- `components/` — `billing/` (claims manager — 4 tabs, ledger + pend review, remittance import, **denial-work-queue**), `supervisor/` (safety map + zones, intake workspace + zone chips, **referral-review-view** (pipeline/funnel), **eligibility-checklist**, **outreach-log**, **referral-funnel**, **journey-board**, directory + zone coverage, HL7 dialog, compliance, adverse events), `navigator/` (patients + phase chips, schedule + Document Visit, route map, assessment wizard, clinical feed + supervision pinning, **day-close-panel**), `notes/` (note builder + compliance gating/autofill badges, **compliance-panel**, AI recorder, timer), `journey/` (**phase-chip, journey-timeline, graduation-panel, exit-dialog**), `intake/` (**intake-checklist**), `executive/` (**performance-view, revenue-analytics-view, patient-insights-view** — roi-dashboard removed), `patient/` + `patient-detail/` (Journey tab, supervision pinning), `messaging/`, `dashboards/`, `dashboard/` (shell), `schedule/`, `ui/` (shadcn).
- `scripts/` — seven verify scripts backing the six suites (`verify:journey` runs two). `docs/` — this file, `DEMO_WALKTHROUGH.md`, `CLIENT_CONTEXT.md`, three QA protocols.
