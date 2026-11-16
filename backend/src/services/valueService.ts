/**
 * v2 value layer: plans that fit (S9a, U7), checklist ticks (S7), and the WhatsApp summary that is
 * previewed (S9b) before it is sent. Everything shown or clicked is stored for the telecaller and analytics.
 */
import { createHash } from 'node:crypto';
import {
  suggestedCoverLakh, buildReadout, buildSnapshot, buildWhatsAppSummary, recommendFromPolicy, recommendPlans, PLAN_TYPES,
  type Language, type PlanRec, type PlanType, type QuizAnswers,
} from '@cover-check/shared';
import { AppError } from './errors.js';
import type { Deps, LeadCtx } from './deps.js';
import { handoffService } from './handoffService.js';

export const valueService = (d: Deps) => {
  const answersFor = async (leadId: string): Promise<QuizAnswers> => {
    const s = await d.repos.quiz.latestSession(leadId);
    return s ? d.repos.quiz.getAnswers(s.session_id) : {};
  };

  return {
    /** S9a (origin quiz) or U7 (origin document). Computed on the server and recorded as shown. */
    async recommendations(ctx: LeadCtx, origin: 'quiz' | 'document'): Promise<PlanRec[]> {
      let recs: PlanRec[];
      if (origin === 'document') {
        const doc = await d.repos.documents.latestForLead(ctx.leadId);
        recs = doc ? recommendFromPolicy(await d.repos.documents.facts(doc.doc_id), await answersFor(ctx.leadId)) : [];
      } else recs = recommendPlans(await answersFor(ctx.leadId));
      await d.repos.value.recordShown(ctx.leadId, origin, recs);
      await d.repos.events.log({ name: 'recommendation_shown', leadId: ctx.leadId, screenId: origin === 'quiz' ? 'S9a' : 'U7',
        props: { types: recs.map((r) => r.type).join(',') } });
      return recs;
    },

    async clickRecommendation(ctx: LeadCtx, origin: 'quiz' | 'document', type: PlanType, target: 'turtlemint' | 'advisor') {
      if (!PLAN_TYPES.includes(type)) throw new AppError('VALIDATION', 'Unknown plan type');
      if (target === 'advisor') await d.repos.value.markAdvisorRequested(ctx.leadId, type);
      else if (!(await d.repos.value.markClicked(ctx.leadId, origin, type))) throw new AppError('NOT_FOUND', 'That option was not shown');
      await d.repos.events.log({ name: 'recommendation_clicked', leadId: ctx.leadId, props: { type, origin, target } });
    },

    /** S7: the person ticks a box they have checked themselves. Only open boxes can be ticked. */
    async markChecklist(ctx: LeadCtx, itemId: string, marked: boolean) {
      const item = buildSnapshot(await answersFor(ctx.leadId)).checklist.find((c) => c.id === itemId);
      if (!item || (item.status !== 'check' && item.status !== 'unknown')) throw new AppError('VALIDATION', 'That item is not open');
      await d.repos.value.markChecklist(ctx.leadId, itemId, item.status, marked);
      await d.repos.events.log({ name: 'checklist_marked', leadId: ctx.leadId, screenId: 'S7', props: { itemId, marked } });
    },

    /** S9b: exactly the message that will be sent. */
    async summaryPreview(ctx: LeadCtx) {
      const lead = await d.repos.leads.get(ctx.leadId);
      if (!lead) throw new AppError('NOT_FOUND', 'Not found');
      const a = await answersFor(ctx.leadId);
      const msg = buildWhatsAppSummary(lead.first_name, a, buildReadout(a));
      await d.repos.events.log({ name: 'summary_previewed', leadId: ctx.leadId, screenId: 'S9b' });
      return { text: msg.text, previewedAt: d.now().toISOString() };
    },

    /** S9b "Send to my WhatsApp": consent, send, record, and the summary_only hand-off (with optional contact tick). */
    async sendSummary(ctx: LeadCtx, opts: { contactConsent: boolean; language: Language; previewedAt?: string }) {
      const lead = await d.repos.leads.get(ctx.leadId);
      if (!lead) throw new AppError('NOT_FOUND', 'Not found');
      if (!lead.mobile_confirmed) throw new AppError('VALIDATION', 'Confirm your WhatsApp number first.');
      await d.repos.consents.grant({ leadId: ctx.leadId, purpose: 'whatsapp_summary', noticeVersion: d.config.noticeVersion,
        noticeLanguage: opts.language, method: 'button', ip: ctx.ip, userAgent: ctx.userAgent });
      const a = await answersFor(ctx.leadId);
      const msg = buildWhatsAppSummary(lead.first_name, a, buildReadout(a));
      const sent = await d.whatsapp.sendTemplate(lead.mobile, d.config.waSummaryTemplateId, msg.params, { userName: lead.first_name ?? undefined });
      await d.repos.whatsapp.record({ waMessageId: sent.messageId, leadId: ctx.leadId, templateId: d.config.waSummaryTemplateId, kind: 'summary',
        bodySha256: createHash('sha256').update(msg.text).digest('hex'), previewedTs: opts.previewedAt ? new Date(opts.previewedAt) : undefined });
      await d.repos.events.log({ name: 'summary_sent', leadId: ctx.leadId, props: { waMessageId: sent.messageId } });
      // A call they already booked stays booked: the summary never replaces an open call request.
      const open = await d.repos.handoffs.latest(ctx.leadId);
      const callBooked = !!open && !open.closed_ts && (open.requested_action === 'advisor_call' || open.requested_action === 'callback') && !!open.queue;
      const h = callBooked ? { queued: true }
        : await handoffService(d).request(ctx, { requestedAction: 'summary_only', contactConsent: opts.contactConsent }, opts.language);
      return { sentAt: d.now().toISOString(), waMessageId: sent.messageId, queued: h.queued };
    },
  };
};
export type ValueService = ReturnType<typeof valueService>;
