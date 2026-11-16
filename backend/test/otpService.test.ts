import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { otpService } from '../src/services/otpService.js';
import { AppError } from '../src/services/errors.js';
import type { Deps, LeadCtx } from '../src/services/deps.js';
import type { Repos } from '../src/repositories/index.js';

const otpId = 'otp-test-1';
const leadId = 'lead-test-1';
const currentMobile = '+919876543210';
const originalMobile = '+919812345678';
const validCode = '123456';
const codeHash = createHash('sha256').update(`${validCode}:${otpId}`).digest('hex');
const ctx: LeadCtx = { leadId, sourceId: null };

function fixture(options: { leadMobile?: string; challengeMobile?: string } = {}) {
  const now = new Date('2026-10-27T10:00:00Z');
  const state = {
    leadMobile: options.leadMobile ?? currentMobile,
    challengeMobile: options.challengeMobile ?? currentMobile,
    attempts: 0,
    verified: false,
    leadVerified: false,
    verificationEvents: 0,
  };
  const repos = {
    otps: {
      async lastSent() {
        return {
          otp_id: otpId,
          mobile: state.challengeMobile,
          sent_ts: now,
          attempts: state.attempts,
          expires_ts: new Date(now.getTime() + 5 * 60_000),
          code_hash: codeHash,
          verified_ts: state.verified ? now : null,
        };
      },
      async claimAttempt(id: string, idForLead: string, mobile: string, maxAttempts: number) {
        if (id !== otpId || idForLead !== leadId || mobile !== state.leadMobile || mobile !== state.challengeMobile ||
          state.verified || state.attempts >= maxAttempts) return null;
        state.attempts += 1;
        return state.attempts;
      },
      async markVerified(id: string, idForLead: string, mobile: string) {
        if (id !== otpId || idForLead !== leadId || mobile !== state.challengeMobile || mobile !== state.leadMobile || state.verified) return false;
        state.verified = true;
        return true;
      },
    },
    leads: {
      async markVerified(id: string, mobile: string) {
        if (id !== leadId || mobile !== state.leadMobile) return false;
        state.leadVerified = true;
        return true;
      },
    },
    events: {
      async log(event: { name: string }) {
        if (event.name === 'otp_verified') state.verificationEvents += 1;
      },
    },
  };
  const deps = {
    repos,
    tx: async <T>(fn: (r: Repos) => Promise<T>) => fn(repos as unknown as Repos),
    now: () => now,
  } as unknown as Deps;
  return { service: otpService(deps), state };
}

describe('OTP verification', () => {
  it('does not verify a changed mobile using a code sent to the previous number', async () => {
    const { service, state } = fixture({ leadMobile: currentMobile, challengeMobile: originalMobile });
    await assert.rejects(service.verify(ctx, validCode), (error: unknown) => error instanceof AppError && error.code === 'OTP_INVALID');
    assert.equal(state.attempts, 0);
    assert.equal(state.leadVerified, false);
    assert.equal(state.verificationEvents, 0);
  });

  it('caps concurrently claimed verification attempts at the configured maximum', async () => {
    const { service, state } = fixture();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => service.verify(ctx, '000000')));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    assert.equal(state.attempts, 3);
    assert.equal(failures.filter(({ reason }) => reason instanceof AppError && reason.code === 'OTP_INVALID').length, 3);
    assert.equal(failures.filter(({ reason }) => reason instanceof AppError && reason.code === 'OTP_LOCKED').length, 5);
    assert.equal(state.leadVerified, false);
  });

  it('marks the challenge and lead verified only when the current number matches', async () => {
    const { service, state } = fixture();
    assert.deepEqual(await service.verify(ctx, validCode), { verified: true });
    assert.equal(state.verified, true);
    assert.equal(state.leadVerified, true);
    assert.equal(state.verificationEvents, 1);
  });
});
