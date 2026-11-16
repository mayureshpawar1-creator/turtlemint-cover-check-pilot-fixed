import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanBoard, inr, pruneAnswers, recommendPlans, type QuizAnswers } from './index';

const base: QuizAnswers = { adults_count: 2, children_count: 2, parents_count: 0, age_band: '31_40', premium_comfort: '20_35k', city_tier: 'metro' };

describe('cover plan board (v5, persona-aware)', () => {
  it('no cover: family floater for the whole family; no term or crisis blocks (D3b)', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, situation: 'none' }), 'Priya');
    assert.equal(b.eyebrow, 'For Priya · A growing family');
    assert.equal(b.headline, 'Protect your kids’ future');
    assert.equal(b.profile, 'You + partner · 2 kids · 31–40 · Metro');
    assert.ok(!('term' in b) && !('crisis' in b));
    assert.deepEqual([b.health.needLakh, b.health.haveLabel, b.health.pct], [20, 'None', 0]);
    assert.equal(b.health.alert!.text, 'Every hospital bill is yours today');
    assert.equal(b.healthPick.type, 'family_floater');
    assert.match(b.healthPick.why, /all 4 of you/);
    assert.deepEqual(b.picks.map((p) => p.type), ['family_floater']);
  });
  it('own policy short of need: super top-up for the gap', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, situation: 'own', sum_insured_band: '3_5' }));
    assert.deepEqual([b.health.haveLakh, b.health.pct], [5, 25]);
    assert.equal(b.health.alert!.text, '₹15 L of a big bill would be yours');
    assert.deepEqual([b.healthPick.type, b.healthPick.amount], ['super_top_up', '+₹15 L']);
  });
  it('company only: the job risk comes first, and the pick is a personal plan', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, adults_count: 1, children_count: 0, situation: 'group', personal_policy_besides_group: 'no', sum_insured_band: '3_5' }));
    assert.equal(b.health.alert!.text, '₹0 cover the day you leave your job');
    assert.equal(b.healthPick.type, 'individual');
  });
  it('B5: parents get their own plan only when they are 60+', () => {
    const old = buildPlanBoard(pruneAnswers({ ...base, situation: 'none', parents_count: 2, parents_age_band: '60_70' }));
    assert.equal(old.parentsPick!.type, 'senior_citizen');
    const young = buildPlanBoard(pruneAnswers({ ...base, situation: 'none', parents_count: 2, parents_age_band: 'u60' }));
    assert.equal(young.parentsPick, null, 'parents under 60 stay on the family plan');
    assert.ok(!young.picks.some((p) => p.type === 'senior_citizen'));
    // a v4 session never asked parents' age: we no longer assume 60+
    assert.equal(buildPlanBoard({ ...base, situation: 'none', parents_count: 2, members: ['self', 'spouse', 'children', 'parents'] }).parentsPick, null);
  });
  it('61+: a senior plan, and never a term or crisis pick', () => {
    const s = buildPlanBoard(pruneAnswers({ ...base, adults_count: 1, children_count: 0, situation: 'none', age_band: '61p' }));
    assert.equal(s.healthPick.type, 'senior_citizen');
    assert.ok(!s.picks.some((p) => p.type === 'term_life' || p.type === 'critical_illness'));
  });
  it('the life / critical-illness interest answer never changes the advice', () => {
    const a = pruneAnswers({ ...base, situation: 'none' });
    const plain = buildPlanBoard(a);
    for (const v of ['yes', 'later', 'no'] as const) {
      const b = buildPlanBoard(pruneAnswers({ ...a, other_protection_interest: v }));
      assert.deepEqual([b.headline, b.health, b.picks.map((p) => [p.type, p.amount])], [plain.headline, plain.health, plain.picks.map((p) => [p.type, p.amount])]);
    }
  });
  it('no price until Turtlemint enters one', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, situation: 'none' }));
    assert.ok(b.picks.every((p) => p.price === null));
  });
  it('what is recorded as shown is exactly the board', () => {
    const a = pruneAnswers({ ...base, situation: 'none', parents_count: 1, parents_age_band: '70p' });
    assert.deepEqual(recommendPlans(a).map((r) => r.type), buildPlanBoard(a).picks.map((p) => p.type));
  });
  it('formats lakh and crore', () => {
    assert.deepEqual([inr(4_000_000), inr(12_500_000), inr(20_000_000)], ['₹40 L', '₹1.25 Cr', '₹2 Cr']);
  });
});

