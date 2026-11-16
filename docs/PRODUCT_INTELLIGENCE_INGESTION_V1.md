# Product intelligence ingestion v1

## Purpose

This is the first auditable ingestion step for insurer product documents. It is deliberately separate from customer-upload extraction (policy_document / policy_fact).

The command downloads a PDF from an allow-listed official insurer domain, hashes the original bytes, extracts text by page, and stores exact topic-matching lines as **pending-review evidence**. It does not infer a normalized policy term, approve a clause, or feed the existing recommendation catalogue.

## Supported official source domains

- ICICI Lombard: icicilombard.com and its subdomains
- HDFC ERGO: hdfcergo.com and its subdomains
- ManipalCigna: manipalcigna.com and its subdomains
- Tata AIG: tataaig.com and its subdomains
- Niva Bupa: nivabupa.com and its subdomains

The first version rejects redirects so the operator must provide the final PDF URL on the insurer's official domain. If the insurer hosts documents on a third-party CDN, do not weaken the host check casually; review and explicitly design an approved-host mechanism first.

## Setup and run

1. Use the repository's existing Node 22+ environment and configure the database connection as documented for Cover Check.
2. Apply the existing migrations to the intended development database:
   
       npm run db:migrate

3. Find the current policy wording or Customer Information Sheet from the insurer's official website. Verify the product name, UIN and document/version details independently. Do not assume an old PDF is current because the URL still works.
4. Run the command with metadata copied from the official document/page:

       npm run product:ingest -- --insurer "ICICI Lombard" --product "Elevate" --type policy_wording --url "https://www.icicilombard.com/REPLACE-WITH-CURRENT-OFFICIAL-PDF.pdf" --title "Elevate Policy Wording" --version "VERSION-AS-SHOWN-IN-DOCUMENT" --uin "UIN-AS-SHOWN-IN-DOCUMENT"

The example URL and metadata placeholders are intentionally not a usable source. Replace them only after verifying the current official document. Optional flags are --published YYYY-MM-DD, --effective-from YYYY-MM-DD and --effective-to YYYY-MM-DD. See npm run product:ingest -- --help.

The downloader requires HTTPS, checks the insurer domain against the insurer name, rejects redirects, enforces a 50 MiB limit, and verifies the PDF signature. PDF text extraction is limited to text-native PDFs; image-only/scanned PDFs fail with a message that OCR is required. No OCR provider is selected in v1.

## Stored records

- insurer_product: insurer/product identity and UIN.
- product_source_document: source URL, document metadata, SHA-256 of the downloaded bytes, page count, extractor version and ingestion status.
- product_fact_evidence: exact topic-matching line, page, evidence hash and pending_review status.
- approved_product_facts: read-only view exposing only facts whose evidence and source document are approved.

The command is idempotent by product + content SHA-256. Re-running the same bytes reports already_ingested and does not reset the document's review status. A changed PDF creates a separate document record so prior evidence is retained.

## Important limitations

- Keyword matches are a discovery index, not comprehensive extraction. A missing snippet does not mean a term is absent from the policy.
- The stored evidence line is not a legal interpretation. normalized_value stays null and extraction confidence stays null until a reviewer validates the exact meaning and enters a normalized value.
- V1 does not have a review UI or approval command. Do not manually mark records approved without an authorised, documented review and approval reference. The database check requires reviewer, timestamp, approval reference and normalized value for an approved fact.
- The current recommendation catalogue remains unchanged. This pipeline does not publish insurer products, prices, eligibility or terms to customers.
- No live database migration, insurer document download, Render configuration change or deployment is performed by adding this code.

## Next gates

1. Run the backend typecheck and tests in the local repository.
2. Apply migration 008 only to a disposable development/test database and verify the tables, uniqueness and approval constraints.
3. Ingest one verified current Elevate document in development; manually compare evidence snippets to the source PDF page-by-page.
4. Add a reviewer workflow, clause-aware extraction, document-version reconciliation and representative accuracy tests before using extracted terms in advice.
5. Obtain required Product/Advisory/Compliance and IT/Infosec approvals before live use with customers.
