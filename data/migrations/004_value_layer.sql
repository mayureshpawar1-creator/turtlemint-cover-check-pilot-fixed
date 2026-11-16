-- v2 value layer: what we showed people, what they explored, what they ticked off.
-- Every interaction on the snapshot (S7), plans that fit (S9a), summary preview (S9b) and policy health (U7)
-- is stored so the telecaller sees it and analytics can measure it.
BEGIN;
SET search_path = cover_check, public;

-- Plan types shown, and whether the person opened the Turtlemint page.
CREATE TABLE recommendation (
  rec_id      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid             NOT NULL REFERENCES lead ON DELETE CASCADE,
  origin      finding_origin_t NOT NULL,            -- quiz | document
  plan_type   text             NOT NULL CHECK (plan_type IN
                ('family_floater','individual','senior_citizen','super_top_up','no_room_cap','critical_illness','compare_quotes')),
  reason      text             NOT NULL,            -- rule key, e.g. low_cover, parents_60
  url         text             NOT NULL,
  rank        smallint         NOT NULL,
  shown_ts    timestamptz      NOT NULL DEFAULT clock_timestamp(),
  clicked_ts  timestamptz,
  click_count smallint         NOT NULL DEFAULT 0,
  advisor_requested_ts timestamptz,
  UNIQUE (lead_id, origin, plan_type)
);
CREATE INDEX recommendation_lead_idx ON recommendation (lead_id);
CREATE INDEX recommendation_type_idx ON recommendation (plan_type, clicked_ts);

-- Checklist boxes the person ticked on S7 ("I've checked this").
CREATE TABLE checklist_mark (
  lead_id    uuid        NOT NULL REFERENCES lead ON DELETE CASCADE,
  item_id    text        NOT NULL CHECK (item_id IN ('cover_amount','room_rent','waiting','family','parents','beyond_job','renewal','cashless')),
  status_shown text      NOT NULL CHECK (status_shown IN ('check','unknown')),
  marked     boolean     NOT NULL,
  marked_ts  timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (lead_id, item_id)
);

-- Exactly what was sent on WhatsApp (by hash), and that it was previewed first.
ALTER TABLE whatsapp_message ADD COLUMN body_sha256 text;
ALTER TABLE whatsapp_message ADD COLUMN previewed_ts timestamptz;

-- New events.
ALTER TABLE event DROP CONSTRAINT event_name_check;
ALTER TABLE event ADD CONSTRAINT event_name_check CHECK (name IN (
  'link_clicked','landing_viewed','quiz_started','screen_viewed','answer_submitted','quiz_completed',
  'readout_viewed','capture_submitted','otp_sent','otp_verified','next_action_selected','upload_started',
  'upload_completed','extraction_ready','facts_confirmed','summary_viewed','point_opened','call_requested',
  'plans_viewed','summary_sent','consent_withdrawn',
  'snapshot_viewed','checklist_marked','recommendation_shown','recommendation_clicked','summary_previewed','policy_health_viewed'));

-- Analytics: which plan types interest people, by reason.
CREATE VIEW recommendation_funnel AS
SELECT plan_type, origin, reason,
       count(*)                                         AS shown,
       count(*) FILTER (WHERE clicked_ts IS NOT NULL)   AS opened,
       count(*) FILTER (WHERE advisor_requested_ts IS NOT NULL) AS advisor_requested,
       round(100.0 * count(*) FILTER (WHERE clicked_ts IS NOT NULL) / NULLIF(count(*), 0), 1) AS open_rate_pct
FROM recommendation GROUP BY plan_type, origin, reason;

GRANT SELECT, INSERT, UPDATE ON recommendation, checklist_mark TO cover_check_app;
GRANT SELECT ON recommendation, checklist_mark TO cover_check_agent;
GRANT SELECT ON recommendation_funnel TO cover_check_bi;
COMMIT;
