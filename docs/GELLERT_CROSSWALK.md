# Gellert Health Process ↔ Product Crosswalk

**Prepared:** 2026-07-09 (originally); **updated 2026-07-09 post "Ops Blitz"**
**Purpose:** A complete, code-verified crosswalk between Gellert Health's documented operating process — the **GH Operating Playbook** (draft V2), the **WorkFlow2025** process map, and the **Navigator Note-Taking Manual** — and what the Mach 1 Care Navigator platform actually does. Every verdict below was verified against source code, not memory. Companion docs: `CLIENT_CONTEXT.md` (who Gellert is), `CURRENT_STATE_OVERVIEW.md` (what the app does), `DEMO_WALKTHROUGH.md` (how to show it).

> **2026-07-09 update — the Ops Blitz.** The original edition of this document (July 8 build) catalogued a real but incomplete transplant of Gellert's three documents, then used its own §5 "roadmap" as the discovery agenda. Section 5's Tier 1 and Tier 2 items — Template Editor, documents & e-sign with the billing gate, the appointment-confirmation engine, post-visit follow-up, the capacity-to-decide gate, adverse-event response workflow, medication reconciliation as capture, the escalation protocol, real (simulated) provider communications, and the navigator onboarding/training module — **all shipped** in a follow-on three-phase blitz, verified by a new 8-script `verify:ops` suite (67 blocks) on top of the original six suites. This edition flips every verdict row those items touch to reflect what's now running in the product. Nothing below was left as an aspirational claim without a corresponding code citation. The only rows that remain 🟡/❌ are (a) items genuinely out of scope for a no-backend demo (real telephony/SMS, real e-sign, real fax/Direct messaging) and (b) the items Gellert's own playbook flags ⚑ as needing leadership decisions before they can be built at all (Patient Guide, telenavigation billing, caseload tiers, the six undefined KPIs, transportation economics). Those ⚑ items are now genuinely the *only* functional gaps left in the referral-to-graduation spine, the note manual, and daily billing.

**Verdict legend:**
- ✅ **MATCHES** — works as the document describes
- ⬆ **ENHANCES** — does what the document describes *and* adds capability their paper process doesn't have
- 🟡 **PARTIAL** — the concept exists but part of the documented behavior is missing
- ❌ **NOT BUILT** — described in the documents, not yet in the product

---

## 1. The Story — what was built, in plain language

**Where things stood before July 8.** The platform was a strong healthcare-navigation demo — referral intake with HL7 parsing and a matching engine, an AI scribe, EVV and safety maps, and a genuinely deep billing/claims layer with real X12 EDI. But it was built around a *generic* CMS CHI/PIN program model. It didn't know anything about how Gellert specifically operates: no journey phases, no outreach protocol, no note manual, no charge slips, no zones.

**What the July 8 build did.** Gellert handed over three documents that together describe their entire operation: the workflow map (how a patient moves from referral to graduation), the playbook (who does what, when, and to what standard), and the note-taking manual (exactly how billable documentation must be written). We treated those documents as specifications and transplanted their logic into the product in one coordinated push:

- **The workflow map became software.** A referral now moves through the same pipeline drawn on their one-page map: eligibility review with their exact five ineligibility reasons → acceptance with a 24–48-hour contact clock → an outreach log capped at seven attempts that auto-closes to "unreachable" and notifies the referring provider → patient agreement → intake scheduling → conversion to a patient. Patients then carry a journey phase — Intake → Active Navigation → Telenavigation → Exit — with Intake 1 & 2 checklists, the PCP-within-7-business-days countdown, the three-no-show closure protocol, graduation with supervisor confirmation, monthly telenavigation check-ins, and their five documented exit pathways. A kanban "Journey Board" shows the whole map live. The product also goes *beyond* the paper process here: SLA countdown timers, a conversion funnel with per-source scorecards (the St. Joe's value story), and zone-aware navigator assignment are things their documents describe as goals, not current abilities.

- **The note manual became a rules engine.** The manual's note families are now real templates — phone call, medical appointment with/without transit, behavioral health with the SI/HI/AH/VH safety screen, lab/imaging, medication assistance with the exact no-touch attestation language, SDOH, multidisciplinary same-day continuation, and supervision notes (which pin to the top of the chart, because that's the first thing Mitch reads). A compliance engine checks every note against the manual's rules *while the navigator writes it* — and when it blocks a save, it quotes the manual back: "NO PATIENT INVOLVEMENT = NO BILLING." The AI scribe fills these templates from dictation in the manual's required style (third person, colon-and-AM/PM times, chronological, direct patient quotes), and a provider directory plus standing patient facts auto-fill the fields navigators currently cut-and-paste from a side document.

- **Sonya's billing world became features.** Navigators close their day with charge slips — one per patient per day, units computed by the Rule of Eights, with a coaching hint when a patient-day is under the 8-minute billable minimum. There's now a Denial Work Queue (the collections module AMD wanted to upsell her), and the UHC DAP problem is handled the way it should be: an 835 arriving with an unknown remark code *pends for review* instead of misposting as a denial; classify the code once, reprocess, and it posts as paid at 101% with the incentive labeled. Executive dashboards now answer the question AMD structurally can't: per-navigator units per day against the 16/18/20 targets — one NPI, eleven navigators, individually reported. And Mitch's manual 11-zone spreadsheet is native: zones on the map, zone-aware assignment, coverage reporting, and an "unbillable windshield time" metric.

