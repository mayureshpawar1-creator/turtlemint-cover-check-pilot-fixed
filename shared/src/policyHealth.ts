/**
 * U7 "Where your policy can be stronger": per-area status read from the person's own policy, plus
 * the inputs for two charts (waiting-period progress, cover vs benchmarks). Per-area only — no
 * overall score. Anything not found in the document is shown as "Not found", never guessed.
 */
import type { PolicyFactView } from './types';
import { BENCHMARKS as B, realValueAfter, type SourceId } from './benchmarks';

export type AreaStatus = 'strong' | 'review' | 'not_found';

export interface PolicyArea {
  id: 'sum_insured' | 'room_rent' | 'copay' | 'waiting' | 'restoration' | 'ncb';
  label: string;
  status: AreaStatus;
  value: string;
  meaning: string;       // what it means on a real bill
  action: string;        // what they can do
  page: number | null;
}

export interface WaitingProgress { servedMonths: number; waitMonths: number; startDate: string; caveat: string; sourceId: SourceId }
export interface CoverBars { bars: { label: string; value: number; you: boolean }[]; caption: string; sourceId: SourceId }

export interface PolicyHealth { areas: PolicyArea[]; waiting: WaitingProgress | null; cover: CoverBars | null }

const monthsBetween = (from: Date, to: Date) => Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0));

