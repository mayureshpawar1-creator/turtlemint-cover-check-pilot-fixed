/**
 * Rung 1 quiz definition. Data, not components: the UI renders these generically and the
 * API validates against the same rules, so wording and "mandatory" can never drift apart.
 */
import type { Intent, Path } from './enums';
import type { AnswerField, QuizAnswers } from './types';

export interface Option {
  value: string;
  label: string;
  /** Rendered as the dashed "Not sure" tile. */
  unsure?: boolean;
  icon?: string;
}

interface Base {
  field: AnswerField;
  label: string;
  helper?: string;
  required: boolean;
  /** Question only exists when this returns true ("If shown" in the spec). */
  showIf?: (a: QuizAnswers) => boolean;
}
export type Question =
  | (Base & { kind: 'single'; options: Option[]; style?: 'tiles' | 'chips' })
  | (Base & { kind: 'multi'; options: Option[]; min?: number; style?: 'tiles' | 'chips' })
  | (Base & { kind: 'number'; min: number; max: number; placeholder?: string })
  | (Base & { kind: 'stepper'; min: number; max: number })
  | (Base & { kind: 'text'; maxLength: number; placeholder?: string });

export interface QuizScreen {
  id: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
  step: number; // 1-based position in this path
  title: string;
  intro?: string;
  seconds: number;
  questions: Question[];
}

const unsure: Option = { value: 'unsure', label: 'Not sure', unsure: true };

const SUM_BANDS: Option[] = [
  { value: 'lt3', label: 'Under ₹3 L' },
  { value: '3_5', label: '₹3–5 L' },
  { value: '5_10', label: '₹5–10 L' },
  { value: '10_25', label: '₹10–25 L' },
  { value: '25p', label: '₹25 L+' },
  unsure,
];


/**
 * v5 — still one screen of cards, now a question graph: what is asked depends on what they told us.
 * Changes from v4 (docs/IMPLEMENTATION_ROADMAP.md step 1.4):
 *  · income is no longer asked (data minimisation; the "Never shared" line was not true for the caller card)
 *  · company cover asks who it includes, when they have family
 *  · parents get their own age question, so a parents' plan is only suggested for parents 60+ (bug B5)
 *  · a yearly premium comfort range
 *  · an optional last question on life / critical-illness interest, recorded for the caller only
 */
export const FLOW_VERSION = 'v5';

const AGE_CHIPS: Option[] = [
  { value: '18_30', label: '18–30' }, { value: '31_40', label: '31–40' }, { value: '41_50', label: '41–50' },
  { value: '51_60', label: '51–60' }, { value: '61p', label: '61+' },
];
const PARENT_AGE_CHIPS: Option[] = [{ value: 'u60', label: 'Under 60' }, { value: '60_70', label: '60–70' }, { value: '70p', label: '70+' }];
export const PREMIUM_OPTIONS: Option[] = [
  { value: 'lt10k', label: 'Under ₹10k' }, { value: '10_20k', label: '₹10–20k' }, { value: '20_35k', label: '₹20–35k' },
  { value: '35kp', label: '₹35k+' }, { value: 'unsure', label: 'Not sure yet', unsure: true },
];
export const OTHER_INTEREST_OPTIONS: Option[] = [{ value: 'yes', label: 'Yes' }, { value: 'later', label: 'Maybe later' }, { value: 'no', label: 'No' }];

const hasCover = (a: QuizAnswers) => a.situation === 'own' || a.situation === 'group';
const hasFamily = (a: QuizAnswers) => (a.adults_count ?? 1) >= 2 || (a.children_count ?? 0) > 0 || (a.parents_count ?? 0) > 0;
const hasParents = (a: QuizAnswers) => (a.parents_count ?? 0) > 0;

