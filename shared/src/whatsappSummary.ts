/**
 * The WhatsApp summary — one builder used for the on-screen preview AND the message sent,
 * so the person receives exactly what they saw. WhatsApp formatting (*bold*). Kept under the
 * 1,024-character template body limit. Template wording needs Meta + compliance approval.
 */
import type { QuizAnswers, Readout } from './types';
import { buildSnapshot } from './insights';
import { recommendPlans } from './recommendations';
import { buildAdvice } from './advice';

export const SUMMARY_MAX = 1024;

/**
 * Template body submitted to Meta. Line breaks live in the template; parameters must be single-line
 * (Meta rejects variables containing new lines, tabs or 4+ spaces), so list items are joined with " · ".
 */
export const SUMMARY_TEMPLATE_BODY =
  'Hi {{1}}, here is your Cover Check summary.\n\n*{{2}}*\n\n*What’s working for you*\n{{3}}\n\n*Worth checking*\n{{4}}\n\n*Options to explore*\n{{5}}\n\nReply ADVISOR to talk to an expert, or STOP to opt out.';

export interface SummaryMessage {
  /** {{1}} name · {{2}} cover line · {{3}} working for you · {{4}} to check · {{5}} options */
  params: [string, string, string, string, string];
  /** Exactly what the person receives: the template with the parameters filled in. */
  text: string;
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim();

export function buildWhatsAppSummary(firstName: string | null, a: QuizAnswers, readout: Readout): SummaryMessage {
  const snap = buildSnapshot(a);
  const adv = buildAdvice(a);
  const good = snap.checklist.filter((c) => c.status === 'good').map((c) => `✅ ${c.label}`);
  const strengths = adv.wins.length ? adv.wins.map((w) => `✅ ${w}`) : good.length ? good : snap.strengths.map((x) => `✅ ${x.title}`);
  const toCheck = adv.gaps.length ? adv.gaps.map((g) => `🔎 ${g.title}`)
    : snap.checklist.filter((c) => c.status === 'check' || c.status === 'unknown').map((c) => `🔎 ${c.label}`);
  const recs = recommendPlans(a).map((r) => r.title);

  const params: SummaryMessage['params'] = [
    oneLine(clip(firstName ?? 'there', 40)),
    oneLine(adv.kind === 'needs' ? `Suggested cover: ₹${adv.suggestedLakh} L`
      : adv.shortfallLakh ? `Suggested cover: ₹${adv.suggestedLakh} L — you’re ₹${adv.shortfallLakh} L short`
      : `Your cover: ${adv.currentLabel ?? 'not sure'}`),
    oneLine(clip(strengths.slice(0, 3).join(' · ') || '✅ You took a minute to understand your cover', 220)),
    oneLine(clip((toCheck.length ? toCheck : readout.check.map((c) => `🔎 ${c.text}`)).slice(0, 3).join(' · ') || 'Nothing stood out from your answers', 260)),
    oneLine(clip(recs.slice(0, 2).join(' · ') || 'Upload your policy for a full check', 160)),
  ];
  const text = SUMMARY_TEMPLATE_BODY.replace(/\{\{(\d)\}\}/g, (_m, n) => params[Number(n) - 1]!);
  return { params, text: clip(text, SUMMARY_MAX) };
}
