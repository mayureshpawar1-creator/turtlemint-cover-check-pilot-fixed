-- 011 Journey v5 (roadmap 1.4).
-- * quiz_answer: premium_comfort (yearly premium they're comfortable with) and other_protection_interest
--   (optional "Also interested in life or critical-illness cover?" — for the caller only; never changes advice or score).
-- * income_band stays as a column for old rows but v5 neither asks, reads nor writes it. Whether to purge the
--   values already stored is a retention decision for the data owner (KNOWN_ISSUES D2), not done here.
-- * lead_card_source: the two new answers appended (CREATE OR REPLACE keeps grants).
-- * event: question_viewed / question_answered / question_skipped (field name and timing only — never the answer value).
-- * question_dropoff: per question, how many leads saw it, answered it, skipped it.
BEGIN;
SET search_path = cover_check, public;

CREATE TYPE premium_comfort_t AS ENUM ('lt10k','10_20k','20_35k','35kp','unsure');
CREATE TYPE other_interest_t  AS ENUM ('yes','later','no');
ALTER TABLE quiz_answer ADD COLUMN premium_comfort           premium_comfort_t;
ALTER TABLE quiz_answer ADD COLUMN other_protection_interest other_interest_t;

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
       qa.age_band, qa.income_band, qa.city_tier, ls.flow_version,
       qa.adults_count, qa.parents_count,
       qa.premium_comfort, qa.other_protection_interest
FROM lead l
LEFT JOIN last_session ls USING (lead_id)
LEFT JOIN quiz_answer qa ON qa.session_id = ls.session_id
LEFT JOIN last_handoff lh ON lh.lead_id = l.lead_id
LEFT JOIN last_doc ld ON ld.lead_id = l.lead_id
LEFT JOIN policy_profile pp ON pp.doc_id = ld.doc_id
LEFT JOIN consent_current cc ON cc.lead_id = l.lead_id AND cc.purpose = 'contact_call';

ALTER TABLE event DROP CONSTRAINT event_name_check;
ALTER TABLE event ADD CONSTRAINT event_name_check CHECK (name IN (
  -- server milestones (recorded only by the API)
  'link_clicked','quiz_started','answer_submitted','quiz_completed','readout_viewed','capture_submitted',
  'otp_sent','otp_verified','next_action_selected','call_requested','plans_viewed','consent_withdrawn',
  'upload_started','upload_completed','extraction_ready','facts_confirmed','summary_viewed','summary_previewed',
  'summary_sent','checklist_marked','recommendation_shown','recommendation_clicked',
  -- client interactions (accepted at POST /events)
  'landing_viewed','screen_viewed','screen_exited','screen_engaged','cta_clicked','content_toggle',
  'tool_used','card_answered','snapshot_viewed','point_opened','plan_details_opened','plan_detail_viewed',
  'policy_health_viewed','policy_analysis_viewed','recommendation_engaged','recommendations_compared','gap_insight_interacted','otp_failed','question_viewed','question_answered','question_skipped'));

CREATE VIEW question_dropoff AS
SELECT s.flow_version, e.props->>'field' AS field,
       count(DISTINCT e.lead_id) FILTER (WHERE e.name = 'question_viewed')   AS leads_viewed,
       count(DISTINCT e.lead_id) FILTER (WHERE e.name = 'question_answered') AS leads_answered,
       count(DISTINCT e.lead_id) FILTER (WHERE e.name = 'question_skipped')  AS leads_skipped,
       round(avg((e.props->>'ms')::numeric) FILTER (WHERE e.name = 'question_answered') / 1000, 1) AS avg_seconds_to_answer,
       count(*) FILTER (WHERE e.name = 'question_answered' AND e.props->>'unsure' = 'true') AS unsure_answers
FROM event e
LEFT JOIN quiz_session s ON s.session_id = e.session_id
WHERE e.name IN ('question_viewed', 'question_answered', 'question_skipped')
GROUP BY 1, 2;
GRANT SELECT ON question_dropoff TO cover_check_bi;

COMMIT;
