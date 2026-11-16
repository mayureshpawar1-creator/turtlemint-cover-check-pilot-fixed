/**
 * "Plans that fit": plan types matched to what the person told us, each linking to its page on turtlemintinsurance.com.
 * A named insurer product and price appear only when Turtlemint's product team fills TURTLEMINT_PICKS (planCatalog.ts).
 * VALIDATION REQUIRED: wording + whether category pages count as "showing plans".
 */
import type { QuizAnswers, PolicyFactView } from './types';
import { PLAN_DETAILS, PLAN_PAGES, withUtm, type PlanType } from './planCatalog';
import { buildPlanBoard } from './planBoard';
import { buildPolicyBoard } from './policyBoard';

export { PLAN_TYPES, PLAN_PAGES, PLAN_TITLE, PLAN_DETAILS, TURTLEMINT_PICKS, attributeUrl, type PlanType, type PlanDetail, type TurtlemintPick } from './planCatalog';

export interface PlanRec {
  type: PlanType;
  title: string;
  why: string;          // tied to their own answers
  points: string[];     // general, non-promotional facts
  cta: string;
  url: string;          // with UTM so visits are attributed
  reason: string;       // rule key, stored for analytics + telecaller
}

const make = (type: PlanType, why: string, reason: string, origin: 'quiz' | 'document'): PlanRec =>
  ({ type, title: PLAN_DETAILS[type].title, points: PLAN_DETAILS[type].points, cta: PLAN_DETAILS[type].cta, why, reason,
     url: withUtm(PLAN_PAGES[type], type, origin) });

/** Exactly the picks on the one-screen cover plan (health, and parents 60+), so "shown" matches the screen. v5: no term or crisis. */
export function recommendPlans(a: QuizAnswers): PlanRec[] {
  return buildPlanBoard(a).picks.filter((p) => p.type).map((p) => ({ type: p.type!, title: p.title, why: p.why, points: p.points, cta: PLAN_DETAILS[p.type!].cta, url: p.url, reason: p.reason }));
}

/** From an uploaded policy's confirmed facts: exactly the advice on the policy board (none when the advice is "keep it"). */
export function recommendFromPolicy(facts: PolicyFactView[], quiz: QuizAnswers = {}): PlanRec[] {
  return buildPolicyBoard(facts, quiz).picks.filter((p) => p.type)
    .map((p) => ({ type: p.type!, title: p.title, why: p.why, points: p.points, cta: PLAN_DETAILS[p.type!].cta, url: p.url, reason: p.reason }));
}
