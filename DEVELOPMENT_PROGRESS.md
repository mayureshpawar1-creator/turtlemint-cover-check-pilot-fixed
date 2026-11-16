# Development Progress

Updated after every significant session. Newest first.

---

## Session 7 — 16 Nov 2026 — 1.4b leftovers + roadmap 1.7 (security quick wins)

### Completed
- **Quiz fits the phone:** rendered the real quiz screen in headless Chrome at 390×690 for the four tallest states. v5 had overflowed by 8–109 px; now none scroll. Age chips sit on one line; the optional life/CI card appears only once the plan is ready; with the company question the Who card drops stepper sub-lines; two titles shortened.
- **Question events:** `question_viewed` and `question_skipped` join `question_answered`; `question_dropoff` now shows viewed / answered / skipped per question (still never the answer).
- **S3 session cookie:** opening the WhatsApp link sets an HttpOnly, Secure, SameSite=Lax cookie (Path=/api; 72 h default, `WEB_SESSION_HOURS`); only its hash is stored (`web_session`, migration 012). The app removes the token from the address bar; a reload uses `GET /me` without logging a new click. Bearer token kept as a fallback for cookie-blocking browsers. Link lifetime 14 → 7 days.
- **S2:** local document store no longer keyed by the link-signing secret.
- **S6:** `MIGRATION_DATABASE_URL` for migrations; production refuses to start if the app's DB login is a superuser, owns the schema or isn't in `cover_check_app`; `deploy/db-roles.sql` template.
- **S7:** webhook secret accepted in the `x-webhook-secret` header only.
- **S8:** production requires `DATABASE_SSL_CA` (verified TLS).

### Tested
Shared 103/103 · backend 63/63 (new `security.test.ts`: cookie flags, cookie-only calls, reload without a new click, forged/expired refused, webhook header-only, least-privilege check, production config) · migrations 011+012 on an existing DB ✅ · fresh DB + SQL smoke ✅ · typecheck ×3 ✅ · frontend bundle ✅.

### Before deploying (ops)
1. Create DB logins with `deploy/db-roles.sql`; set `DATABASE_URL` (app login) and `MIGRATION_DATABASE_URL`.
2. Set `DATABASE_SSL_CA` to the provider's CA bundle.
3. Ask the WhatsApp BSP to send the webhook secret as the `x-webhook-secret` header (the `?secret=` URL stops working).
4. Serve the API and web app on the same domain (as `WEB_DIST` does) — the cookie is SameSite=Lax.

### Next
1.5 — stop showing the unapproved cover amount to customers (D3a), merge the three advice layers, label every figure.

---

## Session 6 — 16 Nov 2026 — Roadmap 1.4: journey v5

### Completed
- **Question graph** (`shared/src/quiz.ts`, v5): still one screen of cards — Cover · Who · Age · Budget · Where · Also (optional). Questions appear only when they apply: "Does your company cover include them?" (company cover + family), "Eldest parent's age" (parents added).
- **Six intents** derived from answers (`intentOf`): first-time, own individual, own floater, company only, company + own, adding parents. "Just exploring" falls back to first-time. Shown on the caller card.
- **Income removed** (decision D2): not asked, not stored, not on the caller card or export. The false "Never shared" line is gone. The cover rule lost its "+₹10 L for high income" step.
- **Premium comfort** (yearly, family): shapes tips (base + super top-up on a tight budget; no room-rent cap when roomy). Never changes how much cover is suggested.
- **Life / critical illness (D3b):** term and crisis blocks, amounts, priorities and picks removed from the plan screen, WhatsApp summary (via recommendations) and caller card. Optional last question stored as `other_protection_interest`; caller card shows it; a test proves it never changes the advice.
- **B5 fixed:** a parents' plan only for parents 60+; parents under 60 get a new "caregiver" note about joining the family floater. R6 can now fire. One `hasParents60` used by plan board, advice, readout and insights.
- **Server refuses** answers the graph doesn't ask (e.g. income, parents' age with no parents, cover amount with no cover) instead of dropping them silently; the API schema no longer accepts `income_band`.
- **Events:** `question_answered` (field, card, ms, unsure — never the answer). View `question_dropoff`.
- **Migration 011:** `premium_comfort`, `other_protection_interest`, caller-card view columns, event CHECK, `question_dropoff`.

