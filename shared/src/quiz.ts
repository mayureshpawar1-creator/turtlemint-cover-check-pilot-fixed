/**
 * Rung 1 quiz definition. Data, not components: the UI renders these generically and the
 * API validates against the same rules, so wording and "mandatory" can never drift apart.
 */
import type { Path } from './enums';
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


/** v4 — the whole quiz on ONE screen (Airbnb-style cards). See docs/FLOW_V4.md for what was dropped and why. */
export const FLOW_VERSION = 'v4';

const AGE_CHIPS: Option[] = [
  { value: '18_30', label: '18–30' }, { value: '31_40', label: '31–40' }, { value: '41_50', label: '41–50' },
  { value: '51_60', label: '51–60' }, { value: '61p', label: '61+' },
];
export const INCOME_OPTIONS: Option[] = [
  { value: 'lt25k', label: 'Under ₹25k' }, { value: '25_50k', label: '₹25–50k' }, { value: '50k_1l', label: '₹50k–1 L' },
  { value: '1_2l', label: '₹1–2 L' }, { value: '2lp', label: 'Above ₹2 L' }, { value: 'prefer_not', label: 'Rather not say', unsure: true },
];
const hasCover = (a: QuizAnswers) => a.situation === 'own' || a.situation === 'group';

/** One screen, every question a tap. Grouped into cards by ONE_SCREEN_CARDS for the UI. */
export const S1: QuizScreen = {
  id: 'S1', step: 1, seconds: 20,
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
    { kind: 'single', field: 'age_band', required: true, style: 'chips', options: AGE_CHIPS, label: 'Your age' },
    { kind: 'single', field: 'income_band', required: true, options: INCOME_OPTIONS, label: 'Monthly take-home',
      helper: 'Sizes your term and crisis cover. Never shared.' },
    { kind: 'single', field: 'city_tier', required: true, label: 'Where you live',
      options: [{ value: 'metro', label: 'Metro city' }, { value: 'other', label: 'Other city' }] },
  ],
};

export interface QuizCard { id: 'cover' | 'who' | 'age' | 'income' | 'city'; label: string; title: string; fields: AnswerField[] }
/** The cards of the one-screen quiz, in order. Collapsed, each shows its answer on the right (like "Where · I’m flexible"). */
export const ONE_SCREEN_CARDS: QuizCard[] = [
  { id: 'cover', label: 'Cover', title: 'Health cover today?', fields: ['situation', 'personal_policy_besides_group', 'sum_insured_band'] },
  { id: 'who', label: 'Who', title: 'Who’s in your family?', fields: ['adults_count', 'children_count', 'parents_count'] },
  { id: 'age', label: 'Age', title: 'Your age?', fields: ['age_band'] },
  { id: 'income', label: 'Income', title: 'Monthly take-home?', fields: ['income_band'] },
  { id: 'city', label: 'Where', title: 'Where do you live?', fields: ['city_tier'] },
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
    case 'who': return familyLabel(a);
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

/** v4 keeps counts; everything downstream still reads `members`, so it is derived here. */
export function withMembers(a: QuizAnswers): QuizAnswers {
  if (a.adults_count === undefined && a.children_count === undefined && a.parents_count === undefined) return a;
  const members: QuizAnswers['members'] = ['self'];
  if ((a.adults_count ?? 1) >= 2) members.push('spouse');
  if ((a.children_count ?? 0) > 0) members.push('children');
  if ((a.parents_count ?? 0) > 0) members.push('parents');
  return { ...a, members };
}

/** Parents get their own plan unless we were told they're under 60 (v3 asked; v4 doesn't). */
export const hasParents60 = (a: QuizAnswers) =>
  (a.members ?? []).some((m) => m === 'parents' || m === 'parents_in_law') && a.parents_age_band !== 'u60';

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

/** A lead's quiz is complete when the one screen is (plus name, pincode, confirmed mobile on S8). */
export function isQuizCoreComplete(a: QuizAnswers): boolean {
  return isScreenComplete(S1, a) && !!a.situation;
}

export const UNSURE_FIELDS: AnswerField[] = [
  'sum_insured_band', 'family_in_group_cover', 'policy_age_band', 'job_exit_cover', 'room_rent_limit', 'renewal_window',
];
export const unsureCount = (a: QuizAnswers) => UNSURE_FIELDS.filter((f) => a[f] === 'unsure').length;
