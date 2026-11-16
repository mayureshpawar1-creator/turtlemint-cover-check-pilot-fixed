-- 009 One event contract (roadmap 1.2).
-- * event.name CHECK now lists exactly shared/src/enums.ts EVENT_NAMES (server milestones + client interactions).
--   backend/test/eventContract.test.ts fails if the two ever drift again.
-- * event_reject: browser events the API refused (unknown name, or a server milestone sent by a client).
--   Name, screen and reason only; no lead id, no props.
BEGIN;
SET search_path = cover_check, public;

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
  'policy_health_viewed','policy_analysis_viewed','recommendation_engaged','recommendations_compared','gap_insight_interacted','otp_failed'));

CREATE TABLE event_reject (
  reject_id bigserial   PRIMARY KEY,
  ts        timestamptz NOT NULL DEFAULT now(),
  name      text        NOT NULL CHECK (char_length(name) <= 64),
  screen_id text        CHECK (char_length(screen_id) <= 16),
  reason    text        NOT NULL CHECK (char_length(reason) <= 200)
);
CREATE INDEX event_reject_ts_idx ON event_reject (ts);

-- Data-quality view: rejected browser events per day. Non-zero means the app and the contract disagree.
CREATE VIEW event_reject_daily AS
SELECT date_trunc('day', ts AT TIME ZONE 'Asia/Kolkata')::date AS day, name, reason, count(*) AS rejects
FROM event_reject
GROUP BY 1, 2, 3;

GRANT SELECT, INSERT ON event_reject TO cover_check_app;
GRANT USAGE ON SEQUENCE event_reject_reject_id_seq TO cover_check_app;
GRANT SELECT ON event_reject_daily TO cover_check_bi;

COMMIT;
