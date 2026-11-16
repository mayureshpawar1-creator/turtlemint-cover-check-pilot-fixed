/**
 * Product catalogue schema and matching helpers. The live catalogue is intentionally empty until current
 * policy wording, pricing, eligibility and source evidence are verified and approved by Turtlemint.
 * Do not use this schema's former demo values as product facts or premiums.
 */

export interface InsuranceProduct {
  id: string;
  name: string;
  insurer: string;
  type: 'family_floater' | 'individual' | 'senior_citizen' | 'super_top_up' | 'critical_illness' | 'term_life';
  // Coverage details
  minCoverageLakh: number;
  maxCoverageLakh: number;
  // Pricing (annual premium in INR for base coverage)
  basePremiumInr: number;
  premiumPerLakhInr: number; // Additional premium per lakh of coverage
  // Key features
  waitingPeriodMonths: number; // Initial waiting period
  preExistingDiseaseWaitMonths: number; // Wait for pre-existing conditions
  roomRentCover: 'actual' | '1_percent' | '2_percent' | 'upto_rs' | 'not_applicable'; // Room rent coverage type
  roomRentLimit: number | null; // If upto_rs, this is the limit in Rs/day
  icuChargesCover: boolean; // ICU charges covered
  ambulanceLimit: number | null; // Ambulance cover limit
  dayCareProcedures: number; // Number of day care procedures covered
  ailmentCover: number; // Number of ailments/diseases covered
  renewability: 'lifelong' | 'upto_age'; // Renewability terms
  maxRenewalAge: number | null; // If upto_age, this is the max age
  // Network and claims
  networkHospitals: number; // Number of network hospitals
  cashlessClaimRatio: number; // Percentage of claims settled cashless
  claimSettlementRatio: number; // Overall claim settlement percentage (IRDAI)
  // Additional benefits
  noClaimBonus: boolean; // NCB available
  restoreBenefit: boolean; // Restore benefit available
  domiciliaryHospitalization: boolean; // Domiciliary hospitalization cover
  organDonorExpenses: boolean; // Organ donor transplant expenses
  airAmbulanceCover: boolean; // Air ambulance cover
  newBornCover: boolean; // Newborn baby coverage (from day one)
  // Eligibility
  minEntryAge: number;
  maxEntryAge: number;
  minSumInsuredLakh: number;
  maxSumInsuredLakh: number;
  // Product-specific notes
  notes: string[];
  // Validation/source
  /** Historical scaffold field only; IRDAI registration does not validate each field in a product record. */
  /** @deprecated Do not treat this as proof of product terms or IRDAI validation. */
  validatedByIRDAI: boolean;
  /** Explicit Product/Compliance approval for this record to be shown to customers. */
  approvedForRecommendations: boolean;
  sourceUrl: string;
  lastUpdated: string; // ISO date string
}

/**
 * Production catalogue intentionally starts empty. The previous inline records were sample/demo values,
 * not a verified insurer feed. Never present sample premiums, hospital counts, ratios, or terms as live facts.
 * Add a product only after current source documents, as-of date, eligibility, pricing and Product/Compliance
 * approval have been recorded and tested. IRDAI registration is not verification of each field in this object.
 */
export const REAL_INSURANCE_PRODUCTS: InsuranceProduct[] = [];

/**
 * Get products filtered by type and coverage requirements
 */
export function getProductsByTypeAndCoverage(
  type: InsuranceProduct['type'],
  minCoverageLakh: number,
  maxCoverageLakh: number = Infinity
): InsuranceProduct[] {
  return REAL_INSURANCE_PRODUCTS.filter(product =>
    product.approvedForRecommendations === true &&
    /^https:\/\//i.test(product.sourceUrl) &&
    Number.isFinite(Date.parse(product.lastUpdated)) &&
    Date.now() - Date.parse(product.lastUpdated) >= 0 &&
    Date.now() - Date.parse(product.lastUpdated) <= 90 * 24 * 60 * 60 * 1000 &&
    product.type === type &&
    product.maxCoverageLakh >= minCoverageLakh &&
    product.minCoverageLakh <= maxCoverageLakh
  );
}

/**
 * Static base premiums are not customer-specific quotes. Do not rank products by a fabricated
 * per-lakh extrapolation; budget/value recommendations must come from a current, approved quote source.
 */
export function getProductsByValue(
  _type: InsuranceProduct['type'],
  _targetCoverageLakh: number,
  _maxPremiumInr: number
): InsuranceProduct[] {
  return [];
}