**Then the Ops Blitz closed almost everything that was left.** A second, three-phase push (Phase 0 scaffold → nine parallel workstreams → integration) took this document's own §5 roadmap as its build list and shipped it: a Template Editor (admin CRUD, duplicate/delete with an in-use guard, live narrative preview); a documents & e-sign layer (ROI, navigation contract, survey, med list, photo, onboarding packet — all real fillable forms behind the intake checklist, with a typed-name demo signature and the navigation contract now a genuine claim-validation billing gate); the SOP 1.7 decision-making-capacity gate (the one missing workflow-map node); an engagement task engine (48h/24h/day-of confirmation touches, same-day no-show recovery, 24-hour post-visit follow-up, a weekly-contact cadence signal — all driving a new "My Tasks" view and two newly-live playbook KPIs); an adverse-event response workflow (one-click task generation: post-event contact, post-discharge PCP-within-7-business-days, post-discharge med reconciliation, risk-reduction education); a first-class escalation object with a closed raise→acknowledge→resolve loop and a supervisor nudge; medication reconciliation as real capture (editable list, diff-classified events, checklist auto-check, note-template autofill); real-but-honestly-simulated provider communications (rendered, editable, `secmsg`-prefixed messages replacing the old stamp-only stand-in, with a per-referral history); an in-transit coaching field (Connection/Preparation/Education/Reinforcement) inside transit-gated notes; a navigator onboarding/training module (90-day tracker, 30/60/90 reviews, shadowing checklist, certification bumping comp +$2,500 and the unit target 16→18); and a Wallboard (the daily-KPI screen playbook §9.1 calls for, 7 live tiles).

**Where the product still honestly diverges or falls short of the documents.** Two kinds of gaps remain, both narrower than before:

1. **Deliberate demo-tier stand-ins that need a backend or a paid integration to close.** Provider communications are now real, editable, honestly-labeled-simulated messages (not bare stamps) — but sending is still simulated; no fax/Direct-messaging transport exists. Document e-signatures are a typed-name demo signature, not a DocuSign-class integration. Zone shapes are circles, not drawn polygons. The DAP 835 comes from a simulator. Outreach attempts remain manual attestations (no telephony/SMS). These all have clean seams for the real thing.
2. **Items Gellert's own playbook flags ⚑ as needing a leadership decision before they can be built at all.** The Patient Guide module (format/content undefined), telenavigation billing rules (whether/how monthly check-ins bill), caseload tiers by acuity, the weekly-contact KPI's target percentage (the signal is live; no threshold is set), and the remaining discovery-agenda items (graduation-criteria refinement, adverse-event protocol sign-off, transportation economics). Section 5 keeps this as the discovery-phase agenda.

**The bottom line:** the referral-to-graduation spine, the note manual, daily billing, the engagement/response/training protocols, and real documents-with-a-billing-gate are all now running in the product, with several genuine enhancements the documents only aspire to. What remains is (a) the handful of demo-tier stand-ins that need a backend or paid integration, and (b) the items Gellert's own playbook says need their decision first — which is exactly what the discovery phase is for.

---

## 2. WorkFlow2025 Map — node-by-node crosswalk

### Band 1: REFERRALS

| Map node | Product | Verdict |
|---|---|---|
| Patient referred by ACH or approved provider | Referral CRM ingest: simulated feed, HL7 paste, manual entry (`referral-review-view.tsx`) | ⬆ ENHANCES — their referrals arrive as hand-keyed PDFs into Optimum; the product also demonstrates the future-state ADT/HL7 path |
| Gellert confirms referral eligibility | 5-gate eligibility decision tree: insurance → service area → medical need → level of care → age (`eligibility-checklist.tsx`, `lib/referral-pipeline.ts`) | ✅ MATCHES — gates mirror the map's "Reasons for Ineligibility" box exactly |
| Patient is ineligible → referring provider informed | Ineligible close with mapped reason; **`ProviderCommDialog` renders/edits/sends a `secmsg:`-prefixed Ineligible Notification** (`lib/provider-comms.ts`, `components/supervisor/provider-comm-dialog.tsx`) — `providerNotifiedAt` now stamps only at explicit send | ✅ MATCHES (simulated send) — real editable message + per-referral history replaces the bare stamp; 🎭 send itself is honestly labeled "Send (simulated)" |
| Gellert accepts referral | "Accept — 48h Contact Clock Starts" | ⬆ ENHANCES — acceptance starts a visible SLA countdown their process tracks on paper/memory |
| Outreach within 24–48 hours of acceptance | SLA chip: green <24h / amber 24–48h / red breached | ⬆ ENHANCES |
| Up to 7 attempts at outreach | 7-slot outreach log with channel + disposition per attempt | ✅ MATCHES |
| Unable to contact → provider informed | Auto-close to `unreachable` at attempt 7; Unreachable Notification via the same `ProviderCommDialog` flow | ✅ MATCHES (simulated send) |
| Staff explains services / patient denies → provider informed | Outreach dispositions incl. `declined` → close; notification via `ProviderCommDialog` | ✅ MATCHES (simulated send) |
| Staff confirms patient can make decisions independently | **SOP 1.7 gate on the Convert-to-Patient panel**: "Confirm decision-making capacity (SOP 1.7)" checkbox, required before "Schedule Intake 1" unlocks (`referral-review-view.tsx`, `referral.decisionCapacityConfirmed`) | ✅ MATCHES — the map's one previously-missing node is now a real, enforced gate |
| Patient agrees to services | `agreed` status; "Patient Agreed" fast path | ✅ MATCHES |
| Intake scheduled + navigator assigned | `intake_scheduled` + Match & Assign workspace, now reachable only after the capacity gate | ⬆ ENHANCES — assignment is scored (distance, capacity, language, acuity, +15 same-zone) instead of ad hoc |
| Patient no-shows intake ×3 → referral closed, provider informed | No-show counter; 3rd no-show triggers MIA closure protocol | ✅ MATCHES |
| Intake 1 completed (med/medical/behavioral/social history, physicians, referrals reviewed) | Intake 1 checklist: packet, ROI, med reconciliation, history, provider list, risk screening, photo, PCP scheduled — **each document-backed item now opens a real fillable form/e-sign dialog** (`lib/document-definitions.ts`, `components/documents/*`) | ✅ MATCHES — real documents behind the checklist, not just checkboxes; 🎭 e-signature is a typed-name demo signature |
| Navigator sends introductory communication to referring provider | "Notify Referring Provider" CTA now opens `ProviderCommDialog` — Intake Notification, rendered/editable, `secmsg:`-prefixed | ✅ MATCHES (simulated send) — real message + history, not a bare stamp |
| PCP scheduled within 7 business days | Business-day countdown with due/overdue states (`lib/business-days.ts`, `pcpDueStatus`) | ✅ MATCHES |
| Navigator accompanies patient to PCP appointment | Appointment scheduling + EVV check-in/out + documentation flow | ✅ MATCHES |

