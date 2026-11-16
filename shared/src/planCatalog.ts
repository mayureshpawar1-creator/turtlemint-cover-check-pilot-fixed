/**
 * Plan catalog: the plan TYPES Cover Check can point people to, the Turtlemint page for each, plain-language
 * features, and a slot for Turtlemint's own pick (insurer, product, starting price) that the product team fills in.
 *
 * Nothing here is invented: features are general facts about the plan type, and a price shows only once
 * Turtlemint enters a real one. Until then the UI says "See price for your family".
 * VALIDATION REQUIRED: wording (compliance) and every TURTLEMINT_PICKS entry (product team).
 */

export const PLAN_TYPES = ['family_floater', 'individual', 'senior_citizen', 'super_top_up', 'no_room_cap', 'critical_illness', 'compare_quotes', 'term_life'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

const SITE = 'https://www.turtlemintinsurance.com';
/** Pages that exist on turtlemintinsurance.com (checked Oct 2026). Change here if the site moves them. */
export const PLAN_PAGES: Record<PlanType, string> = {
  family_floater: `${SITE}/health-insurance/family-health-insurance-plans/`,
  individual: `${SITE}/health-insurance/mediclaim-insurance/`,
  senior_citizen: `${SITE}/health-insurance/senior-citizen-health-insurance/`,
  super_top_up: `${SITE}/health-insurance/articles/how-top-up-health-insurance-plans-give-you-more-coverage-at-a-lesser-premium/`,
  no_room_cap: 'https://app.turtlemintinsurance.com/health-insurance/health-profile/profile-gender',
  critical_illness: `${SITE}/health-insurance/critical-illness-insurance/`,
  compare_quotes: 'https://app.turtlemintinsurance.com/health-insurance/health-profile/profile-gender',
  term_life: `${SITE}/life-insurance/term-insurance-plans/`,
};

export interface PlanDetail {
  title: string;
  /** One line: what it does, for a normal person. */
  tagline: string;
  /** Three general, non-promotional facts about this plan type (plan details sheet). */
  points: string[];
  /** Two 2–4 word versions for the board block. */
  short: [string, string];
  cta: string;
}

export const PLAN_DETAILS: Record<PlanType, PlanDetail> = {
  family_floater: { title: 'Family floater', cta: 'See family plans', tagline: 'One health cover shared by your whole family.',
    points: ['One sum insured for everyone on the policy', 'Usually costs less than a policy per person', 'Cashless treatment at network hospitals'], short: ['One cover for all', 'Cashless hospitals'] },
  individual: { title: 'Personal plan', cta: 'See personal plans', tagline: 'Health cover that is yours, whatever happens at work.',
    points: ['Stays with you when you change or leave jobs', 'Waiting periods start the day you buy', 'Cashless treatment at network hospitals'], short: ['Yours, not your job’s', 'Cashless hospitals'] },
  senior_citizen: { title: 'Senior citizen plan', cta: 'See plans for parents', tagline: 'Health cover made for parents above 60.',
    points: ['Built for people above 60', 'Since 2024 there is no upper age limit to buy health cover', 'Check co-pay and waiting periods closely'], short: ['Made for 60+', 'No upper age limit'] },
  super_top_up: { title: 'Super top-up', cta: 'How super top-ups work', tagline: 'Adds cover on top of the policy you already have.',
    points: ['Raises your total cover without replacing your policy', 'Starts paying after a set amount (the deductible)', 'Usually far cheaper than a bigger base plan'], short: ['Keeps your policy', 'Usually costs less'] },
  no_room_cap: { title: 'Plan without a room-rent cap', cta: 'Compare plans', tagline: 'Pick any room without the rest of the bill being cut.',
    points: ['No room category limit', 'Related charges are not cut in proportion', 'Compare quotes side by side on Turtlemint'], short: ['Any room you need', 'Bill not cut'] },
  critical_illness: { title: 'Critical illness cover', cta: 'See crisis plans', tagline: 'A lump sum the day a serious illness is diagnosed.',
    points: ['Pays a fixed amount on diagnosis of a listed illness', 'Spend it on anything — treatment, EMIs, lost income', 'Works on top of your health insurance'], short: ['Lump sum on diagnosis', 'Use it for anything'] },
  compare_quotes: { title: 'Compare health plans', cta: 'Compare plans', tagline: 'See premiums and benefits side by side.',
    points: ['Compare plans from many insurers', 'Free to compare — no call unless you ask', 'Buy online or with an advisor'], short: ['Many insurers', 'Free to compare'] },
  term_life: { title: 'Term insurance', cta: 'See term plans', tagline: 'Pays your family a lump sum if you are not there.',
    points: ['A large cover for a small yearly premium', 'Premium usually stays the same for the whole term', 'Cheapest when you buy it young'], short: ['Big cover, small premium', 'Cheapest when young'] },
};

export const PLAN_TITLE = Object.fromEntries(PLAN_TYPES.map((t) => [t, PLAN_DETAILS[t].title])) as Record<PlanType, string>;

/** Turtlemint's own pick for a plan type. Filled in by Turtlemint's product team; null fields stay hidden. */
export interface TurtlemintPick {
  insurer: string | null;
  product: string | null;
  /** Real starting premium in ₹ — never an estimate. */
  startingPriceInr: number | null;
  per: 'month' | 'year';
  /** Who the starting price is for, e.g. "30-year-old, ₹1 Cr till 60". Shown under the price. */
  priceNote: string | null;
  /** Product page on Turtlemint; falls back to PLAN_PAGES. */
  url: string | null;
  /** Required provenance and documented approval before any named product or price is customer-visible. */
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  approvalReference: string | null;
  approvedForRecommendations: boolean;
}
const EMPTY: TurtlemintPick = { insurer: null, product: null, startingPriceInr: null, per: 'month', priceNote: null, url: null, sourceUrl: null, sourceCheckedAt: null, approvalReference: null, approvedForRecommendations: false };

/** Return named product/pricing only when current source evidence and an approval record are present. */
export function getApprovedTurtlemintPick(type: PlanType): TurtlemintPick {
  const pick = TURTLEMINT_PICKS[type];
  const sourceDate = pick.sourceCheckedAt ? Date.parse(pick.sourceCheckedAt) : Number.NaN;
  const approved = pick.approvedForRecommendations === true
    && Boolean(pick.insurer?.trim() && pick.product?.trim())
    && Boolean(pick.sourceUrl && /^https:\/\//i.test(pick.sourceUrl))
    && Number.isFinite(sourceDate)
    && Date.now() - sourceDate >= 0
    && Date.now() - sourceDate <= 90 * 24 * 60 * 60 * 1000
    && Boolean(pick.approvalReference?.trim())
    && (pick.startingPriceInr === null || (Number.isFinite(pick.startingPriceInr) && pick.startingPriceInr > 0 && Boolean(pick.priceNote?.trim())));
  return approved ? pick : EMPTY;
}

/** ← Turtlemint product team: fill these in (or load them from your plan service) to show a named pick and price. */
export const TURTLEMINT_PICKS: Record<PlanType, TurtlemintPick> = {
  family_floater: { ...EMPTY },
  individual: { ...EMPTY },
  senior_citizen: { ...EMPTY },
  super_top_up: { ...EMPTY },
  no_room_cap: { ...EMPTY },
  critical_illness: { ...EMPTY },
  compare_quotes: { ...EMPTY },
  term_life: { ...EMPTY },
};

/**
 * Neutral UTM tags for a Turtlemint plan page. The campaign is not known here; `attributeUrl` stamps the visitor's own
 * campaign onto the link when it is shown, so quotes on Turtlemint's site are credited to the campaign that brought them.
 */
export const withUtm = (url: string, type: PlanType, origin: 'quiz' | 'document') =>
  `${url}${url.includes('?') ? '&' : '?'}utm_source=cover_check&utm_medium=web&utm_campaign=cover_check&utm_content=${origin}_${type}`;

/** Put the visitor's campaign, channel and variant on an outbound link (utm_campaign / utm_medium / utm_term). */
export function attributeUrl(url: string, a: { campaignId: string | null; variantId: string | null; channel: string | null } | null | undefined): string {
  if (!url || !a || (!a.campaignId && !a.variantId && !a.channel)) return url;
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  if (a.campaignId) u.searchParams.set('utm_campaign', a.campaignId);
  if (a.channel) u.searchParams.set('utm_medium', a.channel);
  if (a.variantId) u.searchParams.set('utm_term', a.variantId);
  return u.toString();
}
