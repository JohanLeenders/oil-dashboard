# Wave 6 QA Report

**Datum:** 2026-02-20
**Wave:** 6 — Location & Cascade Engine Foundation + Import

---

## Test Results
- Base tests: 615 PASS
- New cascade tests: 23 PASS
- New import tests: 6 PASS
- Total: **644 PASS, 0 FAIL**

## Protected Files
8 files, diff = 0 lines:
- `src/lib/engine/svaso.ts` — unchanged
- `src/lib/engine/cherry-picker.ts` — unchanged
- `src/lib/engine/tht.ts` — unchanged
- `src/lib/engine/mass-balance.ts` — unchanged
- `src/lib/engine/sankey.ts` — unchanged
- `src/lib/engine/true-up.ts` — unchanged
- `src/lib/actions/batches.ts` — unchanged
- `src/lib/actions/scenarios.ts` — unchanged

## Build
`npm run build`: **CLEAN** — compiled in 28.7s, 0 errors, 0 warnings

## Database Migrations
- `20260220120000_wave6_locations.sql` — locations table + RLS
- `20260220120001_wave6_location_yield_profiles.sql` — yield profiles + RLS
- `20260220120002_wave6_product_yield_chains.sql` — cascade chains + RLS

## Seed Script
- `supabase/seed-wave6.sql` — 3 new products, 2 locations, 8 yield profiles, 6 cascade chains
- Conflict strategy: `ON CONFLICT DO NOTHING` (canonical reference data)

## Cascade Engine
- `src/lib/engine/availability/cascading.ts` — pure function, no DB access
- 23 unit tests covering all 4 mass balance invariants
- Oversubscription tracking, yield normalization, floating-point precision

## Import
- `importSlaughterDays` server action restored in `planning.ts`
- `clearSlaughterCalendar` server action added
- Zod validation schema at `src/lib/schemas/planning.ts`
- `ImportSlaughterDays` component updated (updated/rejected feedback)
- Component added back to `/oil/planning` page
- 6 unit tests (insert, update, reject, validation, counts, clear)

## New Files
```
supabase/migrations/20260220120000_wave6_locations.sql
supabase/migrations/20260220120001_wave6_location_yield_profiles.sql
supabase/migrations/20260220120002_wave6_product_yield_chains.sql
supabase/seed-wave6.sql
src/lib/engine/availability/cascading.ts
src/lib/engine/availability/__tests__/cascading.test.ts
src/lib/schemas/planning.ts
src/lib/actions/__tests__/planning.test.ts
docs/qa-report-wave6.md
```

## Modified Files
```
src/lib/actions/planning.ts          (ADD importSlaughterDays + clearSlaughterCalendar)
src/app/oil/planning/page.tsx        (ADD <ImportSlaughterDays />)
src/components/oil/planning/ImportSlaughterDays.tsx  (UPDATE: updated/rejected feedback)
```

## Decision: **GO**
