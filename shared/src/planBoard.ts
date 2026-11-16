/**
 * v5 "Your cover plan" — the one-screen result, written for the person in front of us (persona.ts).
 *   health cover you need (vs what you have) · our advice for it · term insurance · crisis (critical illness) cover
 * Each block carries a priority for THIS person — Must have / Good to have / Later / Not for you / Covered — and the
 * honest version: if they don't need something, we say so and why. If they're covered, we say "keep your plan".
 * If they don't know what they have, we ask to read their policy before suggesting anything.
 *
 * Every figure is the person's own answer, a stated rule below, a published figure (benchmarks.ts) or a price
 * Turtlemint has entered. Nothing is estimated.
 * Rules (VALIDATION REQUIRED — Turtlemint advisory/actuarial team to confirm before go-live):
 *   Health  : suggestedCoverLakh() in advice.ts.
 *   Term    : yearly take-home × TERM_MULTIPLE for the age band, till age 60. Not offered at 61+.
 *   Crisis  : CRISIS_YEARS × yearly take-home (income while you recover), ₹10 L – ₹1 Cr.
 *   Income  : midpoint of the band they picked; "Rather not say" → no figure, the advisor sizes it.
 */
import type { QuizAnswers } from './types';
import type { AgeBand } from './enums';
import { suggestedCoverLakh } from './advice';
import { BAND_LAKH, BENCHMARKS as B, type SourceId } from './benchmarks';
import { familyLabel, hasParents60, withMembers } from './quiz';
import { PLAN_DETAILS, PLAN_PAGES, getApprovedTurtlemintPick, withUtm, type PlanType } from './planCatalog';
import { lifeFacts, personaFor, type Persona, type AdvicePriority } from './persona';

export const TERM_MULTIPLE: Record<Exclude<AgeBand, '61p'>, number> = { '18_30': 15, '31_40': 15, '41_50': 12, '51_60': 10 };
export const CRISIS_YEARS = 3;
export const INCOME_MID_MONTHLY: Record<string, number> = { lt25k: 20_000, '25_50k': 37_500, '50k_1l': 75_000, '1_2l': 150_000, '2lp': 250_000 };

export interface PickView {
  /** plan = something to buy · keep = no change needed · check = read their policy first */
  kind: 'plan' | 'keep' | 'check';
  type: PlanType | null;
  title: string;
  tagline: string;
  points: string[];
  short: [string, string];
  /** Why this, in their terms — e.g. "Adds ₹15 L on top of your ₹5 L policy". */
  why: string;
  /** Things an advisor would tell someone like them (budget, city, age, family, free government cover). */
  tips: string[];
  /** The amount to buy, e.g. "+₹15 L", "₹1.25 Cr"; null when the advisor sizes it. */
  amount: string | null;
  price: { fromInr: number; per: 'month' | 'year'; note: string | null } | null;
  insurer: string | null;
  product: string | null;
  url: string;
  /** Rule key, stored with the recommendation for analytics and the telecaller. */
  reason: string;
  sourceId?: SourceId;
}

/** For a block we advise against (or say can wait): the honest reason, and when it becomes worth it. */
export interface Explain { title: string; lines: string[] }

export interface NeedBlock {
  title: string; need: string | null; caption: string; rule: string;
  priority: AdvicePriority; explain: Explain | null; pick: PickView;
}

export interface PlanBoard {
  persona: Persona;
  eyebrow: string;
  headline: string;
  note: string;
  profile: string;
  health: {
    needLakh: number; haveLakh: number | null; haveLabel: string; pct: number | null; priority: AdvicePriority;
    alert: { text: string; tone: 'risk' | 'good' } | null;
  };
  healthPick: PickView;
  parentsPick: PickView | null;
  term: NeedBlock | null;
  crisis: NeedBlock;
  /** Plans actually suggested (kind = plan), in display order — recorded as "shown". */
  picks: PickView[];
}

