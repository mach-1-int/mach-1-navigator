# Mach 1 Care Navigator — Comprehensive Current-State Overview

**Prepared:** 2026-07-09 (supersedes the 2026-07-08 edition, which described the Gellert logic-transplant blitz)
**Purpose:** A factual, code-verified snapshot of the Mach 1 Care Navigator platform (built for Gellert Health). Written to be fed to an LLM alongside demo recordings, transcripts, and planning documents so gap analyses and PRDs are grounded in what the code actually does.

**What changed since the last edition:** the **"Gellert Ops Blitz"** — a three-phase push that closed every crosswalk gap that didn't require Gellert leadership input first. Nine parallel workstreams shipped: a **Template Editor** giving admins CRUD over note templates (duplicate/delete with an in-use guard, a field palette, and a live narrative preview so "editable templates" is now a UI, not just an architecture claim); a **documents & e-sign layer** — real ROI, navigation-contract, survey, med-list, photo, and onboarding-packet forms behind the intake checklist, with a typed-name demo e-signature, and the navigation contract now structurally **gates billing** ("Patient Agreement not signed" is a real claim-validation error, not prose); an **engagement task engine** — a "My Tasks" view driving the 48h/24h/day-of appointment confirmation cadence, same-day no-show recovery, 24-hour post-visit follow-up, and a weekly-contact cadence signal, feeding two newly-live playbook KPIs; a **clinical response workflow** — adverse events now generate a response task set (post-event contact, post-discharge PCP-within-7-business-days, post-discharge med reconciliation, risk-reduction education) with one click, and a first-class **escalation** object closes the raise → acknowledge → resolve loop with a supervisor nudge; **medication reconciliation as capture** — an editable med list with diff-classified reconciliation events that auto-check the intake checklist and feed the medication-assistance note template; **real (simulated) provider communications** — rendered, editable, `secmsg`-prefixed messages for intake/exit/ineligible/unreachable notifications with a preview-edit-send dialog and a per-referral history, replacing the old stamp-only stand-in, plus the one missing WorkFlow2025 map node (SOP 1.7 decision-making-capacity confirmation) is now a real gate in front of Intake 1 scheduling; a **navigator training/onboarding module** — a 90-day developmental tracker with 30/60/90-day reviews, a shadowing checklist, and certification that bumps compensation (+$2,500) and the units target (16→18); an **in-transit coaching field** (Connection/Preparation/Education/Reinforcement) inside transit-gated encounter notes; and a **Wallboard** — the daily-KPI screen the playbook's §9.1 meeting cadence calls for, with 7 live tiles. The persistence schema bumped to **v14**. `verify:ops` is a new chained suite of 8 scripts (67 blocks total) joining the original six suites, all green, alongside tsc/eslint at zero errors.

**How to read this document:** every capability is flagged:
- ✅ **REAL** — genuinely functional logic; would need hardening, not building, for production
- 🎭 **SIMULATED** — works in the UI but is driven by seeded data or a simulator standing in for an external counterparty
- 🚧 **PLACEHOLDER** — a "Coming Soon" stub

The architecture remains **deliberately demo-tier in one dimension**: there is no backend. That decision was made explicitly (backend migration deferred); everything else was built with clean seams so the swap is contained.

---

## 1. Product Identity

**Elevator pitch:** A multi-role healthcare navigation platform for CMS Community Health Integration (CHI) and Principal Illness Navigation (PIN) programs, tailored to Gellert Health's peer-support navigation model. Referrals run a real CRM pipeline (eligibility → SLA-clocked outreach → agreement → decision-capacity confirmation → zone-aware assignment); patients move through the WorkFlow2025 journey phases (intake checklists with real documents and e-sign → active navigation with a confirmation/follow-up task engine → graduation to telenavigation → documented exit); navigators document encounters with an AI scribe validated against Gellert's note-taking manual, work a task list that mirrors the playbook's engagement cadence, and close their billing day by signing charge slips only once a patient's navigation contract is signed; supervisors run a closed-loop escalation process and generate adverse-event response task sets; admins configure the note-template catalog directly; and executives (plus supervisors) get a live daily Wallboard alongside the Performance, Revenue, and Patient-insight views.

**The demo narrative ("Golden Thread"), extended again:** an HL7 referral arrives → the 5-gate eligibility tree accepts it, starting the 48h contact clock → outreach attempts are logged until the patient agrees → **decision-making capacity is confirmed (SOP 1.7)**, unlocking Intake 1 scheduling → Match & Assign scores every navigator (geography/language/caseload/acuity/zone) → conversion creates the patient in Intake phase with real documents behind the checklist → the navigator signs Walter Briggs's draft navigation contract, clearing his "Patient Agreement not signed" billing-gate error → scheduled appointments spawn 48h/24h/day-of confirmation tasks in **My Tasks**, worked from the red "Overdue" lane down → the navigator hits **Document Visit**, dictates into the pre-selected Gellert template (now with an in-transit coaching field when transport was provided), and signs a compliant note → an adverse event is logged and **Generate response tasks** creates the post-discharge PCP/med-rec/education set → an escalation is raised and closed loop through acknowledge/resolve → at day's end the navigator signs charge slips → the Revenue Cycle Manager runs the full X12 lifecycle including the DAP pend/reprocess fix → a navigator hits her 90-day certification milestone, her comp and unit target bump → the executive and supervisor **Wallboard** shows the whole operation's pulse on one screen.

