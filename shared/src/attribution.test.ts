import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeUrl, withUtm } from './planCatalog';
import { recommendPlans } from './recommendations';

test('outbound plan links no longer carry a hard-coded campaign', () => {
  const url = withUtm('https://www.turtlemintinsurance.com/health-insurance/', 'family_floater', 'quiz');
  assert.doesNotMatch(url, /cover_fest/);
  assert.match(url, /utm_source=cover_check/);
  assert.match(url, /utm_content=quiz_family_floater/);
  for (const r of recommendPlans({ situation: 'none', adults_count: 2, children_count: 1, parents_count: 0, age_band: '31_40', premium_comfort: '20_35k', city_tier: 'metro' }))
    assert.doesNotMatch(r.url, /cover_fest/);
});

test("attributeUrl stamps the visitor's campaign, channel and variant, keeping the other tags", () => {
  const base = withUtm('https://www.turtlemintinsurance.com/health-insurance/?ref=x', 'individual', 'quiz');
  const u = new URL(attributeUrl(base, { campaignId: 'diwali-parents-2026', variantId: 'b', channel: 'whatsapp' }));
  assert.equal(u.searchParams.get('utm_campaign'), 'diwali-parents-2026');
  assert.equal(u.searchParams.get('utm_medium'), 'whatsapp');
  assert.equal(u.searchParams.get('utm_term'), 'b');
  assert.equal(u.searchParams.get('utm_source'), 'cover_check');
  assert.equal(u.searchParams.get('utm_content'), 'quiz_individual');
  assert.equal(u.searchParams.get('ref'), 'x');
});

test('attributeUrl leaves a link alone when there is no campaign, or the URL is not absolute', () => {
  const base = withUtm('https://www.turtlemintinsurance.com/x/', 'individual', 'quiz');
  assert.equal(attributeUrl(base, { campaignId: null, variantId: null, channel: null }), base);
  assert.equal(attributeUrl(base, null), base);
  assert.equal(attributeUrl('/relative/path', { campaignId: 'c1', variantId: null, channel: null }), '/relative/path');
});
