# Gellert Health Process ↔ Product Crosswalk

**Prepared:** 2026-07-09
**Purpose:** A complete, code-verified crosswalk between Gellert Health's documented operating process — the **GH Operating Playbook** (draft V2), the **WorkFlow2025** process map, and the **Navigator Note-Taking Manual** — and what the Mach 1 Care Navigator platform actually does after the July 8 build. Every verdict below was verified against source code, not memory. Companion docs: `CLIENT_CONTEXT.md` (who Gellert is), `CURRENT_STATE_OVERVIEW.md` (what the app does), `DEMO_WALKTHROUGH.md` (how to show it).

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

**Where the product honestly diverges or falls short of the documents.** Three kinds of gaps, all catalogued in detail below:

1. **Deliberate demo-tier stand-ins.** Referring-provider "notifications" are timestamps and audit entries, not actual emails. Zone shapes are circles, not drawn polygons. The DAP 835 comes from a simulator. These have clean seams for the real thing.
2. **Checklist-not-document.** Intake 1 & 2 track the ROI, onboarding packet, navigation contract, survey, and patient photo as *attestation checkboxes* — there is no fillable document, e-signature, or photo capture behind any of them yet. Same for medication reconciliation: it's a checkbox; there's no med-list capture flow.
3. **Playbook sections not yet built.** The multi-touch appointment confirmation cadence (48h → 24h → day-of), the post-visit 24-hour follow-up loop, the Patient Guide module (its Friday-4pm KPI is an honest labeled placeholder), the in-transit coaching protocol, a formal escalation workflow, the post-discharge adverse-event task flow, telenavigation *billing* (check-ins create a note but no billable time log — their playbook flags this ⚑ TBD too), caseload caps by acuity tier (⚑ TBD in their playbook), and the navigator onboarding/training module. Section 5 turns this list into a prioritized roadmap.

**The bottom line:** the *spine* of Gellert's documented operation — referral through graduation, the note manual, and daily billing — is now running in the product, with several genuine enhancements their documents only aspire to. What remains is mostly (a) turning attestations into real documents, (b) the time-based engagement protocols (confirmations, follow-ups, Patient Guide), and (c) the items their own playbook marks as needing leadership decisions first.

---

## 2. WorkFlow2025 Map — node-by-node crosswalk

### Band 1: REFERRALS

| Map node | Product | Verdict |
|---|---|---|
| Patient referred by ACH or approved provider | Referral CRM ingest: simulated feed, HL7 paste, manual entry (`referral-review-view.tsx`) | ⬆ ENHANCES — their referrals arrive as hand-keyed PDFs into Optimum; the product also demonstrates the future-state ADT/HL7 path |
| Gellert confirms referral eligibility | 5-gate eligibility decision tree: insurance → service area → medical need → level of care → age (`eligibility-checklist.tsx`, `lib/referral-pipeline.ts`) | ✅ MATCHES — gates mirror the map's "Reasons for Ineligibility" box exactly |
| Patient is ineligible → referring provider informed | Ineligible close with mapped reason + provider-notified stamp | 🟡 PARTIAL — close + reason + timestamp real; "informed" is an audit stamp, not an outbound message |
| Gellert accepts referral | "Accept — 48h Contact Clock Starts" | ⬆ ENHANCES — acceptance starts a visible SLA countdown their process tracks on paper/memory |
| Outreach within 24–48 hours of acceptance | SLA chip: green <24h / amber 24–48h / red breached | ⬆ ENHANCES |
| Up to 7 attempts at outreach | 7-slot outreach log with channel + disposition per attempt | ✅ MATCHES |
| Unable to contact → provider informed | Auto-close to `unreachable` at attempt 7 + provider-notified stamp | ✅ MATCHES (same stamp caveat) |
| Staff explains services / patient denies → provider informed | Outreach dispositions incl. `declined` → close + stamp | ✅ MATCHES |
| Staff confirms patient can make decisions independently | — | ❌ NOT BUILT — no capacity-confirmation step in the pipeline (small add: one gate or checklist item) |
| Patient agrees to services | `agreed` status; "Patient Agreed" fast path | ✅ MATCHES |
| Intake scheduled + navigator assigned | `intake_scheduled` + Match & Assign workspace | ⬆ ENHANCES — assignment is scored (distance, capacity, language, acuity, +15 same-zone) instead of ad hoc |
| Patient no-shows intake ×3 → referral closed, provider informed | No-show counter; 3rd no-show triggers MIA closure protocol | ✅ MATCHES |
| Intake 1 completed (med/medical/behavioral/social history, physicians, referrals reviewed) | Intake 1 checklist: packet, ROI, med reconciliation, history, provider list, risk screening, photo, PCP scheduled | 🟡 PARTIAL — steps tracked and enforced as a checklist; the underlying documents/captures aren't built (see §4) |
| Navigator sends introductory communication to referring provider | "Notify Referring Provider within 24h" CTA | 🟡 PARTIAL — stamp + audit, no actual message |
| PCP scheduled within 7 business days | Business-day countdown with due/overdue states (`lib/business-days.ts`, `pcpDueStatus`) | ✅ MATCHES |
| Navigator accompanies patient to PCP appointment | Appointment scheduling + EVV check-in/out + documentation flow | ✅ MATCHES |

