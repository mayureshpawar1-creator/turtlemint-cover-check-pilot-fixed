/**
 * TLS for managed Postgres. With DATABASE_SSL_CA the server certificate is verified; without it the connection is
 * encrypted but unverified, which production refuses to start with (config/env.ts, issue S8).
 */
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';

export function pgSsl() {
  if (env.DATABASE_SSL === 'off') return undefined;
  const caPath = env.DATABASE_SSL_CA;
  return caPath ? { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: false };
}
