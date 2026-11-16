/**
 * Policy extraction adapters.
 *
 * demoExtractor is prototype-only. pdfTextExtractor reads real text-native PDFs and only
 * emits values supported by nearby labels. Scanned PDFs/images need OCR and return unreadable
 * rather than fabricated facts. Every production fact should ultimately include an evidence span.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { REVIEW_FACTS, type DocFailure, type PolicyFactKey } from '@cover-check/shared';

export interface ExtractionInput { data: Buffer; mime: string; password?: string }
export type ExtractedFact = { key: PolicyFactKey; value: unknown | null; sourcePage: number | null; confidence: number | null };
export type ExtractionResult =
  | { ok: true; extractorVersion: string; pages: number; facts: ExtractedFact[] }
  | { ok: false; extractorVersion: string; reason: DocFailure | 'password_required'; failedPage?: number };
export interface PolicyExtractor { extract(input: ExtractionInput): Promise<ExtractionResult> }

/** Conservative floor; this is a review threshold, not a calibrated probability. */
export const MIN_CONFIDENCE = 0.8;
const isEncryptedPdf = (b: Buffer) => b.subarray(0, 1024 * 64).includes('/Encrypt');

type PageText = { page: number; text: string };
type Candidate = { value: unknown; page: number; confidence: number };
type PositionedTextItem = { x: number; y: number; str: string };

const normalize = (s: string) => s.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*:\s*/g, ': ').trim();
const cleanLine = (s: string) => normalize(s).replace(/[|•]+/g, ' ').trim();
const amount = (raw: string): number | null => {
  const s = raw.toLowerCase().replace(/₹|rs\.?|inr/gi, '').replace(/,/g, '').trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|lakhs|lacs|cr(?:ore)?|crore|crores)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? '').toLowerCase();
  const multiplier = unit.startsWith('l') ? 100000 : unit.startsWith('c') ? 10000000 : 1;
  const result = Math.round(n * multiplier);
  return result > 0 ? result : null;
};
const isoDate = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
const dateIso = (raw: string): string | null => {
  const s = raw.trim();
  let m = s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  const months: Record<string, string> = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', sept:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' };
  m = s.match(/\b(\d{1,2})\s+([a-z]+)\.?[,]?\s+(\d{4})\b/i);
  const monthName = m?.[2]?.toLowerCase();
  const monthNumber = monthName ? months[monthName] : undefined;
  if (m && monthNumber) return isoDate(Number(m[3]), Number(monthNumber), Number(m[1]));
  return null;
};

