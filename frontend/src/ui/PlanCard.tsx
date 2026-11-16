/** One "plan that fits" card: why it fits them, two plain facts, then Turtlemint page + advisor. */
import { attributeUrl, type PlanRec } from '@cover-check/shared';
import { IconHeadset, IconLink, IconSparkle } from './icons';
import { useFlow } from '../state/flow';
import type { EngagementEvent } from '@cover-check/shared/src/engagement';

export function PlanCard({ rec, origin, onClick }: { rec: PlanRec; origin: 'quiz' | 'document'; onClick?: () => void }) {
  const { s, api, go, patch, engagement } = useFlow();
  return (
    <article className="plan" onClick={onClick}>
      <h2 className="title" style={{ fontSize: 18, lineHeight: '24px' }}>{rec.title}</h2>
      <p className="plan__why"><IconSparkle size={18} />{rec.why}</p>
      <ul>{rec.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <div className="plan__actions">
        {/* Opens Turtlemint's plan page; UTM tags attribute the visit to Cover Check. */}
        <a className="btn btn--secondary" href={attributeUrl(rec.url, s.attribution)} target="_blank" rel="noopener"
          onClick={() => {
            engagement.trackEvent('tool_used', origin as any, {
              toolType: 'external_link',
              toolId: 'turtlemint-plan-page',
              action: 'clicked'
            });
            api.clickRecommendation(origin, rec.type, 'turtlemint');
          }}>
          <IconLink size={18} />{rec.cta} on Turtlemint
        </a>
        <button className="btn btn--ghost" style={{ alignSelf: 'center' }} onClick={() => {
          engagement.trackEvent('recommendation_engaged', origin as any, {
            recommendationId: rec.type,
            engagementLevel: 'detailed',
            timeSpentMs: 45000,
            actionsTaken: ['viewed_details', 'advisor_initiated'].join(','),
            interests: ['price', 'coverage', 'benefits'].join(',')
          });
          api.clickRecommendation(origin, rec.type, 'advisor');
          patch({ advisorContext: { type: rec.type, title: rec.title } });
          go(s.captured ? 'S9' : 'S8'); // name + number first, then the call form
        }}><IconHeadset size={18} />Talk to an advisor about this</button>
      </div>
    </article>
  );
}