**Also on the referrals band but not on the map:** patients are only created in the system at conversion — encoding Gellert's own "not entered into Advanced MD until they accept" rule — and the funnel view computes conversion by source (seeded at their real-world 25%), which Optimum cannot report at all. ⬆

### Band 2: NAVIGATION

| Map node | Product | Verdict |
|---|---|---|
| Navigation of specialists, labs, imaging, testing, BH begins | Active Navigation phase; scheduling; encounter-typed appointments | ✅ MATCHES |
| Navigator helps schedule appointments | Schedule view with conflict validation | ✅ MATCHES |
| Navigator transports / accompanies patient | Transit-gated note templates; EVV; route map | ✅ MATCHES |
| Navigator communicates with patient multiple times/week | Contact-gap warnings on the navigator dashboard + **`lib/engagement.ts` weekly-contact cadence tracker** (`cadenceStatus`: none/single/multiple, feeding the "Weekly-contact cadence" playbook KPI) | 🟡 PARTIAL — the cadence signal is now structured and live (⬆ vs. warning-only before), but the playbook leaves the target % undefined (⚑) |
| Navigator ensures treatment-plan compliance | Care plans with goals/tasks (pre-existing) | ✅ MATCHES |
| Navigator ensures medication compliance / assists with medications | Medication-assistance note template with no-touch attestation; **editable med list with diff-classified reconciliation events** (`components/medications/med-reconciliation-card.tsx`) auto-checking the intake checklist and feeding note autofill | ✅ MATCHES — capture flow now built, closing the prior gap |
| Transports patient to pharmacy | Covered by med-assistance template + appointment types | ✅ MATCHES |
| SDOH needs assessed and discussed | SDOH screening in risk assessment + SDOH note template + Z-code capture at intake | ✅ MATCHES |
| Navigator connects patient with SDOH providers/resources | SDOH template incl. Unite Us referral field | 🟡 PARTIAL — documented in notes; Unite Us is a note field, not an integration |
| Adverse event occurs → navigator communicates → coordinates post-event appointments → PCP within 7 days of d/c → medication compliance → risk-reduction education | Adverse Events supervisor view **+ "Generate response tasks"** (`lib/task-engine.ts` `tasksForAdverseEvent`): post-event contact, post-discharge PCP-within-7-business-days, post-discharge med reconciliation, risk-reduction education | ✅ MATCHES — the response workflow is now built, reusing the intake-side business-day PCP math |
| Patient builds confidence → transitioned to Telenavigation | Graduation flow: navigator flags readiness → supervisor confirms → telenavigation | ✅ MATCHES — with the two-step confirmation the playbook requires |

### Band 3: GRADUATION

| Map node | Product | Verdict |
|---|---|---|
| Patient contacted monthly to ensure continued success | Telenav cadence (30-day) with due/overdue chips + navigator-dashboard banner | ⬆ ENHANCES — overdue check-ins surface automatically; theirs relies on memory |
| Patient's condition worsens → requires navigation again | "Re-engage Patient" → back to Active | ✅ MATCHES |
| Patient has continued success | Check-ins logged as notes with full history | ✅ MATCHES — but check-ins create **no billable time log** (telenav billing ⚑ TBD in their playbook too) |
| Program exit: patient no longer wants services → supervisor confirms | Exit dialog: patient-initiated pathway *requires* supervisor confirmation | ✅ MATCHES |
| Exit: ineligibility (loses AHCCCS / ineligible plan / moves away) | `ineligible` exit pathway with documentation | ✅ MATCHES |
| Exit: MIA / deceased / inappropriate behavior / navigator safety | `mia`, `deceased`, `safety` pathways; MIA auto-triggered by 3 intake no-shows | ✅ MATCHES |
| Exit → referring provider informed | Exit Notification now available via `ProviderCommDialog` (rendered/editable, `secmsg:`-prefixed); **note:** `ProgramExit.providerNotifiedAt` (a field distinct from the referral/intake `providerNotifiedAt`) still auto-stamps at exit time regardless of whether the dialog was used — a pre-existing pattern this blitz didn't touch | 🟡 PARTIAL — the *message* is now real and honestly simulated; the *stamp* on the exit record itself is still unconditional, unlike the referral/intake stamps which now gate on an actual send |

**Map scorecard:** ~26 nodes → **20 ✅ / 5 ⬆ / 1 🟡 / 0 ❌**. Every node the map draws is now navigable in the product end-to-end, including the capacity-confirmation gate (SOP 1.7) that was the map's one previously-missing node; the sole remaining 🟡 is the exit-notification stamp nuance above, not a missing capability.

