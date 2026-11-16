/**
 * In-product plan exploration component.
 *
 * Shows plan types that fit the user's quiz answers, with features,
 * starting prices (when Turtlemint picks are approved), and advisor CTA.
 * Keeps user in-product; no external tabs required unless user chooses.
 *
 * Usage: <PlanExploration quizAnswers={answers} onClose={handleClose} />
 *
 * Flow:
   S7 Result → PlanExploration → User explores plans → "Talk to advisor"
   → S9 (advisor scheduling) → S10 (confirmation)
 *
 * Or from S9a: PlanExploration replaces external plan links with in-product view.
 */
import React, { useCallback, useMemo } from 'react';
import { useFlow } from '../../state/flow';
import { recommendPlans, type PlanRec } from '@cover-check/shared';
import {
  getApprovedTurtlemintPick,
  type TurtlemintPick,
  PLAN_TYPES,
  type PlanType,
  PLAN_DETAILS,
  PLAN_PAGES,
  PLAN_TITLE,
} from '@cover-check/shared';
import { clip, oneLine } from '@cover-check/shared';
import {
  IconSparkle,
  IconHeadset,
  IconLink,
  IconCheck,
  IconInfo,
  IconClock,
} from '../../ui/icons';
import { PLAN_TITLE as PLAN_TITLES } from '@cover-check/shared';

/**
 * Props for the PlanExploration component.
 */
type PlanExplorationProps = {
  /** Quiz answers from the user's journey (from S1). */
  quizAnswers: import('@cover-check/shared').QuizAnswers;
  /** Callback when the user closes the exploration (goes back or to S9). */
  onClose: () => void;
  /** Optional: if true, show a compact version focused on advisor CTA. */
  compact?: boolean;
};

/**
 * Render a single plan card with inline details.
 */
function PlanCard({
  plan,
  turtlemintPick,
  onTalkToAdvisor,
  onViewOnTurtlemint,
  isExpanded,
  setIsExpanded,
}: {
  plan: PlanRec;
  turtlemintPick: TurtlemintPick;
  onTalkToAdvisor: () => void;
  onViewOnTurtlemint: (type: PlanType) => void;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
}) {
  const pickFeatures = turtlemintPick.insurer
    ? [`${turtlemintPick.insurer} ${turtelmintPick.product ?? ''}`.trimStart()]
    : [];

  // Show starting price only when Turtlemint pick is fully approved
  const priceSection = turtelmintPick.startingPriceInr && turtelmintPick.priceNote
    ? (
      <>
        <p className="plan-card__price">
          From ₹{+(turtelmintPick.startingPriceInr / 100_000).toFixed(1)} L/{turtelmintPick.per}
          {turtelmintPick.priceNote ? ` — ${turtelmintPick.priceNote}` : ''}
        </p>
      </>
    )
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTalkToAdvisor}
      onKeyDown={(e) => e.key === 'Enter' && onTalkToAdvisor()}
      className="plan-card transition-colors"
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card, 14px)',
        background: 'var(--canvas, #F6F8F7)',
        padding: '20px',
        marginBottom: '12px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      <h3 className="plan-card__title plan-card__title--{isExpanded ? 'expanded' : 'compact'}">
        {plan.title}
        {isExpanded && (
          <span className="plan-card__type-icon">
            <IconSparkle size={12} />
          </span>
        )}
      </h3>

      <p className="plan-card__tagline">
        {oneLine(plan.tagline)}
      </p>

      <ul className="plan-card__features">
        {plan.points.map((point, i) => (
          <li key={i} className="plan-card__feature">
            <IconCheck size={14} className="plan-card__check" />
            {point}
          </li>
        ))}
      </ul>

      {priceSection}

      <div className="plan-card__actions">
        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
          }}
          className="plan-card__toggle"
          aria-label={isExpanded ? 'Collapse plan details' : 'Expand plan details'}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>

        <button
          onClick={onTalkToAdvisor}
          className="plan-card__talk-advisor"
          aria-label="Talk to advisor about this plan"
        >
          <IconHeadset size={16} /> Talk to advisor
        </button>

        <button
          onClick={() => onViewOnTurtlemint(plan.type)}
          className="plan-card__view-turtlemint"
          aria-label="View this plan on Turtlemint"
        >
          View on Turtlemint
        </button>
      </div>
    </div>
  );
}

