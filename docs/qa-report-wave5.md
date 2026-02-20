# QA Report — Wave 5: Final QA & Financial Regression

**Date:** 2026-02-20
**Baseline:** v0.4-wave4 (commit 00a4b03)
**Target:** v0.5-wave5
**QA Lead:** Claude Code Agent

---

## 1. Test Summary

| Metric | Value |
|---|---|
| **Total tests** | 615 |
| **Test files** | 31 |
| **Failures** | 0 |
| **Skipped** | 0 |
| **Duration** | ~3.5s |

### Test Coverage by Domain

| Domain | Files | Tests |
|---|---|---|
| **Core Engine** | | |
| canonical-cost | 1 | 78 |
| scenario-impact | 1 | 45 |
| carcass-alignment | 1 | 45 |
| margin-context | 1 | 45 |
| historical-trends | 1 | 30 |
| sales-pressure | 1 | 28 |
| customer-profitability | 1 | 20 |
| nrv-cost | 1 | 16 |
| cost-validation | 1 | 14 |
| tht | 1 | 14 |
| mass-balance | 1 | 12 |
| svaso | 1 | 11 |
| cherry-picker | 1 | 11 |
| chicken-equivalent | 1 | 10 |
| process-chain | 1 | 10 |
| append-only | 1 | 8 |
| scenario-sandbox | 1 | 22 |
| **Order Module** | | |
| buildOrderSchema | 1 | 11 |
| availability | 1 | 8 |
| availability-orders-integration | 1 | 11 |
| **Processing Module** | | |
| generateInstructions | 1 | 10 |
| processing-integration (Wave 4) | 1 | 20 |
| **Export Module** | | |
| orderSchemaExport | 1 | 9 |
| storteboomValidator | 1 | 10 |
| **Data Layer** | | |
| customer-import-store | 1 | 16 |
| crisp-picnic-pipeline | 1 | 36 |
| **Test Utils** | | |
| factories | 1 | 16 |
| mapBatchToBaseline | 1 | 4 |
| **UI** | | |
| sandboxLabels | 1 | 25 |
| chainTemplates | 1 | 5 |
| **Wave 5 (NEW)** | | |
| integration-snapshot-processing | 1 | 15 |

---

## 2. Protected Files Verification

Command: `git diff a48c44f -- <protected files>`

| File | Status |
|---|---|
| src/lib/engine/svaso.ts | ZERO DIFF |
| src/lib/engine/cherry-picker.ts | ZERO DIFF |
| src/lib/engine/tht.ts | ZERO DIFF |
| src/lib/engine/mass-balance.ts | ZERO DIFF |
| src/lib/engine/sankey.ts | ZERO DIFF |
| src/lib/engine/true-up.ts | ZERO DIFF |
| src/lib/actions/batches.ts | ZERO DIFF |
| src/lib/actions/scenarios.ts | ZERO DIFF |

**Result: PASS — all protected files unchanged since initial commit (a48c44f)**

---

## 3. Migration Integrity

| Metric | Value |
|---|---|
| Original migrations (pre-Wave 4) | 120 |
| Wave 4 additions | 2 |
| **Total committed migrations** | **122** |
| Wave 5 migrations | 0 (none required) |

Wave 4 migrations:
- `20260219200000_processing_tables.sql` — processing_recipes + processing_instructions
- `20260219200001_rls_policies.sql` — RLS scaffolding (6 tables)

Both pushed to remote DB and verified.

---

## 4. Build & Performance

| Metric | Value |
|---|---|
| Build status | CLEAN |
| Compile time | ~7.7s |
| Total routes | 31 |
| Static routes | 1 |
| Dynamic routes | 30 |
| Lint warnings | 0 |
| Lint errors | 0 |

### Route Inventory

Core: `/`, `/oil` (dashboard)
Batches: `/oil/batches`, `/oil/batches/[batchId]`, sandbox, details
Kostprijs: `/oil/kostprijs`, `/oil/kostprijs/[calculationId]`, `/oil/kostprijs/nieuwe-berekening`
Klanten: `/oil/customers`, `/oil/customers/import`
Planning: `/oil/planning`, `/oil/planning/[slaughterId]`
Orders: `/oil/orders`, `/oil/orders/[slaughterId]`
Processing: `/oil/processing`, `/oil/processing/[recipeId]`
Exports: `/oil/exports`
Analysis: `/oil/margins`, `/oil/pressure`, `/oil/trends`, `/oil/alignment`

---

## 5. Placeholder Audit

### Fixed (A7-S2b):

| File | Issue | Action |
|---|---|---|
| SlaughterDetail.tsx:168-178 | "wordt toegevoegd in Wave 3" placeholder for availability | REMOVED — availability already implemented in Wave 3 |
| EstimateVsActual.tsx:19 | "Wordt toegevoegd in een volgende fase" | Updated to "Beschikbaar in Fase 2 (werkelijke batch yields koppeling)" |

### Remaining (legitimate — NOT bugs):

| File | Type | Reason |
|---|---|---|
| RecipeList.tsx:38 | border-dashed empty state | Legitimate "no recipes" empty state |
| ExportList.tsx:68 | border-dashed empty state | Legitimate "no exports" empty state |
| SlaughterCalendarList.tsx:62 | border-dashed empty state | Legitimate "no calendar items" empty state |
| orders/page.tsx:118 | border-dashed empty state | Legitimate "no slaughter dates" empty state |
| FileUploadStep.tsx:98 | border-dashed drop zone | Legitimate file upload UI |
| EstimateVsActual.tsx:13 | border-dashed placeholder | Intentional Phase 2 marker |
| ProcessChainEditor.tsx:255 | border-dashed sandbox | Legitimate sandbox UI |

### Wave references in code comments:

All "Wave 2/3/4" references found are in REGRESSIE-CHECK/Sprint header comments — developer-facing only, NOT user-visible text. No action required.

---

## 6. Financial Invariants Verification

All 7 financial invariant tests PASS:

| Invariant | Test | Status |
|---|---|---|
| Ordered sum consistency | Sum of surplus_deficit.ordered_kg equals sum of input orders | PASS |
| Surplus never exceeds availability | delta_kg <= available_kg for all products | PASS |
| Yield upper bound respected | expected_output_kg <= quantity_kg * (yield% / 100) | PASS |
| Snapshot immutability | ProcessingInstruction has no updated_at field | PASS |
| JA757 yield consistency | Each part's expected_kg = liveWeight * yield_pct | PASS |
| Zero-order identity | No orders → delta_kg equals available_kg | PASS |
| Deficit correctness | Orders > availability → negative delta_kg | PASS |

---

## 7. Go / No-Go Decision

| Criterion | Status |
|---|---|
| All tests pass (615/615) | PASS |
| Financial invariants pass (7/7) | PASS |
| Zero diff in protected files | PASS |
| Build clean | PASS |
| Lint clean (0 warnings) | PASS |
| Placeholders cleaned | PASS |
| QA report written | PASS |

### **DECISION: GO**

Phase 1 is release-ready. All gates pass. No regressions detected.

---

## Appendix: Test Growth Across Waves

| Wave | Tests | Delta |
|---|---|---|
| Pre-Wave 2 | 521 | — |
| Wave 2 | 532 | +11 |
| Wave 3 | 560 | +28 |
| Wave 4 | 600 | +40 |
| **Wave 5** | **615** | **+15** |
