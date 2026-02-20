# PRE-WAVE 6 — Yield Dataset & Mass Balance Validation

## Context

You are working on the OIL Dashboard (Oranjehoen Intelligence Layer), a Next.js 15 + Supabase poultry business intelligence platform. Phase 1 (Waves 1-5) is complete with 615 tests passing.

Phase 2 introduces a **Putten → Nijkerk cascade model**: Putten slaughters chickens and makes primary cuts (borstkap, zadels, vleugels). Products can be sold at Putten OR forwarded to Nijkerk for further processing (filleting, deboning). What's sold at Putten reduces what goes to Nijkerk.

**Before Wave 6 builds the cascade engine, we need verified yield data.**

Read the full Phase 2 plan: `docs/FASE2_UI_IMPROVEMENT_PLAN.md`

## Your Role

DATA_AGENT — produce mass-balance correct yield data and validation tests. This is a research + data task. You will produce seed data files and test specifications, NOT build engine code.

## Mass Balance Invariants

These four invariants must ALWAYS hold:

```
1) Per parent i:  SoldP_i + Forward_i = P_i        (Forward_i >= 0)
   Every kg of parent is either sold at Putten or forwarded to Nijkerk.

2) Per parent i:  sum_j(yield_ij) <= 1.0
                  Loss_i = Forward_i × (1 - sum_j(yield_ij))
   Child yields from a parent never exceed 100%. The rest is processing loss.

3) Per child j:   ChildFromCascade_j = sum_i(Forward_i × yield_ij)
                  SoldChild_j <= ChildAvail_j
   You can never sell more child product than what the cascade produces.

4) Global:        sum(SoldP) + sum(SoldChild) + sum(Loss) <= G
   Total sold + loss never exceeds griller kg.
```

## Task A — Yield Tables

Construct seed data for these tables (schemas defined in the Phase 2 plan):

### 1. `location_yield_profiles` (griller → parent parts at Putten)

Use JA757 standard yields. The existing `AvailabilityTable` component already uses these:
- Read `src/lib/engine/availability/availability.ts` to find the current JA757 yields
- These are the baseline parent yields for Putten

Fill in any missing products that Putten sells directly (hele hoen sizes, drumsticks, dij anatomisch, orgaan-types from the Storteboom Excel).

### 2. `product_yield_chains` (parent → child for Nijkerk processing)

Known cascade chains:

```
Borstkap → OH Filet half met haas    (estimate: ~42%)
         → OH Filet half zonder haas  (estimate: ~35%)
         → Haasjes apart              (estimate: ~8%)
         → Vel/trim/loss              (remainder: ~15%)

Zadel    → Dijfilet                   (estimate: ~35%)
         → Drumsticks                 (estimate: ~30%)
         → Drumvlees                  (estimate: ~20%)
         → Rest/trim/loss             (remainder: ~15%)
```

**For each yield: mark as KNOWN (measured/confirmed) or ESTIMATED (assumption).**

The Storteboom Excel was analyzed earlier. The file is at:
`C:\Users\leend\A leenders\Oranjehoen - Documenten\Kopie van BEstelschema Storteboom_.xlsx`

Also check the existing products table for product IDs:
```sql
SELECT id, description FROM products;
```
Use `src/lib/actions/` to understand how Supabase queries work in this project.

### 3. `locations` seed data

```
Putten:   code='putten',  type='primary',   day_offset=0
Nijkerk:  code='nijkerk', type='secondary', day_offset=1
```

## Task B — Worked Example (1000 birds)

Create a complete numerical walkthrough:

```
Input: 1000 birds × 2.65 kg avg = 2,650 kg live weight
Griller: 2,650 × 70.4% = 1,865.6 kg
```

For each parent product:
- P_i (available at Putten)
- SoldP_i (pick a plausible scenario — e.g., 30% sold at Putten)
- Forward_i (= P_i - SoldP_i)

For each child product:
- ChildFromCascade_j (= Forward × yield)
- Loss_i per parent

**Verify all 4 invariants numerically with exact kg values.**

## Task C — Deliverables

Write these files:

### 1. `docs/yield-data/locations.seed.json`
```json
[
  { "code": "putten", "name": "Putten", ... },
  { "code": "nijkerk", "name": "Nijkerk", ... }
]
```

### 2. `docs/yield-data/location_yield_profiles.seed.json`
Map product descriptions to the existing product IDs from the database.
If products don't exist yet, create a `docs/yield-data/new_products.seed.json` with products that need to be added.

### 3. `docs/yield-data/product_yield_chains.seed.json`
With source/target location references and yield_pct.

### 4. `docs/yield-data/mass_balance_test_cases.json`
10+ test scenarios for vitest:
```json
[
  {
    "name": "full_cascade_no_putten_sales",
    "birds": 1000,
    "avg_weight_kg": 2.65,
    "griller_yield_pct": 70.4,
    "putten_sales": {},
    "expected": { ... }
  },
  {
    "name": "partial_putten_sales",
    ...
  }
]
```

Test scenarios must include:
- Full cascade (nothing sold at Putten)
- All sold at Putten (nothing forwarded)
- Partial (mixed)
- Oversubscribed primary (SoldP > P — should be clamped)
- Single parent product only
- Zero birds edge case
- Large batch (40,000 birds)
- Multiple parents forwarded
- Verify loss calculations
- Verify global invariant

### 5. `docs/yield-data/YIELD_REPORT.md`
One-page summary:
- Table of all yields with KNOWN/ESTIMATED flags
- Which data came from JA757 vs Storteboom Excel vs assumption
- What Phase 3 needs to measure to replace estimated yields
- Recommended table columns for Phase 3 rolling yield history (document only, don't build)

## Constraints

- **DO NOT** build engine code, components, or server actions
- **DO NOT** implement EWMA, rolling averages, or actual yield integration
- **DO NOT** modify any existing source files
- **DO** create files only in `docs/yield-data/` directory
- **DO** read existing code to understand product IDs, yield references, and data structures
- Everything stays theoretical (JA757-based). Structure for Phase 3 swap.

## Pre-flight

```
□ Read docs/FASE2_UI_IMPROVEMENT_PLAN.md
□ Read src/lib/engine/availability/availability.ts (current JA757 yields)
□ Query products table for existing product IDs
□ Read Storteboom Excel for product list reference
```

## Post-flight

```
□ All 5 deliverable files created in docs/yield-data/
□ All 4 invariants verified in worked example
□ KNOWN vs ESTIMATED marked for every yield
□ 10+ test cases with expected outputs
□ No existing files modified
```
