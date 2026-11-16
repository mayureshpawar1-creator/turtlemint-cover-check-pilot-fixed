import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFactInput as n } from './factInput';

describe('typed policy details (U5, manual reading)', () => {
  it('reads cover amounts the way people write them', () => {
    for (const [raw, want] of [['5 lakh', '500000'], ['₹5,00,000', '500000'], ['5L', '500000'], ['10', '1000000'], ['1 crore', '10000000'], ['7.5 lakh', '750000'], ['500000', '500000']] as const)
      assert.equal(n('sum_insured_inr', raw), want, raw);
    assert.equal(n('sum_insured_inr', 'lots'), null);
  });
  it('reads Indian dates (day first) and rejects impossible ones', () => {
    assert.equal(n('start_date', '20/11/2025'), '2025-11-20');
    assert.equal(n('end_date', '19-11-26'), '2026-11-19');
    assert.equal(n('end_date', '19 Nov 2026'), '2026-11-19');
    assert.equal(n('end_date', '2026-11-19'), '2026-11-19');
    assert.equal(n('end_date', '31/02/2026'), null);
  });
  it('reads type, co-pay, waiting period and room rent', () => {
    assert.equal(n('policy_type', 'Family Floater'), 'floater');
    assert.equal(n('policy_type', 'my company'), 'group');
    assert.equal(n('copay_percent', '20%'), '20');
    assert.equal(n('copay_percent', 'None'), '0');
    assert.equal(n('ped_waiting_months', '3 years'), '36');
    assert.equal(n('ped_waiting_months', '24 months'), '24');
    assert.equal(n('room_rent_limit', 'no limit'), 'No limit');
    assert.equal(n('members', ''), null);
  });
});
