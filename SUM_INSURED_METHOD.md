# Cover Amount Method — v1 "Turtlemint claims"

- **Status:** candidate method, implemented and tested in `shared/src/coverScenarios.ts`, **not shown to customers**. Replaces the unsourced `suggestedCoverLakh` formula (₹10 L base + ₹5 L steps + ₹10 L for high income).
- **Updated:** 16 Nov 2026. v0 (government-rate floors) is kept inside v1 as the minimum.
- **Internal:** §2 contains aggregate figures from Turtlemint's own claims. No individual records were extracted; every figure covers at least 30 claims.

## 1. Short answer

The amounts now come from **about 22,000 real hospital bills of Turtlemint customers**:

| Scenario | Metro (and unknown city) | Other cities | What it pays for |
|---|---|---|---|
| **Essential** | **₹5.5 L** | **₹3.5 L** | A bill bigger than 95 in 100 of our customers' bills in that city tier |
| **Balanced** | **₹12.5 L** | **₹9.5 L** | A bill bigger than 99 in 100 of those bills |
| **Higher** | **₹16 L** | **₹12 L** | That very large bill, plus a second big one (90th percentile) in the same year |

Each amount is grown for 3 years at the 10.4 % a year that our own top-5 % bills rose from 2023 to 2025. Published trend estimates of 9.9–13 % give almost the same range.

**How sure:** much more than v0. These are real bills, by city tier, from our own customers. Remaining limits are in §5.

## 2. Evidence: Turtlemint health claims (aggregates)

**Source:** Superset, Athena `spectrum.claims_health_claims` joined to `spectrum.claims_general_claim_details`. Latest version of each claim (the tables keep a change log), health vertical, billed amount ₹1,000–₹2 Cr (248 records outside that range excluded), claims intimated 2022–2026.

**Billed amount per claim (hospital bill before insurer deductions)**

| Group | Claims | Median | 90th pct | 95th pct | 99th pct | Bills over ₹5 L |
|---|---|---|---|---|---|---|
| All | 22,030 | ₹42.7k | ₹1.45 L | ₹2.52 L | ₹5.94 L | 1.3 % |
| Cashless | 2,824 | ₹53.8k | ₹2.28 L | ₹3.56 L | ₹8.31 L | 2.7 % |
| Reimbursement | 13,204 | ₹40.1k | ₹1.39 L | ₹2.41 L | ₹6.06 L | 1.3 % |
| **Metro hospitals** (8 metros + NCR, Thane) | 1,238 | ₹53.5k | ₹2.77 L | ₹4.07 L | ₹9.05 L | 3.3 % |
| **Other cities** | 2,946 | ₹48.3k | ₹1.65 L | ₹2.57 L | ₹6.93 L | 1.7 % |
| Mumbai / Thane | 312 | ₹63.8k | ₹4.13 L | ₹6.95 L | ₹12.8 L | 7.1 % |
| Delhi NCR | 376 | ₹63.4k | ₹2.63 L | ₹3.82 L | ₹9.0 L | 2.4 % |
| Pune | 321 | ₹50.0k | ₹1.48 L | ₹3.0 L | ₹5.0 L | 0.6 % |
| Ahmedabad | 124 | ₹49.8k | ₹1.86 L | ₹2.60 L | ₹5.06 L | 1.6 % |

**By length of stay**

| Stay | Claims | Median | 95th pct | 99th pct | Over ₹5 L |
|---|---|---|---|---|---|
| Same day | 2,153 | ₹34.4k | ₹1.43 L | ₹4.29 L | 0.5 % |
| 1–2 days | 5,261 | ₹34.9k | ₹2.03 L | ₹4.30 L | 0.6 % |
| 3–5 days | 6,175 | ₹42.8k | ₹2.41 L | ₹5.64 L | 1.1 % |
| 6–10 days | 1,399 | ₹71.0k | ₹4.27 L | ₹8.93 L | 4.0 % |
| 11–60 days | 437 | ₹57.5k | ₹8.43 L | ₹28.5 L | 11.4 % |

**Trend (95th percentile by year claim was reported):** 2023 ₹2.12 L → 2024 ₹2.48 L → 2025 ₹2.58 L (→ 10.4 % a year). 2026 so far ₹3.11 L (part year).

