/**
 * Telecaller context card. Pure function over stored data so the backend (from Postgres)
 * and the prototype (from memory) render the exact same card.
 * Rule: open with what they told us and nothing they did not.
 */
import type { Language, LeadState, Priority, RequestedAction, Topic } from './enums';
import type { Finding, LeadCard, QuizAnswers } from './types';
import { listMembers, POLICY_AGE_LABEL, RENEWAL_LABEL, ruleShortLabel, SUM_LABEL } from './readout';
import { buildPlanBoard } from './planBoard';
import { INTENT_LABEL, intentOf } from './quiz';

export interface LeadCardInput {
  leadId: string;
  firstName: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  mobileVerified: boolean;
  leadState: LeadState;
  priority: Priority | null;
  answers: QuizAnswers;
  findings: Finding[];
  handoff: {
    action: RequestedAction | null; slotStart: string | null; slotEnd: string | null;
    callLanguage: Language | null; topic: Topic | null; note: string | null;
  } | null;
  upload: { status: 'none' | 'processing' | 'ready' | 'failed'; insurer?: string | null; product?: string | null };
  contactConsentTs: string | null;
  noticeVersion: string | null;
  agentName?: string;
  explored?: { title: string; clicked: boolean }[];
  openChecks?: { label: string; marked: boolean }[];
}

const AGE_LABEL: Record<string, string> = { '18_30': '18–30', '31_40': '31–40', '41_50': '41–50', '51_60': '51–60', '61p': '61+' };
const PREMIUM_LABEL: Record<string, string> = { lt10k: 'under ₹10k/yr', '10_20k': '₹10–20k/yr', '20_35k': '₹20–35k/yr', '35kp': '₹35k+/yr', unsure: 'not sure' };
const OTHER_INTEREST_LABEL: Record<string, string> = { yes: 'yes', later: 'maybe later', no: 'no' };

const SITUATION_LINE = { none: 'No cover yet', own: 'Has own policy', group: 'Company cover' } as const;
const LANG_NAME: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
const TOPIC_NAME: Record<string, string> = { renewal: 'renewal', parents: "parents' cover", compare: 'comparing plans', claim: 'a claim question', other: 'something else' };
const ACTION_NAME: Record<string, string> = { advisor_call: 'Advisor call', callback: 'Callback', see_plans: 'See plans', summary_only: 'Summary only', upload_policy: 'Policy upload' };

const fmtIst = (iso: string, withDay = true) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...(withDay ? { day: 'numeric', month: 'short' } : {}), hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?([ap])\.?m\.?/i, (_m, p) => ` ${String(p).toLowerCase()}m`);

