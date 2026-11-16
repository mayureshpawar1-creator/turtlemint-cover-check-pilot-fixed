/**
 * S9 — What next (also U8 after an upload). Four equal options, none pre-selected, no box pre-ticked.
 * A call is only possible with the unticked contact consent box ticked and the number verified.
 */
import { useMemo, useState, useEffect } from 'react';
import type { Language, Topic } from '@cover-check/shared';
import { ConsentBox, Field, Note, OptionTile, OtpForm, ScreenShell, Sheet } from '../ui/components';
import { IconFile, IconHeadset, IconChat, IconSparkle, IconUpload } from '../ui/icons';
import { AdvisorArt } from '../illustrations';
import { errorOf, useFlow, type NextAction } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

const OPTIONS: { id: NextAction; label: string; desc: string; Icon: typeof IconFile }[] = [
  { id: 'policy', label: 'Check my full policy', desc: 'Upload it and get a plain summary', Icon: IconFile },
  { id: 'advisor', label: 'Talk to an advisor', desc: 'At a time you choose', Icon: IconHeadset },
  { id: 'plans', label: 'See plans that fit', desc: 'Matched to your answers', Icon: IconSparkle },
  { id: 'summary', label: 'Send me the summary', desc: 'Preview it first. No call.', Icon: IconChat },
];
const TOPICS: { v: Topic; l: string }[] = [
  { v: 'renewal', l: 'Renewal' }, { v: 'parents', l: "Parents' cover" }, { v: 'compare', l: 'Comparing plans' },
  { v: 'claim', l: 'A claim question' }, { v: 'other', l: 'Something else' },
];

