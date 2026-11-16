/**
 * U6/U7 (v5) — "Your policy, understood". The upload result on one screen, the same way as the quiz board:
 *   [ who you are · insurer · plan — a verdict in one line ]
 *   [ your cover vs what you need ]  [ our advice — in your interest ]
 *   [ inside your policy: room rent · existing illnesses · co-pay · renewal ]   → tap any for plain words + what to do
 *   "Read your whole policy" → every line with its page, in a sheet
 * No swiping, no scrolling. Findings stay qualified when the evidence or rule is not validated.
 */
import { useEffect, useMemo, useState } from 'react';
import { buildPolicyBoard, type DocumentStatusView, type PickView, type PolicyCheck } from '@cover-check/shared';
import { ScreenShell } from '../ui/components';
import { IconAlert, IconCheck, IconFile, IconHeadset, IconHeart, IconList, IconSparkle } from '../ui/icons';
import { BlockPill, HaveBar, InfoSheet, PlainSheet, PlanSheet, pillLabel, toneIcon } from '../ui/advice';
import { useFlow, type Screen } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

type Open = { kind: 'pick' } | { kind: 'check'; c: PolicyCheck } | { kind: 'plain' } | null;
const STATUS_WORD: Record<PolicyCheck['status'], string> = { good: 'Good', watch: 'Watch', risk: 'Fix this', unknown: 'Not found' };

