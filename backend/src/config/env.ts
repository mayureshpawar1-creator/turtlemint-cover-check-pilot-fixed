import { z } from 'zod';

// Load backend/.env when present (Node 20.12+). Real environment variables still win.
try { process.loadEnvFile?.('.env'); } catch { /* no .env file — use defaults / real env */ }

const DEV_SECRET = 'dev-only-secret-change-me-dev-only-secret';
const DEV_AGENT_KEY = 'dev-agent-key';
/** 1.7 (S2): the local dev document store has its own key, never the link-signing secret. */
export const DEV_LOCAL_STORAGE_SECRET = 'dev-only-local-document-store-key-not-for-production';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  /** Public address of the app, e.g. https://covercheck.turtlemint.com — used in links and CORS. */
  PUBLIC_BASE_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://postgres@localhost:5432/cover_check_dev'),
  DATABASE_SSL: z.enum(['off', 'require']).default('off'),
  /** Path to the database provider's CA bundle. Required in production so the server certificate is verified (S8). */
  DATABASE_SSL_CA: z.string().optional(),
  /** Login used only by `db:migrate` (owns the schema). The app itself runs as a least-privileged login (S6). */
  MIGRATION_DATABASE_URL: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().default(10),
  /** HMAC key used to sign WhatsApp link tokens (rotate via KMS / secrets manager). */
  LINK_TOKEN_SECRET: z.string().min(32).default(DEV_SECRET),
  /** 1.7 (S3): was 14. The link is only needed to start; the browser then holds a session cookie. */
  LINK_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  /** How long a browser session cookie lasts after the link is opened. */
  WEB_SESSION_HOURS: z.coerce.number().int().min(1).max(24 * 14).default(72),
  AGENT_API_KEY: z.string().default(DEV_AGENT_KEY),
  NOTICE_VERSION: z.string().default('v1'),
  /** Must be explicitly approved by Turtlemint Advisory/Product/Compliance before personalized quiz rules go live. */
  ADVISORY_RULES_APPROVED: z.enum(['true', 'false']).default('false'),
  /** Must be true only after IT/Infosec approves storage, vendor processing, access, retention and incident response. */
  DATA_PROCESSING_APPROVED: z.enum(['true', 'false']).default('false'),
  /** VALIDATION REQUIRED — document retention period. */
  DOC_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  MAX_FILES: z.coerce.number().default(3),
  MAX_FILE_MB: z.coerce.number().default(15),

  // ---- WhatsApp (summary message + OTP). "console" prints instead of sending (local only).
  WHATSAPP_PROVIDER: z.enum(['console', 'aisensy', 'gupshup']).default('console'),
  AISENSY_API_KEY: z.string().optional(),
  /** AiSensy API campaign (Live) that sends the approved summary template. */
  AISENSY_SUMMARY_CAMPAIGN: z.string().optional(),
  /** AiSensy API campaign (Live) that sends the approved authentication (OTP) template. */
  AISENSY_OTP_CAMPAIGN: z.string().optional(),
  GUPSHUP_API_KEY: z.string().optional(),
  GUPSHUP_APP_NAME: z.string().default('turtlemint'),
  GUPSHUP_SOURCE_NUMBER: z.string().optional(),
  WA_SUMMARY_TEMPLATE_ID: z.string().optional(),
  /** Gupshup: id of the approved authentication (OTP) template. Without it no customer can verify. */
  GUPSHUP_OTP_TEMPLATE_ID: z.string().optional(),
  /** Shared secret the BSP's inbound-message webhook must present (header x-webhook-secret or ?secret=). */
  WEBHOOK_SECRET: z.string().optional(),

  // ---- Policy files
  STORAGE_DRIVER: z.enum(['local', 's3', 'supabase']).default('local'),
  /** Local disk is for development only; production requires Supabase Storage. */
  STORAGE_DIR: z.string().default('.data/docs'),
  STORAGE_BUCKET: z.string().default('cover-check-docs'),
  AWS_REGION: z.string().default('ap-south-1'),
  KMS_KEY_ID: z.string().optional(),
  /** Server-only Supabase Storage credentials. Never expose these through VITE_* variables. */
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Base64-encoded 32-byte key for application-layer AES-256-GCM document encryption. */
  DOCUMENT_ENCRYPTION_KEY: z.string().optional(),
  /** demo = fixed example facts (prototype only); manual = blank facts; pdf-text = text-native PDF reader (no OCR yet). */
  EXTRACTOR: z.enum(['demo', 'manual', 'pdf-text']).default('demo'),

  // ---- Exotel SMS fallback
  EXOTEL_API_KEY: z.string().optional(),
  EXOTEL_API_TOKEN: z.string().optional(),
  EXOTEL_ACCOUNT_SID: z.string().optional(),
  EXOTEL_SENDER_ID: z.string().optional(),
  EXOTEL_DLT_ENTITY_ID: z.string().optional(),
  EXOTEL_DLT_TEMPLATE_ID: z.string().optional(),
  EXOTEL_ENDPOINT: z.string().optional(),

  // ---- Web
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Folder with the built frontend (frontend/dist). When set, the API also serves the web app on the same domain. */
  WEB_DIST: z.string().optional(),
});

export const env = Env.parse(process.env);
export type EnvT = z.infer<typeof Env>;

