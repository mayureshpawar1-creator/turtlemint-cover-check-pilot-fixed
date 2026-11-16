/**
 * v5 "Your policy, understood" — the one-screen result after an upload, built the same way as the quiz board.
 *   [ who you are · insurer · plan ]
 *   [ your cover vs what you need ] [ our advice — in your interest ]
 *   [ inside your policy: room rent · existing illnesses · co-pay · renewal ]  (tap any → plain words + what to do)
 * Best interest first: if the policy is fine we say "keep it"; if it's short we suggest a top-up that KEEPS the waiting
 * time they've served instead of a new policy that restarts it; if they ever switch, we tell them about portability.
 * Every value is read from their document (with page), our stated cover rule, or a published rule. Nothing is guessed.
 */
import type { PolicyFactView, QuizAnswers } from './types';
import type { AgeBand, Member } from './enums';
import { suggestedCoverLakh } from './advice';
import { buildPolicyHealth } from './policyHealth';
import { buildCoverSummary } from './coverSummary';
import { BENCHMARKS as B, type SourceId } from './benchmarks';
import { PLAN_DETAILS, PLAN_PAGES, getApprovedTurtlemintPick, withUtm, type PlanType } from './planCatalog';
import { personaFor, type Persona } from './persona';
import { withMembers } from './quiz';
import type { PickView } from './planBoard';

/**
 * Reads who is covered from the "members" fact, e.g. "Self (36), Spouse (34), 2 children, Mother (63)".
 * The age band is the policyholder's own (self, else spouse) — not a parent's — so a family policy that includes
 * a 63-year-old mother isn't treated as a senior's policy.
 */
export function answersFromFacts(facts: PolicyFactView[]): QuizAnswers {
  const m = facts.find((f) => f.key === 'members');
  const text = (m?.userValue ?? m?.value ?? '').toLowerCase();
  if (!text) return {};
  let partner = false, kids = 0, parents = 0;
  let selfAge: number | null = null, spouseAge: number | null = null;
  const others: number[] = [];
  for (const part of text.split(/,|&| and /).map((x) => x.trim()).filter(Boolean)) {
    const age = Number(part.match(/\((\d{1,2})\)/)?.[1] ?? NaN);
    if (/father|mother|parent|in-law|in law/.test(part)) { parents += Number(part.match(/^(\d+)\s/)?.[1] ?? 1); continue; }
    if (/child|son|daughter|kid/.test(part)) { kids += Number(part.match(/^(\d+)\s/)?.[1] ?? 1); continue; }
    if (/spouse|wife|husband/.test(part)) { partner = true; if (!Number.isNaN(age)) spouseAge = age; continue; }
    if (/self|proposer|insured/.test(part)) { if (!Number.isNaN(age)) selfAge = age; continue; }
    if (!Number.isNaN(age)) others.push(age);
  }
  const own = selfAge ?? spouseAge ?? (others.length ? Math.max(...others) : null);
  const age_band: AgeBand | undefined = own === null ? undefined
    : own <= 30 ? '18_30' : own <= 40 ? '31_40' : own <= 50 ? '41_50' : own <= 60 ? '51_60' : '61p';
  const members: Member[] = ['self'];
  if (partner) members.push('spouse');
  if (kids) members.push('children');
  if (parents) members.push('parents');
  return { situation: 'own', members, age_band, adults_count: partner ? 2 : 1, children_count: Math.min(kids, 6), parents_count: Math.min(parents, 4) };
}
export type PolicyCheckStatus = 'good' | 'watch' | 'risk' | 'unknown';
export interface PolicyCheck {
  id: 'room_rent' | 'waiting' | 'copay' | 'renewal';
  label: string;
  value: string;
  status: PolicyCheckStatus;
  page: number | null;
  /** What it means for them, in plain words. */
  explain: string[];
  /** What we'd do in their place. */
  todo: string | null;
  sourceId?: SourceId;
}

export interface PolicyBoard {
  persona: Persona;
  insurer: string | null;
  plan: string | null;
  eyebrow: string;
  headline: string;
  note: string;
  cover: { haveLakh: number | null; needLakh: number; pct: number | null; people: number; floater: boolean;
    alert: { text: string; tone: 'risk' | 'good' } | null };
  pick: PickView;
  checks: PolicyCheck[];
  plain: { title: string; lines: { text: string; page: number | null; found: boolean }[] }[];
  picks: PickView[];
}

