/**
 * Enumerations shared by the database, API and UI.
 * Values mirror the data model in the Cover Check funnel spec. Keep in sync with
 * data/migrations/001_init.sql (CREATE TYPE …).
 */

export const DOORS = ['get', 'check', 'company', 'review'] as const;
export type Door = (typeof DOORS)[number];

export const LANGUAGES = ['en', 'hi', 'mr'] as const;
export type Language = (typeof LANGUAGES)[number];

export const SITUATIONS = ['none', 'own', 'group'] as const;
export type Situation = (typeof SITUATIONS)[number];

/** Spec paths: A = no cover yet, B = own/family policy, C = company cover. */
export type Path = 'A' | 'B' | 'C';
export const pathOf = (s: Situation): Path => (s === 'none' ? 'A' : s === 'own' ? 'B' : 'C');

export const MEMBERS = ['self', 'spouse', 'children', 'parents', 'parents_in_law'] as const;
export type Member = (typeof MEMBERS)[number];

/** v3: age as one tap instead of a typed number. Eldest person for B/C, the person themselves for A. */
export const AGE_BANDS = ['18_30', '31_40', '41_50', '51_60', '61p'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** v3 (path A): monthly take-home pay, optional — sizes the cover and the "months of income" chart. */
export const INCOME_BANDS = ['lt25k', '25_50k', '50k_1l', '1_2l', '2lp', 'prefer_not'] as const;
export type IncomeBand = (typeof INCOME_BANDS)[number];

/** v3 (path A): hospital costs differ between metros and other cities. */
export const CITY_TIERS = ['metro', 'other'] as const;
export type CityTier = (typeof CITY_TIERS)[number];

export const PARENTS_AGE_BANDS = ['u60', '60_70', '70p'] as const;
export type ParentsAgeBand = (typeof PARENTS_AGE_BANDS)[number];

export const SUM_INSURED_BANDS = ['lt3', '3_5', '5_10', '10_25', '25p', 'unsure'] as const;
export type SumInsuredBand = (typeof SUM_INSURED_BANDS)[number];

export const FAMILY_IN_GROUP = ['yes', 'only_me', 'unsure'] as const;
export type FamilyInGroup = (typeof FAMILY_IN_GROUP)[number];

export const HEALTH_CONDITION = ['yes', 'no', 'prefer_not'] as const;
export type HealthCondition = (typeof HEALTH_CONDITION)[number];

export const CONDITION_TAGS = ['bp', 'diabetes', 'thyroid', 'heart', 'asthma', 'other'] as const;
export type ConditionTag = (typeof CONDITION_TAGS)[number];

export const POLICY_AGE_BANDS = ['lt1', '1_3', '3_5', '5p', 'unsure'] as const;
export type PolicyAgeBand = (typeof POLICY_AGE_BANDS)[number];

export const JOB_EXIT_COVER = ['own_policy', 'none', 'unsure'] as const;
export type JobExitCover = (typeof JOB_EXIT_COVER)[number];

export const ROOM_RENT_LIMIT = ['limit', 'no_limit', 'unsure'] as const;
export type RoomRentLimit = (typeof ROOM_RENT_LIMIT)[number];

export const TOP_CONCERNS = ['bills', 'parents', 'serious_illness', 'savings', 'other'] as const;
export type TopConcern = (typeof TOP_CONCERNS)[number];

export const RENEWAL_WINDOWS = ['lt1m', '1_3m', '3_12m', 'unsure'] as const;
export type RenewalWindow = (typeof RENEWAL_WINDOWS)[number];

export const YES_NO = ['yes', 'no'] as const;
export type YesNo = (typeof YES_NO)[number];

export const START_TIMING = ['this_month', '1_3m', 'exploring'] as const;
export type StartTiming = (typeof START_TIMING)[number];

/** v5: yearly premium they are comfortable with (shapes the plan, never the amount of cover we suggest). */
export const PREMIUM_COMFORT = ['lt10k', '10_20k', '20_35k', '35kp', 'unsure'] as const;
export type PremiumComfort = (typeof PREMIUM_COMFORT)[number];

/** v5: optional last question. Recorded for the caller only; never changes advice or lead score. */
export const OTHER_PROTECTION_INTEREST = ['yes', 'later', 'no'] as const;
export type OtherProtectionInterest = (typeof OTHER_PROTECTION_INTEREST)[number];

/** v5: why they came, derived from answers (not asked). "Just exploring" falls back to first_time. */
export const INTENTS = ['first_time', 'own_individual', 'own_floater', 'corporate_only', 'corporate_plus_own', 'cover_parents'] as const;
export type Intent = (typeof INTENTS)[number];

export const LEAD_STATES = ['incomplete', 'data_only', 'consented_warm', 'hand_raised'] as const;
export type LeadState = (typeof LEAD_STATES)[number];

export const CONSENT_PURPOSES = [
  'save_answers',
  'whatsapp_summary',
  'contact_call',
  'read_document',
  'share_with_insurer', // VALIDATION REQUIRED — not used in the prototype
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_METHODS = ['button', 'tick', 'otp'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const WITHDRAWN_VIA = ['stop_reply', 'page', 'advisor'] as const;
export type WithdrawnVia = (typeof WITHDRAWN_VIA)[number];

export const REQUESTED_ACTIONS = ['advisor_call', 'callback', 'see_plans', 'summary_only', 'upload_policy'] as const;
export type RequestedAction = (typeof REQUESTED_ACTIONS)[number];

export const TOPICS = ['renewal', 'parents', 'compare', 'claim', 'other'] as const;
export type Topic = (typeof TOPICS)[number];

export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const QUEUES = ['hand_raised', 'warm'] as const;
export type Queue = (typeof QUEUES)[number];

export const DOC_STATUS = ['queued', 'reading', 'ready', 'needs_review', 'failed'] as const;
export type DocStatus = (typeof DOC_STATUS)[number];

export const DOC_FAILURE = ['wrong_password', 'unreadable', 'not_health', 'too_large', 'other'] as const;
export type DocFailure = (typeof DOC_FAILURE)[number];

export const FINDING_ORIGIN = ['quiz', 'document'] as const;
export type FindingOrigin = (typeof FINDING_ORIGIN)[number];

export const FINDING_CATEGORY = ['room_rent', 'waiting', 'renewal', 'sum_insured', 'family', 'other'] as const;
export type FindingCategory = (typeof FINDING_CATEGORY)[number];

/** review = amber, ask = blue ("Worth asking"), info = green ("Fine"). */
export const SEVERITY = ['review', 'ask', 'info'] as const;
export type Severity = (typeof SEVERITY)[number];

export const DISPOSITIONS = ['enquiry_created', 'callback_later', 'not_interested', 'wrong_number', 'do_not_call'] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/** S9a = plans that fit, S9b = summary preview (v2). S7 = one-screen advice, S7d = full breakdown (v3). */
export const SCREEN_IDS = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S7d', 'S8', 'S9', 'S9a', 'S9b', 'S10',
  'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8'] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

/**
 * One event contract (roadmap 1.2). Two kinds, never overlapping:
 *  - SERVER events are business milestones. Only the API records them, inside the same transaction as the change
 *    they describe, so funnel counts can't be inflated or lost by the browser.
 *  - CLIENT events are screen interactions the browser sends to POST /events. The API rejects any other name and
 *    records the rejection in `event_reject` instead of dropping it silently.
 * The database CHECK on event.name is generated from EVENT_NAMES (migration 009); a test fails if they drift.
 */
export const SERVER_EVENT_NAMES = [
  'link_clicked', 'quiz_started', 'answer_submitted', 'quiz_completed', 'readout_viewed', 'capture_submitted',
  'otp_sent', 'otp_verified', 'next_action_selected', 'call_requested', 'plans_viewed', 'consent_withdrawn',
  'upload_started', 'upload_completed', 'extraction_ready', 'facts_confirmed', 'summary_viewed',
  'summary_previewed', 'summary_sent', 'checklist_marked', 'recommendation_shown', 'recommendation_clicked',
] as const;
export const CLIENT_EVENT_NAMES = [
  'landing_viewed', 'screen_viewed', 'screen_exited', 'screen_engaged', 'cta_clicked', 'content_toggle', 'tool_used',
  'card_answered', 'snapshot_viewed', 'point_opened', 'plan_details_opened', 'plan_detail_viewed',
  'policy_health_viewed', 'policy_analysis_viewed', 'recommendation_engaged', 'recommendations_compared',
  'gap_insight_interacted', 'otp_failed', 'question_viewed', 'question_answered', 'question_skipped',
] as const;
export const EVENT_NAMES = [...SERVER_EVENT_NAMES, ...CLIENT_EVENT_NAMES] as const;
export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];
export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];
export type EventName = (typeof EVENT_NAMES)[number];

const SERVER_EVENT_SET: ReadonlySet<string> = new Set(SERVER_EVENT_NAMES);
export const isServerEvent = (name: string): name is ServerEventName => SERVER_EVENT_SET.has(name);

/**
 * What the browser should send for an event a screen tracks. Server milestones are already recorded by the API, so
 * the browser doesn't resend them (null). A screen's "next action" click is a UI interaction, sent as `cta_clicked`.
 */
export function toClientEvent(name: EventName): ClientEventName | null {
  if (name === 'next_action_selected') return 'cta_clicked';
  return isServerEvent(name) ? null : name;
}
