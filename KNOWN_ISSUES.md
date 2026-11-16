# Known Issues

Maintained list. Severity: **Critical** (stop real use) · **High** (fix before pilot) · **Medium** (fix in Milestone 1) · **Low**. Status as of 16 Nov 2026. IDs match `EXISTING_SYSTEM_AUDIT.md`.

| ID | Severity | Issue | Where | Status |
|---|---|---|---|---|
| S1 | Low | Zip shared with `backend/.env` and 15 encrypted test uploads in `backend/.data/docs`; the local key is derived from the link secret in the same `.env`. **Owner confirmed 16 Nov 2026: none were real policies, so this is not an incident.** | `backend/.data/docs`, `integrations/storage.ts` | Closed as incident. Keep `.env` and `.data/` out of shared zips (practice). |
| B7 | High | Dockerfile ran DB-backed backend tests during `docker build` | `Dockerfile` | **Fixed 16 Nov 2026** (branch `fix/m1-stabilise`): backend tests moved to CI |
| B1 | High | Working tree didn't build: untracked `PlanExploration.tsx` (18 type errors) | `frontend/src/screens/` | **Fixed 16 Nov 2026**: screen parked in `archive/parked/`, `CoverPlan.tsx`/`PlansFit.tsx` restored to last commit |
| B3 | High | 10 client event names silently dropped (7 rejected by the API, 3 by the DB) | `useEngagement.ts`, `enums.ts`, migrations | **Fixed 16 Nov 2026** (1.2): one contract in `enums.ts`, migration 009, rejects logged in `event_reject`, drift test |
| B5 | High | Every parent is treated as 60+; the senior-plan recommendation is shown for any parent; readout R6 can never fire | `quiz.ts hasParents60`, `readout.ts`, `insights.ts` | **Fixed 16 Nov 2026** (1.4): parents' age asked; one `hasParents60` rule used everywhere; R6 can fire; v4 sessions with no parent age are no longer assumed 60+ |
| A1 | High | Income helper text says "Never shared", but income is on the caller card and in the CSV export | `quiz.ts`, `leadCard.ts` | **Fixed 16 Nov 2026** (1.4): income removed from the quiz, card and export. Open: purge of income already stored in v3/v4 rows (retention decision) |
| A2 | High | Sum-insured formula unsourced (owner's hypothesis), raises "need" with income, unknown city counted as metro; super top-up auto-recommended from it | `advice.ts`, `planBoard.ts` | Replacement method written and tested (`SUM_INSURED_METHOD.md`, `coverScenarios.ts`); not wired to UI; needs owner approval |
| A4 | High | Term-life and critical-illness amounts (income × 10–15; 3 × income) shown in a health product | `planBoard.ts`, `persona.ts`, `whatsappSummary.ts`, `leadCard.ts` | **Fixed 16 Nov 2026** (1.4): blocks, amounts and picks removed; optional interest question shown to the caller only |
| A3 | Medium | Band "₹5–10 L" treated as ₹10 L (top of band), understating the gap | `benchmarks.ts BAND_LAKH` | Open |
| S4 | High | One shared agent API key; agent identity is a client-set header | `http/middleware.ts` | Open |
| S5 | High | Lead CSV with full mobile, income, notes exported into spreadsheets | `telecallerSheetService.ts` | Open (income no longer included since 1.4; full mobile and notes still are) |
| S3 | Medium | 14-day bearer link token in URL is the only customer credential | `linkTokenService.ts`, `http.ts` | **Fixed 16 Nov 2026** (1.7): link exchanged for an HttpOnly cookie session (migration 012), token removed from the URL, link lifetime 14 → 7 days |
| S2 | Medium | Link-signing secret reused as local document encryption key | `wiring.ts`, `storage.ts` | **Fixed 16 Nov 2026** (1.7): local store uses its own key (old local dev files won't open) |
| S6 | Medium | DB least-privilege roles defined but unused | migration 002, `db/pool.ts` | **Fixed in code 16 Nov 2026** (1.7): production refuses a superuser / schema-owner login; `MIGRATION_DATABASE_URL`; `deploy/db-roles.sql`. Ops must create the logins |
| S8 | Medium | `DATABASE_SSL=require` without CA verification | `db/ssl.ts` | **Fixed in code 16 Nov 2026** (1.7): production requires `DATABASE_SSL_CA`. Ops must supply the provider's CA |
| S10 | Medium | body-parser / zod / vite advisories (from 27 Oct audit) | `package-lock.json` | Open: re-run audit |
| S11 | Medium | No audit log of lead-card views | `handoffService.card` | Open |
| B2 | Medium | Retention cursor lost microsecond precision (test 101 vs 102; 2 type errors) | `retentionService.ts`, `documentRepository.ts` | **Fixed 16 Nov 2026**: cursor carried as Postgres text; test passes |
| B4 | Medium | Client duplicated server milestone events; `screen_viewed` sent up to 3× per screen | `useEngagement.ts`, `flow.tsx` | **Fixed 16 Nov 2026** (1.2): browser can't send milestones; one `screen_viewed` + one `screen_exited` per screen |
| D-1 | Medium | Hard-coded `utm_campaign=cover_fest` on every outbound link | `planCatalog.ts withUtm` | **Fixed 16 Nov 2026** (1.3): neutral tags + `attributeUrl` stamps the visitor's campaign |
| D-2 | Medium | Funnel views cut by door, not campaign; no generic campaign links | migration 002 | **Partly fixed** (1.3): `campaign_funnel_daily` by campaign × variant; generic links without a phone number are 1.3b |
| D-3 | Medium | Upload accepts several files but later screens use only the first (from 27 Oct audit) | `Upload.tsx`, `PolicyBoard.tsx` | Open |
| D-4 | Medium | `documents/:id/summary` skips the low-confidence masking applied to the status view (from 27 Oct audit) | `documentService.summary` | Open |
| D-5 | Medium | Three overlapping advice layers; income midpoints and "parents 60+" defined more than once | `advice.ts`, `insights.ts`, `planBoard.ts` | Partly fixed (1.4): income midpoints gone; "parents 60+" is one function. Three advice layers remain |
| D-6 | Medium | No CI workflow | repo | **Fixed 16 Nov 2026**: `.github/workflows/ci.yml` (not yet run on GitHub) |
| D-7 | Low | Fabricated named-insurer products tracked in git | `shared/src/productDatabase.ts.backup` | **Fixed 16 Nov 2026**: moved to `archive/parked/…DO-NOT-USE.txt` |
| S7 | Low | Webhook secret accepted as a query parameter | `routes.ts` | **Fixed 16 Nov 2026** (1.7): header only. **Tell the BSP to send `x-webhook-secret`** before deploying |
| S9 | Low | `backend.log` tracked in git | repo root | **Fixed 16 Nov 2026**: untracked, `*.log` ignored |
| B6 | Low | Garbled characters in `flow.tsx` | `state/flow.tsx` | **Fixed 16 Nov 2026** |
| D-8 | Low | Stray files in repo root | repo root | **Fixed 16 Nov 2026**: moved to `archive/stray-root-files/` |
| D-9 | Low | Demo pincode-prefix table used as a production fallback | `shared/util.ts` | Open |
| D-10 | Low | `benchmarks.ts`: `irdai_mc_2024` URL is a department page; lives-covered figure needs primary-table check | `benchmarks.ts` | Open |

## Resolved since the 27 Oct 2026 audit (verified here)

- OTP mobile binding and atomic attempt cap: fixed and now **passing PostgreSQL-backed tests**.
- Link-to-lead continuity and concurrent first opens: **passing PostgreSQL-backed tests**.
- Co-pay "0%" no longer shown as an unqualified "None/good"; now "Listed as 0%" with a review status (`policyHealth.ts`).
- Retention starvation: redesigned with a keyset cursor (uncommitted); still has B2.
