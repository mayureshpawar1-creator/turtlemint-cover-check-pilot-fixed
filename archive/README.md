# Archive

Files moved out of the build on 16 Nov 2026 (Milestone 1.1, repository clean-up). Nothing here is compiled, tested or deployed. Everything was moved, not deleted, so it can be restored with `git mv` if needed.

## `parked/`

| File | Why it was parked |
|---|---|
| `PlanExploration.tsx.txt` | Uncommitted screen that broke the frontend build (18 type errors). It used CSS classes the project doesn't have, rendered the full explorer inside the cover-plan footer, its "View on Turtlemint" button did nothing, and it re-introduced term-life and critical-illness picks, which were removed from scope on 16 Nov 2026. `CoverPlan.tsx` and `PlansFit.tsx` were restored to their last committed version. Plan exploration returns in roadmap step 1.5, rebuilt on the approved-facts rules. |
| `productDatabase.ts.backup.DO-NOT-USE.txt` | Demo product records with named insurers and invented premiums and ratios. **Never use these values.** Real product facts come only from `approved_product_facts`. |

## `stray-root-files/`

Scratch files from the repository root: captured `git show` output (`haredsrcrecommendations.ts`, `pose()`), empty or one-line files (`temp.txt`, `test.txt`), and ad-hoc scripts that no longer run (`test-engagement.ts`, `validateProducts.js`, `testRealExtractor.ts`, `testPdfExtractorDirect.ts`).
