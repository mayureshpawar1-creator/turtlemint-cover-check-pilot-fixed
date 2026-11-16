/**
 * Turns what a person types on U5 into the same shape the policy reader produces, so the report maths works
 * whether a fact was read from the document or typed in ("5 lakh" → "500000", "20/11/2025" → "2025-11-20").
 * Returns null when the text can't be understood — the screen then asks again instead of guessing.
 */
import type { PolicyFactKey } from './types';
import { KEY_FACTS } from './coverSummary';

/** What U5 asks the person to check (or type, when the file could not be read automatically). */
export const REVIEW_FACTS: PolicyFactKey[] = [...KEY_FACTS, 'room_rent_limit', 'copay_percent', 'ped_waiting_months'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
};

export function parseRupees(raw: string): number | null {
  const t = raw.toLowerCase().replace(/₹|rs\.?|inr|,|\s/g, '');
  const m = t.match(/^(\d+(?:\.\d+)?)(l|lac|lacs|lakh|lakhs|cr|crore|crores|k)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? '';
  const v = unit.startsWith('l') ? n * 100_000 : unit.startsWith('c') ? n * 10_000_000 : unit === 'k' ? n * 1000
    : n < 1000 ? n * 100_000 /* "5" on a cover field means 5 lakh */ : n;
  return v >= 10_000 && v <= 100_000_000 ? Math.round(v) : null;
}

export function parseDate(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/); // Indian order: day/month/year
  if (m) return iso(m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!, +m[2]!, +m[1]!);
  m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([a-z]{3})[a-z]*[\s,\-]+(\d{4})$/);
  if (m && MONTHS.includes(m[2]!)) return iso(+m[3]!, MONTHS.indexOf(m[2]!) + 1, +m[1]!);
  return null;
}

export function parseMonths(raw: string): number | null {
  const t = raw.toLowerCase().trim();
  if (/^(none|no|nil|0)$/.test(t)) return 0;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(y|yr|yrs|year|years|m|mo|mon|month|months)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const v = m[2]?.startsWith('y') ? n * 12 : n;
  return v <= 60 ? Math.round(v) : null;
}

export function normalizeFactInput(key: PolicyFactKey, raw: string | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  switch (key) {
    case 'sum_insured_inr': case 'premium_inr': { const v = parseRupees(t); return v === null ? null : String(v); }
    case 'start_date': case 'end_date': return parseDate(t);
    case 'policy_type':
      return /float|family/i.test(t) ? 'floater' : /group|company|employer|corporate|office/i.test(t) ? 'group' : /individual|single|only me/i.test(t) ? 'individual' : null;
    case 'copay_percent': {
      if (/^(none|no|nil|zero)$/i.test(t)) return '0';
      const m = t.replace('%', '').trim().match(/^\d{1,2}$/);
      return m ? String(Number(m[0])) : null;
    }
    case 'ped_waiting_months': case 'specific_waiting_months': { const v = parseMonths(t); return v === null ? null : String(v); }
    case 'room_rent_limit': return /^(none|no|no limit|nil|no cap|unlimited)$/i.test(t) ? 'No limit' : t.slice(0, 80);
    case 'policy_number_last4': return /^\d{4}$/.test(t) ? t : null;
    default: return t.slice(0, 120);
  }
}

/** Placeholder and hint for each field when the person types it in. */
export const FACT_INPUT_HINT: Partial<Record<PolicyFactKey, string>> = {
  insurer_name: 'e.g. the company name on page 1',
  product_name: 'e.g. the plan name',
  policy_type: 'Individual, Family floater or Company (group)',
  sum_insured_inr: 'e.g. 5 lakh',
  members: 'e.g. Self (36), Spouse (34), 2 children',
  start_date: 'DD/MM/YYYY',
  end_date: 'DD/MM/YYYY',
  room_rent_limit: 'e.g. 1% of sum insured per day, or No limit',
  copay_percent: 'e.g. 20%, or None',
  ped_waiting_months: 'e.g. 3 years',
};