/** Preserve line boundaries from PDF text positions so labelled fields are parsed independently. */
export function positionedItemsToText(items: PositionedTextItem[]): string {
  const positioned = items.filter((item) => item.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: PositionedTextItem[] }[] = [];
  for (const item of positioned) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (!line) { line = { y: item.y, parts: [] }; lines.push(line); }
    line.parts.push(item);
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.str).join(' '))
    .join('\n');
}
const makeFact = (key: PolicyFactKey, candidate?: Candidate): ExtractedFact => ({
  key, value: candidate?.value ?? null, sourcePage: candidate?.page ?? null, confidence: candidate?.confidence ?? null,
});
const firstMatch = (pages: PageText[], pattern: RegExp, parse: (match: RegExpMatchArray) => unknown | null, confidence = 0.84): Candidate | undefined => {
  for (const p of pages) {
    const m = p.text.match(pattern);
    if (!m) continue;
    const value = parse(m);
    if (value !== null && value !== undefined && value !== '') return { value, page: p.page, confidence };
  }
  return undefined;
};
const labelledLine = (pages: PageText[], label: RegExp, parse: (value: string) => unknown | null, confidence = 0.86): Candidate | undefined => {
  for (const p of pages) {
    for (const rawLine of p.text.split(/\n+/)) {
      const line = cleanLine(rawLine);
      if (!label.test(line)) continue;
      const after = line.replace(label, '').replace(/^\s*[-:=–—]?\s*/, '').trim();
      if (!after || after.length > 180) continue;
      const value = parse(after);
      if (value !== null && value !== undefined && value !== '') return { value, page: p.page, confidence };
    }
  }
  return undefined;
};
const candidatesFromPages = (pages: PageText[]): Partial<Record<PolicyFactKey, Candidate>> => {
  const c: Partial<Record<PolicyFactKey, Candidate>> = {};
  const put = (key: PolicyFactKey, candidate?: Candidate) => { if (candidate) c[key] = candidate; };

  put('insurer_name', labelledLine(pages, /^(?:insurer|insurance company|name of insurer)\b\s*[:-]?/i, v => v.trim()));
  put('product_name', labelledLine(pages, /^(?:product name|plan name|name of product)\b\s*[:\-]?/i, v => v.trim()));
  put('policy_number_last4', firstMatch(pages, /\b(?:policy|certificate)\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9\-/ ]{4,40})/i, m => {
    const raw = m[1];
    if (!raw) return null;
    const digits = raw.replace(/[^0-9]/g, '');
    return digits.length >= 4 ? digits.slice(-4) : null;
  }, 0.9));
  put('policy_type', firstMatch(pages, /\b(?:policy type|plan type)\s*[:\-]?\s*(individual|family\s*floater|floater)\b/i, m => m[1] ? (/individual/i.test(m[1]) ? 'individual' : 'floater') : null, 0.9));
  put('sum_insured_inr', labelledLine(pages, /^(?:sum insured|basic sum insured|policy sum insured|total sum insured)\b\s*[:\-]?/i, v => amount(v), 0.9));
  put('premium_inr', labelledLine(pages, /^(?:total premium|annual premium|premium payable|gross premium|net premium)\b\s*[:\-]?/i, v => amount(v), 0.88));

  put('start_date', firstMatch(pages, /\b(?:policy period|period of insurance|policy effective period)\s*[:\-]?\s*(?:from\s*)?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?[,]?\s+\d{4}|\d{4}-\d{2}-\d{2})\s*(?:to|until|through|[-–])\s*(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?[,]?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, m => m[1] ? dateIso(m[1]) : null, 0.88));
  put('end_date', firstMatch(pages, /\b(?:policy period|period of insurance|policy effective period)\s*[:\-]?\s*(?:from\s*)?(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?[,]?\s+\d{4}|\d{4}-\d{2}-\d{2})\s*(?:to|until|through|[-–])\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?[,]?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, m => m[1] ? dateIso(m[1]) : null, 0.88));
  put('renewal_date', firstMatch(pages, /\b(?:renewal date|renew by|renewal due date)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?[,]?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, m => m[1] ? dateIso(m[1]) : null, 0.88));

  put('room_rent_limit', labelledLine(pages, /^(?:room rent limit|room rent|room category eligibility|room charges)\b\s*[:\-]?/i, v => v.slice(0, 180), 0.84));
  put('copay_percent', firstMatch(pages, /\b(?:co[- ]?pay(?:ment)?|copayment)\b[^\n%]{0,90}?\b(\d{1,2}(?:\.\d+)?)\s*%/i, m => Number(m[1]) <= 100 ? Number(m[1]) : null, 0.84));
  if (!c.copay_percent) put('copay_percent', firstMatch(pages, /\b(?:no co[- ]?pay(?:ment)?|without co[- ]?pay(?:ment)?|co[- ]?pay(?:ment)? not applicable)\b/i, () => 0, 0.82));

  put('ped_waiting_months', firstMatch(pages, /\b(?:pre[- ]existing diseases?|PED)\b[^\n.]{0,140}?\b(waiting period|waiting)\b[^\n.]{0,60}?\b(\d{1,3})\s*(months?|years?)\b/i, m => m[2] && m[3] ? Number(m[2]) * (/year/i.test(m[3]) ? 12 : 1) : null, 0.82));
  put('specific_waiting_months', firstMatch(pages, /\b(?:specific diseases?|specified diseases?|named ailments?)\b[^\n.]{0,140}?\b(waiting period|waiting)\b[^\n.]{0,60}?\b(\d{1,3})\s*(months?|years?)\b/i, m => m[2] && m[3] ? Number(m[2]) * (/year/i.test(m[3]) ? 12 : 1) : null, 0.82));
  put('initial_waiting_days', firstMatch(pages, /\b(?:initial waiting period|initial waiting)\b[^\n.]{0,90}?\b(\d{1,3})\s*days?\b/i, m => Number(m[1]), 0.84));
  put('deductible_inr', labelledLine(pages, /^(?:deductible|aggregate deductible|voluntary deductible)\b\s*[:\-]?/i, v => amount(v), 0.84));
  put('restoration', labelledLine(pages, /^(?:restoration|restore benefit|reinstatement benefit)\b\s*[:\-]?/i, v => v.slice(0, 180), 0.82));
  put('no_claim_bonus', labelledLine(pages, /^(?:no claim bonus|NCB|cumulative bonus|renewal bonus)\b\s*[:\-]?/i, v => v.slice(0, 180), 0.82));
  put('sublimits', labelledLine(pages, /^(?:sub[- ]?limits|limits and sublimits|sub limit details)\b\s*[:\-]?/i, v => v.slice(0, 180), 0.82));
  put('riders', labelledLine(pages, /^(?:riders|add[- ]?ons|optional covers|additional covers)\b\s*[:\-]?/i, v => v.slice(0, 180), 0.82));

  // Members are deliberately not guessed from arbitrary names. A future table-aware parser can
  // add member rows once layout preservation and validation fixtures are available.
  return c;
};

export const extractPolicyFactsFromPages = (pages: PageText[]): ExtractedFact[] => {
  const candidates = candidatesFromPages(pages);
  return REVIEW_FACTS.map(key => makeFact(key, candidates[key]));
};

