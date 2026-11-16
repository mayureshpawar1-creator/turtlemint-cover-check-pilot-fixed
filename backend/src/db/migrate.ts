/** Applies data/migrations/*.sql then data/seeds/*.sql in order, once each. */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { env } from '../config/env.js';
import { pgSsl } from './ssl.js';

const root = resolve(import.meta.dirname, '../../../data');

async function main() {
  // 1.7 (S6): migrations run as the schema-owning login; the app runs as a least-privileged one
  const client = new pg.Client({ connectionString: env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, ssl: pgSsl() });
  await client.connect();
  // Only one instance migrates at a time (several containers may start together).
  await client.query('SELECT pg_advisory_lock(727001)');
  await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_ts timestamptz DEFAULT now())');
  for (const dir of ['migrations', 'seeds']) {
    for (const f of (await readdir(join(root, dir))).filter((x) => x.endsWith('.sql')).sort()) {
      const name = `${dir}/${f}`;
      const done = await client.query('SELECT 1 FROM public.schema_migrations WHERE name = $1', [name]);
      if (done.rowCount) continue;
      console.info('applying', name);
      await client.query(await readFile(join(root, dir, f), 'utf8'));
      await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [name]);
    }
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
