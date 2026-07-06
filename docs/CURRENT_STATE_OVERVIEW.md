# Mach 1 Care Navigator — Comprehensive Current-State Overview

**Prepared:** 2026-07-06 (supersedes the 2026-07-03 edition, which described the pre-hardening demo)
**Purpose:** A factual, code-verified snapshot of the Mach 1 Care Navigator platform (built for Gellert Health). Written to be fed to an LLM alongside demo recordings, transcripts, and planning documents so gap analyses and PRDs are grounded in what the code actually does.

**What changed since the last edition:** a six-commit production-hardening pass (the "blitz") rebuilt the billing/claims layer around a real lifecycle with X12 EDI, made safety status computed instead of staged, replaced every hardcoded executive number with live derivations, hardened the AI scribe's failure modes, added real HL7v2 ingestion, fixed a critical persistence bug, and closed 14 confirmed review findings (billing integrity, timezone math, stale telemetry). Many rows that were 🎭 SIMULATED are now ✅ REAL.

**How to read this document:** every capability is flagged:
- ✅ **REAL** — genuinely functional logic; would need hardening, not building, for production
- 🎭 **SIMULATED** — works in the UI but is driven by seeded data or a simulator standing in for an external counterparty
- 🚧 **PLACEHOLDER** — a "Coming Soon" stub

The architecture remains **deliberately demo-tier in one dimension**: there is no backend. That decision was made explicitly (backend migration deferred); everything else was built with clean seams so the swap is contained.

---

## 1. Product Identity

**Elevator pitch:** A multi-role healthcare navigation platform for CMS Community Health Integration (CHI) and Principal Illness Navigation (PIN) programs. Navigators manage high-risk patients through home visits and AI-assisted encounter documentation; supervisors run referral intake with a scoring matching engine and monitor field safety on a live map with SOS; a Revenue Cycle Manager turns time logs into payer-compliant claims and walks them through a full lifecycle — validation, 837P export, clearinghouse submission, 835 remittance posting, denial and rebill; executives see revenue and operations computed from live data.

**The demo narrative ("Golden Thread"):** an HL7 referral arrives (paste or simulate) → Match & Assign scores every navigator on geography/language/caseload/acuity → clinical intake captures consent, the CMS initiating visit, and a 4-domain acuity score → the navigator documents a home visit with the AI scribe (real speech-to-text + Gemini structuring) and an audit-proof encounter timer → the signed note creates a verified time log → the Revenue Cycle Manager validates the claim (consent, 12-month rule, Z-codes, member ID, verification), exports a real 837P, submits to a (simulated) clearinghouse, imports an 835, and posts PAID/DENIED with CARC/RARC detail → denials reopen for rebill → executive dashboards move.

**Setting:** Phoenix, AZ metro seed data. Payers: Arizona Medicaid/AHCCCS (H-codes, Rule of Eights), Medicare PIN/CHI (G-codes), plus commercial rate cards — unified into one `Payer` entity with aliases and EDI IDs.

---

## 2. Tech Stack & Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | shadcn/ui (Radix), Tailwind CSS v4, Lucide, Geist |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet (OpenStreetMap) — supervisor safety map AND navigator route map |
| AI | Gemini 2.5 Flash via a server action (`GEMINI_API_KEY`); browser Web Speech API for dictation |
| EDI | In-repo X12 modules: 837P generator, 835 parser, remittance matcher, deterministic 835 simulator |
| Geo | Haversine adapter (`lib/geo.ts`) behind a `GeoProvider` interface; AZ zip centroid table; browser geolocation helper |
| State | React context (`lib/demo-data-context.tsx`) over a versioned localStorage store — **no external state lib, no database, no API routes** (one Gemini server action) |
| Quality gates | `verify:billing` (21 blocks), `verify:safety-map` (12), `verify:claims` (43), tsc/eslint at zero errors |
| Deployment | Dockerfile on DigitalOcean App Platform |

