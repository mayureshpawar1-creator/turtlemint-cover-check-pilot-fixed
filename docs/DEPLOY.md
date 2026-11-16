# Deploying Cover Check — real-customer pilot

One container serves both the web app and the API on one domain (for example `covercheck.turtlemint.com`).
It needs three things around it: a **Postgres database**, **private file storage** for uploaded policies,
and **AiSensy** for WhatsApp (the summary message and the OTP).

```
WhatsApp template ──button──▶ https://covercheck.turtlemint.com/?t=<signed link>
                                   │
                         ┌─────────┴──────────┐
                         │  Cover Check app   │  Docker image (this repo's Dockerfile)
                         │  web app + /api/v1 │  /healthz · /readyz
                         └──┬──────┬───────┬──┘
                   Postgres │      │ S3     │ AiSensy API
              (leads, consent)  (policy files,  (summary + OTP
                                 KMS-encrypted)   on WhatsApp)
                         │
                 npm run export:leads ──▶ telecaller sheet (Excel / Google Sheets)
```

## 1. Where to run it

Customers upload health-insurance policies here, and those carry personal and health details. So run it inside
**Turtlemint's own cloud account, in an India region (AWS Mumbai, `ap-south-1`)**, and get infosec's approval first.
Generic hosting platforms (Render, Railway, Vercel and similar) are fine for the demo prototype, but not for
real policy documents.

