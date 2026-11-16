import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngagementEvent, ScreenId } from '@cover-check/shared/src/engagement';
import { toClientEvent, type EventName } from '@cover-check/shared';
import { calculateEngagementScore, isHotLead as calculateHotLead, generateCallerInsights, eventsToCallerInsight } from '@cover-check/shared/src/engagement';

/**
 * Hook for tracking user engagement throughout the funnel
 * Provides automatic screen timing, engagement scoring, and hot lead detection
 */
export function useEngagement(
  flowState: { screen: ScreenId | 'BOOT' | 'ERROR' },
  api: import('../api/types').CoverCheckApi
) {
  const [engagementEvents, setEngagementEvents] = useState<EngagementEvent[]>([]);
  const [engagementScore, setEngagementScore] = useState<number>(0);
  const [isHotLead, setIsHotLead] = useState<boolean>(false);
  const [hotLeadReasons, setHotLeadReasons] = useState<string[]>([]);

  // Refs for tracking screen timing
  const screenEntryTimeRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(Date.now());

  // Initialize engagement tracking on mount
  useEffect(() => {
    sessionStartTimeRef.current = Date.now();

    // Track initial screen view
    if (flowState.screen && typeof flowState.screen === 'string' && /^[SU]\d/.test(flowState.screen)) {
      trackScreenEntry(flowState.screen as ScreenId);
    }
  }, [flowState.screen]);

  // Update engagement score when events change
  useEffect(() => {
    if (engagementEvents.length > 0) {
      const score = calculateEngagementScore(
        engagementEvents,
        sessionStartTimeRef.current,
        Date.now()
      );
      setEngagementScore(score);

      const { isHotLead: hotLead, reasons } = calculateHotLead(
        engagementEvents,
        score,
        Date.now()
      );
      setIsHotLead(hotLead);
      setHotLeadReasons(reasons);
    }
  }, [engagementEvents]);

  // Track screen entry. The flow (state/flow.tsx) sends the single `screen_viewed` event; this only starts the timer.
  const trackScreenEntry = useCallback((_screenId: ScreenId) => {
    screenEntryTimeRef.current = Date.now();
  }, []);

  // Track screen exit
  const trackScreenExit = useCallback((screenId: ScreenId) => {
    const exitTime = Date.now();
    const timeSpent = exitTime - screenEntryTimeRef.current;

    if (timeSpent > 0) {
      // One exit event with the time spent (previously a second, duplicate `screen_viewed`)
      api.event('screen_exited', screenId, { timeSpentMs: timeSpent });

      // Add to local events for scoring
      setEngagementEvents(prev => [
        ...prev,
        {
          name: 'screen_viewed',
          screenId,
          timestamp: exitTime,
          props: {
            timeSpentMs: timeSpent,
            engagementDepth: calculateEngagementDepth(timeSpent, screenId)
          }
        }
      ]);
    }
  }, [api]);

  // Calculate engagement depth based on time spent vs expected
  const calculateEngagementDepth = useCallback((timeSpent: number, screenId: string): number => {
    const expectedTime = EXPECTED_SCREEN_TIME_MS[screenId] || 30000; // Default 30 seconds
    return Math.min(100, (timeSpent / expectedTime) * 100);
  }, []);

  // Track custom engagement events
  const trackEvent = useCallback((eventName: EventName, screenId: ScreenId | undefined, props: Record<string, string | number | boolean | null> = {}) => {
    const timestamp = Date.now();

    // Send to backend: interactions only. Milestones (quiz_completed, call_requested, …) are already recorded by the
    // API; resending them double-counted the funnel. A "next action" click goes as `cta_clicked`.
    const sent = toClientEvent(eventName);
    if (sent) api.event(sent, screenId, props);

    // Store locally for scoring
    setEngagementEvents(prev => [
      ...prev,
      {
        name: eventName,
        screenId: screenId ?? undefined,
        timestamp,
        props
      }
    ]);

    // Auto-track screen exit if this is a screen view event - handled by trackScreenEntry/trackScreenExit
  }, [api, trackScreenEntry, trackScreenExit]);

  // Enhanced screen navigation that tracks engagement
  const goWithEngagementTracking = useCallback((screen: string, opts?: { replace?: boolean }) => {
    // Track exit from current screen
    if (flowState.screen && typeof flowState.screen === 'string' && /^[SU]\d/.test(flowState.screen)) {
      trackScreenExit(flowState.screen as ScreenId);
    }

    // Navigate to new screen
    // Note: We would normally call the flow's go function here, but we're enhancing it
    // For now, we'll just track the engagement and let the normal flow handle navigation
    // In a real implementation, this would integrate more deeply with the flow system

    // Track entry to new screen
    if (typeof screen === 'string' && /^[SU]\d/.test(screen)) {
      trackScreenEntry(screen as ScreenId);
    }
  }, [flowState.screen, trackScreenEntry, trackScreenExit]);

  // Get caller insights for this user
  const getCallerInsights = useCallback((userId: string, quizAnswers: any = null) => {
    return eventsToCallerInsight(userId, engagementEvents, quizAnswers);
  }, [engagementEvents]);

  // Get current engagement summary
  const getEngagementSummary = useCallback(() => {
    return {
      engagementScore: Math.round(engagementScore),
      isHotLead,
      hotLeadReasons,
      eventCount: engagementEvents.length,
      sessionDurationMs: Date.now() - sessionStartTimeRef.current,
      lastEvent: engagementEvents[engagementEvents.length - 1] || null
    };
  }, [engagementScore, engagementEvents.length, engagementEvents[engagementEvents.length - 1], hotLeadReasons, isHotLead]);

  return {
    // Engagement metrics
    engagementScore,
    isHotLead,
    hotLeadReasons,

    // Tracking functions
    trackEvent,
    trackScreenEntry,
    trackScreenExit,
    goWithEngagementTracking,

    // Insight functions
    getCallerInsights,
    getEngagementSummary,

    // Raw data
    engagementEvents,
    sessionStartTime: sessionStartTimeRef.current
  };
}

// Expected screen times for engagement depth calculation
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
