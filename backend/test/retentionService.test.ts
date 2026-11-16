import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retentionService } from '../src/services/retentionService.js';
import { testDeps } from './helpers.js';

const { deps, pool } = testDeps(() => new Date());
after(async () => { await pool.end(); });

describe('PostgreSQL-backed retention sweep', () => {
  it('continues past a failed oldest batch and retries those objects next sweep', async () => {
    const prefix = 'retention-starvation-test/';
    await pool.query('DELETE FROM policy_document WHERE file_ref LIKE $1', [`${prefix}%`]);

    const lead = await deps.repos.leads.upsertByMobile(`+9196${String(Date.now()).slice(-8)}`);
    const consentId = await deps.repos.consents.grant({
      leadId: lead.lead_id, purpose: 'read_document', noticeVersion: 'v1', noticeLanguage: 'en', method: 'tick',
    });
    const { rows: documents } = await pool.query<{ doc_id: string; file_ref: string }>(
      `INSERT INTO policy_document (lead_id, consent_id, file_ref, original_name, mime, size_bytes, content_sha256, retention_until)
       SELECT $1, $2,
         CASE WHEN n <= 100 THEN $3 || 'failed/' || lpad(n::text, 3, '0') ELSE $3 || 'later.pdf' END,
         'synthetic.pdf', 'application/pdf', 1, repeat('a', 64),
         CASE WHEN n <= 100 THEN now() - interval '2 days' - n * interval '1 second' ELSE now() - interval '1 day' END
       FROM generate_series(1, 101) AS rows(n)
       RETURNING doc_id, file_ref`, [lead.lead_id, consentId, prefix]);
    assert.equal(documents.length, 101);

    const failedDocument = documents.find((doc) => doc.file_ref.endsWith('failed/001'))!;
    const laterDocument = documents.find((doc) => doc.file_ref.endsWith('later.pdf'))!;
    await pool.query(
      `INSERT INTO policy_fact (doc_id, fact_key, value)
       VALUES ($1, 'insurer_name', $3::jsonb), ($2, 'insurer_name', $3::jsonb)`,
      [failedDocument.doc_id, laterDocument.doc_id, JSON.stringify('Synthetic insurer')]);

    let attempts = 0;
    const store = {
      ...deps.store,
      async remove(fileRef: string) {
        attempts++;
        if (fileRef.includes('/failed/')) throw new Error('synthetic object-store failure');
        await deps.store.remove(fileRef);
      },
    };
    const retention = retentionService({ repos: deps.repos, store }, () => {});
    await retention.sweep();

    assert.equal(attempts, 101);
    const { rows: states } = await pool.query<{ file_ref: string; deleted_ts: Date | null }>(
      'SELECT file_ref, deleted_ts FROM policy_document WHERE file_ref LIKE $1', [`${prefix}%`]);
    assert.equal(states.length, 101);
    assert.ok(states.filter((doc) => doc.file_ref.includes('/failed/')).every((doc) => doc.deleted_ts === null));
    assert.ok(states.find((doc) => doc.file_ref.endsWith('later.pdf'))?.deleted_ts);

    const { rows: facts } = await pool.query<{ doc_id: string }>(
      'SELECT doc_id FROM policy_fact WHERE doc_id = ANY($1::uuid[])', [[failedDocument.doc_id, laterDocument.doc_id]]);
    assert.deepEqual(facts.map((fact) => fact.doc_id), [failedDocument.doc_id]);

    attempts = 0;
    await retention.sweep();
    assert.equal(attempts, 100);
  });
});
