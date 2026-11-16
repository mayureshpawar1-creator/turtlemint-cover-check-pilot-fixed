# Turtlemint Policy Intelligence Engine — build specification

## Product ambition

Build a defensible consumer policy-intelligence capability, not a generic PDF-to-chatbot wrapper. The customer value is: **"We read what your policy actually says, show where we found it, explain what it may mean, and tell you what still needs checking."**

The defensible advantage must come from a continuously improving, permissioned corpus of policy structures and reviewed interpretations—not from claiming that OCR or an LLM is unique.

## The intelligence loop

1. **Ingest**: accept the policy schedule, Customer Information Sheet (CIS), full wording, endorsements, renewal schedule and add-ons as separate document types.
2. **Classify**: detect insurer, product, document type, version/date and page structure; preserve ambiguity.
3. **Extract**: return normalized facts with page, exact evidence span, parser/version, confidence and alternative candidates where ambiguous.
4. **Reconcile**: compare schedule vs wording vs endorsements; never silently choose conflicting values. Later, detect changes between renewals.
5. **Interpret**: run versioned deterministic rules against extracted facts and the applicable policy wording. Every finding links to its evidence and rule source.
6. **Explain**: show what was found, what it may mean, what is unknown, and the next useful question/action in plain Indian English.
7. **Review and learn**: authorised human reviewers correct fields and interpretations. Store corrections only with valid purpose, access control, retention and privacy review. Use corrections to improve insurer-specific parsers and regression tests.

## Why this could become a Turtlemint advantage

- **Insurer/product/version map**: policy templates and wording changes indexed over time.
- **Policy evidence graph**: each normalized fact links to page/span, source document, effective dates and conflicting sources.
- **Reviewed edge-case library**: co-pay exceptions, room category definitions, disease-specific waiting periods, restoration triggers, bonus rules, modern-treatment sublimits, zone/co-payment clauses, portability continuity and endorsements.
- **Policy change intelligence**: explain what changed between two renewals, backed by exact evidence.
- **Advisor feedback loop**: capture which uncertain fields were corrected and which explanations needed escalation; measure quality by insurer/product/document type.
- **Outcome measurement**: track extraction precision, false-positive rate, review rate, customer correction rate, time-to-completion and advisor overturn rate.

These advantages are hypotheses to validate with data. They are not claims that Turtlemint already has a proprietary corpus or superior accuracy.

## Evidence contract

Every extracted fact should eventually include:
- canonical key and normalized value;
- source document and page;
- exact text span / bounding box when available;
- extraction method and version;
- calibrated confidence and alternatives;
- status: extracted, customer-entered, advisor-reviewed, insurer-verified, conflicting, or not found.

A customer confirming a field is not insurer verification. A value absent from a schedule is not proof that the policy has no such limit. Do not infer coverage or claim eligibility from a single extracted field.

## Build sequence

### V1 — text-native PDF
- Extract actual page text with page numbers.
- Parse only conservative, label-near-value patterns.
- Return null for ambiguous or missing facts.
- Add tests using synthetic fixtures and redacted policy documents.
- Keep demo mode visibly separate from real mode.

### V2 — scanned PDFs and images
- Add OCR behind a replaceable interface.
- Evaluate English and Indian policy scans, rotations, low resolution, tables and multi-column layouts.
- Preserve OCR boxes and confidence. Route low-confidence values to customer/advisor review.
- Select provider only after security, residency, retention, cost and DPA review.

### V3 — insurer-aware parsing and reconciliation
- Build template families with explicit versions and regression fixtures.
- Extract schedule, CIS, wording and endorsements independently.
- Surface contradictions rather than overwrite them.

### V4 — source-backed interpretation
- Version each rule, with primary source, clause/page, effective date, test cases, uncertainty fallback and compliance owner.
- Use IRDAI primary sources for regulatory guidance and the exact customer policy documents for contractual wording.
- Medical-cost context may inform a separately labelled planning discussion; it must not be presented as a policy clause or definitive coverage recommendation.

## Release gates

Do not use real customer documents until access controls, encryption, retention/deletion, logs, consent, vendor review and incident response are approved. Do not claim "best cover", "no hidden cuts", "covered now", "claim will be paid", or "no co-pay" without evidence that supports that exact statement. No LLM-generated value may bypass schema validation and evidence requirements.
