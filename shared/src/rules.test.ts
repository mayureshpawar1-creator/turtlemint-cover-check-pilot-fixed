import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReadout, callSlots, computePriority, deriveLeadState, isInsideCallWindow, isQuizCoreComplete, maskMobile,
  pruneAnswers, quizScreens, screenErrors, buildLeadCard, cardSummary, isCardComplete, ONE_SCREEN_CARDS, QUIZ_DEFAULTS, type QuizAnswers,
} from './index';

const priya: QuizAnswers = {
  situation: 'own', members: ['self', 'spouse', 'children'], age_band: '31_40', sum_insured_band: 'unsure',
  room_rent_limit: 'unsure', renewal_window: '1_3m',
};

describe('quiz config (v4 — one screen)', () => {
  const full: QuizAnswers = { situation: 'none', adults_count: 2, children_count: 2, parents_count: 0, age_band: '31_40', income_band: '50k_1l', city_tier: 'metro' };
  it('is one screen, every answer a tap or a stepper — nothing typed', () => {
    assert.equal(quizScreens().length, 1);
    for (const q of quizScreens()[0]!.questions) assert.ok(q.kind === 'single' || q.kind === 'stepper', q.field);
    assert.deepEqual(ONE_SCREEN_CARDS.map((c) => c.id), ['cover', 'who', 'age', 'income', 'city']);
  });
  it('never asks someone without cover about a policy', () => {
    const errs = screenErrors(quizScreens()[0]!, full);
    assert.deepEqual(errs, {});
    assert.ok('sum_insured_band' in screenErrors(quizScreens()[0]!, { ...full, situation: 'own' }));
  });
  it('company cover needs "also your own?" — set by the Company / Company + own chip', () => {
    const s = quizScreens()[0]!;
    assert.ok('personal_policy_besides_group' in screenErrors(s, { ...full, situation: 'group', sum_insured_band: '3_5' }));
    assert.deepEqual(screenErrors(s, { ...full, situation: 'group', sum_insured_band: '3_5', personal_policy_besides_group: 'yes' }), {});
  });
  it('steppers start valid ("Just you") and stay in range', () => {
    assert.ok(isCardComplete(ONE_SCREEN_CARDS[1]!, QUIZ_DEFAULTS));
    assert.ok('adults_count' in screenErrors(quizScreens()[0]!, { ...full, adults_count: 3 }));
  });
  it('collapsed cards read like a sentence', () => {
    assert.equal(cardSummary(ONE_SCREEN_CARDS[0]!, { situation: 'group', personal_policy_besides_group: 'yes', sum_insured_band: '5_10' }), 'Company + own · ₹5–10 L');
    assert.equal(cardSummary(ONE_SCREEN_CARDS[1]!, full), 'You + partner · 2 kids');
    assert.equal(cardSummary(ONE_SCREEN_CARDS[1]!, QUIZ_DEFAULTS), 'Just you');
    assert.equal(cardSummary(ONE_SCREEN_CARDS[1]!, { adults_count: 1, parents_count: 2 }), 'You · 2 parents');
  });
  it('derives members from the counts and prunes answers from another path', () => {
    const a = pruneAnswers({ ...full, situation: 'none', sum_insured_band: '5_10', renewal_window: '1_3m' });
    assert.deepEqual(a.members, ['self', 'spouse', 'children']);
    assert.equal(a.sum_insured_band, undefined);
    assert.equal(a.renewal_window, undefined);
  });
  it('complete only when every card is answered', () => {
    assert.equal(isQuizCoreComplete(full), true);
    assert.equal(isQuizCoreComplete({ ...full, city_tier: undefined }), false);
  });
});

