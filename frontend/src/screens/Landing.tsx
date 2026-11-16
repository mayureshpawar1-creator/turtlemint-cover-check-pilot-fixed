/** S0 — Landing. States the promise, the effort and the privacy line. "Get my cover plan" opens the one-screen check (S1). */
import { useEffect } from 'react';
import { ScreenShell, Notice } from '../ui/components';
import { IconClock, IconList, IconNoUpload, IconUpload } from '../ui/icons';
import { HeroArt } from '../illustrations';
import { headline, t } from '../i18n';
import { useFlow } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

export function Landing() {
  const { s, api, go, engagement } = useFlow();
  const L = s.language;
  // 1.3: a campaign variant may set its own headline (and sub-line) for the language it was written in.
  const copy = s.landing && s.landing.language === L ? s.landing : null;

  // Track landing page engagement
  useEffect(() => {
    api.event('landing_viewed', 'S0', { door: s.door, flow: 'v4', campaign: s.attribution.campaignId, variant: s.attribution.variantId });

    // Track landing page view
    engagement.trackEvent('screen_engaged', 'S0', {
      timeSpentMs: 0, // Will be updated on exit
      engagementDepth: 0 // Will be updated based on interactions
    });

    // Track initial visit
    engagement.trackEvent('link_clicked', 'S0', {
      source: 'whatsapp',
      campaign: 'organic'
    });
  }, [api, s.door, engagement.trackEvent]);

  return (
    <ScreenShell label="S0 Landing" brand wash footer={
      <>
        <Notice>{t(L, 'notice')}</Notice>
        <button className="btn btn--primary" onClick={() => {
          engagement.trackEvent('next_action_selected', 'S0', { action: 'start_quiz' });
          engagement.trackEvent('tool_used', 'S0', {
            toolType: 'navigation',
            toolId: 'to-quiz',
            action: 'initiated'
          });
          go('S1');
        }}>{t(L, 'start')}</button>
        <button className="btn btn--ghost" style={{ alignSelf: 'center' }} onClick={() => {
          engagement.trackEvent('next_action_selected', 'S0', { action: 'upload_policy' });
          engagement.trackEvent('tool_used', 'S0', {
            toolType: 'navigation',
            toolId: 'to-policy-upload',
            action: 'initiated'
          });
          go('U1');
        }}>
          <IconUpload size={18} />{t(L, 'upload')}
        </button>
      </>
    }>
      <div className="hero">
        <div className="hero__art"><HeroArt /></div>
        <h1 className="title title--display" lang={L}>{copy?.headline ?? headline(L, s.door)}</h1>
        <p className="lede" lang={L}>{copy?.sub ?? t(L, 'sub')}</p>
        <div className="facts" lang={L}>
          <span className="fact"><IconClock size={16} />{t(L, 'fact.time')}</span>
          <span className="fact"><IconList size={16} />{t(L, 'fact.qs')}</span>
          <span className="fact"><IconNoUpload size={16} />{t(L, 'fact.noup')}</span>
        </div>
      </div>
      <div className="trust" lang={L}>
        {[1, 2, 3].map((n) => <div key={n}><b>{t(L, `trust.${n}t`)}</b>{t(L, `trust.${n}`)}</div>)}
      </div>
    </ScreenShell>
  );
}
