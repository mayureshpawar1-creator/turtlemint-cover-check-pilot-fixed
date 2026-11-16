/**
 * Who we're talking to. The same five answers describe very different lives — a 26-year-old on their own, a couple
 * planning a baby, a family looking after kids and parents, someone five years from retirement. The advice, the
 * order of what to do and the words all follow from this, so nobody sees a generic plan.
 *
 * Personas come from life stage (age, who depends on you) and are then shaped by the cover they have today.
 * Every claim in these lines is either general and true, or a published figure in benchmarks.ts.
 * VALIDATION REQUIRED: wording with compliance; priorities with Turtlemint's advisory team.
 */
import type { QuizAnswers } from './types';
import { BENCHMARKS as B } from './benchmarks';

export type PersonaId = 'starter' | 'solo' | 'couple' | 'family' | 'sandwich' | 'caregiver' | 'midlife' | 'pre_retire' | 'senior';
/** must = do this now · good = worth adding · later = not yet, and when · skip = not for you · done = already covered */
export type AdvicePriority = 'must' | 'good' | 'later' | 'skip' | 'done';
export const PRIORITY_LABEL: Record<AdvicePriority, string> = { must: 'Must have', good: 'Good to have', later: 'Later', skip: 'Not for you', done: 'Covered' };

export interface Persona {
  id: PersonaId;
  /** Shown small above the headline: "A growing family". */
  label: string;
  /** What life looks like for them — used for the opening line when they have no cover yet. */
  headline: string;
  note: string;
  /** The line when they already have cover: what matters next for someone like them. */
  noteHave: string;
  dependents: boolean;
  priorities: { term: AdvicePriority; crisis: AdvicePriority };
}

export interface LifeFacts { partner: boolean; kids: number; parents: number; age: QuizAnswers['age_band'] }

export function lifeFacts(a: QuizAnswers): LifeFacts {
  const m = a.members ?? [];
  return {
    partner: (a.adults_count ?? (m.includes('spouse') ? 2 : 1)) >= 2,
    kids: a.children_count ?? (m.includes('children') ? 1 : 0),
    parents: a.parents_count ?? (m.some((x) => x === 'parents' || x === 'parents_in_law') ? 1 : 0),
    age: a.age_band,
  };
}

export function personaFor(a: QuizAnswers): Persona {
  const f = lifeFacts(a);
  const dependents = f.partner || f.kids > 0 || f.parents > 0;
  const P = (id: PersonaId, label: string, headline: string, note: string, noteHave: string, term: AdvicePriority, crisis: AdvicePriority): Persona =>
    ({ id, label, headline, note, noteHave, dependents, priorities: { term, crisis } });

  if (f.age === '61p') return P('senior', 'Cover for your later years', 'Cover built for 60+',
    `A plan built for 60+, with clear co-pay. If you're ${B.vayVandanaAge}+, Ayushman Vay Vandana adds free ₹${B.vayVandanaLakh} L cover.`,
    `Renew without a break so the waiting you've served carries on. ${B.vayVandanaAge}+? Vay Vandana adds free ₹${B.vayVandanaLakh} L.`,
    'skip', 'good');
  if (f.age === '51_60') return P('pre_retire', 'Planning for retirement', 'Make cover outlast your job',
    'Company cover ends at retirement, and buying after 60 costs more. Lock in your own plan now.',
    'Work cover usually ends at retirement. Your own policy is what carries you past 60.',
    dependents ? 'good' : 'skip', 'must');
  if (f.kids && f.parents) return P('sandwich', 'Caring for two generations', 'Two generations, two plans',
    'Parents on their own plan: their claims won’t eat into the kids’ cover, or raise your premium.',
    'Keep parents off the kids’ floater — one big claim can use up everyone’s cover for the year.',
    'must', 'good');
  if (f.age === '41_50') return P('midlife', f.kids ? 'A family in its busiest years' : 'Your 40s', 'Bigger cover for your 40s',
    'Serious illness gets more common in your 40s — a bigger cover and a crisis lump sum matter now.',
    'Serious illness gets more common in your 40s. Make sure your cover keeps up.',
    dependents ? 'must' : 'later', 'must');
  if (f.kids) return P('family', 'A growing family', 'Protect your kids’ future',
    'Your kids depend on you. Health cover pays the hospital; term cover keeps their life on track.',
    'Health cover’s in place. Term cover is what keeps the kids’ life on track if you’re not there.',
    'must', 'good');
  if (f.parents) return P('caregiver', 'Looking after your parents', 'A plan for your parents too',
    'Keep your parents on a plan of their own, so their age doesn’t push up your premium.',
    'If parents share your floater, their claims and age hit your cover. A separate plan fixes both.',
    'must', 'good');
  if (f.partner) return P('couple', 'Building a life together', 'One plan for both of you',
    'One floater covers you both. Planning a baby? Buy first — maternity cover has a waiting period.',
    'Make sure your policy covers you both — and check its maternity waiting period if a baby’s planned.',
    'good', 'good');
  if (f.age === '18_30') return P('starter', 'Just starting out', 'Start cheap, start now',
    'Premiums are lowest at your age, and waiting periods start the day you buy. Start now.',
    'Good that you’re covered young. Never let it lapse — every renewal counts towards waiting periods.',
    'later', 'good');
  return P('solo', 'Covering yourself', 'Keep bills off your savings',
    'It’s just you: solid health cover first, a crisis lump sum next. No term insurance yet.',
    'Your health cover is the base. A crisis lump sum is what protects your savings next.',
    'later', 'good');
}
