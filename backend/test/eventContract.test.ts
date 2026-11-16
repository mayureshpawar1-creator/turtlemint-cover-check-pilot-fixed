/** One event contract (roadmap 1.2): the code, the database and the browser agree on event names. */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { CLIENT_EVENT_NAMES, EVENT_NAMES, SERVER_EVENT_NAMES, toClientEvent } from '@cover-check/shared';
import { createApp } from '../src/app.js';
import { journeyService } from '../src/services/journeyService.js';
import { testDeps } from './helpers.js';

const root = resolve(import.meta.dirname, '../..');

/** Names in the most recent migration that (re)defines event_name_check. */
function dbEventNames(): string[] {
  const dir = join(root, 'data/migrations');
  const file = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().reverse()
    .find((f) => readFileSync(join(dir, f), 'utf8').includes('event_name_check CHECK (name IN ('));
  assert.ok(file, 'no migration defines event_name_check');
  const sql = readFileSync(join(dir, file!), 'utf8');
  const block = sql.slice(sql.indexOf('event_name_check CHECK (name IN ('));
  return [...block.slice(0, block.indexOf('));')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

/** Every literal event name the backend logs itself (`name: '…'` passed to events.log). */
function backendLoggedNames(): string[] {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.ts')) for (const m of readFileSync(p, 'utf8').matchAll(/events\.log\(\{\s*name:\s*'([a-z_]+)'/g)) out.add(m[1]!);
    }
  };
  walk(join(root, 'backend/src'));
  return [...out];
}

describe('event contract', () => {
  it('the database CHECK lists exactly the shared EVENT_NAMES', () => {
    assert.deepEqual([...dbEventNames()].sort(), [...EVENT_NAMES].sort());
  });

  it('server and client event names never overlap', () => {
    const server = new Set<string>(SERVER_EVENT_NAMES);
    assert.deepEqual(CLIENT_EVENT_NAMES.filter((n) => server.has(n)), []);
  });

  it('everything the backend logs is a server milestone', () => {
    const server = new Set<string>(SERVER_EVENT_NAMES);
    const logged = backendLoggedNames();
    assert.ok(logged.length >= 15, `expected to find the backend's events, found ${logged.length}`);
    assert.deepEqual(logged.filter((n) => !server.has(n)), []);
  });

  it('the browser never resends a milestone; a next-action click becomes cta_clicked', () => {
    assert.equal(toClientEvent('quiz_completed'), null);
    assert.equal(toClientEvent('call_requested'), null);
    assert.equal(toClientEvent('next_action_selected'), 'cta_clicked');
    assert.equal(toClientEvent('tool_used'), 'tool_used');
    for (const n of SERVER_EVENT_NAMES) assert.notEqual(toClientEvent(n), n);
  });
});

describe('POST /events (PostgreSQL)', () => {
  const { deps, pool } = testDeps(() => new Date());
  let server: Server;
  let base = '';
  let token = '';
  let leadId = '';

  before(async () => {
    const mobile = `+9197${String(Date.now()).slice(-8)}`;
    token = deps.tokens.issue({ m: mobile, d: 'check' }, Date.now());
    leadId = (await journeyService(deps).openLink(token, { type: 'mobile' })).leadId;
    const app = createApp(deps, { agentKey: 'test-agent-key-test-agent-key', corsOrigin: 'http://localhost' });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  after(async () => { server.close(); await pool.end(); });

  const post = (body: unknown) => fetch(`${base}/events`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const rejects = async (name: string) =>
    Number((await pool.query('SELECT count(*) FROM event_reject WHERE name = $1', [name])).rows[0].count);

  it('stores a client interaction event', async () => {
    const res = await post({ name: 'tool_used', screenId: 'S7', props: { tool: 'synthetic' } });
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { ok: true, accepted: true });
    const { rows } = await pool.query("SELECT count(*) FROM event WHERE lead_id = $1 AND name = 'tool_used'", [leadId]);
    assert.equal(Number(rows[0].count), 1);
  });

  it('refuses a server milestone from the browser and records why', async () => {
    const before = await rejects('quiz_completed');
    const res = await post({ name: 'quiz_completed', screenId: 'S1' });
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { ok: true, accepted: false });
    assert.equal(await rejects('quiz_completed'), before + 1);
    const { rows } = await pool.query("SELECT count(*) FROM event WHERE lead_id = $1 AND name = 'quiz_completed'", [leadId]);
    assert.equal(Number(rows[0].count), 0);
  });

  it('records an unknown name instead of dropping it, without storing props', async () => {
    const before = await rejects('made_up_event');
    const res = await post({ name: 'made_up_event', props: { secret: 'should-not-be-stored' } });
    assert.equal(res.status, 202);
    assert.equal(await rejects('made_up_event'), before + 1);
    const { rows } = await pool.query("SELECT reason FROM event_reject WHERE name = 'made_up_event' ORDER BY reject_id DESC LIMIT 1");
    assert.match(rows[0].reason, /^name: /);
    assert.doesNotMatch(JSON.stringify(rows[0]), /should-not-be-stored/);
  });
});
