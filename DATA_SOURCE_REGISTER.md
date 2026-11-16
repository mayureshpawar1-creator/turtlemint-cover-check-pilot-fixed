# Data Source Register

First 20 high-value official sources (brief step 16). Status was checked on **16 Nov 2026** through web search. The build sandbox has no direct internet access, so **no file was downloaded or hashed yet**. "Confirmed" means the document's existence, issuer and date were confirmed from the official site or from more than one reliable report; it does **not** mean the contents were extracted or reviewed.

Status values follow the brief's lifecycle. Everything below is at `DISCOVERED` until it is downloaded, hashed and stored in `source_records`.

| # | Source | Publisher | Date / version | Use in product | Existence check | Status |
|---|---|---|---|---|---|---|
| 1 | Master Circular on Health Insurance Business (Ref IRDAI/HLT/CIR/PRO/84/5/2024) | IRDAI | 29 May 2024; to be reviewed yearly | Waiting periods, PED, moratorium, portability, CIS, claims timelines | Confirmed: reference, date and annual-review clause confirmed from a copy of the circular and multiple reports | DISCOVERED. **Check for a 2025/2026 revision** before encoding rules. |
| 2 | IRDAI (Insurance Products) Regulations, 2024 | IRDAI | 2024 | Product rules; repealed the Health Insurance Regulations 2016 | Confirmed (secondary) | DISCOVERED |
| 3 | IRDAI (Protection of Policyholders' Interests, Operations and Allied Matters of Insurers) Regulations, 2024 | IRDAI | Notified 20 Mar 2024 | Disclosure, sales conduct, grievance, distribution | Confirmed: PDF on financialservices.gov.in | DISCOVERED |
| 4 | Master Circular on Protection of Policyholders' Interests | IRDAI | 5 Sep 2024 | Customer communication, claims and grievance standards | Confirmed (secondary) | DISCOVERED |
| 5 | IRDAI Annual Report 2024-25 | IRDAI | FY25 | Lives covered by channel, premiums, claims, grievances (Bima Bharosa) | Confirmed (multiple reports: ~58 crore lives; 47.4 % group, 10.3 % individual) | DISCOVERED. Reconcile 58.06 vs 58.20 crore against the primary table; `benchmarks.ts` uses 58.06. |
| 6 | Handbook on Indian Insurance Statistics 2023-24 | IRDAI | Released Mar 2025 | Insurer-level claims and ICR time series | Confirmed (secondary) | DISCOVERED. Check for a 2024-25 edition. |
| 7 | Insurer public disclosures (NL forms) | Each insurer | Quarterly | Insurer-level claims received/paid/repudiated/pending | Known disclosure regime; not checked per insurer | DISCOVERED |
| 8 | Policyholder portal: portability, grievance | IRDAI (policyholder.gov.in) | Live site | Plain-language explanations; already cited in code | URL in `benchmarks.ts`; not re-fetched | DISCOVERED |
| 9 | Digital Personal Data Protection Act, 2023 | MeitY / Parliament | Enacted 11 Aug 2023 | Consent, notice, rights, retention | Confirmed (PIB) | DISCOVERED |
| 10 | Digital Personal Data Protection Rules, 2025 (G.S.R. 846(E)) | MeitY | Notified 13/14 Nov 2025; **phased commencement** | Consent and notice format, breach reporting, retention, security safeguards | Confirmed: PIB backgrounder (17 Nov 2025) and law-firm notes | DISCOVERED. **Legal review needed** on which rules are already in force on our pilot date. |
| 11 | TCCCPR 2018 + Second Amendment Regulations 2025 | TRAI | Amended 12 Feb 2025 | Calling rules for callers: 140 series for promotional calls, 1600 series for service/transactional; consent; complaint process | Confirmed: TRAI press release no. 11/2025 | DISCOVERED. Affects caller phone numbers and the calling window. |
| 12 | NSS 80th round: Household Social Consumption: Health (Jan–Dec 2025) | MoSPI / NSO | Report released 2026; unit data on microdata.gov.in (catalog 290) | Insurance coverage, hospitalisation, out-of-pocket spend by state and sector | Confirmed: microdata.gov.in catalog page | DISCOVERED. **New since the code was written; highest-value customer-intelligence dataset.** |
| 13 | NSS 75th round: Health (2017–18) | MoSPI / NSO | 2019 | Comparison baseline | Confirmed (microdata catalog 152) | DISCOVERED |
| 14 | National Health Accounts estimates for India 2022-23 | NHSRC (MoHFW) | 10th edition | Macro spending and out-of-pocket share | Confirmed (multiple reports) | DISCOVERED |
| 15 | CGHS revised package rates (OM 5-16/CGHS(HQ)/HEC/2024, 3 Oct 2025) | MoHFW (CGHS) | Effective 13 Oct 2025; tiered by city, accreditation, ward | Procedure-level cost floor by city tier | Confirmed: OM text from several copies | DISCOVERED. Download annexures from cghs.mohfw.gov.in. |
| 16 | PM-JAY Health Benefit Package 2.2 (and later revisions) | National Health Authority | Nov 2021 manual; later revisions to check | Procedure package rates | Confirmed: manual PDF on nha.gov.in | DISCOVERED. Find the current HBP version. |
| 17 | Ayushman Vay Vandana (70+ cover) | PIB / NHA | Dec 2024 | Free ₹5 L cover for 70+; already cited in code | Cited in `benchmarks.ts`; not re-fetched | DISCOVERED |
| 18 | NFHS-5 (2019–21) | MoHFW / IIPS (rchiips.org/nfhs) | 2021–22 | Household insurance coverage by state | Known; not re-fetched | DISCOVERED. Check NFHS-6 status. |
| 19 | All-India pincode directory | Department of Posts (data.gov.in) | Rolling | Replace `PINCODE_PREFIX_DEMO` | Known dataset; not re-fetched | DISCOVERED |
| 20 | Insurer product documents (policy wording, CIS, prospectus) for the 12 named insurers | Each insurer | Per product version | Variant-specific product facts | Ingestion CLI exists for 5 insurer domains; none ingested | DISCOVERED |

## Already cited in code (`shared/src/benchmarks.ts`)

| Source id | Note |
|---|---|
| `irdai_ar_2425` | = #5 |
| `niti_2021` (NITI Aayog "Missing Middle", Oct 2021, via PIB) | Still valid as a 2021 estimate; label it with its year |
| `milliman_2026` (medical inflation) | Consultancy source; label as such; prefer a government/regulator figure if one exists |
| `irdai_mc_2024` | = #1, but the URL points to the department page; replace with the circular itself |
| `pib_vay_vandana` | = #17 |
| `irdai_portability` | = #8 |
| `turtlemint`, `cover_rule` | Internal; must not be shown with the same "source" styling as external publications |

## Next step for each source

1. Download from the official domain only (no mirrors), store bytes, SHA-256, fetch time → `DOWNLOADED`.
2. Extract text/tables with method version → `EXTRACTED`.
3. Reviewer checks page/clause against the original → `VERIFIED`; approval reference → `APPROVED`.
4. Record superseding links (e.g. an amended circular) and set `SUPERSEDED` on the old record.
5. Re-check on a schedule: quarterly for regulations, on each new edition for reports.