| | Route A — one server (fastest pilot) | Route B — managed (tech team's standard) |
| --- | --- | --- |
| Good for | First pilot, up to a few thousand people | Scale-up after the pilot |
| Runs on | 1 VM (EC2, 2 vCPU / 4 GB) with Docker | ECS Fargate (or Turtlemint's existing container platform) |
| Database | Postgres container + nightly backup | RDS Postgres 16, Multi-AZ, automated backups |
| Files | S3 bucket (recommended) or encrypted volume | S3 + KMS |
| HTTPS | Caddy (automatic certificate) | Load balancer + ACM certificate |
| Setup time | About half a day | 2–4 days with DevOps |

## 2. Before you deploy (owners)

| # | What | Who |
| --- | --- | --- |
| 1 | Subdomain, e.g. `covercheck.turtlemint.com`, pointed at the server or load balancer | Tech / DevOps |
| 2 | **AiSensy template: entry CTA** (utility). Button = dynamic URL `https://covercheck.turtlemint.com/?t={{1}}` | Marketing / you |
| 3 | **AiSensy template: summary** (utility). Body below, 5 variables; then an API campaign `cover_check_summary_v1`, status Live | You |
| 4 | **AiSensy template: OTP** (authentication, "Copy code" button); then an API campaign `cover_check_otp_v1`, status Live | You |
| 5 | Consent notice text and document retention period (90 days now, marked VALIDATION REQUIRED) | Compliance / legal |
| 5b | Cover rules (health, term 15×/12×/10× income, crisis 3 years of income) in `shared/src/planBoard.ts`, and Turtlemint picks + starting prices in `shared/src/planCatalog.ts` (`TURTLEMINT_PICKS`) | Advisory + product team |
| 6 | Infosec approval: India region, encrypted storage, who can open uploaded files | Infosec |
| 7 | Telecaller process: who exports the sheet, how often, SLA for P1 leads | Sales ops |
| 8 | AiSensy API key, stored in the secrets manager (never in Git) | You + DevOps |
| 9 | **Inbound webhook.** Give your BSP `https://<domain>/api/v1/webhooks/whatsapp?secret=<WEBHOOK_SECRET>` as the incoming-message callback, then reply STOP from a test phone and confirm the lead drops off the next sheet. The payload parser reads the Gupshup shape (`payload.source`, `payload.payload.text`); if you use AiSensy, send one test message and check the log before relying on it. | You + DevOps |
| 10 | **Decide the "Reply ADVISOR" line.** The summary template tells people to reply ADVISOR, but no code handles that reply yet. Either remove the line from the template or build the handler (compliance must agree that the reply counts as a request to be called). | You + Compliance |

> **Which BSP?** The code sends through AiSensy by default and also supports Gupshup (`WHATSAPP_PROVIDER=gupshup`, needs
> `GUPSHUP_API_KEY`, `GUPSHUP_SOURCE_NUMBER`, `GUPSHUP_OTP_TEMPLATE_ID`). Whichever you pick, send one real OTP and one real
> summary to your own phone before inviting anyone: the OTP "Copy code" button format is the one field not fully documented publicly.

Summary template body (must match the code exactly — `shared/src/whatsappSummary.ts`):

```
Hi {{1}}, here is your Cover Check summary.

*{{2}}*

*What’s working for you*
{{3}}

*Worth checking*
{{4}}

*Options to explore*
{{5}}

Reply ADVISOR to talk to an expert, or STOP to opt out.
```

> AiSensy's API takes `apiKey, campaignName, destination, userName, templateParams`. Before go-live, open each
> campaign in AiSensy, copy the sample cURL it shows, and check that the OTP **button** format matches
> `otpButtons()` in `backend/src/integrations/whatsapp.ts`. That one field is not fully documented publicly.

## 3. Route A — one server, step by step

```bash
# on the server (Ubuntu, Docker installed)
git clone <your repo> cover-check && cd cover-check
cp deploy/.env.example deploy/.env                          # DOMAIN + DB_PASSWORD
cp deploy/.env.production.example deploy/.env.production    # fill every empty value
mkdir -p deploy/exports && sudo chown 1000:1000 deploy/exports
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs -f app     # look for "Cover Check on :8080 (production, whatsapp=aisensy …)"
```

If any setting is still a laptop value, the app **refuses to start** and lists what to fix: a missing secret, WhatsApp
set to `console`, the demo policy reader, local files without opting in, or a domain without https.

* For S3 on a VM: attach an IAM role to the instance that has `s3:PutObject/GetObject/DeleteObject` on the bucket
  and `kms:Encrypt/Decrypt/GenerateDataKey` on the key. Block all public access on the bucket.
* To skip S3 on a single-server pilot, set `STORAGE_DRIVER=local` and `ALLOW_LOCAL_STORAGE=true`. Files are then
  AES-256 encrypted on a Docker volume. You must also back up that volume.
* Updates: `git pull && docker compose -f deploy/docker-compose.yml up -d --build` (migrations run on start).

## 4. Route B — for the DevOps team

1. Build and push the image: `docker build -t <ecr>/cover-check:<git-sha> .` (the build runs the shared tests).
2. RDS Postgres 16 in `ap-south-1`, private subnets. Set `DATABASE_SSL=require` and `DATABASE_SSL_CA=<RDS CA bundle path>`.
3. S3 bucket + customer-managed KMS key. The task role gets only that bucket and that key.
4. Secrets Manager → task env: `LINK_TOKEN_SECRET`, `AGENT_API_KEY`, `WEBHOOK_SECRET`, `AISENSY_API_KEY` (or the Gupshup key), `DATABASE_URL`.
5. Service: port 8080, health check `/readyz`, 2 tasks minimum. Migrations take a database lock, so tasks can start together.
6. ALB + ACM certificate on the subdomain; WAF rate limiting optional (the API already limits 120 requests/min per IP).
7. Logs to CloudWatch, with an alarm on 5xx and on `/readyz` failing.

## 5. Sending the WhatsApp campaign

Every person gets their own signed link. It only works for their number and expires after 14 days.

```bash
# put audience.csv in deploy/exports on the server. Columns: mobile,name[,door]  (door = get | check | company | review, default check)
docker compose -f deploy/docker-compose.yml exec app npm run links:batch -- /app/exports/audience.csv oct-pilot-1
# → /app/exports/audience-with-links.csv  (columns link_token and link_url added; on the server: deploy/exports/)
```

Upload `audience-with-links.csv` to the AiSensy campaign and map `link_token` to the button's `{{1}}`.
Test with your own number first.

## 6. Daily operations

| Task | Command (inside the app container) |
| --- | --- |
| New callable leads → telecaller sheet | `npm run export:leads` → `deploy/exports/telecaller-sheet-<time>.csv` |
| Read call outcomes back | `npm run import:outcomes -- /app/exports/<sheet>.csv` |
| Is it healthy? | `curl https://<domain>/readyz` |
| Funnel drop-off by version | SQL: `SELECT * FROM cover_check.dropoff_by_version;` |
| Backups | Route A: `backup` container, 14 nightly dumps in a volume — copy off the server weekly. Route B: RDS snapshots |

## 7. Pilot rollout

1. **Internal (day 1–2):** 20–50 Turtlemint numbers. Run all three quiz paths, an upload, a call request and a WhatsApp summary.
   Check the telecaller sheet.
2. **Soft launch (week 1):** 500 customers from one segment. Watch `/readyz`, AiSensy delivery and drop-off per screen.
   Call P1 leads the same day.
3. **Scale:** 5,000+ once delivery and call SLAs hold.

## 8. What this pilot does not do yet

* **Automatic policy reading.** `EXTRACTOR=manual`: the file is stored safely for the advisor, and the customer types
  10 key details from page 1 (U5 understands "5 lakh", "20/11/2025", "3 years", "20%"). The report is then built from
  what they typed. A real reader (OCR, or an AI model under an approved data agreement) plugs into
  `backend/src/integrations/extractor.ts`. It must return empty, never a guess.
* **Telecaller screen.** The hand-off is the sheet. The `/api/v1/agent/...` endpoints are ready for a CRM later.

## 9. Go-live checklist

- [ ] Domain on https, `/readyz` returns `{ ok: true }`
- [ ] App log shows `production, whatsapp=aisensy, storage=s3, reader=manual`
- [ ] Summary and OTP campaigns are Live in AiSensy; a test summary and a test OTP reach your phone
- [ ] A link from `links:batch` opens the quiz; a tampered link shows the safe error screen
- [ ] An upload lands in S3, encrypted with the KMS key; the bucket is not public
- [ ] Telecaller sheet exports only consented, callable leads; outcomes import back
- [ ] Withdrawal ("stop") removes a lead from the next sheet, and a webhook call without the secret is refused (403)
- [ ] `DATABASE_SSL_CA` is set when the database is RDS (without it the connection is encrypted but the server is not verified)
- [ ] `package-lock.json` is committed (generate it once with `npm install`) so every build installs the same versions
- [ ] Backups run, and one restore has been tested
- [ ] Compliance has signed off the consent text and retention period
- [ ] No competitor names in any template or page