export function buildLeadCard(i: LeadCardInput): LeadCard {
  const a = i.answers;
  const situationParts = [
    a.situation ? (a.situation === 'group' && a.personal_policy_besides_group === 'yes' ? 'Company + own policy' : SITUATION_LINE[a.situation]) : '—',
    a.adults_count !== undefined
      ? ['self', (a.adults_count ?? 1) >= 2 ? 'spouse' : null, a.children_count ? `${a.children_count} child${a.children_count > 1 ? 'ren' : ''}` : null,
         a.parents_count ? `${a.parents_count} parent${a.parents_count > 1 ? 's' : ''}` : null].filter(Boolean).join(' + ')
      : a.members?.length ? listMembers(a, 'card') : null,
    a.eldest_age ? `eldest ${a.eldest_age}` : null,
    a.age_band ? `${a.situation === 'none' || a.adults_count !== undefined ? 'age' : 'eldest'} ${AGE_LABEL[a.age_band]}` : null,
    a.parents_age_band ? `parents ${a.parents_age_band === 'u60' ? 'under 60' : a.parents_age_band === '60_70' ? '60–70' : '70+'}` : null,
    a.city_tier ? (a.city_tier === 'metro' ? 'metro' : 'non-metro') : null,
    a.sum_insured_band ? (a.sum_insured_band === 'unsure' ? 'amount: not sure' : SUM_LABEL[a.sum_insured_band]) : null,
    a.family_in_group_cover ? `family in group cover: ${a.family_in_group_cover.replace('_', ' ')}` : null,
  ].filter(Boolean);

  const intent = intentOf(a);
  const quizParts = [
    intent ? `intent: ${INTENT_LABEL[intent]}` : null,
    a.premium_comfort ? `budget ${PREMIUM_LABEL[a.premium_comfort]}` : null,
    // D3b: interest only, for the advisor to raise — it never changes the advice or the lead score
    a.other_protection_interest ? `life / critical-illness interest: ${OTHER_INTEREST_LABEL[a.other_protection_interest]}` : null,
    a.room_rent_limit ? `Room rent limit: ${a.room_rent_limit === 'unsure' ? 'not sure' : a.room_rent_limit === 'limit' ? `yes${a.room_rent_note ? ` (${a.room_rent_note})` : ''}` : 'none'}` : null,
    a.policy_age_band ? `policy ${a.policy_age_band === 'unsure' ? 'age not sure' : POLICY_AGE_LABEL[a.policy_age_band]}` : null,
    a.renewal_window ? `renews ${a.renewal_window === 'unsure' ? 'not sure' : RENEWAL_LABEL[a.renewal_window]}` : null,
    a.health_condition ? `condition: ${a.health_condition === 'prefer_not' ? 'prefer not to say' : a.health_condition}` : null,
    a.job_exit_cover ? `cover after job: ${a.job_exit_cover.replace('_', ' ')}` : null,
    a.personal_policy_besides_group ? `personal policy: ${a.personal_policy_besides_group}` : null,
    a.top_concern ? `worry: ${a.top_concern.replace('_', ' ')}` : null,
    a.start_timing ? `wants cover: ${a.start_timing.replace('_', ' ').replace('1 3m', '1–3 months')}` : null,
  ].filter(Boolean);

  const h = i.handoff;
  const name = i.firstName ?? 'there';
  const agent = i.agentName ?? '<your name>';
  const recap: string[] = [];
  if (a.renewal_window && a.renewal_window !== 'unsure') recap.push(`your policy renews ${RENEWAL_LABEL[a.renewal_window]}`);
  if (a.room_rent_limit === 'unsure') recap.push("you weren't sure about the room rent limit");
  if (a.sum_insured_band === 'unsure') recap.push("you weren't sure of your cover amount");
  if (a.situation === 'group' && a.personal_policy_besides_group === 'no') recap.push('you rely on company cover today');
  if (a.situation === 'none' && a.start_timing === 'this_month') recap.push('you want cover to start this month');
  const recapText = recap.length ? ` You mentioned ${recap.slice(0, 2).join(' and ')}.` : '';
  const why = h?.action === 'advisor_call' || h?.action === 'callback'
    ? 'You did a Cover Check just now and asked for a call.'
    : 'You did a Cover Check and said we could contact you.';

  return {
    leadId: i.leadId,
    firstName: i.firstName,
    leadState: i.leadState,
    priority: i.priority,
    where: { pincode: i.pincode, city: i.city, state: i.state, mobileVerified: i.mobileVerified },
    askedFor: {
      action: h?.action ?? null, slotStart: h?.slotStart ?? null, slotEnd: h?.slotEnd ?? null,
      callLanguage: h?.callLanguage ?? null, topic: h?.topic ?? null, note: h?.note ?? null,
    },
    situationLine: situationParts.join(' · '),
    quizLine: quizParts.join(' · ') || '—',
    toldThem: i.findings.map((f) => ({ ruleId: f.ruleId, label: ruleShortLabel(f.ruleId, f.field) })),
    policyUpload: i.upload.status === 'none' ? 'Not done. Offer it on the call.'
      : i.upload.status === 'ready' ? `Done${i.upload.insurer ? ` · ${i.upload.insurer}${i.upload.product ? ` ${i.upload.product}` : ''}` : ''} · facts confirmed`
      : i.upload.status === 'processing' ? 'Uploaded, still reading.' : 'Tried, failed. Offer help with an unlocked copy.',
    // v4: exactly what the one-screen cover plan showed them — the telecaller opens on the same numbers.
    adviceLine: (() => {
      if (!a.situation) return '—';
      const b = buildPlanBoard(a);
      const h = b.health;
      return [
        b.persona.label,
        `Health ₹${h.needLakh} L (${h.haveLakh === null ? 'cover amount not sure' : h.haveLakh === 0 ? 'has none' : `has ${h.haveLabel}${h.haveLakh < h.needLakh ? `, short ₹${h.needLakh - h.haveLakh} L` : ''}`})`,
        `${b.healthPick.kind === 'plan' ? 'Pick' : 'Advice'}: ${b.healthPick.title}${b.healthPick.amount ? ` ${b.healthPick.amount}` : ''}`,
        b.parentsPick ? 'Parents: own plan' : null,
        h.alert?.tone === 'risk' ? h.alert.text : null,
      ].filter(Boolean).join(' · ');
    })(),
    plansLine: i.explored?.length
      ? i.explored.map((e) => `${e.title}${e.clicked ? ' (opened on Turtlemint)' : ''}`).join(' · ')
      : '—',
    checklistLine: i.openChecks?.length
      ? i.openChecks.map((c) => `${c.label}${c.marked ? ' (they ticked it)' : ''}`).join(' · ')
      : 'Nothing open',
    consentLine: i.contactConsentTs ? `Call consent given ${fmtIst(i.contactConsentTs)} · notice ${i.noticeVersion ?? '—'}` : 'No call consent. Do not call.',
    openingScript: `Hello ${name}, this is ${agent} from Turtlemint. ${why}${recapText} Can I take two minutes to explain what that means for you?`,
  };
}

export const describeAskedFor = (c: LeadCard): string => {
  const f = c.askedFor;
  if (!f.action) return '—';
  const parts = [ACTION_NAME[f.action] ?? f.action];
  if (f.slotStart && f.slotEnd) parts.push(`${fmtIst(f.slotStart)} – ${fmtIst(f.slotEnd, false)}`);
  if (f.callLanguage) parts.push(LANG_NAME[f.callLanguage] ?? f.callLanguage);
  if (f.topic) parts.push(`Topic: ${TOPIC_NAME[f.topic]}`);
  return parts.join(', ') + (f.note ? `. Note: "${f.note}"` : '');
};
