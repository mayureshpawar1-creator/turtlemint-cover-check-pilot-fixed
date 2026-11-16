-- v4: the whole quiz on one screen, and a one-screen cover plan (health + term + crisis).
--  * family as counts (steppers) — members[] is still stored, derived from the counts
--  * term insurance joins the plan types we can show
--  * new events: each card answered on the one screen (drop-off by card), plan details opened on S7
BEGIN;
SET search_path = cover_check, public;

ALTER TABLE quiz_answer ADD COLUMN adults_count  smallint CHECK (adults_count BETWEEN 1 AND 2);
ALTER TABLE quiz_answer ADD COLUMN parents_count smallint CHECK (parents_count BETWEEN 0 AND 4);
ALTER TABLE quiz_answer DROP CONSTRAINT IF EXISTS quiz_answer_children_count_check;
ALTER TABLE quiz_answer ADD CONSTRAINT quiz_answer_children_count_check CHECK (children_count BETWEEN 0 AND 6);

ALTER TABLE quiz_session ALTER COLUMN flow_version SET DEFAULT 'v4';

ALTER TABLE recommendation DROP CONSTRAINT IF EXISTS recommendation_plan_type_check;
ALTER TABLE recommendation ADD CONSTRAINT recommendation_plan_type_check CHECK (plan_type IN
  ('family_floater','individual','senior_citizen','super_top_up','no_room_cap','critical_illness','compare_quotes','term_life'));

ALTER TABLE event DROP CONSTRAINT event_name_check;
ALTER TABLE event ADD CONSTRAINT event_name_check CHECK (name IN (
  'link_clicked','landing_viewed','quiz_started','screen_viewed','answer_submitted','quiz_completed',
  'readout_viewed','capture_submitted','otp_sent','otp_verified','next_action_selected','upload_started',
  'upload_completed','extraction_ready','facts_confirmed','summary_viewed','point_opened','call_requested',
  'plans_viewed','summary_sent','consent_withdrawn',
  'snapshot_viewed','checklist_marked','recommendation_shown','recommendation_clicked','summary_previewed','policy_health_viewed',
  'card_answered','plan_details_opened'));

-- Telecaller card: family counts (columns appended, so CREATE OR REPLACE keeps grants).
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
       qa.adults_count, qa.parents_count
FROM lead l
LEFT JOIN last_session ls USING (lead_id)
LEFT JOIN quiz_answer qa ON qa.session_id = ls.session_id
LEFT JOIN last_handoff lh ON lh.lead_id = l.lead_id
LEFT JOIN last_doc ld ON ld.lead_id = l.lead_id
LEFT JOIN policy_profile pp ON pp.doc_id = ld.doc_id
LEFT JOIN consent_current cc ON cc.lead_id = l.lead_id AND cc.purpose = 'contact_call';

-- Which card people stop at on the one screen (v4 replaces "which screen").
CREATE VIEW card_dropoff AS
SELECT e.props->>'card' AS card, count(DISTINCT e.lead_id) AS leads_answered,
       round(avg((e.props->>'ms')::numeric) / 1000, 1) AS avg_seconds
FROM event e WHERE e.name = 'card_answered' GROUP BY 1;
GRANT SELECT ON card_dropoff TO cover_check_bi;

COMMIT;
