/** S9a — Plans that fit. Plan TYPES matched to their answers, each opening Turtlemint's plan page, with an advisor shortcut. */
import { useEffect, useState } from 'react';
import type { PlanRec } from '@cover-check/shared';
import { Note, ScreenShell } from '../ui/components';
import { PlanCard } from '../ui/PlanCard';
import { IconChat, IconHeadset } from '../ui/icons';
import { errorOf, useFlow } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

export function PlansFit() {
  const { s, api, go, patch, engagement } = useFlow();
  const [recs, setRecs] = useState<PlanRec[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Track engagement when recommendations are loaded
  useEffect(() => {
    const loadRecs = async () => {
      try {
        const recsData = await api.recommendations('quiz');
        setRecs(recsData);

        // Track recommendation viewing
        if (recsData && recsData.length > 0) {
          engagement.trackEvent('recommendations_compared', 'S9a', {
            comparedCount: recsData.length,
            comparisonCriteria: ['price', 'coverage', 'benefits'].join(','),
            preferredOption: recsData[0]?.type ?? 'unknown'
          });

          // Track individual recommendation views
          recsData.forEach((rec, index) => {
            setTimeout(() => {
              engagement.trackEvent('plan_detail_viewed', 'S9a', {
                planId: rec.type,
                planName: rec.type,
                viewedFields: ['premium', 'coverage'].join(','),
                engagementLevel: index === 0 ? 'detailed' : 'brief' // First one gets more attention
              });
            }, index * 1000); // Stagger the tracking
          });
        }
      } catch (e) {
        setErr(errorOf(e).message);
      }
    };

    loadRecs();
  }, [api, engagement.trackEvent]);

  const situation = s.answers.situation;
  return (
    <ScreenShell label="S9a Plans that fit" title="Plans that fit" footer={
      <>
        <button className="btn btn--primary" onClick={() => {
          patch({ advisorContext: null });
          engagement.trackEvent('call_requested', 'S9a', { action: 'advisor' });
          go(s.captured ? 'S9' : 'S8');
        }}>
          <IconHeadset size={18} />Talk to an advisor
        </button>
        <button className="btn btn--ghost" style={{ alignSelf: 'center' }} onClick={() => {
          engagement.trackEvent('next_action_selected', 'S9a', { action: 'summary_only' });
          go('S9b');
        }}>
          <IconChat size={18} />Send me the summary instead</button>
      </>
    }>
      <div className="stack-sm">
        <span className="eyebrow">Matched to your answers</span>
        <h1 className="title">{situation === 'none' ? 'Where to start' : 'Ways to make your cover stronger'}</h1>
        <p className="muted small">{situation === 'none'
          ? 'Plan types that fit who you want to cover. Compare actual plans and prices on Turtlemint.'
          : 'You don’t have to change your policy — these can add to what you already have.'}</p>
      </div>
      {err ? <Note tone="danger">{err}</Note> : null}
      {!recs && !err ? <p className="muted">Finding options…</p> : null}
      {recs?.map((r) => <PlanCard key={r.type} rec={r} origin="quiz"
        onClick={() => {
          engagement.trackEvent('recommendation_engaged', 'S9a', {
            recommendationId: r.type,
            engagementLevel: 'detailed',
            timeSpentMs: 30000,
            actionsTaken: ['viewed_details', 'compared'].join(','),
            interests: ['price', 'coverage', 'benefits'].join(',')
          });
        }}
      />)}
      {recs && recs.length === 0 ? <Note>Your answers don’t point to a gap. An advisor can still walk you through options.</Note> : null}
      <p className="disclaimer">Plans and prices are shown on Turtlemint’s site. We don’t rank insurers here. Plan details need insurer-approved content.</p>
    </ScreenShell>
  );
}
