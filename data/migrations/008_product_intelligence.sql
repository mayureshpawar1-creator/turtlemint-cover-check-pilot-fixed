-- v1 product intelligence: official insurer documents, evidence snippets, and human review.
-- This is deliberately separate from policy_document/policy_fact, which store customer uploads.
BEGIN;
SET search_path = cover_check, public;

CREATE TABLE insurer_product (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_name text NOT NULL CHECK (length(trim(insurer_name)) BETWEEN 2 AND 160),
  product_name text NOT NULL CHECK (length(trim(product_name)) BETWEEN 2 AND 200),
  uin text,
  created_ts timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_ts timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX insurer_product_identity_uq
  ON insurer_product (lower(trim(insurer_name)), lower(trim(product_name)), coalesce(upper(trim(uin)), ''));

CREATE TABLE product_source_document (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES insurer_product(product_id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK (document_type IN (
    'policy_wording', 'prospectus', 'customer_information_sheet', 'add_on_wording',
    'proposal_form', 'brochure', 'official_product_page', 'other'
  )),
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  source_title text,
  document_version text,
  publication_date date,
  effective_from date,
  effective_to date,
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 52428800),
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  extractor_version text NOT NULL,
  ingestion_status text NOT NULL DEFAULT 'pending_review' CHECK (ingestion_status IN (
    'downloaded', 'extracted', 'pending_review', 'approved', 'failed', 'superseded'
  )),
  ingestion_error text,
  fetched_ts timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_ts timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (product_id, content_sha256),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE INDEX product_source_document_product_idx
  ON product_source_document (product_id, fetched_ts DESC);
CREATE INDEX product_source_document_review_idx
  ON product_source_document (ingestion_status, fetched_ts DESC);

CREATE TABLE product_fact_evidence (
  fact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES product_source_document(document_id) ON DELETE RESTRICT,
  fact_key text NOT NULL CHECK (fact_key IN (
    'product_identity', 'uin', 'eligibility_age', 'sum_insured_options', 'room_rent',
    'copay', 'deductible', 'waiting_period_initial', 'waiting_period_pre_existing',
    'waiting_period_specific', 'restoration', 'no_claim_bonus', 'sub_limits', 'exclusions',
    'add_ons', 'network_cashless', 'claims_process', 'portability_continuity', 'other'
  )),
  source_page integer NOT NULL CHECK (source_page > 0),
  evidence_text text NOT NULL CHECK (length(trim(evidence_text)) BETWEEN 1 AND 4000),
  evidence_sha256 char(64) NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  normalized_value jsonb,
  extraction_method text NOT NULL,
  extraction_confidence numeric(5,4) CHECK (
    extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1
  ),
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN (
    'pending_review', 'approved', 'rejected', 'conflict', 'superseded'
  )),
  reviewed_by text,
  reviewed_ts timestamptz,
  approval_reference text,
  review_note text,
  created_ts timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_ts timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (document_id, fact_key, source_page, evidence_sha256),
  CHECK (
    review_status <> 'approved'
    OR (
      normalized_value IS NOT NULL
      AND nullif(trim(reviewed_by), '') IS NOT NULL
      AND reviewed_ts IS NOT NULL
      AND nullif(trim(approval_reference), '') IS NOT NULL
    )
  )
);

CREATE INDEX product_fact_evidence_review_idx
  ON product_fact_evidence (review_status, fact_key);
CREATE INDEX product_fact_evidence_document_idx
  ON product_fact_evidence (document_id, source_page);

-- Safe read surface for later recommendation integration: only approved facts from approved documents.
CREATE VIEW approved_product_facts AS
SELECT
  p.product_id,
  p.insurer_name,
  p.product_name,
  p.uin,
  d.document_id,
  d.document_type,
  d.source_url,
  d.source_title,
  d.document_version,
  d.publication_date,
  d.effective_from,
  d.effective_to,
  d.content_sha256,
  f.fact_id,
  f.fact_key,
  f.normalized_value,
  f.source_page,
  f.evidence_text,
  f.extraction_method,
  f.reviewed_by,
  f.reviewed_ts,
  f.approval_reference
FROM insurer_product p
JOIN product_source_document d ON d.product_id = p.product_id
JOIN product_fact_evidence f ON f.document_id = d.document_id
WHERE d.ingestion_status = 'approved'
  AND f.review_status = 'approved';

COMMIT;
