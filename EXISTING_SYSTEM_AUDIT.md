# Existing System Audit — Cover Check

- **Audit date:** 16 Nov 2026
- **Repository state audited:** branch `feat/production-readiness-pilot`, HEAD `61838ba`, **plus** the uncommitted working-tree changes in the uploaded zip (`retentionService.ts`, `PlanExploration.tsx`, edits to `CoverPlan.tsx`, `PlansFit.tsx`, `server.ts`, `documentRepository.ts`).
- **Method:** read every source file in `shared/`, `backend/`, `frontend/src`, `data/`, `deploy/` and `docs/`; ran the typecheck, the shared and backend test suites and the SQL smoke test against a throwaway local PostgreSQL 16; checked each finding against code or a running test.
- **Not done:** no deploy, no push, no production database, no live WhatsApp/SMS/Supabase call, no `npm audit` (no network from the build sandbox), no frontend production build (the zipped `node_modules` has only Windows Rollup binaries).

> **Plain verdict.** This is a **well-structured, consent-first pilot funnel**, not a messy codebase. The layering, the consent model and the "never invent a fact" safeguards are good and should be kept. It is **not yet** the acquisition-and-conversion engine in the master brief. The biggest gaps are: no campaign model, broken engagement tracking, no caller workflow beyond a CSV, no admin/BI surface, recommendation rules that are not backed by sources, and an empty product catalogue. The uncommitted working tree **does not build**.

---

## 1. What the system is today

"Cover Check" is a WhatsApp-to-telecaller funnel:

1. A **signed, per-recipient link** (`/c/<token>`; the token carries mobile, door, campaign id, creative id and template id) opens the web app. There is no login.
2. **Landing (S0)** shows one of four "doors" (`get`, `check`, `company`, `review`).
3. **One-screen quiz (S1, flow v4):** cover today (none / own / company, ± own policy), sum-insured band, adults/children/parents, age band, income band, metro/other city.
4. **Cover plan (S7):** health cover "need vs have", plus term-life and critical-illness blocks, persona-driven priorities, plan *types* (no named products, no prices).
5. **Capture (S8):** first name, pincode, confirm WhatsApp number.
6. **Next step (S9):** advisor call (needs a contact-consent tick **and** OTP), callback, see plans, WhatsApp summary (preview first, then send), upload policy.
7. **Policy upload (U1–U7):** separate consent → OTP → encrypted storage → extractor (manual in production) → customer confirms facts → "policy board".
8. **Telecaller hand-off:** `agent_queue` view → CSV export (`npm run export:leads`) → callers fill outcome columns → CSV import.

## 2. Area-by-area status (the 17 areas in the brief)

