
import test from 'node:test';
import assert from 'node:assert/strict';
import { exotelSmsSender } from '../src/integrations/exotelSms.js';

test('Exotel OTP sender builds a request and reads the SMS ID', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const sender = exotelSmsSender({
    apiKey: 'test-api-key',
    apiToken: 'test-api-token',
    accountSid: 'test-account',
    senderId: 'TESTID',
    dltEntityId: '1234567890123456789',
    dltTemplateId: '9876543210987654321',
    fetchImpl: (async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;

      return new Response(
        JSON.stringify({
          SMSMessage: {
            Sid: 'test-sms-123',
            Status: 'queued',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch,
  });

  const result = await sender.sendOtp('+919876543210', '123456');

  assert.equal(result.messageId, 'test-sms-123');
  assert.match(capturedUrl, /\/Accounts\/test-account\/Sms\/send$/);
  assert.equal(capturedInit?.method, 'POST');
  assert.match(
    new Headers(capturedInit?.headers).get('Authorization') ?? '',
    /^Basic /,
  );

  const body = new URLSearchParams(capturedInit?.body as string);
  assert.equal(body.get('To'), '919876543210');
  assert.equal(body.get('From'), 'TESTID');
  assert.match(body.get('Body') ?? '', /123456/);
  assert.equal(body.get('DltEntityId'), '1234567890123456789');
  assert.equal(body.get('DltTemplateId'), '9876543210987654321');
});

test('Exotel OTP sender rejects invalid mobile numbers', async () => {
  const sender = exotelSmsSender({
    apiKey: 'test',
    apiToken: 'test',
    accountSid: 'test',
    senderId: 'TESTID',
    dltEntityId: 'entity',
    dltTemplateId: 'template',
    fetchImpl: (async () => {
      throw new Error('Fetch must not run for invalid input');
    }) as typeof fetch,
  });

  await assert.rejects(
    sender.sendOtp('9876543210', '123456'),
    /Indian mobile number/,
  );
});

test('Exotel OTP sender rejects invalid OTP codes', async () => {
  const sender = exotelSmsSender({
    apiKey: 'test',
    apiToken: 'test',
    accountSid: 'test',
    senderId: 'TESTID',
    dltEntityId: 'entity',
    dltTemplateId: 'template',
    fetchImpl: (async () => {
      throw new Error('Fetch must not run for invalid input');
    }) as typeof fetch,
  });

  await assert.rejects(
    sender.sendOtp('+919876543210', '12AB56'),
    /exactly six digits/,
  );
});


test('Exotel OTP sender rejects an SMS marked failed', async () => {
  const sender = exotelSmsSender({
    apiKey: 'test-api-key',
    apiToken: 'test-api-token',
    accountSid: 'test-account',
    senderId: 'TESTID',
    dltEntityId: '1234567890123456789',
    dltTemplateId: '9876543210987654321',
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          SMSMessage: {
            SmsSid: 'test-sms-failed',
            To: '919876543210',
            Status: 'failed',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )) as typeof fetch,
  });

  await assert.rejects(
    sender.sendOtp('+919876543210', '123456'),
    /failed/i,
  );
});

