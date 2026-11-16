-- 012 Security quick wins (roadmap 1.7, issue S3).
-- web_session: the WhatsApp link token is exchanged for a random session id in an HttpOnly cookie. Only the SHA-256
-- of the id is stored. No PII here; rows expire (expires_ts). revoked_ts is for ops to end a session early.
BEGIN;
SET search_path = cover_check, public;

CREATE TABLE web_session (
  sid_hash     text        PRIMARY KEY CHECK (char_length(sid_hash) = 64),
  lead_id      uuid        NOT NULL REFERENCES lead ON DELETE CASCADE,
  source_id    uuid        NOT NULL REFERENCES source ON DELETE CASCADE,
  created_ts   timestamptz NOT NULL DEFAULT now(),
  expires_ts   timestamptz NOT NULL,
  last_seen_ts timestamptz,
  revoked_ts   timestamptz,
  CHECK (expires_ts > created_ts)
);
CREATE INDEX web_session_lead_idx ON web_session (lead_id);
CREATE INDEX web_session_expires_idx ON web_session (expires_ts);

GRANT SELECT, INSERT, UPDATE, DELETE ON web_session TO cover_check_app;

COMMIT;
