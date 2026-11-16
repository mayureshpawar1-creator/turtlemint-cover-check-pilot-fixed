import type { PlanRec, PlanType } from '@cover-check/shared';
import type { Queryable } from '../db/pool.js';

export interface RecommendationRow { plan_type: PlanType; origin: 'quiz' | 'document'; reason: string; clicked_ts: string | null; advisor_requested_ts: string | null }

/** Recommendations shown/opened and checklist boxes ticked. */
export const valueRepository = (db: Queryable) => ({
  async recordShown(leadId: string, origin: 'quiz' | 'document', recs: PlanRec[]): Promise<void> {
    for (const [i, r] of recs.entries()) {
      await db.query(
        `INSERT INTO recommendation (lead_id, origin, plan_type, reason, url, rank) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (lead_id, origin, plan_type) DO UPDATE SET reason = EXCLUDED.reason, url = EXCLUDED.url, rank = EXCLUDED.rank`,
        [leadId, origin, r.type, r.reason, r.url, i + 1]);
    }
  },

  async markClicked(leadId: string, origin: 'quiz' | 'document', type: PlanType): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE recommendation SET clicked_ts = COALESCE(clicked_ts, now()), click_count = click_count + 1
       WHERE lead_id = $1 AND origin = $2 AND plan_type = $3`, [leadId, origin, type]);
    return (rowCount ?? 0) > 0;
  },

  async markAdvisorRequested(leadId: string, type: PlanType): Promise<void> {
    await db.query('UPDATE recommendation SET advisor_requested_ts = now() WHERE lead_id = $1 AND plan_type = $2', [leadId, type]);
  },

  async forLead(leadId: string): Promise<RecommendationRow[]> {
    const { rows } = await db.query<RecommendationRow>(
      'SELECT plan_type, origin, reason, clicked_ts, advisor_requested_ts FROM recommendation WHERE lead_id = $1 ORDER BY origin, rank', [leadId]);
    return rows;
  },

  async markChecklist(leadId: string, itemId: string, statusShown: 'check' | 'unknown', marked: boolean): Promise<void> {
    await db.query(
      `INSERT INTO checklist_mark (lead_id, item_id, status_shown, marked) VALUES ($1,$2,$3,$4)
       ON CONFLICT (lead_id, item_id) DO UPDATE SET marked = EXCLUDED.marked, marked_ts = clock_timestamp()`,
      [leadId, itemId, statusShown, marked]);
  },

  async checklistMarks(leadId: string): Promise<Set<string>> {
    const { rows } = await db.query<{ item_id: string }>('SELECT item_id FROM checklist_mark WHERE lead_id = $1 AND marked', [leadId]);
    return new Set(rows.map((r) => r.item_id));
  },
});
export type ValueRepository = ReturnType<typeof valueRepository>;