/**
 * Get justification for why a product is recommended based on user profile
 */
export function getProductJustification(
  product: InsuranceProduct,
  userProfile: {
    ageBand: string;
    incomeBand: string;
    cityTier: string;
    hasFamily: boolean;
    hasParents: boolean;
    healthCondition: string;
    topConcern: string;
    children_count?: number;
  }
): string {
  const justifications = [];

  // Age-based justification
  if (userProfile.ageBand === '41_50' || userProfile.ageBand === '51_60' || userProfile.ageBand === '61p') {
    justifications.push('Confirm entry-age limits, underwriting and available cover for your age group');
  }

  // Family justification
  if (userProfile.hasFamily && product.type === 'family_floater') {
    justifications.push('Check which family members are eligible and whether the sum insured is shared');
  } else if (!userProfile.hasFamily && product.type === 'individual') {
    justifications.push('Review the individual policy’s eligibility, benefits, exclusions and limits for your needs');
  }

  // Income-based justification
  if (userProfile.incomeBand === '1_2l' || userProfile.incomeBand === '2lp') {
    justifications.push('Check the actual insurer quote against your household budget before deciding');
  }

  // City tier justification
  if (userProfile.cityTier !== 'other' && product.roomRentCover === 'actual') {
    justifications.push('Check the room category, linked-expense terms and local hospital costs in the policy wording');
  }

  // Health condition justification
  if (userProfile.healthCondition === 'yes' && product.preExistingDiseaseWaitMonths <= 36) {
    justifications.push('Confirm pre-existing-condition terms and underwriting with the insurer; waiting period alone does not establish suitability');
  }

  // Top concern justification
  if (userProfile.topConcern === 'savings' && product.noClaimBonus) {
    justifications.push('Check the no-claim bonus trigger, cap and effect on sum insured or premium in the wording');
  }

  // Product-specific justifications
  if (product.type === 'super_top_up' && userProfile.hasFamily) {
    justifications.push('Compare the deductible and coordination with your existing policy before considering a super top-up');
  }

  if (product.type === 'critical_illness' && (userProfile.topConcern === 'serious_illness' || userProfile.healthCondition === 'yes')) {
    justifications.push('Check the listed illnesses, definitions, waiting periods and claim conditions before relying on a critical-illness benefit');
  }

  if (product.type === 'term_life' && userProfile.hasFamily) {
    justifications.push('Review term-life cover separately against dependants, liabilities, affordability and the actual policy terms');
  }

  // Newborn/child coverage justifications
  if (product.newBornCover && (userProfile.hasFamily || userProfile.children_count && userProfile.children_count > 0)) {
    justifications.push('Confirm newborn eligibility, start date, waiting periods and exclusions in the current wording');
  }

  // Default justification if none specific
  if (justifications.length === 0) {
    justifications.push('Review current policy wording, exclusions, eligibility and an actual quote with an authorised advisor');
  }

  return justifications.join('. ');
}

/**
 * Basic data-quality checks only. This does not verify an insurer product or certify IRDAI compliance.
 */
export function validateProductAgainstIRDAI(product: InsuranceProduct): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Basic validations
  if (product.minEntryAge > product.maxEntryAge) {
    issues.push('Minimum entry age cannot be greater than maximum entry age');
  }

  if (product.minSumInsuredLakh > product.maxSumInsuredLakh) {
    issues.push('Minimum sum insured cannot be greater than maximum sum insured');
  }

  if (product.basePremiumInr <= 0) {
    issues.push('Base premium must be positive');
  }

  if (product.premiumPerLakhInr < 0) {
    issues.push('Premium per lakh cannot be negative');
  }

  if (product.waitingPeriodMonths < 0) {
    issues.push('Initial waiting period cannot be negative');
  }

  if (product.preExistingDiseaseWaitMonths < 0) {
    issues.push('Pre-existing disease waiting period cannot be negative');
  }

  if (product.claimSettlementRatio < 0 || product.claimSettlementRatio > 100) {
    issues.push('Claim settlement ratio must be between 0 and 100%');
  }

  if (product.networkHospitals < 0) {
    issues.push('Number of network hospitals cannot be negative');
  }

  // newBornCover is boolean, no validation needed beyond type checking (handled by TypeScript)

  return {
    isValid: issues.length === 0,
    issues
  };
}

// Last updated: 2026-10-23. No product records are approved for customer recommendations.