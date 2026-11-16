# Cover Check — evidence and advisory standard

**Status: pilot guardrail; not a substitute for Turtlemint Compliance, Legal, Actuarial or Product approval.**

## Non-negotiable rule

A policy fact, interpretation, benchmark, recommendation or customer-facing claim must have an identifiable evidence basis. If the evidence is missing, ambiguous, stale or not applicable to the customer's product, show **Needs review** and explain what must be checked. Never convert missing data into a positive finding.

## Source hierarchy

1. **The customer's own policy schedule, Customer Information Sheet (CIS), full policy wording, endorsements and renewal documents** for product-specific terms. Record the page or section when available. A schedule alone may not contain every applicable condition.
2. **IRDAI primary material** for regulatory requirements and policyholder guidance:
   - IRDAI Health Department / health insurance guidance: https://irdai.gov.in/health-dept
   - IRDAI FAQs on health insurance regulations: https://irdai.gov.in/faqs-on-health-insurance-regulations
   - IRDAI circulars, including the Master Circular on Health Insurance Business dated 29 May 2024: https://irdai.gov.in/web/guest/circulars?filterDepartment=HLT&filtersApplied=true
3. **Government sources** (for example, PIB or scheme portals) for eligibility and benefits of public schemes. Eligibility must be checked; never infer that a customer qualifies from income alone.
4. **Peer-reviewed research or established actuarial/health-cost publications** for medical-cost context. Store the publication date, geography, methodology and the exact statistic; do not turn a population average into an individual forecast.
5. **Internal Turtlemint data** only when the metric is defined, representative, privacy-reviewed, time-bounded and reproducible. Label it internal, with an as-of date and denominator.

Search snippets, marketing copy, aggregator comparisons and undocumented assumptions are not sufficient evidence for regulatory or suitability claims.

## Rules for customer-facing logic

- Distinguish **found in document**, **customer-entered**, **derived calculation**, **not found**, **uncertain**, and **confirmed by insurer/advisor**. These are not interchangeable.
- Preserve source page, extractor version, confidence and any customer edit. A customer's confirmation is not the same as insurer verification.
- Do not say “covered now”, “no hidden cuts”, “enough cover”, “claim will be paid”, “no co-pay”, “no limit”, or “best/cheapest” unless the exact wording and evidence justify that precise claim. Absence of a term in the uploaded pages is not proof that the term does not exist.
- A waiting-period calculation from one start date is only a calculation. It does not prove continuity, disclosure status, policy applicability or claim eligibility.
- The presence of restoration or a no-claim bonus is not, by itself, proof that the feature is adequate or unrestricted. Explain that triggers, limits, exclusions and conditions depend on the wording.
- A sum-insured comparison is not a personalised coverage-adequacy decision. The current Cover Check suggested-cover formula is a **draft heuristic requiring validation**; it must not independently trigger a top-up/new-policy sales recommendation.
- No product recommendation should be shown until the evidence supports the issue, the product's current policy wording and pricing are verified, suitability and affordability are considered, and the rule has an owner and approval record.
- If a critical field is missing, unreadable, low-confidence or contradictory, suppress the recommendation and ask for the missing detail or human review.
- Keep the action proportional to evidence: explain the fact, why it may matter, what remains unknown, and the safest next step.

## Minimum evidence record for every advisory rule

Each rule must have:
- a stable rule ID and version;
- the exact customer situation it applies to and cases it must not apply to;
- primary source URL/title, publication or effective date, page/section and captured wording;
- data fields used and the calculation in plain language;
- confidence/uncertainty handling and fallback behaviour;
- positive, negative, missing-data and edge-case tests;
- an accountable Turtlemint owner (Advisory/Product), Compliance/Legal review where applicable, approval date and next review date;
- a change log and a way to identify which version was shown to each customer.

## Extraction gate

The repository currently has demo and manual extractors; neither is an approved production-grade policy OCR pipeline. Do not describe the pilot as automatically reading actual policies until a real extractor is implemented and validated. The production reader must:
- support an explicitly approved set of document types/insurer formats;
- retain page-level provenance and calibrated confidence;
- return null/Needs review for unreadable or ambiguous facts;
- detect scanned/image-only PDFs and route them to approved OCR or human review;
- test encrypted PDFs, rotated pages, low-resolution scans, tables, multi-page schedules, conflicting dates/amounts and non-health documents;
- be evaluated against a consented, redacted, representative validation set with field-level precision/recall and false-positive review;
- pass Security/Privacy review for retention, access, vendor processing, encryption and deletion before real customer documents are used.

## Launch gate

Until the relevant rules and extractor pass their reviews, this pilot may explain facts visible in the supplied document and identify missing information. It must not claim to deliver a definitive policy suitability assessment or guarantee claim outcomes.
