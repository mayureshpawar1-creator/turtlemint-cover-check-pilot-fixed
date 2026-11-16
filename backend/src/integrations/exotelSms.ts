
export interface SmsSender {
  sendOtp(to: string, code: string): Promise<{ messageId: string }>;
}

export interface ExotelSmsConfig {
  apiKey: string;
  apiToken: string;
  accountSid: string;
  senderId: string;
  dltEntityId: string;
  dltTemplateId: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export const exotelSmsSender = (cfg: ExotelSmsConfig): SmsSender => ({
  async sendOtp(to, code) {
    if (!/^\+91[6-9]\d{9}$/.test(to)) {
      throw new Error('Destination must be an Indian mobile number in +91 format.');
    }

    if (!/^\d{6}$/.test(code)) {
      throw new Error('OTP must contain exactly six digits.');
    }

    const endpoint =
      cfg.endpoint ??
      `https://api.in.exotel.com/v1/Accounts/${encodeURIComponent(cfg.accountSid)}/Sms/send`;

    const message =
      `Your Turtlemint Cover Check verification code is ${code}. ` +
      'It expires in 5 minutes. Do not share this code.';

    const body = new URLSearchParams({
      From: cfg.senderId,
      To: to.slice(1),
      Body: message,
      SmsType: 'transactional',
      DltEntityId: cfg.dltEntityId,
      DltTemplateId: cfg.dltTemplateId,
    });

    const credentials = Buffer.from(
      `${cfg.apiKey}:${cfg.apiToken}`,
      'utf8',
    ).toString('base64');

    const response = await (cfg.fetchImpl ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, application/xml, text/xml',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Exotel SMS request failed with HTTP ${response.status}.`);
    }

    let messageId: string | undefined;
    let smsStatus: string | undefined;

    try {
      const data: unknown = JSON.parse(responseText);

      if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const sms = record.SMSMessage ?? record.sms;

        if (sms && typeof sms === 'object') {
          const item = sms as Record<string, unknown>;

          if (typeof item.SmsSid === 'string') messageId = item.SmsSid;
          else if (typeof item.Sid === 'string') messageId = item.Sid;
          else if (typeof item.sid === 'string') messageId = item.sid;

          if (typeof item.Status === 'string') smsStatus = item.Status;
          else if (typeof item.status === 'string') smsStatus = item.status;
        }
      }
    } catch {
      const idMatch = responseText.match(
        /<(?:\w+:)?SmsSid\b[^>]*>([^<]+)<\/(?:\w+:)?SmsSid\s*>/i,
      ) ?? responseText.match(
        /<(?:\w+:)?Sid\b[^>]*>([^<]+)<\/(?:\w+:)?Sid\s*>/i,
      );

      const statusMatch = responseText.match(
        /<(?:\w+:)?Status\b[^>]*>([^<]+)<\/(?:\w+:)?Status\s*>/i,
      );

      if (idMatch?.[1]) messageId = idMatch[1].trim();
if (statusMatch?.[1]) smsStatus = statusMatch[1].trim();
    }

    if (!messageId) {
      throw new Error('Exotel returned no recognisable SMS ID.');
    }

    if (!smsStatus) {
      throw new Error('Exotel returned no recognisable SMS status.');
    }

    const acceptedStatuses = new Set([
      'queued',
      'sending',
      'submitted',
      'sent',
    ]);

    if (!acceptedStatuses.has(smsStatus.toLowerCase())) {
      throw new Error(`Exotel SMS was not accepted: status ${smsStatus}.`);
    }

    return { messageId };
  },
});