/** One screen, every question a tap. Grouped into cards by ONE_SCREEN_CARDS for the UI. */
export const S1: QuizScreen = {
  id: 'S1', step: 1, seconds: 25,
  title: 'Check your cover',
  questions: [
    { kind: 'single', field: 'situation', required: true, label: 'Health cover today',
      options: [{ value: 'none', label: 'None yet' }, { value: 'own', label: 'My own' }, { value: 'group', label: 'Company' }] },
    // "Company + my own" is one chip in the UI: situation=group + personal_policy_besides_group=yes
    { kind: 'single', field: 'personal_policy_besides_group', required: true, label: 'Also a policy of your own?',
      showIf: (a) => a.situation === 'group', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { kind: 'single', field: 'sum_insured_band', required: true, options: SUM_BANDS, label: 'How much cover?', showIf: hasCover },
    { kind: 'stepper', field: 'adults_count', required: true, min: 1, max: 2, label: 'Adults', helper: 'You and your partner' },
    { kind: 'stepper', field: 'children_count', required: true, min: 0, max: 4, label: 'Children' },
    { kind: 'stepper', field: 'parents_count', required: true, min: 0, max: 4, label: 'Parents', helper: 'Yours or in-laws' },
    { kind: 'single', field: 'family_in_group_cover', required: true, label: 'Does company cover include them?',
      showIf: (a) => a.situation === 'group' && hasFamily(a),
      options: [{ value: 'yes', label: 'Yes, family too' }, { value: 'only_me', label: 'Only me' }, unsure] },
    { kind: 'single', field: 'age_band', required: true, style: 'chips', options: AGE_CHIPS, label: 'Your age' },
    { kind: 'single', field: 'parents_age_band', required: true, style: 'chips', options: PARENT_AGE_CHIPS, label: 'Eldest parent’s age', showIf: hasParents },
    { kind: 'single', field: 'premium_comfort', required: true, options: PREMIUM_OPTIONS, label: 'Comfortable yearly premium',
      helper: 'For the whole family. Shapes the plan we suggest, not how much cover you need.' },
    { kind: 'single', field: 'city_tier', required: true, label: 'Where you live',
      options: [{ value: 'metro', label: 'Metro city' }, { value: 'other', label: 'Other city' }] },
    { kind: 'single', field: 'other_protection_interest', required: false, options: OTHER_INTEREST_OPTIONS,
      label: 'Also interested in life or critical-illness cover?', helper: 'Optional. An advisor can talk you through it on the call.' },
  ],
};

export interface QuizCard { id: 'cover' | 'who' | 'age' | 'budget' | 'city' | 'more'; label: string; title: string; fields: AnswerField[]; optional?: boolean }
/** The cards of the one-screen quiz, in order. Collapsed, each shows its answer on the right (like "Where · I’m flexible"). */
export const ONE_SCREEN_CARDS: QuizCard[] = [
  { id: 'cover', label: 'Cover', title: 'Health cover today?', fields: ['situation', 'personal_policy_besides_group', 'sum_insured_band'] },
  { id: 'who', label: 'Who', title: 'Who’s in your family?', fields: ['adults_count', 'children_count', 'parents_count', 'family_in_group_cover'] },
  { id: 'age', label: 'Age', title: 'How old?', fields: ['age_band', 'parents_age_band'] },
  { id: 'budget', label: 'Budget', title: 'Yearly premium budget?', fields: ['premium_comfort'] },
  { id: 'city', label: 'Where', title: 'Where do you live?', fields: ['city_tier'] },
  { id: 'more', label: 'Also', title: 'Life or critical-illness cover too?', fields: ['other_protection_interest'], optional: true },
];

/** Steppers start here, so "Who" is already a valid answer (just you). */
export const QUIZ_DEFAULTS: QuizAnswers = { adults_count: 1, children_count: 0, parents_count: 0 };

const label = (field: AnswerField, v: unknown) => {
  const q = S1.questions.find((x) => x.field === field);
  return q && (q.kind === 'single' || q.kind === 'multi') ? q.options.find((o) => o.value === v)?.label ?? null : null;
};
export const isCardComplete = (c: QuizCard, a: QuizAnswers) =>
  c.fields.every((f) => { const q = visibleQuestions(S1, a).find((x) => x.field === f); return !q || !validateQuestion(q, a); });

/** "You + partner · 2 kids", "Company + own · ₹5–10 L" — what a collapsed card shows. */
export function cardSummary(c: QuizCard, a: QuizAnswers): string | null {
  switch (c.id) {
    case 'cover': {
      if (!a.situation) return null;
      const kind = a.situation === 'group' ? (a.personal_policy_besides_group === 'yes' ? 'Company + own' : 'Company') : label('situation', a.situation);
      return a.situation !== 'none' && a.sum_insured_band ? `${kind} · ${label('sum_insured_band', a.sum_insured_band)}` : kind;
    }
    case 'who': {
      const f = familyLabel(a);
      return a.situation === 'group' && a.family_in_group_cover === 'only_me' ? `${f} · company covers only you` : f;
    }
    case 'age': {
      if (!a.age_band) return null;
      const you = label('age_band', a.age_band);
      return hasParents(a) && a.parents_age_band ? `You ${you} · parent ${label('parents_age_band', a.parents_age_band)}` : you;
    }
    default: { const f = c.fields[0]!; return a[f] === undefined ? null : label(f, a[f]); }
  }
}

export function familyLabel(a: QuizAnswers): string {
  const parts = [(a.adults_count ?? 1) >= 2 ? 'You + partner' : 'Just you'];
  const k = a.children_count ?? 0, p = a.parents_count ?? 0;
  if (k) parts.push(`${k} ${k === 1 ? 'child' : 'kids'}`);
  if (p) parts.push(`${p} parent${p === 1 ? '' : 's'}`);
  return parts.length > 1 && parts[0] === 'Just you' ? ['You', ...parts.slice(1)].join(' · ') : parts.join(' · ');
}

/** v4+ keeps counts; everything downstream still reads `members`, so it is derived here. */
export function withMembers(a: QuizAnswers): QuizAnswers {
  if (a.adults_count === undefined && a.children_count === undefined && a.parents_count === undefined) return a;
  const members: QuizAnswers['members'] = ['self'];
  if ((a.adults_count ?? 1) >= 2) members.push('spouse');
  if ((a.children_count ?? 0) > 0) members.push('children');
  if ((a.parents_count ?? 0) > 0) members.push('parents');
  return { ...a, members };
}

/**
 * Parents get a plan of their own only when we were told they are 60 or older (fixes B5: v4 assumed every
 * parent was 60+ because it never asked). Parents under 60, or of unknown age (v4 sessions), stay on the family plan.
 */
export const hasParents60 = (a: QuizAnswers) =>
  (a.members ?? []).some((m) => m === 'parents' || m === 'parents_in_law') && (a.parents_age_band === '60_70' || a.parents_age_band === '70p');

/** Why they came, derived from what they told us — the caller card and the funnel report use it. */
export function intentOf(a: QuizAnswers): Intent | null {
  if (!a.situation) return null;
  const parents = (a.parents_count ?? 0) > 0;
  const family = (a.adults_count ?? 1) >= 2 || (a.children_count ?? 0) > 0;
  if (a.situation === 'none') return 'first_time';
  if (a.situation === 'group' && a.personal_policy_besides_group !== 'yes') return 'corporate_only';
  // they already have cover of their own; parents on the list is the new need
  if (parents) return 'cover_parents';
  if (a.situation === 'group') return 'corporate_plus_own';
  return family ? 'own_floater' : 'own_individual';
}
export const INTENT_LABEL: Record<Intent, string> = {
  first_time: 'First-time buyer', own_individual: 'Own policy (individual)', own_floater: 'Own policy (family floater)',
  corporate_only: 'Company cover only', corporate_plus_own: 'Company + own policy', cover_parents: 'Adding cover for parents',
};

/**
 * Fields in a saved patch that the question graph doesn't ask for these answers (e.g. income, or parents' age
 * with no parents). The server refuses these rather than silently dropping them. `members` is derived, so allowed.
 */
export function disallowedFields(patch: QuizAnswers, merged: QuizAnswers): AnswerField[] {
  const allowed = new Set<AnswerField>(['members']);
  for (const s of screensForAnswers(merged)) for (const q of visibleQuestions(s, merged)) allowed.add(q.field);
  return (Object.keys(patch) as AnswerField[]).filter((k) => patch[k] !== undefined && !allowed.has(k));
}

export function quizScreens(_path?: Path | null): QuizScreen[] {
  return [S1];
}

export function screensForAnswers(_a?: QuizAnswers): QuizScreen[] {
  return [S1];
}

export const visibleQuestions = (s: QuizScreen, a: QuizAnswers) => s.questions.filter((q) => !q.showIf || q.showIf(a));

/** Returns the first problem, or null when the screen can move on. "Not sure" counts as an answer. */
export function validateQuestion(q: Question, a: QuizAnswers): string | null {
  const v = a[q.field] as unknown;
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  if (empty) return q.required ? 'Please answer this to continue' : null;
  switch (q.kind) {
    case 'single':
      return q.options.some((o) => o.value === v) ? null : 'Pick one option';
    case 'multi': {
      if (!Array.isArray(v)) return 'Pick at least one';
      if (q.min && v.length < q.min) return 'Pick at least one';
      return v.every((x) => q.options.some((o) => o.value === x)) ? null : 'Unknown option';
    }
    case 'number':
    case 'stepper': {
      const n = Number(v);
      if (!Number.isInteger(n)) return 'Enter a whole number';
      return n < q.min || n > q.max ? `Enter a number from ${q.min} to ${q.max}` : null;
    }
    case 'text':
      return String(v).length > q.maxLength ? `Keep it under ${q.maxLength} characters` : null;
  }
}

export function screenErrors(s: QuizScreen, a: QuizAnswers): Partial<Record<AnswerField, string>> {
  const out: Partial<Record<AnswerField, string>> = {};
  for (const q of visibleQuestions(s, a)) {
    const e = validateQuestion(q, a);
    if (e) out[q.field] = e;
  }
  return out;
}

export const isScreenComplete = (s: QuizScreen, a: QuizAnswers) => Object.keys(screenErrors(s, a)).length === 0;

/** Remove answers that no longer apply (e.g. user changed path on S1, or unpicked Children). */
export function pruneAnswers(a: QuizAnswers): QuizAnswers {
  const screens = screensForAnswers(a);
  const allowed = new Set<AnswerField>();
  for (const s of screens) for (const q of visibleQuestions(s, a)) allowed.add(q.field);
  const out: QuizAnswers = {};
  for (const k of Object.keys(a) as AnswerField[]) if (allowed.has(k)) (out as Record<string, unknown>)[k] = a[k];
  return withMembers(out);
}

/** A lead's quiz is complete when the one screen's required questions are (plus name, pincode, confirmed mobile on S8). */
export function isQuizCoreComplete(a: QuizAnswers): boolean {
  return isScreenComplete(S1, a) && !!a.situation;
}

export const UNSURE_FIELDS: AnswerField[] = [
  'sum_insured_band', 'family_in_group_cover', 'policy_age_band', 'job_exit_cover', 'room_rent_limit', 'renewal_window',
];
export const unsureCount = (a: QuizAnswers) => UNSURE_FIELDS.filter((f) => a[f] === 'unsure').length;
