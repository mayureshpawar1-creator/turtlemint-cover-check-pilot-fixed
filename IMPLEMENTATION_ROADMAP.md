# Implementation Roadmap

Prioritised plan built on the audit (16 Nov 2026). It follows the brief's phases, but pulls the pieces needed for the **first milestone** (a working end-to-end journey with reliable tracking and lead capture) forward, as the brief instructs. Sizes: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks for one engineer.

## The four milestones the product must keep separate

| Milestone | Meaning | Customer-visible advice allowed |
|---|---|---|
| **M1 Functional journey prototype** | Journey, tracking, lead capture and caller hand-off work end to end | Education and the customer's own answers back to them; no suggested cover amount |
| **M2 Verified research-backed assessment** | Rules and scenarios approved by advisory/actuarial, every figure sourced | Coverage scenarios with assumptions |
| **M3 Live product and premium integration** | Approved product facts + authorised quote source | Named products and real premiums |
| **M4 Production-ready acquisition workflow** | SSO, monitoring, backups, legal sign-off, pilot runbook | Full experience to real campaign traffic |

---

## Phase 0 — Audit ✅ (this session)

Delivered: `EXISTING_SYSTEM_AUDIT.md`, `CURRENT_ARCHITECTURE.md`, `PRODUCT_GAP_ANALYSIS.md`, `DATA_GAP_ANALYSIS.md`, `DATA_SOURCE_REGISTER.md`, `KNOWN_ISSUES.md`, this roadmap, `DEVELOPMENT_PROGRESS.md`.

---

## Milestone 1 — Functional journey with reliable tracking and lead capture (≈ 5–6 weeks)

### 1.1 Stabilise the repository (S–M) — ✅ done 16 Nov 2026 on branch `fix/m1-stabilise` (except `npm audit`, which needs network)
- Decide on `PlanExploration.tsx`: fix it, or remove it and restore `CoverPlan.tsx`/`PlansFit.tsx` to HEAD (B1).
- Fix the retention cursor: carry `retention_until` as the exact DB text value, or compare with `doc_id` tie-break via a returned row number; make `retentionService.test.ts` pass (B2).
- Remove stray files (`haredsrcrecommendations.ts`, `pose()`, `temp.txt`, `test.txt`, `test-engagement.ts`, `validateProducts.js`, root `test*Extractor*.ts`) and `shared/src/productDatabase.ts.backup`; untrack `backend.log`; normalise line endings (`.gitattributes`); fix the mojibake in `flow.tsx` (B6).
- Add CI (GitHub Actions): `npm ci` → typecheck → shared tests → backend tests with a Postgres service → frontend build → `npm audit --omit=dev`.
- Remove `npm test -w backend` from the Dockerfile build stage (it needs a database; B7). CI runs it instead.
- Re-run `npm audit`; patch body-parser; plan the zod/vite upgrades.
- **Exit:** CI green on a clean checkout; no untracked work in the main branch.

### 1.2 One event contract (M) — fixes B3/B4 — ✅ done 16 Nov 2026
- `shared/src/events.ts`: names, kinds (milestone vs interaction), per-event prop schemas, version.
- Generate the DB constraint (or use a lookup table) from the same list; migration 009.
- Collector: batch endpoint, 202 response, `event_rejects` table, counter on the data-quality view.
- Remove client-side duplicates of server milestones; map the useful `useEngagement` events (time on screen, help opened, option opened) onto the contract; drop the rest.
- **Exit:** a test fails if any client event name is not in the contract; zero rejects on the prototype click-through.

### 1.3 Campaigns and attribution v1 (M) — ✅ v1 done 16 Nov 2026 (generic no-phone links → 1.3b; see `CAMPAIGN_FUNNEL_BASELINE.md`)
- Migration: `campaigns`, `campaign_links`, `campaign_variants`; `source` gets `campaign_link_id`, `variant_id`, `utm_content`, `utm_term`, `referrer`, `visitor_id`.
- Generic links `/h/<slug>?utm_*` with an anonymous session and first-party visitor cookie; per-recipient signed links keep working.
- Click redirect `/r/<link_id>`; landing headline/sub-copy pulled from the campaign variant; remove the hardcoded `cover_fest` UTM (`withUtm` takes the active campaign).
- SQL views: funnel by campaign × variant × day, "not tracked" vs 0.
- Ops CLI (now) → admin screen (Phase 6): create campaign, issue links, export link list for the BSP.
- **Exit:** two test campaigns × two variants show separate funnels from click to hand-off.

