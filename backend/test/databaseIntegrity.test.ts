import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { journeyService } from '../src/services/journeyService.js';
import { otpService } from '../src/services/otpService.js';
import { AppError } from '../src/services/errors.js';
import { testDeps } from './helpers.js';

let sequence = 0;
const mobile = (prefix: '96' | '97') => `+91${prefix}${String(Date.now() + sequence++).slice(-8)}`;
const { deps, pool, otps } = testDeps(() => new Date());
const otp = otpService(deps);
const journey = journeyService(deps);

after(async () => { await pool.end(); });

describe('PostgreSQL-backed security and continuity checks', () => {
  it('rejects an OTP challenge after the lead mobile changes', async () => {
    otps.length = 0;
    const originalMobile = mobile('96');
    const changedMobile = mobile('97');
    const lead = await deps.repos.leads.upsertByMobile(originalMobile);
    const ctx = { leadId: lead.lead_id, sourceId: null };

    await otp.send(ctx, 'upload');
    const code = otps.at(-1)!;
    await deps.repos.leads.saveCapture(lead.lead_id, {
      firstName: 'Synthetic', pincode: '411001', city: 'Pune', state: 'Maharashtra', language: 'en', mobile: changedMobile,
    });

    await assert.rejects(otp.verify(ctx, code), (error: unknown) => error instanceof AppError && error.code === 'OTP_INVALID');
    const challenge = await deps.repos.otps.lastSent(lead.lead_id);
    const currentLead = await deps.repos.leads.get(lead.lead_id);
    assert.equal(challenge?.mobile, originalMobile);
    assert.equal(challenge?.attempts, 0);
    assert.equal(currentLead?.mobile, changedMobile);
    assert.equal(currentLead?.mobile_verified, false);
  });

  it('never increments OTP attempts beyond three under concurrent PostgreSQL updates', async () => {
    otps.length = 0;
    const lead = await deps.repos.leads.upsertByMobile(mobile('96'));
    const ctx = { leadId: lead.lead_id, sourceId: null };
    await otp.send(ctx, 'upload');
    const code = otps.at(-1)!;
    const wrongCode = `${(Number(code[0]) + 1) % 10}${code.slice(1)}`;

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => otp.verify(ctx, wrongCode)));
    const invalid = results.filter((result) => result.status === 'rejected' && result.reason instanceof AppError && result.reason.code === 'OTP_INVALID');
    const locked = results.filter((result) => result.status === 'rejected' && result.reason instanceof AppError && result.reason.code === 'OTP_LOCKED');
    const challenge = await deps.repos.otps.lastSent(lead.lead_id);

    assert.equal(invalid.length + locked.length, 8);
    assert.equal(challenge?.attempts, 3);
  });

  it('reopens a signed link to its original lead after the mobile changes', async () => {
    const originalMobile = mobile('96');
    const changedMobile = mobile('97');
    const token = deps.tokens.issue({ m: originalMobile, d: 'check' });
    const first = await journey.openLink(token, { type: 'mobile', os: 'android' });

    await deps.repos.leads.saveCapture(first.leadId, {
      firstName: 'Synthetic', pincode: '411001', city: 'Pune', state: 'Maharashtra', language: 'en', mobile: changedMobile,
    });
    const reopened = await journey.openLink(token, { type: 'mobile', os: 'android' });
    const binding = await deps.repos.sources.leadForToken(deps.tokens.hash(token));

    assert.equal(reopened.leadId, first.leadId);
    assert.equal(binding?.lead_id, first.leadId);
    assert.notEqual(reopened.maskedMobile, first.maskedMobile);
  });

  it('serializes concurrent first opens of the same signed link', async () => {
    const token = deps.tokens.issue({ m: mobile('96'), d: 'check' });
    const [first, second] = await Promise.all([
      journey.openLink(token, { type: 'mobile', os: 'android' }),
      journey.openLink(token, { type: 'mobile', os: 'android' }),
    ]);
    const binding = await deps.repos.sources.leadForToken(deps.tokens.hash(token));
    const { rows } = await pool.query<{ count: string }>(
      'SELECT count(DISTINCT lead_id)::text AS count FROM source WHERE link_token_hash = $1', [deps.tokens.hash(token)]);

    assert.equal(first.leadId, second.leadId);
    assert.equal(binding?.lead_id, first.leadId);
    assert.equal(rows[0]?.count, '1');
  });
});
