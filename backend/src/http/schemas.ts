/** Request body schemas (zod). Field-level rules live in @cover-check/shared/quiz and are re-checked in services. */
import { z } from 'zod';
import {
  AGE_BANDS, CITY_TIERS, OTHER_PROTECTION_INTEREST, PREMIUM_COMFORT, PLAN_TYPES, CONDITION_TAGS, CONSENT_PURPOSES, DISPOSITIONS, CLIENT_EVENT_NAMES, FAMILY_IN_GROUP, HEALTH_CONDITION, JOB_EXIT_COVER, LANGUAGES, MEMBERS,
  PARENTS_AGE_BANDS, POLICY_AGE_BANDS, POLICY_FACT_KEYS, QUEUES, RENEWAL_WINDOWS, REQUESTED_ACTIONS, ROOM_RENT_LIMIT, SCREEN_IDS,
  SITUATIONS, START_TIMING, SUM_INSURED_BANDS, TOP_CONCERNS, TOPICS, YES_NO,
} from '@cover-check/shared';

export const AnswersPatch = z.object({
  situation: z.enum(SITUATIONS),
  members: z.array(z.enum(MEMBERS)).min(1).max(5),
  age_band: z.enum(AGE_BANDS),
  city_tier: z.enum(CITY_TIERS),
  eldest_age: z.number().int().min(18).max(99),
  children_count: z.number().int().min(0).max(6),
  adults_count: z.number().int().min(1).max(2),
  parents_count: z.number().int().min(0).max(4),
  parents_age_band: z.enum(PARENTS_AGE_BANDS),
  sum_insured_band: z.enum(SUM_INSURED_BANDS),
  family_in_group_cover: z.enum(FAMILY_IN_GROUP),
  health_condition: z.enum(HEALTH_CONDITION),
  condition_tags: z.array(z.enum(CONDITION_TAGS)).max(6),
  policy_age_band: z.enum(POLICY_AGE_BANDS),
  job_exit_cover: z.enum(JOB_EXIT_COVER),
  room_rent_limit: z.enum(ROOM_RENT_LIMIT),
  room_rent_note: z.string().trim().max(40),
  top_concern: z.enum(TOP_CONCERNS),
  renewal_window: z.enum(RENEWAL_WINDOWS),
  personal_policy_besides_group: z.enum(YES_NO),
  start_timing: z.enum(START_TIMING),
  premium_comfort: z.enum(PREMIUM_COMFORT),
  other_protection_interest: z.enum(OTHER_PROTECTION_INTEREST),
}).partial().strict(); // v5: income_band is no longer accepted

export const SaveScreen = z.object({
  screenId: z.enum(SCREEN_IDS),
  answers: AnswersPatch,
  timeOnScreenMs: z.number().int().min(0).max(3_600_000).nullable().default(null),
});

export const StartQuiz = z.object({ language: z.enum(LANGUAGES).default('en') });

export const Capture = z.object({
  firstName: z.string().trim().min(2).max(40),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  mobileConfirmed: z.boolean(),
  newMobile: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
  language: z.enum(LANGUAGES).optional(),
});

export const Handoff = z.object({
  requestedAction: z.enum(REQUESTED_ACTIONS),
  slotStart: z.string().datetime().optional(),
  slotEnd: z.string().datetime().optional(),
  callLanguage: z.enum(LANGUAGES).optional(),
  topic: z.enum(TOPICS).optional(),
  note: z.string().trim().max(140).optional(),
  contactConsent: z.boolean(),
  language: z.enum(LANGUAGES).default('en'),
});

/** Browser events: interaction names only. Server milestones (SERVER_EVENT_NAMES) are never accepted from a client. */
export const Event = z.object({
  name: z.enum(CLIENT_EVENT_NAMES),
  screenId: z.enum(SCREEN_IDS).optional(),
  sessionId: z.string().uuid().optional(),
  props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const Otp = z.object({ purpose: z.enum(['upload', 'call']) });
export const OtpVerify = z.object({ code: z.string().regex(/^\d{6}$/) });
export const DocConsent = z.object({ language: z.enum(LANGUAGES).default('en') });
export const DocPassword = z.object({ password: z.string().min(1).max(64) });
export const ConfirmFacts = z.object({
  edits: z.array(z.object({ key: z.enum(POLICY_FACT_KEYS), userValue: z.string().trim().max(120).nullable() })).max(20).default([]),
});
export const Withdraw = z.object({ purposes: z.array(z.enum(CONSENT_PURPOSES)).optional() });
export const Dwell = z.object({ dwellMs: z.number().int().min(0) });

export const AgentQueue = z.object({ queue: z.enum(QUEUES).optional() });
export const Outcome = z.object({
  handoffId: z.string().uuid(),
  connected: z.boolean(),
  durationSec: z.number().int().min(0).optional(),
  disposition: z.enum(DISPOSITIONS),
  enquiryId: z.string().max(64).optional(),
  quoteShared: z.boolean().optional(),
  policySold: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  followupTs: z.string().datetime().optional(),
});

export const IssueLink = z.object({
  mobile: z.string().regex(/^\+91[6-9]\d{9}$/),
  door: z.enum(['get', 'check', 'company', 'review']),
  campaignId: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,62}$/).optional(),
  creativeId: z.string().max(64).optional(),
  variantId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/).optional(),
  templateId: z.string().max(64).optional(),
});

/** 1.3 campaign registry. Slugs are lower-case, so they read the same in links, UTM tags and reports. */
export const CampaignUpsert = z.object({
  campaignId: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,62}$/),
  name: z.string().trim().min(2).max(120),
  objective: z.string().trim().max(400).optional(),
  audience: z.string().trim().max(400).optional(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'web', 'partner', 'other']).optional(),
  waTemplateRef: z.string().trim().max(120).optional(),
  owner: z.string().trim().max(120).optional(),
  status: z.enum(['draft', 'live', 'paused', 'ended']).optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  variants: z.array(z.object({
    variantId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
    description: z.string().trim().max(400).optional(),
    landingLanguage: z.enum(LANGUAGES).optional(),
    landingHeadline: z.string().trim().max(120).optional(),
    landingSub: z.string().trim().max(200).optional(),
  })).max(20).optional(),
});

// ---------------------------------------------------------------- v2 value layer
export const RecOrigin = z.object({ origin: z.enum(['quiz', 'document']).default('quiz') });
export const RecClick = z.object({ origin: z.enum(['quiz', 'document']), type: z.enum(PLAN_TYPES), target: z.enum(['turtlemint', 'advisor']).default('turtlemint') });
export const ChecklistMark = z.object({ itemId: z.string().max(32), marked: z.boolean() });
export const SummarySend = z.object({ contactConsent: z.boolean().default(false), language: z.enum(LANGUAGES).default('en'), previewedAt: z.string().datetime().optional() });