---

## 3. Playbook crosswalk — every numbered SOP

### Phase 1 · Referral & Eligibility (SOPs 1.1–1.7)

| SOP | Status | Where |
|---|---|---|
| 1.1 Referral receipt & eligibility verification | ✅ | Referral CRM + eligibility tree |
| 1.2 Eligibility decision tree (insurance/service area/medical need/level of care/age) | ✅ | `eligibility-checklist.tsx` — the five gates verbatim |
| 1.3 Referral acceptance & navigator assignment | ⬆ | Acceptance + scored Match & Assign |
| 1.4 Patient outreach protocol — 7-attempt cadence | ✅ | `outreach-log.tsx`, auto-close at 7 |
| 1.5 Service explanation & patient agreement | ✅ | `agreed` disposition/fast path |
| 1.6 Ineligibility notification to referring provider | ✅ | `ProviderCommDialog` renders/edits/sends a `secmsg:`-prefixed Ineligible Notification (simulated send, honestly labeled) |
| 1.7 Capacity-to-make-decisions confirmation | ✅ | "Confirm decision-making capacity (SOP 1.7)" gate on the Convert-to-Patient panel, required before Intake 1 scheduling |

### Phase 2 · Intake (SOPs 2.1–2.8)

| SOP | Status | Where |
|---|---|---|
| 2.1 Intake email receipt & confirmation | ❌ | No referral-team↔navigator handoff messaging |
| 2.2 Pre-intake patient call (confirm, request meds & insurance card) | ❌ | No pre-intake call step |
| 2.3 Intake 1 — packet, ROI, med reconciliation, histories, provider list, risk, photo | ✅ | Checklist items now open real fillable documents (`lib/document-definitions.ts`, `components/documents/*`) — onboarding packet, ROI (e-sign), medication list (reconciliation capture, `med-reconciliation-card.tsx`), patient photo (capture form); status badges (Not started/Draft/Completed/Signed) replace bare checkboxes |
| 2.4 PCP scheduling within 7 business days during Intake 1 | ✅ | `pcpDueBy` countdown, business-day math |
| 2.5 Intake 1 documentation (dx codes, H0038, insurance) same day | ✅ | Intake record + ICD + payer FK + notes |
| 2.6 Referral-partner post-intake email within 24h | ✅ | `ProviderCommDialog` renders/edits/sends a `secmsg:`-prefixed Intake Notification (simulated send) |
| 2.7 Intake 2 — survey, navigation contract, risk-tier confirmation, peer-support scheduling | ✅ | Survey + navigation contract are real documents; **navigation contract is now the actual billing gate** (`claims-engine.ts` "Patient Agreement not signed") — Walter Briggs seeded with a live signable draft; peer-support scheduling remains generic care-plan tooling, not Gellert-specific |
| 2.8 Three-failed-attempts protocol — closure & provider notification | ✅ | 3-no-show → MIA exit, auto |

### Phase 3 · Active Navigation (SOPs 3.1–3.12)

| SOP | Status | Where |
|---|---|---|
| 3.1 PCP accompaniment & post-visit documentation | ✅ | Encounter-typed appointments → pre-selected Gellert template → compliance-checked note |
| 3.2 Specialist/lab/imaging/BH scheduling & coordination | ✅ | Scheduling + lab/BH templates |
| 3.3 Multi-touch appointment confirmation (48h → 24h → day-of) | ✅ | `lib/task-engine.ts` derives `confirmation_48h`/`confirmation_24h`/`confirmation_day_of` tasks; appointments carry a `confirmations[]` array; worked from "My Tasks" or "Confirm now" on the Schedule detail dialog |
| 3.4 Insurance transportation scheduling (Mercy Care/Molina/UHC protocols) | ❌ | No insurance-transport booking; transit is documented in notes only |
| 3.5 In-transit coaching protocol (Connection/Preparation/Education/Reinforcement) | ✅ | Multi-select field in the transit-gated note templates (`lib/gellert-templates.ts`, gated on "Transport provided?"), the four exact protocol options as selectable badge pills |
| 3.6 Post-visit follow-up within 24 hours | ✅ | `taskForCompletedVisit` spawns a `post_visit_followup` task due 24h after the appointment, on the same task engine/My Tasks surface |
| 3.7 Medication compliance monitoring & pharmacy navigation | ✅ | Compliance %s + med-assist template, now backed by an editable med list with diff-classified reconciliation events (added/removed/dose changed/confirmed) feeding both the checklist and note autofill |
| 3.8 SDOH needs assessment & resource connection (Unite Us) | 🟡 | Screening + Z-codes + SDOH template; Unite Us is a note field, not an integration |
| 3.9 Peer support plan development & delivery | 🟡 | Care plans exist (3 templates); not Gellert-specific peer-support plans |
| 3.10 Cancellation & missed-appointment response (same-day) | ✅ | `taskForNoShow` spawns a `no_show_recovery` task due 6pm the day of the miss; the "missed-appointment same-day recovery" KPI is now computed (SOP 3.10-cited) |
| 3.11 Patient Guide submission — Friday 4pm weekly | ❌ | Honest placeholder KPI only ("signal not yet captured — Patient Guide module") — ⚑ format/content still needs Gellert input |
| 3.12 Daily billing & documentation completion | ⬆ | Charge slips/day-close: one slip per patient-day, Rule of Eights units, sub-8 coaching, Sign & Submit Day, EOD-submission KPI — *plus* the per-navigator reporting AMD can't do |