**Also on the referrals band but not on the map:** patients are only created in the system at conversion — encoding Gellert's own "not entered into Advanced MD until they accept" rule — and the funnel view computes conversion by source (seeded at their real-world 25%), which Optimum cannot report at all. ⬆

### Band 2: NAVIGATION

| Map node | Product | Verdict |
|---|---|---|
| Navigation of specialists, labs, imaging, testing, BH begins | Active Navigation phase; scheduling; encounter-typed appointments | ✅ MATCHES |
| Navigator helps schedule appointments | Schedule view with conflict validation | ✅ MATCHES |
| Navigator transports / accompanies patient | Transit-gated note templates; EVV; route map | ✅ MATCHES |
| Navigator communicates with patient multiple times/week | Contact-gap warnings on the navigator dashboard | 🟡 PARTIAL — surfaced as a warning; no structured cadence tracker |
| Navigator ensures treatment-plan compliance | Care plans with goals/tasks (pre-existing) | ✅ MATCHES |
| Navigator ensures medication compliance / assists with medications | Medication-assistance note template with no-touch attestation; display-only med view | 🟡 PARTIAL — documentation side built; no med-list capture/reconciliation flow |
| Transports patient to pharmacy | Covered by med-assistance template + appointment types | ✅ MATCHES |
| SDOH needs assessed and discussed | SDOH screening in risk assessment + SDOH note template + Z-code capture at intake | ✅ MATCHES |
| Navigator connects patient with SDOH providers/resources | SDOH template incl. Unite Us referral field | 🟡 PARTIAL — documented in notes; Unite Us is a note field, not an integration |
| Adverse event occurs → navigator communicates → coordinates post-event appointments → PCP within 7 days of d/c → medication compliance → risk-reduction education | Adverse Events supervisor view (monitoring, statuses, follow-up badge, care-team contacts) | 🟡 PARTIAL — visibility is real; the *response workflow* (post-discharge PCP task, post-discharge med reconciliation) is not built |
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
| Exit → referring provider informed | Provider-notified stamp on exit | 🟡 PARTIAL (stamp, not message) |

**Map scorecard:** ~26 nodes → 15 ✅ / 5 ⬆ / 7 🟡 / 1 ❌ (capacity confirmation). The map's *spine* is fully navigable in the product end-to-end.

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
| 1.6 Ineligibility notification to referring provider | 🟡 | Stamp + audit; no outbound message |
| 1.7 Capacity-to-make-decisions confirmation | ❌ | Not in the pipeline |

### Phase 2 · Intake (SOPs 2.1–2.8)