**Setting:** Phoenix, AZ metro seed data. Payers: Arizona Medicaid/AHCCCS (H-codes, Rule of Eights), Medicare PIN/CHI (G-codes), plus commercial rate cards — unified into one `Payer` entity with aliases and EDI IDs. Six coverage zones seeded (Gellert runs 11).

---

## 2. Tech Stack & Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | shadcn/ui (Radix), Tailwind CSS v4, Lucide, Geist |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet (OpenStreetMap) — supervisor safety map (zone overlays) AND navigator route map |
| AI | Gemini 2.5 Flash via a server action (`GEMINI_API_KEY`); browser Web Speech API for dictation; prompt enforces the Gellert manual's style (third person, H:MMAM/PM times, chronological, direct quotes) |
| EDI | In-repo X12 modules: 837P generator, 835 parser, remittance matcher, deterministic 835 simulator (incl. a DAP_ADJUSTMENT scenario with negative CAS adjustments) |
| Geo | Haversine adapter (`lib/geo.ts`) behind a `GeoProvider` interface; AZ zip centroid table; browser geolocation helper; zone model layered on top (`lib/zones.ts`) |
| State | React context (`lib/demo-data-context.tsx`) over a versioned localStorage store — **no external state lib, no database, no API routes** (one Gemini server action) |
| Quality gates | Six pre-existing verify suites — `verify:billing` (21), `verify:safety-map` (12), `verify:claims` (43), `verify:journey` (5 + 9 across two scripts), `verify:notes` (7), `verify:gellert` (12) — **plus `verify:ops`, a chain of 8 new scripts (67 blocks total)** — and tsc/eslint at zero errors |
| Deployment | Dockerfile on DigitalOcean App Platform |

**Architectural facts that shape any roadmap:**
- **Single-page app, no routing.** `app/page.tsx` is the only route; views are React state. No URLs/deep links.
- **No backend.** All domain logic is client-side against localStorage (debounced writes + `beforeunload` flush; schema-versioned reseed, **now v14** — the ops blitz bumped it once for the six new state slices: `navigatorTasks`, `patientDocuments`, `medReconciliations`, `escalations`, `providerCommunications`, `navigatorOnboarding`). *Deliberate seams for the future swap:* every mutation flows through context actions; business logic lives in pure `lib/` modules (`task-engine`, `document-definitions`, `provider-comms`, `onboarding`, `engagement`, `template-editor` are all backend-portable, same as referral pipeline, journey, claims/EDI/geo/safety modules before them); external integrations sit behind adapter interfaces.
- **Authentication is a role picker.** No sessions, no RBAC enforcement. Six roles: executive, supervisor, navigator, patient, admin, biller.
- **Demo-time semantics are centralized.** `lib/date-rebase.ts` shifts operational seed dates to the local calendar "today" on load (DOBs/enrollment frozen) — which is how the seeded SLA-breached referral, the overdue telenavigation check-in, Walter Briggs's still-draft contract, and today's unsigned charge slips are live tension on every fresh load.
- **Persistence is trustworthy.** State survives refresh; demos reset via Admin → Reset Demo Data.
- **Domain state machines are explicit.** Referral statuses (`lib/referral-pipeline.ts`), journey phases (`lib/journey.ts`), and now escalation statuses (`lib/types.ts` — open → acknowledged → resolved, forward-only) use transition matrices exactly like the claim lifecycle — illegal transitions are structurally impossible, and the verify suites replay every seeded history through the matrices.
- **Task generation is derivation, not a ticking background job.** `generateDueTasks()` (in `lib/demo-data-context.tsx`) recomputes confirmation/follow-up/no-show tasks from appointments plus existing tasks on component mount (Tasks view, navigator dashboard, "Confirm now" clicks) — deterministic task ids (`task-{type}-{refId}`) make regeneration idempotent by construction, verified by `verify-ops-tasks.ts`.

---

## 3. Roles & Views