### Behaviour changes to know
- Someone well covered, or unsure of their cover, now gets **no plan to buy** (previously term and crisis always appeared).
- v4 sessions with parents but no parent age are no longer treated as 60+.

### Tested
| Check | Result |
|---|---|
| Typecheck shared / backend / frontend | ✅ |
| Shared tests | ✅ 103/103 (per-intent fixtures, shortest path, refusals, B5, interest-never-changes-advice) |
| Backend tests (fresh DB, 001–011) | ✅ 57/57 (server refuses income and parents' age without parents) |
| Migration 011 on an existing DB (001–010 applied) | ✅ |
| SQL smoke test | ✅ |
| Frontend bundle (esbuild) | ✅ |
| Visual check of the quiz at 390×690 | Not done — needs a browser build (Rollup has no Linux binary here) |

### Remains (1.4b)
Spouse and children ages; `question_viewed` / `question_skipped`; save per question; PIN placement; visual fit check. Then 1.3b or 1.5.

### Requires your decision
- Whether to purge the income values already stored from v3/v4 sessions (retention).

---

## Session 5 — 16 Nov 2026 — Campaign baseline + roadmap 1.3 (campaigns and attribution v1)

### Completed
- **Baseline from Turtlemint data** (aggregates only; `CAMPAIGN_FUNNEL_BASELINE.md`). Quote → issued policy, 2025–26: partner (POSP) 1.73 %, direct 0.18 %. Direct customers who reach an order pay only 3.5 % of the time (partner 18.7 %). `utm_campaign` has never been filled, so past campaigns can't be measured. Existing `healthmarketing / whatsapp` traffic: 886 quotes → 1 issued policy in 2026.
- **Campaign registry** (migration 010: `campaign`, `campaign_variant`), `POST /ops/campaigns`, `GET /ops/campaigns/:id/funnel`.
- **Links:** token carries variant; issuing a link (API or `links:batch`) requires a registered campaign / variant; old unregistered links still open.
- **Every link open records** variant, `utm_content`, `utm_term` and referrer (long values cut, never rejected).
- **Landing copy per variant**, by language, falling back to the door's copy.
- **Outbound plan links** carry the visitor's campaign / channel / variant (`attributeUrl`); `cover_fest` removed. Quotes on turtlemintinsurance.com can now be credited to the campaign.
- **`campaign_funnel_daily`** view: first-touch, per campaign × variant × day, from link opened to enquiry created; quote / payment / issuance marked "not tracked here".

### Tested
| Check | Result |
|---|---|
| Typecheck shared / backend / frontend | ✅ ✅ ✅ |
| Shared tests | ✅ 87/87 (3 new: no hard-coded campaign, link stamping, no-op cases) |
| Backend tests, fresh PostgreSQL 16, migrations 001–010 | ✅ **57/57** (6 new: register campaign; refuse unknown campaign / variant; variant landing copy + attribution + source fields; fallback copy + long UTM cut; legacy link still opens; funnel counts per variant + 404) |
| Migration 010 on an existing database; SQL smoke test; frontend bundle | ✅ ✅ ✅ |

### Remains
- **1.3b:** reusable campaign links without a phone number (`/h/<campaign>`), which needs leads that start without a mobile.
- **1.4:** journey v5 (intents, per-member ages, the optional life / critical-illness interest question).

---

## Session 4 — 16 Nov 2026 — Data discovery in Superset + cover method v1

### Completed
- **Superset discovery** (with the owner's browser session, structure and counts only, no customer rows). Mapped all 87 requested columns in the data-request sheet: 50 available, 27 partly, 3 need privacy approval, 7 not found. Key sources are in Athena `spectrum`: claims system (~81k health claims), quote requests (6.6 M), orders → policies (317k), renewals (517k), hospital master (27k), call logs.
- **Claim-cost analysis** (aggregates only, groups ≥ 30): ~22,000 hospital bills. Median ₹42.7k, 95th pct ₹2.52 L, 99th pct ₹5.94 L; metro 95th/99th ₹4.07 L / ₹9.05 L vs other cities ₹2.57 L / ₹6.93 L; top-5 % bills grew 10.4 %/yr 2023→2025.
- **Cover method v1** (`coverScenarios.ts`, `SUM_INSURED_METHOD.md`): Essential / Balanced / Higher = 95th / 99th / 99th+90th percentile bill for the city tier, never below the v0 government floor, grown 3 years at our own 10.4 %. Metro ₹5.5 L / ₹12.5 L / ₹16 L; other cities ₹3.5 L / ₹9.5 L / ₹12 L. Still not shown to customers.

### Tested
Typecheck shared / backend / frontend ✅. Shared tests ✅ 84/84 (9 scenario tests rewritten for v1).

### Requires your decision
- A Turtlemint owner (health product or underwriting) to review `SUM_INSURED_METHOD.md` v1 (D3a).
- Data team: claim ↔ policy ↔ member mapping with age bands, so amounts can be per policy year and by age (D6).

---

## Session 3 — 16 Nov 2026 — Roadmap 1.2: one event contract

**Branch:** `fix/m1-stabilise` (local). Not pushed, not committed. Included in the same patch.

### Completed
- **One event list, two kinds** (`shared/src/enums.ts`): 22 server milestones that only the API records, and 18 browser interactions accepted at `POST /events`. Every name previously in use is kept, so old rows stay valid. New names: `cta_clicked` (a "next action" button click; it used to be logged under the milestone name `next_action_selected`) and `screen_exited` (time on screen).
- **API:** `POST /events` accepts browser interactions only. Anything else is answered 202 and logged in the new `event_reject` table (name, screen, reason only, no lead or props), instead of failing silently.
- **Migration 009:** the database CHECK is generated from the shared list; adds `event_reject` and the `event_reject_daily` view for the data-quality dashboard.
- **Frontend:** the API client only accepts browser event names, so TypeScript blocks a wrong name at compile time. `trackEvent` no longer resends milestones the server already records. `screen_viewed` is sent once per screen (it was sent up to 3 times), and `screen_exited` carries the time spent.

### Tested
| Check | Result |
|---|---|
| Typecheck shared / backend / frontend | ✅ ✅ ✅ (also proves every event name used in the app is in the contract) |
| Shared tests | ✅ 83/83 |
| Backend tests, fresh PostgreSQL 16 with migrations 001–009 | ✅ **51/51**, including 7 new: DB list = code list, no overlap, backend logs only milestones, browser mapping, and the real `POST /events` endpoint (stores interactions; refuses and records milestones and unknown names; never stores props of a reject) |
| Migration 009 on an existing database with event rows | ✅ applied, no rows lost |
| SQL smoke test; frontend bundle (esbuild) | ✅ ✅ |

### Effect on analytics
- Funnel milestone counts now come only from the server, so there is no double counting.
- Engagement interactions (tool use, content toggles, plan detail views, …) are stored for the first time.
- `SELECT * FROM event_reject_daily` should stay empty. Any row means the app and the contract disagree.

### Remains
Roadmap 1.3 (campaigns and attribution v1).

---

## Session 2 — 16 Nov 2026 — Milestone 1.1 + cover-amount method

**Branch:** `fix/m1-stabilise` (local, from `docs/phase-0-audit`). Not pushed, not committed. Delivered as a patch.

### Completed
- **Repository stabilised (roadmap 1.1).**
  - Parked the broken `PlanExploration.tsx` in `archive/parked/` and restored `CoverPlan.tsx` and `PlansFit.tsx` to the last commit. Reasons in `archive/README.md`.
  - Fixed the retention cursor (B2).
  - Moved stray root files and the fabricated product backup to `archive/`.
  - Untracked `backend.log`, fixed the garbled text in `flow.tsx`, added `.gitattributes`.
  - Removed DB-backed tests from the Docker build (B7) and added a CI workflow.
- **Cover-amount method (D3a).** Researched the public cost data and wrote `SUM_INSURED_METHOD.md` plus `shared/src/coverScenarios.ts` with 8 tests. Every input is sourced; income is excluded; outputs are floors at government rates. Three sources were added to `benchmarks.ts`. The module is not wired into the UI.

### Tested (fresh PostgreSQL 16 database, all migrations applied)
| Check | Result |
|---|---|
| Typecheck shared / backend / frontend | ✅ ✅ ✅ |
| Shared tests | ✅ 83/83 (75 existing + 8 new) |
| Backend tests | ✅ **44/44**, including the retention sweep that failed before |
| SQL smoke test | ✅ |
| Frontend bundle (esbuild, both entry points) | ✅ compiles. The Vite build itself wasn't run: no Linux Rollup binary in the sandbox. CI runs it. |
| `npm audit` | Not run (no network). CI reports it. |
| CI workflow | Written, not yet run on GitHub |

### Remains
- Roadmap 1.2 (one event contract, fixes B3/B4), then 1.3 (campaigns), 1.4 (journey v5 incl. the optional life/critical-illness interest question), 1.5 (assessment screens, using `coverScenarios` once approved).

### Requires your decision
- Review `SUM_INSURED_METHOD.md`, and name who at Turtlemint approves it (D3a).
- ✅ D6 agreed (16 Nov 2026): the data team will provide claims data access; timing to be confirmed. Next: field list and privacy review.

---

## Session 1 — 16 Nov 2026 — Phase 0 audit

**Branch:** `docs/phase-0-audit`, created locally from `feat/production-readiness-pilot` (`61838ba`). Not pushed. No commits made. Uncommitted work from the uploaded zip was left untouched.

### Completed
- Full read of `shared/`, `backend/`, `frontend/src`, `data/`, `deploy/`, `docs/`, root config and git history.
- Ran typecheck, unit tests, database-backed tests and the SQL smoke test (results below).
- Verified the first 20 official sources by web search (existence/date only; no downloads).
- Wrote: `EXISTING_SYSTEM_AUDIT.md`, `CURRENT_ARCHITECTURE.md` (current + target + funnel map), `PRODUCT_GAP_ANALYSIS.md` (incl. adaptive questionnaire, attribution/event design, lead scoring and hand-off), `DATA_GAP_ANALYSIS.md` (incl. intelligence database design), `DATA_SOURCE_REGISTER.md`, `KNOWN_ISSUES.md`, `IMPLEMENTATION_ROADMAP.md`, this file.

### Changed
- Documentation only. **No application code, schema, data or configuration changed.**

### Tested

| Check | Result |
|---|---|
| Typecheck, HEAD with uncommitted work stashed | ✅ shared, backend, frontend |
| Typecheck, working tree as uploaded | ❌ backend (2 errors, `retentionService.ts`) · ❌ frontend (18 errors, `PlanExploration.tsx`) |
| Shared unit tests | ✅ 75/75 |
| Backend tests on local PostgreSQL 16 (migrations 001–008 + seed applied) | 43/44 ✅; ❌ retention sweep (`expected 101, got 102`) |
| SQL smoke test | ✅ |
| DB rejects `recommendation_engaged` event | Confirmed (CHECK violation) |
| Frontend build, `npm audit` | Not run (Windows-only binaries in zipped `node_modules`; no network) |

Test environment: throwaway PostgreSQL 16 in the sandbox; Linux esbuild substituted for the Windows binary; a `DOMMatrix` stub preloaded for `pdfjs`. No application code was modified for testing.

### Failed / found broken
B1 frontend build, B2 retention cursor, B3 engagement events dropped, B4 duplicate events, B5 parents assumed 60+, B6 mojibake, B7 Docker build runs DB tests without a DB (inferred from code, not run). Details in `KNOWN_ISSUES.md`.

### Remains (next session)
Milestone 1, step 1.1 (stabilise the repository), then 1.2 (event contract). See `IMPLEMENTATION_ROADMAP.md`.

### Decisions received (16 Nov 2026, same session)
- **D1:** none of the files in `backend/.data/docs` were real policies → S1 is not an incident.
- **D3a:** cover-amount and scenario rules are the owner's working hypothesis with no sign-off → no customer-facing amount in M1.
- **D3b:** term-life and critical-illness advice removed from the plan screen, WhatsApp summary and caller card; replaced by one optional interest question. Roadmap steps 1.4 and 1.5 updated.

### Note on unexpected file changes
During this session, `KNOWN_ISSUES.md` and `IMPLEMENTATION_ROADMAP.md` were edited by something other than this session, recording D1 the opposite way ("real customer policies"), and the test files in the scratch copies of `backend/.data/docs` were deleted. The owner confirmed the files were not real. Both documents were corrected. The original upload was not affected.

### Requires your decision
- **D3a (remaining):** a Turtlemint owner (health product or underwriting) to approve any cover-amount method before real users see amounts (M2).
- D2 (income on caller card), D4 (quote/policy system access), D5 (caller SSO), D6 (first-party data), D7 (health disclosures in pilot), D8 (legal review owner), D9 (hosting), D10 (branding). Full list in `IMPLEMENTATION_ROADMAP.md`.
