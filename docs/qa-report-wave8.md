# QA Report — Wave 8: Storteboom Bestelschema Export & Artikelnummers

**Date:** 2026-02-20
**Status:** GO

---

## Test Counts

| Category | Count |
|---|---|
| Base (pre-wave 8) | 686 |
| New: article-numbers.test.ts | 5 |
| New: delivery-info.test.ts | 3 |
| New: storteboomExport.test.ts | 18 |
| Replaced: storteboomValidator.test.ts | 5 |
| Removed: old orderSchemaExport.test.ts | -19 |
| **Total** | **698** |

Note: test count is 698 rather than the estimated 711+ because the old
orderSchemaExport.test.ts (19 tests) was replaced by the new storteboomExport.test.ts
(18 tests) and storteboomValidator.test.ts (5 tests). Net new: +12 tests.
All backward-compatible integration tests (integration-snapshot-processing,
processing-integration) still pass with legacy wrapper functions.

---

## Build Status

- `npm run build` — CLEAN (compiled in 7.6s, no errors)
- `npx vitest run` — 698/698 passed, 0 failures

---

## Protected Files Status

All 10 protected files UNCHANGED:

| File | Status |
|---|---|
| src/lib/engine/process-chain.ts | Unchanged |
| src/lib/engine/nrv-cost.ts | Unchanged |
| src/lib/engine/mass-balance.ts | Unchanged |
| src/lib/engine/svaso.ts | Unchanged |
| src/lib/engine/tht.ts | Unchanged |
| src/lib/data/crisp-picnic-pipeline.ts | Unchanged |
| src/lib/actions/planning.ts | Unchanged |
| src/lib/engine/processing/generateInstructions.ts | Unchanged |
| src/lib/engine/availability/cascading.ts | Unchanged |
| src/lib/engine/availability/simulator.ts | Unchanged |

---

## Functional Verification Checklist

- [x] Artikelnummers seeded in DB (migration 20260221100001)
- [x] `getArticleNumbersByLocation('putten')` returns Putten products with art.nrs (tested)
- [x] Export generates valid .xlsx file (test: buffer.length > 100)
- [x] Excel has correct sheet name DD-MM-YYYY (test: '24-11-2025')
- [x] Putten section shows products + art.nrs + rendement + kg (test: cell search)
- [x] Nijkerk section shows products + art.nrs + kg (test: vacuum + niet_vacuum)
- [x] Klant-orders per kolom, met REST en Totaal (test: REST=7938, Totaal=3000)
- [x] Transport info (afleveradres, Koops, bezorgdag) in header (test: cell values)
- [x] Hele hoenen aftrek sectie present when pulls > 0 (test: 2 pulls present/absent)
- [x] NL numberformat (15.820 niet 15820) (test: formatNL + formatPct)
- [x] Massabalans: SOM(product kg) ≈ griller_kg (validator test: exceeds → error)
- [x] Validator catches missing art.nrs, negative REST, imbalance (3 separate tests)
- [x] DeliveryInfoEditor shows and saves delivery info (component + upsert test)
- [x] Export with simulator data includes adjusted values (test: whole_bird_pulls)
- [x] Export without simulator uses raw slaughter values (test: default input)

---

## Gate Criteria

| Gate | Status |
|---|---|
| Build clean | PASS |
| All tests pass (698) | PASS |
| 10 protected files unchanged | PASS |
| product_article_numbers table created and seeded | PASS |
| customer_delivery_info table created | PASS |
| Export generates Storteboom-format Excel | PASS |
| NL number format correct | PASS |
| Klant-kolommen dynamic | PASS |
| REST-kolom = beschikbaar - totaal besteld | PASS |
| Massabalans validator catches errors | PASS |
| Simulator data optionally included in export | PASS |
| DeliveryInfoEditor functional | PASS |
| QA report written | PASS |
| SYSTEM_STATE.md updated | PASS |

---

## Files Created/Modified

### New Files (17)
- `supabase/migrations/20260221100000_wave8_product_article_numbers.sql`
- `supabase/migrations/20260221100001_wave8_seed_article_numbers.sql`
- `supabase/migrations/20260221100002_wave8_customer_delivery_info.sql`
- `src/lib/actions/article-numbers.ts`
- `src/lib/actions/__tests__/article-numbers.test.ts`
- `src/lib/actions/delivery-info.ts`
- `src/lib/actions/__tests__/delivery-info.test.ts`
- `src/lib/actions/export.ts`
- `src/components/oil/orders/DeliveryInfoEditor.tsx`
- `src/lib/export/__tests__/storteboomExport.test.ts`
- `docs/qa-report-wave8.md`

### Modified Files (6)
- `src/types/database.ts` — Added ProductArticleNumber + CustomerDeliveryInfo types
- `src/lib/export/orderSchemaExport.ts` — Replaced with Storteboom-format exporter + legacy compat
- `src/lib/export/storteboomValidator.ts` — Replaced with Storteboom validator + legacy compat
- `src/lib/export/__tests__/storteboomValidator.test.ts` — Replaced test suite
- `src/components/oil/orders/ExportButton.tsx` — New Storteboom export UI
- `src/app/oil/orders/[slaughterId]/SlaughterOrdersClient.tsx` — Added mester, deliveryInfo props
- `src/app/oil/orders/[slaughterId]/page.tsx` — Fetch + pass delivery info and mester

### Deleted Files (1)
- `src/lib/export/__tests__/orderSchemaExport.test.ts` — Replaced by storteboomExport.test.ts

---

## Decision: **GO**
