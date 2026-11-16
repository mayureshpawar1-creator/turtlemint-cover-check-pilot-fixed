/** TLS for managed Postgres (e.g. AWS RDS). Set DATABASE_SSL_CA to the provider's CA bundle to verify the server. */
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';

export function pgSsl() {
  if (env.DATABASE_SSL === 'off') return undefined;
  const caPath = process.env.DATABASE_SSL_CA;
  return caPath ? { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: false };
}
