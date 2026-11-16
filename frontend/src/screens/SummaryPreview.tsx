/** S9b — See the exact WhatsApp message first, then send it. The optional contact tick is unticked. */
import { Fragment, useEffect, useState } from 'react';
import { ConsentBox, Note, ScreenShell } from '../ui/components';
import { Emblem } from '../illustrations';
import { IconChat } from '../ui/icons';
import { errorOf, useFlow } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

/** Renders WhatsApp *bold* markup safely (no HTML injection). */
const WaText = ({ text }: { text: string }) => (
  <>{text.split(/(\*[^*\n]+\*)/g).map((part, i) => (/^\*[^*]+\*$/.test(part) ? <b key={i}>{part.slice(1, -1)}</b> : <Fragment key={i}>{part}</Fragment>))}</>
);

export function SummaryPreview() {
  const { s, api, go, patch, engagement } = useFlow();
  const [preview, setPreview] = useState<{ text: string; previewedAt: string } | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Track summary preview screen engagement
  useEffect(() => {
    engagement.trackEvent('screen_engaged', 'S9b', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });
  }, [engagement.trackEvent]);

  useEffect(() => {
    if (!s.captured) {
      patch({ returnTo: 'S9b' });
      engagement.trackEvent('next_action_selected', 'S9b', {
        action: 'need_capture_info'
      });
      go('S8', { replace: true });
      return;
    }

    let active = true;
    api.summaryPreview()
      .then((data) => { if (active) setPreview(data); })
      .catch((e: unknown) => { if (active) setErr(errorOf(e).message); });
    return () => { active = false; };
  }, [api, s.captured, patch, go, engagement.trackEvent]);

  useEffect(() => {
    if (!preview) return;
    engagement.trackEvent('summary_viewed', 'S9b', {
      hasPreview: true,
      previewLength: preview.text.length
    });
  }, [preview, engagement.trackEvent]);

  const send = async () => {
    setBusy(true); setErr(null);

    // Track send summary initiated
    engagement.trackEvent('next_action_selected', 'S9b', {
      action: 'send_summary'
    });
    engagement.trackEvent('tool_used', 'S9b', {
      toolType: 'messaging',
      toolId: 'whatsapp-send',
      action: 'initiated'
    });

    try {
      const res = await api.sendSummary({ contactConsent: ok, language: s.language, previewedAt: preview?.previewedAt });
      patch({ summarySentAt: res.sentAt, result: s.result?.action === 'advisor' ? s.result : { action: 'summary', queued: res.queued, at: res.sentAt } });

      // Track summary sent successfully
      engagement.trackEvent('summary_sent', 'S9b', {
        sentAt: res.sentAt,
        contactConsent: ok,
        language: s.language
      });

      go('S10');
    } catch (e: unknown) {
      setErr(errorOf(e).message);

      // Track summary send failed
      engagement.trackEvent('tool_used', 'S9b', {
        toolType: 'messaging',
        toolId: 'whatsapp-send',
        action: 'failed',
        error: errorOf(e).message || 'unknown'
      });
    } finally { setBusy(false); }
  };
  const time = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  return (
    <ScreenShell label="S9b Summary preview" title="Your summary" footer={
      <>
        <button className="btn btn--primary" disabled={!preview || busy} onClick={() => {
          engagement.trackEvent('next_action_selected', 'S9b', {
            action: 'send_summary_clicked'
          });
          return send();
        }}><IconChat size={18} />{busy ? 'Sending…' : 'Send to my WhatsApp'}</button>
        <button className="btn btn--ghost" style={{ alignSelf: 'center' }} onClick={() => {
          engagement.trackEvent('next_action_selected', 'S9b', {
            action: 'see_plans_first'
          });
          return go('S9a');
        }}>See plans that fit first</button>
      </>
    }>
      <div className="stack-sm">
        <h1 className="title">This is what you’ll get</h1>
        <p className="muted small">Sent to <b className="num">{s.maskedMobile}</b> from Turtlemint’s WhatsApp number. Nothing else is sent.</p>
      </div>
      <div className="wa" aria-label="WhatsApp message preview">
        <div className="wa__head"><Emblem size={30} /><div>Turtlemint<small>Business account</small></div></div>
        <div className="wa__body">
          {preview ? (
            <>
              <div className="wa__bubble"><WaText text={preview.text} /><span className="wa__time">{time}</span></div>
              <div className="wa__btn">Talk to an advisor</div>
            </>
          ) : <div className="wa__bubble">Preparing your summary…</div>}
        </div>
      </div>
      <ConsentBox
        checked={ok}
        onChange={(value) => {
          setOk(value);

          // Track consent toggled
          engagement.trackEvent('content_toggle', 'S9b', {
            elementId: 'contact-consent-checkbox',
            isExpanded: value,
            sectionName: 'Contact consent for follow-up',
            oldValue: !value,
            newValue: value
          });

          // Track explicit intent for advisor contact
          if (value) {
            engagement.trackEvent('next_action_selected', 'S9b', {
              action: 'advisor_contact_consent'
            });
          }
        }}
        sub="Optional. Leave it unticked and nobody calls."
      >
        It is OK for Turtlemint to contact me if something in my summary needs a closer look.
      </ConsentBox>
      {err ? <Note tone="danger">{err}</Note> : null}
    </ScreenShell>
  );
}
