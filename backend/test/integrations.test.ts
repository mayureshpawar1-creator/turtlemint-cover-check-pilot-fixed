import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aisensySender, gupshupSender, otpButtons } from '../src/integrations/whatsapp.js';
import { manualExtractor } from '../src/integrations/extractor.js';
import { productionProblems, env } from '../src/config/env.js';

describe('production adapters', () => {
  it('AiSensy: posts the campaign with +91 number, params and OTP button', async () => {
    const calls: { url: string; body: any }[] = [];
    const fetchImpl = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ success: 'true', submitted_message_id: 'abc123' }), { status: 200 });
    }) as unknown as typeof fetch;
    const wa = aisensySender({ apiKey: 'k', fetchImpl });
    const r = await wa.sendTemplate('919812345214', 'cover_check_otp', ['482913'], { buttons: otpButtons('482913') });
    assert.equal(r.messageId, 'abc123');
    assert.equal(calls[0]!.url, 'https://backend.aisensy.com/campaign/t1/api/v2');
    assert.deepEqual({ ...calls[0]!.body, buttons: undefined }, { apiKey: 'k', campaignName: 'cover_check_otp', destination: '+919812345214', userName: 'Cover Check customer', templateParams: ['482913'], buttons: undefined });
    assert.equal(calls[0]!.body.buttons[0].parameters[0].text, '482913');
  });

  it('AiSensy: a failed send throws (so the API reports it, never a silent loss)', async () => {
    const wa = aisensySender({ apiKey: 'k', fetchImpl: (async () => new Response('campaign not live', { status: 400 })) as unknown as typeof fetch });
    await assert.rejects(wa.sendTemplate('+919812345214', 'x', []), /AiSensy 400/);
  });

  it('Gupshup: posts the template id and params, and returns the message id', async () => {
    const calls: { url: string; body: URLSearchParams; apikey: string }[] = [];
    const fetchImpl = (async (url: string, init: { body: URLSearchParams; headers: Record<string, string> }) => {
      calls.push({ url, body: init.body, apikey: init.headers.apikey! });
      return new Response(JSON.stringify({ status: 'submitted', messageId: 'gs-1' }), { status: 200 });
    }) as unknown as typeof fetch;
    const wa = gupshupSender({ apiKey: 'k', appName: 'turtlemint', source: '919000000000', fetchImpl });
    const r = await wa.sendTemplate('+919812345214', 'tmpl-otp-id', ['482913']);
    assert.equal(r.messageId, 'gs-1');
    assert.equal(calls[0]!.url, 'https://api.gupshup.io/wa/api/v1/template/msg');
    assert.equal(calls[0]!.apikey, 'k');
    assert.equal(calls[0]!.body.get('destination'), '919812345214');
    assert.deepEqual(JSON.parse(calls[0]!.body.get('template')!), { id: 'tmpl-otp-id', params: ['482913'] });
  });

  it('Gupshup: HTTP errors and 200-with-status-error both throw (never a silent loss)', async () => {
    const mk = (res: Response) => gupshupSender({ apiKey: 'k', appName: 'a', source: 's', fetchImpl: (async () => res) as unknown as typeof fetch });
    await assert.rejects(mk(new Response('bad key', { status: 401 })).sendTemplate('+919812345214', 'x', []), /Gupshup 401/);
    await assert.rejects(mk(new Response(JSON.stringify({ status: 'error', message: 'template not approved' }), { status: 200 })).sendTemplate('+919812345214', 'x', []), /template not approved/);
  });

  it('production needs a webhook secret, and an OTP template when the provider is Gupshup', () => {
    const base = { ...env, NODE_ENV: 'production' as const, PUBLIC_BASE_URL: 'https://x.example', WEBHOOK_SECRET: undefined };
    assert.ok(productionProblems(base).some((x) => /WEBHOOK_SECRET/.test(x)));
    assert.ok(!productionProblems({ ...base, WEBHOOK_SECRET: 'a-long-random-secret' }).some((x) => /WEBHOOK_SECRET/.test(x)));
    const g = { ...base, WHATSAPP_PROVIDER: 'gupshup' as const, GUPSHUP_API_KEY: 'k', GUPSHUP_SOURCE_NUMBER: '91900', GUPSHUP_OTP_TEMPLATE_ID: undefined };
    assert.ok(productionProblems(g).some((x) => /GUPSHUP_OTP_TEMPLATE_ID/.test(x)));
    assert.ok(!productionProblems({ ...g, GUPSHUP_OTP_TEMPLATE_ID: 'tmpl' }).some((x) => /GUPSHUP_OTP_TEMPLATE_ID/.test(x)));
  });

  it('manual reader: every field starts empty, nothing guessed', async () => {
    const r = await manualExtractor().extract({ data: Buffer.from('%PDF-1.4'), mime: 'application/pdf' });
    assert.ok(r.ok);
    if (r.ok) { assert.ok(r.facts.length >= 10); assert.ok(r.facts.every((f) => f.value === null && f.sourcePage === null)); }
  });

  it('production refuses laptop-only settings', () => {
    const p = productionProblems({
  ...env,
  NODE_ENV: 'production',
  PUBLIC_BASE_URL: 'http://x',
  LINK_TOKEN_SECRET: 'dev-only-secret-change-me-dev-only-secret',
  AGENT_API_KEY: 'dev-agent-key',
  WHATSAPP_PROVIDER: 'console',
  STORAGE_DRIVER: 'local',
  EXTRACTOR: 'demo',
  ADVISORY_RULES_APPROVED: 'false',
  DATA_PROCESSING_APPROVED: 'false',
});
    for (const re of [/LINK_TOKEN_SECRET/, /AGENT_API_KEY/, /WHATSAPP_PROVIDER=console/, /EXTRACTOR=demo/, /STORAGE_DRIVER=supabase/, /ADVISORY_RULES_APPROVED/, /DATA_PROCESSING_APPROVED/, /https/])
      assert.ok(p.some((x) => re.test(x)), String(re));
    assert.deepEqual(productionProblems({ ...env, NODE_ENV: 'development' }), []);
  });

  it('production accepts only explicitly configured Supabase storage and approval gates', () => {
    const valid = {
      ...env,
      NODE_ENV: 'production' as const,
      PUBLIC_BASE_URL: 'https://covercheck.example.com',
      DATABASE_SSL: 'require' as const,
      DATABASE_SSL_CA: '/etc/ssl/certs/provider-ca.pem',
      LINK_TOKEN_SECRET: 'a-real-production-secret-with-more-than-32-characters',
      AGENT_API_KEY: 'a-real-agent-secret',
      WEBHOOK_SECRET: 'a-real-webhook-secret-long-enough',
      WHATSAPP_PROVIDER: 'aisensy' as const,
      AISENSY_API_KEY: 'server-key',
      AISENSY_OTP_CAMPAIGN: 'approved-otp-template',
      AISENSY_SUMMARY_CAMPAIGN: 'approved-summary-template',
      EXTRACTOR: 'manual' as const,
      STORAGE_DRIVER: 'supabase' as const,
      SUPABASE_URL: 'https://example-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
      DOCUMENT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      ADVISORY_RULES_APPROVED: 'true' as const,
      DATA_PROCESSING_APPROVED: 'true' as const,
    };
    assert.deepEqual(productionProblems(valid), []);
    assert.ok(productionProblems({ ...valid, DOCUMENT_ENCRYPTION_KEY: '' }).some((x) => /DOCUMENT_ENCRYPTION_KEY/.test(x)));
    assert.ok(productionProblems({ ...valid, STORAGE_DRIVER: 'local' }).some((x) => /STORAGE_DRIVER=supabase/.test(x)));
    assert.ok(productionProblems({ ...valid, AISENSY_SUMMARY_CAMPAIGN: undefined }).some((x) => /AISENSY_SUMMARY_CAMPAIGN/.test(x)));
    assert.ok(productionProblems({ ...valid, WHATSAPP_PROVIDER: 'gupshup' as const, WA_SUMMARY_TEMPLATE_ID: undefined }).some((x) => /WA_SUMMARY_TEMPLATE_ID/.test(x)));
  });
});
