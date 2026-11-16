import type { Door } from '@cover-check/shared';
import type { Queryable } from '../db/pool.js';

export interface NewSource {
  leadId: string;
  linkTokenHash: string;
  door: Door;
  waTemplateId?: string;
  waMessageId?: string;
  campaignId?: string;
  creativeId?: string;
  variantId?: string;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string };
  referrer?: string;
  device?: { type?: string; os?: string; browser?: string };
}

/** Query-string values are free text from the URL: keep them short so a long or hostile link can't fail the insert. */
const cut = (v: string | undefined, n: number) => (v ? v.slice(0, n) : null);

export const sourceRepository = (db: Queryable) => ({
  async lockToken(tokenHash: string): Promise<void> {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [tokenHash]);
  },

  async insert(s: NewSource): Promise<string> {
    const { rows } = await db.query<{ source_id: string }>(
      `INSERT INTO source (lead_id, link_token_hash, door, wa_template_id, wa_message_id, campaign_id, creative_id,
                           utm_source, utm_medium, utm_campaign, device_type, os, browser, first_click_ts,
                           variant_id, utm_content, utm_term, referrer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,clock_timestamp(),$14,$15,$16,$17) RETURNING source_id`,
      [s.leadId, s.linkTokenHash, s.door, s.waTemplateId ?? null, s.waMessageId ?? null, s.campaignId ?? null,
        s.creativeId ?? null, cut(s.utm?.source, 120), cut(s.utm?.medium, 120), cut(s.utm?.campaign, 120),
        s.device?.type ?? null, s.device?.os ?? null, s.device?.browser ?? null,
        cut(s.variantId, 32), cut(s.utm?.content, 120), cut(s.utm?.term, 120), cut(s.referrer, 200)]);
    return rows[0]!.source_id;
  },

  /** Resolve a link token (by hash) to its original lead, even if the mobile later changes. */
  async leadForToken(tokenHash: string): Promise<{ lead_id: string; source_id: string } | null> {
    const { rows } = await db.query<{ lead_id: string; source_id: string }>(
      'SELECT lead_id, source_id FROM source WHERE link_token_hash = $1 ORDER BY first_click_ts, source_id LIMIT 1', [tokenHash]);
    return rows[0] ?? null;
  },

  async firstDoor(leadId: string): Promise<Door | null> {
    const { rows } = await db.query<{ door: Door }>(
      'SELECT door FROM source WHERE lead_id = $1 ORDER BY first_click_ts LIMIT 1', [leadId]);
    return rows[0]?.door ?? null;
  },

  /** The link a browser session came from (1.7: rebuilding the bootstrap on reload, without logging a new click). */
  async get(sourceId: string): Promise<{ door: Door; campaign_id: string | null; variant_id: string | null } | null> {
    const { rows } = await db.query<{ door: Door; campaign_id: string | null; variant_id: string | null }>(
      'SELECT door, campaign_id, variant_id FROM source WHERE source_id = $1', [sourceId]);
    return rows[0] ?? null;
  },
});
export type SourceRepository = ReturnType<typeof sourceRepository>;
