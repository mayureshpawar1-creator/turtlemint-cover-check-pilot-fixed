/**
 * Prototype entry (single self-contained HTML). Runs the real UI against MockApi, inside a phone frame,
 * with a side panel: door switch, jump-to-screen, the live telecaller card and the live record.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import { callSlots, pruneAnswers, type Door, type QuizAnswers, type ScreenId } from '@cover-check/shared';
import { createMockBackend, DEMO_OTP, type MockBackend } from './api/mock';
import { FlowProvider, initialFlow, useFlow } from './state/flow';
import { CustomerFlow } from './App';
import { LeadCardView } from './agent/LeadCardView';
import { IconAlert } from './ui/icons';

const PRIYA: QuizAnswers = pruneAnswers({
  situation: 'own', sum_insured_band: '3_5', adults_count: 2, children_count: 2, parents_count: 0, age_band: '31_40', income_band: '50k_1l', city_tier: 'metro',
});
const SCREENS: ScreenId[] = ['S0', 'S1', 'S7', 'S8', 'S9', 'S9a', 'S9b', 'S10', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8'];
const DOORS: { id: Door; label: string }[] = [
  { id: 'get', label: 'Get cover' }, { id: 'check', label: 'Check my cover' }, { id: 'company', label: 'Company cover' }, { id: 'review', label: 'Review cover' },
];
const STATE_LABEL: Record<string, string> = { incomplete: 'Incomplete', data_only: 'Data only', consented_warm: 'Warm, consented', hand_raised: 'Hand raised' };

function useMock(m: MockBackend) {
  const [, setTick] = useState(0);
  useEffect(() => { const off = m.subscribe(() => setTick((n) => n + 1)); return () => { off(); }; }, [m]);
  return m;
}

function SidePanel({ mock, onDoor }: { mock: MockBackend; onDoor(d: Door): void }) {
  const m = useMock(mock);
  const { s, api, go, patch } = useFlow();
  const card = m.card();
  const st = m.state;

  const jump = async (id: ScreenId) => {
    const needsQuiz = ['S7', 'S8', 'S9', 'S9a', 'S9b', 'S10'].includes(id);
    if (needsQuiz && !st.answers.situation) {
      const { sessionId, readout } = m.seedQuiz(PRIYA);
      patch({ sessionId, answers: PRIYA, readout });
    } else if (needsQuiz && !s.readout) {
      patch({ readout: m.seedQuiz(st.answers).readout, answers: st.answers });
    }
    if (['S9', 'S9b', 'S10'].includes(id) && !st.captured) { m.seedCapture(); patch({ captured: { firstName: 'Priya', city: 'Pune' } }); }
    if (id === 'S10' && !s.result) patch({ result: { action: 'summary', queued: false, at: new Date().toISOString() } });
    if (['U4', 'U5', 'U6', 'U7', 'U8'].includes(id) && !s.docIds.length) {
      const docId = m.seedDoc();
      patch({ docIds: [docId], mobileVerified: true });
      if (['U6', 'U7', 'U8'].includes(id)) patch({ summary: await api.confirmFacts(docId, []) });
    } else if (['U6', 'U7', 'U8'].includes(id) && !s.summary && s.docIds[0]) {
      patch({ summary: await api.confirmFacts(s.docIds[0], []) });
    }
    go(id);
  };

  return (
    <aside className="proto__side" aria-label="Prototype controls">
      <div className="proto__banner"><IconAlert size={18} />Design prototype — not a live page. Nothing you type leaves this browser. All copy is draft for compliance.</div>

      <section className="proto__panel">
        <h2>Entry door (from the WhatsApp creative)</h2>
        <div className="seg" role="group" aria-label="Door">
          {DOORS.map((d) => <button key={d.id} aria-pressed={s.door === d.id} onClick={() => onDoor(d.id)}>{d.label}</button>)}
        </div>
        <p className="small muted">Restarts the flow with that headline. Demo OTP: <b className="num">{DEMO_OTP}</b>.</p>
      </section>

      <section className="proto__panel">
        <h2>Jump to a screen</h2>
        <div className="proto__jump">
          {SCREENS.map((id) => <button key={id} aria-current={s.screen === id} onClick={() => void jump(id)}>{id}</button>)}
        </div>
        <p className="small muted">Jumping fills in an example (Priya: own policy ₹3–5 L, partner + 2 kids, 31–40, ₹50k–1 L a month, metro) where a screen needs earlier answers.</p>
      </section>

      <section className="proto__panel">
        <h2>Telecaller view — fills from this run</h2>
        <div className="agent"><LeadCardView card={card} example /></div>
      </section>

      <section className="proto__panel">
        <h2>What the record holds now</h2>
        <dl className="proto__kv">
          <dt>Lead state</dt><dd>{STATE_LABEL[m.leadState()]}</dd>
          <dt>Call priority</dt><dd>{m.priority() ?? 'None — nobody calls'}</dd>
          <dt>Checklist ticks</dt><dd>{st.marks.length ? st.marks.join(', ') : '—'}</dd>
          <dt>Plans shown</dt><dd>{st.recs.length ? st.recs.map((r) => `${r.type}${r.clicked ? ' ✓opened' : ''}${r.advisor ? ' ✓advisor' : ''}`).join(', ') : '—'}</dd>
          <dt>Summary sent</dt><dd>{st.summarySentAt ? 'Yes, after preview' : 'Not yet'}</dd>
          <dt>Consents</dt><dd>{st.consents.length ? st.consents.map((c) => `${c.purpose}${c.granted ? '' : ' (withdrawn)'}`).join(', ') : '—'}</dd>
          <dt>Answers</dt><dd className="small" style={{ fontWeight: 500, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{Object.keys(st.answers).length ? JSON.stringify(st.answers) : '—'}</dd>
          <dt>Last events</dt><dd className="small" style={{ fontWeight: 500 }}>{st.events.slice(-6).map((e) => e.name).join(' → ') || '—'}</dd>
        </dl>
      </section>
    </aside>
  );
}

function Prototype() {
  const [door, setDoor] = useState<Door>('check');
  const [mock] = useState(() => createMockBackend({ door: 'check' }));
  const [run, setRun] = useState(0);
  const restart = (d: Door) => { mock.reset(d); setDoor(d); setRun((r) => r + 1); };

  return (
    <FlowProvider key={run} api={mock.api} initial={{ ...initialFlow(door), slots: callSlots(new Date()) }}>
      <div className="proto">
        <div className="proto__phone"><div className="proto__screen"><CustomerFlow /></div></div>
        <SidePanel mock={mock} onDoor={restart} />
      </div>
    </FlowProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Prototype /></StrictMode>);