| SOP | Status | Where |
|---|---|---|
| 2.1 Intake email receipt & confirmation | ❌ | No referral-team↔navigator handoff messaging |
| 2.2 Pre-intake patient call (confirm, request meds & insurance card) | ❌ | No pre-intake call step |
| 2.3 Intake 1 — packet, ROI, med reconciliation, histories, provider list, risk, photo | 🟡 | Full checklist with per-item audit stamps; **no documents/captures behind items** |
| 2.4 PCP scheduling within 7 business days during Intake 1 | ✅ | `pcpDueBy` countdown, business-day math |
| 2.5 Intake 1 documentation (dx codes, H0038, insurance) same day | ✅ | Intake record + ICD + payer FK + notes |
| 2.6 Referral-partner post-intake email within 24h | 🟡 | CTA + stamp; no email/template |
| 2.7 Intake 2 — survey, navigation contract, risk-tier confirmation, peer-support scheduling | 🟡 | Checklist (same document caveat); completion gates the Active transition |
| 2.8 Three-failed-attempts protocol — closure & provider notification | ✅ | 3-no-show → MIA exit, auto |

### Phase 3 · Active Navigation (SOPs 3.1–3.12)

| SOP | Status | Where |
|---|---|---|
| 3.1 PCP accompaniment & post-visit documentation | ✅ | Encounter-typed appointments → pre-selected Gellert template → compliance-checked note |
| 3.2 Specialist/lab/imaging/BH scheduling & coordination | ✅ | Scheduling + lab/BH templates |
| 3.3 Multi-touch appointment confirmation (48h → 24h → day-of) | ❌ | No confirmation-touch feature; appointments have no confirmation states |
| 3.4 Insurance transportation scheduling (Mercy Care/Molina/UHC protocols) | ❌ | No insurance-transport booking; transit is documented in notes only |
| 3.5 In-transit coaching protocol (Connection/Preparation/Education/Reinforcement) | ❌ | No UI presence |
| 3.6 Post-visit follow-up within 24 hours | ❌ | No task spawned on appointment completion |
| 3.7 Medication compliance monitoring & pharmacy navigation | 🟡 | Compliance %s tracked + med-assist template; no reconciliation/capture flow |
| 3.8 SDOH needs assessment & resource connection (Unite Us) | 🟡 | Screening + Z-codes + SDOH template; Unite Us is a note field, not an integration |
| 3.9 Peer support plan development & delivery | 🟡 | Care plans exist (3 templates); not Gellert-specific peer-support plans |
| 3.10 Cancellation & missed-appointment response (same-day) | 🟡 | No-show status exists + no-show KPI; no same-day recovery protocol/task |
| 3.11 Patient Guide submission — Friday 4pm weekly | ❌ | Honest placeholder KPI only ("signal not yet captured — Patient Guide module") |
| 3.12 Daily billing & documentation completion | ⬆ | Charge slips/day-close: one slip per patient-day, Rule of Eights units, sub-8 coaching, Sign & Submit Day, EOD-submission KPI — *plus* the per-navigator reporting AMD can't do |

### Phase 4 · Adverse Event Response (SOPs 4.1–4.6) — ⚑ playbook itself flags this phase as needing definition

| SOP | Status | Where |
|---|---|---|
| 4.1 Notification & initial response | 🟡 | Adverse events tracked with statuses (`currently_inpatient`/`currently_ed`/`monitoring`/`ended`); journey-phase AE overlay badge |
| 4.2 Post-event patient communication | ❌ | No triggered communication step |
| 4.3 Post-discharge PCP within 7 business days | ❌ | The 7-day PCP countdown exists only on the *intake* side, not post-discharge |
| 4.4 Post-discharge medication reconciliation | ❌ | — |
| 4.5 Risk-reduction education & care-plan update | 🟡 | Care plans updatable; no event-triggered flow |
| 4.6 Supervisor notification & escalation criteria | 🟡 | AE view gives supervisors visibility; no escalation object with acknowledge/close |

### Phase 5 · Graduation & Telenavigation (SOPs 5.1–5.5) — ⚑ playbook flags protocol as undefined; the product implemented a reasonable version

