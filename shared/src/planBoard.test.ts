import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanBoard, inr, pruneAnswers, recommendPlans, type QuizAnswers } from './index';

const base: QuizAnswers = { adults_count: 2, children_count: 2, parents_count: 0, age_band: '31_40', income_band: '50k_1l', city_tier: 'metro' };

describe('cover plan board (v5, persona-aware)', () => {
  it('no cover: family floater for the whole family, term and crisis sized from income', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, situation: 'none' }), 'Priya');
    assert.equal(b.eyebrow, 'For Priya · A growing family');
    assert.equal(b.headline, 'Protect your kids’ future');
    assert.equal(b.profile, 'You + partner · 2 kids · 31–40 · Metro');
    assert.deepEqual([b.term!.priority, b.crisis.priority], ['must', 'good']);
    assert.deepEqual([b.health.needLakh, b.health.haveLabel, b.health.pct], [20, 'None', 0]);
    assert.equal(b.health.alert!.text, 'Every hospital bill is yours today');
    assert.equal(b.healthPick.type, 'family_floater');
    assert.match(b.healthPick.why, /all 4 of you/);
    // ₹75k a month → ₹9 L a year × 15 = ₹1.35 Cr → rounded to ₹1.25 Cr; crisis 3 × ₹9 L = ₹27 L → ₹25 L
    assert.equal(b.term!.need, '₹1.25 Cr');
    assert.equal(b.term!.rule, '15× your yearly income');
    assert.equal(b.crisis!.need, '₹25 L');
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
  it('parents get their own plan; 61+ gets no term block', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, situation: 'none', parents_count: 2 }));
    assert.equal(b.parentsPick!.type, 'senior_citizen');
    const s = buildPlanBoard(pruneAnswers({ ...base, adults_count: 1, children_count: 0, situation: 'none', age_band: '61p' }));
    assert.equal(s.term!.priority, 'skip', 'shown, and honestly marked "not for you"');
    assert.ok(!s.picks.some((p) => p.type === 'term_life'), 'never recorded as suggested');
    assert.equal(s.healthPick.type, 'senior_citizen');
  });
  it('"Prefer not to say": no invented term or crisis figure — the advisor sizes it', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, situation: 'none', income_band: 'prefer_not' }));
    assert.equal(b.term!.need, null);
    assert.equal(b.crisis!.need, null);
    assert.equal(b.term!.rule, 'Sized with your advisor');
  });
  it('no price until Turtlemint enters one', () => {
    const b = buildPlanBoard(pruneAnswers({ ...base, situation: 'none' }));
    assert.ok(b.picks.every((p) => p.price === null));
  });
  it('what is recorded as shown is exactly the board', () => {
    const a = pruneAnswers({ ...base, situation: 'none', parents_count: 1 });
    assert.deepEqual(recommendPlans(a).map((r) => r.type), buildPlanBoard(a).picks.map((p) => p.type));
  });
  it('formats lakh and crore', () => {
    assert.deepEqual([inr(4_000_000), inr(12_500_000), inr(20_000_000)], ['₹40 L', '₹1.25 Cr', '₹2 Cr']);
  });
});

describe('personas — the same five answers, different lives', () => {
  const none = (p: QuizAnswers) => buildPlanBoard(pruneAnswers({ situation: 'none', income_band: '50k_1l', city_tier: 'metro', adults_count: 1, children_count: 0, parents_count: 0, ...p }));
  it('maps life stage to a persona', () => {
    const ids = [
      none({ age_band: '18_30' }), none({ age_band: '31_40' }), none({ age_band: '31_40', adults_count: 2 }),
      none({ age_band: '31_40', adults_count: 2, children_count: 1 }), none({ age_band: '41_50', children_count: 2, parents_count: 2 }),
      none({ age_band: '31_40', parents_count: 1 }), none({ age_band: '41_50', adults_count: 2 }), none({ age_band: '51_60' }), none({ age_band: '61p' }),
    ].map((b) => b.persona.id);
    assert.deepEqual(ids, ['starter', 'solo', 'couple', 'family', 'sandwich', 'caregiver', 'midlife', 'pre_retire', 'senior']);
  });
  it('says honestly when something can wait or isn’t for you', () => {
    const starter = none({ age_band: '18_30' });
    assert.equal(starter.term!.priority, 'later');
    assert.match(starter.term!.explain!.lines[1]!, /marry, have a child or take a home loan/);
    assert.ok(!starter.picks.some((p) => p.type === 'term_life'));
    assert.equal(none({ age_band: '51_60' }).term!.priority, 'skip');
    assert.equal(none({ age_band: '51_60', adults_count: 2 }).term!.priority, 'good');
  });
  it('a well-covered person is told to keep their plan — nothing to buy', () => {
    const b = buildPlanBoard(pruneAnswers({ situation: 'own', sum_insured_band: '25p', age_band: '31_40', adults_count: 2, children_count: 0, parents_count: 0, income_band: '50k_1l', city_tier: 'other' }));
    assert.equal(b.healthPick.kind, 'keep');
    assert.equal(b.health.priority, 'done');
    assert.equal(b.headline, 'Your health cover looks good');
    assert.match(b.healthPick.why, /We won’t sell you more/);
    assert.ok(!b.picks.some((p) => p.reason === 'keep_health'));
  });
  it('not sure of their cover: read the policy before suggesting anything', () => {
    const b = buildPlanBoard(pruneAnswers({ situation: 'own', sum_insured_band: 'unsure', age_band: '31_40', adults_count: 1, children_count: 0, parents_count: 0, income_band: '25_50k', city_tier: 'metro' }));
    assert.equal(b.healthPick.kind, 'check');
    assert.equal(b.headline, 'First, let’s see what you have');
  });
  it('adds what an advisor would say for their budget, city and family', () => {
    const tight = none({ age_band: '31_40', income_band: 'lt25k', adults_count: 2, children_count: 1 });
    assert.ok(tight.healthPick.tips.some((t) => /PM-JAY/.test(t)));
    assert.ok(tight.healthPick.tips.some((t) => /₹10 L base plan plus a super top-up/.test(t)));
    const rich = none({ age_band: '31_40', income_band: '2lp' });
    assert.ok(rich.healthPick.tips.some((t) => /no room-rent cap/.test(t)));
    const sandwich = none({ age_band: '41_50', children_count: 2, parents_count: 2 });
    assert.ok(sandwich.parentsPick!.tips.some((t) => /Ayushman Vay Vandana/.test(t)));
    assert.match(sandwich.note, /their claims won’t eat into the kids’ cover/);
  });
  it('company cover only — the opening is about the job, whatever the persona', () => {
    const b = buildPlanBoard(pruneAnswers({ situation: 'group', personal_policy_besides_group: 'no', sum_insured_band: '3_5', age_band: '18_30', adults_count: 1, children_count: 0, parents_count: 0, income_band: '25_50k', city_tier: 'metro' }));
    assert.equal(b.headline, 'Your cover is tied to your job');
    assert.equal(b.persona.id, 'starter');
  });
});
