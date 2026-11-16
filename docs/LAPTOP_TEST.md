# Test inside the organisation — one Windows laptop

Goal: run everything for real on one laptop (real database, real Gupshup messages), let 10–15 colleagues try it over the
office network, save the results, then hand the verified setup to the tech team for AWS (see `DEPLOY.md`, Route B).

Use **Command Prompt (cmd)** for every command below, not PowerShell. Locked-down laptops often block `npm` in PowerShell.

## 1. Install (needs the IT approval email)

* Node.js 22 LTS — then `node -v` shows v22.x
* PostgreSQL 16 — keep port 5432, remember the `postgres` password (letters and digits only). Do not open 5432 in the firewall.

## 2. Code and libraries

```bat
:: unzip to a short path that is not synced (e.g. C:\cover-check), then:
cd C:\cover-check\cover-check
npm install
```

If `npm install` fails: "certificate" / "self-signed" → ask IT for the company root certificate and run
`npm config set cafile C:\path\to\root.pem`. "ETIMEDOUT" / "ENOTFOUND" / 403 → registry or proxy access: ask IT for the proxy
address and run `npm config set proxy http://HOST:PORT` and `npm config set https-proxy http://HOST:PORT`.
Never switch off certificate checking.

## 3. Database

```bat
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE cover_check_dev"
copy backend\.env.example backend\.env
notepad backend\.env
npm run db:migrate
```

In `.env` set the password inside `DATABASE_URL`. `db:migrate` should list `applying migrations/001_init.sql` … `006_…` and the seed.

## 4. Quick look (2 minutes, no database)

```bat
npm run prototype
```

## 5. Build the web app once, so the API serves everything on one port

```bat
set WEB_ONLY=1&& npm run build -w frontend
```

(No space before `&&`.) Repeat after any change to the screens. If the type check stops the build, send the error to whoever is helping you.

## 6. Configure the office test

Run `ipconfig`, note the laptop's IPv4 address (ask IT to reserve it so it does not change). In `backend\.env` un-comment and set:

```
PUBLIC_BASE_URL=http://10.1.2.3:8080      <- your IPv4 address
WEB_DIST=../frontend/dist
EXTRACTOR=manual
```

When the Gupshup templates are approved, also un-comment the `WHATSAPP_PROVIDER=gupshup` block and fill in the key, source number and the two
template **ids**. Until then WhatsApp messages and OTP codes print in the API window (read the OTP out to the tester).

## 7. Start it

```bat
npm run dev:api
```

Expect: `Cover Check on :8080 (development, whatsapp=…, storage=local, reader=manual, serving web app)`. Windows may ask to allow
"Node.js JavaScript Runtime" through the firewall: allow **Private networks** (IT may need to approve). Check
`http://localhost:8080/readyz` shows `{"ok":true}`. Keep the window open, and set the laptop to never sleep while plugged in.

## 8. Give each colleague their own link

```bat
mkdir exports
:: exports\audience.csv, first row:  mobile,name   then one colleague per row, e.g.  9812345214,Asha
npm run links:batch -- exports\audience.csv office-test-1
```

`exports\audience-with-links.csv` has a `link_url` per person. Send each person only their own link on WhatsApp. A link works for that
mobile number only (the OTP goes to it) and expires in 14 days. Colleagues must be on the office Wi-Fi, not mobile data.
**Before inviting anyone, open your own link on your phone over the office Wi-Fi.**

What to ask each colleague to try (cover all three over the group):

| Path | Steps |
| --- | --- |
| A. Cover plan | Answer the one-screen check → see the plan → "Send to my WhatsApp" |
| B. Advisor call | From the plan, ask for a call (OTP, tick the consent, pick a slot) |
| C. Policy upload | Upload a **sample** PDF (not a real policy), type the key details, read the report |

## 9. Watch and collect

```bat
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d cover_check_dev -c "SELECT * FROM cover_check.dropoff_by_version;"
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d cover_check_dev -c "SELECT * FROM cover_check.funnel_daily;"
npm run export:leads -- --all
```

The last command writes `exports\telecaller-sheet-<time>.csv`: only people who ticked consent to be called appear.

**STOP test.** Gupshup cannot reach a laptop, so simulate the reply (use a tester's number):

```bat
curl -X POST http://localhost:8080/api/v1/webhooks/whatsapp -H "Content-Type: application/json" -d "{\"payload\":{\"source\":\"919812345214\",\"payload\":{\"text\":\"STOP\"}}}"
npm run export:leads -- --all
```

That person must no longer appear. The real Gupshup-to-app leg is tested at the AWS pilot.

## 10. Save the data, then clean up

```bat
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -Fc cover_check_dev -f C:\cover-check-test-1.dump
```

Keep the dump and the CSVs only where IT allows (encrypted drive). Then `psql … -c "DROP DATABASE cover_check_dev"` and delete the `exports` folder.
**Do not load this data into the pilot database**: the colleagues' numbers would count as real leads and skew the funnel numbers.

## 11. Hand-off to the tech team

Bring: the zip, `DEPLOY.md` (Route B), the Gupshup template ids, the list of `.env` setting **names** you used (never the secrets), and
what the test showed (drop-off numbers, anything confusing, any failed send).

What this test cannot prove: HTTPS, Gupshup replies reaching the app, S3 and KMS storage, RDS, backups, and load. Those are the pilot's checks.
