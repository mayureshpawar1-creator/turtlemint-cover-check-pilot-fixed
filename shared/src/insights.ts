/**
 * S7 "Your cover snapshot": value back for the answers people gave.
 *  - strengths: what is already working, with a published benchmark where one exists
 *  - compare:   context charts ("how you compare"), every figure sourced
 *  - checklist: 5–6 boxes; the ones not ticked are the things to look at, each with a next step
 * Wording is a draft for compliance. No overall score, no insurer names, no advice to replace a policy.
 */
import type { QuizAnswers } from './types';
import { BAND_LAKH, BENCHMARKS as B, realValueAfter, type SourceId } from './benchmarks';
import { SUM_LABEL } from './readout';
import { suggestedCoverLakh } from './advice';
import { hasParents60 } from './quiz';

export type CheckStatus = 'good' | 'check' | 'unknown' | 'tip';
export type NextStepKind = 'upload' | 'advisor' | 'plans';

export interface Strength { id: string; title: string; body: string; sourceId?: SourceId }

export type CompareViz =
  | { type: 'share'; title: string; segments: { key: string; label: string; pct: number; you: boolean }[]; caption: string; sourceId: SourceId }
  | { type: 'bars'; title: string; unit: '₹ L'; bars: { label: string; value: number; you: boolean; note?: string }[]; caption: string; sourceId: SourceId }
  | { type: 'stat'; title: string; value: string; caption: string; sourceId: SourceId };

export interface ChecklistItem {
  id: 'cover_amount' | 'room_rent' | 'waiting' | 'family' | 'parents' | 'beyond_job' | 'renewal' | 'cashless';
  label: string;
  status: CheckStatus;
  detail: string;
  howToCheck?: string;
  next?: { kind: NextStepKind; label: string };
}

export interface Snapshot { strengths: Strength[]; compare: CompareViz[]; checklist: ChecklistItem[] }

const lakh = (n: number) => `₹${n % 1 ? n.toFixed(1) : n} L`;

