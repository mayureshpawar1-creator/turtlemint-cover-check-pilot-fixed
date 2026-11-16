[33md634985[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mfeat/exotel-sms-otp[m[33m)[m feat: add engagement tracking and product catalog scaffolding
 ENGAGEMENT_TRACKING_DESIGN.md           | 256 [32m+++++++++++++[m
 backend/test/integrations.test.ts       |   2 [32m+[m[31m-[m
 frontend/src/hooks/useEngagement.ts     | 192 [32m++++++++++[m
 frontend/src/screens/Capture.tsx        | 100 [32m++++[m[31m-[m
 frontend/src/screens/Confirmation.tsx   |  40 [32m+[m[31m-[m
 frontend/src/screens/CoverPlan.tsx      | 126 [32m++++++[m[31m-[m
 frontend/src/screens/Landing.tsx        |  41 [32m+[m[31m-[m
 frontend/src/screens/NextStep.tsx       |  66 [32m+++[m[31m-[m
 frontend/src/screens/PlansFit.tsx       |  63 [32m+++[m[31m-[m
 frontend/src/screens/PolicyBoard.tsx    | 119 [32m+++++[m[31m-[m
 frontend/src/screens/QuickCheck.tsx     | 146 [32m++++++[m[31m-[m
 frontend/src/screens/SummaryPreview.tsx | 107 [32m+++++[m[31m-[m
 frontend/src/screens/Upload.tsx         | 319 [32m++++++++++++++[m[31m--[m
 frontend/src/state/flow.tsx             |  58 [32m++[m[31m-[m
 frontend/src/ui/PlanCard.tsx            |  23 [32m+[m[31m-[m
 frontend/src/ui/components.tsx          |   3 [32m+[m[31m-[m
 shared/src/engagement.ts                | 383 [32m+++++++++++++++++++[m
 shared/src/enums.ts                     |   4 [32m+[m[31m-[m
 shared/src/productDatabase.ts           | 649 [32m++++++++++++++++++++++++++++++++[m
 shared/src/recommendations.test.ts      | 135 [32m+++++++[m
 20 files changed, 2717 insertions(+), 115 deletions(-)