/** `needLakh`: the cover we suggest for this person (advice.ts); 10 L when we don't know their family. */
export function buildPolicyHealth(facts: PolicyFactView[], today = new Date(), needLakh = 10): PolicyHealth {
  const f = (k: string) => facts.find((x) => x.key === k);
  const v = (k: string) => { const x = f(k); return x ? (x.userValue ?? x.value) : null; };
  const page = (k: string) => f(k)?.sourcePage ?? null;
  const areas: PolicyArea[] = [];

  const si = Number(v('sum_insured_inr')) || null;
  const siL = si ? si / 100_000 : null;
  areas.push(siL === null
    ? { id: 'sum_insured', label: 'Sum insured', status: 'not_found', value: 'Not found', meaning: 'This is the most the policy pays in a year.', action: 'Enter it on the previous screen, or ask an advisor to find it.', page: null }
    : { id: 'sum_insured', label: 'Sum insured', status: siL >= needLakh ? 'strong' : 'review', value: `₹${siL.toFixed(siL % 1 ? 1 : 0)} L`, page: page('sum_insured_inr'),
        meaning: `The most the policy pays in a year. We suggest about ₹${needLakh} L for your family.`,
        action: siL >= needLakh ? 'Keep it in step with medical costs at each renewal.' : 'A super top-up can add cover on top of this policy.' });

  const rr = v('room_rent_limit');
  areas.push(!rr
    ? { id: 'room_rent', label: 'Room rent', status: 'not_found', value: 'Not found', meaning: 'A cap can reduce what is paid on the whole bill.', action: 'Check the policy wording or ask an advisor.', page: null }
    : /none|no limit/i.test(rr)
      ? { id: 'room_rent', label: 'Room rent', status: 'strong', value: 'No limit', meaning: 'Any room category, bill assessed normally.', action: 'Nothing to do.', page: page('room_rent_limit') }
      : { id: 'room_rent', label: 'Room rent', status: 'review', value: rr, page: page('room_rent_limit'),
          meaning: `On ₹${si ? (si / 100_000).toFixed(0) : '–'} L cover, ${/1%/.test(rr) && si ? `that is about ₹${Math.round(si * 0.01).toLocaleString('en-IN')} a day. ` : ''}Choose a costlier room and many policies cut the rest of the bill in the same proportion.`,
          action: 'Pick a room within the limit, or look at plans without a cap at renewal.' });

  const cp = v('copay_percent');
  const cpNumber = cp === null || String(cp).trim() === '' ? NaN : Number(cp);
  areas.push(!Number.isFinite(cpNumber) || cpNumber < 0
    ? { id: 'copay', label: 'Co-pay', status: 'not_found', value: 'Not found', meaning: 'Co-pay is the share of each claim you pay yourself.', action: 'Ask an advisor to confirm it from the policy wording.', page: null }
    : cpNumber === 0
      ? { id: 'copay', label: 'Co-pay', status: 'review', value: 'Listed as 0%', meaning: 'The extracted value says 0%, but confirm the wording and any condition-specific co-pay before relying on it.', action: 'Confirm the Customer Information Sheet and full policy wording.', page: page('copay_percent') }
      : { id: 'copay', label: 'Co-pay', status: 'review', value: `${cpNumber}%`, page: page('copay_percent'),
          meaning: `If this co-pay applies to a claim of ₹${B.avgClaimInr.toLocaleString('en-IN')}, your share would be about ₹${Math.round(B.avgClaimInr * cpNumber / 100).toLocaleString('en-IN')}. Actual claim terms may differ.`,
          action: 'Confirm when this co-pay applies and compare the full terms before considering a change.' });

  const ped = Number(v('ped_waiting_months')) || null;
  const start = v('start_date');
  let waiting: WaitingProgress | null = null;
  if (ped && start && !Number.isNaN(new Date(start).getTime())) {
    const served = Math.min(ped, monthsBetween(new Date(start), today));
    waiting = { servedMonths: served, waitMonths: ped, startDate: start, sourceId: 'irdai_mc_2024',
      caveat: 'Counted from the start date in this document. If you renewed without a break, you have served more — the first policy date counts.' };
  }
  areas.push(!ped
    ? { id: 'waiting', label: 'Existing-condition wait', status: 'not_found', value: 'Not found', meaning: `The legal maximum is ${B.pedWaitMaxMonths} months.`, action: 'Ask an advisor to find it in the wording.', page: null }
    : { id: 'waiting', label: 'Existing-condition wait', status: 'review', value: `${ped} months`, page: page('ped_waiting_months'),
        meaning: waiting ? `About ${waiting.servedMonths} of ${ped} months counted from this document’s start date. This calculation alone does not confirm eligibility for a claim; continuity, disclosures, endorsements and policy terms must be checked.` : `The document lists ${ped} months. The applicable condition, continuity credit and claim eligibility need confirmation from the policy wording or insurer.`,
        action: 'Confirm the applicable waiting period and continuity credit with the insurer or advisor; renew on time to avoid a break.' });

  const rs = v('restoration');
  areas.push(rs
    ? { id: 'restoration', label: 'Restoration', status: 'review', value: rs, meaning: 'A restoration feature is listed, but triggers, limits, same-illness rules and whether it applies to the same person must be checked in the policy wording.', action: 'Confirm when the refill applies and whether any limits or exclusions affect your family.', page: page('restoration') }
    : { id: 'restoration', label: 'Restoration', status: 'not_found', value: 'Not found', meaning: 'Restoration refills your cover if a big claim uses it up.', action: 'Ask an advisor whether your plan has it.', page: null });

  const ncb = v('no_claim_bonus');
  areas.push(ncb
    ? { id: 'ncb', label: 'No-claim bonus', status: 'review', value: ncb, meaning: 'A no-claim bonus is listed. The increase, maximum, effect of a claim and whether it raises sum insured or reduces premium depend on the policy terms.', action: 'Confirm the bonus rules and maximum from the policy wording or insurer.', page: page('no_claim_bonus') }
    : { id: 'ncb', label: 'No-claim bonus', status: 'not_found', value: 'Not found', meaning: 'A bonus can grow your cover each claim-free year.', action: 'Ask an advisor to confirm.', page: null });

  const cover: CoverBars | null = siL === null ? null : {
    sourceId: 'milliman_2026',
    bars: [
      { label: 'Your cover', value: Math.round(siL * 10) / 10, you: true },
      { label: 'What your family needs', value: needLakh, you: false },
      { label: 'Your cover in 5 yrs, today’s prices', value: realValueAfter(siL), you: false },
    ],
    caption: `At about ${B.medicalInflationPct}% medical inflation a year (Milliman), ₹${siL.toFixed(0)} L will pay for roughly what ₹${realValueAfter(siL)} L does today in five years.`,
  };

  const order: Record<AreaStatus, number> = { review: 0, not_found: 1, strong: 2 };
  areas.sort((a, b) => order[a.status] - order[b.status]);
  return { areas, waiting, cover };
}