| SOP | Status | Where |
|---|---|---|
| 5.1 Graduation readiness assessment | ✅ | Navigator "Flag Graduation Readiness" + note |
| 5.2 Supervisor confirmation of eligibility | ✅ | Supervisor-only confirm, gated on the flag |
| 5.3 Transition communication to patient | ❌ | No patient-facing communication step |
| 5.4 Monthly telenavigation check-in | 🟡 | Cadence + check-in + overdue surfacing built; **check-ins create no TimeLog/billable unit** (billing rules ⚑ TBD with Gellert) |
| 5.5 Re-engagement criteria & protocol | ✅ | Re-engage action, telenav → active |

### Phase 6 · Program Exit (SOPs 6.1–6.7) — ⚑ playbook flags protocol as undefined; product implemented it

| SOP | Status | Where |
|---|---|---|
| 6.1–6.5 The five exit pathways (ineligibility / patient-initiated w/ supervisor confirmation / MIA / safety / deceased) | ✅ | `exit-dialog.tsx` + `ProgramExit`; patient-initiated structurally requires supervisor sign-off |
| 6.6 Exit documentation & record closure | ✅ | Required documentation + `survivalStatus` inactive + journey event |
| 6.7 Referring-provider exit notification | 🟡 | Stamp + audit; no outbound message |

### Playbook cross-cutting sections

**§3 Communication model:** ❌ largely out of product scope today — phone/voicemail standards, "secmsg" email convention, First-Name-Last-Initial phone contacts have no product presence; provider updates are stamps. (Some of this is operational policy, not software; the provider-update templates *are* software-shaped and unbuilt.)

**§4 Billing guidelines:** ⬆ strongest section. One charge slip per patient per day ✅; billing daily by EOD ✅ (tracked as a KPI); no billing before signed Patient Agreement 🟡 (navigation-contract checkbox exists; not wired as a billing gate); billable/non-billable activity rules ✅ (sub-8-minute logic, no-billing-for-continuation-notes, supervision notes non-billable); "if you didn't document it, it never happened" ✅ (the note *is* the time log); arrival/departure screenshots — superseded by EVV GPS check-in/out ⬆.

**§5 KPIs:** `lib/playbook-kpis.ts` — 8 computable live (48h acceptance, units/day vs 16/18/20, EOD billing %, PCP compliance proxy, post-discharge follow-up proxy, no-show rate, ED trend, cost per engaged patient), 1 honest placeholder (Patient Guide Friday 4pm). The playbook's ⚑ TBD metrics (weekly-contact %, SDOH-screen %, missed-appointment recovery, med-compliance confirmation, patient-understanding score, CSAT) are placeholders in their document too — they need definitions from Gellert leadership before they can be built. §5.2 health-plan value KPIs: no-show and ED trends live; HEDIS gap closure and readmission/LOS need payer data the product can't have yet.

**§6 Financial model:** unit economics live (units, rates, per-navigator productivity, windshield time as the unbillable-travel lever ⬆). Transportation economics (stipend vs mileage pilot) — ⚑ analysis item, not software yet.

**§7 Technology enablement (their must-have list):** Referral-to-active CRM ✅ · Patient Guides ❌ / dashboards ✅ · patient profile + AI notes ✅ · engagement tracking 🟡 (contact gaps yes, structured cadence no) · acuity tracking ✅ · billing platform ✅ · BI reporting ✅ (operational/financial/role-based/referral-source; QA-compliance partial). **AI future state:** documentation automation with compliance validation ✅ (this is the compliance engine); no-show prediction, outreach-timing suggestion, high-risk identification ❌ (real ML asks — good discovery-phase material); patient engagement platform (text/chat) 🟡 (in-app messaging exists; no SMS).

**§8–10 Compensation, org, onboarding/training:** navigator levels (1/2/3 → 16/18/20 targets) ✅; the 90-day developmental period, shadowing checklists, certification tracking ❌ (a whole unbuilt module — see roadmap); meeting cadence/daily-KPI-screen 🟡 (dashboards exist; no wallboard mode).

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

