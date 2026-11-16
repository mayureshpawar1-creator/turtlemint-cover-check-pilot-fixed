import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReadout, callSlots, computePriority, deriveLeadState, isInsideCallWindow, isQuizCoreComplete, maskMobile,
  pruneAnswers, quizScreens, screenErrors, buildLeadCard, cardSummary, isCardComplete, ONE_SCREEN_CARDS, QUIZ_DEFAULTS, type QuizAnswers,
  disallowedFields, intentOf, visibleQuestions, S1, FLOW_VERSION, type Intent,
} from './index';

const priya: QuizAnswers = {
  situation: 'own', members: ['self', 'spouse', 'children'], age_band: '31_40', sum_insured_band: 'unsure',
  room_rent_limit: 'unsure', renewal_window: '1_3m',
};

describe('quiz config (v5 — one screen, question graph)', () => {
  const full: QuizAnswers = { situation: 'none', adults_count: 2, children_count: 2, parents_count: 0, age_band: '31_40', premium_comfort: '20_35k', city_tier: 'metro' };
  it('is one screen, every answer a tap or a stepper — nothing typed', () => {
    assert.equal(quizScreens().length, 1);
    for (const q of quizScreens()[0]!.questions) assert.ok(q.kind === 'single' || q.kind === 'stepper', q.field);
    assert.deepEqual(ONE_SCREEN_CARDS.map((c) => c.id), ['cover', 'who', 'age', 'budget', 'city', 'more']);
    assert.equal(FLOW_VERSION, 'v5');
  });
  it('never asks someone without cover about a policy', () => {
    const errs = screenErrors(quizScreens()[0]!, full);
    assert.deepEqual(errs, {});
    assert.ok('sum_insured_band' in screenErrors(quizScreens()[0]!, { ...full, situation: 'own' }));
  });
  it('company cover needs "also your own?" — set by the Company / Company + own chip', () => {
    const s = quizScreens()[0]!;
    assert.ok('personal_policy_besides_group' in screenErrors(s, { ...full, situation: 'group', sum_insured_band: '3_5' }));
    assert.deepEqual(screenErrors(s, { ...full, situation: 'group', sum_insured_band: '3_5', personal_policy_besides_group: 'yes', family_in_group_cover: 'yes' }), {});
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

describe('journey v5 — intents and the question graph', () => {
  const asked = (a: QuizAnswers) => visibleQuestions(S1, a).map((q) => q.field);
  const base: QuizAnswers = { ...QUIZ_DEFAULTS, age_band: '31_40', premium_comfort: '10_20k', city_tier: 'metro' };
  /** One fixture per intent: the answers and the taps a person needs on the shortest path. */
  const fixtures: { intent: Intent; a: QuizAnswers; taps: string[] }[] = [
    { intent: 'first_time', a: { ...base, situation: 'none' },
      taps: ['None yet', 'Next (who)', 'age', 'budget', 'city', 'See my plan'] },
    { intent: 'own_individual', a: { ...base, situation: 'own', sum_insured_band: '5_10' },
      taps: ['My own', 'amount', 'Next (who)', 'age', 'budget', 'city', 'See my plan'] },
    { intent: 'own_floater', a: { ...base, situation: 'own', sum_insured_band: '5_10', adults_count: 2 },
      taps: ['My own', 'amount', '+ adult', 'Next (who)', 'age', 'budget', 'city', 'See my plan'] },
    { intent: 'corporate_only', a: { ...base, situation: 'group', personal_policy_besides_group: 'no', sum_insured_band: '3_5' },
      taps: ['Company', 'amount', 'Next (who)', 'age', 'budget', 'city', 'See my plan'] },
    { intent: 'corporate_plus_own', a: { ...base, situation: 'group', personal_policy_besides_group: 'yes', sum_insured_band: '10_25' },
      taps: ['Company + own', 'amount', 'Next (who)', 'age', 'budget', 'city', 'See my plan'] },
    { intent: 'cover_parents', a: { ...base, situation: 'own', sum_insured_band: '5_10', parents_count: 1, parents_age_band: '60_70' },
      taps: ['My own', 'amount', '+ parent', 'Next (who)', 'age', 'parent age', 'budget', 'city', 'See my plan'] },
  ];
  for (const f of fixtures) {
    it(`${f.intent}: complete, derived intent, and a short path`, () => {
      const a = pruneAnswers(f.a);
      assert.deepEqual(screenErrors(S1, a), {}, 'every required question answered');
      assert.equal(isQuizCoreComplete(a), true);
      assert.equal(intentOf(a), f.intent);
      assert.deepEqual(disallowedFields(a, a), [], 'nothing the graph did not ask');
      // required single-choice questions shown = taps they cost (steppers default valid)
      const singles = visibleQuestions(S1, a).filter((q) => q.kind === 'single' && q.required).length;
      assert.ok(singles <= 7, `${singles} choice questions`);
      assert.ok(f.taps.length <= (f.intent === 'cover_parents' ? 9 : 8), `${f.taps.length} taps`);
    });
  }
  it('shortest possible path (no cover, just you) is 6 taps', () => {
    assert.equal(fixtures[0]!.taps.length, 6);
    assert.deepEqual(asked(fixtures[0]!.a).filter((x) => x !== 'adults_count' && x !== 'children_count' && x !== 'parents_count'),
      ['situation', 'age_band', 'premium_comfort', 'city_tier', 'other_protection_interest']);
  });
  it('"just exploring" is not a separate path — no cover falls back to first_time', () => {
    assert.equal(intentOf({ situation: 'none', parents_count: 2 }), 'first_time');
    assert.equal(intentOf({}), null);
  });
  it('company cover asks who it includes — only when there is family', () => {
    const g: QuizAnswers = { ...base, situation: 'group', personal_policy_besides_group: 'no', sum_insured_band: '3_5' };
    assert.ok(!asked(g).includes('family_in_group_cover'));
    assert.ok(asked({ ...g, children_count: 1 }).includes('family_in_group_cover'));
    assert.ok('family_in_group_cover' in screenErrors(S1, { ...g, children_count: 1 }));
    assert.ok(!asked({ ...base, situation: 'own', sum_insured_band: '5_10', children_count: 1 }).includes('family_in_group_cover'));
  });
  it('B5: readout R6 fires for parents 60+ from the v5 quiz, never for parents under 60', () => {
    const a = (band: 'u60' | '60_70') => pruneAnswers({ ...base, situation: 'none', parents_count: 1, parents_age_band: band });
    assert.ok(buildReadout(a('60_70')).check.some((f) => f.ruleId === 'R6'));
    assert.ok(!buildReadout(a('u60')).check.some((f) => f.ruleId === 'R6'));
  });
  it('parents bring their own age question', () => {
    assert.ok(!asked(base).includes('parents_age_band'));
    assert.ok('parents_age_band' in screenErrors(S1, { ...base, situation: 'none', parents_count: 1 }));
    assert.equal(cardSummary(ONE_SCREEN_CARDS[2]!, { ...base, parents_count: 1, parents_age_band: '70p' }), 'You 31–40 · parent 70+');
  });
  it('income is gone; budget and the optional interest question are in', () => {
    assert.ok(!S1.questions.some((q) => q.field === 'income_band'));
    assert.doesNotMatch(JSON.stringify(S1.questions.map((q) => [q.label, q.helper])), /never shared/i);
    const more = S1.questions.find((q) => q.field === 'other_protection_interest')!;
    assert.equal(more.required, false);
    assert.equal(isQuizCoreComplete(pruneAnswers({ ...base, situation: 'none' })), true, 'skipping it never blocks the plan');
  });
  it('refuses answers the graph does not ask for', () => {
    const a: QuizAnswers = { ...base, situation: 'none' };
    assert.deepEqual(disallowedFields({ income_band: '1_2l' }, { ...a, income_band: '1_2l' }), ['income_band']);
    assert.deepEqual(disallowedFields({ parents_age_band: '70p' }, { ...a, parents_age_band: '70p' }), ['parents_age_band'], 'no parents');
    assert.deepEqual(disallowedFields({ sum_insured_band: '5_10' }, { ...a, sum_insured_band: '5_10' }), ['sum_insured_band'], 'no cover → no amount');
    assert.deepEqual(disallowedFields({ parents_count: 1, parents_age_band: '70p' }, { ...a, parents_count: 1, parents_age_band: '70p' }), []);
  });
  it('the caller card shows intent, budget and interest — never income', () => {
    const answers = pruneAnswers({ ...base, situation: 'own', sum_insured_band: '5_10', parents_count: 1, parents_age_band: '60_70', other_protection_interest: 'yes' });
    const c = buildLeadCard({ leadId: 'x', firstName: 'Asha', pincode: null, city: null, state: null, mobileVerified: true, leadState: 'hand_raised',
      priority: 'P2', answers: { ...answers, income_band: '2lp' }, findings: [], handoff: null, upload: { status: 'none' }, contactConsentTs: null, noticeVersion: null });
    assert.match(c.quizLine, /intent: Adding cover for parents/);
    assert.match(c.quizLine, /budget ₹10–20k\/yr/);
    assert.match(c.quizLine, /life \/ critical-illness interest: yes/);
    assert.doesNotMatch(`${c.situationLine} ${c.quizLine} ${c.adviceLine}`, /take-home|income|Term|Crisis/);
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
