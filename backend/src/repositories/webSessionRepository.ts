import type { Queryable } from '../db/pool.js';

/**
 * Browser sessions (roadmap 1.7, S3). The WhatsApp link token is exchanged once for a random session id held in an
 * HttpOnly cookie; only its SHA-256 is stored. The token then leaves the address bar, history and referrers.
 */
export const webSessionRepository = (db: Queryable) => ({
  async create(s: { sidHash: string; leadId: string; sourceId: string; expiresTs: Date }): Promise<void> {
    await db.query('INSERT INTO web_session (sid_hash, lead_id, source_id, expires_ts) VALUES ($1, $2, $3, $4)',
      [s.sidHash, s.leadId, s.sourceId, s.expiresTs]);
  },

  /** A live session, or null when unknown, expired or revoked. Touches last_seen_ts. */
  async find(sidHash: string, now: Date): Promise<{ lead_id: string; source_id: string } | null> {
    const { rows } = await db.query<{ lead_id: string; source_id: string }>(
      `UPDATE web_session SET last_seen_ts = $2
        WHERE sid_hash = $1 AND expires_ts > $2 AND revoked_ts IS NULL
        RETURNING lead_id, source_id`, [sidHash, now]);
    return rows[0] ?? null;
  },

});