export function NextStep({ fromUpload = false }: { fromUpload?: boolean }) {
  const { s, api, go, patch, engagement } = useFlow();
  const [choice, setChoice] = useState<NextAction | null>(s.advisorContext ? 'advisor' : null);
  const [day, setDay] = useState<'today' | 'tomorrow'>(s.slots.some((x) => x.day === 'today') ? 'today' : 'tomorrow');
  const [slot, setSlot] = useState<string | null>(null);
  const [callLang, setCallLang] = useState<Language | null>(null);
  const [topic, setTopic] = useState<Topic | null>(s.advisorContext ? 'compare' : null);
  const [note, setNote] = useState(s.advisorContext ? `About: ${s.advisorContext.title}`.slice(0, 140) : '');
  const [consent, setConsent] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const daySlots = useMemo(() => s.slots.filter((x) => x.day === day), [s.slots, day]);

  // Track initial engagement when component mounts
  useEffect(() => {
    // Track screen engagement for NextStep
    engagement.trackEvent('content_toggle', fromUpload ? 'U8' : 'S9', {
      elementId: 'next-step-options',
      isExpanded: true,
      sectionName: 'Next step options'
    });
  }, [fromUpload, engagement.trackEvent]);

  const pick = (id: NextAction) => {
    setChoice(id); setErrors({}); setFatal(null);

    // Track next action selection
    engagement.trackEvent('next_action_selected', fromUpload ? 'U8' : 'S9', {
      action: id
    });

    if (id === 'policy') {
      engagement.trackEvent('tool_used', fromUpload ? 'U8' : 'S9', {
        toolType: 'navigation',
        toolId: 'to-policy-upload',
        action: 'initiated'
      });
      go('U1');
    }
    if (id === 'plans') {
      engagement.trackEvent('tool_used', fromUpload ? 'U8' : 'S9', {
        toolType: 'navigation',
        toolId: 'to-plans-view',
        action: 'initiated'
      });
      go('S9a');
    }
    if (id === 'summary') {
      engagement.trackEvent('tool_used', fromUpload ? 'U8' : 'S9', {
        toolType: 'navigation',
        toolId: 'to-summary-view',
        action: 'initiated'
      });
      go('S9b');
    }
    if (id === 'advisor') {
      engagement.trackEvent('tool_used', fromUpload ? 'U8' : 'S9', {
        toolType: 'navigation',
        toolId: 'to-advisor-call',
        action: 'initiated'
      });
    }
  };

  const submit = async (verifiedNow = false) => {
    if (choice !== 'advisor') return;
    const isCall = choice === 'advisor';
    const e: Record<string, string> = {};
    if (isCall) {
      if (!slot) e.slot = 'Pick a time';
      if (!callLang) e.lang = 'Pick a language';
      if (!consent) e.consent = 'Tick the box so we are allowed to call you';
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    if (isCall && !s.mobileVerified && !verifiedNow) { setOtpOpen(true); return; }
    const sl = s.slots.find((x) => x.start === slot);
    setBusy(true); setFatal(null);

    // Track advisor call request
    if (isCall) {
      engagement.trackEvent('call_requested', fromUpload ? 'U8' : 'S9', {
        action: 'advisor',
        slot: slot,
        callLanguage: callLang,
        topic: topic
      });
    }

    try {
      const res = await api.handoff({
        requestedAction: 'advisor_call',
        slotStart: sl?.start, slotEnd: sl?.end, callLanguage: callLang ?? undefined, topic: topic ?? undefined,
        note: note.trim() || undefined, contactConsent: consent, language: s.language,
      });
      patch({ advisorContext: null, result: { action: choice, slotLabel: sl ? `${sl.day === 'today' ? 'Today' : 'Tomorrow'}, ${sl.label}` : undefined,
        callLanguage: callLang ?? undefined, queued: res.queued, at: new Date().toISOString() } });
      go('S10');
    } catch (err) {
      const x = errorOf(err);
      if (x.code === 'OTP_REQUIRED') setOtpOpen(true); else setFatal(x.message);
    } finally { setBusy(false); }
  };

  const showSubmit = choice === 'advisor';
  return (
    <ScreenShell label={fromUpload ? 'U8 How Turtlemint can help' : 'S9 What next'} title={fromUpload ? 'How Turtlemint can help' : 'What next'}
      footer={showSubmit ? (
        <button className="btn btn--primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Sending…' : 'Request the call'}
        </button>
      ) : undefined}>
      <div className="stack-sm">
        <h1 className="title">{s.captured ? `Saved, ${s.captured.firstName}.` : 'Your summary is ready.'} What would help most?</h1>
        <p className="muted small">Pick one. You can always come back to this link.</p>
      </div>

      <div className="tiles tiles--grid" role="radiogroup" aria-label="Next step">
        {OPTIONS.map(({ id, label, desc, Icon }) => (
          <button key={id} type="button" role="radio" aria-checked={choice === id} className="tile tile--stack" onClick={() => pick(id)}>
            <span className="tile__icon"><Icon size={22} /></span>
            <span className="tile__label">{label}</span>
            <span className="tile__desc">{desc}</span>
          </button>
        ))}
      </div>
      {fromUpload && <button className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={() => go('U3')}><IconUpload size={18} />Upload another policy</button>}

      {choice === 'advisor' && (
        <div className="form-card reveal">
          {s.advisorContext ? <span className="ctx-chip">About: {s.advisorContext.title}</span> : null}
          <div className="row"><AdvisorArt size={48} /><div><b>An advisor calls you</b><p className="small muted">Only in the slot you pick. Nobody calls outside it.</p></div></div>

          <div className="field">
            <span className="field__label">When should we call?</span>
            <div className="seg" role="group" aria-label="Day">
              {(['today', 'tomorrow'] as const).map((d) => (
                <button key={d} aria-pressed={day === d} disabled={!s.slots.some((x) => x.day === d)} onClick={() => { setDay(d); setSlot(null); }}>
                  {d === 'today' ? 'Today' : 'Tomorrow'}
                </button>
              ))}
            </div>
            <div className="slots" role="radiogroup" aria-label="Time slot">
              {daySlots.map((x) => <OptionTile key={x.start} label={x.label} selected={slot === x.start} onSelect={() => setSlot(x.start)} />)}
            </div>
            {errors.slot ? <span className="field__err">{errors.slot}</span> : <span className="field__why">Calls only between 9 am and 9 pm.</span>}
          </div>

          <div className="field">
            <span className="field__label">Language for the call</span>
            <div className="chips">
              {([['en', 'English'], ['hi', 'Hindi'], ['mr', 'Marathi']] as const).map(([v, l]) =>
                <button key={v} className="chip" aria-pressed={callLang === v} onClick={() => setCallLang(v)}>{l}</button>)}
            </div>
            {errors.lang ? <span className="field__err">{errors.lang}</span> : null}
          </div>

          <div className="field">
            <span className="field__label">What should we help with? <span className="muted">(optional)</span></span>
            <div className="chips">{TOPICS.map((x) => <button key={x.v} className="chip" aria-pressed={topic === x.v} onClick={() => setTopic(topic === x.v ? null : x.v)}>{x.l}</button>)}</div>
          </div>

          <Field label="One line in your words (optional)">
            {(id) => <textarea id={id} className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. My premium went up this year" />}
          </Field>
          <div className="counter num" style={{ marginTop: -12 }}>{note.length}/140</div>

          <ConsentBox checked={consent} onChange={setConsent} sub="You can withdraw this any time.">
            Turtlemint can call me on <b className="num">{s.maskedMobile}</b> in this slot.
          </ConsentBox>
          {errors.consent ? <span className="field__err" role="alert">{errors.consent}</span> : null}
        </div>
      )}

      {fatal ? <Note tone="danger">{fatal}</Note> : null}

      {otpOpen && (
        <Sheet label="Verify your number" onClose={() => setOtpOpen(false)}>
          <h2 className="title">One quick check</h2>
          <OtpForm purpose="call" inSheet onVerified={() => { setOtpOpen(false); void submit(true); }} />
        </Sheet>
      )}
    </ScreenShell>
  );
}
