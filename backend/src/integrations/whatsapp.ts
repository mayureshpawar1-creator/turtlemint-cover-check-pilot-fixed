/**
 * WhatsApp senders. Only approved templates are used.
 *  - aisensy: Turtlemint's BSP. Each template is sent through an AiSensy "API campaign" (status Live);
 *             the campaign name plays the role of the template id.
 *  - gupshup: kept as an alternative BSP.
 *  - console: prints instead of sending (local development only — production refuses to start with it).
 */
import { randomUUID } from 'node:crypto';

export interface SendOptions {
  /** Shown as the contact name in the BSP inbox. */
  userName?: string;
  /** Meta-style button parameters, e.g. the OTP for a "Copy code" button. */
  buttons?: unknown[];
}

export interface WhatsAppSender {
  sendTemplate(to: string, templateId: string, params: string[], opts?: SendOptions): Promise<{ messageId: string }>;
}

export const consoleSender = (): WhatsAppSender => ({
  async sendTemplate(to, templateId, params) {
    const messageId = `dev-${randomUUID()}`;
    console.info('[whatsapp:dev]', { to, templateId, params, messageId });
    return { messageId };
  },
});

/**
 * AiSensy API campaign: POST https://backend.aisensy.com/campaign/t1/api/v2
 * Body: apiKey, campaignName, destination (+91…), userName, templateParams[], optional buttons[].
 * CHECK BEFORE GO-LIVE: compare with the cURL AiSensy shows on the campaign page (button format especially).
 */
export const aisensySender = (cfg: { apiKey: string; endpoint?: string; fetchImpl?: typeof fetch }): WhatsAppSender => ({
  async sendTemplate(to, campaignName, params, opts = {}) {
    const body: Record<string, unknown> = {
      apiKey: cfg.apiKey,
      campaignName,
      destination: to.startsWith('+') ? to : `+${to}`,
      userName: opts.userName?.trim() || 'Cover Check customer',
      templateParams: params,
    };
    if (opts.buttons?.length) body.buttons = opts.buttons;
    const res = await (cfg.fetchImpl ?? fetch)(cfg.endpoint ?? 'https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`AiSensy ${res.status}: ${text.slice(0, 200)}`);
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* plain-text success */ }
    const id = (json.submitted_message_id ?? json.messageId ?? json.id) as string | undefined;
    return { messageId: id ? String(id) : `aisensy-${randomUUID()}` };
  },
});

/**
 * Gupshup template message: POST https://api.gupshup.io/wa/api/v1/template/msg (form-encoded).
 * `id` is the approved template's id from the Gupshup dashboard (not its name).
 * CHECK BEFORE GO-LIVE: send one real OTP and one real summary to your own phone. The OTP template's
 * "Copy code" button is not set here — if Gupshup needs the button parameter for it, add it to `template`/`message`
 * exactly as Gupshup's template docs show for authentication templates.
 */
export const gupshupSender = (cfg: { apiKey?: string; appName: string; source?: string; fetchImpl?: typeof fetch }): WhatsAppSender => ({
  async sendTemplate(to, templateId, params) {
    if (!cfg.apiKey || !cfg.source) return consoleSender().sendTemplate(to, templateId, params);
    const body = new URLSearchParams({
      channel: 'whatsapp', source: cfg.source, destination: to.replace('+', ''), 'src.name': cfg.appName,
      template: JSON.stringify({ id: templateId, params }),
    });
    const res = await (cfg.fetchImpl ?? fetch)('https://api.gupshup.io/wa/api/v1/template/msg', {
      method: 'POST', headers: { apikey: cfg.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Gupshup ${res.status}: ${text.slice(0, 200)}`);
    let json: { status?: string; messageId?: string; message?: string } = {};
    try { json = JSON.parse(text) as typeof json; } catch { /* plain-text success */ }
    // Gupshup can answer 200 with {"status":"error"} — treat that as a failed send, never as delivered.
    if (json.status === 'error') throw new Error(`Gupshup error: ${String(json.message ?? text).slice(0, 200)}`);
    return { messageId: json.messageId ?? `gupshup-${randomUUID()}` };
  },
});

/** Button parameters for a WhatsApp authentication template's "Copy code" button (Meta format). */
export const otpButtons = (code: string) => [{ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: code }] }];
