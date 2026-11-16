-- v3: shorter quiz. New one-tap answers (age band, income band, city tier) and the flow version per session,
-- so v2 vs v3 drop-off can be compared. Old columns stay for v2 sessions and history.
BEGIN;
SET search_path = cover_check, public;

CREATE TYPE age_band_t    AS ENUM ('18_30','31_40','41_50','51_60','61p');
CREATE TYPE income_band_t AS ENUM ('lt25k','25_50k','50k_1l','1_2l','2lp','prefer_not');
CREATE TYPE city_tier_t   AS ENUM ('metro','other');

ALTER TABLE quiz_answer ADD COLUMN age_band    age_band_t;
ALTER TABLE quiz_answer ADD COLUMN income_band income_band_t;   -- optional; used only to size cover (purpose shown on screen)
ALTER TABLE quiz_answer ADD COLUMN city_tier   city_tier_t;

ALTER TABLE quiz_session ADD COLUMN flow_version text NOT NULL DEFAULT 'v3';
UPDATE quiz_session SET flow_version = 'v2' WHERE started_ts < now();   -- sessions before this migration ran on v2

-- Telecaller card gets the new answers (columns appended, so CREATE OR REPLACE keeps grants).
CREATE OR REPLACE VIEW lead_card_source AS
WITH last_session AS (
  SELECT DISTINCT ON (s.lead_id) s.lead_id, s.session_id, s.flow_version
  FROM quiz_session s ORDER BY s.lead_id, s.started_ts DESC
), last_handoff AS (
  SELECT DISTINCT ON (h.lead_id) h.* FROM handoff h ORDER BY h.lead_id, h.created_ts DESC
), last_doc AS (
  SELECT DISTINCT ON (d.lead_id) d.lead_id, d.doc_id, d.processing_status
  FROM policy_document d WHERE d.deleted_ts IS NULL AND d.superseded_by IS NULL
  ORDER BY d.lead_id, d.uploaded_ts DESC
)
SELECT l.lead_id, l.first_name, l.pincode, l.city, l.state, l.mobile_verified, l.lead_state, l.priority,
       qa.situation, qa.members::text[] AS members, qa.eldest_age, qa.children_count, qa.parents_age_band, qa.sum_insured_band,
       qa.family_in_group_cover, qa.health_condition, qa.policy_age_band, qa.job_exit_cover, qa.room_rent_limit,
       qa.room_rent_note, qa.top_concern, qa.renewal_window, qa.personal_policy_besides_group, qa.start_timing,
       ls.session_id,
       lh.requested_action, lh.slot_start, lh.slot_end, lh.call_language, lh.topic, lh.note,
       ld.doc_id, ld.processing_status AS doc_status, pp.insurer_name, pp.product_name,
       cc.granted_ts AS contact_consent_ts, cc.notice_version AS contact_notice_version, cc.granted AS contact_granted,
       qa.age_band, qa.income_band, qa.city_tier, ls.flow_version
FROM lead l
LEFT JOIN last_session ls USING (lead_id)
LEFT JOIN quiz_answer qa ON qa.session_id = ls.session_id
LEFT JOIN last_handoff lh ON lh.lead_id = l.lead_id
LEFT JOIN last_doc ld ON ld.lead_id = l.lead_id
LEFT JOIN policy_profile pp ON pp.doc_id = ld.doc_id
LEFT JOIN consent_current cc ON cc.lead_id = l.lead_id AND cc.purpose = 'contact_call';

-- Drop-off by flow version and screen: did v3 fix the question-2 cliff?
CREATE VIEW dropoff_by_version AS
SELECT flow_version, path, last_screen_id,
       count(*) FILTER (WHERE completed_ts IS NULL)     AS stopped_here,
       count(*)                                          AS sessions,
       round(avg(total_time_sec) FILTER (WHERE completed_ts IS NOT NULL)) AS avg_time_to_result_sec
FROM quiz_session GROUP BY flow_version, path, last_screen_id;
GRANT SELECT ON dropoff_by_version TO cover_check_bi;

COMMIT;
