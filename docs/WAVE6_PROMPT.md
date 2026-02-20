# WAVE 6 — Location & Cascade Engine Foundation + Import

## Context

You are working on the OIL Dashboard (Oranjehoen Intelligence Layer), a Next.js 15 + Supabase poultry business intelligence platform. Phase 1 (Waves 1-5) is complete with 615 tests passing, tagged `v0.5-wave5`.

Phase 2 introduces a **Putten → Nijkerk cascade model**. Wave 6 is the first implementation wave: it builds the database foundation, the cascade engine, and restores the slaughter day import.

**Pre-Wave 6 has already delivered yield data** in `docs/yield-data/`. Use that data as input for seeding.

Read the full Phase 2 plan: `docs/FASE2_UI_IMPROVEMENT_PLAN.md`

---

## Agent Team

| Agent | Role | Files |
|-------|------|-------|
| INFRA_AGENT | Database migrations, seed data, RLS policies | `supabase/migrations/`, seed scripts |
| ENGINE_AGENT | Pure functions, cascade calculations, unit tests | `src/lib/engine/availability/cascading.ts` |
| IMPORT_AGENT | Restore ImportSlaughterDays + server action | `src/components/oil/planning/`, `src/lib/actions/planning.ts` |
| QA_AGENT | Regression gate, protected file check, build | All test files |

---

## Pre-flight Checklist

```
□ Read docs/FASE2_UI_IMPROVEMENT_PLAN.md (full plan)
□ Read docs/yield-data/ (all seed data from Pre-Wave 6)
□ Read src/lib/engine/availability.ts (current JA757 yields + computeTheoreticalAvailability)
□ Read src/lib/actions/planning.ts (existing slaughter calendar actions)
□ Read src/lib/actions/orders.ts (see hardcoded availability: never[] = [])
□ Read src/components/oil/planning/ImportSlaughterDays.tsx (existing import component)
□ Read src/lib/utils/parseOpzetplanning.ts (existing parser)
□ npm test → confirm 615 tests PASS
□ npm run build → confirm clean
□ Protected file diff = 0 (engine/svaso.ts, engine/cherry-picker.ts, engine/tht.ts, engine/mass-balance.ts, engine/sankey.ts, engine/true-up.ts, actions/batches.ts, actions/scenarios.ts)
```

---

## A0-S1 — INFRA_AGENT: Multi-location Database Model

### Migration 1: `locations` table

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL
    CHECK (location_type IN ('primary', 'secondary')),
  processing_day_offset INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- RLS: consistent with Wave 4 pattern (authenticated=allow, anon=deny)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_locations" ON locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deny_anon_locations" ON locations
  FOR ALL TO anon USING (false);
```

### Migration 2: `location_yield_profiles` table

```sql
CREATE TABLE location_yield_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id),
  product_id UUID REFERENCES products(id),
  yield_percentage NUMERIC(7,6) NOT NULL,  -- stored as 0.0-1.0 (e.g. 0.235000 = 23.5%)
  is_active BOOLEAN DEFAULT true,
  UNIQUE (location_id, product_id)
);

-- RLS: consistent with Wave 4 pattern (authenticated=allow, anon=deny)
ALTER TABLE location_yield_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_location_yield_profiles" ON location_yield_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deny_anon_location_yield_profiles" ON location_yield_profiles
  FOR ALL TO anon USING (false);
```

### Migration 3: `product_yield_chains` table

```sql
CREATE TABLE product_yield_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID REFERENCES products(id),
  child_product_id UUID REFERENCES products(id),
  source_location_id UUID REFERENCES locations(id),
  target_location_id UUID REFERENCES locations(id),
  yield_pct NUMERIC(7,6) NOT NULL,  -- stored as 0.0-1.0 (e.g. 0.420000 = 42%)
  sort_order INT DEFAULT 0,
  UNIQUE (parent_product_id, child_product_id)
);

-- RLS: consistent with Wave 4 pattern (authenticated=allow, anon=deny)
ALTER TABLE product_yield_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_product_yield_chains" ON product_yield_chains
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deny_anon_product_yield_chains" ON product_yield_chains
  FOR ALL TO anon USING (false);
