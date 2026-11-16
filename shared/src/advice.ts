/**
 * v3 one-screen result, in an advisor's voice.
 *  A (no cover): the big picture — the cover their life needs, how it's built, and what a hospital bill means in months of pay.
 *  B/C (have cover): what's in place, the shortfall against what we suggest, and up to 3 gaps with a rupee consequence.
 *
 * Tone: urgent and concrete, never invented. Every rupee figure is the person's own answer, our stated cover rule,
 * or a labelled example of how a policy rule works. VALIDATION REQUIRED: cover rule + all wording (compliance).
 */
import type { QuizAnswers } from './types';
import { BAND_LAKH, BENCHMARKS as B } from './benchmarks';
import { hasParents60 } from './quiz';

export interface AdviceGap { id: string; title: string; impact: string; example?: boolean; next: 'advisor' | 'plans' | 'upload' }
export interface CoverPart { label: string; lakh: number | null; note?: string }
export interface BillBar { billLakh: number; months: number }

export interface Advice {
  kind: 'needs' | 'gaps';
  headline: string;
  sub: string;
  wins: string[];
  gaps: AdviceGap[];
  suggestedLakh: number;
  currentLakh: number | null;      // null for A, or "Not sure"
  currentLabel: string | null;
  shortfallLakh: number | null;
  structure: CoverPart[];          // how to build the suggested cover
  bills: BillBar[] | null;         // v3–v4 "months of income" chart; v5 no longer asks income, so always null
  whyNow: string | null;
}

export const SCENARIO_BILLS_LAKH = [2, 5, 10];

/**
 * Cover rule v1 (VALIDATION REQUIRED — product/actuarial to tune):
 * ₹10 L for one adult · +₹5 L if spouse or children share it · +₹5 L in a metro (or unknown city) · +₹5 L if 41+.
 * v5 removed the +₹10 L for take-home above ₹1 lakh a month (income is no longer asked). Parents 60+ get their own plan.
 * Superseded by coverScenarios.ts (claims-based) once SUM_INSURED_METHOD.md is approved — roadmap step 1.5.
 */
export function suggestedCoverLakh(a: QuizAnswers): number {
  const m = a.members ?? [];
  let l = 10;
  if (m.includes('spouse') || m.includes('children')) l += 5;
  if (a.city_tier !== 'other') l += 5;
  if (a.age_band === '41_50' || a.age_band === '51_60' || a.age_band === '61p') l += 5;
  return l;
}

const lakh = (n: number) => `₹${n} L`;
const parents60 = hasParents60;

/** How to build the cover: a base plan up to ₹10 L, a super top-up for the rest (usually a cheaper way to reach the total). */
function structureFor(total: number, a: QuizAnswers, existingLakh: number | null): CoverPart[] {
  const parts: CoverPart[] = [];
  if (existingLakh !== null) {
    parts.push({ label: 'What you have', lakh: existingLakh });
    if (total > existingLakh) parts.push({ label: 'Super top-up', lakh: total - existingLakh, note: 'on top of your policy' });
  } else {
    const base = Math.min(10, total);
    parts.push({ label: (a.members ?? []).some((x) => x === 'spouse' || x === 'children') ? 'Family floater' : 'Base plan', lakh: base });
    if (total > base) parts.push({ label: 'Super top-up', lakh: total - base, note: 'cheaper way to go higher' });
  }
  if (parents60(a)) parts.push({ label: 'Senior plan for parents', lakh: null, note: 'separate, so your premium doesn’t jump' });
  return parts;
}