**What stands out**
- Metro bills are bigger at the top end: the 95th percentile is about 1.6× other cities. Mumbai is highest: 7 % of bills exceed ₹5 L.
- Cashless claims run larger than reimbursement, probably because big planned admissions go cashless.
- Long stays drive the extreme bills: 11 % of 11+ day stays exceed ₹5 L, and the top 1 % reach ₹28 L.

## 3. The method

Inputs: **city** (metro / other / don't know) and **number of people** (kept for later, see §5). **Income is not an input.**

1. Take the 95th / 99th / 90th percentile bill for the customer's city tier (§2).
2. Essential = 95th pct. Balanced = 99th pct. Higher = 99th + 90th pct.
3. Never go below the v0 government-rate floor (CGHS 2025 super-speciality CABG, ₹2.71 L Tier I, ×0.9 elsewhere).
4. Grow for 3 years at 10.4 % a year, then round **up** to the next ₹50,000.

Named assumptions (in `ASSUMPTIONS`): 3-year horizon; unknown city counts as metro; round up.

## 4. How it should appear in the product

- Three options, each with "what it pays for" in plain words and this sentence: *"Based on hospital bills of Turtlemint customers, grown for three years of rising costs. One bill can be larger than these — ask your advisor about the hospitals you would use."*
- For customers with cover: compare their **lowest** possible current cover (bottom of the band they chose) with the three options. Count company cover only "while you stay in this job".
- Context worth showing: long stays and metro hospitals are where bills get very large.
- Never auto-recommend a super top-up from these numbers; the advisor discusses options.

## 5. Limits (and what fixes each)

| Limit | Effect | Fix |
|---|---|---|
| Amounts are **per claim**, not per policy year | A family can have more than one claim in a year; "Higher" approximates this with a second claim | Per-policy-year totals from the de-identified extract (claim ↔ policy mapping, D6) |
| No age or family size on claims | The same amount for a young single person and a family with parents | Claim ↔ member mapping with age band (data request) |
| City known for only ~4,200 of 22,000 bills | Metro / other split rests on those | Data team to fill hospital city or join `healthhospitalmaster` |
| Billed, not paid | Includes items the insurer doesn't pay; customers bear those | Fine for "how big can a bill get"; deduction reasons in the data request |
| Turtlemint-assisted claims only | Complex claims may be over-represented | Compare with insurer-reported claims when available |
| `mode_of_treatment` and diagnosis mostly blank | No split by condition yet | Diagnosis group (needs privacy approval) |

## 6. Previous versions

- **v0 (16 Nov 2026):** floors at government rates (CGHS 2025) + NSS 2025 typical stay. Metro family of four: ₹4 L / ₹6 L / ₹9 L. Kept inside v1 as the minimum.
- **Check against paid claims (`consumer` DB, ~460 policies):** floaters' top 1 % of paid amounts ₹4.1–5.8 L; ~3 % of ₹3–5 L floaters used ≥ 90 % of cover. Consistent with v1's Essential amount.
- **Old formula:** ₹20 L for a metro family of four with ₹50k–1 L take-home. Not supported by any data; retired.

## 7. Approval

Even data-backed, this is advice. Before customers see any amount: a named Turtlemint owner (health product or underwriting) reviews this document, and `ADVISORY_RULES_APPROVED=true` is set with that approval reference.

## Sources

- Turtlemint claims data: Superset (insights.mintpro.in), Athena `spectrum.claims_health_claims` and `spectrum.claims_general_claim_details`, aggregate queries run 16 Nov 2026 (SQL Lab tab "Claude cover analysis").
- NSO / PIB, Press note on Household Social Consumption: Health, NSS 80th round (Apr 2026): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/apr/doc2026420852401.pdf
- CGHS revised rates OM, 3 Oct 2025 (copy): https://www.rri.res.in/sites/default/files/hospitals/CGHS-rates.pdf
- Business Today, CGHS rate revision (CABG figures): https://www.businesstoday.in/amp/industry/pharma/story/why-cghs-rate-hike-is-a-big-boost-for-hospitals-497106-2025-10-07
- Aon, 2026 medical trend rates, India: https://www.aon.com/apac/in-the-press/asia-newsroom/2025/india-outpaces-global-average-with-2026-medical-trend-at-11-5-percent-aon-reports
- Mercer Marsh Benefits 2026 Health Trends (India), as reported: https://indiamedtoday.com/mercer-marsh-benefits-releases-2026-health-trends-report/