```

### Seed Data

Insert seed data from the Pre-Wave 6 deliverables:

1. **Locations:** Use `docs/yield-data/locations.seed.json`
2. **Location yield profiles:** Use `docs/yield-data/location_yield_profiles.seed.json`
3. **Product yield chains:** Use `docs/yield-data/product_yield_chains.seed.json`
4. **New products (if any):** Check `docs/yield-data/new_products.seed.json` — insert these into `products` first

Write a seed script at `supabase/seed-wave6.sql` that inserts all data.

**Seed conflict strategy:**
- `locations`: `ON CONFLICT (code) DO NOTHING` — location definitions are canonical
- `location_yield_profiles`: `ON CONFLICT (location_id, product_id) DO NOTHING` — yields are canonical for Phase 2 (Phase 3 will introduce actual yields separately)
- `product_yield_chains`: `ON CONFLICT (parent_product_id, child_product_id) DO NOTHING` — cascade chains are canonical
- `products` (if new): `ON CONFLICT DO NOTHING`

**Rationale:** Yield data is canonical reference data for Phase 2. Use `DO NOTHING` (not `DO UPDATE`) to prevent accidental overwrites. If yields need to change, create a new migration — don't silently update via seed reruns.

### Migration Push Protocol

1. Run all migrations locally via `supabase db push` or `supabase migration up`
2. Verify tables exist: `SELECT * FROM locations; SELECT * FROM location_yield_profiles; SELECT * FROM product_yield_chains;`
3. Run seed script
4. Verify seed data inserted correctly
5. Run existing test suite: `npm test` — must still pass 615 tests

---

## A0-S2 — IMPORT_AGENT: Restore Slaughter Day Import

### Background

ImportSlaughterDays was disconnected during Wave 5. The component exists at `src/components/oil/planning/ImportSlaughterDays.tsx` and the parser at `src/lib/utils/parseOpzetplanning.ts`. The server action was removed from `src/lib/actions/planning.ts`.

### Tasks

1. **Restore server action** in `src/lib/actions/planning.ts`:
   ```typescript
   'use server'

   export async function importSlaughterDays(
     rows: ParsedSlaughterRow[]
   ): Promise<{
     inserted: number;   // new rows added
     updated: number;    // existing rows updated (same date+location)
     rejected: number;   // rows that failed validation
     errors: string[];   // per-row error messages
   }>
   ```

   - Insert rows into `slaughter_calendar`
   - **Duplicate detection:** If a row with the same `slaughter_date` AND `slaughter_location` already exists → UPDATE that row (update `expected_birds`, `avg_weight_kg`, `mester`, `week_number`)
   - **New rows:** If no match on date+location → INSERT
   - **Rejected rows:** If validation fails (bad date, negative birds, etc.) → skip and add to errors[]
   - Return explicit counts so the UI can show "X ingevoegd, Y bijgewerkt, Z afgekeurd"

2. **Restore component** in the planning page:
   - Add `<ImportSlaughterDays />` back to `src/app/oil/planning/page.tsx`
   - Component should already work — verify it renders and connects to the server action
   - Add validation feedback UI: show "X ingevoegd, Y bijgewerkt, Z afgekeurd" after import
   - Show errors[] as a list if any rejections occurred

3. **Add input validation schema** in `src/lib/schemas/planning.ts`:
   ```typescript
   export const importSlaughterDaysSchema = z.object({
     rows: z.array(z.object({
       slaughter_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
       week_number: z.number().int().min(1).max(53),
       expected_birds: z.number().int().min(0).max(200_000),
       avg_weight_kg: z.number().positive().max(10),
       slaughter_location: z.string().max(200).optional(),
       mester: z.string().max(200).optional(),
     })).min(1).max(100),
   });
   ```

4. **Tests** (at least 5):
   - Import new rows successfully
   - Duplicate detection updates existing row
   - Validation rejects invalid data
   - Empty rows array rejected
   - Import returns correct counts

---

## A1-S1 — ENGINE_AGENT: Cascaded Availability Engine

### Create `src/lib/engine/availability/cascading.ts`

This is the core cascade engine. It is a **pure function** — no database access, no side effects, fully deterministic.

### Type Definitions

```typescript
export interface OrderLine {
  product_id: string;
  quantity_kg: number;
}

export interface LocationYieldProfile {
  product_id: string;
  product_description: string;
  yield_percentage: number;  // 0.0 - 1.0
}

export interface ProductYieldChain {
  parent_product_id: string;
  child_product_id: string;
  child_product_description: string;
  yield_pct: number;  // 0.0 - 1.0
}