export function buildAdvice(a: QuizAnswers): Advice {
  const suggested = suggestedCoverLakh(a);

  // ---------------------------------------------------------------- A: no cover yet
  if (a.situation === 'none') {
    const gaps: AdviceGap[] = [
      { id: 'no_cover', title: 'Every hospital bill is yours today', next: 'advisor',
        impact: `A ${lakh(5)} stay would come out of your savings.` },
      { id: 'waiting', title: 'The waiting clock hasn’t started', next: 'plans',
        impact: `Existing illnesses can wait up to ${B.pedWaitMaxMonths} months, counted from the day you buy.` },
    ];
    if (parents60(a)) gaps.push({ id: 'parents', title: 'Parents need their own plan', next: 'plans',
      impact: 'Kept separate, their age won’t push up your family’s premium.' });
    return {
      kind: 'needs',
      headline: `Your family needs about ${lakh(suggested)} of health cover`,
      sub: 'Based on who depends on you, your age and where you live.',
      wins: [], gaps: gaps.slice(0, 3),
      suggestedLakh: suggested, currentLakh: null, currentLabel: null, shortfallLakh: suggested,
      structure: structureFor(suggested, a, null), bills: null,
      whyNow: 'Premiums are lowest at the age you are today, and waiting periods start only once you buy.',
    };
  }

  // ---------------------------------------------------------------- B / C: has cover
  const C = a.situation === 'group';
  const band = a.sum_insured_band;
  const current = band && band !== 'unsure' ? BAND_LAKH[band]! : null;
  const shortfall = current !== null ? Math.max(0, suggested - current) : null;
  const wins: string[] = [];
  const gaps: AdviceGap[] = [];

  if (current !== null && shortfall === 0) wins.push(`${band === '25p' ? '₹25 L+' : lakh(current)} cover — enough for now`);
  if (a.room_rent_limit === 'no_limit') wins.push('No room-rent cap');
  if (C && a.family_in_group_cover === 'yes') wins.push('Family covered at work');
  if (C && a.personal_policy_besides_group === 'yes') wins.push('Covered beyond your job');
  if (!C) wins.push('Your own policy — stays with you');
  if (C) wins.push('Covered at work today');
  if (a.renewal_window === '1_3m' || a.renewal_window === '3_12m') wins.push('Renewal not due yet');

  if (C && a.personal_policy_besides_group === 'no')
    gaps.push({ id: 'job_only', title: 'Your cover ends with your job', next: 'plans',
      impact: 'Leave the job and you’re uninsured that day — a new policy restarts waiting periods.' });
  if (shortfall && current !== null)
    gaps.push({ id: 'low_cover', title: `${lakh(shortfall)} short of what you need`, next: 'plans',
      impact: `A ${lakh(suggested)} hospital bill would leave ${lakh(shortfall)} for you to pay.` });
  if (band === 'unsure')
    gaps.push({ id: 'unknown_cover', title: 'You don’t know your cover', next: 'upload',
      impact: 'If it’s lower than you think, the rest of the bill is yours. Upload to check.' });
  if (a.room_rent_limit === 'limit' || a.room_rent_limit === 'unsure')
    gaps.push({ id: 'room_rent', title: a.room_rent_limit === 'limit' ? 'Room-rent cap can cut your claim' : 'A hidden room-rent cap?', example: true, next: 'plans',
      impact: 'Example: a room at twice the cap can halve related charges — up to ₹1.5 L of a ₹3 L bill.' });
  if (C && a.family_in_group_cover === 'only_me')
    gaps.push({ id: 'family_out', title: 'Your family isn’t covered', next: 'plans', impact: 'Only you are on the company policy — their bills are fully yours.' });
  if (a.renewal_window === 'lt1m')
    gaps.push({ id: 'renewal', title: 'Renewal due this month', next: 'advisor', impact: 'Miss it and you lose the waiting periods you’ve already served.' });

  const top = gaps.slice(0, 3);
  return {
    kind: 'gaps',
    headline: top.length ? `You’ve done well — ${top.length === 1 ? 'one gap' : `${top.length} gaps`} to close` : 'You’re well covered',
    sub: top.length ? 'Here’s what your cover is missing today.' : 'Keep cover in step with medical costs, which rise about 13% a year.',
    wins: wins.slice(0, 2), gaps: top,
    suggestedLakh: suggested, currentLakh: current, currentLabel: band === '25p' ? '₹25 L+' : current !== null ? lakh(current) : 'Not sure',
    shortfallLakh: shortfall,
    structure: structureFor(suggested, a, current), bills: null, whyNow: null,
  };
}
