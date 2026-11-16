import type { Language, LandingCopy } from '@cover-check/shared';
import type { Queryable } from '../db/pool.js';

export type CampaignChannel = 'whatsapp' | 'sms' | 'email' | 'web' | 'partner' | 'other';
export type CampaignStatus = 'draft' | 'live' | 'paused' | 'ended';

export interface CampaignRow {
  campaign_id: string; name: string; objective: string | null; audience: string | null; channel: CampaignChannel;
  wa_template_ref: string | null; owner: string | null; status: CampaignStatus; starts_on: string | null; ends_on: string | null;
}

export interface CampaignInput {
  campaignId: string; name: string; objective?: string; audience?: string; channel?: CampaignChannel;
  waTemplateRef?: string; owner?: string; status?: CampaignStatus; startsOn?: string; endsOn?: string;
  variants?: { variantId: string; description?: string; landingLanguage?: Language; landingHeadline?: string; landingSub?: string }[];
}

export const campaignRepository = (db: Queryable) => ({
  /** Create or update a campaign and (re)define the variants given. Variants not listed are left as they are. */
  async upsert(c: CampaignInput): Promise<CampaignRow> {
    const { rows } = await db.query<CampaignRow>(
      `INSERT INTO campaign (campaign_id, name, objective, audience, channel, wa_template_ref, owner, status, starts_on, ends_on)
       VALUES ($1,$2,$3,$4,coalesce($5,'whatsapp'),$6,$7,coalesce($8,'draft'),$9,$10)
       ON CONFLICT (campaign_id) DO UPDATE SET name = EXCLUDED.name, objective = EXCLUDED.objective, audience = EXCLUDED.audience,
         channel = EXCLUDED.channel, wa_template_ref = EXCLUDED.wa_template_ref, owner = EXCLUDED.owner, status = EXCLUDED.status,
         starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on
       RETURNING campaign_id, name, objective, audience, channel, wa_template_ref, owner, status,
                 starts_on::text AS starts_on, ends_on::text AS ends_on`,
      [c.campaignId, c.name, c.objective ?? null, c.audience ?? null, c.channel ?? null, c.waTemplateRef ?? null, c.owner ?? null,
        c.status ?? null, c.startsOn ?? null, c.endsOn ?? null]);
    for (const v of c.variants ?? []) {
      await db.query(
        `INSERT INTO campaign_variant (campaign_id, variant_id, description, landing_language, landing_headline, landing_sub)
         VALUES ($1,$2,$3,coalesce($4,'en')::language_t,$5,$6)
         ON CONFLICT (campaign_id, variant_id) DO UPDATE SET description = EXCLUDED.description,
           landing_language = EXCLUDED.landing_language, landing_headline = EXCLUDED.landing_headline, landing_sub = EXCLUDED.landing_sub`,
        [c.campaignId, v.variantId, v.description ?? null, v.landingLanguage ?? null, v.landingHeadline ?? null, v.landingSub ?? null]);
    }
    return rows[0]!;
  },

  async get(campaignId: string): Promise<CampaignRow | null> {
    const { rows } = await db.query<CampaignRow>(
      `SELECT campaign_id, name, objective, audience, channel, wa_template_ref, owner, status,
              starts_on::text AS starts_on, ends_on::text AS ends_on FROM campaign WHERE campaign_id = $1`, [campaignId]);
    return rows[0] ?? null;
  },

  async hasVariant(campaignId: string, variantId: string): Promise<boolean> {
    const { rowCount } = await db.query('SELECT 1 FROM campaign_variant WHERE campaign_id = $1 AND variant_id = $2', [campaignId, variantId]);
    return (rowCount ?? 0) > 0;
  },

  /** Landing copy for a link: the variant's, if it has a headline. Null means "use the door's default copy". */
  async landing(campaignId: string, variantId: string | null): Promise<{ channel: CampaignChannel; landing: LandingCopy | null } | null> {
    const { rows } = await db.query<{ channel: CampaignChannel; landing_language: Language | null; landing_headline: string | null; landing_sub: string | null }>(
      `SELECT c.channel, v.landing_language, v.landing_headline, v.landing_sub
       FROM campaign c LEFT JOIN campaign_variant v ON v.campaign_id = c.campaign_id AND v.variant_id = $2
       WHERE c.campaign_id = $1`, [campaignId, variantId]);
    const r = rows[0];
    if (!r) return null;
    return { channel: r.channel,
      landing: r.landing_headline ? { headline: r.landing_headline, sub: r.landing_sub, language: r.landing_language ?? 'en' } : null };
  },

  /** First-touch funnel rows for one campaign (from the campaign_funnel_daily view). */
  async funnel(campaignId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await db.query('SELECT * FROM campaign_funnel_daily WHERE campaign_id = $1 ORDER BY day, variant_id', [campaignId]);
    return rows;
  },
});
export type CampaignRepository = ReturnType<typeof campaignRepository>;