### Do we have all the documentation templates? **No — we have the note families, not the full catalog, and none of the non-note documents.**

**Note templates: 8 of ~30 (but the right 8).** The manual organizes Gellert's ~30 AMD note types into 7 families plus supervision, and that's what was built — with transit variants handled as a toggle inside the medical/BH templates rather than separate types (structurally better than AMD's duplication). What is *not* yet distinct: the named AMD variants Mitch showed (intake note, onboarding note, medication-list note, provider-contact-list note, PCP-transit as its own type, "maturing notes," etc.). Getting to parity means enumerating Gellert's actual AMD template list during discovery and either mapping each to a family+preset or adding templates — which is exactly what a template editor makes cheap (below).

**Non-note documents: none exist as documents.** Verified in code — these are attestation checkboxes with audit stamps, with no fillable form, generated PDF, e-signature, upload, or capture behind them:

| Document | Where it's referenced | What exists |
|---|---|---|
| Onboarding packet | Intake 1 checklist | Checkbox only |
| Release of Information (ROI) | Intake 1 checklist | Checkbox only |
| Medication reconciliation / med list | Intake 1 checklist | Checkbox only (med view is display-only) |
| Patient photo | Intake 1 checklist | Checkbox only |
| Patient survey | Intake 2 checklist | Checkbox only |
| Navigation contract (Patient Agreement) | Intake 2 checklist | Checkbox only — and not yet wired as the billing gate the playbook requires |
| **Patient Guide** (weekly, Friday 4pm) | Playbook §5 KPI | Nothing — honest placeholder KPI only |
| Provider contact list | Note manual pain point | ⬆ superseded by the provider directory + auto-fill |

### Do we have *editable* documentation templates in the system? **The architecture yes, the UI no.**

Note templates are pure data (`NoteTemplate` records — fields, types, options, narrative fragments, compliance bindings), which is exactly what makes them runtime-editable *in principle*. But today they ship as seed data and **there is no admin screen to create or edit a template** (verified: no template-management component exists). A **Template Editor** is therefore the highest-leverage next build for the "do we have all the templates" problem: an admin CRUD over templates with a field palette (text/select/time/provider/attestation), section grouping, never-skip flags, narrative-fragment editing with live preview, and compliance-rule binding. It converts "8 of 30 templates" from an engineering task into a Gellert-configurable catalog — and it's a compelling demo beat ("you don't file a ticket to change a note type; you edit it").

---

## 5. Beyond the blitz — the complete unbuilt map

Every item below is demanded by a specific document section. ⚑ = requires a Gellert leadership decision first (per their own playbook flags) — these double as the **discovery-phase agenda**.

### Tier 1 — client-visible, natural next demo beats
1. **Template Editor UI** (§4 above) — unlocks the full ~30-type catalog as configuration.
2. **Patient Guide module** — authoring per patient, weekly submission, Friday-4pm deadline tracking; turns the placeholder KPI live. *(Playbook §5.1, §7.1; ⚑ format/content needs Gellert input.)*
3. **Appointment confirmation engine** — 48h/24h/day-of touches with confirmation states on appointments, plus same-day missed-appointment recovery tasks. *(SOPs 3.3, 3.10.)*
4. **Post-visit follow-up loop** — completing an appointment spawns a 24h follow-up task (confirm understanding, schedule next steps, capture new barriers). *(SOP 3.6.)*
5. **Documents & e-sign layer** — real ROI, navigation contract, survey, med list, photo capture behind the intake checklist items; navigation contract wired as the billing gate. *(SOPs 2.3, 2.7; billing rule §4.)*
6. **Capacity-to-decide gate** — the one missing workflow-map node. *(Map; SOP 1.7.)*

### Tier 2 — operational depth
7. **Adverse-event response workflow** — event-triggered task set: post-event contact, post-discharge PCP-in-7-days countdown (reusing the intake countdown machinery), post-discharge med reconciliation, risk-reduction education step. *(SOPs 4.1–4.6; ⚑ the whole phase needs Gellert definition.)*
8. **Medication reconciliation as capture** — editable med list with reconciliation events, feeding the med-assistance template. *(SOPs 2.3, 3.7.)*
9. **Escalation protocol** — first-class escalation object (raise → supervisor acknowledge → resolve, closed-loop tracked), distinct from SOS. *(Field guide §1.2.)*
10. **Real provider communications** — templated referral-partner messages (intake notification, post-visit updates ⚑ standards TBD, exit notification) replacing the stamp-only stand-in. *(SOPs 1.6, 2.6, 6.7; §3.4.)*
11. **Telenavigation billing** — whether/how monthly check-ins bill. *(⚑ playbook 5.4 explicitly TBD.)*
12. **Caseload tiers** — per-acuity caseload caps and tier-weighted load in Match & Assign. *(⚑ Field guide 1.1 TBD.)*
13. **In-transit coaching prompts** — Connection/Preparation/Education/Reinforcement checklist inside transit-gated encounters. *(SOP 3.5.)*
14. **Structured engagement cadence** — multiple-contacts-per-week tracking per patient (feeds the ⚑ weekly-contact KPI).
15. **Insurance transportation booking** — Mercy Care/Molina/UHC transport protocols. *(SOP 3.4.)*

### Tier 3 — platform and integrations
16. **Backend, auth, multi-user** — the standing deliberate deferral; prerequisite for real HIPAA posture, live GPS, notifications.
17. **Navigator onboarding/training module** — 90-day developmental period, shadowing checklists, pre/post tests, certification and level progression (which already drives billing targets). *(Playbook §10 — directly serves the retention goal.)*
18. **Integrations:** Unite Us (SDOH referrals), Timeero (time/location), live clearinghouse (Availity/Claim.MD — adapter seam exists), St. Joe's ADT/HL7 feed (parser already real), SMS/text engagement. *(§7.3.)*
19. **AI future state:** no-show risk prediction, outreach-timing suggestions, high-risk identification. *(§7.2.)*
20. **Mobile field experience** — the field guide assumes phone-first navigators; the app is desktop-first.
21. **Code-set auto-updates** — ICD/CPT/HCPCS/remark dictionaries tracking CMS releases (Sonya's explicit vendor test).
22. **Wallboard mode** — the daily-KPI screen for the office. *(§9.1.)*

### ⚑ Discovery-agenda items (Gellert decisions needed before building)
Graduation criteria · telenavigation protocol & billing · adverse-event protocol · program-exit protocol details · caseload tier definitions · Patient Guide format · provider post-visit update standards · the six undefined §5.1 KPIs · transportation economics · ongoing-training framework. *(All ⚑-flagged in their own playbook draft.)*

---

## 6. Scorecard summary

| Document | Fully reflected | Enhanced beyond | Partial | Not built |
|---|---|---|---|---|
| **WorkFlow2025 map** (~26 nodes) | 15 | 5 | 7 | 1 |
| **Playbook Phase 1** (7 SOPs) | 4 | 1 | 1 | 1 |
| **Playbook Phase 2** (8 SOPs) | 3 | — | 3 | 2 |
| **Playbook Phase 3** (12 SOPs) | 2 | 1 | 4 | 5 |
| **Playbook Phase 4** (6 SOPs) | — | — | 3 | 3 |
| **Playbook Phase 5** (5 SOPs) | 3 | — | 1 | 1 |
| **Playbook Phase 6** (7 SOPs) | 6 | — | 1 | — |
| **Note manual** (12 elements) | 9 | 1 | 1 | 1 |
| **§7 must-have tech list** (7 items) | 5 | — | 1 | 1 |

**Headline:** the referral-to-graduation spine, the note manual, and daily billing are *running in the product* — roughly two-thirds of everything the three documents describe, with five genuine enhancements beyond their paper process. The remaining third clusters into exactly three buildable themes (documents/e-sign, time-based engagement protocols, response workflows) plus the items Gellert's own playbook says need leadership decisions first — which is precisely what the proposed discovery phase is for.
