# User Engagement Tracking Design for Caller Insights

## Overview
This document outlines the design for enhanced user engagement tracking to provide actionable insights for callers. The system will track detailed user interactions throughout the Cover Check funnel to identify "hot leads" and provide context for meaningful conversations.

## Current State
The existing system already tracks basic events through:
- `api.event(name, screenId, props)` in frontend
- Event logging in backend services (valueService.ts)
- Predefined EVENT_NAMES in shared/src/enums.ts

## Enhancement Goals
1. Track detailed engagement metrics for caller insights
2. Calculate engagement scores to identify hot leads
3. Provide exportable data for caller Excel sheets
4. Maintain compatibility with existing event system

## New Event Types and Properties

### 1. Enhanced Screen Engagement Events
Track time spent and interaction depth on key screens:

```typescript
// Existing event with enhanced props
api.event('screen_engaged', screenId, {
  timeSpentMs: number,           // Actual time spent on screen
  engagementDepth: number,       // 0-100% of content interacted with
  actionsTaken: string[],        // Specific actions on this screen
  isReturnVisit: boolean         // Whether user has seen this screen before
})

// Applied to key screens:
// S7 (Advice), S9a/Plans, S9b/Summary, U6/U7 (Policy analysis)
// ```

### 2. Content Interaction Events
Track specific interactions with educational/content elements:

```typescript
// When user expands/collapses detailed information
api.event('content_toggle', screenId, {
  elementId: string,             // ID of the toggled element
  isExpanded: boolean,           // Whether expanded or collapsed
  sectionName: string            // Human-readable section name
})

// When user views specific plan details
api.event('plan_detail_viewed', 'S9a', {
  planId: string,                // ID of the plan being viewed
  planName: string,              // Name of the plan
  viewedFields: string[]         // Which plan details were viewed (premium, coverage, etc.)
})

// When user uses comparison tools
api.event('tool_used', screenId, {
  toolType: string,              // 'comparison', 'calculator', 'glossary'
  toolId: string,                // Specific tool identifier
  action: string                 // 'opened', 'used', 'closed'
})
```

### 3. Policy Analysis Engagement (Upload Flow)
Track deep engagement with policy analysis:

```typescript
// When user views policy analysis details
api.event('policy_analysis_viewed', 'U6' | 'U7', {
  analysisType: string,          // 'gaps', 'benefits', 'cost_analysis', 'recommendations'
  timeSpentMs: number,           // Time spent on this analysis
  insightsViewed: string[]       // Specific insights that were viewed
})

// When user interacts with gap analysis
api.event('gap_insight_interacted', 'U6', {
  gapType: string,               // 'room_rent', 'co_pay', 'sub_limit', 'waiting_period'
  action: string,                // 'viewed', 'explained', 'questioned'
  clarityLevel: number           // 0-100% understanding (based on time spent/interaction)
})
```

### 4. Recommendation Engagement
Track detailed engagement with product recommendations:

```typescript
// When user views recommendation details
api.event('recommendation_engaged', 'S9a' | 'S9b', {
  recommendationId: string,      // ID of the recommendation
  engagementLevel: string,       // 'brief', 'detailed', 'deep'
  timeSpentMs: number,           // Time spent reviewing this recommendation
  actionsTaken: string[],        // 'viewed_details', 'compared', 'saved', 'shared'
  interests: string[]            // Specific aspects that interested them (price, coverage, etc.)
})

// When user compares recommendations
api.event('recommendations_compared', 'S9a', {
  comparedCount: number,         // Number of recommendations compared
  comparisonCriteria: string[],  // What they compared (price, coverage, benefits)
  preferredOption: string        // Which option they leaned toward
})
```

### 5. Drop-off and Exit Tracking
Track when and why users leave the flow:

```typescript
// When user navigates away or shows exit intent
api.event('exit_intent', screenId, {
  exitType: string,              // 'navigation', 'timeout', 'explicit_leave'
  nextAction: string | null,     // What they said they'd do next
  reason: string | null,         // Stated reason for leaving
  engagementScore: number        // Their engagement score at point of exit
})

// Session timeout or inactivity
api.event('session_idle', null, {
  idleDurationMs: number,        // How long they were idle
  lastScreen: string,            // Last screen they were on
  engagementScore: number        // Engagement score when idle started
})
```

## Engagement Scoring System

### Engagement Score Calculation
Calculate a 0-100 engagement score based on:

```typescript
const engagementScore = (
  timeWeight * 0.3 +           // Time spent relative to expected
  interactionWeight * 0.25 +   // Depth and breadth of interactions
  progressionWeight * 0.2 +    // Flow progression and completion likelihood
  intentWeight * 0.15 +        // Explicit interest indicators
  recencyWeight * 0.1          // Recent activity weighting
)

// Where each weight is calculated as:
// timeWeight: min(100, actualTimeMs / expectedTimeMs * 100)
// interactionWeight: based on number and depth of interactions
// progressionWeight: based on screens completed vs expected
// intentWeight: based on explicit actions like advisor requests, plan views
// recencyWeight: exponential decay based on time since last action
```

### Hot Lead Identification
Identify hot leads based on:

1. **Engagement Score Threshold**: Score > 70
2. **Recent Activity**: Engagement within last 30 minutes
3. **Intent Signals**:
   - Requested advisor callback
   - Viewed 2+ recommendations in detail
   - Spent >2 minutes on policy analysis
   - Marked multiple checklist items as understood
4. **Completion Progression**: Reached S7 (advice) or beyond with high engagement

## Data Structure for Caller Insights

### Excel Export Format
Create a structured dataset for caller insights with columns:

| Column | Description | Example |
|--------|-------------|---------|
| user_id | Unique identifier for the user | "lead_123abc" |
| timestamp | Last engagement timestamp | "2026-10-19 14:30:22" |
| flow_step | Current/farthest screen reached | "S9a" |
| engagement_score | Calculated engagement score (0-100) | 85 |
| time_spent_total_ms | Total time spent in flow | 185000 |
| screens_visited | Number of unique screens visited | 8 |
| actions_taken | Semicolon-separated list of actions | "viewed_recommendations;compared_plans;read_policy_analysis" |
| recommendations_viewed | Number of recommendations viewed | 3 |
| recommendations_detailed_views | Number of recommendations viewed in detail | 2 |
| policy_analysis_time_ms | Time spent on policy analysis | 120000 |
| checklist_items_marked | Number of checklist items marked | 4 |
| explicit_intent | Expressed interest in next steps | "advisor_callback" |
| hot_lead_reason | Why this is considered a hot lead | "High engagement + advisor request" |
| last_interaction_type | Type of last interaction | "plan_detail_viewed" |
| conversation_context | Summary for caller | "User viewed 3 recommended plans, spent 4m on policy analysis, requested advisor callback" |

### Real-time Hot Lead Indicators
For immediate caller attention, flag users with:
- Engagement score > 80 + explicit intent (advisor request)
- Engagement score > 70 + viewed 3+ recommendations + spent >3min on policy analysis
- Engagement score > 60 + completed flow (reached S10/U8) + high interaction depth

## Implementation Approach

### Frontend Enhancements
1. Enhance the `useFlow` hook or create an `useEngagement` hook to track:
   - Screen entry/exit times
   - Interaction events
   - Engagement metrics per screen
2. Wrap existing event calls with enhanced tracking
3. Add new event types for deeper engagement tracking

### Backend Enhancements
1. Extend event logging to store enhanced engagement properties
2. Create engagement score calculation service
3. Create hot lead identification service
4. Add API endpoints for caller insights/export

### Data Storage
1. Extend existing events table to store engagement-specific props
2. Consider creating aggregated engagement summary tables for performance
3. Maintain compatibility with existing event schema

## Integration Points

### In flow.tsx (Frontend)
Enhance the `go` function to track screen engagement:
```typescript
const go = useCallback((screen: Screen, opts?: { replace?: boolean }) => {
  // Track exit from current screen
  if (currentScreen && typeof currentScreen === 'string') {
    trackScreenExit(currentScreen);
  }

  dispatch({ type: 'go', screen, replace: opts?.replace });

  // Track entry to new screen
  if (typeof screen === 'string' && /^[SU]\d/.test(screen)) {
    trackScreenEntry(screen as ScreenId);
    api.event('screen_viewed', screen as ScreenId);
  }
}, [api]);
```

### In valueService.ts (Backend)
Enhance event logging to compute engagement signals:
```typescript
// When logging events, also update engagement metrics
await d.repos.events.log({
  name: 'recommendation_clicked',
  leadId: ctx.leadId,
  props: { type, origin, target }
});

// Update engagement score
await d.repos.engagement.updateScore(ctx.leadId, {
  eventName: 'recommendation_clicked',
  props: { type, origin, target },
  timestamp: new Date()
});
```

## Validation and Testing
1. Unit tests for engagement score calculation
2. Integration tests for event tracking
3. Manual verification of hot lead identification
4. Caller feedback on insight usefulness
5. Excel export format validation

## Compatibility Notes
- All enhancements are additive to existing event system
- No changes to existing EVENT_NAMES required (we'll add new ones)
- Existing integrations should continue to work unchanged
- Backward compatibility maintained for all existing event consumers