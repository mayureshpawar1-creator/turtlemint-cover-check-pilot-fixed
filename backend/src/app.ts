import express, { type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { apiRouter } from './http/routes.js';
import { errorHandler } from './http/middleware.js';
import type { Deps } from './services/deps.js';

export function createApp(d: Deps, opts: { agentKey: string; corsOrigin: string; webDist?: string; webhookSecret?: string; plainHttp?: boolean }) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // Helmet's default policy tells browsers to upgrade every request to https. That is right in production, but it
  // makes the app load as a blank page when opened over plain http on an office network (e.g. http://10.1.2.3:8080)
  // for an internal test. `plainHttp` is only ever true when PUBLIC_BASE_URL is http:// (production refuses to start that way).
  app.use(helmet(opts.plainHttp ? { contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } } } : undefined));
  app.use(cors({ origin: opts.corsOrigin, allowedHeaders: ['authorization', 'content-type', 'x-agent-key', 'x-agent-id', 'x-agent-name'] }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  // Ready only when the database answers — load balancers use this before sending traffic.
  app.get('/readyz', (_req, res) => { d.repos.events.ping().then(() => res.json({ ok: true }), () => res.status(503).json({ ok: false })); });
  app.use('/api/v1', apiRouter(d, opts.agentKey, { webhookSecret: opts.webhookSecret }));
  app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }));

  // Same-domain web app: one address for the WhatsApp button, no CORS, cookies and tokens stay first-party.
  if (opts.webDist) {
    // Resolve the frontend deterministically. WEB_DIST may be supplied by the host,
    // but the Docker image always contains the built app at /app/frontend/dist.
    // If a stale/incorrect WEB_DIST is present, fall back to the known image path.
    const candidates = [
      resolve(opts.webDist),
      resolve('/app/frontend/dist'),
      resolve(process.cwd(), 'frontend/dist'),
    ];
    const dir = candidates.find((candidate) => existsSync(join(candidate, 'index.html')));
    if (!dir) {
      throw new Error(`Frontend build not found. Checked: ${candidates.join(', ')}`);
    }

    app.use('/assets', express.static(join(dir, 'assets'), { immutable: true, maxAge: '365d', index: false }));
    app.use(express.static(dir, { index: false, maxAge: '5m' }));

    // Explicitly serve the SPA shell at the two common entry URLs.
    // This avoids relying on static-directory index behaviour on the hosting proxy.
    app.get('/', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(dir, 'index.html'));
    });
    app.get('/index.html', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(dir, 'index.html'));
    });

    // Every other non-API path is the single-page app.
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(dir, 'index.html'));
    });
  }
  app.use(errorHandler);
  return app;
}