describe('personas — the same five answers, different lives', () => {
  const none = (p: QuizAnswers) => buildPlanBoard(pruneAnswers({ situation: 'none', premium_comfort: '20_35k', city_tier: 'metro', adults_count: 1, children_count: 0, parents_count: 0, ...p }));
  it('maps life stage to a persona', () => {
    const ids = [
      none({ age_band: '18_30' }), none({ age_band: '31_40' }), none({ age_band: '31_40', adults_count: 2 }),
      none({ age_band: '31_40', adults_count: 2, children_count: 1 }), none({ age_band: '41_50', children_count: 2, parents_count: 2, parents_age_band: '70p' }),
      none({ age_band: '31_40', parents_count: 1, parents_age_band: '60_70' }), none({ age_band: '41_50', adults_count: 2 }), none({ age_band: '51_60' }), none({ age_band: '61p' }),
    ].map((b) => b.persona.id);
    assert.deepEqual(ids, ['starter', 'solo', 'couple', 'family', 'sandwich', 'caregiver', 'midlife', 'pre_retire', 'senior']);
  });
  it('parents under 60 are not pushed to a separate plan', () => {
    const b = none({ age_band: '31_40', parents_count: 1, parents_age_band: 'u60' });
    assert.equal(b.persona.id, 'caregiver');
    assert.match(b.note, /can usually join a family floater/);
    assert.equal(b.parentsPick, null);
  });
  it('no persona copy mentions term or crisis cover', () => {
    const ages = ['18_30', '31_40', '41_50', '51_60', '61p'] as const;
    for (const age_band of ages) for (const kids of [0, 2]) for (const parents of [0, 1]) {
      const b = none({ age_band, children_count: kids, parents_count: parents, ...(parents ? { parents_age_band: '70p' as const } : {}) });
      assert.doesNotMatch(`${b.headline} ${b.note} ${b.persona.noteHave}`, /term|crisis|critical/i);
    }
  });
  it('a well-covered person is told to keep their plan — nothing to buy', () => {
    const b = buildPlanBoard(pruneAnswers({ situation: 'own', sum_insured_band: '25p', age_band: '31_40', adults_count: 2, children_count: 0, parents_count: 0, premium_comfort: '20_35k', city_tier: 'other' }));
    assert.equal(b.healthPick.kind, 'keep');
    assert.equal(b.health.priority, 'done');
    assert.equal(b.headline, 'Your health cover looks good');
    assert.match(b.healthPick.why, /We won’t sell you more/);
    assert.ok(!b.picks.some((p) => p.reason === 'keep_health'));
  });
  it('not sure of their cover: read the policy before suggesting anything', () => {
    const b = buildPlanBoard(pruneAnswers({ situation: 'own', sum_insured_band: 'unsure', age_band: '31_40', adults_count: 1, children_count: 0, parents_count: 0, premium_comfort: 'unsure', city_tier: 'metro' }));
    assert.equal(b.healthPick.kind, 'check');
    assert.equal(b.headline, 'First, let’s see what you have');
  });
  it('adds what an advisor would say for their budget, city and family', () => {
    const tight = none({ age_band: '31_40', premium_comfort: 'lt10k', adults_count: 2, children_count: 1 });
    assert.ok(tight.healthPick.tips.some((t) => /PM-JAY/.test(t)));
    assert.ok(tight.healthPick.tips.some((t) => /₹10 L base plan plus a super top-up/.test(t)));
    const rich = none({ age_band: '31_40', premium_comfort: '35kp' });
    assert.ok(rich.healthPick.tips.some((t) => /no room-rent cap/.test(t)));
    const sandwich = none({ age_band: '41_50', children_count: 2, parents_count: 2, parents_age_band: '60_70' });
    assert.ok(sandwich.parentsPick!.tips.some((t) => /Ayushman Vay Vandana/.test(t)));
    assert.match(sandwich.note, /their claims won’t eat into the kids’ cover/);
  });
  it('company cover only — the opening is about the job, whatever the persona', () => {
    const b = buildPlanBoard(pruneAnswers({ situation: 'group', personal_policy_besides_group: 'no', sum_insured_band: '3_5', age_band: '18_30', adults_count: 1, children_count: 0, parents_count: 0, premium_comfort: 'unsure', city_tier: 'metro' }));
    assert.equal(b.headline, 'Your cover is tied to your job');
    assert.equal(b.persona.id, 'starter');
  });
});