| # | Area | Status | Evidence |
|---|---|---|---|
| 1 | Frontend architecture | **Works at HEAD; broken in working tree** | React 19 + Vite SPA, one screen at a time (`App.tsx`, `state/flow.tsx`). HEAD typechecks clean. Working tree fails: `PlanExploration.tsx` (untracked) is imported by `CoverPlan.tsx` and `PlansFit.tsx` and has 16+ type errors (wrong import paths, undefined names such as `turtelmintPick` and `setIsExpanded`, missing exports). |
| 2 | Backend architecture | **Works** | Express + TypeScript; thin routes → services → repositories (all SQL in repositories); Zod at the API boundary; Helmet, CORS, rate limiting; refuses to start in production with laptop settings (`config/env.ts`). |
| 3 | Database and storage | **Works (pilot scale)** | PostgreSQL, 8 ordered migrations under an advisory lock. Append-only consent ledger; CHECK constraints stop a queued call without consent. Documents are AES-256-GCM encrypted before storage (local / S3 / Supabase adapters). |
| 4 | APIs and integrations | **Partial** | REST v1 is documented in `README.md`. AiSensy, Gupshup and Exotel adapters have unit tests; none was verified live. No CRM, quote or insurer integration. |
| 5 | Auth and sessions | **Partial / risky** | Customer: the signed link token is the only credential, valid 14 days, carried in the URL. Agent: one shared static key; the agent's identity is a self-declared `x-agent-id` header. No admin role. |
| 6 | Customer journey | **Works, narrow** | 3 situations (none / own / company) instead of the brief's 11 intents. No renewal, porting, parents-only, multiple-policy or "exploring" journeys. Health disclosures are not collected in v4. |
| 7 | Forms and inputs | **Works** | Every quiz question is declared once in `shared/src/quiz.ts`; the UI renders it and the server re-validates with the same definition. |
| 8 | AI functionality | **None** | No LLM, RAG or embeddings anywhere. All "advice" is deterministic TypeScript. That is a sound starting point for Layer 2 of the brief. |
| 9 | Recommendation logic | **Partial, unsupported** | `advice.ts`, `planBoard.ts`, `insights.ts`, `persona.ts`, `policyBoard.ts`. The rules are deterministic but **not backed by sources** (see §5). Three overlapping layers compute the same things. |
| 10 | Insurance product information | **Empty (correctly)** | `REAL_INSURANCE_PRODUCTS = []` and `TURTLEMINT_PICKS` are all empty and approval-gated, so nothing named is shown. **However** `shared/src/productDatabase.ts.backup` is *tracked in git* and holds named-insurer products with made-up premiums (for example "ICICI Lombard … basePremiumInr: 8500"). |
| 11 | Data sources | **Partial** | `benchmarks.ts` has 8 cited sources, some marked VERIFY. Migration 008 and `product:ingest` give an evidence-first ingestion path for insurer PDFs (pending-review snippets only; no reviewer UI). |
| 12 | Analytics and tracking | **Partly broken** | Server-side funnel events work. **Client engagement events are silently lost** (§4, B3). Funnel views exist only as SQL (`funnel_daily`, `screen_dropoff`, `card_dropoff`, `recommendation_funnel`), cut by *door*, not by campaign. |
| 13 | Lead capture and management | **Partial** | Lead state (incomplete / data_only / consented_warm / hand_raised), P1–P4 priority and SLA. Hand-off works through CSV export/import only. No assignment, no follow-up tasks, no quote/proposal/payment/issuance stages. |
| 14 | Admin dashboard | **Missing** | No admin UI. `LeadCardView` exists only inside the clickable prototype (`prototype.tsx`). |
| 15 | Security and privacy | **Good intent, real gaps** | Strong: consent ledger, OTP hashing, timing-safe compares, encryption, retention, production startup gates. Gaps: §6. |
| 16 | Tests | **Good backend coverage; no frontend tests** | Shared 75/75 pass. Backend 43/44 pass (1 real failure, §4 B2). SQL smoke test passes. No CI workflow in the repo. |
| 17 | Deployment and config | **Partial, image build at risk** | Dockerfile, `render.yaml` (Docker web service, starter plan), Docker Compose with Caddy and nightly `pg_dump`. `.env.example` files exist. The Dockerfile runs the database-backed backend tests during `docker build` (B7). No live environment was verified. |

## 3. What works (keep it)

- **Shared domain package** (`shared/`): one place for enums, quiz definition, rules, lead-state logic and lead-card builder, used by both the API and the UI. Wording and validation can't drift between the two.
- **Consent model:** separate purposes (`save_answers`, `whatsapp_summary`, `contact_call`, `read_document`), an append-only ledger with notice-version hash, withdrawal by page, WhatsApp STOP or advisor, and DB-level CHECKs that block a queued call without consent. The brief's "separate assessment consent from sales-contact consent" is already met.
- **"A call has to be earned":** `deriveLeadState` plus the `agent_queue` view; tested end to end (`journey.test.ts`, "Priya").
- **No-fabrication safeguards:** the extractor returns `null` rather than guessing; low-confidence facts are shown empty; named products and prices are suppressed unless they have source URL, ≤ 90-day freshness and an approval reference (`getApprovedTurtlemintPick`).
- **Evidence-first product ingestion (v1):** allow-listed insurer domains, SHA-256 of the original bytes, page-level evidence, approval CHECK constraint, `approved_product_facts` view.
- **OTP service:** hashed codes, resend/attempt/hourly limits, an atomic attempt claim and mobile binding, all tested against PostgreSQL.
- **Attribution basics:** every link open writes a `source` row (campaign id, creative id, template id, UTM source/medium/campaign, device), and refresh/resume keeps the token, so attribution survives a reload.
- **Production startup gates:** the app refuses to start with dev secrets, console WhatsApp, demo extractor, missing webhook secret, or `ADVISORY_RULES_APPROVED` / `DATA_PROCESSING_APPROVED` not set to true.

## 4. What is broken (verified)