/**
 * Main PlanExploration component.
 *
 * Displays plan types that fit the user's quiz answers in an in-product
 * exploration view. Shows features, starting prices (when Turtlemint picks
 * are approved with source evidence), and provides a "Talk to advisor" CTA
 * that integrates with the existing handoff scheduling flow.
 */
export function PlanExploration({
  quizAnswers,
  onClose,
  compact = false,
}: PlanExplorationProps) {
  const { go } = useFlow();

  // Get plan recommendations based on quiz answers
  const planRecs = recommendPlans(quizAnswers);

  // Get Turtlemint picks for each plan type (only when fully approved)
  const turtlemintPicks = useMemo(() => {
    const picks: Record<PlanType, TurtlemintPick> = {};
    planRecs.forEach((rec) => {
      picks[rec.type] = getApprovedTurtlemintPick(rec.type);
    });
    return picks;
  }, [planRecs]);

  // Handle "Talk to advisor" for a specific plan type
  const handleTalkToAdvisor = useCallback(
    (planType: PlanType) => {
      // Navigate to S9 (advisor scheduling screen)
      // The existing S9 form will handle the topic; we can pre-fill context
      go('S9', {
        replace: true,
      });
    },
    [go]
  );

  // Handle "View on Turtlemint" - open in new tab for transparency
  const handleViewOnTurtlemint = useCallback(
    (planType: PlanType) => {
      // Get the plan page URL from planCatalog
      const planPage = PLAN_PAGES[planType];
      if (planPage) {
        // Open in new tab with UTM parameters
        const url = `${planPage}${planPage.includes('?') ? '&' : '?'}utm_source=whatsapp&utm_medium=cover_check&utm_campaign=cover_fest&utm_content=plan_view&utm_id=${planType}`;
        // For now, just close this exploration and let the caller handle it
        // In a full implementation, this would open window.open(url, '_blank')
        onClose();
      } else {
        onClose();
      }
    },
    [onClose]
  );

  // Close exploration and callback
  const closeExploration = useCallback(() => {
    onClose();
    // Reset any expanded state
  }, [onClose]);

  return (
    <div
      className="plan-exploration max-w-2xl mx-auto space-y-4 p-4"
      style={{
        maxHeight: '90vh',
        overflowY: 'auto',
        background: 'var(--canvas, #F6F8F7)',
      }}
    >
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-primary">
            {compact
              ? 'Your cover plan'
              : 'Plans that fit your cover check'}
          </h2>
          <button
            onClick={onClose}
            className="plan-exploration__close"
            aria-label="Close plan exploration"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Based on your answers, here are plan types that may suit your needs.
        </p>
      </header>

      {/* Plan cards section */}
      <section className="space-y-3">
        {planRecs.map((plan) => {
          const pick = turtelmintPicks[plan.type];
          const hasApprovedPick =
            pick.insurer !== null &&
            pick.product !== null &&
            pick.startingPriceInr !== null &&
            pick.approvedForRecommendations === true;

          return (
            <PlanCard
              key={plan.type}
              plan={plan}
              turtlemintPick={pick}
              onTalkToAdvisor={() => handleTalkToAdvisor(plan.type)}
              onViewOnTurtlemint={handleViewOnTurtlemint}
              isExpanded={compact ? false : true} // Always expanded in compact mode
              setIsExpanded={setIsExpanded}
            />
          );
        })}

        {/* CTA section - always visible */}
        <div className="pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <button
            onClick={handleTalkToAdvisor}
            className="w-full justify-center py-3 px-4 text-base font-medium
              transition-colors hover:background-primary
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary"
            style={{
              background: 'var(--primary, #009F69)',
              color: 'var(--on-primary, #FFFFFF)',
            }}
          >
            <IconHeadset size={18} className="mr-2" />
            Talk to advisor about my cover plan
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Helper: get plan type label from plan type
 */
function getPlanTypeLabel(type: PlanType): string {
  const labels: Record<PlanType, string> = {
    family_floater: 'Family Floater',
    individual: 'Personal Plan',
    senior_citizen: 'Senior Citizen Plan',
    super_top_up: 'Super Top-up',
    critical_illness: 'Critical Illness Cover',
    term_life: 'Term Life Insurance',
    compare_quotes: 'Compare Quotes',
    no_room_cap: 'Plan Without Room Rent Cap',
  };
  return labels[type] || 'Plan';
}