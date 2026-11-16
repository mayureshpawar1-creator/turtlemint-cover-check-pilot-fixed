/**
 * Engagement tracking utilities for calculating user engagement scores
 * and identifying hot leads for caller insights.
 */
import type { QuizAnswers } from './types';
import type { EventName, ScreenId } from './enums';

export type { ScreenId };

/**
 * Expected time (in milliseconds) for each screen based on complexity
 */
const EXPECTED_SCREEN_TIME_MS: Record<string, number> = {
  S0: 15000,   // Landing/welcome
  S1: 20000,   // Door selection
  S2: 15000,   // Language
  S3: 20000,   // Number verification
  S4: 25000,   // Quiz start
  S5: 30000,   // Quiz questions
  S6: 20000,   // Quiz completion
  S7: 40000,   // Advice (main engagement point)
  S7d: 60000,  // Detailed breakdown
  S8: 15000,   // Capture
  S9: 15000,   // Next step selection
  S9a: 45000,  // Plans/view recommendations
  S9b: 30000,  // Summary preview
  S10: 10000,  // Confirmation
  U1: 15000,   // Upload start
  U2: 20000,   // OTP send
  U3: 15000,   // OTP verify
  U4: 20000,   // PIN code
  U5: 25000,   // Capture
  U6: 50000,   // Policy analysis
  U7: 45000,   // Recommendations from policy
  U8: 10000    // Confirmation
};

/**
 * Weight factors for engagement score calculation
 */
const ENGAGEMENT_WEIGHTS = {
  time: 0.3,
  interaction: 0.25,
  progression: 0.2,
  intent: 0.15,
  recency: 0.1
};

/**
 * Calculate engagement score based on tracked events and session data
 */
export function calculateEngagementScore(
  events: EngagementEvent[],
  sessionStartTime: number,
  currentTime: number = Date.now()
): number {
  if (events.length === 0) return 0;

  // Time spent weight
  const timeSpent = currentTime - sessionStartTime;
  const expectedTime = Object.values(EXPECTED_SCREEN_TIME_MS).reduce((sum, time) => sum + time, 0);
  const timeWeight = Math.min(100, (timeSpent / expectedTime) * 100) * ENGAGEMENT_WEIGHTS.time;

  // Interaction weight
  const interactionEvents = events.filter(e =>
    e.name !== 'screen_viewed'
  );
  const interactionWeight = Math.min(100, interactionEvents.length * 5) * ENGAGEMENT_WEIGHTS.interaction;

  // Progression weight (how far they got in the flow)
  const screensVisited = new Set(
    events
      .filter(e => e.name === 'screen_viewed')
      .map(e => e.screenId)
      .filter((screenId): screenId is string => screenId !== undefined)
  );
  const maxScreenValue = getScreenProgressValue(Array.from(screensVisited).sort()[0] || 'S0');
  const progressionWeight = Math.min(100, (maxScreenValue / 20) * 100) * ENGAGEMENT_WEIGHTS.progression;

  // Intent weight (explicit interest signals)
  const intentEvents = events.filter(e =>
    ['call_requested', 'next_action_selected', 'recommendation_clicked', 'summary_previewed'].includes(e.name)
  );
  const intentWeight = Math.min(100, intentEvents.length * 15) * ENGAGEMENT_WEIGHTS.intent;

  // Recency weight (recent activity gets higher score)
  const lastEventTime = Math.max(...events.map(e => e.timestamp));
  const minutesSinceLastEvent = (currentTime - lastEventTime) / 60000;
  const recencyWeight = Math.max(0, 100 - (minutesSinceLastEvent * 2)) * ENGAGEMENT_WEIGHTS.recency; // Decay over 50 minutes

  return Math.min(100, Math.max(0,
    timeWeight + interactionWeight + progressionWeight + intentWeight + recencyWeight
  ));
}

/**
 * Get numerical progress value for a screen (higher = further in flow)
 */
function getScreenProgressValue(screenId: string): number {
  const screenOrder: Record<string, number> = {
    // Quiz flow
    S0: 1, S1: 2, S2: 3, S3: 4, S4: 5, S5: 6, S6: 7, S7: 8, S7d: 9, S8: 10, S9: 11, S9a: 12, S9b: 13, S10: 14,
    // Upload flow
    U1: 15, U2: 16, U3: 17, U4: 18, U5: 19, U6: 20, U7: 21, U8: 22
  };
  return screenOrder[screenId] || 0;
}

/**
 * Identify if a user is a hot lead based on engagement and behavior
 */
