import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answersFromFacts, buildPolicyBoard, FACT_LABEL, type PolicyFactView } from './index';

const fact = (key: keyof typeof FACT_LABEL, value: string | null, page = 1): PolicyFactView =>
  ({ key, label: FACT_LABEL[key], value, sourcePage: value ? page : null, confidence: 0.95, userConfirmed: true, userValue: null });
const demo = [
  fact('insurer_name', 'Example General Insurance'), fact('product_name', 'Family Health Optima'), fact('policy_type', 'floater'),
  fact('sum_insured_inr', '500000'), fact('members', 'Self (36), Spouse (34), 2 children', 2), fact('start_date', '2025-11-20'),
  fact('end_date', '2026-11-19'), fact('room_rent_limit', '1% of sum insured per day', 3), fact('copay_percent', '0', 3), fact('ped_waiting_months', '36', 3),
];
const today = new Date('2026-10-06T06:00:00Z');

describe('policy board (v5, one-screen upload result)', () => {
  it('reads the family from the policy — the policyholder’s age, not a parent’s', () => {
    const a = answersFromFacts([fact('members', 'Self (44), Spouse (41), 1 son, Mother (68)')]);
    assert.deepEqual([a.age_band, a.adults_count, a.children_count, a.parents_count], ['41_50', 2, 1, 1]);
  });
  it('a draft cover gap triggers review, not an automatic top-up sale', () => {
    const b = buildPolicyBoard(demo, {}, today);
    assert.equal(b.persona.id, 'family');
    assert.equal(b.headline, 'Review a possible ₹15 L difference');
    assert.match(b.note, /^4 people share one ₹5 L sum insured/);
    assert.equal(b.pick.kind, 'check');
    assert.equal(b.pick.reason, 'doc_unvalidated_cover_rule');
    assert.match(b.pick.why, /not an independently validated/);
    assert.equal(b.picks.length, 0);
  });
  it('the same four checks, in the same place, each with plain words and what to do', () => {
    const b = buildPolicyBoard(demo, {}, today);
    assert.deepEqual(b.checks.map((c) => [c.id, c.status, c.value]), [
      ['room_rent', 'risk', '₹5,000/day'], ['waiting', 'watch', 'From Nov 2028'], ['copay', 'good', 'None'], ['renewal', 'watch', 'In 44 days']]);
    assert.match(b.checks[1]!.todo!, /portability/);
    assert.equal(b.checks[0]!.page, 3);
  });
  it('even a policy with no flags is not labelled sufficient before the cover rule is validated', () => {
    const strong = demo.map((f) => f.key === 'sum_insured_inr' ? { ...f, value: '2500000' } : f.key === 'room_rent_limit' ? { ...f, value: 'No limit' } : f);
    const b = buildPolicyBoard(strong, {}, today);
    assert.equal(b.pick.kind, 'check');
    assert.equal(b.pick.reason, 'doc_review_required');
    assert.match(b.pick.why, /does not establish that the cover amount is sufficient/);
    assert.equal(b.picks.length, 0);
  });
  it('a room-rent cap triggers policy review, not an unverified product recommendation', () => {
    const b = buildPolicyBoard(demo.map((f) => f.key === 'sum_insured_inr' ? { ...f, value: '2500000' } : f), {}, today);
    assert.equal(b.pick.kind, 'check');
    assert.equal(b.pick.reason, 'doc_review_required');
    assert.match(b.pick.why, /room-rent limit/);
  });
  it('anything missing stays "Not found" — never guessed', () => {
    const b = buildPolicyBoard(demo.filter((f) => f.key !== 'copay_percent' && f.key !== 'ped_waiting_months'), {}, today);
    assert.deepEqual(b.checks.filter((c) => c.status === 'unknown').map((c) => c.id), ['waiting', 'copay']);
  });
  it('missing decision-critical facts never produce a keep or purchase recommendation', () => {
    const incomplete = demo.filter((f) => f.key !== 'sum_insured_inr' && f.key !== 'room_rent_limit');
    const b = buildPolicyBoard(incomplete, {}, today);
    assert.equal(b.pick.kind, 'check');
    assert.equal(b.pick.reason, 'doc_insufficient_evidence');
    assert.equal(b.headline, 'A few details need checking');
    assert.equal(b.cover.alert?.text, 'Cover amount not found');
    assert.equal(b.picks.length, 0);
    assert.doesNotMatch(b.pick.why, /no cap or co-pay found/i);
  });
  it('empty co-pay text is unknown, not treated as zero', () => {
    const b = buildPolicyBoard(demo.map((f) => f.key === 'copay_percent' ? { ...f, value: '' } : f), {}, today);
    assert.equal(b.checks.find((c) => c.id === 'copay')?.status, 'unknown');
    assert.equal(b.pick.kind, 'check');
  });
});
