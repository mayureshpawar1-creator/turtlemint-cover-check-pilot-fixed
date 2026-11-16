import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { supabaseEncryptedStore } from '../src/integrations/storage.js';

const key = () => randomBytes(32).toString('base64');
const cfg = (fetchImpl: typeof fetch, encryptionKeyBase64 = key()) => ({
  url: 'https://example-project.supabase.co',
  serviceRoleKey: 'server-only-test-key',
  bucket: 'cover-check-docs',
  encryptionKeyBase64,
  fetchImpl,
});

describe('Supabase encrypted object store', () => {
  it('encrypts before upload, decrypts after download, uses a private bucket and deletes by object key', async () => {
    let stored: Buffer | undefined;
    const calls: { url: string; method: string; headers: HeadersInit | undefined; body: BodyInit | null | undefined }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, headers: init?.headers, body: init?.body });
      if (url.endsWith('/storage/v1/bucket/cover-check-docs')) return new Response(JSON.stringify({ public: false }), { status: 200 });
      if (method === 'POST' && url.includes('/storage/v1/object/cover-check-docs/policies/')) {
        stored = Buffer.from(init?.body as Uint8Array);
        return new Response('{}', { status: 200 });
      }
      if (method === 'GET' && url.includes('/storage/v1/object/cover-check-docs/policies/')) {
        return new Response(stored ? new Uint8Array(stored) : null, { status: 200 });
      }
      if (method === 'DELETE' && url.endsWith('/storage/v1/object/cover-check-docs')) return new Response('{}', { status: 200 });
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const store = supabaseEncryptedStore(cfg(fetchImpl));
    await store.assertReady();
    const plaintext = Buffer.from('synthetic policy document — private test fixture');
    const ref = await store.put('lead-123/document-456', plaintext);
    assert.equal(ref, 'supabase://cover-check-docs/policies/lead-123/document-456');
    assert.ok(stored);
    assert.notDeepEqual(stored, plaintext, 'object body must be encrypted before leaving the app');
    assert.deepEqual(await store.get(ref), plaintext);
    await store.remove(ref);

    assert.ok(calls.every((call) => call.url.startsWith('https://example-project.supabase.co/')));
    assert.ok(calls.every((call) => (call.headers as Record<string, string>).authorization === 'Bearer server-only-test-key'));
    assert.ok(calls.some((call) => call.method === 'DELETE' && JSON.parse(String(call.body)).prefixes[0] === 'policies/lead-123/document-456'));
  });

  it('refuses a public bucket at startup', async () => {
    const store = supabaseEncryptedStore(cfg((async () => new Response(JSON.stringify({ public: true }), { status: 200 })) as typeof fetch));
    await assert.rejects(store.assertReady(), /must exist and be private/);
  });

  it('rejects references outside the configured bucket and rejects an invalid encryption key', async () => {
    const store = supabaseEncryptedStore(cfg((async () => new Response('{}', { status: 200 })) as typeof fetch));
    await assert.rejects(store.get('supabase://other-bucket/policies/lead/document'), /does not belong/);
    assert.throws(() => supabaseEncryptedStore(cfg((async () => new Response('{}')) as typeof fetch, Buffer.alloc(16).toString('base64'))), /32-byte key/);
  });
});