| ID | Problem | How verified | Impact |
|---|---|---|---|
| **B1** | Working tree does not build. `frontend/src/screens/PlanExploration.tsx` (untracked) is imported by `CoverPlan.tsx` and `PlansFit.tsx`. It has 18 TypeScript errors: imports `../../state/flow` (wrong depth), names missing exports (`getApprovedTurtlemintPick`, `clip`, `oneLine` from the package root), typos (`turtelmintPick`), an undefined `setIsExpanded`, CSS-in-JS `'&:hover'`. | `tsc --noEmit` on `frontend/` | `npm run build` and the Docker image fail if these changes are committed. |
| **B2** | `backend/src/services/retentionService.ts` (untracked) has 2 type errors (`Date` vs `string` cursor) and fails its own test (`expected 101 attempts, got 102`). The keyset cursor passes a JS `Date` (millisecond precision) to compare against `timestamptz` (microsecond precision), so the last row of a batch is selected again. | `tsc`; `retentionService.test.ts` against PostgreSQL | Deletes are retried twice and the logs are noisy. Not data loss, but the retention fix the previous audit asked for is not yet correct. |
| **B3** | **Engagement tracking is silently dropped.** The frontend sends 7 event names that the API's Zod enum rejects with 422: `content_toggle`, `tool_used`, `screen_engaged`, `gap_insight_interacted`, `otp_failed`, `plan_exploration_closed`, `recommendations_compared` (about 57 call sites). 3 more pass the API but fail the database `event_name_check` with a 500: `recommendation_engaged`, `policy_analysis_viewed`, `plan_detail_viewed` (about 12 call sites). Calls are fire-and-forget, so nothing surfaces. | Read `useEngagement.ts`, `EVENT_NAMES`, migration 006; confirmed the DB rejection with a direct `INSERT`, and the API rejection by checking `EVENT_NAMES` at runtime. | The whole `ENGAGEMENT_TRACKING_DESIGN.md` layer produces no data. Question-level drop-off and "what engaged them" analytics are not possible today. |
| **B4** | The client also re-sends events the server already logs (`quiz_completed`, `capture_submitted`, `call_requested`, `link_clicked`, `otp_verified`, …). | Code read | Raw event counts double-count. The SQL views use `count(DISTINCT lead_id)`, so they are not affected, but any new count-based metric would be. |
| **B5** | `parents over 60` is defined two different ways. `readout.ts` R6 needs `parents_age_band` = `60_70`/`70p`, which v4 never asks, so R6 never fires. `quiz.ts hasParents60` is true whenever parents are in the family and the band isn't `u60`. So **every** customer who adds a parent is told to buy a *senior citizen plan* for them, even if the parent is 50. | Code read (`readout.ts:20`, `quiz.ts:139`, `planBoard.ts:128`, `insights.ts:43`) | An unsupported recommendation to real users, and the brief's "do not assume" rule is broken. |
| **B7** | The `Dockerfile` build stage runs `npm test -w backend`. Most backend test files open a real PostgreSQL connection (`test/helpers.ts`, default `localhost:5432`) and none skip when it is absent. A plain `docker build` (and Render's Docker build) has no database, so this step is expected to fail. | Read `Dockerfile` and `test/helpers.ts`; **not run** (no Docker in the sandbox) | Deploys from the current Dockerfile likely fail. Run DB tests in CI with a Postgres service and keep only DB-free tests in the image build. |
| **B6** | Text encoding damage (`â€”`, `â€"`) in `frontend/src/state/flow.tsx`, including a customer-facing error string: "Your answers are saved â€" please try again." | grep | Visible garbled text on the error path. |

## 5. Hardcoded rules, assumptions and unsupported claims

None of these has a cited source. Most are already marked "VALIDATION REQUIRED" in code, which is honest, but they still reach customers in development builds.

| Where | What | Problem |
|---|---|---|
| `advice.ts suggestedCoverLakh` | ₹10 L base, +5 spouse/children, +5 metro *or unknown city*, +5 if 41+, +10 if take-home > ₹1 L/month | A simple additive formula of the kind the brief rules out. No cost data behind it. Income raises "need", which the brief says it should not (income informs affordability, not need). |
| `benchmarks.ts BAND_LAKH` | A band of "₹5–10 L" is treated as ₹10 L (top of band) | Overstates current cover, so the gap is understated. A conservative design would use the bottom of the band or ask. |
| `planBoard.ts` | Term need = income × 15/15/12/10 by age; crisis cover = 3 × yearly income; income = band midpoint | Life and critical-illness advice in a health product, with no source. Needs a scope decision and advisory approval. |
| `planBoard.ts` | Recommends a **super top-up** whenever the stated band is below the formula | `docs/ADVICE_EVIDENCE_STANDARD.md` itself says the heuristic must not trigger a top-up on its own. |
| `quiz.ts` helper text | Income: "Sizes your term and crisis cover. **Never shared.**" | Income **is** shared: it appears on the telecaller card and in the exported CSV (`leadCard.ts:57`, "Quiz answers" column). The privacy statement is false. |
| `planCatalog.ts` | "Since 2024 there is no upper age limit to buy health cover" | Refers to a real 2024 IRDAI change but has no citation in `SOURCES`, and insurers can still set their own underwriting limits. Needs a source and careful wording. |
| `planBoard.ts` tips | "Hospital bills are higher in metros, so we sized this for a metro hospital" | No city-level cost data in the system. |
| `advice.ts` | "a room at twice the cap can halve related charges — up to ₹1.5 L of a ₹3 L bill" | Labelled as an example, but the proportionate-deduction rule varies by policy. |
| `handoff.ts` | P1–P4 thresholds, SLA minutes, 9 am–9 pm calling window | Marked VALIDATION REQUIRED. The calling window must match TRAI TCCCPR (amended Feb 2025) and the consent captured. |
| `planCatalog.ts withUtm` | Every outbound link is tagged `utm_campaign=cover_fest`, `utm_source=whatsapp` | Hardcoded campaign. It breaks attribution as soon as there is a second campaign or channel. |
| `shared/util` `PINCODE_PREFIX_DEMO` | Demo pincode-to-city table used as a fallback | Demo data in a production path. |
| `persona.ts` | 9 personas with term/crisis priorities | Reasonable for a draft; needs advisory sign-off. |
| `benchmarks.ts` | 58.06 crore lives covered, 47.4 % group, 10.3 % individual, 13 % medical inflation, ₹28,910 average claim, 58 % cashless | Lives-covered figure matches public coverage of the IRDAI AR 2024-25, though one secondary source quotes 58.20 crore. The figures need checking against the primary PDF table; see `DATA_SOURCE_REGISTER.md`. |

## 6. Security and privacy risks

| ID | Risk | Severity | Note |
|---|---|---|---|
| **S1** | **The zip contains `backend/.env` and `backend/.data/docs/` (15 encrypted uploaded files, 4.9 MB).** The local store derives its AES key from `sha256(LINK_TOKEN_SECRET)`, and that secret is in the same zip, so the files are readable by anyone who has the zip. | Low (owner confirmed 16 Nov 2026: test files, not real policies) | Not an incident. Keep `.env` and `.data/` out of shared zips. |
| S2 | One secret both signs links and encrypts local documents (key reuse) | Medium | Use separate keys. Production already requires a separate `DOCUMENT_ENCRYPTION_KEY` for Supabase. |
| S3 | The link token is a 14-day bearer credential in the URL path. A forwarded WhatsApp message lets the receiver see that person's answers (income, family) and masked mobile. | Medium | Exchange the token for a short-lived, HttpOnly session cookie after first open. Shorten the TTL. Keep OTP before sensitive views. |
| S4 | Agent access is one shared key; agent identity is a header the client sets. No per-caller login, no roles, and audit records whatever the caller types. | High for production | Replace with Turtlemint SSO and roles (caller, team lead, admin, analyst) before more than a handful of callers use it. |
| S5 | Leads leave the system as a CSV (full mobile, income band, family, notes) into Excel/Google Sheets | High | No access control, retention or audit once exported. Replace with an in-app caller dashboard. |
| S6 | DB least-privilege roles (`cover_check_app/agent/bi`) are defined but unused; the app and migrations share one `DATABASE_URL` | Medium | Create login roles and use them. |
| S7 | Webhook secret accepted in a query string (`?secret=`) | Low-Med | Query strings land in access logs. Prefer the header or BSP signature verification. |
| S8 | `DATABASE_SSL=require` without CA verification | Medium | Encrypted, but the server certificate isn't verified. |
| S9 | `backend.log` (95 KB, Windows paths, stack traces) is tracked in git | Low | Untrack and add to `.gitignore`. |
| S10 | Dependency advisories (body-parser, zod, vite/esbuild) reported by the 27 Oct audit | Medium | Not re-run here (no network). Re-run `npm audit` and patch. |
| S11 | No audit log of who viewed which lead card (only document access is logged) | Medium | Needed once medical disclosures are collected. |

Good existing practice worth keeping: OTP codes hashed with a per-challenge salt; timing-safe comparisons; passwords for protected PDFs used once and never stored; production refuses `demo` and `pdf-text` extractors; retention deletes storage objects before DB facts; condition tags are excluded from the agent role.

## 7. Duplicated, dead or stray code

- **Three overlapping advice layers:** `advice.ts buildAdvice` (v3), `insights.ts buildSnapshot` (v2) and `planBoard.ts buildPlanBoard` (v5). All are still called; the WhatsApp summary mixes all three. Income midpoints are defined twice (`INCOME_MID`, `INCOME_MID_MONTHLY`), and "parents over 60" three ways (B5).
- **Dead quiz versions:** `S2–S6` screen ids, `UNSURE_FIELDS`, R1–R8 inputs (`room_rent_limit`, `renewal_window`, `job_exit_cover`, …) and `EXPECTED_SCREEN_TIME_MS` for screens that no longer exist. v4 doesn't collect these fields, so most readout rules can never fire.
- **Stray files in the repo root:** `haredsrcrecommendations.ts` and `pose()` (both captured `git show` output), `temp.txt`, `test.txt`, `test-engagement.ts` (broken import), `validateProducts.js` (calls a function that no longer exists), `testRealExtractor.ts`, `testPdfExtractorDirect.ts`. Several are tracked in git.
- `shared/src/productDatabase.ts.backup` (fabricated insurer products, tracked): **remove**.
- The working tree deletes `cover-check-source.zip` (good: it was tracked) and line endings differ between files (CRLF/LF noise in `git status`).

## 8. Test results (this audit)

| Check | Result |
|---|---|
| Typecheck at HEAD (`61838ba`), uncommitted work stashed | shared ✅ · backend ✅ · frontend ✅ |
| Typecheck of the working tree | shared ✅ · backend ❌ 2 errors (`retentionService.ts`) · frontend ❌ 16+ errors (`PlanExploration.tsx`) |
| Shared unit tests | **75 / 75 pass** |
| Backend tests (real PostgreSQL 16, all migrations applied) | **43 / 44 pass.** Passing: the "Priya" end-to-end journey (10 steps), OTP binding and concurrency, link-to-lead continuity, adapters, extractor, product evidence reader, Supabase store. Failing: retention sweep (B2). |
| SQL smoke test (`data/tests/smoke.sql`) | ✅ passes (rolled back) |
| Frontend production build | Not run: the zipped `node_modules` has Windows-only Rollup/esbuild binaries. The previous audit (27 Oct) reports a passing build at `fbe59aa`. |
| `npm audit` | Not run: no network in the sandbox. |

Environment notes, so these results can be reproduced: the zipped `node_modules` was installed on Windows. To run tests on Linux I linked the `@cover-check/*` workspaces, pointed `tsx` at a Linux esbuild, and preloaded a small `DOMMatrix` stub because `pdfjs` needs `@napi-rs/canvas` (Windows binary only). None of this changes application code. A clean `npm ci` on Linux (as the Dockerfile does) avoids all three.

## 9. Retain, refactor or replace

| Component | Decision | Why |
|---|---|---|
| Layering (shared / backend / frontend / data) | **Retain** | Clean, testable, matches the brief's modular-services principle. |
| Consent ledger, OTP, link signing, encrypted storage, retention | **Retain**, harden (S2–S4, S8) | Already meets most of the brief's privacy requirements. |
| Quiz-as-data (`quiz.ts`) | **Retain and extend** | The right base for an adaptive questionnaire: add a question graph and intents. |
| Lead state, consent-gated queue, lead card | **Retain**, extend into the full lead model | Correct "call has to be earned" logic. |
| Product intelligence ingestion (migration 008) | **Retain and extend** | Matches the brief's source lifecycle. Needs a reviewer workflow and more fact types. |
| `advice.ts` + `insights.ts` + `planBoard.ts` | **Refactor into one rules engine** | Three overlapping layers, unsupported formulas, inconsistent definitions. |
| Engagement tracking (`useEngagement.ts`, `engagement.ts`) | **Refactor** | Keep the idea; rebuild on one event schema (B3/B4). |
| Telecaller CSV export/import | **Replace** with an in-app caller dashboard (keep CSV as a fallback) | Privacy (S5), no assignment or follow-up, no conversion stages. |
| Shared agent API key | **Replace** with SSO + roles | S4. |
| Per-recipient link only | **Extend** with campaign-level links | The brief needs reusable campaign links and a campaign module. |
| `PlanExploration.tsx`, `retentionService.ts` (uncommitted) | **Fix or park before committing** | B1, B2. |
| Stray files, `.backup`, tracked log | **Remove** | Noise and fabricated data risk. |
