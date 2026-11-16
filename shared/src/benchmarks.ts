/**
 * Published figures used to give people context. Every number shown in the product comes from this file
 * and is shown with its source line. Rules:
 *  - Primary or neutral sources only (regulator, government, actuarial). Never a competitor
 *    (no aggregators, brokers or other distributors) — not as a source and not as a link.
 *  - Nothing invented. Update values when the source publishes a new edition.
 * Figures marked VERIFY were read from published summaries; check them against the primary table before launch.
 */

export interface Source { id: SourceId; label: string; url: string; published: string }
export type SourceId = 'irdai_ar_2425' | 'niti_2021' | 'milliman_2026' | 'irdai_mc_2024' | 'turtlemint' | 'cover_rule' | 'pib_vay_vandana' | 'irdai_portability'
  | 'nss80_2025' | 'cghs_2025' | 'aon_2026' | 'turtlemint_claims_2026';

export const SOURCES: Record<SourceId, Source> = {
  irdai_ar_2425: {
    id: 'irdai_ar_2425', label: 'IRDAI Annual Report 2024-25', published: '2025',
    url: 'https://irdai.gov.in/document-detail?documentId=8375620',
  },
  niti_2021: {
    id: 'niti_2021', label: "NITI Aayog, Health Insurance for India's Missing Middle", published: 'Oct 2021',
    url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1767498',
  },
  milliman_2026: {
    id: 'milliman_2026', label: 'Milliman, Measuring medical inflation in India', published: 'Apr 2026',
    url: 'https://www.milliman.com/en/insight/measuring-medical-inflation-in-india',
  },
  turtlemint: {
    id: 'turtlemint', label: 'Turtlemint customer data', published: 'internal', url: 'https://www.turtlemintinsurance.com/',
  },
  cover_rule: {
    id: 'cover_rule', label: 'Cover Check suggestion, based on your family, age and city', published: 'v1', url: '',
  },
  pib_vay_vandana: {
    id: 'pib_vay_vandana', label: 'PIB, Ayushman Vay Vandana cards for senior citizens 70+', published: 'Dec 2024',
    url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2082288',
  },
  irdai_portability: {
    id: 'irdai_portability', label: 'IRDAI policyholder portal, Portability of health insurance', published: 'IRDAI',
    url: 'https://policyholder.gov.in/portability-of-health-insurance',
  },
  turtlemint_claims_2026: {
    id: 'turtlemint_claims_2026', label: 'Turtlemint health claims, 2022–2026 (internal, aggregate figures only)', published: 'Nov 2026',
    url: '',
  },
  nss80_2025: {
    id: 'nss80_2025', label: 'NSO, Household Social Consumption: Health, NSS 80th round (Jan–Dec 2025) — press note', published: 'Apr 2026',
    url: 'https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/apr/doc2026420852401.pdf',
  },
  cghs_2025: {
    id: 'cghs_2025', label: 'MoHFW, revised CGHS package rates (OM dated 3 Oct 2025, effective 13 Oct 2025)', published: 'Oct 2025',
    url: 'https://cghs.mohfw.gov.in',
  },
  aon_2026: {
    id: 'aon_2026', label: 'Aon, 2026 Global Medical Trend Rates — India (consultancy estimate)', published: 'Dec 2025',
    url: 'https://www.aon.com/apac/in-the-press/asia-newsroom/2025/india-outpaces-global-average-with-2026-medical-trend-at-11-5-percent-aon-reports',
  },
  irdai_mc_2024: {
    id: 'irdai_mc_2024', label: 'IRDAI Master Circular on Health Insurance (29 May 2024)', published: 'May 2024',
    url: 'https://irdai.gov.in/health-dept',
  },
};

export const BENCHMARKS = {
  /** Lives covered by health insurance in India, FY25 — IRDAI AR 2024-25 (VERIFY against the lives-covered table). */
  livesCoveredCrore: 58.06,
  /** Share of covered lives by channel, FY25 — IRDAI AR 2024-25. */
  coverShare: { government: 42.3, group: 47.4, individual: 10.3 },
  individualLivesCrore: 6.01,
  groupLivesCrore: 27.51,
  /** People with no financial protection for health — NITI Aayog 2021. */
  missingMiddleCrore: 40,
  missingMiddlePct: 30,
  /** Medical cost trend — Milliman: 12% in 2024, 13% projected for 2025. */
  medicalInflationPct: 13,
  /** IRDAI Master Circular 2024. */
  pedWaitMaxMonths: 36,
  moratoriumYears: 5,
  /** Ayushman Vay Vandana: free cover a year for everyone 70+, whatever their income — PIB Dec 2024. */
  vayVandanaLakh: 5,
  vayVandanaAge: 70,
  /** Ayushman Bharat PM-JAY: cover per eligible family per year. */
  pmjayLakh: 5,
  /** Average settled health claim FY25 and share settled cashless — IRDAI AR 2024-25. */
  avgClaimInr: 28_910,
  cashlessSharePct: 58,
} as const;

/** What ₹X of cover buys in `years`, in today's treatment costs, at the medical inflation rate. */
export const realValueAfter = (lakh: number, years = 5, ratePct: number = BENCHMARKS.medicalInflationPct) =>
  Math.round((lakh / Math.pow(1 + ratePct / 100, years)) * 10) / 10;

/** Representative value for each quiz band (top of band; ₹25 L+ shown as 25). */
export const BAND_LAKH: Record<string, number> = { lt3: 3, '3_5': 5, '5_10': 10, '10_25': 25, '25p': 25 };

/**
 * First-party benchmarks. Fill from Turtlemint's own policy data (e.g. average sum insured bought through
 * Turtlemint in the last 12 months). While null, nothing is shown — we never show a placeholder number.
 */
export const FIRST_PARTY: { avgSumInsuredLakh: number | null; asOf: string | null } = { avgSumInsuredLakh: null, asOf: null };
