/**
 * Cover scenarios v1 — calibrated on Turtlemint's own health claims (see SUM_INSURED_METHOD.md).
 *
 * Replaces the unsourced `suggestedCoverLakh` formula as the candidate method. Every input is the customer's answer,
 * a figure in CLAIMS_EVIDENCE / COST_EVIDENCE (with its source), or a named ASSUMPTION. Income is NOT an input:
 * income informs affordability, never how much cover someone needs.
 *
 * What the output means: the cover that would have paid a single hospital bill of the size that 95 % / 99 % of
 * Turtlemint customers' bills stayed under, in hospitals of their city tier, grown for three years of cost increases.
 * The government-rate floor (v0) is kept as a minimum, so a scenario is never below it.
 *
 * Status: not wired into the UI. Needs Turtlemint owner approval before any amount is shown to customers (D3a).
 */

export type ClaimsCityTier = 'metro' | 'other';

/**
 * Turtlemint health claims, Superset `spectrum.claims_health_claims` + `claims_general_claim_details`, queried
 * 16 Nov 2026 as aggregates only. Latest version per claim; health vertical; billed amount ₹1,000–₹2 Cr; claims
 * intimated 2022–2026. Billed amount = the hospital bill for that claim (before insurer deductions).
 */
export const CLAIMS_EVIDENCE = {
  source: 'turtlemint_claims_2026',
  /** Bill per claim at the 90th / 95th / 99th percentile, by the treating hospital's city tier. */
  billPercentilesInr: {
    metro: { n: 1_238, p90: 276_525, p95: 407_065, p99: 905_000 },
    other: { n: 2_946, p90: 164_997, p95: 257_214, p99: 693_118 },
    all: { n: 22_030, p90: 145_432, p95: 252_378, p99: 594_406 },
  },
  /** Yearly growth of the 95th-percentile bill, 2023 → 2025 (₹2.12 L → ₹2.58 L), from the same claims. */
  p95GrowthPct: 10.4,
} as const;

/** Published figures kept from v0, used as the minimum and as context. `verify` = check against the primary table. */
export const COST_EVIDENCE = {
  /** NSS 80th round (2025): average out-of-pocket per private-hospital stay, net of reimbursement. Context only. */
  nssPrivateAvgOopeInr: { value: 50_508, source: 'nss80_2025', verify: false },
  /** CGHS 2025, Tier I super-speciality CABG (semi-private). The v0 "major event" — now the floor. */
  cghsCabgSuperSpecialityTier1Inr: { value: 271_000, source: 'cghs_2025', verify: true },
  cghsTierFactor: { value: { metro: 1, other: 0.9 }, source: 'cghs_2025', verify: true },
  /** Published medical-trend range (consultancy estimates), used for the low/high range. */
  medicalTrendPct: { value: { low: 9.9, high: 13 }, source: 'aon_2026', verify: false },
} as const;

/** Named assumptions — design choices, not data. */
export const ASSUMPTIONS = {
  /** Years of cost growth the cover should absorb before the customer reviews it. */
  horizonYears: 3,
  /** Our city question can't tell Tier II from Tier III, and the claims data splits metro vs other. Unknown → metro. */
  tierForCity: { metro: 'metro', other: 'other', unknown: 'metro' } as const,
  /** Round results UP to this step, so an amount is never shown lower than computed. */
  roundUpToInr: 50_000,
} as const;

export type ScenarioId = 'essential' | 'balanced' | 'higher';

export interface ScenarioInput {
  /** People to be covered on this policy (≥ 1). Kept for the API; per-claim severity doesn't depend on it (see doc). */
  insuredCount: number;
  city: 'metro' | 'other' | 'unknown';
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** What the amount pays for, in plain words. */
  covers: string;
  /** Amount at the central growth rate (Turtlemint's own), rounded up. */
  amountInr: number;
  /** Same amount at the low and high ends of the published growth range. */
  rangeInr: { low: number; high: number };
}

const roundUp = (n: number) => Math.ceil(n / ASSUMPTIONS.roundUpToInr) * ASSUMPTIONS.roundUpToInr;
const grow = (inr: number, pct: number) => inr * Math.pow(1 + pct / 100, ASSUMPTIONS.horizonYears);

export function coverScenarios(input: ScenarioInput): Scenario[] {
  const tier: ClaimsCityTier = ASSUMPTIONS.tierForCity[input.city];
  const b = CLAIMS_EVIDENCE.billPercentilesInr[tier];
  const floor = COST_EVIDENCE.cghsCabgSuperSpecialityTier1Inr.value * COST_EVIDENCE.cghsTierFactor.value[tier];
  const today: Record<ScenarioId, number> = {
    essential: Math.max(b.p95, floor),
    balanced: Math.max(b.p99, floor),
    higher: Math.max(b.p99 + b.p90, 2 * floor),
  };
  const place = tier === 'metro' ? 'big-city' : 'your city’s';
  const text: Record<ScenarioId, [string, string]> = {
    essential: ['Essential', `A hospital bill bigger than 95 in 100 of our customers’ bills in ${place} hospitals`],
    balanced: ['Balanced', `A hospital bill bigger than 99 in 100 of our customers’ bills in ${place} hospitals`],
    higher: ['Higher', 'That very large bill, plus a second big one in the same year'],
  };
  const t = COST_EVIDENCE.medicalTrendPct.value;
  return (['essential', 'balanced', 'higher'] as const).map((id) => ({
    id, label: text[id][0], covers: text[id][1],
    amountInr: roundUp(grow(today[id], CLAIMS_EVIDENCE.p95GrowthPct)),
    rangeInr: { low: roundUp(grow(today[id], t.low)), high: roundUp(grow(today[id], t.high)) },
  }));
}

/** The sentence that must accompany any scenario shown to a customer. */
export const SCENARIO_CAVEAT =
  'Based on hospital bills of Turtlemint customers, grown for three years of rising costs. One bill can be larger than these — ask your advisor about the hospitals you would use.';