export interface CascadedProduct {
  product_id: string;
  product_description: string;
  primary_available_kg: number;    // Total from griller yield
  sold_primary_kg: number;         // Already ordered at primary location (clamped to available for calc)
  oversubscribed_kg: number;       // = max(0, raw_sold - available). >0 means oversold!
  forwarded_kg: number;            // = primary_available - clamped_sold (always >= 0)
  cascaded_children: CascadedChild[];
  processing_loss_kg: number;      // = forwarded × (1 - sum(child_yields))
}

export interface CascadedChild {
  product_id: string;
  product_description: string;
  available_kg: number;            // = forwarded_kg × yield_pct
  sold_kg: number;                 // Already ordered at secondary location
  net_available_kg: number;        // = available - sold (clamped >= 0)
}

export interface CascadedAvailability {
  griller_kg: number;
  primary_products: CascadedProduct[];
  secondary_products: CascadedChild[];  // Flattened list of all cascaded children
  total_sold_primary_kg: number;
  total_forwarded_kg: number;
  total_cascaded_kg: number;
  total_loss_kg: number;
  mass_balance_check: boolean;          // true if invariant 4 holds
}
```

### Core Function

```typescript
export function computeCascadedAvailability(input: {
  griller_kg: number;
  yield_profiles: LocationYieldProfile[];
  yield_chains: ProductYieldChain[];
  existing_orders_primary: OrderLine[];
  existing_orders_secondary: OrderLine[];
}): CascadedAvailability
```

### Logic (step by step)

1. **Compute primary availability**: For each yield profile, `primary_available_kg = griller_kg × yield_percentage`

2. **Subtract primary orders**: For each parent product, find matching orders in `existing_orders_primary`. `raw_sold = sum of matching orders`.
   - `oversubscribed_kg = max(0, raw_sold - primary_available_kg)` — track the excess!
   - `sold_primary_kg = min(raw_sold, primary_available_kg)` — clamp for cascade calc
   - The oversubscribed flag makes overselling visible to the UI instead of silently hiding it.

3. **Compute forwarded**: `forwarded_kg = primary_available_kg - sold_primary_kg` (always >= 0)

4. **Apply cascade chains**: For each parent with forwarded_kg > 0:
   - Find matching chains in `yield_chains` where `parent_product_id` matches
   - For each chain: `child_available_kg = forwarded_kg × yield_pct`
   - `processing_loss_kg = forwarded_kg × (1 - sum(child yield_pcts))`
   - **Guard**: if sum of child yields > 1.0, normalize proportionally and set loss to 0

5. **Subtract secondary orders**: For each cascaded child, subtract matching orders from `existing_orders_secondary`. Clamp to 0.

6. **Mass balance check**: Verify `sum(sold_primary) + sum(child_available) + sum(loss) <= griller_kg`

7. **Return** the complete `CascadedAvailability` object.

### Key Invariants (must hold in every return value)

```
1) sold_primary + forwarded = primary_available    (per product)
2) sum(child_yields) <= 1.0                        (per parent)
   loss = forwarded × (1 - sum(child_yields))