export function isHotLead(
  events: EngagementEvent[],
  engagementScore: number,
  currentTime: number = Date.now()
): { isHotLead: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check for explicit intent signals
  const hasExplicitIntent = events.some(e =>
    ['call_requested', 'next_action_selected'].includes(e.name) &&
    e.props?.['action'] === 'advisor'
  );

  if (hasExplicitIntent) {
    reasons.push('Requested advisor callback');
  }

  // Check for detailed recommendation engagement
  const detailedRecommendationViews = events.filter(e =>
    e.name === 'recommendation_engaged' &&
    e.props?.['engagementLevel'] === 'detailed'
  ).length;

  if (detailedRecommendationViews >= 2) {
    reasons.push(`Viewed ${detailedRecommendationViews} recommendations in detail`);
  }

  // Check for significant policy analysis time
  const policyAnalysisTime = events
    .filter(e => e.name === 'policy_analysis_viewed')
    .reduce((sum, e) => sum + Number(e.props?.['timeSpentMs'] || 0), 0);

  if (policyAnalysisTime > 120000) { // More than 2 minutes
    reasons.push(`Spent ${Math.round(policyAnalysisTime / 1000)} minutes on policy analysis`);
  }

  // Check for multiple checklist engagements
  const checklistMarked = events.filter(e =>
    e.name === 'checklist_marked' && e.props?.['marked'] === true
  ).length;

  if (checklistMarked >= 3) {
    reasons.push(`Engaged with ${checklistMarked} checklist items`);
  }

  // Check recent high engagement
  const recentEvents = events.filter(
    e => (currentTime - e.timestamp) < 1800000 // Last 30 minutes
  );

  if (recentEvents.length >= 5 && engagementScore > 60) {
    reasons.push('High recent engagement');
  }

  // Check completion with good engagement
  const hasCompletedFlow = events.some(e =>
    e.name === 'quiz_completed' || e.name === 'upload_completed'
  );

  if (hasCompletedFlow && engagementScore > 70) {
    reasons.push('Completed flow with high engagement');
  }

  const isHotLeadResult = engagementScore > 70 || reasons.length >= 2;

  return { isHotLead: isHotLeadResult, reasons };
}

/**
 * Generate caller insights summary for a user
 */
export function generateCallerInsights(
  events: EngagementEvent[],
  engagementScore: number,
  quizAnswers: QuizAnswers | null = null
): string {
  const insights: string[] = [];

  // Count recommendation views
  const recommendationsViewed = events.filter(e =>
    e.name === 'plan_detail_viewed' || e.name === 'recommendation_engaged'
  ).length;

  if (recommendationsViewed > 0) {
    insights.push(`Viewed ${recommendationsViewed} recommended plans`);
  }

  // Calculate policy analysis time
  const policyAnalysisTime = events
    .filter(e => e.name === 'policy_analysis_viewed')
    .reduce((sum, e) => sum + Number(e.props?.['timeSpentMs'] || 0), 0);

  if (policyAnalysisTime > 60000) { // More than 1 minute
    insights.push(`Spent ${Math.round(policyAnalysisTime / 60000)} minutes on policy analysis`);
  }

  // Check for explicit intent
  const hasAdvisorRequest = events.some(e =>
    e.name === 'call_requested' && e.props?.['action'] === 'advisor'
  );

  if (hasAdvisorRequest) {
    insights.push('Requested advisor callback');
  }

  // Count checklist interactions
  const checklistInteractions = events.filter(e =>
    e.name === 'checklist_marked'
  ).length;

  if (checklistInteractions > 0) {
    insights.push(`Engaged with ${checklistInteractions} educational points`);
  }

  // Determine hot lead status
  const { isHotLead: isHot, reasons } = isHotLead(events, engagementScore);

  if (isHot) {
    insights.push(`🔥 HOT LEAD: ${reasons.join('; ')}`);
  } else {
    insights.push(`Engagement score: ${Math.round(engagementScore)}/100`);
  }

  return insights.filter(Boolean).join('. ');
}

/**
 * Export data format for caller Excel sheets
 */
export interface CallerInsightRow {
  user_id: string;
  timestamp: string; // ISO timestamp of last engagement
  flow_step: string; // Current/farthest screen
  engagement_score: number; // 0-100
  time_spent_total_ms: number;
  screens_visited: number;
  actions_taken: string; // Semicolon-separated
  recommendations_viewed: number;
  recommendations_detailed_views: number;
  policy_analysis_time_ms: number;
  checklist_items_marked: number;
  explicit_intent: string; // e.g., "advisor_callback"
  hot_lead_reason: string;
  last_interaction_type: string;
  conversation_context: string; // Summary for caller
}

