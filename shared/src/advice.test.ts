import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdvice, buildWhatsAppSummary, buildReadout, suggestedCoverLakh, buildLeadCard, type QuizAnswers } from './index';

const ravi: QuizAnswers = { situation: 'none', members: ['self', 'spouse', 'parents'], age_band: '31_40', parents_age_band: '60_70', premium_comfort: '20_35k', city_tier: 'metro' };
const sneha: QuizAnswers = { situation: 'group', members: ['self', 'spouse'], age_band: '18_30', sum_insured_band: '3_5', family_in_group_cover: 'only_me', personal_policy_besides_group: 'no' };
const rashmi: QuizAnswers = { situation: 'own', members: ['self', 'spouse'], age_band: '31_40', sum_insured_band: '25p', room_rent_limit: 'no_limit', renewal_window: '1_3m' };

describe('advice (v3 one-screen result)', () => {
  it('no cover: the big picture with a suggested amount and structure (v5: no months-of-pay chart)', () => {
    const a = buildAdvice(ravi);
    assert.equal(a.kind, 'needs');
    assert.equal(a.suggestedLakh, 20); // 10 + family 5 + metro 5
    assert.deepEqual(a.structure.map((p) => p.label), ['Family floater', 'Super top-up', 'Senior plan for parents']);
    assert.equal(a.bills, null);
    assert.match(a.gaps[0]!.impact, /come out of your savings/);
  });
  it('an old v4 answer with income changes nothing (income is no longer an input)', () => {
    const a = buildAdvice({ ...ravi, income_band: '2lp' });
    assert.deepEqual([a.suggestedLakh, a.bills], [buildAdvice(ravi).suggestedLakh, null]);
    assert.equal(suggestedCoverLakh({ members: ['self'], city_tier: 'metro', income_band: '2lp' }), suggestedCoverLakh({ members: ['self'], city_tier: 'metro' }));
  });
  it('company only: wins first, then gaps with rupee consequences', () => {
    const a = buildAdvice(sneha);
    assert.equal(a.kind, 'gaps');
    assert.deepEqual(a.gaps.map((g) => g.id), ['job_only', 'low_cover', 'family_out']);
    assert.equal(a.shortfallLakh, 15); // suggested 20 (10 + family 5 + unknown city 5) − ₹5 L
    assert.match(a.gaps[1]!.impact, /₹20 L hospital bill would leave ₹15 L/);
  });
  it('well covered: no gaps, honest headline', () => {
    const a = buildAdvice(rashmi);
    assert.equal(a.gaps.length, 0);
    assert.equal(a.headline, 'You’re well covered');
    assert.equal(a.wins.length, 2);
  });
  it('cover rule', () => {
    assert.equal(suggestedCoverLakh({ members: ['self'], city_tier: 'other', age_band: '18_30' }), 10);
    assert.equal(suggestedCoverLakh({ members: ['self', 'children'], city_tier: 'metro', age_band: '41_50' }), 25); // 10 + 5 + 5 + 5
  });
  it('WhatsApp params are single-line and the preview is the filled template', () => {
    for (const a of [ravi, sneha, rashmi]) {
      const m = buildWhatsAppSummary('Ravi', a, buildReadout(a));
      for (const p of m.params) assert.doesNotMatch(p, /[\n\t]| {4,}/);
      assert.ok(!m.text.includes('{{'));
    }
  });
  it('telecaller sees the advice', () => {
    const c = buildLeadCard({ leadId: 'x', firstName: 'Sneha', pincode: null, city: null, state: null, mobileVerified: false, leadState: 'data_only',
      priority: null, answers: sneha, findings: [], handoff: null, upload: { status: 'none' }, contactConsentTs: null, noticeVersion: null });
    assert.match(c.adviceLine, /^Building a life together · Health ₹20 L \(has ₹5 L, short ₹15 L\) · Pick: Family floater ₹20 L · .*₹0 cover the day you leave your job$/);
  });
});