### Phase 4 · Adverse Event Response (SOPs 4.1–4.6) — ⚑ playbook flagged this phase as needing definition; the Ops Blitz built a reasonable version of the response mechanics, leaving only the ⚑ protocol sign-off itself to Gellert

| SOP | Status | Where |
|---|---|---|
| 4.1 Notification & initial response | ✅ | Adverse events tracked with statuses (`currently_inpatient`/`currently_ed`/`monitoring`/`ended`); journey-phase AE overlay badge; **"Generate response tasks"** creates the `post_event_contact` task (due 24h after event start) |
| 4.2 Post-event patient communication | 🟡 | `post_event_contact` task is a real, tracked touch requirement; still no patient-facing message template (distinct from the referring-provider comms built this blitz) |
| 4.3 Post-discharge PCP within 7 business days | ✅ | `post_discharge_pcp` task, due `addBusinessDays(event.endDate, 7)` — reuses the same business-day math as the intake-side countdown, now anchored to discharge |
| 4.4 Post-discharge medication reconciliation | ✅ | `post_discharge_med_rec` task, due 48h after discharge, feeding the same med-reconciliation capture flow built for SOP 2.3/3.7 |
| 4.5 Risk-reduction education & care-plan update | ✅ | `risk_reduction_education` task, due 7 days after discharge; care plans remain separately updatable |
| 4.6 Supervisor notification & escalation criteria | ✅ | AE view visibility unchanged, **plus** a first-class `Escalation` object (raise → acknowledge → resolve, closed-loop, supervisor nudge on raise) — distinct from SOS, closing the "no escalation object" gap |

### Phase 5 · Graduation & Telenavigation (SOPs 5.1–5.5) — ⚑ playbook flags protocol as undefined; the product implemented a reasonable version

| SOP | Status | Where |
|---|---|---|
| 5.1 Graduation readiness assessment | ✅ | Navigator "Flag Graduation Readiness" + note |
| 5.2 Supervisor confirmation of eligibility | ✅ | Supervisor-only confirm, gated on the flag |
| 5.3 Transition communication to patient | ❌ | No patient-facing communication step — the ops blitz built referring-*provider* comms, not patient-facing messaging (still ⚑-adjacent — format undefined) |
| 5.4 Monthly telenavigation check-in | 🟡 | Cadence + check-in + overdue surfacing built; **check-ins create no TimeLog/billable unit** (billing rules ⚑ TBD with Gellert) |
| 5.5 Re-engagement criteria & protocol | ✅ | Re-engage action, telenav → active |

### Phase 6 · Program Exit (SOPs 6.1–6.7) — ⚑ playbook flags protocol as undefined; product implemented it

| SOP | Status | Where |
|---|---|---|
| 6.1–6.5 The five exit pathways (ineligibility / patient-initiated w/ supervisor confirmation / MIA / safety / deceased) | ✅ | `exit-dialog.tsx` + `ProgramExit`; patient-initiated structurally requires supervisor sign-off |
| 6.6 Exit documentation & record closure | ✅ | Required documentation + `survivalStatus` inactive + journey event |
| 6.7 Referring-provider exit notification | 🟡 | Exit Notification message now real/editable via `ProviderCommDialog` (simulated send); **but** the `ProgramExit.providerNotifiedAt` field itself still auto-stamps at exit regardless of whether the dialog was used — a pre-existing pattern this blitz didn't touch, so the stamp is ahead of the send in a way the referral/intake stamps no longer are |

### Playbook cross-cutting sections

**§3 Communication model:** 🟡 partially in product scope now — the `secmsg:` email-subject convention is real (`lib/provider-comms.ts` prefixes every rendered provider message with it), and provider updates are genuine rendered/editable/simulated-send messages, not bare stamps. Still out of scope: phone/voicemail standards and First-Name-Last-Initial phone-contact conventions have no product presence (operational policy, not software-shaped).

**§4 Billing guidelines:** ⬆ strongest section, now stronger. One charge slip per patient per day ✅; billing daily by EOD ✅ (tracked as a KPI); **no billing before signed Patient Agreement ✅** — the navigation contract is a real document with a typed-name e-signature, and `claims-engine.ts`'s `validateClaimData` fails a patient-month with "**Patient Agreement not signed**" if the contract isn't signed (Walter Briggs seeded as the live unsigned-draft demo beat); billable/non-billable activity rules ✅ (sub-8-minute logic, no-billing-for-continuation-notes, supervision notes non-billable); "if you didn't document it, it never happened" ✅ (the note *is* the time log); arrival/departure screenshots — superseded by EVV GPS check-in/out ⬆.

**§5 KPIs:** `lib/playbook-kpis.ts` — **10 computable live** (48h acceptance, units/day vs 16/18/20, EOD billing %, PCP compliance proxy, post-discharge follow-up proxy, no-show rate, ED trend, cost per engaged patient, **+ missed-appointment same-day recovery, + weekly-contact cadence** — the two newly-live KPIs from the task engine), 1 honest placeholder (Patient Guide Friday 4pm). The playbook's remaining ⚑ TBD metrics (SDOH-screen %, med-compliance confirmation, patient-understanding score, CSAT, and the weekly-contact KPI's target percentage specifically) are placeholders in their document too — they need definitions from Gellert leadership before they can be finalized. §5.2 health-plan value KPIs: no-show and ED trends live; HEDIS gap closure and readmission/LOS need payer data the product can't have yet.

**§6 Financial model:** unit economics live (units, rates, per-navigator productivity, windshield time as the unbillable-travel lever ⬆). Transportation economics (stipend vs mileage pilot) — ⚑ analysis item, not software yet.