/**
 * Convert engagement events to caller insight row
 */
export function eventsToCallerInsight(
  userId: string,
  events: EngagementEvent[],
  quizAnswers: QuizAnswers | null = null
): CallerInsightRow {
  if (events.length === 0) {
    return {
      user_id: userId,
      timestamp: new Date().toISOString(),
      flow_step: 'S0',
      engagement_score: 0,
      time_spent_total_ms: 0,
      screens_visited: 0,
      actions_taken: '',
      recommendations_viewed: 0,
      recommendations_detailed_views: 0,
      policy_analysis_time_ms: 0,
      checklist_items_marked: 0,
      explicit_intent: '',
      hot_lead_reason: 'No engagement detected',
      last_interaction_type: 'none',
      conversation_context: 'User has not engaged with the funnel yet.'
    };
  }

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const lastEvent = sortedEvents[sortedEvents.length - 1]!;

  // Calculate engagement score
  const engagementScore = calculateEngagementScore(sortedEvents,
    sortedEvents[0]!.timestamp,
    lastEvent.timestamp
  );

  // Determine flow step (furthest screen reached)
  const screens = new Set(
    sortedEvents
      .filter(e => e.name === 'screen_viewed')
      .map(e => e.screenId)
      .filter((id): id is string => id !== undefined)
  );
  const flowStep = Array.from(screens).sort(
    (a, b) => getScreenProgressValue(b) - getScreenProgressValue(a)
  )[0] || 'S0';

  // Calculate total time spent
  const timeSpent = lastEvent.timestamp - sortedEvents[0]!.timestamp;

  // Count unique screens visited
  const screens_visited = screens.size;

  // Extract actions taken
  const actions = sortedEvents
    .filter(e => e.name !== 'screen_viewed')
    .map(e => e.name)
    .join('; ');

  // Count recommendation views
  const recommendations_viewed = sortedEvents.filter(e =>
    e.name === 'plan_detail_viewed' || e.name === 'recommendation_engaged'
  ).length;

  // Count detailed recommendation views
  const recommendations_detailed_views = sortedEvents.filter(e =>
    e.name === 'recommendation_engaged' && e.props?.['engagementLevel'] === 'detailed'
  ).length;

  // Calculate policy analysis time
  const policy_analysis_time_ms = sortedEvents
    .filter(e => e.name === 'policy_analysis_viewed')
    .reduce((sum, e) => sum + Number(e.props?.['timeSpentMs'] || 0), 0);

  // Count checklist items marked
  const checklist_items_marked = sortedEvents.filter(e =>
    e.name === 'checklist_marked' && e.props?.['marked'] === true
  ).length;

  // Check for explicit intent
  const explicit_intent_event = sortedEvents.find(e =>
    e.name === 'call_requested' && e.props?.['action'] === 'advisor'
  );
  const explicit_intent = explicit_intent_event ? 'advisor_callback' : '';

  // Determine hot lead status and reason
  const { isHotLead: isHot, reasons } = isHotLead(sortedEvents, engagementScore, lastEvent!.timestamp);
  const hot_lead_reason = isHot ? reasons.join('; ') : 'Below hot lead threshold';

  // Get last interaction type
  const last_interaction_type = lastEvent!.name;

  // Generate conversation context
  const conversation_context = generateCallerInsights(sortedEvents, engagementScore, quizAnswers);

  return {
    user_id: userId,
    timestamp: new Date(lastEvent!.timestamp).toISOString(),
    flow_step: flowStep,
    engagement_score: Math.round(engagementScore),
    time_spent_total_ms: timeSpent,
    screens_visited: screens_visited,
    actions_taken: actions,
    recommendations_viewed: recommendations_viewed,
    recommendations_detailed_views: recommendations_detailed_views,
    policy_analysis_time_ms: policy_analysis_time_ms,
    checklist_items_marked: checklist_items_marked,
    explicit_intent: explicit_intent,
    hot_lead_reason: hot_lead_reason,
    last_interaction_type: last_interaction_type,
    conversation_context: conversation_context
  };
}

/**
 * Types for engagement events
 */
export interface EngagementEvent {
  name: EventName;
  screenId?: string;
  timestamp: number; // Unix timestamp in milliseconds
  props: Record<string, string | number | boolean | null>;
}