# Production Readiness Audit

- **Audit date:** 2026-10-27
- **Reviewed commit:** `fbe59aa`
- **Working branch:** `feat/production-readiness-pilot` (created from `feat/product-intelligence-ingestion-v1`)
- **Overall verdict:** **BLOCKED for real-user policy documents**. The repository contains a viable Render/Supabase implementation path, but cloud resources and approvals are unverified, the backend integration test suite cannot connect to PostgreSQL in this environment, and there are unresolved security, retention, advice-quality, and operational gates.

This is a source/configuration audit, not a live infrastructure or legal/compliance assessment. No `.env` values or credentials were inspected. No external deployment, database migration, or production data operation was performed. The pre-existing `backend.log` modification was preserved.

## Readiness summary

| Component | Status | Evidence and remaining gate |
| --- | --- | --- |
| Repository and source control | **PARTIALLY READY** | The project has `shared`, `backend`, and `frontend` npm workspaces, a lockfile, and a configured GitHub `origin`. The active branch at audit start was `feat/product-intelligence-ingestion-v1`; the existing modified `backend.log` was retained. The production-readiness work is on a dedicated feature branch created from that commit. |
| Render deployment | **PARTIALLY READY** | [`render.yaml`](../render.yaml) defines a Docker web service and `/readyz` health check. Production environment values and approval gates require dashboard configuration. No Render service, domain, deploy, or health check was verified live. |
| Frontend | **PARTIALLY READY** | React/Vite build succeeds. The production bundle defaults to relative `/api/v1` requests, which supports same-origin hosting. The current upload UI accepts multiple files but downstream screens use only the first; several document-screen failures can render blank/no-feedback states; the frontend has no configured test script. Separate frontend/API origins need an explicit build-time API URL and CORS configuration. |
| Backend API | **PARTIALLY READY** | Express routes use Zod validation, Helmet, rate limiting, token middleware, and centralized error mapping. Startup checks production configuration and storage readiness. OTP challenge/mobile binding, atomic attempt claims, and stable token-to-lead resolution are fixed in local code with focused service tests; PostgreSQL concurrency validation remains blocked. Structured logs and live error monitoring are not evidenced. |
| PostgreSQL persistence | **PARTIALLY READY** | A `pg` pool and ordered SQL migrations are implemented in [`backend/src/db/`](../backend/src/db/) and [`data/migrations/`](../data/migrations/). The pool and migration runner use `DATABASE_URL`; the app does not demonstrate a restricted runtime principal distinct from the migration principal. TLS server verification is optional when a CA is not configured. No Supabase database connection or migration execution was tested. |
| Supabase Storage | **PARTIALLY READY** | The server-side adapter encrypts objects before upload, checks that the configured bucket exists and is private, and uses configured server credentials ([`storage.ts`](../backend/src/integrations/storage.ts)). Unit tests mock the service. The bucket, project/region, credentials, live upload/retrieval/deletion, and backup/recovery behavior remain unverified. |
| Authentication and authorization | **NOT READY** | Customer API access uses a signed link token as a bearer credential ([`middleware.ts`](../backend/src/http/middleware.ts)). The token is carried in URLs during link/bootstrap handling; no post-bootstrap scoped session exchange is implemented. OTP binding and stable resolution to the original token-bound lead are fixed in local code; database-backed concurrency validation remains outstanding. |
| WhatsApp/SMS integrations | **PARTIALLY READY** | AiSensy, Gupshup, and Exotel adapters exist. Development can use console behavior; production startup checks reject missing required sender configuration rather than silently treating console output as delivery. Provider credentials/templates, inbound webhook shape, and live delivery were not verified. |
| Policy extraction and advice | **NOT READY for automatic advice** | The configured Render path uses manual extraction. Production guards reject the demo extractor and the current PDF text reader pending OCR/security/accuracy validation. The PDF reader is text-native and not evidence-grade for general policy documents. Advice and policy-board wording still have findings below that need product/advisory review. |
| Migrations, retention, backups | **NOT READY** | Migrations are tracked and serialized with an advisory lock, but no target database was available for execution. The retention worker can repeatedly select the same failed first batch and starve later expired documents. Retention duration remains validation-required. Repository backup automation is shown for Docker Compose local storage only; a Render/Supabase backup and restore test is not evidenced. |
| Tests and CI | **NOT READY** | Shared/backend tests and workspace typechecks are configured. The end-to-end backend suite cannot run here without PostgreSQL. No tracked CI workflow was found in the reviewed repository. Frontend test coverage and representative policy-accuracy tests are absent. Migration 008/product-ingestion integration is not exercised by the SQL smoke test. |
| Privacy, compliance, and pilot operations | **BLOCKED** | Production configuration requires explicit data-processing/advisory approvals, but actual approval state is not verified. Legal/privacy review, a validated retention policy, backup/restore, support/escalation, feedback collection, and an operational pilot pause procedure must be confirmed before inviting real users. This audit does not declare regulatory compliance. |

## Confirmed findings and launch gates

### Security and data integrity

