/** Composition root: wires real infrastructure into services and starts the HTTP server. */
import { env, productionProblems } from './config/env.js';
import { buildDeps, closeDb } from './wiring.js';
import { createApp } from './app.js';
import { retentionService } from './services/retentionService.js';
import { pool } from './db/pool.js';
import { leastPrivilegeProblems } from './db/privileges.js';

const problems = productionProblems(env);
if (problems.length) {
  console.error('Refusing to start in production:\n - ' + problems.join('\n - '));
  process.exit(1);
}

const deps = buildDeps();
const app = createApp(deps, {
  agentKey: env.AGENT_API_KEY,
  corsOrigin: env.CORS_ORIGIN,
  webDist: env.WEB_DIST ?? '../frontend/dist',
  webhookSecret: env.WEBHOOK_SECRET,
  plainHttp: !env.PUBLIC_BASE_URL.startsWith('https://'),
  sessionHours: env.WEB_SESSION_HOURS,
});

let server: ReturnType<typeof app.listen> | undefined;

const retention = retentionService(deps);

async function start() {
  if (env.NODE_ENV === 'production') {
    const dbProblems = await leastPrivilegeProblems(pool);
    if (dbProblems.length) throw new Error('Refusing to start in production:\n - ' + dbProblems.join('\n - '));
  }
  // A production instance must not accept uploads unless its configured bucket exists and is private.
  await deps.store.assertReady?.();
  server = app.listen(env.PORT, () => {
    console.info(`Cover Check on :${env.PORT} (${env.NODE_ENV}, whatsapp=${env.WHATSAPP_PROVIDER}, storage=${env.STORAGE_DRIVER}, reader=${env.EXTRACTOR}${env.WEB_DIST ? ', serving web app' : ''})`);
  });
  void retention.sweep().catch((error) => console.error('Initial retention sweep failed:', error));
  setInterval(() => void retention.sweep().catch((error) => console.error('Retention sweep failed:', error)), 24 * 3_600_000).unref();
}

const shutdown = () => {
  if (server) server.close(() => { void closeDb().then(() => process.exit(0)); });
  else void closeDb().then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
void start().catch((error) => {
  console.error('Startup validation failed:', error instanceof Error ? error.message : 'Unknown startup error');
  void closeDb().finally(() => process.exit(1));
});
