/**
 * Encrypted object storage for policy files. Never returns public URLs.
 * Production options: private Supabase Storage with application-layer AES-256-GCM, or S3 with SSE-KMS.
 * Development only: AES-256-GCM files on local disk.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ObjectStore {
  put(key: string, data: Buffer): Promise<string>; // returns file_ref
  get(fileRef: string): Promise<Buffer>;
  remove(fileRef: string): Promise<void>;
  /** Optional startup validation for remote stores (e.g. verify a private bucket). */
  assertReady?(): Promise<void>;
}

export const localEncryptedStore = (dir: string, secret: string): ObjectStore => {
  const key = createHash('sha256').update(secret).digest(); // 32 bytes
  const path = (ref: string) => join(dir, ref.replace(/^local:\/\//, '').replace(/[^a-zA-Z0-9_.-]/g, '_'));
  return {
    async put(k, data) {
      await mkdir(dir, { recursive: true });
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([c.update(data), c.final()]);
      const ref = `local://${k}`;
      await writeFile(path(ref), Buffer.concat([iv, c.getAuthTag(), enc]));
      return ref;
    },
    async get(ref) {
      const raw = await readFile(path(ref));
      const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
    },
    async remove(ref) { await rm(path(ref), { force: true }); },
  };
};

/**
 * Production store: a private S3 bucket, every object encrypted with SSE-KMS (customer-managed key).
 * Credentials come from the server's IAM role — never from files or env vars.
 * Keep the bucket in an India region (default ap-south-1, Mumbai) and block all public access.
 */
export const s3EncryptedStore = (cfg: { bucket: string; region: string; kmsKeyId: string }): ObjectStore => {
  // Loaded lazily so local development does not need the AWS SDK.
  const sdkName = '@aws-sdk/client-s3';
  let sdk: Promise<any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const load = async () => {
    sdk ??= import(sdkName).then((m) => ({ m, client: new m.S3Client({ region: cfg.region }) }));
    return sdk;
  };
  const keyOf = (ref: string) => ref.replace(`s3://${cfg.bucket}/`, '');
  return {
    async put(k, data) {
      const { m, client } = await load();
      const Key = `policies/${k}`;
      await client.send(new m.PutObjectCommand({ Bucket: cfg.bucket, Key, Body: data, ServerSideEncryption: 'aws:kms', SSEKMSKeyId: cfg.kmsKeyId }));
      return `s3://${cfg.bucket}/${Key}`;
    },
    async get(ref) {
      const { m, client } = await load();
      const out = await client.send(new m.GetObjectCommand({ Bucket: cfg.bucket, Key: keyOf(ref) }));
      return Buffer.from(await out.Body.transformToByteArray());
    },
    async remove(ref) {
      const { m, client } = await load();
      await client.send(new m.DeleteObjectCommand({ Bucket: cfg.bucket, Key: keyOf(ref) }));
    },
  };
};

/**
 * Production document store for Render + Supabase Storage.
 * Objects are application-encrypted with AES-256-GCM before upload, and the bucket must be private.
 * The service-role key and encryption key are server-only Render secrets; no signed/public URLs are issued.
 */
export const supabaseEncryptedStore = (cfg: {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  encryptionKeyBase64: string;
  fetchImpl?: typeof fetch;
}): ObjectStore & { assertReady(): Promise<void> } => {
  const baseUrl = cfg.url.replace(/\/+$/, '');
  const encryptionKey = Buffer.from(cfg.encryptionKeyBase64, 'base64');
  if (!/^https:\/\//i.test(baseUrl)) throw new Error('Supabase Storage URL must use HTTPS.');
  if (!cfg.serviceRoleKey) throw new Error('Supabase Storage server key is missing.');
  if (!cfg.bucket || !/^[a-zA-Z0-9_-]+$/.test(cfg.bucket)) throw new Error('Supabase Storage bucket name is invalid.');
  if (encryptionKey.length !== 32 || encryptionKey.toString('base64') !== cfg.encryptionKeyBase64) {
    throw new Error('Document encryption key must be base64-encoded 32-byte key material.');
  }
  const fetcher = cfg.fetchImpl ?? fetch;
  const headers = (extra: Record<string, string> = {}) => ({
    apikey: cfg.serviceRoleKey,
    authorization: `Bearer ${cfg.serviceRoleKey}`,
    ...extra,
  });
  const encodePath = (key: string) => key.split('/').map(encodeURIComponent).join('/');
  const objectUrl = (key: string) => `${baseUrl}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${encodePath(key)}`;
  const keyOf = (ref: string) => {
    const prefix = `supabase://${cfg.bucket}/`;
    if (!ref.startsWith(prefix)) throw new Error('Document reference does not belong to the configured Supabase bucket.');
    const key = ref.slice(prefix.length);
    if (!key.startsWith('policies/') || key.split('/').some((part) => !part || !/^[a-zA-Z0-9_.-]+$/.test(part))) {
      throw new Error('Document reference has an invalid object path.');
    }
    return key;
  };
  const encrypt = (key: string, data: Buffer) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    cipher.setAAD(Buffer.from(key, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([Buffer.from('CCS1'), iv, cipher.getAuthTag(), ciphertext]);
  };
  const decrypt = (key: string, envelope: Buffer) => {
    if (envelope.length < 32 || envelope.subarray(0, 4).toString('ascii') !== 'CCS1') {
      throw new Error('Stored document has an unsupported encryption envelope.');
    }
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, envelope.subarray(4, 16));
    decipher.setAAD(Buffer.from(key, 'utf8'));
    decipher.setAuthTag(envelope.subarray(16, 32));
    return Buffer.concat([decipher.update(envelope.subarray(32)), decipher.final()]);
  };
  const checked = async (res: Response, operation: string) => {
    if (!res.ok) throw new Error(`Supabase Storage ${operation} failed (HTTP ${res.status}).`);
  };

  return {
    async assertReady() {
      const res = await fetcher(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(cfg.bucket)}`, {
        method: 'GET', headers: headers(), signal: AbortSignal.timeout(15_000),
      });
      await checked(res, 'private-bucket check');
      const bucket = await res.json() as { public?: unknown };
      if (bucket.public !== false) throw new Error('Supabase Storage bucket must exist and be private (public=false).');
    },
    async put(k, data) {
      const key = `policies/${k}`;
      if (key.split('/').some((part) => !part || !/^[a-zA-Z0-9_.-]+$/.test(part))) throw new Error('Invalid document object key.');
      const res = await fetcher(objectUrl(key), {
        method: 'POST',
        headers: headers({ 'content-type': 'application/octet-stream', 'x-upsert': 'false' }),
        body: encrypt(key, data),
        signal: AbortSignal.timeout(30_000),
      });
      await checked(res, 'upload');
      return `supabase://${cfg.bucket}/${key}`;
    },
    async get(ref) {
      const key = keyOf(ref);
      const res = await fetcher(objectUrl(key), { method: 'GET', headers: headers(), signal: AbortSignal.timeout(30_000) });
      await checked(res, 'download');
      return decrypt(key, Buffer.from(await res.arrayBuffer()));
    },
    async remove(ref) {
      const key = keyOf(ref);
      const res = await fetcher(`${baseUrl}/storage/v1/object/${encodeURIComponent(cfg.bucket)}`, {
        method: 'DELETE', headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ prefixes: [key] }), signal: AbortSignal.timeout(15_000),
      });
      // Deleting a missing object is idempotent and allows retention cleanup to retry safely.
      if (res.status !== 404) await checked(res, 'delete');
    },
  };
};
