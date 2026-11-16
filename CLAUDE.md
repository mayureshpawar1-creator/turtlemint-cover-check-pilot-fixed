# CLAUDE.md — Turtlemint Cover Check Project Guidelines

This file establishes a disciplined AI product-development workflow for the Turtlemint Cover Check project. Follow these standards for all contributions.

## 1. Project Overview
Cover Check is a WhatsApp-driven funnel for health insurance assessment, consisting of:
- **Frontend**: React 19 + TypeScript (Vite) – screens, illustrations, components (`frontend/src/`)
- **Backend**: Node 20+ + Express + TypeScript – APIs, services, integrations (`backend/src/`)
- **Shared**: TypeScript – domain models, enums, utilities, business logic (`shared/src/`)
- **Data**: PostgreSQL – schema in `data/migrations/`, seeds, tests
- **Design System**: Documented in `docs/DESIGN_SYSTEM.md`
- **Flows**: 
  - Quiz flow (S0–S10) in `docs/FLOW_V4.md` (current) and `docs/FLOW_V3.md`
  - Policy upload flow (U1–U8) unchanged
- **Deployment**: Dockerized (web + API), requires Postgres, private storage (S3/local), WhatsApp (AiSensy/Gupshup)

## 2. Development Workflow Principles
Adopt these principles for all work:

### 2.1 Evidence-Based Decisions
- Ground all product rules, coverage calculations, consent wording, retention periods, and compliance-sensitive decisions in actual project files.
- Never present unverified assumptions as approved rules. Verify by inspecting:
  - Design tokens → `frontend/src/styles/tokens.css`
  - Flow logic → `frontend/src/state/flow.tsx`, `shared/src/planBoard.ts`
  - API contracts → `backend/src/http/` (Zod schemas)
  - Database guarantees → `docs/README.md` (Guarantees table)
  - Consent templates → `shared/src/whatsappSummary.ts` and `docs/DEPLOY.md`
  - Retention period → `docs/DEPLOY.md` (marked VALIDATION REQUIRED)
  - Coverage rules → `shared/src/planBoard.ts` and `shared/src/planCatalog.ts`

### 2.2 Approval Gates
Seek approval before:
- Major architecture changes (altering layer boundaries, introducing new frameworks)
- Destructive operations (data migrations, deleting tables, breaking API changes)
- Use of paid external services (beyond free tiers in prototypes)
- Production deployment or processing real customer data
- Changes affecting compliance (consent wording, data handling, retention)

### 2.3 Data & Secrets Handling
- Default to synthetic test data for all development and testing.
- Never expose secrets, real customer policy documents, OTPs, or personal data in prompts, logs, screenshots, or commits.
- Use `.env.example` files for configuration; never commit real secrets.
- For WhatsApp testing, use synthetic numbers and mock OTPs unless explicitly approved for real-device testing.

### 2.4 Transparency & Reporting
After any code or file changes, report:
- What files were inspected
- What was changed
- Which checks were actually run (tests, typecheck, lint) and their results
- Any remaining risks or validation requirements
- Never claim a test passed unless it was run successfully in the current environment

### 2.5 Practical Conventions
- Follow existing code patterns: match comment density, naming, and idiom.
- Keep TypeScript strict; avoid `any` without justification.
- Use Zod for runtime validation at API boundaries.
- Handle errors via Express error-mapping (`backend/src/http/middleware.js` and `backend/src/services/errors.js`).
- Update `docs/` if behavior changes; keep `README.md` current for setup/deployment.
- Do not assume production infrastructure is available; default to local prototype or Docker Compose for validation.

## 3. Technical Guidelines

### 3.1 Scripts & Commands (verify before use)
- **Prototype (no DB)**: `npm run prototype` → opens `/prototype.html`
- **Full app dev**: 
  - `npm run db:migrate` (Postgres required)
  - `npm run dev:api` (backend on :8080)
  - `npm run dev:web` (frontend on :5173)
  - `npm run link` (generates signed test link)
- **Testing**: `npm test` (runs shared and backend tests)
- **Typecheck**: `npm run typecheck`
- **Leads export/import**: `npm run export:leads` and `npm run import:outcomes`
- **WhatsApp campaign batch**: `npm run links:batch -- <audience.csv> <campaign-tag>`

### 3.2 Git Conventions
- Branch naming: `feat/<short-description>`, `fix/`, `refactor/`, `docs/`
- Commit messages: Conventional style (e.g., `feat: add OTP retry logic`)
- **Follow the repository’s actual Git conventions**; do not add hard-coded model attributions.
- Pull request descriptions should include validation steps and link to relevant issues/tickets.

### 3.3 Environment & Secrets
- Never commit `.env` files; use `.env.example` as template.
- For local dev: copy examples and set only non-sensitive values.
- Secrets must be set via env secrets manager or `.env.production` (gitignored) and never exposed in logs/prompts.

## 4. Phase-Specific Guidance

### 4.1 Database-Free Prototype
- Use `npm run prototype` for UI/flow validation.
- Do not attempt backend API calls; mock services if needed.
- Validate against design system and flow documents.

### 4.2 Pilot Development (Pre-Production)
- Use Docker Compose for production-like local testing:
  - `cp deploy/.env.example deploy/.env` + set non-secret values
  - `cp deploy/.env.production.example deploy/.env.production` + fill all values (secrets only)
  - `docker compose -f deploy/docker-compose.yml up -d --build`
- Validate against go-live checklist (`docs/DEPLOY.md` §9):
  - `/readyz` returns `{ ok: true }`
  - Test OTP/summary delivery to personal phone (synthetic data only unless approved)
  - Link tampering shows safe error screen
  - Verify that uploaded documents are encrypted using the configured storage driver, and test retrieval and failure handling.
  - Telecaller sheet exports only consented, callable leads
  - Withdrawal removes lead from next sheet
  - Backups run (configured nightly pg_dump) but restoration status unknown
- Engage compliance/legal for consent text and data handling before processing any real customer data.

### 4.3 Production Readiness
- **Secrets**: Use secrets manager; never commit.
- **Dependencies**: Commit `package-lock.json` after changes; audit with `npm audit`.
- **Build**: Docker build runs shared tests; tag images with Git SHA.
- **Monitoring**: Health checks (`/healthz`, `/readyz`); logs to stdout.
- **Rollback**: Tag previous image; redeploy with `docker compose`.