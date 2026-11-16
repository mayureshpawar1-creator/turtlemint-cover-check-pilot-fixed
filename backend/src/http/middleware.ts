import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { AppError } from '../services/errors.js';
import type { Deps, LeadCtx } from '../services/deps.js';

declare module 'express-serve-static-core' {
  interface Request { lead?: LeadCtx; agentId?: string }
}

/** 1.7 (S3): browser session cookie. HttpOnly so page scripts can't read it; Path=/api so it only goes to the API. */
export const SESSION_COOKIE = 'cc_sid';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.header('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** Exchange a just-verified link for a browser session: a random id in the cookie, only its hash in the database. */
export async function startWebSession(d: Deps, res: Response, s: { leadId: string; sourceId: string }, o: { hours: number; secure: boolean }) {
  const sid = randomBytes(32).toString('base64url');
  const expires = new Date(d.now().getTime() + o.hours * 3_600_000);
  await d.repos.webSessions.create({ sidHash: sha256(sid), leadId: s.leadId, sourceId: s.sourceId, expiresTs: expires });
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, secure: o.secure, sameSite: 'lax', path: '/api', expires });
}

/**
 * Customer routes. The session cookie set when the WhatsApp link was opened; otherwise `Authorization: Bearer <link token>`
 * (kept for browsers that block cookies). No login, no password — the signed link is the key.
 */
export const requireLead = (d: Deps) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const sid = readCookie(req, SESSION_COOKIE);
    if (sid) {
      const s = await d.repos.webSessions.find(sha256(sid), d.now());
      if (s) {
        req.lead = { leadId: s.lead_id, sourceId: s.source_id, ip: req.ip, userAgent: req.header('user-agent') ?? undefined };
        return next();
      }
    }
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new AppError('BAD_TOKEN', 'This link is not valid.');
    d.tokens.verify(token, d.now().getTime());
    const hit = await d.repos.sources.leadForToken(d.tokens.hash(token));
    if (!hit) throw new AppError('BAD_TOKEN', 'Open the link from WhatsApp again.');
    req.lead = { leadId: hit.lead_id, sourceId: hit.source_id, ip: req.ip, userAgent: req.header('user-agent') ?? undefined };
    next();
  } catch (e) { next(e); }
};

/** Constant-time string comparison (hashes first so length differences do not leak either). */
export const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/** Telecaller routes. Replace with the existing agent SSO in production. */
export const requireAgent = (apiKey: string) => (req: Request, _res: Response, next: NextFunction) => {
  if (!safeEqual(req.header('x-agent-key') ?? '', apiKey)) return next(new AppError('FORBIDDEN', 'Agent access only'));
  req.agentId = req.header('x-agent-id') ?? 'agent-unknown';
  next();
};

export const parse = <S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> => {
  const r = schema.safeParse(value);
  if (!r.success) throw new AppError('VALIDATION', 'Some answers are not valid', r.error.flatten().fieldErrors);
  return r.data;
};

/** Wrap async handlers so thrown errors reach the error handler. */
export const h = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).then((body) => { if (!res.headersSent) res.json(body ?? { ok: true }); }, next);

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  if (err instanceof ZodError) return res.status(422).json({ error: { code: 'VALIDATION', message: 'Invalid input', details: err.flatten() } });
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Your answers are saved.' } });
};
