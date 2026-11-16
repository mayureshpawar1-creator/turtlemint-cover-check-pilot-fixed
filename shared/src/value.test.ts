import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapshot,
  checklistProgress,
  recommendPlans,
  recommendFromPolicy,
  buildPolicyHealth,
  buildWhatsAppSummary,
  buildReadout,
  realValueAfter,
  FACT_LABEL,
  SUMMARY_MAX,
  type PolicyFactView,
  type QuizAnswers,
} from './index';

const rashmi: QuizAnswers = {
  situation: 'own',
  members: ['self', 'spouse'],
  eldest_age: 38,
  sum_insured_band: '25p',
  policy_age_band: '3_5',
  health_condition: 'no',
  room_rent_limit: 'no_limit',
  renewal_window: '1_3m',
};

const priya: QuizAnswers = {
  situation: 'own',
  members: ['self', 'spouse', 'children'],
  children_count: 2,
  eldest_age: 36,
  sum_insured_band: 'unsure',
  policy_age_band: '3_5',
  health_condition: 'prefer_not',
  room_rent_limit: 'unsure',
  renewal_window: '1_3m',
};

const sneha: QuizAnswers = {
  situation: 'group',
  members: ['self', 'spouse'],
  eldest_age: 29,
  sum_insured_band: '3_5',
  family_in_group_cover: 'only_me',
  job_exit_cover: 'none',
  room_rent_limit: 'limit',
  personal_policy_besides_group: 'no',
};

const amit: QuizAnswers = {
  situation: 'none',
  members: ['self', 'parents'],
  eldest_age: 64,
  parents_age_band: '60_70',
  sum_insured_band: '5_10',
  health_condition: 'no',
  top_concern: 'parents',
  start_timing: 'this_month',
};

describe('snapshot (S7)', () => {
  it('gives a well-covered person real strengths, not an empty "nothing stands out"', () => {
    const s = buildSnapshot(rashmi);
    assert.ok(s.strengths.length >= 3);
    assert.ok(s.strengths.some((x) => x.id === 'cover_amount'));
    assert.ok(
      s.compare.some(
        (c) => c.type === 'share' && c.segments.find((g) => g.you)?.key === 'individual',
      ),
    );
    assert.deepEqual(checklistProgress(s.checklist, new Set()), { done: 4, total: 4 });
  });

  it('turns not-sure answers into boxes to tick, with a next step', () => {
    const s = buildSnapshot(priya);
    const open = s.checklist.filter((c) => c.status === 'unknown');
    assert.deepEqual(open.map((c) => c.id).sort(), ['cover_amount', 'room_rent']);
    assert.ok(open.every((c) => c.next));
    const p = checklistProgress(s.checklist, new Set(['room_rent']));
    assert.equal(p.done, 3);
  });

  it('company cover only: flags family and life after the job', () => {
    const ids = buildSnapshot(sneha)
      .checklist.filter((c) => c.status === 'check')
      .map((c) => c.id);
    assert.deepEqual(ids.sort(), ['beyond_job', 'cover_amount', 'family', 'room_rent']);
  });

  it('no cover yet: shows the missing-middle stat and "look for" tips', () => {
    const s = buildSnapshot(amit);
    assert.ok(s.compare.some((c) => c.type === 'stat' && c.sourceId === 'niti_2021'));
    assert.ok(s.checklist.some((c) => c.id === 'parents' && c.status === 'tip'));
  });

  it('inflation maths', () => assert.equal(realValueAfter(10), 5.4));
});

describe('plans that fit', () => {
  it('matches plan types to answers and tags links', () => {
    // v5 (D3b): health plans only — never term or critical illness
    assert.deepEqual(recommendPlans(sneha).map((r) => r.type), ['family_floater']);
    assert.deepEqual(recommendPlans(amit).map((r) => r.type), ['individual', 'senior_citizen']);

    for (const r of recommendPlans(sneha)) {
      assert.match(
        r.url,
        /^https:\/\/(www|app)\.turtlemintinsurance\.com\/.+utm_content=quiz_/,
      );
    }
  });

  it('a strong policy gets nothing to buy — the board says keep it', () => {
    assert.deepEqual(recommendPlans(rashmi), []);
  });
});

const fact = (
  key: keyof typeof FACT_LABEL,
  value: string | null,
  page = 1,
  confidence = 0.95,
): PolicyFactView => ({
  key,
  label: FACT_LABEL[key],
  value,
  sourcePage: value ? page : null,
  confidence,
  userConfirmed: true,
  userValue: null,
});

describe('policy health (U7)', () => {
  const facts = [
    fact('sum_insured_inr', '500000'),
    fact('room_rent_limit', '1% of sum insured per day', 3),
    fact('copay_percent', '0', 3),
    fact('ped_waiting_months', '36', 3),
    fact('start_date', '2025-11-20'),
    fact('restoration', null),
    fact('no_claim_bonus', '10% a year'),
  ];

  const h = buildPolicyHealth(facts, new Date('2026-10-05'));

  it('rates each area, reviews first, never an overall score', () => {
    assert.deepEqual(
      h.areas.map((a) => [a.id, a.status]).slice(0, 3),
      [
        ['sum_insured', 'review'],
        ['room_rent', 'review'],
        ['copay', 'review'],
      ],
    );

    assert.equal(h.areas.find((a) => a.id === 'waiting')!.status, 'review');
    assert.equal(h.areas.find((a) => a.id === 'restoration')!.status, 'not_found');
    assert.match(h.areas.find((a) => a.id === 'room_rent')!.meaning, /₹5,000 a day/);
  });

  it('does not recommend when decision-critical facts are missing', () => {
    assert.deepEqual(
      recommendFromPolicy(facts),
      [],
      'incomplete policy facts must not trigger a purchase recommendation',
    );
  });
});

describe('WhatsApp summary', () => {
  it('fits the template limit and matches what is previewed', () => {
    for (const a of [rashmi, priya, sneha, amit]) {
      const m = buildWhatsAppSummary('Rashmi', a, buildReadout(a));
      assert.ok(m.text.length <= SUMMARY_MAX);
      assert.ok(m.text.includes(m.params[1]));
    }
  });
});

describe('sources', () => {
  it('never cites or links a competitor', async () => {
    const { SOURCES } = await import('./benchmarks');
    const banned =
      /policybazaar|joinditto|ditto|nyvo|coverfox|insurancedekho|renewbuy|paisabazaar|bankbazaar|probus|beshak/i;

    for (const s of Object.values(SOURCES)) {
      assert.doesNotMatch(s.url, banned, s.id);
      assert.doesNotMatch(s.label, banned, s.id);
    }

    const { PLAN_PAGES } = await import('./recommendations');
    for (const url of Object.values(PLAN_PAGES)) {
      assert.match(url, /^https:\/\/(www|app)\.turtlemintinsurance\.com\//);
    }
  });
});