/** ₹70 L · ₹1.25 Cr */
export function inr(n: number): string {
  if (n >= 10_000_000) return `₹${(+(n / 10_000_000).toFixed(2)).toString()} Cr`;
  return `₹${Math.round(n / 100_000)} L`;
}
const roundTerm = (n: number) => (n >= 10_000_000 ? Math.round(n / 2_500_000) * 2_500_000 : Math.round(n / 1_000_000) * 1_000_000);
const AGE_LABEL: Record<string, string> = { '18_30': '18–30', '31_40': '31–40', '41_50': '41–50', '51_60': '51–60', '61p': '61+' };
const L = (n: number) => `₹${n} L`;

function plan(type: PlanType, why: string, amount: string | null, reason: string, tips: string[] = []): PickView {
  const d = PLAN_DETAILS[type];
  const p = getApprovedTurtlemintPick(type);
  return {
    kind: 'plan', type, title: d.title, tagline: d.tagline, points: d.points, short: d.short, why, tips, amount, reason,
    price: p.startingPriceInr ? { fromInr: p.startingPriceInr, per: p.per, note: p.priceNote } : null,
    insurer: p.insurer, product: p.product, url: withUtm(p.url ?? PLAN_PAGES[type], type, 'quiz'),
  };
}
const advice = (kind: 'keep' | 'check', title: string, tagline: string, short: [string, string], why: string, points: string[], reason: string, tips: string[] = []): PickView =>
  ({ kind, type: null, title, tagline, points, short, why, tips, amount: null, price: null, insurer: null, product: null, url: '', reason });

export function yearlyIncome(a: QuizAnswers): number | null {
  const m = a.income_band ? INCOME_MID_MONTHLY[a.income_band] : undefined;
  return m ? m * 12 : null;
}
export function termNeedInr(a: QuizAnswers): number | null {
  const y = yearlyIncome(a);
  if (!y || !a.age_band || a.age_band === '61p') return null;
  return roundTerm(y * TERM_MULTIPLE[a.age_band]);
}
export function crisisNeedInr(a: QuizAnswers): number | null {
  const y = yearlyIncome(a);
  if (!y) return null;
  return Math.min(10_000_000, Math.max(1_000_000, Math.round((y * CRISIS_YEARS) / 500_000) * 500_000));
}