1. **FIXED LOCALLY — OTP challenge/mobile binding.** Verification now claims an attempt only when the stored challenge mobile matches the lead's current mobile, and the final verification transaction rechecks that binding before marking the lead verified. A focused regression test covers a changed number. PostgreSQL-backed race validation remains outstanding. See [`otpService.ts`](../backend/src/services/otpService.ts), [`supportRepositories.ts`](../backend/src/repositories/supportRepositories.ts), and [`leadRepository.ts`](../backend/src/repositories/leadRepository.ts).
2. **FIXED LOCALLY — concurrent OTP attempt cap.** Attempt consumption is now a conditional database update (`attempts < maxAttempts`) that returns the claimed attempt number; it no longer relies on a separate read and increment. The service-level concurrent-request regression test passes, but a PostgreSQL-backed concurrency test remains required. See [`otpService.ts`](../backend/src/services/otpService.ts) and [`supportRepositories.ts`](../backend/src/repositories/supportRepositories.ts).
3. **FIXED LOCALLY — reopening a link preserves token-to-lead continuity.** Link open now takes a transaction-scoped advisory lock keyed by the token hash, resolves an existing token binding before falling back to mobile upsert, and returns the lead attached to the original source. Token lookup selects the earliest source, and new source timestamps use `clock_timestamp()` so the first binding is ordered by actual insertion time rather than transaction start. Focused service tests pass; PostgreSQL-backed concurrent-first-open validation remains outstanding. See [`journeyService.ts`](../backend/src/services/journeyService.ts), [`sourceRepository.ts`](../backend/src/repositories/sourceRepository.ts), and [`leadRepository.ts`](../backend/src/repositories/leadRepository.ts).
4. **Retention deletion failures can starve later expired documents.** The repository selects the oldest 100 expired files. If object deletion fails for all entries in that batch, the sweep returns and selects the same batch on the next run. See [`documentRepository.ts`](../backend/src/repositories/documentRepository.ts#L98-L105) and [`server.ts`](../backend/src/server.ts#L23-L51).
5. **Alternate-number summary delivery needs an explicit policy decision.** Capture sets `mobile_confirmed` after the customer selects/enters a number; summary delivery checks that flag, not OTP-based `mobile_verified` ([`leadRepository.ts`](../backend/src/repositories/leadRepository.ts#L34-L42), [`valueService.ts`](../backend/src/services/valueService.ts#L59-L70)). The current flow invites a different number and the OTP comment reserves OTP for upload/call, so this is recorded as a privacy/ownership-validation decision, not an implementation defect absent product/legal direction.

### Customer experience and advice integrity

- **Multi-file upload mismatch:** the UI accepts multiple files, but reading, confirmation, and the policy board use the first returned document ID. Rejected-file results can also be hidden when another file succeeds. Resolve before advertising multi-document upload; see [`Upload.tsx`](../frontend/src/screens/Upload.tsx) and [`PolicyBoard.tsx`](../frontend/src/screens/PolicyBoard.tsx).
- **Document failure states:** status/fact request failures in the U5/U6 document flow are not consistently rendered with visible error and retry states. See [`Upload.tsx`](../frontend/src/screens/Upload.tsx) and [`PolicyBoard.tsx`](../frontend/src/screens/PolicyBoard.tsx).
- **Quiz recommendation gate:** the current quiz path can select a super top-up using a draft suggested-cover rule, although [`ADVICE_EVIDENCE_STANDARD.md`](ADVICE_EVIDENCE_STANDARD.md) says that heuristic must not independently trigger a top-up/new-policy recommendation. Requires advisory/product approval before customer-facing use; see [`planBoard.ts`](../shared/src/planBoard.ts) and [`recommendations.ts`](../shared/src/recommendations.ts).
- **Co-pay wording overstates evidence:** a zero co-pay value is shown as an unqualified “None”/good result, which does not prove there are no condition-, hospital-, or clause-specific co-pays. Requires policy/advisory wording review; see [`policyBoard.ts`](../shared/src/policyBoard.ts) and [`policyHealth.ts`](../shared/src/policyHealth.ts).
- **Summary confidence path:** the summary endpoint passes stored facts directly to its builder, unlike the status view's confidence masking. It is not used by the current frontend, and automatic extraction is production-blocked; fix before enabling or consuming that endpoint for automatic results. See [`documentService.ts`](../backend/src/services/documentService.ts), [`coverSummary.ts`](../shared/src/coverSummary.ts), and [`routes.ts`](../backend/src/http/routes.ts).
- **Manual pilot limitation:** manual entry is the only configured production extractor. Demo mode remains a non-production default and returns canned facts; production startup rejects it. PDF extraction is not validated to drive advice. Do not describe upload as automatic policy reading until OCR, evidence-span storage, conflicting-value handling, and representative accuracy testing are complete.
- **Product intelligence:** ingestion stores keyword-matched snippets as pending-review evidence; it does not normalize/approve facts or feed recommendations. No reviewer/approval workflow or live product catalogue was verified. This is an appropriate fail-closed limitation, not a launch-ready recommendation source.

### Deployment, database, and operations

- The Render blueprint points to Supabase Storage and leaves secrets/approval values for manual configuration. The documented AWS/S3/local deployment path conflicts with the current production storage gate; the Render/Supabase path is the consistent target.
- `DATABASE_SSL=require` without `DATABASE_SSL_CA` encrypts the PostgreSQL connection but does not verify the server certificate. Resolve certificate verification for the selected Supabase connection mode before launch ([`ssl.ts`](../backend/src/db/ssl.ts), [`render.yaml`](../render.yaml)).
- The app runtime and migration command use the same `DATABASE_URL`; create and verify a least-privilege runtime role and a separate migration principal before production use.
- The Docker Compose nightly database dump writes to a local named volume and needs off-host copies and a restore test. It is not a backup plan for Render/Supabase. Confirm Supabase backup/PITR coverage and document a restore procedure for both database records and Storage objects.
- Retention defaults to 90 days, but the period and full deletion scope remain validation-required. Current purge marks the document deleted and removes related policy facts; it does not hard-delete the document row or implement general deletion for every lead/session/event record.
- No live Render, Supabase, WhatsApp, or Exotel configuration was inspected. The public URL, region, bucket privacy, secrets, backups, alerting, and data-processing approval must be set and verified in their dashboards.

## Baseline validation

| Check | Result |
| --- | --- |
| Runtime | Node `v22.23.3`; npm `12.2.0`. |
| `npm run typecheck` | **PASS** across shared, backend, and frontend. |
| `npm test` | **BLOCKED/FAIL**: shared tests ran, but backend journey-suite setup received `ECONNREFUSED` from PostgreSQL (`backend/test/helpers.ts`); dependent tests were cancelled. No production database was contacted. |
| Frontend production build | **PASS** using `npm run build -w frontend -- --outDir .audit-dist`; 76 modules transformed. Temporary output was removed; the existing `frontend/dist` was not overwritten. No `localhost` or `127.0.0.1` string was found in the bundle. |
| `npm audit --omit=dev` | **FAIL**: two high-severity advisories in runtime dependencies: `body-parser@1.20.8` and `zod@3.25.76`. |
| Full `npm audit` | **FAIL**: four advisories total (three high, one moderate): runtime `body-parser` and Zod; build/dev `vite@5.4.21` and affected esbuild versions. The compatible dry run proposed the `body-parser` patch only; Zod/Vite remediation requires major-version compatibility work. No dependency changes were applied during the audit. |
| Live infrastructure checks | **NOT RUN**: no Render/Supabase credentials or dashboard access were used; no migration, deployment, live upload, provider send, backup, restore, concurrency, or device/browser test was run. |

## Post-remediation validation (2026-10-27)

| Check | Result |
| --- | --- |
| `npm run typecheck` | **PASS** after the OTP and link-continuity changes across shared, backend, and frontend. |
| `node --import tsx --test backend/test/otpService.test.ts backend/test/journeyService.test.ts` | **PASS**: 5 focused service-level regression tests covering OTP mobile binding, concurrent attempt claims, and link-to-lead continuity. They use in-memory repository doubles; they do not validate PostgreSQL locking or SQL behavior. |
| `npm test` | **BLOCKED/FAIL**: the full suite was run after the OTP changes and before link-continuity changes. The shared tests ran, but the database-backed journey suite setup received `ECONNREFUSED` from PostgreSQL; dependent journey tests were cancelled. OTP regressions passed in the full run; both OTP and link-continuity focused regressions passed after all changes. |
| `git diff --check` | **PASS**: no whitespace errors reported. |

## Required gates before a 10–15 user pilot

1. Run PostgreSQL-backed regression tests for OTP mobile binding, the atomic attempt cap, and concurrent first opens of a signed link. The service/repository changes and focused unit tests are local only; database-level concurrency behavior is not yet validated.
2. Resolve retention retry starvation and establish a validated retention/deletion policy.
3. Decide whether a changed WhatsApp number must be OTP-verified before sending personal summaries; record product/legal approval.
4. Obtain advisory approval for the quiz top-up and co-pay wording; retain manual review for uncertain policy facts.
5. Decide whether the pilot is manual-entry only or requires automated extraction. Do not enable demo/PDF-text extraction for real advice without validation.
6. Apply and test runtime dependency security updates; keep the lockfile in sync and rerun tests/build/audit.
7. Configure the actual Supabase database, private Storage bucket, verified TLS, restricted runtime/migration roles, retention settings, and backup/restore. Verify with synthetic records only.
8. Configure real WhatsApp/SMS templates/secrets, CORS/public URLs, Render health checks, logs/alerting, and an upload/pilot pause procedure.
9. Complete privacy/legal review of notice, consent, processing purpose, retention, deletion, user support/escalation, and applicable Indian requirements. Do not represent this code audit as legal or regulatory compliance.
10. Run the complete database-backed test suite, upload/ownership tests, restart/persistence test, frontend/API integration test, and a controlled mobile/concurrency test before inviting users.

## Approval boundary

No production Supabase operation, migration against a production database, or Render deployment has been performed. These remain explicit approval gates. External credentials should be entered only in the relevant secrets manager/dashboard, never in chat or committed files.
