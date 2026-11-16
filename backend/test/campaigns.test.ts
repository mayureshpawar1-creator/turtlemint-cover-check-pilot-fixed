/** 1.3 Campaigns and attribution v1, against PostgreSQL. Synthetic numbers and campaigns only. */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { journeyService } from '../src/services/journeyService.js';
import { testDeps } from './helpers.js';

const AGENT = 'test-agent-key-test-agent-key';
const suffix = String(Date.now()).slice(-6);
const CAMPAIGN = `test-parents-${suffix}`;

describe('campaigns and attribution (PostgreSQL)', () => {
  const { deps, pool } = testDeps(() => new Date());
  const journey = journeyService(deps);
  let server: Server; let base = '';
  const mobile = (n: number) => `+9196${suffix}${String(n).padStart(2, '0')}`;
  const ops = (path: string, body?: unknown) => fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'x-agent-key': AGENT, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });

  before(() => {
    server = createApp(deps, { agentKey: AGENT, corsOrigin: 'http://localhost' }).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  after(async () => { server.close(); await pool.end(); });

  it('registers a campaign with two variants', async () => {
    const res = await ops('/ops/campaigns', { campaignId: CAMPAIGN, name: 'Parents cover test', channel: 'whatsapp', status: 'live',
      variants: [{ variantId: 'a', landingHeadline: 'Is your parents’ cover enough?', landingSub: 'Check in 20 seconds' }, { variantId: 'b' }] });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).campaign_id, CAMPAIGN);
  });

  it('refuses a link for an unregistered campaign or variant', async () => {
    const bad = await ops('/ops/links', { mobile: mobile(1), door: 'check', campaignId: 'no-such-campaign' });
    assert.equal(bad.status, 422);
    const badVariant = await ops('/ops/links', { mobile: mobile(1), door: 'check', campaignId: CAMPAIGN, variantId: 'zz' });
    assert.equal(badVariant.status, 422);
  });

  it('a variant link shows its landing copy and returns the attribution', async () => {
    const { token } = await (await ops('/ops/links', { mobile: mobile(2), door: 'check', campaignId: CAMPAIGN, variantId: 'a' })).json();
    const boot = await journey.openLink(token, { type: 'mobile' }, { utm_source: 'whatsapp', utm_content: 'creative-1', utm_term: 'parents' }, 'https://wa.me/');
    assert.deepEqual(boot.attribution, { campaignId: CAMPAIGN, variantId: 'a', channel: 'whatsapp' });
    assert.deepEqual(boot.landing, { headline: 'Is your parents’ cover enough?', sub: 'Check in 20 seconds', language: 'en' });
    const { rows } = await pool.query('SELECT campaign_id, variant_id, utm_source, utm_content, utm_term, referrer FROM source WHERE source_id = $1', [boot.sourceId]);
    assert.deepEqual(rows[0], { campaign_id: CAMPAIGN, variant_id: 'a', utm_source: 'whatsapp', utm_content: 'creative-1', utm_term: 'parents', referrer: 'https://wa.me/' });
  });

  it('a variant without copy falls back to the door text; long UTM values are cut, not rejected', async () => {
    const { token } = await (await ops('/ops/links', { mobile: mobile(3), door: 'get', campaignId: CAMPAIGN, variantId: 'b' })).json();
    const boot = await journey.openLink(token, { type: 'mobile' }, { utm_content: 'x'.repeat(500) });
    assert.equal(boot.landing, null);
    assert.equal(boot.attribution.variantId, 'b');
    const { rows } = await pool.query('SELECT char_length(utm_content) AS n FROM source WHERE source_id = $1', [boot.sourceId]);
    assert.equal(rows[0].n, 120);
  });

  it('a token naming an unregistered campaign (an old link) still opens', async () => {
    const token = deps.tokens.issue({ m: mobile(4), d: 'check', c: 'legacy-campaign' }, Date.now());
    const boot = await journey.openLink(token, { type: 'mobile' });
    assert.equal(boot.attribution.campaignId, 'legacy-campaign');
    assert.equal(boot.attribution.channel, null);
    assert.equal(boot.landing, null);
  });

  it('the campaign funnel counts each lead once, per variant, from link open on', async () => {
    const res = await ops(`/ops/campaigns/${CAMPAIGN}/funnel`);
    assert.equal(res.status, 200);
    const rows = await res.json() as { variant_id: string; opened_link: string; registered: boolean; started: string }[];
    const byVariant = Object.fromEntries(rows.map((r) => [r.variant_id, r]));
    assert.equal(Number(byVariant.a!.opened_link), 1);
    assert.equal(Number(byVariant.b!.opened_link), 1);
    assert.ok(rows.every((r) => r.registered));
    assert.equal(Number(byVariant.a!.started), 0);
    assert.equal((await ops('/ops/campaigns/no-such-campaign/funnel')).status, 404);
  });
});
