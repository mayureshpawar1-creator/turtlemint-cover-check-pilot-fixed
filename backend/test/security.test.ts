/** Roadmap 1.7 — security quick wins: session cookie (S3), webhook secret by header only (S7), least privilege (S6), TLS CA (S8). */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { env, productionProblems } from '../src/config/env.js';
import { leastPrivilegeProblems } from '../src/db/privileges.js';
import type { Queryable } from '../src/db/pool.js';
import { testDeps } from './helpers.js';

const AGENT = 'test-agent-key-test-agent-key';
const WEBHOOK = 'test-webhook-secret-123456';
const suffix = String(Date.now()).slice(-7);

describe('security quick wins (PostgreSQL)', () => {
  let clock = new Date();
  const { deps, pool } = testDeps(() => clock);
  let server: Server; let base = '';
  let cookie = ''; let leadId = '';

  before(() => {
    server = createApp(deps, { agentKey: AGENT, corsOrigin: 'http://localhost', webhookSecret: WEBHOOK, sessionHours: 2 }).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  after(async () => { server.close(); await pool.end(); });

  it('opening the WhatsApp link sets an HttpOnly, SameSite, Secure session cookie scoped to the API', async () => {
    const token = deps.tokens.issue({ m: `+9197${suffix}1`, d: 'check' });
    const res = await fetch(`${base}/link/${token}`);
    assert.equal(res.status, 200);
    leadId = (await res.json()).leadId;
    const set = res.headers.get('set-cookie') ?? '';
    assert.match(set, /^cc_sid=[A-Za-z0-9_-]{43};/);
    for (const flag of [/HttpOnly/i, /SameSite=Lax/i, /Secure/i, /Path=\/api/i, /Expires=/i]) assert.match(set, flag);
    cookie = set.split(';')[0]!;
    const stored = await pool.query('SELECT sid_hash FROM cover_check.web_session WHERE lead_id = $1', [leadId]);
    assert.equal(stored.rowCount, 1);
    assert.notEqual(stored.rows[0].sid_hash, cookie.split('=')[1], 'only the hash is stored');
  });

  it('the cookie alone works: reload bootstrap (no new click logged) and customer calls', async () => {
    const clicks = async () => Number((await pool.query(`SELECT count(*) FROM cover_check.event WHERE lead_id = $1 AND name = 'link_clicked'`, [leadId])).rows[0].count);
    const before = await clicks();
    const me = await fetch(`${base}/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    const boot = await me.json();
    assert.deepEqual([boot.leadId, boot.door], [leadId, 'check']);
    assert.equal(await clicks(), before, 'a reload is not a new click');
    const start = await fetch(`${base}/quiz/sessions`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(start.status, 200);
  });

  it('no cookie, a forged cookie or an expired session is refused', async () => {
    assert.equal((await fetch(`${base}/me`)).status, 401);
    assert.equal((await fetch(`${base}/me`, { headers: { cookie: 'cc_sid=forged' } })).status, 401);
    clock = new Date(clock.getTime() + 3 * 3_600_000); // session lasts 2 hours in this test
    assert.equal((await fetch(`${base}/me`, { headers: { cookie } })).status, 401);
    clock = new Date();
  });

  it('webhook secret: header only, never the URL', async () => {
    const body = JSON.stringify({ payload: { source: '919000000000', payload: { text: 'hello' } } });
    const post = (path: string, headers: Record<string, string> = {}) =>
      fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
    assert.equal((await post(`/webhooks/whatsapp?secret=${WEBHOOK}`)).status, 403);
    assert.equal((await post('/webhooks/whatsapp', { 'x-webhook-secret': 'wrong' })).status, 403);
    assert.equal((await post('/webhooks/whatsapp', { 'x-webhook-secret': WEBHOOK })).status, 200);
  });

  it('least privilege: a superuser login is refused; a cover_check_app member is accepted', async () => {
    const c = await pool.connect();
    try {
      assert.ok((await leastPrivilegeProblems(c as unknown as Queryable)).some((p) => /superuser/.test(p)), 'tests run as postgres');
      await c.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cc_test_app') THEN
                       CREATE ROLE cc_test_app NOLOGIN IN ROLE cover_check_app; END IF; END $$`);
      await c.query('SET ROLE cc_test_app');
      assert.deepEqual(await leastPrivilegeProblems(c as unknown as Queryable), []);
    } finally { await c.query('RESET ROLE'); c.release(); }
  });

  it('production config: verified TLS, separate migration login, short link lifetime', () => {
    const prod = { ...env, NODE_ENV: 'production' as const, DATABASE_SSL: 'require' as const, DATABASE_SSL_CA: undefined };
    assert.ok(productionProblems(prod).some((p) => /DATABASE_SSL_CA/.test(p)));
    assert.ok(!productionProblems({ ...prod, DATABASE_SSL_CA: '/etc/ssl/rds.pem' }).some((p) => /DATABASE_SSL_CA/.test(p)));
    assert.ok(productionProblems({ ...prod, MIGRATION_DATABASE_URL: prod.DATABASE_URL }).some((p) => /least-privileged/.test(p)));
    assert.ok(productionProblems({ ...prod, LINK_TOKEN_TTL_DAYS: 30 }).some((p) => /LINK_TOKEN_TTL_DAYS/.test(p)));
    assert.equal(env.LINK_TOKEN_TTL_DAYS, 7);
  });
});