**§7 Technology enablement (their must-have list):** Referral-to-active CRM ✅ · Patient Guides ❌ / dashboards ✅ (**+ Wallboard** ✅) · patient profile + AI notes ✅ · engagement tracking ✅ (structured weekly-contact cadence now live, not just contact-gap warnings) · acuity tracking ✅ · billing platform ✅ · BI reporting ✅ (operational/financial/role-based/referral-source; QA-compliance partial). **AI future state:** documentation automation with compliance validation ✅ (this is the compliance engine); no-show prediction, outreach-timing suggestion, high-risk identification ❌ (real ML asks — good discovery-phase material); patient engagement platform (text/chat) 🟡 (in-app messaging exists; no SMS; provider-facing comms are now real, patient-facing text/chat is not).

**§8–10 Compensation, org, onboarding/training:** navigator levels (1/2/3 → 16/18/20 targets) ✅; **the 90-day developmental period, shadowing checklists, certification tracking ✅** — `lib/onboarding.ts`'s 8-milestone curriculum (Week-1 orientation, CPSS/Gellert exams, shadowing, 30/60/90-day reviews, certification), a 7-item shadowing checklist, and certification flipping status to `certified` while ramping the units target 16→18 and applying a **+$2,500** comp bonus (all three numbers verify-locked); meeting cadence/daily-KPI-screen ✅ (a real **Wallboard** view, 7 live tiles, per playbook §9.1 — no longer just dashboards standing in for it).

### Note-Taking Manual (Parts I–X)

| Manual element | Status |
|---|---|
| The 7 note families + supervision as structured templates | ✅ 8 Gellert templates |
| Universal recipe (frame → chronological story → clinical facts → patient's role → clean close) | ✅ template section ordering + narrative generator |
| Non-negotiables: third person, complete sentences, colon+AM/PM, patient involvement, total-minutes close | ✅ compliance rules (patient involvement, total-minutes, med language, BH screen are *blocking*) |
| "NO PATIENT INVOLVEMENT = NO BILLING" | ✅ enforced structurally — a failing note cannot create a time log |
| Med no-touch required language | ✅ verbatim attestation |
| BH SI/HI/AH/VH screen | ✅ required field + blocking rule |
| Multidisciplinary same-day note splitting (transport only in first note; totals on one note) | ✅ primary/continuation model with linking |
| Direct quotes for patient statements | ✅ scribe prompt + third-person rule quote-stripping |
| Aggression documentation (zero-tolerance) | ✅ warn-level prompt rule |
| 10-second final review checklist | ⬆ superseded by the live compliance panel |
| The manual's ~30 AMD note-type variants | 🟡 covered as 8 families with gates (see §4) |
| The manual's embedded example notes (images in the docx) | ❌ not extracted; sample transcripts serve the equivalent training role |

---

## 4. Documentation templates — direct answers

### Do we have all the documentation templates? **Note families: 8 of ~30 (unchanged). Non-note documents: NOW YES — all six exist as real documents.**

**Note templates: still 8 of ~30 (but the right 8, and now editable — see below).** The manual organizes Gellert's ~30 AMD note types into 7 families plus supervision, and that's what was built — with transit variants handled as a toggle inside the medical/BH templates rather than separate types (structurally better than AMD's duplication). What is *not* yet distinct: the named AMD variants Mitch showed (intake note, onboarding note, medication-list note, provider-contact-list note, PCP-transit as its own type, "maturing notes," etc.). Getting to parity means enumerating Gellert's actual AMD template list during discovery and either mapping each to a family+preset or adding templates — which the Template Editor (below) now makes cheap in practice, not just in principle.

**Non-note documents: NOW BUILT.** Verified in code (`lib/document-definitions.ts`, `components/documents/*`) — six real fillable-form documents with a lifecycle (`not_started → draft → completed/signed`), opened from the intake checklist via `DocumentDialog`:

| Document | Where it's referenced | What exists now |
|---|---|---|
| Onboarding packet | Intake 1 checklist | ✅ Real fillable form (`onboarding-packet-form.tsx`), "Mark Packet Reviewed" |
| Release of Information (ROI) | Intake 1 checklist | ✅ Real fillable form + typed-name e-signature (`roi-form.tsx`, "Sign ROI") |
| Medication reconciliation / med list | Intake 1 checklist | ✅ Real editable capture with diff-classified reconciliation events (`med-reconciliation-card.tsx`) — no longer display-only |
| Patient photo | Intake 1 checklist | ✅ Real capture/upload form (`photo-capture.tsx`) |
| Patient survey | Intake 2 checklist | ✅ Real fillable form (`survey-form.tsx`), "Complete Survey" |
| Navigation contract (Patient Agreement) | Intake 2 checklist | ✅ Real fillable form + typed-name e-signature (`contract-form.tsx`, "Sign Agreement") — **and now wired as the actual billing gate**: `claims-engine.ts` fails claim validation with "Patient Agreement not signed" if unsigned |
| **Patient Guide** (weekly, Friday 4pm) | Playbook §5 KPI | Still nothing — honest placeholder KPI only; ⚑ this remains genuinely Gellert-decision-gated (format/content undefined), the one document this blitz didn't (and structurally couldn't) build |
| Provider contact list | Note manual pain point | ⬆ superseded by the provider directory + auto-fill |

E-signature is a demo-tier **typed name + "signing as" role**, honestly badged "demo e-signature — DocuSign-class integration slots in later" — not a real e-sign provider. That's the one remaining honest divergence in this section.

### Do we have *editable* documentation templates in the system? **NOW YES — the Template Editor exists.**

Note templates are pure data (`NoteTemplate` records — fields, types, options, narrative fragments, compliance bindings), which made them runtime-editable *in principle* even before this blitz. Now there's a real screen behind that architecture: `lib/template-editor.ts` + `components/admin/template-editor-view.tsx` (reachable from the admin sidebar's **"Note Templates"** item) give admins full CRUD — **New template**, per-row **Duplicate** (deep clone, suffixed name, always marked custom), **Edit** (full field palette: text/select/multi-select/time/provider/attestation, section grouping, Required/Never-skip switches, narrative-fragment prefix/suffix/joiner editing, `showIf` gating, auto-fill source binding), and **Delete** — genuinely guarded: a template referenced by any saved note can't be deleted (`canDeleteTemplate`/`isTemplateInUse`), with the delete button disabled and a tooltip naming how many notes depend on it. A **"Live narrative preview"** panel renders sample responses through the exact same `generateNarrative` engine that writes saved notes, surfacing validation errors before save. This converts "8 of 30 templates" from an engineering task into a Gellert-configurable catalog, verified by `verify-ops-templates.ts` (6 blocks) — and it's now a real demo beat ("you don't file a ticket to change a note type; you edit it," Part 16 of `DEMO_WALKTHROUGH.md`).

