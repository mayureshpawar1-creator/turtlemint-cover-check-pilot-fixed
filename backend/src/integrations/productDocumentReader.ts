/**
 * First-pass evidence discovery for official insurer product PDFs.
 *
 * This does NOT interpret clauses or approve product terms. It captures exact text lines
 * that mention known topics, with page provenance, for a human reviewer to classify.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type ProductEvidenceKey =
  | 'product_identity'
  | 'uin'
  | 'eligibility_age'
  | 'sum_insured_options'
  | 'room_rent'
  | 'copay'
  | 'deductible'
  | 'waiting_period_initial'
  | 'waiting_period_pre_existing'
  | 'waiting_period_specific'
  | 'restoration'
  | 'no_claim_bonus'
  | 'sub_limits'
  | 'exclusions'
  | 'add_ons'
  | 'network_cashless'
  | 'claims_process'
  | 'portability_continuity'
  | 'other';

export interface ProductEvidenceCandidate {
  factKey: ProductEvidenceKey;
  sourcePage: number;
  evidenceText: string;
}

export interface ProductPageText {
  page: number;
  text: string;
}

export const PRODUCT_EVIDENCE_EXTRACTOR_VERSION = 'keyword-context-1.0.0';
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_PAGES = 1000;
const MAX_EVIDENCE_PER_KEY = 30;
const MAX_EVIDENCE_TOTAL = 500;

const TOPIC_PATTERNS: Array<{ factKey: ProductEvidenceKey; pattern: RegExp }> = [
  { factKey: 'product_identity', pattern: /\b(?:product name|name of the product|plan name)\b/i },
  { factKey: 'uin', pattern: /\bUIN\b|unique identification number/i },
  { factKey: 'eligibility_age', pattern: /\b(?:entry age|age at entry|minimum entry age|maximum entry age|adult entry age|child entry age|renewal age|lifelong renewability)\b/i },
  { factKey: 'sum_insured_options', pattern: /\b(?:sum insured|sum-insured|available sum insured|policy limit)\b/i },
  { factKey: 'room_rent', pattern: /\b(?:room rent|room category|room charges|single private room|shared accommodation)\b/i },
  { factKey: 'copay', pattern: /\b(?:co[- ]?pay(?:ment)?|co[- ]?insurance)\b/i },
  { factKey: 'deductible', pattern: /\bdeductible\b/i },
  { factKey: 'waiting_period_initial', pattern: /\b(?:initial waiting period|initial exclusion|first 30 days|first thirty days)\b/i },
  { factKey: 'waiting_period_pre_existing', pattern: /\b(?:pre-existing|pre existing|pre-existing disease|PED waiting)\b/i },
  { factKey: 'waiting_period_specific', pattern: /\b(?:specific disease|specified disease|specific waiting period|named ailment)\b/i },
  { factKey: 'restoration', pattern: /\b(?:restoration|restore benefit|reinstatement benefit)\b/i },
  { factKey: 'no_claim_bonus', pattern: /\b(?:no claim bonus|no-claim bonus|cumulative bonus|NCB)\b/i },
  { factKey: 'sub_limits', pattern: /\b(?:sub.?limits?|capping|limit per illness|procedure limit)\b/i },
  { factKey: 'exclusions', pattern: /\b(?:exclusion|excluded|not covered|permanent exclusion)\b/i },
  { factKey: 'add_ons', pattern: /\b(?:add.?ons?|optional covers?|riders?|additional covers?)\b/i },
  { factKey: 'network_cashless', pattern: /\b(?:cashless|network hospitals?|network providers?)\b/i },
  { factKey: 'claims_process', pattern: /\b(?:claim intimation|claim process|reimbursement claim|pre-authori[sz]ation|settlement of claim)\b/i },
  { factKey: 'portability_continuity', pattern: /\b(?:portability|migration credits?|continuity benefits?|waiting period credits?)\b/i },
];

type PositionedTextItem = { x: number; y: number; str: string };

export function positionedProductItemsToText(items: PositionedTextItem[]): string {
  const positioned = items.filter(item => item.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; parts: PositionedTextItem[] }> = [];
  for (const item of positioned) {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 2);
    if (!line) {
      line = { y: item.y, parts: [] };
      lines.push(line);
    }
    line.parts.push(item);
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map(line => line.parts.sort((a, b) => a.x - b.x).map(part => part.str).join(' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Keyword matching only discovers candidate evidence; it never creates a normalized policy value. */
export function extractProductEvidenceFromPages(pages: ProductPageText[]): ProductEvidenceCandidate[] {
  const output: ProductEvidenceCandidate[] = [];
  const counts = new Map<ProductEvidenceKey, number>();
  const seen = new Set<string>();

  for (const page of pages) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/[\t ]+/g, ' ');
      if (!line) continue;
      for (const topic of TOPIC_PATTERNS) {
        if (!topic.pattern.test(line)) continue;
        const identity = `${page.page}\u0000${topic.factKey}\u0000${line}`;
        if (seen.has(identity)) continue;
        const count = counts.get(topic.factKey) ?? 0;
        if (count >= MAX_EVIDENCE_PER_KEY || output.length >= MAX_EVIDENCE_TOTAL) continue;
        seen.add(identity);
        counts.set(topic.factKey, count + 1);
        output.push({ factKey: topic.factKey, sourcePage: page.page, evidenceText: line.slice(0, 4000) });
      }
      if (output.length >= MAX_EVIDENCE_TOTAL) return output;
    }
  }
  return output;
}

export async function readProductPdf(data: Buffer): Promise<{ pageCount: number; pages: ProductPageText[] }> {
  if (!data.length || data.length > MAX_BYTES) throw new Error('PDF must be between 1 byte and 50 MiB.');
  if (data.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Downloaded content is not a PDF.');
  let pdf: Awaited<ReturnType<typeof getDocument>['promise']> | undefined;
  try {
    const task = getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
    });
    pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > MAX_PAGES) throw new Error(`PDF page count is outside the supported range (1-${MAX_PAGES}).`);
    const pages: ProductPageText[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const items = content.items.flatMap(item => {
        if (!('str' in item) || !item.str.trim()) return [];
        return [{ x: item.transform[4], y: item.transform[5], str: item.str }];
      });
      pages.push({ page: pageNo, text: positionedProductItemsToText(items) });
      page.cleanup();
    }
    if (!pages.some(page => page.text.replace(/\s/g, '').length >= 15)) {
      throw new Error('PDF has no usable text layer; scanned/image-only documents require an approved OCR step.');
    }
    return { pageCount: pdf.numPages, pages };
  } finally {
    try { await pdf?.destroy(); } catch { /* cleanup must not hide the primary extraction result */ }
  }
}
