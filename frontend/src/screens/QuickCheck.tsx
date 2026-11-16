/**
 * S1 (v4, after the S0 landing) — the whole quiz on ONE screen, like a travel search: stacked cards, one open at a time.
 * A collapsed card is a single row ("Who · You + partner · 2 kids"); tapping a chip fills the card and opens the next.
 * Family is steppers, not typing. Nothing scrolls at 390×690. "See my cover plan" appears the moment every card is answered.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  cardSummary, isCardComplete, isScreenComplete, pruneAnswers, ONE_SCREEN_CARDS, QUIZ_DEFAULTS, INCOME_OPTIONS, S1,
  type QuizAnswers, type QuizCard, type Situation,
} from '@cover-check/shared';
import { ScreenShell } from '../ui/components';
import { IconBriefcase, IconLock, IconMinus, IconPlus, IconShield, IconShieldOff, IconSparkle, IconUpload } from '../ui/icons';
import { t } from '../i18n';
import { errorOf, useFlow } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

type CardId = QuizCard['id'];
const order = ONE_SCREEN_CARDS.map((c) => c.id);
const card = (id: CardId) => ONE_SCREEN_CARDS.find((c) => c.id === id)!;
const options = (field: string) => { const q = S1.questions.find((x) => x.field === field); return q && q.kind === 'single' ? q.options : []; };

type Kind = 'none' | 'own' | 'group' | 'both';
const KINDS: { id: Kind; label: string; icon: ReactNode }[] = [
  { id: 'none', label: 'None yet', icon: <IconShieldOff size={18} /> },
  { id: 'own', label: 'My own', icon: <IconShield size={18} /> },
  { id: 'group', label: 'Company', icon: <IconBriefcase size={18} /> },
  { id: 'both', label: 'Company + own', icon: <span className="qc-kind__pair"><IconBriefcase size={14} /><IconShield size={14} /></span> },
];
const kindOf = (a: QuizAnswers): Kind | null =>
  !a.situation ? null : a.situation === 'group' ? (a.personal_policy_besides_group === 'yes' ? 'both' : 'group') : a.situation;

export function QuickCheck() {
  const { s, api, go, patch, engagement } = useFlow();
  const L = s.language;
  const [a, setA] = useState<QuizAnswers>(() => ({ ...QUIZ_DEFAULTS, ...s.answers }));
  const [confirmed, setConfirmed] = useState<Set<CardId>>(() => new Set(order.filter((id) => id !== 'who' && isCardComplete(card(id), { ...QUIZ_DEFAULTS, ...s.answers }))));
  const [open, setOpen] = useState<CardId | null>(() => order.find((id) => !confirmed.has(id)) ?? null);
  const [nudge, setNudge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(Date.now());
  const opened = useRef(Date.now());

  // Track quiz engagement
  useEffect(() => {
    opened.current = Date.now();
    setNudge(false);

    // Track quiz engagement when screen is shown
    engagement.trackEvent('screen_engaged', 'S1', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on progress
    });

    // Track quiz start if this is the beginning
    if (s.answers === undefined || Object.keys(s.answers).length === 0) {
      engagement.trackEvent('quiz_started', 'S1', {
        referral_source: 'whatsapp',
        initial_answers_count: 0
      });
    }
  }, [open, s.answers, engagement.trackEvent]);

  const allDone = isScreenComplete(S1, a);
  const nextOpen = (from: CardId, done: Set<CardId>, ans: QuizAnswers): CardId | null => {
    const i = order.indexOf(from);
    const rest = [...order.slice(i + 1), ...order.slice(0, i)];
    return rest.find((id) => !done.has(id) || !isCardComplete(card(id), ans)) ?? null;
  };
  const advance = (from: CardId, ans: QuizAnswers) => {
    const done = new Set(confirmed).add(from);
    setConfirmed(done);
    api.event('card_answered', 'S1', { card: from, ms: Date.now() - opened.current });

    // Track card completion
    engagement.trackEvent('content_toggle', 'S1', {
      elementId: `quiz-card-${from}`,
      isExpanded: true,
      sectionName: card(from).title
    });

    // Track answer submission
    engagement.trackEvent('answer_submitted', 'S1', {
      cardId: from,
      // We don't have the actual answer here, but we could track that it was answered
    });

    setTimeout(() => setOpen(nextOpen(from, done, ans)), 180); // let the tap register visually first
  };
  const set = (p: Partial<QuizAnswers>, then?: CardId) => {
    const next = { ...a, ...p };
    setA(next); setErr(null);

    // Track specific field updates for engagement
    Object.keys(p).forEach(field => {
      const key = field as keyof QuizAnswers;
      const oldValue = a[key] !== undefined ? (Array.isArray(a[key]) ? a[key].join(',') : a[key]) : null;
      const newValue = p[key] !== undefined ? (Array.isArray(p[key]) ? p[key].join(',') : p[key]) : null;
      engagement.trackEvent('content_toggle', 'S1', {
        elementId: `quiz-field-${field}`,
        isExpanded: true,
        sectionName: field,
        oldValue: oldValue,
        newValue: newValue
      });
    });

    if (then && isCardComplete(card(then), next)) advance(then, next);
  };

  const pickKind = (k: Kind) => {
    const situation: Situation = k === 'both' ? 'group' : k;
    const p: Partial<QuizAnswers> = { situation, personal_policy_besides_group: k === 'both' ? 'yes' : k === 'group' ? 'no' : undefined };
    if (k === 'none') p.sum_insured_band = undefined;
    set(p, k === 'none' ? 'cover' : undefined);
  };

  const primary = async () => {
    if (!allDone) {
      if (open && isCardComplete(card(open), a)) { advance(open, a); return; }
      if (open) { setNudge(true); return; }
      setOpen(order.find((id) => !isCardComplete(card(id), a)) ?? 'cover');
      return;
    }
    setBusy(true); setErr(null);

    // Track quiz completion
    engagement.trackEvent('quiz_completed', 'S1', {
      totalCards: order.length,
      completedCards: confirmed.size,
      completionTimeMs: Date.now() - started.current
    });

    try {
      let sessionId = s.sessionId;
      if (!sessionId) { sessionId = (await api.startQuiz(L)).sessionId; patch({ sessionId }); }
      const res = await api.saveScreen(sessionId, 'S1', pruneAnswers(a), Date.now() - started.current);
      const readout = await api.completeQuiz(sessionId);
      patch({ answers: res.answers, readout });
      go('S7');
    } catch (e) { setErr(errorOf(e).message); } finally { setBusy(false); }
  };

  const clear = () => {
    // Track quiz reset/clear
    engagement.trackEvent('screen_engaged', 'S1', {
      timeSpentMs: Date.now() - started.current,
      engagementDepth: confirmed.size * 100 / order.length
    });

    setA({ ...QUIZ_DEFAULTS });
    setConfirmed(new Set());
    setOpen('cover');
    setErr(null);

    // Reset timing references
    started.current = Date.now();
    opened.current = Date.now();
  };

  return (
    <ScreenShell label="S1 Check your cover" brand footer={
      <>
        <p className="qc-notice" lang={L}><IconLock size={14} />{t(L, 'notice')}</p>
        <div className="qc-foot">
          <button className="qc-clear" onClick={clear} disabled={busy}>Clear all</button>
          <button className={`btn btn--primary qc-go${allDone ? ' qc-go--ready' : ''}`} onClick={() => {
            engagement.trackEvent('next_action_selected', 'S1', { action: 'proceed_to_advice' });
            return void primary();
          }} disabled={busy}>
            {allDone ? <><IconSparkle size={18} />{busy ? 'Building…' : 'See my cover plan'}</> : 'Next'}
          </button>
        </div>
      </>
    }>
      <div className="qc">
        <h1 className="qc-title">Your cover plan in <span>20 seconds</span></h1>
        {ONE_SCREEN_CARDS.map((c) => open === c.id
          ? <section key={c.id} className="qc-card" aria-labelledby={`qc-${c.id}`}>
              <h2 id={`qc-${c.id}`}>{c.title}</h2>
              <CardBody id={c.id} a={a} set={set} pickKind={pickKind} engagement={engagement} />
              {nudge && !isCardComplete(c, a) ? <p className="field__err" role="alert">Pick one to continue</p> : null}
            </section>
          : <button key={c.id} className="qc-row" aria-expanded="false" onClick={() => setOpen(c.id)}>
              <span className="qc-row__k">{c.label}</span>
              {cardSummary(c, a) ? <span className="qc-row__v">{cardSummary(c, a)}</span> : <span className="qc-row__v qc-row__v--add">Add</span>}
            </button>)}
        <button className="qc-upload" onClick={() => {
          engagement.trackEvent('next_action_selected', 'S1', { action: 'upload_policy' });
          engagement.trackEvent('tool_used', 'S1', {
            toolType: 'navigation',
            toolId: 'to-policy-upload',
            action: 'initiated'
          });
          go('U1');
        }}>
          <IconUpload size={16} />Have your policy? Upload it instead
        </button>
        {err ? <p className="field__err" role="alert">{err}</p> : null}
      </div>
    </ScreenShell>
  );
}

function CardBody({ id, a, set, pickKind, engagement }: { id: CardId; a: QuizAnswers; set(p: Partial<QuizAnswers>, then?: CardId): void; pickKind(k: Kind): void; engagement: ReturnType<typeof useFlow>['engagement'] }) {
  const [changing, setChanging] = useState(false);
  switch (id) {
    case 'cover': {
      const k = kindOf(a);
      const picked = KINDS.find((x) => x.id === k);
      // Step 2: the choice folds into one line so the amount chips have the room (no scrolling).
      if (picked && k !== 'none' && !changing) return (
        <div className="qc-sub reveal">
          <button className="qc-picked" onClick={() => setChanging(true)}>{picked.icon}<b>{picked.label}</b><span>Change</span></button>
          <span className="qc-sub__label">{k === 'both' ? 'Total cover (company + yours)' : 'How much cover?'}</span>
          <Chips field="sum_insured_band" value={a.sum_insured_band} onPick={(v) => set({ sum_insured_band: v as QuizAnswers['sum_insured_band'] }, 'cover')} engagement={engagement} />
        </div>
      );
      return (
        <div className="qc-kinds" role="radiogroup" aria-label="Health cover today">
          {KINDS.map((x) => (
            <button key={x.id} role="radio" aria-checked={k === x.id} className="qc-kind" onClick={() => { setChanging(false); pickKind(x.id); }}>{x.icon}{x.label}</button>
          ))}
        </div>
      );
    }
    case 'who':
      return (
        <div className="qc-people">
          <People label="Adults" sub="You and your partner" value={a.adults_count ?? 1} min={1} max={2} onChange={(n) => set({ adults_count: n })} engagement={engagement} />
          <People label="Children" sub="On your cover" value={a.children_count ?? 0} min={0} max={4} onChange={(n) => set({ children_count: n })} engagement={engagement} />
          <People label="Parents" sub="Yours or in-laws" value={a.parents_count ?? 0} min={0} max={4} onChange={(n) => set({ parents_count: n })} engagement={engagement} />
        </div>
      );
    case 'age':
      return <Chips field="age_band" value={a.age_band} onPick={(v) => set({ age_band: v as QuizAnswers['age_band'] }, 'age')} engagement={engagement} />;
    case 'income':
      return (
        <>
          <div className="qc-chips" role="radiogroup" aria-label="Monthly take-home">
            {INCOME_OPTIONS.map((o) => (
              <button key={o.value} role="radio" aria-checked={a.income_band === o.value} className={`qc-chip${o.unsure ? ' qc-chip--soft' : ''}`}
                onClick={() => set({ income_band: o.value as QuizAnswers['income_band'] }, 'income')}>{o.label}</button>
            ))}
          </div>
          <p className="qc-help"><IconLock size={13} />Sizes your term and crisis cover. Never shared.</p>
        </>
      );
    case 'city':
      return (
        <div className="qc-kinds" role="radiogroup" aria-label="Where you live">
          <button role="radio" aria-checked={a.city_tier === 'metro'} className="qc-kind qc-kind--tall" onClick={() => set({ city_tier: 'metro' }, 'city')}>
            <span><b>Metro city</b><small>Mumbai, Delhi NCR, Bengaluru, Pune…</small></span></button>
          <button role="radio" aria-checked={a.city_tier === 'other'} className="qc-kind qc-kind--tall" onClick={() => set({ city_tier: 'other' }, 'city')}>
            <span><b>Other city</b><small>Any other city or town</small></span></button>
        </div>
      );
  }
}

function Chips({ field, value, onPick, engagement }: { field: string; value: unknown; onPick(v: string): void; engagement: ReturnType<typeof useFlow>['engagement'] }) {
  return (
    <div className="qc-chips" role="radiogroup">
      {options(field).map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={`qc-chip${o.unsure ? ' qc-chip--soft' : ''}`} onClick={() => {
          engagement.trackEvent('content_toggle', 'S1', {
            elementId: `quiz-chip-${field}-${o.value}`,
            isExpanded: true,
            sectionName: `${field}: ${o.label}`,
            oldValue: value !== undefined ? String(value) : null,
            newValue: o.value
          });
          onPick(o.value);
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function People({ label, sub, value, min, max, onChange, engagement }: { label: string; sub: string; value: number; min: number; max: number; onChange(n: number): void; engagement: ReturnType<typeof useFlow>['engagement'] }) {
  return (
    <div className="qc-person">
      <span><b>{label}</b><small>{sub}</small></span>
      <span className="qc-step" role="group" aria-label={label}>
        <button aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => {
          engagement.trackEvent('content_toggle', 'S1', {
            elementId: `quiz-people-${label.toLowerCase()}-decrement`,
            isExpanded: true,
            sectionName: label,
            oldValue: value,
            newValue: value - 1
          });
          onChange(value - 1);
        }}><IconMinus size={16} /></button>
        <output aria-live="polite" className="num">{value}</output>
        <button aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => {
          engagement.trackEvent('content_toggle', 'S1', {
            elementId: `quiz-people-${label.toLowerCase()}-increment`,
            isExpanded: true,
            sectionName: label,
            oldValue: value,
            newValue: value + 1
          });
          onChange(value + 1);
        }}><IconPlus size={16} /></button>
      </span>
    </div>
  );
}
