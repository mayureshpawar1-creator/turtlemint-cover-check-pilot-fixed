/**
 * End-to-end service test against Postgres: the "Priya" example from the spec.
 * Prereq: createdb cover_check_test && DATABASE_URL=… npm run db:migrate (pointing at the test DB).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { callSlots } from '@cover-check/shared';
import { journeyService } from '../src/services/journeyService.js';
import { otpService } from '../src/services/otpService.js';
import { handoffService } from '../src/services/handoffService.js';
import { documentService } from '../src/services/documentService.js';
import { AppError } from '../src/services/errors.js';
import { valueService } from '../src/services/valueService.js';
import { parseCsv, telecallerSheetService } from '../src/services/telecallerSheetService.js';
import { testDeps, waitFor } from './helpers.js';

let clock = new Date('2026-10-03T06:22:00Z'); // 11:52 IST, as in the spec's consent example
const { deps, pool, sent, otps } = testDeps(() => clock);
const journey = journeyService(deps), otp = otpService(deps), handoff = handoffService(deps), docs = documentService(deps), value = valueService(deps);
const mobile = `+9198${String(Date.now()).slice(-8)}`;

describe('Cover Check — Priya end to end', () => {
  let ctx: { leadId: string; sourceId: string | null };
  let sessionId = '';

  before(async () => {
    const token = deps.tokens.issue({ m: mobile, d: 'check', c: 'coverfest', t: 'cover_fest_utility_v1' }, clock.getTime());
    const boot = await journey.openLink(token, { type: 'mobile', os: 'android' });
    assert.equal(boot.door, 'check');
    assert.match(boot.maskedMobile, /^\+91 98••• ••\d{3}$/);
    assert.equal(boot.sessionId, null);
    ctx = { leadId: boot.leadId, sourceId: boot.sourceId };
  });
  after(() => pool.end());

  it('rejects a tampered link', () => {
    const t = deps.tokens.issue({ m: mobile, d: 'check' });
    assert.throws(() => deps.tokens.verify(t.slice(0, -2) + 'xx'), AppError);
  });

  it('runs the v4 one-screen quiz and validates the whole screen on the server', async () => {
    sessionId = (await journey.startQuiz(ctx, 'en')).sessionId;
    const priya = { situation: 'own' as const, sum_insured_band: 'unsure' as const, adults_count: 2, children_count: 2, parents_count: 0,
      age_band: '31_40' as const, income_band: '50k_1l' as const, city_tier: 'metro' as const };
    await assert.rejects(journey.saveScreen(ctx, sessionId, 'S1', { ...priya, city_tier: undefined }, 9000), /missing/);
    const res = await journey.saveScreen(ctx, sessionId, 'S1', priya, 14000);
    assert.equal(res.next, 'S7');
    assert.deepEqual(res.answers.members, ['self', 'spouse', 'children'], 'members derived from the steppers');
    const stored = await deps.repos.quiz.getAnswers(sessionId);
    assert.deepEqual([stored.adults_count, stored.children_count, stored.parents_count], [2, 2, 0]);
  });

  it('shows the readout and records what was shown', async () => {
    const r = await journey.completeQuiz(ctx, sessionId);
    assert.deepEqual(r.check.map((c) => c.ruleId), ['R7']);
    const f = await deps.repos.findings.forLead(ctx.leadId);
    assert.equal(f.length, 1);
  });

  it('capture saves, sends nothing, and never queues a call', async () => {
    const res = await journey.capture(ctx, { firstName: 'Priya', pincode: '411001', mobileConfirmed: true, language: 'en' });
    assert.equal(res.city, 'Pune');
    assert.equal(sent.length, 0, 'summary goes only after preview');
    const lead = await deps.repos.leads.get(ctx.leadId);
    assert.equal(lead!.lead_state, 'data_only');
    assert.equal((await handoff.queue(null)).filter((q: any) => q.lead_id === ctx.leadId).length, 0);
  });

  it('value layer: checklist ticks, plans that fit, preview then send', async () => {
    await value.markChecklist(ctx, 'room_rent', true);
    await assert.rejects(value.markChecklist(ctx, 'cashless', true), /not open/);
    const recs = await value.recommendations(ctx, 'quiz');
    // not sure of her cover → we ask to read her policy first; nothing health-related is sold blind
    assert.deepEqual(recs.map((r) => r.type), ['term_life', 'critical_illness'], 'exactly the plans suggested on the board');
    await value.clickRecommendation(ctx, 'quiz', 'critical_illness', 'advisor');
    await value.clickRecommendation(ctx, 'quiz', 'term_life', 'turtlemint');
    const preview = await value.summaryPreview(ctx);
    assert.match(preview.text, /^Hi Priya, here is your Cover Check summary/);
    const out = await value.sendSummary(ctx, { contactConsent: false, language: 'en', previewedAt: preview.previewedAt });
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0]!.params[0], 'Priya');
    assert.equal(out.queued, false, 'summary without a tick never reaches a telecaller');
  });

  it('a call needs consent, then OTP', async () => {
    clock = new Date('2026-10-03T06:23:00Z');
    const slot = callSlots(clock).find((s) => s.label === '5 pm – 7 pm' && s.day === 'today')!;
    const req = { requestedAction: 'advisor_call' as const, slotStart: slot.start, slotEnd: slot.end, callLanguage: 'hi' as const,
      topic: 'renewal' as const, note: 'Premium badh gaya hai.' };
    await assert.rejects(handoff.request(ctx, { ...req, contactConsent: false }, 'en'), (e: AppError) => e.code === 'CONSENT_REQUIRED');
    await assert.rejects(handoff.request(ctx, { ...req, contactConsent: true }, 'en'), (e: AppError) => e.code === 'OTP_REQUIRED');

    await otp.send(ctx, 'call');
    await assert.rejects(otp.verify(ctx, '000000'.replace(/./g, (_c, i) => String((Number(otps[0]![i]) + 1) % 10))), (e: AppError) => e.code === 'OTP_INVALID');
    await otp.verify(ctx, otps[0]!);

    const out = await handoff.request(ctx, { ...req, contactConsent: true }, 'en');
    assert.equal(out.leadState, 'hand_raised');
    assert.equal(out.priority, 'P2');
    assert.equal(out.queued, true);
  });

  it('the telecaller card restates only what Priya told us', async () => {
    const card = await handoff.card(ctx.leadId, 'Rohan');
    assert.equal(card.firstName, 'Priya');
    assert.equal(card.priority, 'P2');
    assert.match(card.situationLine, /^Has own policy · self \+ spouse \+ 2 children · age 31–40/);
    assert.match(card.adviceLine, /^A growing family · Health ₹20 L \(cover amount not sure\) · Advice: Check your policy first · Term ₹1.25 Cr · Crisis ₹25 L/);
    assert.deepEqual(card.toldThem.map((t) => t.ruleId), ['R7']);
    assert.match(card.consentLine, /^Call consent given \d{1,2} \w{3}, /);
    assert.match(card.openingScript, /Rohan from Turtlemint/);
    assert.match(card.plansLine, /^Term insurance \(opened on Turtlemint\) · Critical illness cover/);
    assert.match(card.checklistLine, /Room rent \(they ticked it\)/);
  });

  it('policy upload: consent, read, confirm, summary', async () => {
    await assert.rejects(docs.upload(ctx, [{ originalName: 'p.pdf', mime: 'application/pdf', data: Buffer.from('%PDF health') }]),
      (e: AppError) => e.code === 'CONSENT_REQUIRED');
    await docs.consent(ctx, 'en');
    const up = await docs.upload(ctx, [
      { originalName: 'schedule.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1.7 health policy schedule') },
      { originalName: 'notes.docx', mime: 'application/msword', data: Buffer.from('x') },
    ]);
    assert.equal(up.accepted.length, 1);
    assert.equal(up.rejected.length, 1);
    const docId = up.accepted[0]!;
    await waitFor(async () => ['ready', 'needs_review'].includes((await docs.status(ctx, docId)).status));
    const view = await docs.status(ctx, docId);
    assert.equal(view.facts.find((f) => f.key === 'no_claim_bonus')!.value, null, 'low confidence is shown empty');
    const summary = await docs.confirm(ctx, docId, [{ key: 'no_claim_bonus', userValue: '10% a year' }]);
    assert.ok(summary.points.some((p) => p.ruleId === 'D1'));
    assert.ok(summary.sections.find((s) => s.id === 'covered')!.lines.some((l) => !l.found), 'restoration not found is said plainly');
  });

  it('telecaller sheet: exports only callable leads, once, and reads outcomes back', async () => {
    const sheet = telecallerSheetService(deps);
    const first = await sheet.exportCsv();
    const rows = parseCsv(first.csv);
    const mine = rows.filter((r) => r.includes(ctx.leadId));
    assert.equal(mine.length, 1, 'Priya is in the sheet once');
    const head = rows[0]!;
    const row = mine[0]!;
    assert.equal(row[head.indexOf('Name')], 'Priya');
    assert.match(row[head.indexOf('Mobile')]!, /^\+91 \d{5} \d{5}$/);
    assert.equal(row[head.indexOf('Priority')], 'P2');
    assert.match(row[head.indexOf('Their note')]!, /Premium badh gaya hai/);

    const again = await sheet.exportCsv();
    assert.equal(parseCsv(again.csv).filter((r) => r.includes(ctx.leadId)).length, 0, 'not handed out twice');

    // telecaller fills the outcome columns
    row[head.indexOf('Connected (Y/N)')] = 'Y';
    row[head.indexOf('Call minutes')] = '4';
    row[head.indexOf('Disposition')] = 'Call back later';
    row[head.indexOf('Agent notes')] = 'Wants to compare after renewal notice, "call Monday"';
    row[head.indexOf('Agent name')] = 'Rohan';
    const filled = [head, row].map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n');
    const res = await sheet.importCsv(filled);
    assert.equal(res.recorded, 1);
    const twice = await sheet.importCsv(filled);
    assert.equal(twice.recorded, 0, 'same file twice does not double-record');
    const bad = await sheet.importCsv(filled.replace('Call back later', 'maybe'));
    assert.match(bad.skipped[0]!.reason, /Disposition/);
  });

  it('withdrawal removes the lead from the queue at once', async () => {
    await journey.withdraw(ctx.leadId, 'page');
    assert.equal((await handoff.queue(null)).filter((q: any) => q.lead_id === ctx.leadId).length, 0);
    const lead = await deps.repos.leads.get(ctx.leadId);
    assert.equal(lead!.do_not_contact, true);
  });
});