### 1.4 Journey v5: adaptive questionnaire, first six intents (L) — ✅ core done 16 Nov 2026 (left-overs → 1.4b)
**Done:** question graph on the one screen (`quiz.ts`, `FLOW_VERSION = 'v5'`); six intents derived by `intentOf()` and shown on the caller card; parents' age asked whenever parents are added; company cover asks who it includes when there is family; yearly premium comfort replaces income; optional "Also interested in life or critical-illness cover?" stored as `other_protection_interest` (caller card only); term-life and critical-illness blocks removed from plan screen, WhatsApp summary and caller card; B5 fixed; server refuses answers the graph doesn't ask (`disallowedFields`); `question_answered` event + `question_dropoff` view; migration 011. Tests: one per intent, shortest path 6 taps (max 9 when adding parents), server refusals.
**1.4b:** ✅ `question_viewed` / `question_skipped` events; ✅ checked at 390×690 in headless Chrome — every card state fits without scrolling (age chips on one line, optional card appears only once the plan is ready, company question compacts the Who card). Still open: spouse and children ages; save per question (still per screen); PIN placement.

- Question graph in `shared/` (see `PRODUCT_GAP_ANALYSIS.md` §5): intents first-time, own individual, own floater, corporate only, corporate + own, cover parents; "exploring" falls back to first-time.
- Per-member age bands (parents included); corporate follow-ups (dependents, parents, after leaving the job); premium comfort range; PIN at the right point.
- Add one optional last question: "Also interested in life or critical-illness cover?" (Yes / Maybe later / No). Store it as `other_protection_interest`; show it on the caller card; it never changes advice or lead score.
- Income becomes optional, used for affordability only; fix the "Never shared" copy, or stop putting income on the caller card (decision D2).
- Fix B5: parents' plan only when parents' age band is 60+.
- Save and resume per question; question-level `question_viewed` / `question_answered` / `question_skipped` events.
- **Exit:** end-to-end test per intent; shortest path ≤ 8 taps; server rejects any answer the graph doesn't allow.

### 1.5 Assessment screens, honestly labelled (M)
- Merge `advice.ts`, `insights.ts`, `planBoard.ts` into one `rules/` module; each rule has id, version, source or "assumption", owner, tests.
- Screens 1, 2 and 6 from the brief (profile, assessment, speak to an expert). Every figure carries a label: CUSTOMER INPUT / FACT / RULE / ASSUMPTION / UNVERIFIED.
- The cover-amount formula is an unapproved hypothesis (D3a): show **no** suggested rupee amount. Show the customer's own inputs, what each factor means (family size, age, city, existing cover) and what to check in a policy. Keep the formula as an internal, versioned hypothesis for offline evaluation. Never auto-recommend a super top-up (`ADVICE_EVIDENCE_STANDARD.md`).
- Remove the term-life and critical-illness blocks (amounts, priorities, picks) from the plan board, the WhatsApp summary template and the caller card/CSV (D3b). Delete `TERM_MULTIPLE`, `CRISIS_YEARS` and the term/crisis persona priorities.
- Before contact consent, show the customer exactly what the caller will see.
- **Exit:** a snapshot test proves no unlabelled figure renders.

### 1.6 Lead model, scoring v0, caller dashboard MVP (L)
- Migration: `leads` gains intent, budget, concerns, readiness_score, needs_category, score_version; new `lead_assignments`, `contact_attempts`, `follow_up_tasks`.
- Readiness score and needs category per `PRODUCT_GAP_ANALYSIS.md` §7; documented in `docs/LEAD_SCORING.md`; medical data excluded by test.
- Caller dashboard in the same SPA (role-gated route): queue sorted by SLA then score, lead card, outcome form with the brief's 16 outcomes, follow-up scheduling. Manual assignment by a team lead.
- Per-user caller accounts (SSO if available, decision D5; otherwise short-lived per-person accounts as a stop-gap); every card view written to an access log.
- Keep CSV export as an admin-only fallback.
- **Exit:** a synthetic lead goes landing → consent → OTP → queue → assigned → attempted → follow-up → outcome, all in-app, with the funnel view counting each step.

### 1.7 Security quick wins (S–M) — ✅ done 16 Nov 2026 (needs ops: create DB logins with `deploy/db-roles.sql`, set `DATABASE_SSL_CA`)
- Exchange the link token for an HttpOnly, SameSite session cookie; shorten the token TTL.
- Separate keys for link signing and local document encryption.
- Webhook secret by header or BSP signature only.
- Database login roles for app, migration, agent and BI; runtime uses the least-privileged one.
- `DATABASE_SSL_CA` set for the chosen host.

**M1 exit criteria (all required):** CI green; full synthetic journey per intent; zero rejected events; funnel by campaign from click to outcome; no unlabelled advice; lead handled in-app by a named caller; synthetic data only.

---

## Milestone 2 — Verified research-backed assessment (≈ 6–8 weeks, overlaps M1)