export const pdfTextExtractor = (): PolicyExtractor => ({
  async extract({ data, mime, password }) {
    const version = 'pdf-text-0.1.0';
    if (mime !== 'application/pdf') return { ok: false, extractorVersion: version, reason: 'unreadable' };
    let pdf: Awaited<ReturnType<typeof getDocument>['promise']> | undefined;
    try {
      const task = getDocument({ data: new Uint8Array(data), password, useSystemFonts: true, isEvalSupported: false, disableFontFace: true });
      pdf = await task.promise;
      const pages: PageText[] = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        const positioned = content.items.flatMap(item => {
          if (!('str' in item) || !item.str.trim()) return [];
          const transform = item.transform;
          return [{ x: transform[4], y: transform[5], str: item.str }];
        });
        const text = positionedItemsToText(positioned);
        pages.push({ page: pageNo, text: normalize(text) });
        page.cleanup();
      }
      const usable = pages.filter(p => p.text.replace(/\s/g, '').length >= 15);
      if (!usable.length) return { ok: false, extractorVersion: version, reason: 'unreadable' };
      const allText = pages.map(p => p.text).join('\n');
      if (/\b(?:motor insurance|private car package|two wheeler package|term life policy|travel insurance)\b/i.test(allText)
          && !/\b(?:health insurance|mediclaim|hospitalisation|hospitalization|pre-existing disease|sum insured)\b/i.test(allText)) {
        return { ok: false, extractorVersion: version, reason: 'not_health' };
      }
      return { ok: true, extractorVersion: version, pages: pdf.numPages, facts: extractPolicyFactsFromPages(pages) };
    } catch (err) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'PasswordException') {
        return { ok: false, extractorVersion: version, reason: password ? 'wrong_password' : 'password_required' };
      }
      return { ok: false, extractorVersion: version, reason: 'unreadable' };
    } finally {
      try { await pdf?.destroy(); } catch { /* cleanup must not mask extraction result */ }
    }
  },
});

/** Prototype-only adapter. Never use its example facts as facts from a customer's upload. */
export const demoExtractor = (): PolicyExtractor => ({
  async extract({ data, mime, password }) {
    const v = 'demo-0.1';
    if (mime === 'application/pdf' && isEncryptedPdf(data)) {
      if (!password) return { ok: false, extractorVersion: v, reason: 'password_required' };
      if (password.length < 4) return { ok: false, extractorVersion: v, reason: 'wrong_password' };
    }
    const text = data.toString('latin1');
    if (/motor|vehicle|term life|travel insurance/i.test(text) && !/health|mediclaim|hospital/i.test(text))
      return { ok: false, extractorVersion: v, reason: 'not_health' };
    return {
      ok: true, extractorVersion: v, pages: 4,
      facts: [
        { key: 'insurer_name', value: 'Example General Insurance', sourcePage: 1, confidence: 0.98 },
        { key: 'product_name', value: 'Family Health Optima', sourcePage: 1, confidence: 0.95 },
        { key: 'policy_type', value: 'floater', sourcePage: 1, confidence: 0.93 },
        { key: 'policy_number_last4', value: '4821', sourcePage: 1, confidence: 0.99 },
        { key: 'sum_insured_inr', value: 500000, sourcePage: 1, confidence: 0.97 },
        { key: 'members', value: 'Self (36), Spouse (34), 2 children', sourcePage: 2, confidence: 0.9 },
        { key: 'start_date', value: '2025-11-20', sourcePage: 1, confidence: 0.96 },
        { key: 'end_date', value: '2026-11-19', sourcePage: 1, confidence: 0.96 },
        { key: 'room_rent_limit', value: '1% of sum insured per day', sourcePage: 3, confidence: 0.86 },
        { key: 'copay_percent', value: 0, sourcePage: 3, confidence: 0.82 },
        { key: 'ped_waiting_months', value: 36, sourcePage: 3, confidence: 0.91 },
        { key: 'specific_waiting_months', value: 24, sourcePage: 3, confidence: 0.88 },
        { key: 'initial_waiting_days', value: 30, sourcePage: 3, confidence: 0.92 },
        { key: 'restoration', value: null, sourcePage: null, confidence: null },
        { key: 'no_claim_bonus', value: '10% a year, up to 50%', sourcePage: 4, confidence: 0.7 },
      ],
    };
  },
});

/** Manual fallback for the pilot. Every field starts empty. */
export const manualExtractor = (): PolicyExtractor => ({
  async extract({ data, mime, password }) {
    const v = 'manual-1';
    if (mime === 'application/pdf' && isEncryptedPdf(data) && !password) return { ok: false, extractorVersion: v, reason: 'password_required' };
    return { ok: true, extractorVersion: v, pages: 0, facts: REVIEW_FACTS.map(key => ({ key, value: null, sourcePage: null, confidence: null })) };
  },
});