export function buildSnapshot(a: QuizAnswers): Snapshot {
  const A = a.situation === 'none', Bp = a.situation === 'own', C = a.situation === 'group';
  const strengths: Strength[] = [];
  const compare: CompareViz[] = [];
  const checklist: ChecklistItem[] = [];
  const band = a.sum_insured_band;
  const bandLakh = band && band !== 'unsure' ? BAND_LAKH[band]! : null;
  const parents60 = hasParents60(a); // one definition (quiz.ts), shared with the plan board and readout
  const need = suggestedCoverLakh(a);

  // ---------------------------------------------------------------- where you stand among insured Indians
  if (Bp || C) {
    compare.push({
      type: 'share', sourceId: 'irdai_ar_2425',
      title: `How ${B.livesCoveredCrore.toFixed(0)} crore insured Indians are covered`,
      segments: [
        { key: 'government', label: 'Government schemes', pct: B.coverShare.government, you: false },
        { key: 'group', label: 'Through work', pct: B.coverShare.group, you: C },
        { key: 'individual', label: 'Bought themselves', pct: B.coverShare.individual, you: Bp },
      ],
      caption: Bp ? `You are one of about ${B.individualLivesCrore.toFixed(0)} crore people who chose their own policy.`
        : `You are one of about ${B.groupLivesCrore.toFixed(1)} crore people covered through work.`,
    });
  }
  if (C) strengths.push({ id: 'work_cover', title: 'You have cover through work',
    body: `Your employer’s policy pays hospital bills while you’re in this job — like ${B.groupLivesCrore.toFixed(1)} crore other Indians. It’s a strong base to build on.`, sourceId: 'irdai_ar_2425' });
  if (Bp) strengths.push({ id: 'own_policy', title: 'You chose your own cover',
    body: `Only about 1 in 10 insured Indians bought a policy themselves. Your cover stays with you whatever your job.`, sourceId: 'irdai_ar_2425' });
  if (A) {
    compare.push({ type: 'stat', sourceId: 'niti_2021', title: 'You are not alone', value: `${B.missingMiddleCrore} crore`,
      caption: `Indians — at least ${B.missingMiddlePct}% of the population — have no financial protection for health. Checking now puts you ahead.` });
    strengths.push({ id: 'first_step', title: 'You are planning ahead', body: 'Looking at cover before you need it gives you the widest choice of plans and the shortest waiting periods.' });
  }

  // ---------------------------------------------------------------- cover amount
  if (bandLakh !== null) {
    const real = realValueAfter(bandLakh);
    compare.push({
      type: 'bars', unit: '₹ L', sourceId: 'milliman_2026',
      title: A ? 'The cover you want, in context' : 'Your cover, in context',
      bars: [
        { label: A ? 'Cover you want' : 'Your cover', value: bandLakh, you: true, note: band === '25p' ? '25+' : undefined },
        { label: 'What your family needs', value: need, you: false },
        { label: `Your cover in 5 yrs, today’s prices`, value: real, you: false },
      ],
      caption: `At about ${B.medicalInflationPct}% medical inflation a year, ${lakh(bandLakh)} will pay for roughly what ${lakh(real)} does today.`,
    });
  }
  if (bandLakh !== null && bandLakh >= need) {
    strengths.push({ id: 'cover_amount', title: 'Your cover meets what your family needs',
      body: `You have ${SUM_LABEL[band!]}; we suggest about ${lakh(need)} for your family, age and city.`, sourceId: 'cover_rule' });
    checklist.push({ id: 'cover_amount', label: 'Cover amount', status: 'good', detail: `${SUM_LABEL[band!]} — at or above the ${lakh(need)} we suggest.` });
  } else if (band && band !== 'unsure') {
    checklist.push({ id: 'cover_amount', label: 'Cover amount', status: A ? 'tip' : 'check',
      detail: `${SUM_LABEL[band]} is below the ${lakh(need)} we suggest for your family, and medical costs rise about ${B.medicalInflationPct}% a year.`,
      howToCheck: A ? 'Ask for quotes at two cover levels and compare the premium difference.' : 'A super top-up can raise cover on top of your current policy, often for a smaller premium than a new base plan.',
      next: { kind: 'plans', label: A ? 'See plan options' : 'See ways to raise cover' } });
  } else if (band === 'unsure') {
    checklist.push({ id: 'cover_amount', label: 'Cover amount', status: 'unknown', detail: 'You weren’t sure of your cover amount.',
      howToCheck: 'It is printed on your policy schedule or e-card as “Sum insured”.', next: { kind: 'upload', label: 'Read it from my policy' } });
  }

  // ---------------------------------------------------------------- room rent
  if (Bp || C) {
    if (a.room_rent_limit === 'no_limit') {
      strengths.push({ id: 'room_rent', title: 'No room-rent cap', body: 'Your bill is not cut in proportion if you pick a bigger room — one of the most common reasons claims are paid short.' });
      checklist.push({ id: 'room_rent', label: 'Room rent', status: 'good', detail: 'No limit — the whole bill is assessed normally.' });
    } else checklist.push({ id: 'room_rent', label: 'Room rent', status: a.room_rent_limit === 'limit' ? 'check' : 'unknown',
      detail: a.room_rent_limit === 'limit' ? `There is a limit${a.room_rent_note ? ` (${a.room_rent_note})` : ''}. A room above it can reduce what is paid on the whole bill.` : 'You weren’t sure if your policy limits room rent.',
      howToCheck: 'Look for “Room rent” or “Room category” in the policy schedule or benefits table.',
      next: a.room_rent_limit === 'limit' ? { kind: 'plans', label: 'See plans without room-rent caps' } : { kind: 'upload', label: 'Check it from my policy' } });
  } else checklist.push({ id: 'room_rent', label: 'Room rent', status: 'tip', detail: 'Look for plans with no room-rent cap, so a bigger room never reduces the rest of the bill.' });

  // ---------------------------------------------------------------- waiting periods
  if (Bp) {
    if (a.policy_age_band === '3_5' || a.policy_age_band === '5p') {
      strengths.push({ id: 'waiting', title: 'Your waiting periods are likely served',
        body: `Since 2024, waiting periods for existing conditions are capped at ${B.pedWaitMaxMonths} months. ${a.policy_age_band === '5p' ? `After ${B.moratoriumYears} years of continuous cover, a claim can’t be refused for non-disclosure except for fraud.` : 'Renew without a break to keep this.'}`,
        sourceId: 'irdai_mc_2024' });
      checklist.push({ id: 'waiting', label: 'Waiting periods', status: 'good', detail: `Policy held ${a.policy_age_band === '5p' ? '5+' : '3 to 5'} years — past the ${B.pedWaitMaxMonths}-month cap for existing conditions.` });
    } else checklist.push({ id: 'waiting', label: 'Waiting periods', status: a.policy_age_band === 'unsure' ? 'unknown' : 'check',
      detail: a.health_condition === 'yes' ? 'Existing conditions may still be in their waiting period.' : 'Some treatments may still be in their waiting period.',
      howToCheck: `Find “Pre-existing disease waiting period” in your policy. Since 2024 it can be at most ${B.pedWaitMaxMonths} months.`,
      next: { kind: 'upload', label: 'Work out what I’ve served' } });
  } else if (A) {
    checklist.push({ id: 'waiting', label: 'Waiting periods', status: 'tip',
      detail: `Compare the waiting period for existing conditions — the legal maximum is ${B.pedWaitMaxMonths} months, many plans are shorter.` });
  }

  // ---------------------------------------------------------------- family / parents
  if (C) {
    if (a.family_in_group_cover === 'yes') {
      strengths.push({ id: 'family', title: 'Your family is in your company cover', body: 'Spouse and children are covered under the same group policy.' });
      checklist.push({ id: 'family', label: 'Family covered', status: 'good', detail: 'Your company policy includes your family.' });
    } else checklist.push({ id: 'family', label: 'Family covered', status: a.family_in_group_cover === 'only_me' ? 'check' : 'unknown',
      detail: a.family_in_group_cover === 'only_me' ? 'Only you are covered at work.' : 'You weren’t sure who your company policy covers.',
      howToCheck: 'Your HR portal or e-card lists everyone covered.', next: { kind: 'plans', label: 'See family plans' } });
  }
  if (parents60) {
    checklist.push({ id: 'parents', label: 'Parents over 60', status: A ? 'tip' : 'check',
      detail: 'Cover for parents above 60 often comes with co-pay and different waiting periods. Since 2024 insurers can’t refuse cover on age alone.',
      next: { kind: 'plans', label: 'See senior citizen plans' } });
  }

  // ---------------------------------------------------------------- cover beyond the job
  if (C) {
    const ok = a.personal_policy_besides_group === 'yes' || a.job_exit_cover === 'own_policy';
    if (ok) {
      strengths.push({ id: 'beyond_job', title: 'You’re covered beyond your job', body: 'You also have a personal policy, so a job change doesn’t leave you without cover.' });
      checklist.push({ id: 'beyond_job', label: 'Cover beyond your job', status: 'good', detail: 'You have a personal policy as well.' });
    } else checklist.push({ id: 'beyond_job', label: 'Cover beyond your job', status: a.job_exit_cover === 'unsure' ? 'unknown' : 'check',
      detail: 'Company cover usually ends when the job does. A personal policy keeps you covered and starts its waiting periods now.',
      next: { kind: 'plans', label: 'See personal plans' } });
  }

  // ---------------------------------------------------------------- renewal / timing
  if (Bp) {
    if (a.renewal_window === 'lt1m') checklist.push({ id: 'renewal', label: 'Renewal', status: 'check', detail: 'Your renewal is within a month — a good moment to read what changed.', next: { kind: 'advisor', label: 'Go through it with an advisor' } });
    else if (a.renewal_window === 'unsure') checklist.push({ id: 'renewal', label: 'Renewal', status: 'unknown', detail: 'You weren’t sure when your policy renews.', howToCheck: 'The renewal date is the policy end date on your schedule.', next: { kind: 'upload', label: 'Read it from my policy' } });
    else if (a.renewal_window) checklist.push({ id: 'renewal', label: 'Renewal', status: 'good', detail: `Renews ${a.renewal_window === '1_3m' ? 'in 1 to 3 months' : 'in 3 to 12 months'} — time to review calmly before then.` });
  }
  checklist.push({ id: 'cashless', label: 'Cashless hospitals near you', status: 'tip',
    detail: `${B.cashlessSharePct}% of health claims in India were settled cashless in FY25. Check that hospitals near you are in the network.` });

  // tips last, then good, so the boxes still to tick come first
  const order: Record<CheckStatus, number> = { check: 0, unknown: 1, good: 2, tip: 3 };
  checklist.sort((x, y) => order[x.status] - order[y.status]);
  return { strengths: strengths.slice(0, 4), compare: compare.slice(0, 3), checklist };
}

export const checklistProgress = (items: ChecklistItem[], marked: Set<string>) => {
  const scored = items.filter((i) => i.status !== 'tip');
  const done = scored.filter((i) => i.status === 'good' || marked.has(i.id)).length;
  return { done, total: scored.length };
};
