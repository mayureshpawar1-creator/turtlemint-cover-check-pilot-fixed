/** Flow state for one person's journey. Screens read and update it through useFlow(). */
import { createContext, useCallback, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Attribution, Bootstrap, CoverSummary, Door, LandingCopy, Language, PlanType, QuizAnswers, Readout, ScreenId, Slot } from '@cover-check/shared';
import type { CoverCheckApi } from '../api/types';
import { useEngagement } from '../hooks/useEngagement';


export type Screen = ScreenId | 'BOOT' | 'ERROR';
export type NextAction = 'policy' | 'advisor' | 'plans' | 'summary';

export interface FlowState {
  screen: Screen;
  history: Screen[];
  door: Door;
  language: Language;
  maskedMobile: string;
  mobileVerified: boolean;
  slots: Slot[];
  sessionId: string | null;
  answers: QuizAnswers;
  readout: Readout | null;
  captured: { firstName: string; city: string | null } | null;
  /** v2: set only after the person previews and sends (S9b). */
  summarySentAt: string | null;
  /** v2: checklist boxes the person ticked on S7. */
  marks: string[];
  /** v2: plan they asked an advisor about from S9a / U7 — pre-fills the call form. */
  advisorContext: { type: PlanType; title: string } | null;
  /** Where to continue after S8 when a screen needed name + number first. */
  returnTo: Screen | null;
  /** Which report card to open first (e.g. 'plain' from the U6 "in plain words" link). */
  startCard?: string | null;
  result: { action: NextAction; slotLabel?: string; callLanguage?: Language; queued: boolean; at: string } | null;
  docIds: string[];
  summary: CoverSummary | null;
  /** 1.3: campaign of this visit (tags outbound links) and the variant's landing copy, if any. */
  attribution: Attribution;
  landing: LandingCopy | null;
  fatal?: string;
}

type Action =
  | { type: 'boot'; boot: Bootstrap & { slots: Slot[] } }
  | { type: 'go'; screen: Screen; replace?: boolean }
  | { type: 'back' }
  | { type: 'patch'; patch: Partial<FlowState> }
  | { type: 'reset'; state: FlowState };

export const initialFlow = (door: Door = 'check'): FlowState => ({
  screen: 'BOOT', history: [], door, language: 'en', maskedMobile: '', mobileVerified: false, slots: [], sessionId: null,
  answers: {}, readout: null, captured: null, summarySentAt: null, marks: [], advisorContext: null, returnTo: null, result: null, docIds: [], summary: null,
  attribution: { campaignId: null, variantId: null, channel: null }, landing: null,
});

function reducer(s: FlowState, a: Action): FlowState {
  switch (a.type) {
    case 'boot':
      return { ...s, screen: 'S0', door: a.boot.door, language: a.boot.language, maskedMobile: a.boot.maskedMobile,
        mobileVerified: a.boot.mobileVerified, slots: a.boot.slots, sessionId: a.boot.sessionId, answers: a.boot.answers,
        attribution: a.boot.attribution ?? { campaignId: null, variantId: null, channel: null }, landing: a.boot.landing ?? null };
    case 'go':
      if (a.screen === s.screen) return s;
      return { ...s, screen: a.screen, history: a.replace ? s.history : [...s.history, s.screen].slice(-30) };
    case 'back': {
      const prev = s.history[s.history.length - 1];
      return prev ? { ...s, screen: prev, history: s.history.slice(0, -1) } : s;
    }
    case 'patch':
      return { ...s, ...a.patch };
    case 'reset':
      return a.state;
  }
}

interface Ctx {
  s: FlowState;
  api: CoverCheckApi;
  go(screen: Screen, opts?: { replace?: boolean }): void;
  back(): void;
  patch(p: Partial<FlowState>): void;
  dispatch: Dispatch<Action>;
  engagement: ReturnType<typeof useEngagement>;
}
const FlowCtx = createContext<Ctx | null>(null);

export function FlowProvider({ api, initial, children }: { api: CoverCheckApi; initial?: FlowState; children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, initial ?? initialFlow());

  // Initialize engagement hook
  const engagement = useEngagement(s, api);
  const { trackScreenEntry, trackScreenExit } = engagement;

  // Enhanced go function with engagement tracking
  const go = useCallback((screen: Screen, opts?: { replace?: boolean }) => {
    // Track exit from current screen
    if (s.screen && typeof s.screen === 'string' && /^[SU]\d/.test(s.screen)) {
      trackScreenExit(s.screen as ScreenId);
    }

    // Navigate to new screen
    dispatch({ type: 'go', screen, replace: opts?.replace });

    // Track entry to new screen
    if (typeof screen === 'string' && /^[SU]\d/.test(screen)) {
      trackScreenEntry(screen as ScreenId);
      // Still send basic screen_viewed event for backward compatibility
      api.event('screen_viewed', screen as ScreenId);
    }
  }, [api, s.screen, dispatch, trackScreenEntry, trackScreenExit]);

  const back = useCallback(() => {
    // Track exit from current screen
    if (s.screen && typeof s.screen === 'string' && /^[SU]\d/.test(s.screen)) {
      trackScreenExit(s.screen as ScreenId);
    }

    const prev = s.history[s.history.length - 1];
    if (prev) {
      dispatch({ type: 'back' });
      // Track entry to previous screen
      if (typeof prev === 'string' && /^[SU]\d/.test(prev)) {
        trackScreenEntry(prev as ScreenId);
        api.event('screen_viewed', prev as ScreenId);
      }
    }
  }, [s.screen, s.history, dispatch, trackScreenEntry, trackScreenExit]);

  const patch = useCallback((p: Partial<FlowState>) => dispatch({ type: 'patch', patch: p }), []);
  const value = useMemo(() => ({
    s,
    api,
    go,
    back,
    patch,
    dispatch,
    engagement // Expose engagement hook for use in screens
  }), [s, api, go, back, patch, dispatch, engagement]);
  return <FlowCtx.Provider value={value}>{children}</FlowCtx.Provider>;
}

export function useFlow(): Ctx {
  const c = useContext(FlowCtx);
  if (!c) throw new Error('useFlow outside FlowProvider');
  return c;
}

/** Normalises errors from HttpApi and MockApi into { code, message, details }. */
export const errorOf = (e: unknown): { code: string; message: string; details?: any } => {
  const b = (e as { body?: { code: string; message: string; details?: unknown } })?.body;
  return b ?? { code: 'INTERNAL', message: 'Something went wrong. Your answers are saved — please try again.' };
};
