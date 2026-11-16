/**
 * Who we're talking to. The same five answers describe very different lives — a 26-year-old on their own, a couple
 * planning a baby, a family looking after kids and parents, someone five years from retirement. The advice, the
 * order of what to do and the words all follow from this, so nobody sees a generic plan.
 *
 * Personas come from life stage (age, who depends on you) and are then shaped by the cover they have today.
 * Every claim in these lines is either general and true, or a published figure in benchmarks.ts.
 * VALIDATION REQUIRED: wording with compliance.
 * v5: no life (term) or critical-illness priorities — this is a health product (decision D3b).
 */
import type { QuizAnswers } from './types';
import { BENCHMARKS as B } from './benchmarks';
import { hasParents60 } from './quiz';

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
  const parents60 = hasParents60(a);
  const P = (id: PersonaId, label: string, headline: string, note: string, noteHave: string): Persona =>
    ({ id, label, headline, note, noteHave, dependents });

  if (f.age === '61p') return P('senior', 'Cover for your later years', 'Cover built for 60+',
    `A plan built for 60+, with clear co-pay. If you're ${B.vayVandanaAge}+, Ayushman Vay Vandana adds free ₹${B.vayVandanaLakh} L cover.`,
    `Renew without a break so the waiting you've served carries on. ${B.vayVandanaAge}+? Vay Vandana adds free ₹${B.vayVandanaLakh} L.`);
  if (f.age === '51_60') return P('pre_retire', 'Planning for retirement', 'Make cover outlast your job',
    'Company cover ends at retirement, and buying after 60 costs more. Lock in your own plan now.',
    'Work cover usually ends at retirement. Your own policy is what carries you past 60.');
  if (f.kids && f.parents && parents60) return P('sandwich', 'Caring for two generations', 'Two generations, two plans',
    'Parents on their own plan: their claims won’t eat into the kids’ cover, or raise your premium.',
    'Keep parents off the kids’ floater — one big claim can use up everyone’s cover for the year.');
  if (f.age === '41_50') return P('midlife', f.kids ? 'A family in its busiest years' : 'Your 40s', 'Bigger cover for your 40s',
    'Serious illness gets more common in your 40s — a bigger cover matters now.',
    'Serious illness gets more common in your 40s. Make sure your cover keeps up.');
  if (f.kids) return P('family', 'A growing family', 'Protect your kids’ future',
    'Your kids depend on you. One family plan pays the hospital, so a big bill never touches their future.',
    'Health cover’s in place. Make sure it grows with the family — costs rise every year.');
  if (f.parents && parents60) return P('caregiver', 'Looking after your parents', 'A plan for your parents too',
    'Keep your parents on a plan of their own, so their age doesn’t push up your premium.',
    'If parents share your floater, their claims and age hit your cover. A separate plan fixes both.');
  // B5: parents under 60 (or age not told) are not pushed to a separate senior plan
  if (f.parents) return P('caregiver', 'Looking after your parents', 'One plan for you and your parents',
    'Under 60, parents can usually join a family floater — we sized the cover for all of you.',
    'Check your parents are on your policy. Under 60, a family floater can usually include them.');
  if (f.partner) return P('couple', 'Building a life together', 'One plan for both of you',
    'One floater covers you both. Planning a baby? Buy first — maternity cover has a waiting period.',
    'Make sure your policy covers you both — and check its maternity waiting period if a baby’s planned.');
  if (f.age === '18_30') return P('starter', 'Just starting out', 'Start cheap, start now',
    'Premiums are lowest at your age, and waiting periods start the day you buy. Start now.',
    'Good that you’re covered young. Never let it lapse — every renewal counts towards waiting periods.');
  return P('solo', 'Covering yourself', 'Keep bills off your savings',
    'It’s just you: solid cover in your own name keeps hospital bills off your savings.',
    'Your health cover is the base. Make sure it keeps up as medical costs rise.');
}
