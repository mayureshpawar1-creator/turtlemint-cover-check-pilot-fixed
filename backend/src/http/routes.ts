/**
 * REST API v1. Thin: parse → service → JSON. No SQL and no business rules here.
 *
 *  Customer (Bearer link token)                    Telecaller (x-agent-key)
 *  GET  /link/:token            S0 bootstrap        GET  /agent/queue, /agent/export.csv
 *  POST /events                 any screen          GET  /agent/leads/:id/card
 *  POST /quiz/sessions          S1 first tap        POST /agent/leads/:id/outcomes
 *  PUT  /quiz/sessions/:id      S1–S6
 *  POST /quiz/sessions/:id/complete   S7           Ops (x-agent-key)
 *  POST /quiz/sessions/:id/dwell      S7           POST /ops/links  issue a signed link
 *  GET  /pincode/:pin           S8                 POST /webhooks/whatsapp  inbound STOP
 *  POST /capture                S8
 *  POST /otp/send, /otp/verify  S9, U2
 *  POST /handoff                S9
 *  GET  /recommendations       S9a, U7    POST /recommendations/click
 *  POST /checklist              S7         GET /summary/preview, POST /summary/send  S9b
 *  POST /consents/withdraw      S10
 *  POST /documents/consent      U1
 *  POST /documents              U3 (multipart, field "files")
 *  POST /documents/:id/password U3
 *  GET  /documents/:id          U4/U5 poll
 *  POST /documents/:id/confirm  U5
 *  GET  /documents/:id/summary  U6–U8
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { callSlots } from '@cover-check/shared';
import type { Deps } from '../services/deps.js';
import { journeyService } from '../services/journeyService.js';
import { otpService } from '../services/otpService.js';
import { handoffService } from '../services/handoffService.js';
import { documentService } from '../services/documentService.js';
import { telecallerSheetService } from '../services/telecallerSheetService.js';
import { valueService } from '../services/valueService.js';
import { AppError } from '../services/errors.js';
import { h, parse, requireAgent, requireLead, safeEqual, startWebSession } from './middleware.js';
import * as S from './schemas.js';

export function apiRouter(d: Deps, agentKey: string, opts: { webhookSecret?: string; sessionHours?: number; secureCookies?: boolean } = {}): Router {
  const journey = journeyService(d), otp = otpService(d), handoff = handoffService(d), docs = documentService(d), value = valueService(d);
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: d.config.maxFiles, fileSize: d.config.maxFileMb * 1024 * 1024 } });
  const r = Router();
  const lead = requireLead(d);
  const agent = requireAgent(agentKey);

  // ---------------------------------------------------------------- Rung 1
  r.get('/link/:token', h(async (req, res) => {
    const ua = req.header('user-agent') ?? '';
    const device = { type: /mobile/i.test(ua) ? 'mobile' : 'desktop', os: /android/i.test(ua) ? 'android' : /iphone|ipad/i.test(ua) ? 'ios' : 'other', browser: ua.slice(0, 120) };
    const boot = await journey.openLink(req.params.token!, device, req.query as Record<string, string>, req.header('referer') ?? undefined);
    // 1.7 (S3): from here on the browser uses an HttpOnly session cookie; the app then removes the token from the URL
    await startWebSession(d, res, boot, { hours: opts.sessionHours ?? 72, secure: opts.secureCookies ?? true });
    return { ...boot, slots: callSlots(d.now()) };
  }));

  /** Reload / return visit with the session cookie: same bootstrap, no new click logged. */
  r.get('/me', lead, h(async (req) => ({ ...(await journey.resume(req.lead!)), slots: callSlots(d.now()) })));

  /**
   * Browser interaction events. Never fails the page: an unknown name or a server milestone is answered 202 and
   * recorded in event_reject (name + reason only), so tracking drift shows up in data instead of disappearing.
   */
  r.post('/events', lead, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const e = S.Event.safeParse(req.body);
      if (!e.success) {
        const body = (req.body ?? {}) as { name?: unknown; screenId?: unknown };
        const issue = e.error.issues[0];
        await d.repos.events.reject({
          name: typeof body.name === 'string' ? body.name : '(missing)',
          screenId: typeof body.screenId === 'string' ? body.screenId : null,
          reason: issue ? `${issue.path.join('.') || 'body'}: ${issue.code}` : 'invalid',
        });
        res.status(202).json({ ok: true, accepted: false });
        return;
      }
      await journey.logEvent(req.lead!, e.data.name, e.data.screenId, e.data.props ?? undefined, e.data.sessionId);
      res.status(202).json({ ok: true, accepted: true });
    } catch (err) { next(err); }
  });

  r.post('/quiz/sessions', lead, h(async (req) => journey.startQuiz(req.lead!, parse(S.StartQuiz, req.body).language)));

  r.put('/quiz/sessions/:id', lead, h(async (req) => {
    const b = parse(S.SaveScreen, req.body);
    return journey.saveScreen(req.lead!, req.params.id!, b.screenId, b.answers, b.timeOnScreenMs);
  }));

  r.post('/quiz/sessions/:id/complete', lead, h(async (req) => journey.completeQuiz(req.lead!, req.params.id!)));
  r.post('/quiz/sessions/:id/dwell', lead, h(async (req) => journey.readoutDwell(req.lead!, req.params.id!, parse(S.Dwell, req.body).dwellMs)));

  r.get('/pincode/:pin', lead, h(async (req) => journey.lookupPincode(req.params.pin!)));
  r.post('/capture', lead, h(async (req) => journey.capture(req.lead!, parse(S.Capture, req.body))));

  r.post('/otp/send', lead, h(async (req) => otp.send(req.lead!, parse(S.Otp, req.body).purpose)));
  r.post('/otp/verify', lead, h(async (req) => otp.verify(req.lead!, parse(S.OtpVerify, req.body).code)));

  r.get('/slots', lead, h(async () => callSlots(d.now())));
  r.post('/handoff', lead, h(async (req) => {
    const { language, ...body } = parse(S.Handoff, req.body);
    return handoff.request(req.lead!, body, language);
  }));

  r.post('/consents/withdraw', lead, h(async (req) => journey.withdraw(req.lead!.leadId, 'page')));

  // ---------------------------------------------------------------- v2 value layer (S7 checklist, S9a plans, S9b preview, U7)
  r.get('/recommendations', lead, h(async (req) => value.recommendations(req.lead!, parse(S.RecOrigin, req.query).origin)));
  r.post('/recommendations/click', lead, h(async (req) => { const b = parse(S.RecClick, req.body); await value.clickRecommendation(req.lead!, b.origin, b.type, b.target); }));
  r.post('/checklist', lead, h(async (req) => { const b = parse(S.ChecklistMark, req.body); await value.markChecklist(req.lead!, b.itemId, b.marked); }));
  r.get('/summary/preview', lead, h(async (req) => value.summaryPreview(req.lead!)));
  r.post('/summary/send', lead, h(async (req) => value.sendSummary(req.lead!, parse(S.SummarySend, req.body))));

  // ---------------------------------------------------------------- Rung 2
  r.post('/documents/consent', lead, h(async (req) => docs.consent(req.lead!, parse(S.DocConsent, req.body).language)));
  r.post('/documents', lead, upload.array('files', d.config.maxFiles), h(async (req) => {
    const files = ((req.files ?? []) as Express.Multer.File[]).map((f) => ({ originalName: f.originalname, mime: f.mimetype, data: f.buffer }));
    return docs.upload(req.lead!, files);
  }));
  r.post('/documents/:id/password', lead, h(async (req) => docs.submitPassword(req.lead!, req.params.id!, parse(S.DocPassword, req.body).password)));
  r.get('/documents/:id', lead, h(async (req) => docs.status(req.lead!, req.params.id!)));
  r.post('/documents/:id/confirm', lead, h(async (req) => docs.confirm(req.lead!, req.params.id!, parse(S.ConfirmFacts, req.body).edits)));
  r.get('/documents/:id/summary', lead, h(async (req) => docs.summary(req.lead!, req.params.id!)));

  // ---------------------------------------------------------------- Telecaller
  r.get('/agent/queue', agent, h(async (req) => handoff.queue(parse(S.AgentQueue, req.query).queue ?? null)));
  r.get('/agent/leads/:id/card', agent, h(async (req) => handoff.card(req.params.id!, req.header('x-agent-name') ?? undefined)));
  /** Same sheet as `npm run export:leads`, as a download. ?all=1 re-exports open leads. */
  r.get('/agent/export.csv', agent, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { csv, batch } = await telecallerSheetService(d).exportCsv({ onlyNew: req.query.all !== '1' });
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="telecaller-sheet-${batch}.csv"`);
      res.send(csv);
    } catch (e) { next(e); }
  });

  r.post('/agent/leads/:id/outcomes', agent, h(async (req) => {
    const { handoffId, ...o } = parse(S.Outcome, req.body);
    return handoff.outcome(req.agentId!, handoffId, req.params.id!, o);
  }));

  // ---------------------------------------------------------------- Ops + webhooks
  r.post('/ops/links', agent, h(async (req) => {
    const b = parse(S.IssueLink, req.body);
    // 1.3: a link may only name a registered campaign (and one of its variants), so every visit can be attributed.
    if (b.campaignId && !(await d.repos.campaigns.get(b.campaignId))) throw new AppError('VALIDATION', 'Unknown campaign — register it first (POST /ops/campaigns).');
    if (b.variantId && (!b.campaignId || !(await d.repos.campaigns.hasVariant(b.campaignId, b.variantId))))
      throw new AppError('VALIDATION', 'Unknown variant for this campaign.');
    return { token: d.tokens.issue({ m: b.mobile, d: b.door, c: b.campaignId, cr: b.creativeId, v: b.variantId, t: b.templateId }, d.now().getTime()) };
  }));

  /** 1.3 campaign registry: create or update a campaign and its variants (landing copy per variant). */
  r.post('/ops/campaigns', agent, h(async (req) => d.repos.campaigns.upsert(parse(S.CampaignUpsert, req.body))));
  /** First-touch funnel for one campaign, per variant and day. */
  r.get('/ops/campaigns/:id/funnel', agent, h(async (req) => {
    if (!(await d.repos.campaigns.get(req.params.id!))) throw new AppError('NOT_FOUND', 'Campaign not found');
    return d.repos.campaigns.funnel(req.params.id!);
  }));

  /**
   * Inbound WhatsApp (Gupshup payload shape). "STOP" withdraws contact + WhatsApp consent.
   * Protected by a shared secret (WEBHOOK_SECRET) sent as the x-webhook-secret header. 1.7 (S7): no longer accepted in
   * the URL, where it would end up in proxy and access logs.
   * Production refuses to start without one, so strangers cannot withdraw other people's consent.
   */
  r.post('/webhooks/whatsapp', h(async (req) => {
    if (opts.webhookSecret) {
      const given = req.header('x-webhook-secret') ?? '';
      if (!safeEqual(given, opts.webhookSecret)) throw new AppError('FORBIDDEN', 'Not allowed');
    }
    const text: string = req.body?.payload?.payload?.text ?? '';
    const from: string = req.body?.payload?.source ?? '';
    if (/^\s*stop\s*$/i.test(text) && from) {
      const leadRow = await d.repos.leads.findByMobile(`+${from.replace(/^\+/, '')}`);
      if (leadRow) await journey.withdraw(leadRow.lead_id, 'stop_reply');
    }
    return { ok: true };
  }));

  return r;
}