export function PolicyBoard({ startPlain = false }: { startPlain?: boolean }) {
  const { s, api, go, patch, engagement } = useFlow();
  const docId = s.docIds[0];
  const [facts, setFacts] = useState<DocumentStatusView['facts'] | null>(null);
  const [open, setOpen] = useState<Open>(startPlain ? { kind: 'plain' } : null);

  // Track initial engagement when component mounts
  useEffect(() => {
    if (!docId) return;
    api.docStatus(docId).then((v) => setFacts(v.facts));
    api.recommendations('document').catch(() => undefined); // records exactly the advice on this board

    // Track policy analysis engagement
    engagement.trackEvent('policy_analysis_viewed', 'U6', {
      analysisType: 'overview',
      timeSpentMs: 5000, // Initial load time
      insightsViewed: ['cover-need', 'advice'].join(',')
    });
  }, [docId, api, engagement.trackEvent]);

  const b = useMemo(() => (facts ? buildPolicyBoard(facts, s.answers) : null), [facts, s.answers]);
  useEffect(() => {
    if (b) {
      api.event('policy_health_viewed', 'U6', { flow: 'v5', persona: b.persona.id, pct: b.cover.pct ?? -1, advice: b.pick.kind,
        pick: b.pick.type ?? b.pick.reason, checks: b.checks.map((c) => `${c.id}:${c.status}`).join(',') });

      // Track detailed policy health viewing
      engagement.trackEvent('policy_analysis_viewed', 'U6', {
        analysisType: 'detailed_health_check',
        timeSpentMs: 30000, // Estimated time spent reviewing
        insightsViewed: b.checks.map(c => c.id).join(',')
      });
    }
  }, [api, b, engagement.trackEvent]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!b) return null;

  const withCapture = (next: Screen) => { if (s.captured) go(next); else { patch({ returnTo: next }); go('S8'); } };
  const toAdvisor = (p?: PickView, about?: string) => {
    if (p?.type) {
      api.clickRecommendation('document', p.type, 'advisor');
      engagement.trackEvent('recommendation_engaged', 'U6', {
        recommendationId: p.type,
        engagementLevel: 'detailed',
        timeSpentMs: 45000, // Estimated
        actionsTaken: ['viewed_details', 'advisor_initiated'].join(','),
        interests: ['price', 'coverage', 'benefits'].join(',')
      });
      patch({ advisorContext: { type: p.type, title: p.title } });
    }
    else {
      patch({ advisorContext: null });
      engagement.trackEvent('recommendation_engaged', 'U6', {
        recommendationId: 'general-advice',
        engagementLevel: 'brief',
        timeSpentMs: 15000,
        actionsTaken: ['viewed_summary'].join(','),
        interests: ['general-protection'].join(',')
      });
    }
    if (about) {
      api.event('point_opened', 'U6', { about, target: 'advisor' });
      engagement.trackEvent('gap_insight_interacted', 'U6', {
        gapType: about,
        action: 'questioned',
        clarityLevel: 80 // User is seeking clarification
      });
    }
    setOpen(null);
    withCapture('S9');
  };
  const c = b.cover;
  const p = b.pick;
  const slot = s.slots[0];

  return (
    <ScreenShell label="U6 Your policy, understood" title="" footer={
      <>
        <button className="btn btn--primary" onClick={() => toAdvisor()}><IconHeadset size={18} />Talk to my advisor — free</button>
        <div className="board__foot">
          {slot ? <span className="liveslot"><span className="liveslot__dot" />Free call {slot.day === 'today' ? 'today' : 'tomorrow'}, {slot.label.split(' – ')[0]}</span> : <span />}
          <button className="btn btn--ghost" onClick={() => setOpen({ kind: 'plain' })}><IconList size={16} />Whole policy</button>
        </div>
      </>
    }>
      <div className="board">
        <section className="board__hero">
          <span className="board__eyebrow"><IconFile size={13} />{[b.insurer, b.plan].filter(Boolean).join(' · ') || 'Your policy'}</span>
          <h1>{b.headline}</h1>
          <p>{b.note}</p>
        </section>

        <div className="board__grid">
          <article className="blk">
            <span className="blk__k"><IconHeart size={15} />Your cover</span>
            <span className="blk__lbl">{c.floater && c.people > 1 ? `Shared by ${c.people} people` : 'Sum insured'}</span>
            <b className="blk__big num">{c.haveLakh === null ? '—' : `₹${c.haveLakh} L`}</b>
            <HaveBar pct={c.pct} label={<>Draft estimate <b>₹{c.needLakh} L</b>{c.pct !== null ? ` · ${c.pct}% of draft estimate` : ''}</>} />
            {c.alert ? <p className={`blk__alert blk__alert--${c.alert.tone}`}>{c.alert.tone === 'risk' ? <IconAlert size={14} /> : <IconCheck size={14} />}{c.alert.text}</p> : null}
          </article>

          <article className={`blk blk--pick${p.kind === 'plan' ? '' : ' blk--advice'}`}>
            <span className={`pickbadge${p.kind === 'plan' ? '' : ' pickbadge--advice'}`}><IconSparkle size={13} />{p.kind === 'plan' ? 'Turtlemint pick' : 'Our advice'}</span>
            <b className="blk__title">{p.product ?? p.title}</b>
            {p.amount ? <span className="blk__amt num">{p.amount} cover</span> : null}
            <ul className="ticks">{p.short.map((x) => <li key={x}><IconCheck size={13} />{x}</li>)}</ul>
            <BlockPill label={pillLabel(p)} price={p.price} onClick={() => {
              engagement.trackEvent('plan_detail_viewed', 'U6', {
                planId: p.type ?? p.reason,
                planName: p.title,
                viewedFields: ['premium', 'coverage', 'benefits'].join(',')
              });
              setOpen({ kind: 'pick' });
              api.event('plan_details_opened', 'U6', { type: p.type ?? p.reason });
            }} />
          </article>

          <article className="blk blk--wide blk--checks">
            <span className="blk__k">Inside your policy<span className="blk__hint">Tap for plain words</span></span>
            <div className="checks">
              {b.checks.map((ck) => (
                <button key={ck.id} className={`check check--${ck.status}`} onClick={() => { setOpen({ kind: 'check', c: ck }); api.event('point_opened', 'U6', { area: ck.id }); }}
                  aria-label={`${ck.label}: ${ck.value}. ${STATUS_WORD[ck.status]}`}>
                  <span className="check__icon">{toneIcon(ck.status)}</span>
                  <span className="check__txt"><small>{ck.label}</small><b>{ck.value}</b></span>
                </button>
              ))}
            </div>
          </article>
        </div>
      </div>

      {open?.kind === 'pick' ? <PlanSheet p={p} onClose={() => setOpen(null)} onAdvisor={() => toAdvisor(p)}
        onSite={() => p.type && api.clickRecommendation('document', p.type, 'turtlemint')} onUpload={() => go('U3')} /> : null}
      {open?.kind === 'check' ? (
        <InfoSheet
          title={`${open.c.label}: ${open.c.value}`}
          status={{ tone: open.c.status, text: STATUS_WORD[open.c.status] }}
          lines={open.c.explain}
          todo={open.c.todo}
          page={open.c.page}
          sourceId={open.c.sourceId}
          onClose={() => {
            setOpen(null);
            engagement.trackEvent('content_toggle', 'U6', {
              elementId: `policy-check-${open.c.id}`,
              isExpanded: false,
              sectionName: open.c.label
            });
          }}
          onAdvisor={() => {
            const gapId = open.c.id;
            engagement.trackEvent('gap_insight_interacted', 'U6', {
              gapType: gapId,
              action: 'questioned',
              clarityLevel: 85
            });
            toAdvisor(undefined, gapId);
          }}
        />
      ) : null}
      {open?.kind === 'plain' ? (
        <PlainSheet
          sections={b.plain}
          onClose={() => {
            setOpen(null);
            engagement.trackEvent('content_toggle', 'U6', {
              elementId: 'whole-policy',
              isExpanded: false,
              sectionName: 'Complete policy document'
            });
          }}
        />
      ) : null}
    </ScreenShell>
  );
}
