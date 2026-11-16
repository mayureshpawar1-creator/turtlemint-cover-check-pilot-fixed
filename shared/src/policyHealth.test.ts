import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPolicyHealth, FACT_LABEL, type PolicyFactView } from './index';

const fact = (key: keyof typeof FACT_LABEL, value: string | null): PolicyFactView => ({
  key, label: FACT_LABEL[key], value, sourcePage: value ? 1 : null, confidence: 0.95,
  userConfirmed: true, userValue: null,
});

describe('policy health evidence guardrails', () => {
  it('does not treat blank co-pay as zero', () => {
    const health = buildPolicyHealth([fact('copay_percent', '')]);
    assert.equal(health.areas.find((area) => area.id === 'copay')?.status, 'not_found');
  });

  it('treats extracted restoration and no-claim-bonus terms as needing interpretation', () => {
    const health = buildPolicyHealth([
      fact('restoration', 'Restoration available'),
      fact('no_claim_bonus', '10% per year up to 50%'),
    ]);
    assert.equal(health.areas.find((area) => area.id === 'restoration')?.status, 'review');
    assert.equal(health.areas.find((area) => area.id === 'ncb')?.status, 'review');
  });

  it('does not label a waiting period as proof of claim eligibility', () => {
    const health = buildPolicyHealth([
      fact('start_date', '2020-01-01'),
      fact('ped_waiting_months', '36'),
    ], new Date('2026-10-01T00:00:00Z'));
    const waiting = health.areas.find((area) => area.id === 'waiting');
    assert.equal(waiting?.status, 'review');
    assert.match(waiting?.meaning ?? '', /counted from this document’s start date/i);
  });
});