**Architectural facts that shape any roadmap:**
- **Single-page app, no routing.** `app/page.tsx` is the only route; views are React state. No URLs/deep links.
- **No backend.** All domain logic is client-side against localStorage (debounced writes + `beforeunload` flush; schema-versioned reseed, currently v12). *Deliberate seams for the future swap:* every mutation flows through context actions, business logic lives in pure `lib/` modules (claims engine, lifecycle, EDI, geo, safety rules, executive metrics are all backend-portable), and external integrations sit behind adapter interfaces.
- **Authentication is a role picker.** No sessions, no RBAC enforcement. Six roles: executive, supervisor, navigator, patient, admin, biller.
- **Demo-time semantics are centralized.** `lib/date-rebase.ts` shifts operational seed dates to the local calendar "today" on load (DOBs/enrollment frozen) and exports `localTodayISO`/`localCurrentMonth`, which all billing-month and "today" logic uses — no UTC drift for evening users.
- **Persistence is trustworthy now.** A latent version-stamp bug that silently wiped localStorage on every reload was found and fixed (with a regression assertion). State survives refresh; demos reset via Admin → Reset Demo Data.

---

## 3. Roles & Views

| Role | Views | Status |
|---|---|---|
| **Executive** | Overview (live-computed), Revenue Cycle Manager | Real. **Revenue, Performance, Patients menu items remain 🚧 placeholders** |
| **Supervisor** | Overview, Safety Map, Referrals (+ HL7 ingest), Navigators, Team Schedule, Compliance, Adverse Events, Messages, Match & Assign workspace | All real |
| **Navigator** | Overview (+ SOS), My Patients, Schedule (+ route map, EVV), Notes/Clinical Feed, Messages, Assessment Wizard | All real |
| **Patient** | My Health, Appointments, Medications, Messages, My Profile | All real |
| **Admin** | Overview, Payer management, Remark Codes, Organization settings, Audit Log, Revenue Cycle Manager, Reset Demo | All real |
| **Biller** | Revenue Cycle Manager (3 tabs incl. Claims Ledger) | All real |

Header: live unread badge (messages + nudges) and a working patient search for supervisor/navigator roles. Dead UI (fake bell count, inert search, dead Settings button) was removed or made real.

---

## 4. Feature Inventory

### 4.1 Referral Intake & Matching (Supervisor)
- **HL7v2 ingestion** ✅ — real parser (MSH/PID/DG1/IN1/PV1, warnings-not-throws) behind a `ReferralSourceAdapter` interface. "Paste HL7…" accepts arbitrary messages; "Simulate Incoming Referral" generates round-trip-verified ADT^A04 messages from a rotating 6-persona pool. Raw HL7 renders on the referral card. 🎭 The *feed* is simulated (no live hospital interface); a FHIR R4 adapter stub marks the future integration slot.
- **Match & Assign** ✅ — scoring engine (distance +40/−100 hard fail, caseload +30 scaled, language +20/−50 hard fail, acuity +10) over **all 11 navigators** with live caseloads. Distances are haversine-computed from zip centroids via the geo adapter (🎭 simulator tier; a routing API slots into `GeoProvider`).
- **Clinical intake** ✅ — consent capture, CMS initiating-visit date with 12-month validation, 4-domain acuity score (0–12) with SDOH-suggested barriers and Z-codes. The acuity chain is unified: intake level → L1/L2/L3 → patient risk tier (`lib/acuity.ts`).

### 4.2 Navigator Experience
- **Dashboard** ✅ — nudge banners, real "today" appointment counts, contact-gap warnings, quick notes, **SOS button** (confirm dialog → real browser GPS → supervisor alert).
- **My Patients** ✅ — searchable roster with risk filters.
- **Schedule** ✅ — list/map/dual-track views; appointment creation with **wired conflict validation** (overlap/double-booking block, travel-time/safety warnings — travel times haversine-derived); EVV check-in/out using **real browser geolocation** (graceful fallback, feeds the supervisor map).
- **Route map** ✅ — real Leaflet map: numbered stops in true date+time order, route polyline, Google Maps navigation deep-links, total distance/drive-time footer.
- **AI Scribe ("Golden Encounter Note")** ✅ — template-driven note builder; real Web Speech API dictation; Gemini 2.5 Flash auto-fill with per-field confidence; **honest failure modes** (no API key → labeled amber Demo Mode banner; runtime errors → red failure banner with Retry and explicit "Use demo values instead" — mock output is never mislabeled as AI); low-confidence fields require per-field confirmation before signing; dictation autosaves to a draft every 1.5s with crash-restore; three sample transcripts wired to a Load Sample menu; missing-ICD warning. 🎭 Gemini call requires `GEMINI_API_KEY`; without it the scribe runs in clearly-labeled Demo Mode.
- **Signed notes create verified time logs** ✅ — audit-proof timer (start/end/provenance) + signature is the verification mechanism; the log flows straight into billing.

