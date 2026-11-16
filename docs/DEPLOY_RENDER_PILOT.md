# Cover Check — Render + Supabase controlled rollout

This deployment path uses Render for the app and Supabase for PostgreSQL/object storage. It is not cleared for real customer documents until Turtlemint IT/Infosec, Advisory, Product and Compliance approvals are recorded and the production gates are explicitly satisfied.

## Recommended pilot architecture

```text
Customer
   |
   v
Cover Check app (Render Web Service)
   |
   +---- PostgreSQL (approved external DB / Supabase for controlled testing)
   |
   +---- private Supabase Storage (application-encrypted objects; server-only credentials)
   |
   +---- CSV export -> caller sheet
   |
   +---- funnel/event data -> leadership reporting
```

The Render Blueprint uses a paid Starter web service so it does not rely on free-instance sleep behaviour. The app uses Supabase for the database and private object storage; choose a Supabase project/region and plan only after IT/Infosec approval. Do not treat Render local disk as document storage.

## What this pilot proves

1. Customer opens the Cover Check experience.
2. Customer goes through the existing Cover Check flow.
3. Customer uploads a policy in the controlled pilot.
4. The manual extractor asks the customer to confirm key policy facts instead of guessing.
5. Cover findings/readout are generated from confirmed facts.
6. Consent is captured before a call handoff.
7. A lead is created in PostgreSQL.
8. Telecaller leads can be exported to CSV.
9. Call outcomes can be imported.
10. Funnel events can be analysed.

## Important data rule

Until Turtlemint IT/Infosec approves the hosting, Supabase region/vendor processing, access controls, encryption-key handling, retention/deletion and incident response, use only:

- dummy policies;
- internal testers;
- synthetic names/mobile numbers; and
- test documents containing no real health or financial information.

Do **not** use the Render local filesystem as a customer policy repository. Render states that free web-service files are lost when the service redeploys, restarts or spins down.

## Render setup

1. Put this repository in a Git provider repository approved for the pilot.
2. In Render, create a Blueprint from `render.yaml` or create a Docker Web Service manually.
3. Set the environment variables marked `sync: false` in Render. Keep `SUPABASE_SERVICE_ROLE_KEY`, `DOCUMENT_ENCRYPTION_KEY`, database credentials and messaging credentials server-side only.
4. Create an existing **private** bucket named `cover-check-docs` in the approved Supabase project. The app checks the bucket is private at startup.
5. Point `DATABASE_URL` to a dedicated, approved Supabase PostgreSQL database and `SUPABASE_URL` to that same approved project. Do not point production at a local-development/test database that may contain `local://` document references; migrate any retained files through an approved process first.
6. Generate `DOCUMENT_ENCRYPTION_KEY` once with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`; store it only in Render/approved secrets management and back it up securely. Losing it makes existing uploaded documents unreadable.
7. Set `DATA_PROCESSING_APPROVED=true` and `ADVISORY_RULES_APPROVED=true` only after the corresponding documented approvals. Until then the production process intentionally refuses to start.
8. Run the app migration command before opening the pilot:

```bash
npm run db:migrate -w backend
```

The root `npm start` command (used by the Docker image) runs migrations before starting the backend. For a controlled manual rollout, you may also run the migration command explicitly before opening the pilot; migrations are tracked and applied once.

9. Verify:

```text
/healthz
/readyz
```

`/healthz` proves the process is alive. `/readyz` proves the database is responding; Render uses `/readyz` so it does not route traffic until the database is ready. Startup also checks that the configured Supabase bucket exists and is private.

## Messaging configuration

`WHATSAPP_PROVIDER=console` is blocked in production. Configure an approved AiSensy or Gupshup sender, templates and credentials in Render. Exotel SMS can be used as the OTP fallback when all required Exotel credentials are present; it does not replace the WhatsApp provider used for summary delivery. Set:

```text
WHATSAPP_PROVIDER=aisensy
```

and add the approved AiSensy campaign/API settings from `deploy/.env.production.example`.

## Why the document extractor is `manual`

The current product deliberately avoids inventing policy facts. In manual mode, the customer confirms key facts from the document and the rest of the Cover Check is generated from those confirmed facts.

This is the correct pilot behaviour until an OCR/AI policy reader has been approved and validated.

## Recommended reporting loop

The existing application should remain the single source of operational truth:

```text
Application events
       |
       v
PostgreSQL
  |       |
  |       +--> leadership funnel
  |
  +----------> telecaller CSV
                   |
                   v
             call outcomes
                   |
                   v
              PostgreSQL
```

Do not maintain a separate manually typed master list. The caller sheet is an output of the database.

## Pilot funnel

Track at minimum:

- landing/session started
- Cover Check started
- upload started
- upload completed
- policy facts confirmed
- Cover Check completed
- finding/checklist viewed
- expert handoff opened
- consent granted
- lead created
- call attempted
- connected
- disposition
- enquiry / next action
- conversion, when available

## Production handover

Before live customer rollout, confirm the Render plan and Supabase project are approved for the intended data and region, that retention/deletion and incident response are tested, and that the domain and messaging provider are Turtlemint-approved. If policy requires a different approved host or object store, replace those adapters before collecting real documents.

The application code and data model are deliberately kept portable so this migration does not require rebuilding the customer experience.