**Phase 3 — Research and intelligence infrastructure**
- Extend migration 008 into the schema in `DATA_GAP_ANALYSIS.md` §4 (variants, fact definitions, lifecycle statuses, conflicts, regulatory rules, cost and claims tables).
- Ingestion jobs for the 20 registered sources; reviewer workflow UI (approve / reject / conflict with approval reference); data-quality dashboard.
- Encode the first regulatory rules from the Master Circular with clause references and tests (PED waiting cap, moratorium, portability, grace period).
- Load CGHS 2025 and PM-JAY package rates; NSS 80th round aggregates.

**Phase 4 — Assessment and recommendation engine**
- Coverage scenarios (Essential / Balanced / Higher) with an advisory/actuarial-approved method (decision D3).
- Existing-policy gap analysis using only verified or customer-confirmed facts.
- Corporate cover assessment: counted only while employed; gaps shown only when supported.
- Product suitability matcher reading only `approved_product_facts`; explains "why not" as well as "why".

**Exit:** each scenario reproducible from inputs + rule versions + source records; advisory sign-off recorded; `ADVISORY_RULES_APPROVED=true` set with a reference.

---

## Milestone 3 — Live products and premiums (depends on D4)

- Ingest and review the top 3–5 products per intent from the 12 named insurers (variant-specific).
- Integrate Turtlemint's authorised quote service or insurer APIs; store each quote with source, timestamp and validity. No extrapolated premiums.
- Screen 5 (relevant options) with "why it may or may not fit".
- Wire proposal, payment and **verified issuance** records from Turtlemint systems for funnel stages 15–18.

---

## Milestone 4 — Pilot and production readiness

**Phase 5/6 completion:** full assignment rules (capacity, language, skills, escalation); admin BI (overview, campaign, customer, journey, lead management, product intelligence, data quality) with minimum group size; A/B experiments measured on qualified leads and issued policies; BSP delivery/read webhooks.

**Phase 7 — AI (grounded):** explanations and caller brief from stored inputs + approved facts only, citations required, refusal when no source; evaluation set of high-risk questions; hallucination and citation-accuracy tracking; approved provider configuration.

**Phase 8 — Controlled pilot:** legal sign-off on notices and consent (DPDP Rules 2025 phases, TRAI calling series), security review, restore drill, monitoring and alerting, pause procedure, 10–15 synthetic-to-real users with approved campaign links.

**Phase 9 — Production:** staging, blue/green or tagged rollback, backups with off-site copies, incident response, runbooks, on-call.

---

## Decisions needed from you (blocking items marked ⛔)

| ID | Decision | Blocks |
|---|---|---|
| ✅ D1 | **Answered 16 Nov 2026: none of the 15 files in `backend/.data/docs` were real policies.** Not an incident. Keep `.env` and `.data/` out of shared zips; development uses synthetic documents only (`CLAUDE.md` §2.3). | — |
| ✅ D2 | **Resolved 16 Nov 2026 (1.4): income is no longer asked, stored, shown to callers or exported.** Old v3/v4 rows still hold `income_band`; whether to purge them is a retention call for the data owner. | 1.4 |
| ✅ D3a | **Answered 16 Nov 2026: nobody has signed off the cover-amount rules; they are the owner's working hypotheses.** M1 shows **no customer-facing "you need ₹X" figure** and no auto-recommended top-up. It shows the customer's own inputs, what each factor means and what to check. The formula stays internal and is tested later against caller feedback and real cases. **Still open:** a named Turtlemint owner (health product or underwriting) must approve a sourced method before any amount reaches real users. A candidate method is ready for that review: `SUM_INSURED_METHOD.md` (evidence floors, every input sourced, no income). | 1.5, M2 |
| ✅ D3b | **Decided 16 Nov 2026: remove term-life and critical-illness advice** from the plan screen, the WhatsApp summary and the caller card. Replace with one optional end-of-journey question, "Also interested in life or critical-illness cover?", stored as an interest flag the caller sees. No amounts, no recommendation. | 1.4, 1.5 |
| D4 | Access to Turtlemint's quote, proposal, payment and policy-issuance systems (API or data feed) | M3, funnel stages 15–18 |
| D5 | Caller login: Turtlemint SSO provider and roles, and who the pilot callers are | 1.6 |
| ⏳ D6 | **Agreed 16 Nov 2026:** the data team will provide access to Turtlemint claims data (timeline to be confirmed). Next: agree the field list, anonymisation level and access route with the data team and privacy, then load it as a `dataset_releases` source. | Turning cover floors into real ranges; scoring calibration; customer intelligence |
| D7 | Collect health disclosures in the pilot (needs separate consent and restricted storage) or defer to M2? | 1.4 scope |
| D8 | Legal review owner for consent/notice text under the DPDP Rules 2025 and TRAI TCCCPR 2025 (140/1600 series for caller numbers) | M4 pilot |
| D9 | Hosting for the pilot: Render + Supabase (as built) or Turtlemint AWS | M4 |
| D10 | Branding: the brief says not to brand internal prototypes as Turtlemint without approval; the current UI links to Turtlemint pages and uses Turtlemint naming | 1.3 landing config |