/** Refuses to start in production with anything that is only safe on a laptop. */
export function productionProblems(e: EnvT): string[] {
  if (e.NODE_ENV !== 'production') return [];
  const p: string[] = [];
  if (e.LINK_TOKEN_SECRET === DEV_SECRET) p.push('LINK_TOKEN_SECRET is the development default — set a random 32+ character secret.');
  if (e.DATABASE_SSL !== 'require') p.push('DATABASE_SSL=require is required for the production database connection.');
  if (e.DATABASE_SSL === 'require' && !e.DATABASE_SSL_CA) p.push('DATABASE_SSL_CA must point to the database provider’s CA bundle, so the server certificate is verified.');
  if (e.MIGRATION_DATABASE_URL && e.MIGRATION_DATABASE_URL === e.DATABASE_URL) p.push('DATABASE_URL must be the least-privileged app login, not the migration login (see deploy/db-roles.sql).');
  if (e.LINK_TOKEN_TTL_DAYS > 14) p.push('LINK_TOKEN_TTL_DAYS must be 14 or less.');
  if (e.AGENT_API_KEY === DEV_AGENT_KEY) p.push('AGENT_API_KEY is the development default — set a random key.');
  if (e.WHATSAPP_PROVIDER === 'console') p.push('WHATSAPP_PROVIDER=console would print messages instead of sending them — use aisensy.');
  if (e.WHATSAPP_PROVIDER === 'aisensy' && !e.AISENSY_API_KEY) p.push('AISENSY_API_KEY is missing.');
  if (e.WHATSAPP_PROVIDER === 'aisensy' && !e.AISENSY_SUMMARY_CAMPAIGN) p.push('AISENSY_SUMMARY_CAMPAIGN must name the approved, live summary campaign.');
  const exotelOtpConfigured = Boolean(e.EXOTEL_API_KEY && e.EXOTEL_API_TOKEN && e.EXOTEL_ACCOUNT_SID && e.EXOTEL_SENDER_ID && e.EXOTEL_DLT_ENTITY_ID && e.EXOTEL_DLT_TEMPLATE_ID);
  if (e.WHATSAPP_PROVIDER === 'aisensy' && !e.AISENSY_OTP_CAMPAIGN && !exotelOtpConfigured) p.push('AISENSY_OTP_CAMPAIGN or complete Exotel SMS credentials are required so customers can receive an OTP.');
  if (e.WHATSAPP_PROVIDER === 'gupshup' && (!e.GUPSHUP_API_KEY || !e.GUPSHUP_SOURCE_NUMBER)) p.push('GUPSHUP_API_KEY / GUPSHUP_SOURCE_NUMBER missing.');
  if (e.WHATSAPP_PROVIDER === 'gupshup' && !e.WA_SUMMARY_TEMPLATE_ID) p.push('WA_SUMMARY_TEMPLATE_ID must be the approved Gupshup summary template ID.');
  if (e.WHATSAPP_PROVIDER === 'gupshup' && !e.GUPSHUP_OTP_TEMPLATE_ID && !exotelOtpConfigured) p.push('GUPSHUP_OTP_TEMPLATE_ID or complete Exotel SMS credentials are required so customers can receive an OTP.');
  if (!e.WEBHOOK_SECRET || e.WEBHOOK_SECRET.length < 16) p.push('WEBHOOK_SECRET is missing or shorter than 16 characters — anyone could post fake STOP replies and withdraw other people’s consent.');
  if (e.ADVISORY_RULES_APPROVED !== 'true') p.push('ADVISORY_RULES_APPROVED is not true — personalized cover rules and customer-facing advice require documented Turtlemint Advisory/Product/Compliance approval before live use.');
  if (e.DATA_PROCESSING_APPROVED !== 'true') p.push('DATA_PROCESSING_APPROVED is not true — Turtlemint IT/Infosec must approve Supabase processing, access controls, retention and incident response before live customer documents are accepted.');
  if (e.EXTRACTOR === 'demo') p.push('EXTRACTOR=demo shows example facts for every upload — use manual (or a validated real extractor).');
  if (e.EXTRACTOR === 'pdf-text') p.push('EXTRACTOR=pdf-text supports text-native PDFs only; OCR and representative accuracy/security validation are not complete. Do not use for real customer policies yet.');
  if (e.STORAGE_DRIVER !== 'supabase') p.push('Production requires STORAGE_DRIVER=supabase; local disk and the S3 adapter are not enabled for this Render deployment.');
  if (e.STORAGE_DRIVER === 's3' && !e.KMS_KEY_ID) p.push('KMS_KEY_ID is missing — policy files must be encrypted with a customer-managed key.');
  if (e.STORAGE_DRIVER === 'supabase') {
    if (!e.SUPABASE_URL || !e.SUPABASE_URL.startsWith('https://')) p.push('SUPABASE_URL is missing or must use https://.');
    if (!e.SUPABASE_SERVICE_ROLE_KEY) p.push('SUPABASE_SERVICE_ROLE_KEY is missing; set it as a Render secret and never expose it to the frontend.');
    const key = e.DOCUMENT_ENCRYPTION_KEY ?? '';
    let keyBytes: Buffer | null = null;
    try { keyBytes = Buffer.from(key, 'base64'); } catch { keyBytes = null; }
    if (!key || !keyBytes || keyBytes.length !== 32 || keyBytes.toString('base64') !== key) p.push('DOCUMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key generated outside the repository.');
    if (!e.STORAGE_BUCKET.trim()) p.push('STORAGE_BUCKET must name an existing private Supabase Storage bucket.');
  }
  if (!e.PUBLIC_BASE_URL.startsWith('https://')) p.push('PUBLIC_BASE_URL must be https://');
  return p;
}