export function buildPlanBoard(input: QuizAnswers, firstName?: string | null): PlanBoard {
  const a = withMembers(input);
  const persona = personaFor(a);
  const f = lifeFacts(a);
  const people = 1 + (f.partner ? 1 : 0) + f.kids;
  const family = people > 1;
  const need = suggestedCoverLakh(a);
  const A = a.situation === 'none';
  const companyOnly = a.situation === 'group' && a.personal_policy_besides_group !== 'yes';
  const band = a.sum_insured_band;
  const have = A ? 0 : band && band !== 'unsure' ? BAND_LAKH[band]! : null;
  const gap = have === null ? null : Math.max(0, need - have);
  const lowIncome = a.income_band === 'lt25k' || a.income_band === '25_50k';
  const highIncome = a.income_band === '1_2l' || a.income_band === '2lp';
  const senior = a.age_band === '61p';
  const parents60 = hasParents60(a);

  // ---------------------------------------------------------------- what an advisor would add for someone like them
  const healthTips: string[] = [];
  if (highIncome) healthTips.push('At your income, pick a plan with no room-rent cap — any room you need, and the bill isn’t cut.');
  if (lowIncome && need > 10) healthTips.push(`Tight budget? A ₹10 L base plan plus a super top-up is usually the cheapest way to reach ${L(need)}.`);
  if (a.income_band === 'lt25k') healthTips.push(`Also check if your family qualifies for Ayushman Bharat PM-JAY — free cover up to ₹${B.pmjayLakh} L a year.`);
  if (a.city_tier === 'metro') healthTips.push('Hospital bills are higher in metros, so we sized this for a metro hospital.');
  if (a.city_tier === 'other') healthTips.push(`Costs are lower outside the big metros, so ${L(need)} goes further where you live.`);
  if (persona.id === 'couple') healthTips.push('If a baby is in your plans, compare maternity cover and its waiting period before you buy.');
  if (a.age_band === '41_50' || a.age_band === '51_60') healthTips.push('Insurers may ask for a routine health check-up before cover starts at your age — that’s normal.');
  if (senior) healthTips.push('Look closely at co-pay: many senior plans ask you to pay a share of every claim.',
    `By IRDAI rules, the wait for existing illnesses can’t be longer than ${B.pedWaitMaxMonths / 12} years.`);
  if (companyOnly) healthTips.push('Keep your company cover as an extra — this is the plan that stays when the job doesn’t.');

  // ---------------------------------------------------------------- health
  const alert: PlanBoard['health']['alert'] =
    companyOnly ? { text: '₹0 cover the day you leave your job', tone: 'risk' }
    : A ? { text: 'Every hospital bill is yours today', tone: 'risk' }
    : gap ? { text: `${L(gap)} of a big bill would be yours`, tone: 'risk' }
    : have === null ? { text: 'You’re not sure what you have', tone: 'risk' }
    : parents60 ? { text: 'Parents need a plan of their own', tone: 'risk' }
    : { text: 'Enough for today', tone: 'good' };

  const healthPick: PickView =
    A || companyOnly
      ? (senior && !family
        ? plan('senior_citizen', `Covers the ${L(need)} you need, built for your age.`, L(need), 'A_senior', healthTips)
        : family
          ? plan('family_floater', `One ${L(need)} cover for all ${people} of you${companyOnly ? ' — and it stays if you leave your job' : ''}.`, L(need), companyOnly ? 'C_no_personal' : 'A_family', healthTips)
          : plan('individual', companyOnly ? `${L(need)} that stays with you if you leave your job.` : `The ${L(need)} you need, in your own name.`, L(need), companyOnly ? 'C_no_personal' : 'A_individual', healthTips))
      : have === null
        ? advice('check', 'Check your policy first', 'We read it for you — free, in plain words.', ['Free, takes 2 minutes', 'Shows your exact gaps'],
          'You weren’t sure of your cover. Before you buy anything, let’s see what you already have.',
          ['Upload a photo or PDF of your policy', 'We show what it covers, page by page', 'You only buy what’s actually missing'], 'unsure_cover')
        : gap
          ? plan('super_top_up', `Adds ${L(gap)} on top of your ${L(have)} — and you keep the waiting periods you’ve already served.`, `+${L(gap)}`, 'low_cover', healthTips)
          : advice('keep', 'Keep your plan', 'No change needed today.', ['Enough cover today', 'Review at each renewal'],
            `${have >= 25 && band === '25p' ? '₹25 L+' : L(have)} meets the ${L(need)} we suggest for ${family ? 'your family' : 'you'}. We won’t sell you more.`,
            [`Medical costs rise about ${B.medicalInflationPct}% a year — check your cover at each renewal`, 'Renew without a break so the waiting you’ve served carries on', 'If costs catch up, a super top-up is the cheapest fix'], 'keep_health');

  const parentsPick = parents60 && !(senior && !family)
    ? plan('senior_citizen', `${f.parents > 1 ? 'Your parents get' : 'Your parent gets'} their own plan, so their age doesn’t raise your family’s premium.`, null, 'parents_60',
      [`If a parent is ${B.vayVandanaAge} or older, they can get free ₹${B.vayVandanaLakh} L a year under Ayushman Vay Vandana — whatever their income. Use it alongside their plan.`,
        `By IRDAI rules, the wait for existing illnesses can’t be longer than ${B.pedWaitMaxMonths / 12} years.`])
    : null;
  if (parentsPick) parentsPick.sourceId = 'pib_vay_vandana';

  // ---------------------------------------------------------------- term
  const termInr = termNeedInr(a);
  const termPriority: AdvicePriority = persona.priorities.term;
  const term: NeedBlock | null = senior && termPriority === 'skip' && a.age_band === '61p' ? {
    title: 'Term insurance', need: null, caption: 'Rarely worth it after 60', rule: '', priority: 'skip',
    explain: { title: 'Skip term insurance', lines: ['After 60, term cover is rarely available or worth the premium.', 'Your health cover and savings do more for you now — and we won’t suggest something you don’t need.'] },
    pick: plan('term_life', 'Not suggested at your age.', null, 'term_skip'),
  } : {
    title: 'Term insurance',
    need: termInr ? inr(termInr) : null,
    caption: termPriority === 'later' ? 'When someone depends on you' : termPriority === 'skip' ? 'Few years left to 60' : 'Cover till you’re 60',
    rule: termInr && a.age_band && a.age_band !== '61p' ? `${TERM_MULTIPLE[a.age_band]}× your yearly income` : 'Sized with your advisor',
    priority: termPriority,
    explain: termPriority === 'later'
      ? { title: 'Term insurance can wait', lines: ['Term cover pays your family if you’re not there — right now, no one depends on your income.',
          'Revisit it when you marry, have a child or take a home loan. Buying young keeps the premium low for life.'] }
      : termPriority === 'skip'
        ? { title: 'Skip term insurance for now', lines: ['With no one depending on your income and only a few years to 60, term cover isn’t worth the premium.',
            'Put that money into health and crisis cover instead.'] }
        : null,
    pick: plan('term_life',
      f.kids ? `If you’re not there, your family gets ${termInr ? inr(termInr) : 'a lump sum'} — enough to see the kids through school and college.`
        : persona.dependents ? `If you’re not there, the people who depend on you get ${termInr ? inr(termInr) : 'a lump sum'} to keep going.`
        : 'Lowest price while you’re young — it matters most once someone depends on you.',
      termInr ? inr(termInr) : null, 'term_income',
      [...(persona.dependents ? ['If you have a home or car loan, add what’s left on it to this cover.'] : []),
        ...(termInr ? [] : ['Your advisor will size this from your income on the call.'])]),
  };

  // ---------------------------------------------------------------- crisis
  const crisisInr = crisisNeedInr(a);
  const crisis: NeedBlock = {
    title: 'Crisis cover',
    need: crisisInr ? inr(crisisInr) : null,
    caption: 'Cancer · heart · stroke',
    rule: crisisInr ? `${CRISIS_YEARS} years of your income` : 'Sized with your advisor',
    priority: persona.priorities.crisis,
    explain: null,
    pick: plan('critical_illness', `A lump sum on diagnosis — ${crisisInr ? `${inr(crisisInr)}, about ${CRISIS_YEARS} years of income` : 'your income'} while you recover.`,
      crisisInr ? inr(crisisInr) : null, 'crisis_income',
      ['It pays even when your health cover pays the hospital — use it for EMIs, rent and recovery.',
        ...(a.age_band === '41_50' || a.age_band === '51_60' ? ['The risk of serious illness rises with age — this matters more in your 40s and 50s.'] : []),
        ...(senior ? ['Entry-age limits apply — your advisor will check what’s available for you.'] : []),
        ...(crisisInr ? [] : ['Your advisor will size this from your income on the call.'])]),
  };

  // ---------------------------------------------------------------- the opening, in their situation
  const headline =
    A ? persona.headline
    : companyOnly ? 'Your cover is tied to your job'
    : have === null ? 'First, let’s see what you have'
    : gap ? `Good start — ${L(gap)} to go`
    : 'Your health cover looks good';
  const note =
    A ? persona.note
    : companyOnly ? 'Leave or lose the job and cover stops that day. A plan of your own stays — and its waits start now.'
    : have === null ? 'Share your policy and we’ll read it for you — in plain words, with only the gaps that matter.'
    : persona.noteHave;

  const city = a.city_tier === 'metro' ? 'Metro' : a.city_tier === 'other' ? 'Other city' : null;
  const profile = [familyLabel(a), a.age_band ? AGE_LABEL[a.age_band] : null, city].filter(Boolean).join(' · ');
  const all = [healthPick, ...(parentsPick ? [parentsPick] : []), ...(term && (term.priority === 'must' || term.priority === 'good') ? [term.pick] : []), crisis.pick];

  return {
    persona,
    eyebrow: firstName ? `For ${firstName} · ${persona.label}` : persona.label,
    headline, note, profile,
    health: {
      needLakh: need, haveLakh: have,
      haveLabel: A ? 'None' : have === null ? 'Not sure' : band === '25p' ? '₹25 L+' : L(have),
      pct: have === null ? null : Math.min(100, Math.round((have / need) * 100)),
      priority: healthPick.kind === 'keep' ? 'done' : 'must',
      alert,
    },
    healthPick, parentsPick, term, crisis,
    picks: all.filter((p) => p.kind === 'plan'),
  };
}