3) sold_child <= child_available                   (per child)
4) sum(sold_primary) + sum(cascaded) + sum(loss) <= griller_kg
```

### Unit Tests: `src/lib/engine/availability/__tests__/cascading.test.ts`

Use the test cases from `docs/yield-data/mass_balance_test_cases.json` as the basis.

**Minimum 15 tests:**

| # | Test Name | What it verifies |
|---|-----------|-----------------|
| 1 | `no_cascade_primary_only` | Only primary products, no chains defined → children empty |
| 2 | `full_cascade_nothing_sold` | All primary forwarded, children computed correctly |
| 3 | `partial_cascade_mixed` | Some sold at primary, rest forwarded |
| 4 | `all_sold_at_primary` | Everything sold at Putten → forwarded = 0, no children |
| 5 | `oversubscribed_primary` | sold > available → clamp for calc, oversubscribed_kg > 0, forwarded = 0 |
| 6 | `multi_parent_cascade` | Multiple parents (borstkap + zadel) both forwarded |
| 7 | `zero_griller_kg` | 0 kg input → everything is 0 |
| 8 | `single_parent_only` | Only one yield profile provided |
| 9 | `yield_sum_over_100` | Child yields sum to >1.0 → normalize proportionally |
| 10 | `yield_sum_exactly_100` | No loss when yields sum to exactly 1.0 |
| 11 | `loss_calculation_correct` | Verify loss = forwarded × (1 - sum(yields)) |
| 12 | `mass_balance_invariant_1` | sold + forwarded = available per parent |
| 13 | `mass_balance_invariant_2` | sum(yields) <= 1.0 per parent |
| 14 | `mass_balance_invariant_3` | sold_child <= child_available |
| 15 | `mass_balance_invariant_4` | global: sum everything <= griller_kg |
| 16 | `secondary_orders_subtract` | Orders at Nijkerk reduce net_available |
| 17 | `empty_orders_arrays` | No orders → full availability everywhere |
| 18 | `unknown_product_in_orders` | Order references product not in profiles → ignored |
| 19 | `large_batch_40k_birds` | 40,000 birds × 2.65 × 70.4% → no floating point drift |
| 20 | `negative_griller_kg` | Negative input → treat as 0 |

### Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { computeCascadedAvailability } from '../cascading';

// Load Pre-Wave 6 test cases as baseline data
// import testCases from '../../../../docs/yield-data/mass_balance_test_cases.json';

describe('computeCascadedAvailability', () => {
  // Standard yield profiles for tests (from Pre-Wave 6 seed data)
  const defaultProfiles: LocationYieldProfile[] = [
    { product_id: 'borstkap-id', product_description: 'Borstkappen', yield_percentage: 0.235 },
    { product_id: 'zadel-id', product_description: 'Zadels', yield_percentage: 0.280 },
    { product_id: 'vleugel-id', product_description: 'Vleugels', yield_percentage: 0.107 },
  ];

  const defaultChains: ProductYieldChain[] = [
    { parent_product_id: 'borstkap-id', child_product_id: 'filet-met-haas-id', child_product_description: 'Filet met haas', yield_pct: 0.42 },
    { parent_product_id: 'borstkap-id', child_product_id: 'filet-zonder-haas-id', child_product_description: 'Filet zonder haas', yield_pct: 0.35 },
    { parent_product_id: 'borstkap-id', child_product_id: 'haasjes-id', child_product_description: 'Haasjes', yield_pct: 0.08 },
    // ... etc
  ];

  it('full_cascade_nothing_sold', () => {
    const result = computeCascadedAvailability({
      griller_kg: 1865.6,
      yield_profiles: defaultProfiles,
      yield_chains: defaultChains,
      existing_orders_primary: [],
      existing_orders_secondary: [],
    });

    // All primary available, nothing sold
    expect(result.total_sold_primary_kg).toBe(0);
    // Mass balance must hold
    expect(result.mass_balance_check).toBe(true);
    // Forwarded = all primary available
    expect(result.total_forwarded_kg).toBeCloseTo(
      result.primary_products.reduce((sum, p) => sum + p.primary_available_kg, 0),
      1
    );
  });
});
```

---

## A7-S1 — QA_AGENT: Regression Gate

### Automated Checks

Run these in order. ALL must pass before tagging.

```bash
# 1. Protected file integrity
git diff HEAD -- src/lib/engine/svaso.ts \
                 src/lib/engine/cherry-picker.ts \
                 src/lib/engine/tht.ts \
                 src/lib/engine/mass-balance.ts \
                 src/lib/engine/sankey.ts \
                 src/lib/engine/true-up.ts \
                 src/lib/actions/batches.ts \
                 src/lib/actions/scenarios.ts
# Expected: empty (no changes)

# 2. Test suite
npm test
# Expected: 615+ base tests PASS + ~25 new cascade tests + ~5 import tests = 645+ total

# 3. Build
npm run build
# Expected: clean, no errors

# 4. Import functional test
# Navigate to /oil/planning → verify ImportSlaughterDays renders
# Upload a test file → verify rows import with feedback

# 5. Database verification
# SELECT count(*) FROM locations;           → 2 (Putten, Nijkerk)
# SELECT count(*) FROM location_yield_profiles; → matches seed count
# SELECT count(*) FROM product_yield_chains;    → matches seed count
```

### QA Report

Write `docs/qa-report-wave6.md`:

