import type {
  AgeBand, IncomeBand, CityTier, ConditionTag, Door, FamilyInGroup, HealthCondition, JobExitCover, Language, LeadState, Member,
  ParentsAgeBand, PolicyAgeBand, Priority, RenewalWindow, RequestedAction, RoomRentLimit, Severity,
  FindingCategory, Situation, StartTiming, SumInsuredBand, Topic, TopConcern, YesNo, DocStatus, DocFailure,
  PremiumComfort, OtherProtectionInterest,
} from './enums';

/** Everything Rung 1 can store. All optional because answers arrive one screen at a time. */
export interface QuizAnswers {
  situation?: Situation;
  members?: Member[];
  /** v3 */
  age_band?: AgeBand;
  /** v3–v4 only. v5 no longer asks or shows it (data minimisation); old rows may still hold it. */
  income_band?: IncomeBand;
  city_tier?: CityTier;
  eldest_age?: number;
  children_count?: number;
  /** v4 one-screen quiz: family as counts (steppers). `members` is derived from these. */
  adults_count?: number;
  parents_count?: number;
  parents_age_band?: ParentsAgeBand;
  sum_insured_band?: SumInsuredBand;
  family_in_group_cover?: FamilyInGroup;
  health_condition?: HealthCondition;
  condition_tags?: ConditionTag[];
  policy_age_band?: PolicyAgeBand;
  job_exit_cover?: JobExitCover;
  room_rent_limit?: RoomRentLimit;
  room_rent_note?: string;
  top_concern?: TopConcern;
  renewal_window?: RenewalWindow;
  personal_policy_besides_group?: YesNo;
  start_timing?: StartTiming;
  /** v5 */
  premium_comfort?: PremiumComfort;
  other_protection_interest?: OtherProtectionInterest;
}
export type AnswerField = keyof QuizAnswers;

export interface Finding {
  ruleId: string;          // R1…R8 for quiz, D-* for document
  ruleVersion: string;
  category: FindingCategory;
  severity: Severity;
  text: string;
  /** For R8: which field triggered it. */
  field?: AnswerField;
}

export interface Readout {
  know: string[];
  check: Finding[];
}

export interface CaptureInput {
  firstName: string;
  pincode: string;
  mobileConfirmed: boolean;
  /** Only when the person changes the number on S8. E.164. */
  newMobile?: string;
  language?: Language;
}

export interface HandoffInput {
  requestedAction: RequestedAction;
  slotStart?: string; // ISO
  slotEnd?: string;
  callLanguage?: Language;
  topic?: Topic;
  note?: string;
  contactConsent: boolean;
}

export interface Bootstrap {
  leadId: string;
  sessionId: string | null;
  door: Door;
  maskedMobile: string;
  mobileVerified: boolean;
  language: Language;
  firstName?: string;
  answers: QuizAnswers;
  noticeVersion: string;
  /** 1.3: the campaign this visit came from (null fields when the link carries none). Used to tag outbound links. */
  attribution: Attribution;
  /** 1.3: landing copy from the campaign's variant, when one is registered; otherwise the door's default copy. */
  landing: LandingCopy | null;
}

export interface Attribution { campaignId: string | null; variantId: string | null; channel: string | null }
export interface LandingCopy { headline: string; sub: string | null; language: Language }

export interface PolicyFactView {
  key: PolicyFactKey;
  label: string;
  value: string | null;      // null = Not found in your document
  sourcePage: number | null;
  confidence: number | null; // 0..1
  userConfirmed: boolean;
  userValue: string | null;
}

export const POLICY_FACT_KEYS = [
  'insurer_name', 'product_name', 'policy_type', 'policy_number_last4', 'sum_insured_inr', 'premium_inr',
  'members', 'start_date', 'end_date', 'renewal_date', 'room_rent_limit', 'copay_percent', 'deductible_inr',
  'ped_waiting_months', 'specific_waiting_months', 'initial_waiting_days', 'sublimits', 'restoration',
  'no_claim_bonus', 'riders',
] as const;
export type PolicyFactKey = (typeof POLICY_FACT_KEYS)[number];

export interface DocumentStatusView {
  docId: string;
  status: DocStatus;
  failureReason?: DocFailure;
  needsPassword: boolean;
  facts: PolicyFactView[];
}

export interface CoverSummarySection {
  id: 'covered' | 'who' | 'waiting' | 'room_rent' | 'renewal' | 'review';
  title: string;
  lines: { text: string; page: number | null; found: boolean }[];
}

export interface CoverSummary {
  docId: string;
  sections: CoverSummarySection[];
  points: (Finding & { meaning: string; howWeHelp: string })[];
}

/** What a telecaller sees. Built from stored answers only — never inferred. */
export interface LeadCard {
  leadId: string;
  firstName: string | null;
  leadState: LeadState;
  priority: Priority | null;
  where: { pincode: string | null; city: string | null; state: string | null; mobileVerified: boolean };
  askedFor: {
    action: RequestedAction | null;
    slotStart: string | null;
    slotEnd: string | null;
    callLanguage: Language | null;
    topic: Topic | null;
    note: string | null;
  };
  situationLine: string;
  quizLine: string;
  toldThem: { ruleId: string; label: string }[];
  policyUpload: string;
  /** v3: what the one-screen result told them — suggested cover, shortfall, gaps. */
  adviceLine: string;
  /** Plan types we showed on S9a / U7, and which they opened on Turtlemint. */
  plansLine: string;
  /** Checklist boxes still open after the readout (or ticked by the person). */
  checklistLine: string;
  consentLine: string;
  openingScript: string;
}