| Role | Views | Status |
|---|---|---|
| **Executive** | Overview (live-computed, + compact referral funnel), **Revenue Analytics** ✅, **Performance Metrics** ✅, **Patient Management (insights)** ✅, Revenue Cycle Manager, **Wallboard** ✅ (new) | All real |
| **Supervisor** | Overview (+ Pipeline Health card), Safety Map (+ zone overlays), **Referral CRM** (pipeline + funnel tabs, HL7 ingest, capacity-confirmation gate), **Journey Board** (WorkFlow2025 kanban), Navigators (+ Zone Coverage, **Onboarding column**), Team Schedule, Compliance, Adverse Events (+ **Generate response tasks**), **Wallboard** ✅ (new), Messages, Match & Assign workspace (+ zone chips, agreed-referral guard) | All real |
| **Navigator** | Overview (+ SOS, telenavigation banner, tasks-due-today strip, Today's Charge Slips day-close panel), **My Tasks** ✅ (new), My Patients (+ journey-phase chips/filter), Schedule (+ encounter types, Document Visit, confirmation-touch tracking, route map, EVV), Notes/Clinical Feed (+ **Raise Escalation**, supervision notes pinned), Messages, Assessment Wizard | All real |
| **Patient** | My Health, Appointments, Medications, Messages, My Profile | All real |
| **Admin** | Overview, **Note Templates** ✅ (new — Template Editor), Payer management, Remark Codes (+ classification), Organization settings, Audit Log, Revenue Cycle Manager, Reset Demo | All real |
| **Biller** | Revenue Cycle Manager — 4 tabs: Ready to Bill / Needs Attention / Denials (work queue) / Ledger (+ DAP pend review) | All real |

Header: live unread badge (messages + nudges) and a working patient search for supervisor/navigator roles.

---

## 4. Feature Inventory

### 4.1 Referral CRM (Supervisor) — front of funnel
- **HL7v2 ingestion** ✅ — real parser behind a `ReferralSourceAdapter` interface. "Simulate Incoming Referral" never duplicates an existing person. 🎭 The *feed* is simulated.
- **9-state pipeline** ✅ — received → ineligible / accepted → outreach → unreachable / declined / agreed → intake_scheduled → converted, transition-matrix enforced.
- **5-gate eligibility decision tree** ✅ — insurance / service area / medical need / level of care / age. 🎭 Provider "notification" for ineligible closes is a rendered, editable, honestly-labeled-simulated message (see 4.1a) — no longer a bare stamp.
- **Outreach engine with SLA clock** ✅ — up to 7 attempts, color-coded SLA chip, auto-close to unreachable at attempt 7.
- **Decision-making capacity confirmation (SOP 1.7)** ✅ **NEW** — on the Convert-to-Patient panel, a **"Confirm decision-making capacity (SOP 1.7)"** checkbox must be checked before the **"Schedule Intake 1"** date/time/navigator block unlocks; confirming stamps `referral.decisionCapacityConfirmed {confirmedBy, confirmedAt}` and toasts "Decision-making capacity confirmed — SOP 1.7 — Intake 1 can now be scheduled." This closes the WorkFlow2025 map's one previously-❌ node.
- **Funnel & source scorecard** ✅ — unchanged; ~25% conversion, St. Joseph's dominant source.
- **Conversion semantics encode Gellert's rule** ✅ — a patient record is created only at assignment of an agreed referral.
- **Match & Assign** ✅ — zone-aware scoring (+15 same-zone credit).

### 4.1a Provider Communications (NEW — SOPs 1.6, 2.6, 6.7; playbook §3.3)
- **Rendered, editable, simulated-and-labeled-honestly messages** ✅ (`lib/provider-comms.ts`, `components/supervisor/provider-comm-dialog.tsx`) — four message types (Intake Notification, Exit Notification, Ineligible Notification, Unreachable Notification), each a real plain-text template with a `secmsg:` subject prefix (e.g. `secmsg: Navigation intake completed — {patient}`) matching the playbook's email convention. The **ProviderCommDialog** is a genuine preview → edit → send flow: the rendered subject/body populate editable fields, an amber banner states *"Simulated — no real message leaves the system; Direct/fax integration slots in later,"* and the send button is explicitly labeled **"Send (simulated)"**. Sending calls `notifyReferringProvider`, which stamps `providerNotifiedAt` on the referral/intake record *only at send time* — auto-close (unreachable/declined) and ineligible-close no longer pre-stamp it, so the Notify/Resend UI always reflects whether a message was actually reviewed and sent. (One exception, unchanged from before this blitz: `exitProgram`'s `ProgramExit.providerNotifiedAt` field — a separate field from the referral/intake one — still auto-stamps at exit time regardless of whether a comm was sent; it's a pre-existing stamp-only pattern this blitz did not touch.)
- **Per-referral history** ✅ — a `CommunicationsHistoryStrip` on the referral detail panel lists every sent communication (subject, type badge, timestamp, sender), newest first.
- 🎭 Still simulated: no fax/Direct-messaging transport exists; this is the honest demo-tier stand-in the crosswalk called for.

### 4.2 Patient Journey Engine
- **Stored phases + transition matrix** ✅ — unchanged (`lib/journey.ts`).
- **Journey Board (supervisor)** ✅ — unchanged.
- **Intake 1 & 2 checklists — now backed by real documents** ✅ **UPGRADED** (see 4.2a) — checklist items with a mapped document render a status badge (Not started/Draft/Completed/Signed) and an **"Open document"** button instead of a bare checkbox; unmapped items remain plain checkboxes.
- **Graduation → telenavigation, program exit** ✅ — unchanged.

### 4.2a Documents & E-Sign (NEW — SOPs 2.3, 2.7; playbook §4 billing gate)
- **Six document types** ✅ (`lib/document-definitions.ts`): Release of Information (ROI), Patient Navigation Agreement (navigation contract), Intake Survey, Medication List, Patient Photo, Onboarding Packet. Each is a real fillable form component under `components/documents/` (`roi-form`, `contract-form`, `survey-form`, `med-list-form`, `photo-capture`, `onboarding-packet-form`), opened from the intake checklist via `DocumentDialog`.
- **Demo e-signature** 🎭 honestly labeled — `signature-panel.tsx` carries a badge reading *"demo e-signature — DocuSign-class integration slots in later"*; signing is a **typed name** plus a "Signing as" radio (Patient / Guardian / Authorized representative). ROI and the navigation contract require this signature (status flows `not_started → draft → signed`); the other four terminate at `completed`.
- **Navigation contract is now the real billing gate** ✅ (`lib/claims-engine.ts` `validateClaimData`) — when a `signedContractPatientIds` set is supplied and a patient isn't in it, claim validation fails with the exact error **"Patient Agreement not signed"** — this is playbook §4's "no billing before signed Patient Agreement" rule enforced structurally, not just checklisted.
- **Walter Briggs is the live demo beat** — seeded with ROI/med-list/photo/packet all `completed`/`signed`, but his **navigation contract sits in `draft`** — signable live in a demo. Signing it clears his billing-gate error.
- **Verified:** `verify-ops-documents.ts` (6 blocks) — lifecycle round-trips for signature and non-signature documents, checklist-item↔document mapping for all 6 types, the claim-validation gate itself, and seed integrity (Walter's draft, other actives signed).

### 4.3 Gellert Note System & AI Scribe
- **Eight Gellert templates** ✅ — unchanged families, now with one addition:
- **In-transit coaching field** ✅ **NEW** (`lib/gellert-templates.ts`, SOP 3.5) — inside the Medical Appointment ± Transit and Behavioral Health ± Transit templates, a multi-select badge-pill field labeled **"In-transit coaching delivered"** appears only when `transport-provided` is true (`showIf` gate). The four selectable options are the playbook's exact protocol: **"Connection — rapport check-in," "Preparation — what to expect," "Education — condition basics," "Reinforcement — adherence importance."** Rendered as clickable outline/filled badges in the note builder, not free text — closing the "no UI presence" gap from the prior edition.
- **Compliance engine, chart auto-fill, encounter-type-aware scheduling, AI scribe, supervision notes, same-day continuation model** ✅ — all unchanged from the prior edition.
- **Template Editor (Admin)** ✅ **NEW** (`lib/template-editor.ts`, `components/admin/template-editor-view.tsx`, `template-field-editor.tsx`, `template-preview.tsx`) — a full admin CRUD screen, reachable from the sidebar **"Note Templates"** item. The template list ("**{N} templates on file ({N} system, {N} custom)**") supports **"New template,"** per-row **"Duplicate,"** **"Edit,"** and **"Delete"** actions. Delete is guarded: a template referenced by any saved note is disabled with the tooltip *"{N} saved notes were written from this template"* and a confirming attempt fails with *"Cannot delete '{name}' — existing notes were written from it."* The field editor supports the full palette (text/select/multi-select/time/provider/attestation), section grouping, Required/Never-skip switches, narrative-fragment editing (prefix/suffix/joiner), `showIf` gating, and auto-fill source binding. A **"Live narrative preview"** panel renders sample responses through the same `generateNarrative` engine that writes saved notes, surfacing validation errors ("Fix before saving") before a save is even attempted. This turns "editable templates" from an architecture claim into a working screen — the crosswalk's §4 "highest-leverage next build."
- **Verified:** `verify-ops-templates.ts` (6 blocks) — id generation, validation, duplication, upsert round-trip, the delete guard, and sample-response rendering for every system template.

### 4.4 Engagement Task Engine & My Tasks (NEW — SOPs 3.3, 3.6, 3.10)
- **Task engine** ✅ (`lib/task-engine.ts`) — pure derivation of `NavigatorTask` objects from appointments and adverse events. Nine task types: `confirmation_48h`, `confirmation_24h`, `confirmation_day_of` (SOP 3.3 — windows open 48h/24h before the appointment, or 8:00am local on the day-of), `no_show_recovery` (SOP 3.10 — due 6:00pm the day of a missed appointment), `post_visit_followup` (SOP 3.6 — due 24h after a completed visit), and the four adverse-event response types (below). Task ids are deterministic (`task-{type}-{refId}`), making generation idempotent — regenerating never duplicates.
- **My Tasks (Navigator)** ✅ — a new sidebar view with four sections: **Overdue** (open tasks whose local due date is strictly before today — the red lane), **Due today**, **Upcoming**, **Done recently** (last 10). Each task card offers **"Complete"** (with an **Outcome** radio for confirmation tasks — Confirmed / No answer / Reschedule requested) and **"Dismiss"** (requires a note). Completing a confirmation task stamps `appointment.confirmations[]` with `{window, at, by, outcome}` — the same array read by the schedule view.
- **Confirmation touches on the schedule** ✅ — the appointment detail dialog shows a "Confirmation touches" section with 48-hour/24-hour/Day-of rows, each colored green (confirmed) or red (missed) with a **"Confirm now"** button that stamps the same array via the identical deterministic task id — so confirming from Tasks or from the Schedule can never double-count.
- **Navigator dashboard strip** ✅ — a "tasks due today" banner (with an overdue sub-count) and a **"View all"** link into My Tasks.
- **Two playbook KPIs flipped live** ✅ (`lib/playbook-kpis.ts`) — **"Missed-appointment same-day recovery"** (% of `no_show_recovery` tasks completed the same local day they came due, SOP 3.10) and **"Weekly-contact cadence"** (% of active patients with 2+ distinct contact days this week, via `lib/engagement.ts`'s `cadenceStatus`) — both were placeholders before; the weekly-contact KPI still carries no target percentage (playbook ⚑, undefined by Gellert).
- **Verified:** `verify-ops-tasks.ts` (10 blocks) — window derivation + idempotency, outcome/adverse-event tasks with business-day PCP math, and seeded-task referential integrity.

### 4.5 Clinical Response: Adverse Events & Escalations (NEW — SOPs 4.1-4.6; field guide §1.2)
- **Adverse-event response task generation** ✅ (`components/supervisor/adverse-events-view.tsx`) — a **"Generate response tasks"** button (shown once per event, before any tasks exist) creates the full set via `tasksForAdverseEvent`: `post_event_contact` (24h after event start, always), and once the event has ended — `post_discharge_pcp` (due `addBusinessDays(endDate, 7)`, reusing the same 7-**business**-day math as the intake-side PCP countdown, SOP 4.3), `post_discharge_med_rec` (48h after discharge, SOP 4.5), `risk_reduction_education` (7 days after discharge, SOP 4.6). Each task renders with its own **Complete**/**Dismiss** actions and a due-status badge (e.g. "{n}bd overdue" / "{n}bd left" for the PCP task, using the same `pcpDueStatus` helper as intake).
- **Escalations** ✅ (`lib/types.ts` `Escalation`, `components/escalations/escalation-dialog.tsx`, `escalation-list.tsx`) — a first-class object distinct from SOS, with a forward-only lifecycle: **open → acknowledged → resolved**. A navigator raises one from the clinical feed via **"Raise Escalation"** (reasons: Repeated no-shows / Clinical risk / Unresolved SDOH barrier / Safety concern / Other) — the dialog states *"The assigned supervisor is nudged immediately"* and the patient's supervisor gets a nudge on submit. A supervisor **Acknowledges** (one click) then **Resolves** (a required resolution note, confirmed via **"Confirm Resolution"**) — closing the loop the crosswalk flagged as missing.
- **Verified:** `verify-ops-escalations.ts` (6 blocks, 38 checks).

### 4.6 Medication Reconciliation (NEW — SOPs 2.3, 3.7)
- **Editable med list with diff-classified reconciliation events** ✅ (`components/medications/med-reconciliation-card.tsx`) — full add ("Add medication")/edit (inline name/dose/frequency)/remove per medication. Saving a reconciliation diffs the new list against the last reconciliation (or the patient's starting list) and classifies every medication as **Added**, **Removed**, **Dose changed**, or **Confirmed**, storing the event with a snapshot and the diff.
- **Auto-checks the Intake 1 checklist** ✅ — recording a reconciliation auto-checks the `med_reconciliation` intake-checklist item (mapped to the `medication_list` document type).
- **Med-assist autofill** ✅ (`lib/note-autofill.ts`) — the reconciled medication list feeds a formatted "Name Dose — frequency" recall directly into the medication-assistance note template, closing the "no capture flow" gap.
- **Verified:** `verify-ops-meds.ts` (6 blocks, 27 checks).

### 4.7 Navigator Onboarding & Training (NEW — Playbook §10)
- **90-day developmental tracker** ✅ (`lib/onboarding.ts`, `components/supervisor/navigator-onboarding-card.tsx`) — an 8-milestone curriculum: Week-1 orientation, CPSS exam, Gellert exam, Weeks 2-4 shadowing, **30-day review, 60-day review, 90-day review**, and Certification (the terminal milestone).
- **Shadowing checklist** ✅ — 7 items (home visit, transport with in-transit coaching, medical appointment ± transit, BH appointment, Intake 1/2 visit, a day-close alongside a mentor, first solo note reviewed against the manual).
- **Certification bump** ✅ — completing the certification milestone flips status to `certified` and ramps `unitsTargetPhase` from **16 → 18**, with a **+$2,500** compensation bonus per the playbook's §10 comp table (both numbers verified live in `verify-ops-onboarding.ts`).
- **Navigator Directory column** ✅ — a new **"Onboarding"** column shows Developmental (with days-in-program)/Certified/Lead badges.
- **Verified:** `verify-ops-onboarding.ts` (5 blocks, 58 checks) — curriculum shape, progress math, milestone ordering, the certification bump itself, and seed consistency.

### 4.8 Wallboard (NEW — Playbook §9.1)
- **Daily KPI Board** ✅ (`components/wallboard/wallboard-view.tsx`) — a new standalone view (sidebar **"Wallboard"**, executive and supervisor roles) with 7 live tiles: **Units Today** (top 3 navigators by avg units/day), **Day-Close Rate (30d)**, **Referral Conversion**, **Open Tasks**, **Open Escalations**, **Active Census**, **Telenavigation Overdue**. Footer: "Daily KPI board — Gellert playbook §9.1 · live from demo data."

### 4.9 Revenue Cycle (Biller/Admin/Executive)
- Unchanged from the prior edition: claims engine/lifecycle/EDI/ledger, daily charge slips & day-close, DAP pend/reprocess, denial work queue, remark-code classification — all ✅/🎭 as previously documented. **New this blitz:** the Ready-to-Bill/Needs-Attention validation path can now reject a claim on **"Patient Agreement not signed"** when the caller supplies the signed-contract set (see 4.2a) — the billing gate the playbook explicitly required.

### 4.10 Playbook KPIs & Executive Views
- **Performance Metrics** ✅ — unchanged, plus the two newly-live KPIs from 4.4 (missed-appointment recovery, weekly-contact cadence) appear alongside the existing seven computed KPIs; "Patient Guide by Friday 4pm" remains the one honest labeled placeholder.
- **Revenue Analytics, Patient Management (insights)** ✅ — unchanged.

### 4.11 Zones & Geo, Patient Portal, Messaging, Admin
Unchanged from the prior edition.

---

## 5. Verification Infrastructure

Six pre-existing suites, all green, plus a new 8-script `verify:ops` chain, plus tsc/eslint at zero errors:

- `npm run verify:billing` — **21 blocks**: payer configs, unit math, validation guardrails, seed referential integrity, persistence-version lock (now v14).
- `npm run verify:safety-map` — **12 checks**: seed/derivation consistency, SOS-forces-alert.
- `npm run verify:claims` — **43 checks**: transition matrix, snapshot immutability, 837P content, 835 round-trip, duplicate-import lock.
- `npm run verify:journey` — **5 + 9 checks** (two scripts): pipeline transition matrix, 5-gate short-circuit order, outreach auto-close at 7, SLA thresholds, funnel conversion band, seeded histories replay legally.
- `npm run verify:notes` — **7 checks**: every seeded Gellert note passes the compliance engine it demos, plus template/field integrity, autofill resolution, supervision-note invariants.
- `npm run verify:gellert` — **12 checks**: charge-slip derivation, per-day Rule of Eights, signing idempotence, daily-vs-monthly divergence contract, DAP 835 round-trip, pend/reprocess, zone fixtures, store lock.
- **`npm run verify:ops`** — **NEW**, chains 8 scripts, 67 blocks total, all green:
  - `verify-gellert-ops.ts` (Phase 0 scaffold) — **10 blocks**: store v14 slices, every active post-intake patient has a signed contract + ROI, the "Patient Agreement not signed" claims gate, confirmation-window derivation + idempotency, outcome/adverse-event tasks with business-day PCP math, seeded-task referential integrity, document definitions + checklist mapping, `renderProviderComm` content, onboarding curriculum/progress math, `weeklyContactCounts`/`cadenceStatus`.
  - `verify-ops-templates.ts` — **6 blocks**: id generation, `validateTemplate`, `duplicateTemplate`, `upsertTemplate` round-trip, the delete-in-use guard, sample-response rendering for every system template.
  - `verify-ops-documents.ts` — **6 blocks**: non-signature and signature document lifecycles, checklist-item↔document mapping for all 6 types, the claim-validation billing gate, seed integrity (Walter's draft contract, other actives signed).
  - `verify-ops-tasks.ts` — **10 blocks**: confirmation-task derivation/idempotency, visit-outcome tasks, adverse-event task sets, overdue computation, and more.
  - `verify-ops-escalations.ts` — **6 blocks** (38 checks): the open→acknowledged→resolved lifecycle and seed integrity.
  - `verify-ops-meds.ts` — **6 blocks** (27 checks): diff classification, checklist auto-check, autofill feed.
  - `verify-ops-comms.ts` — **3 blocks** (28 checks): rendered-message content for all four types, seeded notification counts.
  - `verify-ops-onboarding.ts` — **5 blocks** (58 checks): curriculum shape, progress math, milestone ordering, the certification bump, seed consistency.

QA runbooks: `QA_PROTOCOL_BILLING_BRIDGE.md`, `QA_PROTOCOL_SAFETY_MAP.md`, `ENGINEERING_QA_CHECKLIST.md`; `DEMO_WALKTHROUGH.md` is the unified end-to-end script and now includes seven new demo beats (Parts 16–22) for the ops-blitz features.

---

## 6. Master Real-vs-Simulated Table

| Capability | Verdict |
|---|---|
| Speech-to-text dictation | ✅ Real (Web Speech API, Chrome/Edge) |
| Gemini note structuring (Gellert-style prompt) | ✅ Real with API key; labeled Demo Mode without (never mislabeled) |
| Referral pipeline (eligibility, outreach SLA, transition matrix, capacity confirmation) | ✅ Real state machine; 🎭 outreach attempts are manual attestations (no telephony/SMS) |
| Patient journey engine (phases, checklists, graduation/telenav/exit) | ✅ Real state machine + business-day math |
| Note compliance engine (manual citations, blocking rules) | ✅ Real — seeded notes pass their own engine (verify:notes) |
| In-transit coaching field | ✅ Real structured multi-select, gated on transport-provided |
| Chart auto-fill (providers, standing facts, previous notes, med list) | ✅ Real resolution logic over seeded directory data |
| **Note Template Editor (admin CRUD, duplicate/delete, live preview)** | ✅ **Real** — genuinely editable templates, not architecture-only |
| **Documents & e-sign (ROI, contract, survey, med list, photo, packet)** | ✅ Real fillable forms + lifecycle; 🎭 **e-signature is a demo-tier typed name**, honestly badged — no DocuSign-class integration |
| **Navigation-contract billing gate ("Patient Agreement not signed")** | ✅ Real — a structural claim-validation error, not prose |
| **Engagement task engine (confirmations, no-show recovery, follow-up)** | ✅ Real derivation + idempotent generation, verified |
| **My Tasks / Wallboard views** | ✅ Real — computed from live task/escalation/census data |
| **Adverse-event response tasks (post-discharge PCP/med-rec/education)** | ✅ Real, reuses business-day PCP math from intake |
| **Escalations (raise → acknowledge → resolve)** | ✅ Real closed-loop state machine + supervisor nudge |
| **Medication reconciliation (editable list, diff classification)** | ✅ Real diff engine feeding the checklist and the note template |
| **Provider communications (intake/exit/ineligible/unreachable)** | ✅ Real rendered/editable templates + per-referral history; 🎭 **send is honestly labeled simulated** — "no real message leaves the system" |
| **Navigator onboarding/training (90-day tracker, certification bump)** | ✅ Real progress math; the $2,500/16→18 bump is a real, verified state transition |
| Charge slips / day-close (per-day Rule of Eights) | ✅ Real derivation from TimeLogs; slips are signatures, not a second source of truth |
| CMS billing math + validation guardrails | ✅ Real, 21+43+12+67 automated checks |
| Claim lifecycle (export→submit→adjudicate→pay/deny→rebill) | ✅ Real state machine, immutable snapshots |
| DAP pend → classify → reprocess | ✅ Real code path; 🎭 the DAP 835 is simulator-generated |
| 837P generation / 835 parsing / remittance matching | ✅ Real X12 code; 🎭 clearinghouse is a simulator behind an adapter interface |
| HL7v2 referral parsing | ✅ Real parser; 🎭 feed is simulated (FHIR adapter stubbed) |
| Matching engine (+ zone credit) | ✅ Real scoring, live caseloads; 🎭 distances from zip centroids |
| Zones & windshield time | ✅ Real coverage/drive-time math; 🎭 zone shapes are circle approximations |
| Executive Revenue / Performance / Patients / Wallboard views | ✅ Real — computed from live data |
| Playbook KPIs | ✅ 9 computed (2 newly live this blitz), except "Patient Guide by Friday 4pm" — an honest labeled placeholder |
| Safety status rules + SOS + EVV geolocation | ✅ Real; 🎭 continuous positions simulated (no GPS transport without a backend) |
| Route & safety maps | ✅ Real Leaflet/OSM |
| ICD-10 coding | ✅ Real (~528-code dataset) |
| Persistence | ✅ Survives refresh; 🎭 localStorage only — single browser, no multi-user |
| Auth/sessions/RBAC | 🎭 Role picker only |
| Messaging transport, notifications | 🎭 In-memory |

---

## 7. Remaining Gaps (the honest roadmap)

**Requires a backend (the one deferred decision):** real auth/RBAC and sessions; database + API (multi-user, durable, HIPAA-relevant); real-time transport (live GPS, push notifications, live messaging); server-side audit integrity.

**Requires external counterparties (adapter slots already exist):** live clearinghouse credentials (`ClearinghouseAdapter`); live hospital HL7/FHIR feeds (`ReferralSourceAdapter`); routing/geocoding API (`GeoProvider` — also unlocks real zone polygons and road-accurate windshield time); EDI 270/271 eligibility (not yet stubbed); telephony/SMS integration so outreach attempts are captured rather than attested; a real provider-notification channel (fax/Direct messaging) behind the now-genuinely-simulated preview/edit/send dialog; a real e-signature provider (DocuSign-class) behind the typed-name demo signature.

**Requires a Gellert leadership decision first (⚑ — the only remaining *functional* gaps in the referral-to-graduation spine, note manual, and daily billing):**
- Patient Guide module — format/content undefined; its KPI stays an honest labeled placeholder.
- Telenavigation billing rules — whether/how monthly check-ins bill (playbook §5.4 explicitly TBD).
- Caseload tiers — per-acuity caseload caps (field guide §1.1 TBD).
- Weekly-contact KPI target % — the cadence signal is live; no threshold has been set.
- The remaining ⚑ discovery-agenda items: graduation criteria refinement, adverse-event protocol sign-off, program-exit protocol details, provider post-visit update standards, transportation economics, the ongoing-training framework beyond the built 90-day tracker.

**In-app work not yet done:**
- **Insurance transportation booking** (Mercy Care/Molina/UHC protocols, SOP 3.4) — transit is documented in notes only; no booking flow.
- **Daily vs monthly units reconciliation report** — the divergence is labeled and verify-locked; a report explaining the delta per patient-month is future work.
- **CMS code-set auto-update** — ICD/CPT/HCPCS/CARC-RARC sets still don't sync with CMS releases automatically.
- Carried forward: URL routing/deep links; mobile/responsive layout (field navigators need mobile); supervisor time-log verification UI (guardrail exists, review workflow doesn't); per-patient payer-driven claim generation; recurring appointments; care-plan authoring beyond the three seeded templates; the manual's ~30 AMD note-type variants beyond the 8 families (the Template Editor makes closing this cheap, but it hasn't been done); Unite Us / Timeero / SMS integrations; AI no-show prediction / outreach-timing suggestions.

**Out of app scope but in the client relationship:** the referral team's scripts/process revamp (a playbook improvement target).

---

## 8. Repo Map (orientation for an LLM)

- `lib/` — all business logic, backend-portable. *Pre-existing:* `claims-engine`, `claim-lifecycle`, `payer-config`, `billing-engine`, `edi/` (x12, 837P, 835 parser/simulator + DAP scenario, matcher), `clearinghouse/adapter`, `geo`, `safety-status`, `matching-logic` (zone-aware), `acuity`, `referral-ingestion`, `executive-metrics`, `analytics-utils`, `schedule-utils`/`schedule-validation`, `narrative-generator`, `gemini-scribe`, `date-rebase`, `store` (**v14**), `demo-data-context`, `initial-data`, `types`, `referral-pipeline`, `referral-funnel`, `journey`, `business-days`, `note-taxonomy`, `gellert-templates` (+ in-transit coaching field), `note-compliance`, `note-autofill` (+ med-list feed), `same-day-notes`, `charge-slips`, `remittance-review`, `zones`, `navigator-productivity`, `playbook-kpis` (+ 2 new live KPIs), `sample-transcripts`. **New this blitz:** `task-engine` (confirmation/follow-up/no-show/adverse-event task derivation), `document-definitions` (the 6 document types + checklist mapping + e-sign model), `provider-comms` (rendered secmsg-prefixed messages), `onboarding` (90-day curriculum + shadow checklist + certification math), `engagement` (weekly-contact cadence), `template-editor` (admin CRUD helpers for note templates).
- `components/` — `billing/` (claims manager, denial-work-queue), `supervisor/` (safety map + zones, referral-review-view + **capacity-confirmation gate + Schedule Intake 1 + CommunicationsHistoryStrip**, eligibility-checklist, outreach-log, referral-funnel, journey-board, directory + zone coverage + **Onboarding column**, HL7 dialog, compliance, adverse-events-view + **Generate response tasks**, **navigator-onboarding-card**, **provider-comm-dialog**), `navigator/` (patients + phase chips, navigator-schedule + **confirmation touches + Confirm now**, route map, assessment wizard, clinical-feed + **Raise Escalation**), `notes/` (note builder + compliance gating/autofill badges + **in-transit coaching badges**, compliance-panel, AI recorder, timer), `journey/` (phase-chip, journey-timeline, graduation-panel, exit-dialog), `intake/` (intake-checklist — **now opens DocumentDialog per item**), `tasks/` (**tasks-view — My Tasks**, **task-icons — shared icon map**), `escalations/` (**escalation-dialog, escalation-list**), `documents/` (**document-dialog, document-fields, contract-form, roi-form, survey-form, med-list-form, photo-capture, onboarding-packet-form, signature-panel**), `medications/` (**med-reconciliation-card**), `admin/` (**template-editor-view, template-field-editor, template-preview**), `wallboard/` (**wallboard-view — Daily KPI Board**), `executive/` (performance-view, revenue-analytics-view, patient-insights-view), `patient/` + `patient-detail/`, `messaging/`, `dashboards/`, `dashboard/` (shell + sidebar with **My Tasks / Wallboard / Note Templates** nav items), `schedule/`, `ui/` (shadcn).
- `scripts/` — thirteen verify scripts backing the seven suites (`verify:journey` and `verify:ops` each run multiple). **New this blitz:** `verify-gellert-ops.ts`, `verify-ops-templates.ts`, `verify-ops-documents.ts`, `verify-ops-tasks.ts`, `verify-ops-escalations.ts`, `verify-ops-meds.ts`, `verify-ops-comms.ts`, `verify-ops-onboarding.ts`. `docs/` — this file, `DEMO_WALKTHROUGH.md`, `CLIENT_CONTEXT.md`, `GELLERT_CROSSWALK.md`, three QA protocols.