```markdown
# Wave 6 QA Report

## Test Results
- Base tests: 615 PASS
- New cascade tests: XX PASS
- New import tests: XX PASS
- Total: XXX PASS, 0 FAIL

## Protected Files
[8 files, diff = 0 lines]

## Build
npm run build: CLEAN

## Database
- locations: 2 rows (Putten, Nijkerk)
- location_yield_profiles: XX rows
- product_yield_chains: XX rows

## Import
- ImportSlaughterDays renders: ✅
- Import with valid data: ✅
- Duplicate detection: ✅

## Decision: GO / NO-GO
```

---

## File Inventory

### New Files

```
supabase/migrations/20260220120000_wave6_locations.sql
supabase/migrations/20260220120001_wave6_location_yield_profiles.sql
supabase/migrations/20260220120002_wave6_product_yield_chains.sql
supabase/seed-wave6.sql

src/lib/engine/availability/cascading.ts
src/lib/engine/availability/__tests__/cascading.test.ts

src/lib/schemas/planning.ts                    (NEW)

docs/qa-report-wave6.md
```

### Modified Files

```
src/lib/actions/planning.ts                    (ADD importSlaughterDays action)
src/app/oil/planning/page.tsx                  (ADD <ImportSlaughterDays /> back)
src/components/oil/planning/ImportSlaughterDays.tsx  (UPDATE: connect to new server action + feedback UI)
```

### NEVER Modify (Protected — as per Wave 5 QA report)

```
src/lib/engine/svaso.ts
src/lib/engine/cherry-picker.ts
src/lib/engine/tht.ts
src/lib/engine/mass-balance.ts
src/lib/engine/sankey.ts
src/lib/engine/true-up.ts
src/lib/actions/batches.ts        ← NB: actions/, niet engine/
src/lib/actions/scenarios.ts      ← NB: actions/, niet engine/
```

---

## Constraints

- **Pure functions only** in the cascade engine — no DB access, no `createClient()`, no async
- **Existing availability.ts is not modified** — `computeTheoreticalAvailability` stays as-is. The new `cascading.ts` is an additional module
- **Seed data comes from Pre-Wave 6** — do not invent new yield numbers. Use the JSON files in `docs/yield-data/`
- **RLS policies** consistent with Wave 4 pattern — `TO authenticated USING(true)` + `TO anon USING(false)`. Reference: `supabase/migrations/20260219200001_rls_policies.sql`
- **No UI changes beyond import** — Wave 7 handles the order entry UI
- **All numbers use kg** — no unit conversions
- **Dutch product names** in seed data and test descriptions

### CRITICAL: Yield Scale Convention

**All yields are stored and used as 0.0–1.0 decimals, NEVER as 0–100 percentages.**

| Layer | Format | Example (23.5%) |
|-------|--------|-----------------|
| Database (`NUMERIC(7,6)`) | 0.0–1.0 | `0.235000` |
| TypeScript types | 0.0–1.0 | `yield_percentage: 0.235` |
| Engine calculations | 0.0–1.0 | `griller_kg * 0.235` |
| Seed JSON files | 0.0–1.0 | `"yield_percentage": 0.235` |
| UI display only | × 100 | `"23,5%"` |

This is consistent with the existing `availability.ts` which uses `0.707`, `0.232`, `0.282`, etc.

**If Pre-Wave 6 seed data uses 0–100 format, convert to 0–1 before inserting.**

---

## Post-flight Checklist

```
□ locations table exists with Putten + Nijkerk
□ location_yield_profiles seeded from Pre-Wave 6
□ product_yield_chains seeded from Pre-Wave 6
□ computeCascadedAvailability() works as pure function
□ All 4 mass balance invariants verified in tests
□ 15+ cascade engine tests PASS
□ 5+ import tests PASS
□ ImportSlaughterDays renders in /oil/planning
□ Import with duplicate detection works
□ Protected file diff = 0
□ npm test: 645+ PASS, 0 FAIL
□ npm run build: CLEAN
□ QA report written
□ Git tag: v0.6-wave6
```

---

## Sequencing

The recommended execution order:

```
1. INFRA_AGENT: Migrations (A0-S1) — tables must exist first
2. INFRA_AGENT: Seed data — yield data must be in DB for testing
3. ENGINE_AGENT: cascading.ts + tests (A1-S1) — can start after seeds
4. IMPORT_AGENT: Restore import (A0-S2) — independent of cascade engine
5. QA_AGENT: Regression gate (A7-S1) — after all agents complete
```

Steps 3 and 4 can run in parallel.
