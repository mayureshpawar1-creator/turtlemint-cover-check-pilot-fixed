/** Builds the real dependency graph. Shared by the HTTP server and the command-line scripts. */
import { env } from './config/env.js';
import { pool, withTransaction, type Queryable } from './db/pool.js';
import { createRepos } from './repositories/index.js';
import { linkTokenService } from './services/linkTokenService.js';
import { aisensySender, consoleSender, gupshupSender, otpButtons, type WhatsAppSender } from './integrations/whatsapp.js';
import { localEncryptedStore, s3EncryptedStore, supabaseEncryptedStore } from './integrations/storage.js';
import { demoExtractor, manualExtractor, pdfTextExtractor } from './integrations/extractor.js';
import { exotelSmsSender, type SmsSender } from './integrations/exotelSms.js';
import type { Deps } from './services/deps.js';

function whatsappSender(): WhatsAppSender {
  switch (env.WHATSAPP_PROVIDER) {
    case 'aisensy': return aisensySender({ apiKey: env.AISENSY_API_KEY ?? '' });
    case 'gupshup': return gupshupSender({ apiKey: env.GUPSHUP_API_KEY, appName: env.GUPSHUP_APP_NAME, source: env.GUPSHUP_SOURCE_NUMBER });
    default: return consoleSender();
  }
}

function smsSender(): SmsSender | null {
  if (env.EXOTEL_API_KEY && env.EXOTEL_API_TOKEN && env.EXOTEL_ACCOUNT_SID && env.EXOTEL_SENDER_ID && env.EXOTEL_DLT_ENTITY_ID && env.EXOTEL_DLT_TEMPLATE_ID) {
    return exotelSmsSender({
      apiKey: env.EXOTEL_API_KEY,
      apiToken: env.EXOTEL_API_TOKEN,
      accountSid: env.EXOTEL_ACCOUNT_SID,
      senderId: env.EXOTEL_SENDER_ID,
      dltEntityId: env.EXOTEL_DLT_ENTITY_ID,
      dltTemplateId: env.EXOTEL_DLT_TEMPLATE_ID,
      endpoint: env.EXOTEL_ENDPOINT,
    });
  }
  return null;
}

export function buildDeps(): Deps {
  const whatsapp = whatsappSender();
  const sms = smsSender();
  const store = env.STORAGE_DRIVER === 'supabase'
    ? supabaseEncryptedStore({
        url: env.SUPABASE_URL ?? '',
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        bucket: env.STORAGE_BUCKET,
        encryptionKeyBase64: env.DOCUMENT_ENCRYPTION_KEY ?? '',
      })
    : env.STORAGE_DRIVER === 's3'
      ? s3EncryptedStore({ bucket: env.STORAGE_BUCKET, region: env.AWS_REGION, kmsKeyId: env.KMS_KEY_ID ?? '' })
      : localEncryptedStore(env.STORAGE_DIR, env.LINK_TOKEN_SECRET);
  return {
    repos: createRepos(pool as unknown as Queryable),
    tx: (fn) => withTransaction((client) => fn(createRepos(client))),
    tokens: linkTokenService(env.LINK_TOKEN_SECRET, env.LINK_TOKEN_TTL_DAYS),
    whatsapp,
    store,
    extractor: env.EXTRACTOR === 'manual' ? manualExtractor() : env.EXTRACTOR === 'pdf-text' ? pdfTextExtractor() : demoExtractor(),
    // OTP goes out on WhatsApp (authentication template) — the customer is already in WhatsApp, no SMS gateway needed.
    // Falls back to Exotel SMS if configured, otherwise console logging in development.
    sendOtpSms: async (mobile, code) => {
      // Try WhatsApp first if configured
      if (env.WHATSAPP_PROVIDER === 'aisensy' && env.AISENSY_OTP_CAMPAIGN) {
        await whatsapp.sendTemplate(mobile, env.AISENSY_OTP_CAMPAIGN, [code], { buttons: otpButtons(code) });
        return;
      }
      if (env.WHATSAPP_PROVIDER === 'gupshup' && env.GUPSHUP_OTP_TEMPLATE_ID) {
        await whatsapp.sendTemplate(mobile, env.GUPSHUP_OTP_TEMPLATE_ID, [code]);
        return;
      }

      // Try Exotel SMS if configured
      if (sms) {
        await sms.sendOtp(mobile, code);
        return;
      }

      // Never fail silently in production: a customer waiting for a code that was never sent is the worst outcome.
      if (env.NODE_ENV === 'production') throw new Error('No OTP sender configured (set WhatsApp OTP campaign/template id or Exotel SMS credentials).');
      console.info('[otp:dev]', mobile, code);
    },
    now: () => new Date(),
    config: {
      noticeVersion: env.NOTICE_VERSION,
      docRetentionDays: env.DOC_RETENTION_DAYS,
      maxFiles: env.MAX_FILES,
      maxFileMb: env.MAX_FILE_MB,
      waSummaryTemplateId: env.WHATSAPP_PROVIDER === 'aisensy'
        ? env.AISENSY_SUMMARY_CAMPAIGN ?? 'cover_check_summary_v1'
        : env.WA_SUMMARY_TEMPLATE_ID ?? 'cover_check_summary_v1',
    },
  };
}

export const closeDb = () => pool.end();
