# Campaign Funnel Baseline and How to Run a Campaign

- **Written:** 16 Nov 2026, alongside roadmap step 1.3 (campaigns and attribution v1).
- **Internal:** §1 holds aggregate figures from Turtlemint's quote and order data. No individual records were extracted; every group shown has at least 30 quote requests.

## 1. Baseline: health quotes → orders → issued policies (2025–2026)

**Source:** Superset, Athena `spectrum.healthpremiumrequest` (quote requests, one row per change, de-duplicated to one per request `_id`) joined to `spectrum.healthorder_v2` on `requestid = _id` (all 2025 orders matched). "Partner" = quote made under a POSP login (`pospusername` filled); "Direct" = no POSP. Issued = order with a policy number. Queries run 16 Nov 2026 (SQL Lab tab "Claude campaign analysis").

| Channel | Quote requests | Orders | Paid | Policy issued | Quote → issued |
|---|---|---|---|---|---|
| Partner (POSP) | 739,409 | 75,899 | 14,163 | 12,788 | **1.73 %** |
| Direct | 70,952 | 3,905 | 137 | 131 | **0.18 %** |

**By UTM source, 2026 only** (the year UTM tracking started)

| utm_source / medium | Channel | Quotes | Orders | Issued |
|---|---|---|---|---|
| (none) | Partner | 272,485 | 30,500 | 5,842 |
| (direct) | Partner | 42,845 | 3,353 | 365 |
| (none) | Direct | 27,330 | 1,186 | 53 |
| app.turtlemintpro.com / referral | Partner | 13,145 | 1,964 | 403 |
| (direct) | Direct | 1,809 | 57 | 8 |
| turtlemintinsurance.com / referral | Direct | 1,768 | 79 | 2 |
| healthmarketing / whatsapp | Partner | 886 | 43 | 1 |
| turtlemintinsurance.com / referral | Partner | 262 | 16 | 0 |
| healthmarketing / pn | Partner | 216 | 9 | 0 |

**What this says**

1. **Direct customers almost never finish buying on their own.** 0.18 % of direct quote requests become a policy, against 1.73 % with a partner. Of direct customers who reach an order, only 3.5 % pay (partner: 18.7 %). The biggest leak is between order and payment, where a person usually helps. This is the gap Cover Check's "understand first, then a human" model is meant to close.
2. **Campaign history barely exists.** UTM source was recorded for 708 requests in 2024, 243 in 2025 and ~82,000 in 2026. **`utm_campaign` has never been filled**, so no past campaign can be measured. Attribution has to start now, with step 1.3.
3. **Existing WhatsApp health marketing converts very little:** `healthmarketing / whatsapp` produced 886 quotes, 43 orders and 1 issued policy in 2026. It is a small baseline to beat.
4. **People accept the default cover amount.** Median cover requested is ₹10 L in both channels, and most requests sit in the ₹10–15 L band. The quote form's default largely decides cover, so the Cover Check scenarios (`SUM_INSURED_METHOD.md`) can shape choices.
5. **`eldestmemberage` looks unpopulated.** Every request falls in the youngest band; read ages from `healthpricingrequest_insuredmembers` instead (data request).

## 2. What step 1.3 adds (code)

- **Campaign registry** (`campaign`, `campaign_variant`; migration 010): id, name, objective, audience, channel, template, owner, status, dates; per-variant landing headline and sub-line.
- **Links carry campaign + variant.** `POST /api/v1/ops/links` and `npm run links:batch` refuse a campaign or variant that isn't registered. Old links with an unknown campaign still open.
- **Every link open records** campaign, variant, UTM source / medium / campaign / content / term and referrer.
- **Landing copy per variant**, in the language it was written in; otherwise the door's default copy.
- **Outbound links carry the visitor's campaign.** Plan pages on turtlemintinsurance.com get `utm_campaign` = the campaign, `utm_medium` = its channel, `utm_term` = the variant. Quotes made there land in `healthpremiumrequest` with the campaign filled in, so `healthorder_v2` can show which campaign produced each issued policy. The hard-coded `cover_fest` tag is gone.
- **Funnel per campaign × variant × day** (`campaign_funnel_daily` view; `GET /api/v1/ops/campaigns/:id/funnel`), first-touch: link opened → landed → started → completed → contact submitted → call consent → queued → call attempted → connected → enquiry created. Quote, payment and issuance are **not tracked** in this app (not shown as 0); they come from the order data in §1.

**Not in v1 (planned as 1.3b):** reusable links without a phone number (`/h/<campaign>` for ads, QR codes, SMS). Today a lead needs a mobile number from the start; anonymous visitors need a small change to how leads are created, done separately so the consent and OTP rules stay intact.

## 3. How to run a campaign now

1. **Register it** (agent key required):
   ```
   POST /api/v1/ops/campaigns
   { "campaignId": "parents-cover-dec26", "name": "Parents cover, Dec 2026", "channel": "whatsapp", "status": "live",
     "objective": "Parents 60+ without own cover", "owner": "<your name>",
     "variants": [ { "variantId": "a", "landingHeadline": "Is your parents’ health cover enough?" },
                   { "variantId": "b", "landingHeadline": "Check your parents’ cover in 20 seconds" } ] }
   ```
2. **Make the links:** `npm run links:batch -- audience.csv parents-cover-dec26`. Put a `variant` column (a / b) in the CSV to split the audience for an A/B test.
3. **Send** through the approved WhatsApp template, with the link token in the button.
4. **Watch the funnel:** `GET /api/v1/ops/campaigns/parents-cover-dec26/funnel`, or `campaign_funnel_daily` in BI.
5. **Read buying results** in Superset: `healthpremiumrequest.healthpricingrequest_utmvalues_utmcampaign = 'parents-cover-dec26'`, joined to `healthorder_v2` (§1 query pattern).
