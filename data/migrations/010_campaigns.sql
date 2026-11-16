-- 010 Campaigns and attribution v1 (roadmap 1.3).
-- * campaign / campaign_variant: a registry, so every link carries a known campaign and each variant its own landing copy.
-- * source: variant, utm_content, utm_term and referrer on every link open.
-- * campaign_funnel_daily: first-touch funnel per campaign × variant × day, from link open to the advisor's outcome.
--   Stages with no data source (quote, proposal, payment, verified issuance) are not in the view: they are "not tracked",
--   which is different from 0. They arrive with the Turtlemint order data (healthorder_v2), not from this app.
BEGIN;
SET search_path = cover_check, public;

CREATE TABLE campaign (
  campaign_id      text        PRIMARY KEY CHECK (campaign_id ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name             text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  objective        text        CHECK (char_length(objective) <= 400),
  audience         text        CHECK (char_length(audience) <= 400),
  channel          text        NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms','email','web','partner','other')),
  wa_template_ref  text,
  owner            text,
  status           text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused','ended')),
  starts_on        date,
  ends_on          date,
  created_ts       timestamptz NOT NULL DEFAULT now(),
  updated_ts       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE TRIGGER campaign_touch BEFORE UPDATE ON campaign FOR EACH ROW EXECUTE FUNCTION touch_updated();

CREATE TABLE campaign_variant (
  campaign_id      text        NOT NULL REFERENCES campaign ON DELETE CASCADE,
  variant_id       text        NOT NULL CHECK (variant_id ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  description      text        CHECK (char_length(description) <= 400),
  landing_language language_t  NOT NULL DEFAULT 'en',
  landing_headline text        CHECK (char_length(landing_headline) <= 120),
  landing_sub      text        CHECK (char_length(landing_sub) <= 200),
  created_ts       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, variant_id)
);

ALTER TABLE source ADD COLUMN variant_id  text CHECK (char_length(variant_id) <= 32);
ALTER TABLE source ADD COLUMN utm_content text CHECK (char_length(utm_content) <= 120);
ALTER TABLE source ADD COLUMN utm_term    text CHECK (char_length(utm_term) <= 120);
ALTER TABLE source ADD COLUMN referrer    text CHECK (char_length(referrer) <= 200);
CREATE INDEX source_campaign_variant_idx ON source (campaign_id, variant_id, first_click_ts);

-- First touch: each lead counts once, for the campaign and variant of its first link open.
CREATE VIEW campaign_funnel_daily AS
WITH first_touch AS (
  SELECT DISTINCT ON (lead_id) lead_id, campaign_id, coalesce(variant_id, creative_id) AS variant_id, first_click_ts
  FROM source
  ORDER BY lead_id, first_click_ts, source_id
)
SELECT date_trunc('day', ft.first_click_ts AT TIME ZONE 'Asia/Kolkata')::date AS day,
       coalesce(ft.campaign_id, '(no campaign)')                                   AS campaign_id,
       (c.campaign_id IS NOT NULL)                                                 AS registered,
       coalesce(ft.variant_id, '(none)')                                           AS variant_id,
       count(*)                                                                    AS opened_link,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM event e WHERE e.lead_id = ft.lead_id AND e.name = 'landing_viewed'))    AS landed,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM event e WHERE e.lead_id = ft.lead_id AND e.name = 'quiz_started'))      AS started,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM event e WHERE e.lead_id = ft.lead_id AND e.name = 'quiz_completed'))    AS completed,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM event e WHERE e.lead_id = ft.lead_id AND e.name = 'capture_submitted')) AS contact_submitted,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM consent_current cc WHERE cc.lead_id = ft.lead_id AND cc.purpose = 'contact_call' AND cc.granted)) AS call_consent,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM handoff h WHERE h.lead_id = ft.lead_id AND h.queue IS NOT NULL))         AS queued_for_call,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM call_outcome o WHERE o.lead_id = ft.lead_id))                           AS call_attempted,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM call_outcome o WHERE o.lead_id = ft.lead_id AND o.connected))           AS connected,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM call_outcome o WHERE o.lead_id = ft.lead_id AND o.disposition = 'enquiry_created')) AS enquiry_created
FROM first_touch ft
LEFT JOIN campaign c ON c.campaign_id = ft.campaign_id
GROUP BY 1, 2, 3, 4;

GRANT SELECT, INSERT, UPDATE ON campaign, campaign_variant TO cover_check_app;
GRANT SELECT ON campaign_funnel_daily TO cover_check_bi;

COMMIT;
