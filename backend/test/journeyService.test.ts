import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { journeyService } from '../src/services/journeyService.js';
import type { Deps } from '../src/services/deps.js';
import type { Repos } from '../src/repositories/index.js';
import type { LeadRow } from '../src/repositories/leadRepository.js';

const token = 'signed-test-link';
const tokenHash = 'hashed-test-link';
const originalMobile = '+919812345678';
const currentMobile = '+919876543210';

function fixture(boundLeadId: string | null) {
  const calls: string[] = [];
  const lead: LeadRow = {
    lead_id: boundLeadId ?? 'new-lead',
    mobile: boundLeadId ? currentMobile : originalMobile,
    mobile_confirmed: true,
    mobile_verified: boundLeadId !== null,
    first_name: 'Test',
    pincode: null,
    city: null,
    state: null,
    language: 'en',
    lead_state: 'incomplete',
    priority: null,
    do_not_contact: false,
  };
  const repos = {
    sources: {
      async lockToken(hash: string) {
        assert.equal(hash, tokenHash);
        calls.push('lock');
      },
      async leadForToken(hash: string) {
        assert.equal(hash, tokenHash);
        calls.push('resolve');
        return boundLeadId ? { lead_id: boundLeadId, source_id: 'prior-source' } : null;
      },
      async insert(source: { leadId: string; linkTokenHash: string }) {
        calls.push('insert');
        assert.equal(source.leadId, lead.lead_id);
        assert.equal(source.linkTokenHash, tokenHash);
        return 'new-source';
      },
    },
    leads: {
      async get(id: string) {
        calls.push('get');
        return id === lead.lead_id ? lead : null;
      },
      async upsertByMobile(mobile: string) {
        calls.push('upsert');
        assert.equal(mobile, originalMobile);
        return lead;
      },
    },
    events: { async log() { calls.push('event'); } },
    quiz: { async openSession() { return null; } },
  };
  const deps = {
    repos,
    tx: async (fn: (r: Repos) => Promise<unknown>) => fn(repos as unknown as Repos),
    tokens: {
      verify: () => ({ m: originalMobile, d: 'check', exp: 1_800_000_000 }),
      hash: () => tokenHash,
    },
    now: () => new Date('2026-10-27T10:00:00Z'),
    config: { noticeVersion: 'notice-v1' },
  } as unknown as Deps;
  return { service: journeyService(deps), calls, lead };
}

describe('link-to-lead continuity', () => {
  it('reuses the lead already bound to a link after its mobile changes', async () => {
    const { service, calls, lead } = fixture('original-lead');
    const result = await service.openLink(token, { type: 'mobile', os: 'android' });
    assert.equal(result.leadId, 'original-lead');
    assert.equal(result.maskedMobile, '+91 98••• ••210');
    assert.equal(lead.mobile, currentMobile);
    assert.deepEqual(calls.slice(0, 4), ['lock', 'resolve', 'get', 'insert']);
    assert.equal(calls.includes('upsert'), false);
  });

  it('creates the initial mobile-based lead when the token has no prior binding', async () => {
    const { service, calls } = fixture(null);
    const result = await service.openLink(token, { type: 'mobile', os: 'android' });
    assert.equal(result.leadId, 'new-lead');
    assert.deepEqual(calls.slice(0, 4), ['lock', 'resolve', 'upsert', 'insert']);
  });
});
