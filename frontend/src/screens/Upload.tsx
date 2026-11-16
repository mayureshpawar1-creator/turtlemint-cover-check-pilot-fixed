/** Rung 2 — U1 consent · U2 verify · U3 files · U4 reading · U5 check facts · U6 summary · U7 points. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FACT_INPUT_HINT, KEY_FACTS, normalizeFactInput, REVIEW_FACTS, type DocumentStatusView, type PolicyFactKey } from '@cover-check/shared';
import { ConsentBox, Note, OtpForm, ScreenShell } from '../ui/components';
import { ChartCard, CompareBars, StatusPill, StatusStrip, WaitMeter } from '../ui/charts';
import { PlanCard } from '../ui/PlanCard';
import { IconCheck, IconEdit, IconFile, IconHeadset, IconUpload, IconAlert, IconSparkle } from '../ui/icons';
import { BlurryArt, LockedDocArt, ReadingArt } from '../illustrations';
import { errorOf, useFlow } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

const RETENTION_DAYS = 90; // VALIDATION REQUIRED

export function UploadConsent() {
  const { s, api, go, engagement } = useFlow();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Track consent screen engagement
  useEffect(() => {
    engagement.trackEvent('screen_engaged', 'U1', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });
  }, [engagement.trackEvent]);

  const next = async () => {
    setBusy(true);
    setErr(null);

    // Track consent given
    if (ok) {
      engagement.trackEvent('next_action_selected', 'U1', {
        action: 'consent_given'
      });
      engagement.trackEvent('tool_used', 'U1', {
        toolType: 'consent',
        toolId: 'document-read-consent',
        action: 'granted'
      });
    }

    try {
      await api.docConsent(s.language);
      go(s.mobileVerified ? 'U3' : 'U2');
    } catch (e: unknown) {
      setErr(errorOf(e).message);
    } finally { setBusy(false); }
  };

  return (
    <ScreenShell label="U1 Consent" title="Full Cover Check" footer={
      <button className="btn btn--primary" disabled={!ok || busy} onClick={() => {
        engagement.trackEvent('next_action_selected', 'U1', {
          action: 'continue_clicked'
        });
        return next();
      }}>Continue</button>
    }>
      <div className="readout-head"><LockedDocArt size={72} /><div className="stack-sm">
        <span className="eyebrow">Before you upload</span>
        <h1 className="title">Here is exactly what we read</h1>
      </div></div>
      <div className="two-col">
        <div className="col-yes"><h3>We read</h3><ul><li>Policy terms</li><li>Who is covered</li><li>Dates and renewal</li><li>Limits and waiting periods</li></ul></div>
        <div className="col-no"><h3>We don’t need</h3><ul><li>ID proof</li><li>Bank details</li><li>Medical reports</li></ul></div>
      </div>
      <Note>We keep the file for {RETENTION_DAYS} days to prepare and explain your summary, then delete it. Ask any time and we delete it sooner.</Note>
      <ConsentBox
        checked={ok}
        onChange={(value) => {
          setOk(value);
          setErr(null);
          engagement.trackEvent('content_toggle', 'U1', {
            elementId: 'consent-checkbox',
            isExpanded: value,
            sectionName: 'Document consent',
            oldValue: !value,
            newValue: value
          });
        }}
      >
        I allow Turtlemint to read this document to prepare my summary.
      </ConsentBox>
      {err ? <p className="field__err" role="alert">{err}</p> : null}
    </ScreenShell>
  );
}

export function UploadVerify() {
  const { s, go, engagement } = useFlow();

  // Track OTP verification screen engagement
  useEffect(() => {
    engagement.trackEvent('screen_engaged', 'U2', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });
  }, [engagement.trackEvent]);

  return (
    <ScreenShell label="U2 Verify mobile" title="Verify">
      <OtpForm
        purpose="upload"
        onVerified={() => {
          engagement.trackEvent('otp_verified', 'U2', {
            purpose: 'upload',
            sessionId: s.sessionId
          });
          engagement.trackEvent('next_action_selected', 'U2', {
            action: 'otp_verified'
          });
          go('U3', { replace: true });
        }}
        onError={(error) => {
          engagement.trackEvent('otp_failed', 'U2', {
            purpose: 'upload',
            error: error || 'unknown'
          });
        }}
      />
    </ScreenShell>
  );
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic';
const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const localProblem = (f: File) =>
  !/\.(pdf|jpe?g|png|heic)$/i.test(f.name) ? 'Only PDF, JPG, PNG or HEIC' : f.size > 15 * 1024 * 1024 ? 'Over 15 MB' : null;

export function UploadChoose() {
  const { api, go, patch, engagement } = useFlow();
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const good = files.filter((f) => !localProblem(f));

  // Track file upload screen engagement
  useEffect(() => {
    engagement.trackEvent('screen_engaged', 'U3', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });
  }, [engagement.trackEvent]);

  const add = (list: FileList | null) => {
    if (list) {
      setFiles((cur) => [...cur, ...Array.from(list)].slice(0, 3));

      // Track files selected
      engagement.trackEvent('tool_used', 'U3', {
        toolType: 'file_upload',
        toolId: 'file-selector',
        action: 'files_selected',
        fileCount: Array.from(list || []).length
      });
    }
  };
  const upload = async () => {
    setBusy(true); setFatal(null);

    // Track upload initiated
    engagement.trackEvent('upload_started', 'U3', {
      fileCount: good.length,
      totalFileSize: good.reduce((sum, file) => sum + file.size, 0)
    });

    try {
      const res = await api.uploadDocs(good);
      setRejected(res.rejected);
      if (res.accepted.length) {
        patch({ docIds: res.accepted });

        // Track upload completed
        engagement.trackEvent('upload_completed', 'U3', {
          acceptedCount: res.accepted.length,
          rejectedCount: res.rejected.length,
          success: true
        });

        go('U4');
      } else {
        // Track upload failed
        engagement.trackEvent('upload_completed', 'U3', {
          acceptedCount: 0,
          rejectedCount: res.rejected.length,
          success: false
        });
      }
    } catch (e: unknown) {
      setFatal(errorOf(e).message);

      // Track upload failed
      engagement.trackEvent('upload_completed', 'U3', {
        acceptedCount: 0,
        rejectedCount: 0,
        success: false,
        error: errorOf(e).message || 'unknown'
      });
    } finally { setBusy(false); }
  };

  return (
    <ScreenShell label="U3 Choose file" title="Upload your policy" footer={
      <button className="btn btn--primary" disabled={!good.length || busy} onClick={() => {
        engagement.trackEvent('next_action_selected', 'U3', {
          action: 'upload_initiated'
        });
        return upload();
      }}>{busy ? 'Uploading…' : `Upload ${good.length || ''} ${good.length === 1 ? 'file' : 'files'}`}</button>
    }>
      <h1 className="title">Add your policy</h1>
      <Note><b>Tip:</b> the policy schedule page works best. The full document gives more.</Note>
      <button type="button" className="dropzone" onClick={() => {
        engagement.trackEvent('tool_used', 'U3', {
          toolType: 'file_upload',
          toolId: 'dropzone-click',
          action: 'opened'
        });
        input.current?.click();
      }} disabled={files.length >= 3}>
        <IconUpload size={28} style={{ color: 'var(--mint-700)' }} />
        <b>Choose a file or take a photo</b>
        <span className="small muted">PDF, JPG, PNG or HEIC · up to 3 files · 15 MB each</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => {
        add(e.target.files);
        e.target.value = '';
      }} />
      {files.length > 0 && (
        <div className="files">
          {files.map((f, i) => {
            const p = localProblem(f) ?? rejected.find((r) => r.name === f.name)?.reason;
            return (
              <div key={i} className={`file${p ? ' file--bad' : ''}`}>
                <IconFile size={22} style={{ color: p ? 'var(--danger-700)' : 'var(--mint-700)' }} />
                <div style={{ flex: 1, minWidth: 0 }}><div className="file__name">{f.name}</div><div className="file__meta">{p ?? fmtSize(f.size)}</div></div>
                <button className="link small" onClick={() => setFiles(files.filter((_, k) => k !== i))}>Remove</button>
              </div>
            );
          })}
        </div>
      )}
      <p className="small muted">Prototype tip: name a file with “locked”, “blurry” or “motor” to see those states.</p>
      {fatal ? <Note tone="danger">{fatal}</Note> : null}
    </ScreenShell>
  );
}

export function UploadReading() {
  const { s, api, go, engagement } = useFlow();
  const docId = s.docIds[0];
  const [view, setView] = useState<DocumentStatusView | null>(null);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const started = useRef(Date.now());

  // Track policy reading screen engagement
  useEffect(() => {
    engagement.trackEvent('screen_engaged', 'U4', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });
  }, [engagement.trackEvent]);

  useEffect(() => {
    if (!docId) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const v = await api.docStatus(docId).catch(() => null);
      if (v) setView(v);
      if (v && (v.status === 'ready' || v.status === 'needs_review')) {
        engagement.trackEvent('extraction_ready', 'U4', {
          docId: docId,
          status: v.status,
          readyAt: Date.now()
        });
        go('U5', { replace: true });
        return;
      }
      if (Date.now() - started.current > 90_000) setSlow(true);
      if (!v || !['failed'].includes(v.status)) setTimeout(tick, 700);
    };
    void tick();
    return () => { stop = true; };
  }, [docId, api, go, engagement.trackEvent]);

  const sendPassword = async () => {
    if (!docId) return;
    setPwErr(null);

    // Track password attempt
    engagement.trackEvent('tool_used', 'U4', {
      toolType: 'password_entry',
      toolId: 'pdf-password-input',
      action: 'attempted'
    });

    try {
      const v = await api.docPassword(docId, pw); setView(v); setPw('');
      if (v.needsPassword) {
        setPwErr('That password did not open the file.');
        engagement.trackEvent('tool_used', 'U4', {
          toolType: 'password_entry',
          toolId: 'pdf-password-input',
          action: 'failed'
        });
      } else {
        // Track password success
        engagement.trackEvent('tool_used', 'U4', {
          toolType: 'password_entry',
          toolId: 'pdf-password-input',
          action: 'succeeded'
        });
      }
    } catch (e: unknown) {
      setPwErr(errorOf(e).message);

      // Track password error
      engagement.trackEvent('tool_used', 'U4', {
        toolType: 'password_entry',
        toolId: 'pdf-password-input',
        action: 'error',
        error: errorOf(e).message || 'unknown'
      });
    }
  };

  const status = view?.status ?? 'queued';
  const step = status === 'queued' ? 1 : status === 'reading' ? 2 : 3;

  if (view?.status === 'failed') return <UploadProblem reason={view.failureReason ?? 'other'} />;

  return (
    <ScreenShell label="U4 Reading" title="Reading your policy">
      <div style={{ display: 'grid', placeItems: 'center' }}><ReadingArt /></div>
      {view?.needsPassword ? (
        <div className="stack reveal">
          <h1 className="title">This file is locked</h1>
          <p className="muted">Enter the PDF password. It is often your date of birth or part of your name — check the insurer’s email.</p>
          <input className="input" type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="PDF password" />
          {pwErr ? <span className="field__err">{pwErr}</span> : <span className="field__why">The password is used once to open the file and never stored.</span>}
          <button className="btn btn--primary" disabled={!pw} onClick={() => {
            engagement.trackEvent('next_action_selected', 'U4', {
              action: 'password_attempt'
            });
            return sendPassword();
          }}>Open file</button>
        </div>
      ) : (
        <>
          <h1 className="title" style={{ textAlign: 'center' }}>Reading your policy</h1>
          <ol className="steps" aria-live="polite">
            {['Uploading', 'Reading your policy', 'Preparing your summary'].map((label, i) => (
              <li key={label} data-state={i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'todo'}>
                <span className="steps__dot">{i + 1 < step ? <IconCheck size={14} strokeWidth={3} /> : null}</span>{label}
              </li>
            ))}
          </ol>
          <Note>{slow ? 'This is taking longer than usual. You can close this page — we will send your summary on WhatsApp when it is ready.'
            : 'Usually about a minute. You can close this page — we will send the summary on WhatsApp when it is ready.'}</Note>
        </>
      )}
    </ScreenShell>
  );
}

function UploadProblem({ reason }: { reason: string }) {
  const { go } = useFlow();
  const copy: Record<string, { t: string; b: string }> = {
    unreadable: { t: 'We could not read page 2', b: 'The photo looks blurry. Retake it in good light, or upload the PDF from your insurer’s email.' },
    not_health: { t: 'This looks like a different policy', b: 'It seems to be a motor, life or travel policy. Cover Check reads health policies — upload a different file.' },
    wrong_password: { t: 'The file stayed locked', b: 'After 3 tries we stopped. Upload an unlocked copy, or an advisor can help.' },
    other: { t: 'Something went wrong reading this file', b: 'Try again, or an advisor can help.' },
  };
  const c = copy[reason] ?? copy.other!;
  return (
    <ScreenShell label="U4 Exception" title="Reading your policy" footer={
      <>
        <button className="btn btn--primary" onClick={() => go('U3', { replace: true })}><IconUpload size={18} />Upload a different file</button>
        <button className="btn btn--secondary" onClick={() => go('S9')}><IconHeadset size={18} />Talk to an advisor</button>
      </>
    }>
      <div style={{ display: 'grid', placeItems: 'center' }}><BlurryArt /></div>
      <h1 className="title" style={{ textAlign: 'center' }}>{c.t}</h1>
      <p className="muted" style={{ textAlign: 'center' }}>{c.b}</p>
    </ScreenShell>
  );
}

export function UploadCheck() {
  const { s, api, go, patch, engagement } = useFlow();
  const docId = s.docIds[0];
  const [view, setView] = useState<DocumentStatusView | null>(null);
  const [edits, setEdits] = useState<Partial<Record<PolicyFactKey, string>>>({});
  const [editing, setEditing] = useState<PolicyFactKey | null>(null);
  const [busy, setBusy] = useState(false);

  // Track policy check screen engagement
  useEffect(() => {
    engagement.trackEvent('screen_engaged', 'U5', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });
  }, [engagement.trackEvent]);

  useEffect(() => { if (docId) api.docStatus(docId).then(setView); }, [docId, api]);
  if (!view) return null;

  const rows = REVIEW_FACTS.map((k) => view.facts.find((f) => f.key === k) ?? { key: k, label: k, value: null, sourcePage: null, confidence: null, userConfirmed: false, userValue: null });
  // Nothing was read automatically (pilot "manual" mode, or an unreadable scan): ask them to copy the details in.
  const typeIn = KEY_FACTS.every((k) => !view.facts.find((f) => f.key === k)?.value);
  const missing = rows.filter((r) => !r.value && !edits[r.key]);
  const invalid = (Object.entries(edits) as [PolicyFactKey, string][]).filter(([k, v]) => v && normalizeFactInput(k, v) === null).map(([k]) => k);
  const confirm = async () => {
    if (invalid.length) {
      setEditing(invalid[0]!);
      engagement.trackEvent('tool_used', 'U5', {
        toolType: 'validation',
        toolId: 'form-validation',
        action: 'failed',
        error: 'invalid_input'
      });
      return;
    }
    setBusy(true);

    // Track confirmation initiated
    engagement.trackEvent('tool_used', 'U5', {
      toolType: 'validation',
      toolId: 'form-validation',
      action: 'initiated'
    });

    try {
      const summary = await api.confirmFacts(docId!, Object.entries(edits).map(([key, v]) => ({ key: key as PolicyFactKey, userValue: v || null })));
      patch({ summary });

      // Track confirmation completed
      engagement.trackEvent('facts_confirmed', 'U5', {
        factCount: Object.keys(edits).length,
        success: true
      });

      go('U6', { replace: true });
    } catch (error: unknown) {
      // Track confirmation failed
      engagement.trackEvent('facts_confirmed', 'U5', {
        factCount: Object.keys(edits).length,
        success: false,
        error: errorOf(error).message || 'unknown'
      });
    } finally { setBusy(false); }
  };

  return (
    <ScreenShell label="U5 Check what we read" title="Check what we read" footer={
      <button className="btn btn--primary" disabled={busy} onClick={() => {
        engagement.trackEvent('next_action_selected', 'U5', {
          action: typeIn ? 'view_report' : 'confirm_facts'
        });
        return confirm();
      }}>{typeIn ? 'See my policy report' : 'Looks right'}</button>
    }>
      <h1 className="title">{typeIn ? 'Add your policy details' : 'Is this right?'}</h1>
      <p className="muted">{typeIn
        ? 'Copy these from the first page of your policy (the schedule). Takes about a minute — your advisor also gets the file.'
        : 'Fix anything we got wrong. This keeps your summary accurate.'}</p>
      <div className="factlist">
        {rows.map((f) => {
          const shown = edits[f.key] ?? f.userValue ?? f.value;
          return (
            <div key={f.key} className="factrow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="factrow__k">{labelOf(f.key)}{f.sourcePage ? <span className="pagechip">p. {f.sourcePage}</span> : null}</div>
                {editing === f.key ? (
                  <input className="input" autoFocus defaultValue={shown ?? ''} aria-label={labelOf(f.key)} placeholder={FACT_INPUT_HINT[f.key]}
                    onBlur={(e) => {
                      setEdits({ ...edits, [f.key]: e.target.value.trim() });
                      setEditing(null);

                      // Track fact value updated
                      engagement.trackEvent('content_toggle', 'U5', {
                        elementId: `fact-field-${f.key}`,
                        isExpanded: false,
                        sectionName: labelOf(f.key),
                        oldValue: shown,
                        newValue: e.target.value.trim()
                      });
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                ) : shown && invalid.includes(f.key) ? <div className="factrow__v factrow__v--missing" role="alert">We couldn’t read “{shown}” — try {FACT_INPUT_HINT[f.key] ?? 'again'}</div>
                  : shown ? <div className="factrow__v">{pretty(f.key, normalizeFactInput(f.key, shown) ?? shown)}</div>
                  : <div className="factrow__v factrow__v--missing">Not found — please enter it</div>}
              </div>
              {editing !== f.key && <button className="link small row" onClick={() => {
                engagement.trackEvent('content_toggle', 'U5', {
                  elementId: `fact-field-${f.key}`,
                  isExpanded: true,
                  sectionName: labelOf(f.key),
                  oldValue: shown,
                  newValue: 'editing'
                });
                return setEditing(f.key);
              }}><IconEdit size={16} />{shown ? 'Edit' : 'Add'}</button>}
            </div>
          );
        })}
      </div>
      {missing.length > 0 && <Note tone="amber" icon={<IconAlert size={18} />}>We never guess. If you leave a field empty, your summary will say it was not found.</Note>}
    </ScreenShell>
  );
}

const LABELS: Partial<Record<PolicyFactKey, string>> = {
  insurer_name: 'Insurer', product_name: 'Plan', policy_type: 'Policy type', sum_insured_inr: 'Sum insured', members: 'Members covered',
  start_date: 'Start date', end_date: 'End date',
  room_rent_limit: 'Room rent limit', copay_percent: 'Co-pay', ped_waiting_months: 'Wait for existing illnesses',
};
const labelOf = (k: PolicyFactKey) => LABELS[k] ?? k;
const pretty = (k: PolicyFactKey, v: string) =>
  k === 'sum_insured_inr' && /^\d+$/.test(v) ? `₹${Number(v).toLocaleString('en-IN')}`
    : k === 'copay_percent' && /^\d+$/.test(v) ? (v === '0' ? 'None' : `${v}% of every claim`)
    : k === 'ped_waiting_months' && /^\d+$/.test(v) ? `${v} months`
    : k === 'policy_type' ? ({ floater: 'Family floater', individual: 'Individual', group: 'Group' } as Record<string, string>)[v] ?? v
    : /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : v;