const L = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(1)} L`;
const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMonth = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

function plan(type: PlanType, why: string, amount: string | null, reason: string, tips: string[]): PickView {
  const d = PLAN_DETAILS[type];
  const p = getApprovedTurtlemintPick(type);
  return {
    kind: 'plan', type, title: d.title, tagline: d.tagline, points: d.points, short: d.short, why, tips, amount, reason,
    price: p.startingPriceInr ? { fromInr: p.startingPriceInr, per: p.per, note: p.priceNote } : null,
    insurer: p.insurer, product: p.product, url: withUtm(p.url ?? PLAN_PAGES[type], type, 'document'),
  };
}

export function buildPolicyBoard(facts: PolicyFactView[], quiz: QuizAnswers = {}, today = new Date()): PolicyBoard {
  const v = (k: string) => { const f = facts.find((x) => x.key === k); return f ? (f.userValue ?? f.value) : null; };
  const page = (k: string) => facts.find((x) => x.key === k)?.sourcePage ?? null;
  const answers = withMembers({ ...answersFromFacts(facts), ...Object.fromEntries(Object.entries(quiz).filter(([, x]) => x !== undefined)) });
  const persona = personaFor(answers);
  const need = suggestedCoverLakh(answers);
  const health = buildPolicyHealth(facts, today, need);
  const siInr = Number(v('sum_insured_inr')) || 0;
  const have = siInr ? siInr / 100_000 : null;
  const gap = have === null ? null : Math.max(0, need - have);
  const membersText = v('members') ?? '';
  const kids = Number(membersText.match(/(\d+)\s+(child|children|kids?|sons?|daughters?)/i)?.[1] ?? 0);
  const people = Math.max(1, membersText.split(/,|&| and /i).map((x) => x.trim()).filter(Boolean).length - (kids ? 1 : 0) + kids);
  const floater = v('policy_type') === 'floater' || people > 1;

  // ---------------------------------------------------------------- inside your policy (fixed four, same place every time)
  const rr = v('room_rent_limit');
  const capped = !!rr && !/none|no limit/i.test(rr);
  const capPerDay = capped && /1%/.test(rr!) && siInr ? Math.round(siInr * 0.01) : null;
  const copayRaw = v('copay_percent');
  const copay = copayRaw === null || copayRaw.trim() === '' || !Number.isFinite(Number(copayRaw)) ? null : Number(copayRaw);
  const end = v('end_date') ? new Date(v('end_date')!) : null;
  const daysLeft = end && !Number.isNaN(end.getTime()) ? Math.ceil((end.getTime() - today.getTime()) / 86_400_000) : null;
  const w = health.waiting;
  const coveredFrom = w ? new Date(new Date(w.startDate).setMonth(new Date(w.startDate).getMonth() + w.waitMonths)) : null;

  const checks: PolicyCheck[] = [
    !rr ? { id: 'room_rent', label: 'Room rent', value: 'Not found', status: 'unknown', page: null,
        explain: ['We couldn’t find a room-rent rule in the pages you shared.', 'Depending on the policy wording, a room-rent limit may affect more than the room charge.'], todo: 'Your advisor can check the full policy wording for you.' }
    : capped ? { id: 'room_rent', label: 'Room-rent cap', value: capPerDay ? `₹${capPerDay.toLocaleString('en-IN')}/day` : 'Yes, capped', status: 'risk', page: page('room_rent_limit'),
        explain: [`Your policy pays room rent up to ${capPerDay ? `₹${capPerDay.toLocaleString('en-IN')} a day (${rr})` : rr}.`,
          'Depending on the policy wording, choosing a room above the limit may affect eligible related expenses too.'],
        todo: 'Until you change it, pick a room within the limit. At renewal, ask for a plan without a cap.' }
    : { id: 'room_rent', label: 'Room rent', value: 'No cap', status: 'good', page: page('room_rent_limit'),
        explain: ['The value found says there is no room-rent limit. Other policy limits, exclusions and claim conditions may still apply.'], todo: 'Review the full wording for other limits and exclusions.' },

    !w || !coveredFrom ? { id: 'waiting', label: 'Existing illnesses', value: 'Not found', status: 'unknown', page: null,
        explain: [`Illnesses you had before buying are covered only after a waiting period — by IRDAI rules, ${B.pedWaitMaxMonths} months at most.`, 'We couldn’t find yours in the pages you shared.'],
        todo: 'Your advisor can confirm it from the policy wording.', sourceId: 'irdai_mc_2024' }
    : w.servedMonths >= w.waitMonths ? { id: 'waiting', label: 'Existing illnesses', value: 'Wait period elapsed', status: 'watch', page: page('ped_waiting_months'),
        explain: [`The listed ${w.waitMonths}-month waiting period appears to have elapsed based on the start date in this document. This alone does not confirm claim eligibility; policy wording, disclosures, endorsements and renewal continuity still matter.`],
        todo: 'Ask the insurer or an advisor to confirm the applicable waiting-period credit and policy continuity before relying on this for a claim.', sourceId: 'irdai_portability' }
    : { id: 'waiting', label: 'Existing illnesses', value: `From ${fmtMonth(coveredFrom)}`, status: 'watch', page: page('ped_waiting_months'),
        explain: [`Illnesses you had before buying are covered after ${w.waitMonths} months. By this document’s start date you’ve served ${w.servedMonths} — if you renewed without a break before that, you’ve served more.`],
        todo: 'Renew on time — a break restarts the clock. Don’t switch to a new policy just for price: with portability, the new insurer must credit the waiting you’ve served.', sourceId: 'irdai_portability' },

    copay === null ? { id: 'copay', label: 'Co-pay', value: 'Not found', status: 'unknown', page: null,
        explain: ['Co-pay is the share of every claim you pay yourself. We couldn’t find it in the pages you shared.'], todo: 'Your advisor can confirm it.' }
    : copay > 0 ? { id: 'copay', label: 'Co-pay', value: `You pay ${copay}%`, status: 'risk', page: page('copay_percent'),
        explain: [`If this ${copay}% co-pay applies to a ₹2 L eligible claim amount, your share would be ₹${(2_00_000 * copay / 100).toLocaleString('en-IN')}. The actual amount depends on the policy terms and eligible expenses.`],
        todo: 'Ask about a co-pay waiver at renewal, or compare plans without co-pay.' }
    : { id: 'copay', label: 'Co-pay', value: 'None', status: 'good', page: page('copay_percent'),
        explain: ['You don’t pay a share of your claims — the policy pays up to its limits.'], todo: null },

    daysLeft === null || daysLeft < 0 ? { id: 'renewal', label: 'Renewal', value: daysLeft !== null ? 'Overdue' : 'Not found', status: daysLeft !== null ? 'risk' : 'unknown', page: page('end_date'),
        explain: daysLeft !== null ? ['The end date in this document has passed. If it hasn’t been renewed, you may be in a grace period.'] : ['We couldn’t find the end date.'],
        todo: 'Check with your insurer today — a lapse restarts every waiting period.' }
    : daysLeft <= 60 ? { id: 'renewal', label: 'Renewal', value: `In ${daysLeft} days`, status: 'watch', page: page('end_date'),
        explain: [`Your policy renews on ${fmtDate(end!)}.`, 'Renewal is the best time to fix gaps — you can raise cover or remove limits and keep everything you’ve served.'],
        todo: 'Renew on time, without a break. Talk to us a couple of weeks before if you want to change anything.' }
    : { id: 'renewal', label: 'Renewal', value: fmtMonth(end!), status: 'good', page: page('end_date'),
        explain: [`Your policy renews on ${fmtDate(end!)}.`], todo: 'Nothing to do now — we’ll remind you before it’s due.' },
  ];

  // ---------------------------------------------------------------- evidence-first advice
  const served = w ? `the ${w.servedMonths} months counted from this document’s start date` : 'any waiting-period credit already earned';
  const issues = checks.filter((c) => c.status === 'risk').length;
  // These are decision-critical fields. Missing/ambiguous facts must never be converted into a
  // "keep it" or product recommendation. The cover-need figure is a draft rule, not underwriting.
  const decisionFacts = ['sum_insured_inr', 'policy_type', 'members', 'start_date', 'end_date', 'room_rent_limit', 'copay_percent', 'ped_waiting_months'];
  const missingDecisionFacts = decisionFacts.filter((key) => {
    const value = v(key);
    return value === null || String(value).trim() === '';
  });
  const validStart = !!v('start_date') && !Number.isNaN(new Date(v('start_date')!).getTime());
  const validEnd = !!v('end_date') && !Number.isNaN(new Date(v('end_date')!).getTime());
  const validPolicyType = ['individual', 'floater', 'group'].includes(String(v('policy_type') ?? '').toLowerCase());
  const needsEvidenceReview = missingDecisionFacts.length > 0 || !Number.isFinite(siInr) || siInr <= 0
    || copay === null || !w || !validStart || !validEnd || !validPolicyType
    || /not found|unknown|unsure|not stated/i.test(String(rr ?? ''));
  const checkPick: PickView = {
    kind: 'check', type: null, title: 'Confirm your policy details', tagline: 'Let’s verify the important facts before suggesting a change.',
    short: ['Some details need review', 'No purchase recommendation yet'],
    why: 'One or more decision-critical details could not be verified from the information available. We will not assume a missing limit means there is no limit.',
    points: ['Check the policy schedule and full wording', 'Confirm missing or unclear details with the insurer or an advisor', 'Reassess only after the key facts are verified'],
    tips: [], amount: null, price: null, insurer: null, product: null, url: '', reason: 'doc_insufficient_evidence',
  };
  const coverNeedReviewPick: PickView = {
    kind: 'check', type: null, title: 'Review your cover amount', tagline: 'No top-up or new policy is recommended from this draft comparison alone.',
    short: ['Draft estimate only', 'Validate before buying'],
    why: `The current Cover Check amount (${L(need)}) is an internal draft heuristic, not an independently validated clinical, actuarial or underwriting standard. We will not turn this comparison into a purchase recommendation until the rule is validated against reliable data and approved by Turtlemint’s advisory/compliance owners.`,
    points: ['Compare your sum insured with the policy’s actual benefits, exclusions, sub-limits and deductible', 'Consider your family, likely treatment costs, affordability and existing cover with a qualified advisor', 'Only consider a top-up after checking its deductible, waiting periods and how it coordinates with your base policy'],
    tips: [], amount: null, price: null, insurer: null, product: null, url: '', reason: 'doc_unvalidated_cover_rule',
  };
  const reviewPolicyPick: PickView = {
    kind: 'check', type: null, title: 'Review before making a change', tagline: 'A document check is not a guarantee of cover or claim payment.',
    short: ['Findings are limited', 'No product recommended'],
    why: capped
      ? 'A room-rent limit appears in the available facts. Its exact impact depends on the policy wording, eligible room category, linked expense rules and claim circumstances.'
      : copay !== null && copay > 0
        ? `A co-pay of ${copay}% appears in the available facts. Confirm when it applies and whether any exceptions or condition-specific terms change the amount you pay.`
        : 'No issue was identified in the fields checked. This is not a full policy review and does not establish that the cover amount is sufficient or every claim will be paid.',
    points: ['Check the Customer Information Sheet and full policy wording', 'Confirm exclusions, sub-limits, deductibles, waiting periods and claim conditions', 'Ask an advisor to compare alternatives only after the terms and your needs are verified'],
    tips: [], amount: null, price: null, insurer: null, product: null, url: '', reason: 'doc_review_required',
  };
  const pick: PickView = needsEvidenceReview ? checkPick : gap && have !== null ? coverNeedReviewPick : reviewPolicyPick;

  // ---------------------------------------------------------------- opening
  const headline = needsEvidenceReview ? 'A few details need checking'
    : pick.kind === 'keep' ? 'No change suggested from checked facts'
    : gap ? `Review a possible ${L(gap)} difference`
    : issues ? 'A policy detail needs attention' : 'Review these policy details';
  const note = needsEvidenceReview
    ? 'Some important details are missing or unclear. Confirm them before deciding whether to change your cover.'
    : gap && floater && people > 1 && have !== null ? `${people} people share one ${L(have)} sum insured. The suggested amount is a draft rule, not a guarantee of adequacy.`
    : gap && have !== null ? `The draft Cover Check rule flags a ${L(gap)} difference. An advisor should validate suitability before you act.`
    : pick.kind === 'keep' ? 'No issue was identified in the fields checked. This does not guarantee that every condition or claim will be covered.'
    : 'Read the policy wording and confirm the terms that apply to your situation before making a change.';

  return {
    persona, insurer: v('insurer_name'), plan: v('product_name'),
    eyebrow: persona.label, headline, note,
    cover: {
      haveLakh: have, needLakh: need, pct: have === null ? null : Math.min(100, Math.round((have / need) * 100)), people, floater,
      alert: have === null ? { text: 'Cover amount not found', tone: 'risk' }
        : needsEvidenceReview ? { text: 'Key details need review', tone: 'risk' }
        : gap ? { text: `${L(gap)} difference under draft rule`, tone: 'risk' } : { text: 'No sum-insured flag under draft rule', tone: 'good' },
    },
    pick, checks,
    plain: buildCoverSummary('doc', facts, today).sections.map((s) => ({ title: s.title, lines: s.lines })),
    picks: pick.kind === 'plan' ? [pick] : [],
  };
}
