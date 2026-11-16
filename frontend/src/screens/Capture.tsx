/** S8 — Save your summary. The least that makes a lead usable; one "why" line under each field. */
import { useEffect, useState } from 'react';
import { isFirstName, isIndianMobile, isPincode, toE164, type Language } from '@cover-check/shared';
import { Field, Note, Notice, OptionTile, ScreenShell } from '../ui/components';
import { SummaryArt } from '../illustrations';
import { errorOf, useFlow } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

export function Capture() {
  const { s, api, go, patch, engagement } = useFlow();
  const [name, setName] = useState(s.captured?.firstName ?? '');
  const [pin, setPin] = useState('');
  const [place, setPlace] = useState<{ city: string | null; state: string | null } | null>(null);
  const [confirm, setConfirm] = useState<'yes' | 'change' | null>(null);
  const [newMobile, setNewMobile] = useState('');
  const [lang, setLang] = useState<Language>(s.language);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  // Track capture screen engagement
  useEffect(() => {
    engagement.trackEvent('screen_engaged', 'S8', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });
  }, [engagement.trackEvent]);

  useEffect(() => {
    setPlace(null);
    if (isPincode(pin)) api.pincode(pin).then(setPlace).catch(() => setPlace({ city: null, state: null }));
  }, [pin, api]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!isFirstName(name)) e.firstName = 'Enter your first name (2 to 40 letters)';
    if (!isPincode(pin)) e.pincode = 'Enter a 6 digit pincode';
    if (!confirm) e.mobile = 'Confirm your WhatsApp number';
    if (confirm === 'change' && !isIndianMobile(toE164(newMobile))) e.mobile = 'Enter a valid 10 digit mobile number';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true); setFatal(null);

    // Track capture submitted
    engagement.trackEvent('capture_submitted', 'S8', {
      hasFirstName: !!name,
      hasPincode: !!pin,
      hasConfirm: !!confirm,
      confirmValue: confirm,
      hasNewMobile: !!newMobile
    });

    try {
      const res = await api.capture({ firstName: name, pincode: pin, mobileConfirmed: confirm === 'yes', language: lang,
        newMobile: confirm === 'change' ? toE164(newMobile) : undefined });
      patch({ captured: { firstName: name.trim(), city: res.city }, maskedMobile: res.maskedMobile,
        language: lang, ...(confirm === 'change' ? { mobileVerified: false } : {}) });
      const next = s.returnTo ?? 'S9';
      patch({ returnTo: null });

      // Track capture successful
      engagement.trackEvent('capture_submitted', 'S8', {
        success: true,
        city: res.city,
        maskedMobile: res.maskedMobile
      });

      go(next);
    } catch (err: unknown) {
      const x = errorOf(err);
      if (x.details && typeof x.details === 'object') setErrors(x.details); else setFatal(x.message);

      // Track capture failed
      engagement.trackEvent('capture_submitted', 'S8', {
        success: false,
        error: x.message || 'unknown'
      });
    } finally { setBusy(false); }
  };

  return (
    <ScreenShell label="S8 Save your summary" title="Save your summary" footer={
      <>
        <Notice>We save your answers. Nothing is sent and nobody calls at this step — you choose what happens next.</Notice>
        <button className="btn btn--primary" onClick={() => {
          engagement.trackEvent('next_action_selected', 'S8', {
            action: 'submit_capture'
          });
          return submit();
        }} disabled={busy}>{busy ? 'Saving…' : 'Save and see my options'}</button>
      </>
    }>
      <div className="readout-head">
        <SummaryArt />
        <div className="stack-sm">
          <h1 className="title">Save your snapshot</h1>
          <p className="muted small">Three details. You’ll preview the summary before anything is sent.</p>
        </div>
      </div>

      <Field label="First name" why="so the summary and any call use your name" error={errors.firstName}>
        {(id) => <input id={id} className="input" autoComplete="given-name" maxLength={40} value={name} aria-invalid={!!errors.firstName}
          onChange={(e) => {
            setName(e.target.value);

            // Track first name input
            engagement.trackEvent('content_toggle', 'S8', {
              elementId: 'first-name-input',
              isExpanded: true,
              sectionName: 'First name',
              oldValue: name,
              newValue: e.target.value
            });
          }} />}
      </Field>

      <Field label="Pincode" why="hospital costs and plan availability depend on where you live" error={errors.pincode}
        hint={place?.city ? `${place.city}, ${place.state}` : undefined}>
        {(id) => <input id={id} className="input num" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pin}
          aria-invalid={!!errors.pincode} onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));

            // Track pincode input
            engagement.trackEvent('content_toggle', 'S8', {
              elementId: 'pincode-input',
              isExpanded: true,
              sectionName: 'Pincode',
              oldValue: pin,
              newValue: e.target.value.replace(/\D/g, '')
            });
          }} />}
      </Field>

      <div className="field">
        <span className="field__label">Is this your WhatsApp number?</span>
        <div className="mobile-confirm">
          <span className="mobile-confirm__num num">{s.maskedMobile}</span>
          <div className="tiles" role="radiogroup" aria-label="Confirm number">
            <OptionTile
              label="Yes, send it here"
              selected={confirm === 'yes'}
              onSelect={() => {
                engagement.trackEvent('content_toggle', 'S8', {
                  elementId: 'mobile-confirm-yes',
                  isExpanded: true,
                  sectionName: 'WhatsApp number confirmation',
                  oldValue: confirm,
                  newValue: 'yes'
                });
                return setConfirm('yes');
              }}
            />
            <OptionTile
              label="Use a different number"
              selected={confirm === 'change'}
              onSelect={() => {
                engagement.trackEvent('content_toggle', 'S8', {
                  elementId: 'mobile-confirm-change',
                  isExpanded: true,
                  sectionName: 'WhatsApp number confirmation',
                  oldValue: confirm,
                  newValue: 'change'
                });
                return setConfirm('change');
              }}
            />
          </div>
          {confirm === 'change' && (
            <input className="input num reveal" inputMode="tel" placeholder="10 digit mobile" maxLength={14} value={newMobile}
              aria-label="New mobile number" onChange={(e) => setNewMobile(e.target.value)} />
          )}
        </div>
        {errors.mobile ? <span className="field__err" role="alert">{errors.mobile}</span> : null}
        <span className="field__why">Why: if you ask for the summary, it goes here</span>
      </div>

      <Field label="Preferred language (optional)">
        {(id) => (
          <select id={id} className="input" value={lang} onChange={(e) => setLang(e.target.value as Language)}>
            <option value="en">English</option><option value="hi">हिन्दी (Hindi)</option><option value="mr">मराठी (Marathi)</option>
          </select>
        )}
      </Field>
      {fatal ? <Note tone="danger">{fatal}</Note> : null}
    </ScreenShell>
  );
}
