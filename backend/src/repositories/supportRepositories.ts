import type { EventName, Language, ScreenId } from '@cover-check/shared';
import type { Queryable } from '../db/pool.js';

export const eventRepository = (db: Queryable) => ({
  /** Readiness probe: the database answers. */
  async ping() { await db.query('SELECT 1'); },
  async log(e: { name: EventName; leadId?: string | null; sessionId?: string | null; screenId?: ScreenId | null; props?: Record<string, unknown> }) {
    await db.query('INSERT INTO event (lead_id, session_id, name, screen_id, props) VALUES ($1,$2,$3,$4,$5)',
      [e.leadId ?? null, e.sessionId ?? null, e.name, e.screenId ?? null, JSON.stringify(e.props ?? {})]);
  },
});

export const otpRepository = (db: Queryable) => ({
  async create(o: { leadId: string; mobile: string; codeHash: (otpId: string) => string; purpose: 'upload' | 'call' | 'change_mobile'; ttlSec: number }) {
    const { rows } = await db.query<{ otp_id: string }>(
      `INSERT INTO otp_challenge (lead_id, mobile, code_hash, purpose, expires_ts)
       VALUES ($1, $2, 'pending', $3, now() + make_interval(secs => $4)) RETURNING otp_id`,
      [o.leadId, o.mobile, o.purpose, o.ttlSec]);
    const otpId = rows[0]!.otp_id;
    await db.query('UPDATE otp_challenge SET code_hash = $2 WHERE otp_id = $1', [otpId, o.codeHash(otpId)]);
    return otpId;
  },
  async lastSent(leadId: string) {
    const { rows } = await db.query<{ otp_id: string; mobile: string; sent_ts: Date; attempts: number; expires_ts: Date; code_hash: string; verified_ts: Date | null }>(
      'SELECT * FROM otp_challenge WHERE lead_id = $1 ORDER BY sent_ts DESC LIMIT 1', [leadId]);
    return rows[0] ?? null;
  },
  async sentInLastHour(leadId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM otp_challenge WHERE lead_id = $1 AND sent_ts > now() - interval '1 hour'`, [leadId]);
    return Number(rows[0]?.n ?? 0);
  },
  async claimAttempt(otpId: string, leadId: string, mobile: string, maxAttempts: number): Promise<number | null> {
    const { rows } = await db.query<{ attempts: number }>(
      `UPDATE otp_challenge AS o SET attempts = o.attempts + 1
       WHERE o.otp_id = $1 AND o.lead_id = $2 AND o.mobile = $3
         AND o.attempts < $4 AND o.verified_ts IS NULL AND o.expires_ts > now()
         AND EXISTS (SELECT 1 FROM lead AS l WHERE l.lead_id = o.lead_id AND l.mobile = o.mobile)
       RETURNING o.attempts`, [otpId, leadId, mobile, maxAttempts]);
    return rows[0]?.attempts ?? null;
  },
  async markVerified(otpId: string, leadId: string, mobile: string): Promise<boolean> {
    const { rows } = await db.query<{ otp_id: string }>(
      `UPDATE otp_challenge SET verified_ts = now()
       WHERE otp_id = $1 AND lead_id = $2 AND mobile = $3 AND verified_ts IS NULL
         AND EXISTS (SELECT 1 FROM lead WHERE lead_id = $2 AND mobile = $3)
       RETURNING otp_id`, [otpId, leadId, mobile]);
    return rows.length > 0;
  },
});

export const referenceRepository = (db: Queryable) => ({
  async pincode(pin: string): Promise<{ city: string; state: string } | null> {
    const { rows } = await db.query<{ city: string; state: string }>('SELECT city, state FROM pincode_directory WHERE pincode = $1', [pin]);
    return rows[0] ?? null;
  },
  async notice(version: string, language: Language, purpose: string): Promise<string | null> {
    const { rows } = await db.query<{ body: string }>(
      'SELECT body FROM notice_version WHERE notice_version = $1 AND notice_language = $2 AND purpose = $3', [version, language, purpose]);
    return rows[0]?.body ?? null;
  },
});

export const whatsappRepository = (db: Queryable) => ({
  async record(m: { waMessageId: string; leadId: string; templateId: string; kind: 'summary' | 'cover_summary' | 'reminder'; bodySha256?: string; previewedTs?: Date }) {
    await db.query('INSERT INTO whatsapp_message (wa_message_id, lead_id, template_id, kind, body_sha256, previewed_ts) VALUES ($1,$2,$3,$4,$5,$6)',
      [m.waMessageId, m.leadId, m.templateId, m.kind, m.bodySha256 ?? null, m.previewedTs ?? null]);
  },
  async lastSent(leadId: string): Promise<{ sent_ts: string } | null> {
    const { rows } = await db.query<{ sent_ts: string }>(`SELECT sent_ts FROM whatsapp_message WHERE lead_id = $1 AND kind = 'summary' ORDER BY sent_ts DESC LIMIT 1`, [leadId]);
    return rows[0] ?? null;
  },
});

/** Read model for the telecaller card (view lead_card_source). */
export const leadCardRepository = (db: Queryable) => ({
  async get(leadId: string) {
    const { rows } = await db.query<Record<string, any>>('SELECT * FROM lead_card_source WHERE lead_id = $1', [leadId]);
    return rows[0] ?? null;
  },
});