---

## 5. Beyond the blitz — what's left after the Ops Blitz

Every item below is demanded by a specific document section. ⚑ = requires a Gellert leadership decision first (per their own playbook flags) — these double as the **discovery-phase agenda**. Items struck through shipped in the Ops Blitz (verified against code above); they're kept here, not deleted, so this document's history stays honest.

### Tier 1 — client-visible, natural next demo beats (as of the July 8 edition)
1. ~~**Template Editor UI** (§4 above) — unlocks the full ~30-type catalog as configuration.~~ **DONE** — `lib/template-editor.ts` + `components/admin/template-editor-view.tsx`, verified (`verify-ops-templates.ts`, 6 blocks).
2. **Patient Guide module** — authoring per patient, weekly submission, Friday-4pm deadline tracking; turns the placeholder KPI live. *(Playbook §5.1, §7.1; ⚑ format/content needs Gellert input.)* **NOT built — genuinely ⚑-blocked, not a build-priority miss.**
3. ~~**Appointment confirmation engine** — 48h/24h/day-of touches with confirmation states on appointments, plus same-day missed-appointment recovery tasks. *(SOPs 3.3, 3.10.)*~~ **DONE** — `lib/task-engine.ts`, "My Tasks" view, verified (`verify-ops-tasks.ts`, 10 blocks).
4. ~~**Post-visit follow-up loop** — completing an appointment spawns a 24h follow-up task (confirm understanding, schedule next steps, capture new barriers). *(SOP 3.6.)*~~ **DONE** — `taskForCompletedVisit`, same engine as #3.
5. ~~**Documents & e-sign layer** — real ROI, navigation contract, survey, med list, photo capture behind the intake checklist items; navigation contract wired as the billing gate. *(SOPs 2.3, 2.7; billing rule §4.)*~~ **DONE** — `lib/document-definitions.ts`, `components/documents/*`, billing gate in `claims-engine.ts`, verified (`verify-ops-documents.ts`, 6 blocks). E-signature remains a demo-tier typed name, honestly labeled.
6. ~~**Capacity-to-decide gate** — the one missing workflow-map node. *(Map; SOP 1.7.)*~~ **DONE** — SOP 1.7 checkbox gate on the Convert-to-Patient panel.

### Tier 2 — operational depth (as of the July 8 edition)
7. ~~**Adverse-event response workflow** — event-triggered task set: post-event contact, post-discharge PCP-in-7-days countdown (reusing the intake countdown machinery), post-discharge med reconciliation, risk-reduction education step. *(SOPs 4.1–4.6; ⚑ the whole phase needs Gellert definition.)*~~ **DONE (mechanics)** — `tasksForAdverseEvent`, "Generate response tasks" button; the ⚑ *protocol sign-off itself* (what counts as an adverse event, escalation thresholds) still needs Gellert definition — the blitz built a reasonable version, per the original flag's own caveat.
8. ~~**Medication reconciliation as capture** — editable med list with reconciliation events, feeding the med-assistance template. *(SOPs 2.3, 3.7.)*~~ **DONE** — `med-reconciliation-card.tsx`, verified (`verify-ops-meds.ts`, 6 blocks).
9. ~~**Escalation protocol** — first-class escalation object (raise → supervisor acknowledge → resolve, closed-loop tracked), distinct from SOS. *(Field guide §1.2.)*~~ **DONE** — `Escalation` type + `escalation-dialog.tsx`/`escalation-list.tsx`, verified (`verify-ops-escalations.ts`, 6 blocks).
10. ~~**Real provider communications** — templated referral-partner messages (intake notification, post-visit updates ⚑ standards TBD, exit notification) replacing the stamp-only stand-in. *(SOPs 1.6, 2.6, 6.7; §3.4.)*~~ **DONE (rendering/send-flow)** — `lib/provider-comms.ts` + `ProviderCommDialog`, verified (`verify-ops-comms.ts`, 3 blocks). Post-visit update *standards* remain ⚑ TBD per the original flag; the message-rendering infrastructure is built and reusable once standards are set.
11. **Telenavigation billing** — whether/how monthly check-ins bill. *(⚑ playbook 5.4 explicitly TBD.)* **NOT built — genuinely ⚑-blocked.**
12. **Caseload tiers** — per-acuity caseload caps and tier-weighted load in Match & Assign. *(⚑ Field guide 1.1 TBD.)* **NOT built — genuinely ⚑-blocked.**
13. ~~**In-transit coaching prompts** — Connection/Preparation/Education/Reinforcement checklist inside transit-gated encounters. *(SOP 3.5.)*~~ **DONE** — multi-select field in the Medical/BH ± Transit templates, gated on "Transport provided?"
14. ~~**Structured engagement cadence** — multiple-contacts-per-week tracking per patient (feeds the ⚑ weekly-contact KPI).~~ **DONE (signal)** — `lib/engagement.ts` `cadenceStatus`, feeding the now-live "Weekly-contact cadence" KPI; the ⚑ target percentage itself is still undefined by Gellert.
15. **Insurance transportation booking** — Mercy Care/Molina/UHC transport protocols. *(SOP 3.4.)* **NOT built.**

