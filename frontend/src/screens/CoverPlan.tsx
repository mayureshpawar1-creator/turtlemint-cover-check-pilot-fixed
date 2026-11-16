/**
 * S7 (v5) — "Your cover plan", written for the person in front of us. One screen, no scroll, no swipe.
 *   [ For Priya · A growing family — "Protect your kids' future" + one line about their life ]
 *   [ health cover you need vs have ]  [ our advice for it (a plan, "keep yours", or "check first") ]
 *   ── Talk to my advisor — free ──
 * v5 (decision D3b): no term-life or critical-illness blocks — this is a health product. If they said they're interested
 * in those (optional last question), one line says the advisor will cover it on the call; nothing is sized or sold here.
 * Every detail opens in a bottom sheet over the board.
 */
import { useEffect, useMemo, useState } from 'react';
import { buildPlanBoard, type PickView } from '@cover-check/shared';
import { ScreenShell } from '../ui/components';
import { IconAlert, IconChat, IconCheck, IconHeadset, IconHeart, IconSparkle, IconUsers } from '../ui/icons';
import { BlockPill, HaveBar, PlanSheet, PriorityChip, pillLabel } from '../ui/advice';
import { useFlow, type Screen } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

type Open = { kind: 'pick'; p: PickView } | null;

export function CoverPlan() {
  const { s, api, go, patch, engagement } = useFlow();
  const b = useMemo(() => buildPlanBoard(s.answers, s.captured?.firstName), [s.answers, s.captured]);
  const [open, setOpen] = useState<Open>(null);

  // Track initial engagement when component mounts
  useEffect(() => {
    api.recommendations('quiz').catch(() => undefined); // records exactly the plans suggested on this board
    api.event('snapshot_viewed', 'S7', { flow: 'v5', persona: b.persona.id, need: b.health.needLakh, have: b.health.haveLakh ?? -1,
      advice: b.healthPick.kind, parents: !!b.parentsPick, picks: b.picks.map((p) => p.type).join(',') });

    // Track screen engagement for CoverPlan (S7)
    engagement.trackEvent('content_toggle', 'S7', {
      elementId: 'cover-plan-board',
      isExpanded: true,
      sectionName: 'Main advice board'
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const withCapture = (next: Screen) => { if (s.captured) go(next); else { patch({ returnTo: next }); go('S8'); } };
  const openPick = (p: PickView) => {
    if (p.kind === 'check') {
      api.event('cta_clicked', 'S7', { action: 'upload_from_plan' });
      engagement.trackEvent('tool_used', 'S7', {
        toolType: 'calculator',
        toolId: 'upload-from-plan',
        action: 'opened'
      });
      go('U1');
      return;
    }
    setOpen({ kind: 'pick', p });
    api.event('plan_details_opened', 'S7', { type: p.type ?? p.reason });
    engagement.trackEvent('plan_detail_viewed', 'S7', {
      planId: p.type ?? p.reason,
      planName: p.title,
      viewedFields: ['premium', 'coverage', 'benefits'].join(',') // Simplified for now
    });
  };
  const toAdvisor = (p?: PickView) => {
    if (p?.type) {
      api.clickRecommendation('quiz', p.type, 'advisor');
      engagement.trackEvent('recommendation_engaged', 'S7', {
        recommendationId: p.type,
        engagementLevel: 'detailed',
        timeSpentMs: 30000, // Estimated time spent
        actionsTaken: ['viewed_details', 'compared'].join(','),
        interests: ['price', 'coverage'].join(',')
      });
      patch({ advisorContext: { type: p.type, title: p.title } });
    }
    else {
      patch({ advisorContext: null });
      engagement.trackEvent('recommendation_engaged', 'S7', {
        recommendationId: 'general-advice',
        engagementLevel: 'brief',
        timeSpentMs: 15000,
        actionsTaken: ['viewed_summary'].join(','),
        interests: ['general-protection'].join(',')
      });
    }
    setOpen(null);
    withCapture('S9');
  };
  const slot = s.slots[0];
  const h = b.health;
  const hp = b.healthPick;

  return (
    <ScreenShell label="S7 Your cover plan" title="" footer={
      <>
        <button className="btn btn--primary" onClick={() => toAdvisor()}><IconHeadset size={18} />Talk to my advisor — free</button>
        <div className="board__foot">
          {slot ? <span className="liveslot"><span className="liveslot__dot" />Free call {slot.day === 'today' ? 'today' : 'tomorrow'}, {slot.label.split(' – ')[0]}</span> : <span />}
          <button className="btn btn--ghost" onClick={() => go('S9b')}><IconChat size={16} />Send to WhatsApp</button>
        </div>
      </>
    }>
      <div className="board">
        <section className="board__hero">
          <span className="board__eyebrow"><IconUsers size={13} />{b.eyebrow}</span>
          <h1>{b.headline}</h1>
          <p>{b.note}</p>
        </section>

        <div className="board__grid">
          <article className="blk">
            <span className="blk__k"><IconHeart size={15} />Health<PriorityChip p={h.priority} /></span>
            <span className="blk__lbl">Cover you need</span>
            <b className="blk__big num">₹{h.needLakh} L</b>
            <HaveBar pct={h.pct} label={<>You have <b>{h.haveLabel}</b>{h.pct !== null && h.pct > 0 ? ` · ${h.pct}%` : ''}</>} />
            {h.alert ? <p className={`blk__alert blk__alert--${h.alert.tone}`}>{h.alert.tone === 'risk' ? <IconAlert size={14} /> : <IconCheck size={14} />}{h.alert.text}</p> : null}
          </article>

          <article className={`blk blk--pick${hp.kind === 'plan' ? '' : ' blk--advice'}`}>
            <span className={`pickbadge${hp.kind === 'plan' ? '' : ' pickbadge--advice'}`}><IconSparkle size={13} />{hp.kind === 'plan' ? 'Turtlemint pick' : 'Our advice'}</span>
            <b className="blk__title">{hp.product ?? hp.title}</b>
            {hp.amount ? <span className="blk__amt num">{hp.amount} cover</span> : null}
            <ul className="ticks">{hp.short.map((x) => <li key={x}><IconCheck size={13} />{x}</li>)}</ul>
            {b.parentsPick ? <button className="blk__also" onClick={() => openPick(b.parentsPick!)}>+ Plan for your parents</button> : null}
            <BlockPill label={pillLabel(hp)} price={hp.price} onClick={() => openPick(hp)} />
          </article>

        </div>
        {s.answers.other_protection_interest === 'yes'
          ? <p className="board__also">You asked about life or critical-illness cover — your advisor can talk you through it on the call.</p>
          : null}
      </div>

      {open?.kind === 'pick' ? (
        <PlanSheet
          p={open.p}
          onClose={() => {
            setOpen(null);
            engagement.trackEvent('plan_detail_viewed', 'S7', {
              planId: open.p.type,
              planName: open.p.title,
              viewedFields: [].join(','),
              action: 'closed'
            });
          }}
          onAdvisor={() => {
            engagement.trackEvent('recommendation_engaged', 'S7', {
              recommendationId: open.p.type,
              engagementLevel: 'detailed',
              timeSpentMs: 45000, // Estimated
              actionsTaken: ['viewed_details', 'advisor_initiated'].join(','),
              interests: ['price', 'coverage', 'benefits'].join(',')
            });
            toAdvisor(open.p);
          }}
          onSite={() => {
            engagement.trackEvent('tool_used', 'S7', {
              toolType: 'comparison',
              toolId: 'site-comparison',
              action: 'opened'
            });
            open.p.type && api.clickRecommendation('quiz', open.p.type, 'turtlemint');
          }}
          onUpload={() => {
            engagement.trackEvent('next_action_selected', 'S7', { action: 'upload_from_plan' });
            engagement.trackEvent('tool_used', 'S7', {
              toolType: 'calculator',
              toolId: 'upload-initiator',
              action: 'used'
            });
            go('U1');
          }}
        />
      ) : null}
    </ScreenShell>
  );
}