describe('readout rules', () => {
  it('fires R1 and R7 for the spec example', () => {
    assert.deepEqual(buildReadout(priya).check.map((f) => f.ruleId), ['R1', 'R7']);
  });
  it('R4 + R5 for company cover without family or personal policy, R8 for other not sure', () => {
    const ids = buildReadout({ situation: 'group', members: ['self'], eldest_age: 30, sum_insured_band: '3_5',
      family_in_group_cover: 'only_me', job_exit_cover: 'unsure', room_rent_limit: 'no_limit', personal_policy_besides_group: 'no' })
      .check.map((f) => f.ruleId);
    assert.deepEqual(ids, ['R4', 'R5', 'R8']);
  });
  it('R6 for parents over 60', () => {
    assert.equal(buildReadout({ situation: 'none', members: ['parents'], parents_age_band: '70p', eldest_age: 72 }).check[0]!.ruleId, 'R6');
  });
  it('never says anything about unknown answers in What you know', () => {
    assert.doesNotMatch(buildReadout(priya).know.join(' '), /not sure/i);
  });
});

describe('hand-off', () => {
  it('derives the four lead states', () => {
    assert.equal(deriveLeadState({ completed: false, requestedAction: null, contactConsent: false }), 'incomplete');
    assert.equal(deriveLeadState({ completed: true, requestedAction: 'summary_only', contactConsent: false }), 'data_only');
    assert.equal(deriveLeadState({ completed: true, requestedAction: 'summary_only', contactConsent: true }), 'consented_warm');
    assert.equal(deriveLeadState({ completed: true, requestedAction: 'advisor_call', contactConsent: true }), 'hand_raised');
    assert.equal(deriveLeadState({ completed: true, requestedAction: 'advisor_call', contactConsent: false }), 'data_only');
  });
  it('prioritises P1–P4', () => {
    assert.equal(computePriority({ leadState: 'hand_raised', answers: { renewal_window: 'lt1m' }, reviewPoints: 0 }), 'P1');
    assert.equal(computePriority({ leadState: 'hand_raised', answers: { situation: 'none' }, reviewPoints: 0 }), 'P1');
    assert.equal(computePriority({ leadState: 'hand_raised', answers: priya, reviewPoints: 0 }), 'P2');
    assert.equal(computePriority({ leadState: 'consented_warm', answers: priya, reviewPoints: 0 }), 'P3');
    assert.equal(computePriority({ leadState: 'consented_warm', answers: { situation: 'own' }, reviewPoints: 1 }), 'P4');
    assert.equal(computePriority({ leadState: 'data_only', answers: priya, reviewPoints: 5 }), null);
  });
  it('offers only future slots inside 9am–9pm IST', () => {
    const now = new Date('2026-10-03T06:22:00Z'); // 11:52 IST
    const slots = callSlots(now);
    assert.equal(slots[0]!.label, '1 pm – 3 pm');
    assert.equal(slots.filter((s) => s.day === 'tomorrow').length, 6);
    for (const s of slots) assert.equal(isInsideCallWindow(s.start, s.end), true);
    assert.equal(isInsideCallWindow('2026-10-03T16:30:00Z', '2026-10-03T18:30:00Z'), false); // 10pm IST
  });
});

describe('util + card', () => {
  it('masks mobile in spec format', () => assert.equal(maskMobile('+919812345214'), '+91 98••• ••214'));
  it('builds a card that only restates answers', () => {
    const c = buildLeadCard({ leadId: 'x', firstName: 'Priya', pincode: '411001', city: 'Pune', state: 'Maharashtra', mobileVerified: true,
      leadState: 'hand_raised', priority: 'P2', answers: priya, findings: buildReadout(priya).check, handoff: null,
      upload: { status: 'none' }, contactConsentTs: '2026-10-03T06:22:00Z', noticeVersion: 'v1' });
    assert.ok(c.situationLine.includes('Has own policy'));
    assert.deepEqual(c.toldThem.map((t) => t.ruleId), ['R1', 'R7']);
    assert.ok(c.consentLine.includes('3 Oct'));
    assert.ok(c.openingScript.includes('Priya'));
  });
});