### 4.3 Revenue Cycle (Biller/Admin/Executive)
- **Claims engine** ✅ — payer-agnostic (Medicaid Rule of Eights H-codes by dominant activity; Medicare G-code base+add-on), explicit `PayerConfig` required everywhere (no fallback rate tables — the four conflicting revenue models of the old demo are gone). Validation guardrails: minimum time, **real member ID required** (health-plan names don't count; fallback IDs are UNK-prefixed and rejected downstream), ICD codes, **consent documented**, initiating visit recorded and within 12 months, CHI requires an SDOH Z-code, payer FK assigned, **no unverified minutes** (supervisor-review guardrail).
- **Claim lifecycle** ✅ — derived claims (DRAFT for the in-progress month / VALIDATED / NEEDS_ATTENTION) become immutable `ClaimRecord` snapshots at export, progressing EXPORTED → SUBMITTED → ACCEPTED/REJECTED → PAID/DENIED through a transition matrix with full status history. Double-billing is structurally prevented (patient-month exclusion regardless of payer selection); minutes logged after an export surface in an "Unbilled activity" banner with one-click reopen-for-rebill.
- **EDI** ✅ code / 🎭 counterparty — real 5010 X222 **837P generation** (org NPI/taxonomy from admin-managed settings, real month-ends, one file per payer via the claim's payer FK); real X221 **835 parsing** (BPR/TRN/CLP/CAS/LQ → CARC/RARC); three-tier **remittance matching** that excludes terminal records (duplicate imports report honestly); deterministic **835 simulator** for the demo loop; `ClearinghouseAdapter` interface with a simulator that accepts/rejects realistically (Availity/Claim.MD slot in later).
- **Claims Ledger UI** ✅ — status chips, history timelines, CARC/RARC tooltips from an admin-editable dictionary, transition-guarded row actions, manual payments that persist real remittance amounts, Outstanding A/R and Paid metrics, Import 835 / Generate Sample 835 with one-click import.
- **Executive dashboards** ✅ — every number computed from live store data (the fictional $714K static baseline is gone): current-billing-month claim value + visit revenue via payer FKs, daily units, referral sources, health-plan revenue, performance tiers, census, real verification-rate and referral-turnaround metrics. Memoized against the app-wide context. *Honest consequence:* revenue reads small (seed-scale, real rates) instead of impressive and fake.

### 4.4 Field Safety (Supervisor)
- **Safety Map** ✅ rules / 🎭 telemetry — real Leaflet map; status is **computed by rules** (SOS → alert; high-risk visit >60 min without checkout → alert; no check-in >90 min → alert; stationary ≥15 min → idle), not staged. SOS works end-to-end: navigator panic button with real GPS → pulsing supervisor alarm → acknowledge → resolve, all audit-logged. "Call Now" is a real `tel:` link. EVV check-ins from the field appear on the map. Positions themselves are seeded/simulated ("Simulate live activity" toggle moves pins without self-healing stale alerts; locations are treated as live telemetry and never restored stale from storage) — **there is no real GPS transport**, which requires a backend.

### 4.5 Patient Portal
✅ Health dashboard, appointments with reschedule-request → chat handoff, medications with an honest per-med weekly adherence grid (labeled "estimated from refill compliance — not a daily log"), care-plan goals rendered from the real care plan with an honest empty state, Recharts goal trends.

### 4.6 Messaging
✅ UI / 🎭 transport — role-aware threads, unread counts, nudges as first-class messages that **stay unread until acted on** (opening an unrelated thread doesn't clear them; "View Patient Record" marks them handled). In-memory/localStorage only — no real-time transport.

### 4.7 Admin / Governance
✅ Unified payer management (canonical name, aliases, rate, billing-config link, EDI ID), CARC/RARC remark-code dictionary, organization/billing-provider settings (NPI, tax ID, taxonomy, supervising provider — consumed by CSV/837P exports), audit log (24 action types incl. claims, remittance, SOS), demo reset. Sidebar tab navigation works correctly (controlled tabs).

---

## 5. Verification Infrastructure

- `npm run verify:billing` — 21 blocks: payer configs, unit math, all validation guardrails (consent, 12-month, CHI Z-code, member ID), seed referential integrity, persistence-version regression lock.
- `npm run verify:safety-map` — 12 checks: seed pins + **seed/derivation consistency** (the rules engine reproduces every seeded status), SOS-forces-alert.
- `npm run verify:claims` — 43 checks: transition matrix, snapshot immutability, versioned rebill IDs, 837P content (real month-ends, org NPI, no hardcoded providers), 835 round-trip with 100% match, duplicate-import regression lock, payer-aware progress modes.
- tsc and eslint enforced at **zero errors** (strict react-hooks rules; shadcn primitives scoped to warnings).
- QA runbooks with demo talk tracks: `QA_PROTOCOL_BILLING_BRIDGE.md` (6 scenarios incl. the full revenue loop), `QA_PROTOCOL_SAFETY_MAP.md` (6 scenarios incl. SOS), `ENGINEERING_QA_CHECKLIST.md` (matching, computed distances, scribe degraded modes, HL7). See `DEMO_WALKTHROUGH.md` for the unified end-to-end script.

---

## 6. Master Real-vs-Simulated Table

| Capability | Verdict |
|---|---|
| Speech-to-text dictation | ✅ Real (Web Speech API, Chrome/Edge) |
| Gemini note structuring | ✅ Real with API key; labeled Demo Mode without (never mislabeled) |
| CMS billing math + validation guardrails | ✅ Real, 21+43 automated checks |
| Claim lifecycle (export→submit→adjudicate→pay/deny→rebill) | ✅ Real state machine, immutable snapshots |
| 837P generation / 835 parsing / remittance matching | ✅ Real X12 code; 🎭 clearinghouse is a simulator behind an adapter interface |
| HL7v2 referral parsing | ✅ Real parser; 🎭 feed is simulated (FHIR adapter stubbed) |
| Matching engine | ✅ Real scoring, live caseloads; 🎭 distances from zip centroids (routing API slots in) |
| Safety status rules + SOS + EVV geolocation | ✅ Real; 🎭 continuous positions simulated (no GPS transport without a backend) |
| Route & safety maps | ✅ Real Leaflet/OSM |
| Executive metrics | ✅ Computed from live data |
| ICD-10 coding | ✅ Real (~528-code dataset) |
| Persistence | ✅ Survives refresh (bug fixed); 🎭 localStorage only — single browser, no multi-user |
| Auth/sessions/RBAC | 🎭 Role picker only |
| Messaging transport, notifications | 🎭 In-memory |
| Exec Revenue/Performance/Patients views | 🚧 Placeholders |

---

## 7. Remaining Gaps (the honest roadmap)

**Requires a backend (the one deferred decision):** real auth/RBAC and sessions; database + API (multi-user, durable, HIPAA-relevant); real-time transport (live GPS for the safety map, push notifications, live messaging); server-side audit integrity.

**Requires external counterparties (adapter slots already exist):** live clearinghouse credentials (837P submission / 835 retrieval — `ClearinghouseAdapter`); live hospital HL7/FHIR feeds (`ReferralSourceAdapter`); routing/geocoding API (`GeoProvider`); EDI 270/271 eligibility (not yet stubbed).

**In-app work not yet done:** the three executive placeholder views (Revenue, Performance, Patients); URL routing/deep links; mobile/responsive layout (fixed 256px sidebar; field navigators need mobile); supervisor time-log verification UI (the guardrail exists; the review workflow for unverified logs doesn't); per-patient payer-driven claim generation (global payer selector remains; the FK model makes this cheap); recurring appointments; care-plan authoring beyond the three seeded templates.

---

## 8. Repo Map (orientation for an LLM)

- `lib/` — all business logic, backend-portable: `claims-engine`, `claim-lifecycle`, `payer-config`, `billing-engine` (progress), `edi/` (x12, 837P, 835 parser/simulator, matcher), `clearinghouse/adapter`, `geo`, `safety-status`, `matching-logic`, `acuity`, `referral-ingestion`, `executive-metrics`, `analytics-utils`, `schedule-utils`/`schedule-validation`, `narrative-generator`, `gemini-scribe` (server action), `date-rebase` (demo-time + local-date helpers), `store` (localStorage + helpers), `demo-data-context` (the provider), `initial-data` (seeds), `types`.
- `components/` — `billing/` (claims manager, ledger, remittance import), `supervisor/` (safety map, intake workspace, HL7 dialog, directory, compliance, adverse events), `navigator/` (patients, schedule, route map, assessment wizard, clinical feed), `notes/` (note builder, AI recorder, timer), `patient/` + `patient-detail/`, `messaging/`, `dashboards/`, `dashboard/` (shell), `intake/`, `schedule/`, `ui/` (shadcn).
- `scripts/` — the three verify suites. `docs/` — this file, the walkthrough, three QA protocols.