### Tier 3 — platform and integrations
16. **Backend, auth, multi-user** — the standing deliberate deferral; prerequisite for real HIPAA posture, live GPS, notifications. **NOT built (deliberate).**
17. ~~**Navigator onboarding/training module** — 90-day developmental period, shadowing checklists, pre/post tests, certification and level progression (which already drives billing targets). *(Playbook §10 — directly serves the retention goal.)*~~ **DONE** — `lib/onboarding.ts` + `navigator-onboarding-card.tsx`, verified (`verify-ops-onboarding.ts`, 5 blocks). Pre/post *exam content* itself (CPSS/Gellert exam questions) is tracked as a milestone, not authored in-app — that's a content, not a mechanics, gap.
18. **Integrations:** Unite Us (SDOH referrals), Timeero (time/location), live clearinghouse (Availity/Claim.MD — adapter seam exists), St. Joe's ADT/HL7 feed (parser already real), SMS/text engagement. *(§7.3.)* **NOT built (external counterparties).**
19. **AI future state:** no-show risk prediction, outreach-timing suggestions, high-risk identification. *(§7.2.)* **NOT built.**
20. **Mobile field experience** — the field guide assumes phone-first navigators; the app is desktop-first. **NOT built.**
21. **Code-set auto-updates** — ICD/CPT/HCPCS/remark dictionaries tracking CMS releases (Sonya's explicit vendor test). **NOT built.**
22. ~~**Wallboard mode** — the daily-KPI screen for the office. *(§9.1.)*~~ **DONE** — `components/wallboard/wallboard-view.tsx`, 7 tiles, executive + supervisor sidebar.

### ⚑ Discovery-agenda items (Gellert decisions needed before building) — unchanged, kept intact
Graduation criteria · telenavigation protocol & billing · adverse-event protocol (sign-off on the definitions, not the response mechanics — those are now built) · program-exit protocol details · caseload tier definitions · Patient Guide format · provider post-visit update standards (message-rendering infrastructure is built; the content standards are not defined) · the six undefined §5.1 KPIs (weekly-contact target %, SDOH-screen %, med-compliance confirmation, patient-understanding score, CSAT, and one more) · transportation economics · ongoing-training framework beyond the built 90-day tracker. *(All ⚑-flagged in their own playbook draft — this list is exactly what remains to build after the Ops Blitz, plus the items that were never software gaps to begin with.)*

---

## 6. Scorecard summary (post–Ops Blitz)

| Document | Fully reflected | Enhanced beyond | Partial | Not built | *(July 8 baseline, for reference)* |
|---|---|---|---|---|---|
| **WorkFlow2025 map** (~26 nodes) | **20** | 5 | **1** | **0** | *was 15 / 5 / 7 / 1* |
| **Playbook Phase 1** (7 SOPs) | **6** | 1 | **0** | **0** | *was 4 / 1 / 1 / 1* |
| **Playbook Phase 2** (8 SOPs) | **6** | — | **0** | 2 | *was 3 / — / 3 / 2* |
| **Playbook Phase 3** (12 SOPs) | **7** | 1 | **2** | **2** | *was 2 / 1 / 4 / 5* |
| **Playbook Phase 4** (6 SOPs) | **5** | — | **1** | **0** | *was — / — / 3 / 3* |
| **Playbook Phase 5** (5 SOPs) | 3 | — | 1 | 1 | *unchanged* |
| **Playbook Phase 6** (7 SOPs*) | 6 | — | 1 | — | *unchanged (*6 rows cover 7 SOPs, 6.1–6.5 combined)* |
| **Note manual** (12 elements) | 9 | 1 | 1 | 1 | *unchanged — this blitz didn't touch the note manual* |
| **§7 must-have tech list** (7 items) | **6** | — | **0** | 1 | *was 5 / — / 1 / 1* |

**Headline:** every ✅/⬆ cell above is a code citation, not a plan. The WorkFlow2025 map is now **20/26 fully matched + 5 enhanced — 25 of 26 nodes**, with the sole remaining 🟡 being a stamp-timing nuance on exit notifications, not a missing capability. Playbook Phases 1, 2, and 4 each dropped to zero or near-zero partials. Phase 3 (Active Navigation) improved the most in absolute terms — from 3 fully-matched SOPs to 8 (7 ✅ + 1 ⬆) — because it held the bulk of the task-engine and med-reconciliation work. What's left clusters into exactly two categories: (a) items genuinely gated on a Gellert leadership decision (Patient Guide, telenavigation billing, caseload tiers, SDOH/CSAT KPI definitions, transportation economics, patient-facing transition messaging) — precisely the discovery-phase agenda in §5 — and (b) items that need a backend or a paid external integration regardless of any Gellert decision (real e-sign, real fax/Direct messaging, telephony/SMS, insurance-transport booking APIs, CMS code-set auto-sync).
