# SPRINT 11A — Scenario Sandbox v1: Baseline vs Scenario

**Version:** 1.0.0
**Status:** DESIGN COMPLETE
**Author:** Claude Orchestrator
**Date:** 2026-02-12
**Depends On:** Sprint 7 (Canonical Cost Engine) — DONE
**Soft Dependency:** Sprint 8 (Canon Alignment Audit) — recommended but not blocking
**Blocked By:** None (can run on seed/mock data)

---

## 1. OBJECTIVE

Build a **batch-level Scenario Sandbox** that lets the user select an existing batch, view its actual (baseline) cost breakdown, then apply what-if overrides to **yields**, **live cost**, and **SKU selling prices** — and see the full recomputed cost waterfall side-by-side.

### Why This Sprint?

The canonical cost engine (Sprint 7) calculates cost per batch deterministically. But the commercial question is always: *"What if yields were different? What if we paid more/less for live birds? What if market prices shift?"*

Sprint 11A answers that question by wrapping a **read-only sandbox** around the existing engine — no production data is ever modified.

### Relationship to Sprint 10

Sprint 10 (Scenario Engine & Pricing Lab) defines a broader three-type scenario system (price vector, cost, mix). Sprint 11A is a **focused subset**: batch-level sandbox with baseline vs scenario comparison. It serves as:

1. **Proof of concept** for the canonical engine's scenario capability.
2. **Foundation** for Sprint 10's full scenario environment.
3. **Standalone value** — even without Sprint 10, this tool answers immediate commercial questions.

---

## 2. SCOPE

### 2.1 IN SCOPE

| # | Feature | Description |
|---|---------|-------------|
| 1 | Batch selector | Pick any existing batch as sandbox baseline |
| 2 | Baseline panel | Read-only view of actual batch cost waterfall (L0-L6) |
| 3 | Scenario panel | Editable copy with override inputs |
| 4 | Yield overrides | Override individual part yields (kg) for all joint + by-products |
| 5 | Live cost override | Override live price per kg (€/kg) |
| 6 | SKU price overrides | Override shadow/selling prices per part (€/kg) |
| 7 | SVASO reallocation | Full SVASO recalculation when prices change |
| 8 | Joint pool recompute | Joint cost pool recalculation when live cost changes |
| 9 | Mass balance guardrail | Hard block: sum of scenario yields must equal griller weight |
| 10 | Run Scenario button | Explicit trigger — no real-time recompute |
| 11 | Delta display | Absolute and percentage deltas per line item |
| 12 | Save scenario | Persist scenario inputs + results to database |
| 13 | Load scenario | Retrieve and re-apply saved scenarios |
| 14 | CSV export | Export baseline vs scenario comparison |
| 15 | Disclaimer banner | Mandatory simulation disclaimer on all sandbox views |

### 2.2 OUT OF SCOPE

| # | Excluded | Reason |
|---|----------|--------|
| 1 | Mix scenarios (customer-level) | Sprint 10 scope |
| 2 | Multi-batch comparison | Future enhancement |
| 3 | ABC cost driver overrides (Level 5) | Complexity — Phase 2 |
| 4 | Packaging cost overrides | Complexity — Phase 2 |
| 5 | Real-time recompute (as-you-type) | Performance risk, explicit "Run" preferred |
| 6 | Collaborative/multi-user scenarios | Single-user internal tool |
| 7 | Automated price optimization | Violates canon: no automatic advice |
| 8 | Production data modification | Sandbox is read-only by definition |
| 9 | Changes to canonical-cost.ts | Engine is frozen; sandbox wraps around it |
| 10 | Schema migrations on existing tables | New tables only |

---

## 3. UX / SCREENS

### 3.1 Route

```
/oil/sandbox                    → Scenario list + "New Sandbox" button
/oil/sandbox/[scenarioId]       → Baseline vs Scenario split view
```

### 3.2 Layout: Split View

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ SIMULATIE — Dit is een what-if scenario,             │
│    geen actuele kostprijs of aanbeveling.                │
├────────────────────────┬─────────────────────────────────┤
│   BASELINE (Actuals)   │   SCENARIO (What-if)            │
│   Batch: 2026-W05-001  │   "Hogere filetprijs +15%"      │
├────────────────────────┼─────────────────────────────────┤
│ L0 Landed Cost         │ L0 Landed Cost          [Δ]     │
│   Live: €1.12/kg       │   Live: €1.25/kg ✏      [+€.13] │
│   Transport: €234      │   Transport: €234               │
│   Catching: €89        │   Catching: €89                 │
│   Slaughter: €0.18/hd  │   Slaughter: €0.18/hd           │
├────────────────────────┼─────────────────────────────────┤
│ L1 Joint Cost Pool     │ L1 Joint Cost Pool       [Δ]    │
│   €4,521.30            │   €5,012.80             [+€491] │
├────────────────────────┼─────────────────────────────────┤
│ L2 By-product Credit   │ L2 By-product Credit            │
│   -€186.40             │   -€192.60 (yield Δ)    [Δ]     │
├────────────────────────┼─────────────────────────────────┤
│ L3 SVASO Allocation    │ L3 SVASO Allocation      [Δ]    │
│   breast_cap: 42.1%    │   breast_cap: 48.5% ✏   [+6.4] │
│   legs: 38.7%          │   legs: 33.8%            [-4.9] │
│   wings: 19.2%         │   wings: 17.7%           [-1.5] │
│   k-factor: 0.847      │   k-factor: 0.731        [Δ]    │
├────────────────────────┼─────────────────────────────────┤
│ L4 Mini-SVASO          │ L4 Mini-SVASO             [Δ]   │
│   (sub-cuts if any)    │   (recalculated)                │
├────────────────────────┼─────────────────────────────────┤
│ L5 ABC Costs           │ L5 ABC Costs                    │
│   (unchanged)          │   (unchanged in v1)             │
├────────────────────────┼─────────────────────────────────┤
│ L6 Full SKU Cost       │ L6 Full SKU Cost          [Δ]   │
│   per SKU breakdown    │   recalculated per SKU          │
├────────────────────────┼─────────────────────────────────┤
│ L7 NRV Assessment      │ L7 NRV Assessment         [Δ]   │
│   margin per part      │   margin with scenario prices   │
├────────────────────────┴─────────────────────────────────┤
│  [💾 Save]  [📊 Export CSV]  [▶ Run Scenario]            │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Interaction Flow

```
1. User navigates to /oil/sandbox
2. Clicks "Nieuw Scenario"
3. Selects batch from dropdown (populated from production_batches)
4. System loads baseline data (full L0-L7 waterfall)
5. Left panel shows baseline (read-only)
6. Right panel shows editable scenario copy
7. User modifies inputs (yields, live cost, prices) via ✏ fields
8. User clicks "▶ Run Scenario"
9. System validates mass balance → BLOCK if violated
10. System recomputes full waterfall for scenario side
11. Deltas shown per line item
12. User can save (💾) or export (📊)
```

### 3.4 UI Components

| Component | Type | Notes |
|-----------|------|-------|
| `ScenarioBatchSelector` | Dropdown | Lists batches with ref + date |
| `CostWaterfallPanel` | Display | Renders L0-L7 for one side |
| `ScenarioInputField` | Input | Number field with baseline hint |
| `YieldOverrideGrid` | Form grid | All parts with kg + % columns |
| `PriceOverrideGrid` | Form grid | Part code + €/kg |
| `MassBalanceIndicator` | Status bar | Green/red with kg delta |
| `DeltaChip` | Badge | Shows +/- delta with color |
| `ScenarioDisclaimer` | Banner | Sticky top, always visible |
| `RunScenarioButton` | Button | Triggers recompute pipeline |

---

## 4. SCENARIO INPUTS MODEL

### 4.1 TypeScript Interface

```typescript
/**
 * Complete scenario input that the user can override.
 * All fields optional — null/undefined means "use baseline value".
 */
export interface ScenarioInput {
  // Metadata
  scenario_id: string;          // UUID, auto-generated
  scenario_name: string;        // User-provided label
  description?: string;
  batch_id: string;             // Source batch (baseline)

  // Level 0: Landed cost overrides
  live_price_per_kg?: number;   // Override live bird price (€/kg)

  // Level 2: Yield overrides (kg per part)
  yield_overrides?: YieldOverride[];

  // Level 3: Shadow price overrides (€/kg per part)
  price_overrides?: PriceOverride[];
}

export interface YieldOverride {
  part_code: string;            // e.g. 'breast_cap', 'legs', 'wings', 'back_carcass'
  weight_kg: number;            // New absolute weight in kg
}

export interface PriceOverride {
  part_code: string;            // Joint product or sub-cut code
  price_per_kg: number;         // New shadow/selling price (€/kg)
}
```

### 4.2 Override Behavior Matrix

| Override | Affects Level | Cascade Effect |
|----------|---------------|----------------|
| `live_price_per_kg` | L0 (Landed Cost) | → L1 (Joint Pool) → L2 (Net Joint) → L3 (SVASO amounts) → L6 (SKU cost) |
| `yield_overrides` | L2 (By-product credit), L3 (SVASO weights) | → L2 recalc → L3 reweight → L4 (if sub-cuts) → L6 |
| `price_overrides` | L3 (SVASO allocation factors) | → L3 redistribution → L4 → L6 → L7 (NRV) |

### 4.3 What Does NOT Change in v1

| Fixed Input | Reason |
|-------------|--------|
| Transport cost | Not a sandbox variable in v1 |
| Catching fee | Not a sandbox variable in v1 |
| Slaughter fee per head | Not a sandbox variable in v1 |
| DOA count/threshold | Baseline fact |
| Bird count | Baseline fact |
| Griller weight | Derived from yields (mass balance anchor) |
| BY_PRODUCT_RATE_PER_KG (€0.20) | Canon-locked constant |
| ABC cost drivers (L5) | Out of scope for v1 |
| Packaging costs | Out of scope for v1 |

---

## 5. RECOMPUTE PIPELINE

### 5.1 Pipeline Architecture

The sandbox recompute wraps around the **existing** canonical cost engine functions. No engine modifications needed.

```
┌─────────────────────────────────────────────────────┐
│              SCENARIO RECOMPUTE PIPELINE            │
│                                                     │
│  Input: ScenarioInput + BaselineBatchData           │
│                                                     │
│  Step 1: MERGE overrides onto baseline              │
│    ├─ live_price_per_kg → merged into LandedCostInput│
│    ├─ yield_overrides → merged into JointProductInput│
│    └─ price_overrides → merged into shadow_prices    │
│                                                     │
│  Step 2: VALIDATE mass balance                      │
│    └─ sum(yield_overrides) must equal griller_weight │
│    └─ If FAIL → ABORT with error message            │
│                                                     │
│  Step 3: RECOMPUTE L0 (Landed Cost)                 │
│    └─ calculateLandedCost(mergedInput)              │
│                                                     │
│  Step 4: RECOMPUTE L1 (Joint Cost Pool)             │
│    └─ calculateJointCostPool(...)                   │
│                                                     │
│  Step 5: RECOMPUTE L2 (By-product Credit)           │
│    └─ calculateByProductCredit(...)                  │
│    └─ Uses overridden by-product weights if any     │
│                                                     │
│  Step 6: RECOMPUTE L3 (SVASO Allocation)            │
│    └─ calculateSVASOAllocation(...)                  │
│    └─ Uses overridden prices for TMV calculation    │
│                                                     │
│  Step 7: RECOMPUTE L4 (Mini-SVASO) if applicable    │
│    └─ calculateMiniSVASO(...)                        │
│                                                     │
│  Step 8: PASS-THROUGH L5 (ABC Costs — unchanged)    │
│                                                     │
│  Step 9: RECOMPUTE L6 (Full SKU Cost)               │
│    └─ calculateFullSKUCost(...)                      │
│    └─ New meat_cost_per_kg from L3/L4               │
│                                                     │
│  Step 10: RECOMPUTE L7 (NRV Assessment)             │
│    └─ calculateNRV(...)                              │
│    └─ Uses overridden selling prices if any         │
│                                                     │
│  Output: ScenarioResult (full L0-L7)                │
└─────────────────────────────────────────────────────┘
```

### 5.2 Engine Wrapper Function

```typescript
/**
 * Orchestrates the full scenario recompute.
 * Calls canonical engine functions in sequence.
 * DOES NOT modify canonical-cost.ts.
 *
 * Location: src/lib/engine/scenario-sandbox.ts (NEW FILE)
 */
export function runScenarioSandbox(
  baseline: BaselineBatchData,
  input: ScenarioInput,
): ScenarioResult {
  // 1. Merge overrides
  const merged = mergeOverrides(baseline, input);

  // 2. Validate mass balance (HARD BLOCK)
  const mbCheck = validateScenarioMassBalance(merged);
  if (!mbCheck.valid) {
    return { success: false, error: mbCheck.error, baseline, scenario: null };
  }

  // 3-10. Run canonical engine pipeline
  const l0 = calculateLandedCost(merged.landedCostInput);
  const l1 = calculateJointCostPool(merged.batch_id, l0, merged.slaughter_fee, merged.griller_weight_kg);
  const l2 = calculateByProductCredit(merged.batch_id, l1, merged.byProducts);
  const l3 = calculateSVASOAllocation(merged.batch_id, l2, merged.jointProducts);
  // ... L4-L7

  return {
    success: true,
    error: null,
    baseline: baseline.waterfall,
    scenario: { l0, l1, l2, l3, /* ... */ l7 },
    deltas: computeDeltas(baseline.waterfall, { l0, l1, l2, l3 }),
    meta: {
      computed_at: new Date().toISOString(),
      engine_version: CANONICAL_ENGINE_VERSION,
      disclaimer: SCENARIO_DISCLAIMER,
    },
  };
}
```

### 5.3 Merge Logic

```typescript
function mergeOverrides(baseline: BaselineBatchData, input: ScenarioInput): MergedInput {
  // Start with baseline values
  const merged = structuredClone(baseline);

  // Override live price if provided
  if (input.live_price_per_kg !== undefined) {
    merged.landedCostInput.live_price_per_kg = input.live_price_per_kg;
  }

  // Override yields if provided
  if (input.yield_overrides?.length) {
    for (const yo of input.yield_overrides) {
      const target = merged.allParts.find(p => p.part_code === yo.part_code);
      if (target) target.weight_kg = yo.weight_kg;
    }
  }

  // Override shadow prices if provided
  if (input.price_overrides?.length) {
    for (const po of input.price_overrides) {
      const target = merged.jointProducts.find(p => p.part_code === po.part_code);
      if (target) target.shadow_price_per_kg = po.price_per_kg;
    }
  }

  return merged;
}
```

---

## 6. MASS BALANCE GUARDRAIL

### 6.1 Rule

> **The sum of all scenario part weights MUST equal the griller weight of the baseline batch.**

This is the physical law: a griller is disassembled into parts. The total weight of parts cannot exceed (or fall short of) the griller weight (within measurement tolerance).

### 6.2 Validation

```typescript
export function validateScenarioMassBalance(
  merged: MergedInput
): { valid: boolean; error?: string; delta_kg?: number } {
  const griller_kg = merged.griller_weight_kg;
  const parts_total_kg = merged.allParts.reduce((sum, p) => sum + p.weight_kg, 0);
  const delta_kg = Math.abs(parts_total_kg - griller_kg);
  const tolerance_kg = griller_kg * (DEFAULT_VALIDATION_CONFIG.balance_tolerance_pct / 100);

  if (delta_kg > tolerance_kg) {
    return {
      valid: false,
      error: `Massabalans geschonden: onderdelen wegen ${parts_total_kg.toFixed(2)} kg, `
           + `griller weegt ${griller_kg.toFixed(2)} kg `
           + `(verschil: ${delta_kg.toFixed(2)} kg, tolerantie: ${tolerance_kg.toFixed(2)} kg)`,
      delta_kg,
    };
  }

  return { valid: true, delta_kg };
}
```

### 6.3 UX Integration

```
┌─────────────────────────────────────────────┐
│  MASSABALANS                                │
│  Griller: 1,842.5 kg                       │
│  Onderdelen: 1,842.3 kg                    │
│  Verschil: 0.2 kg (0.01%)                  │
│  Status: ✅ OK                              │
└─────────────────────────────────────────────┘
```

If the user changes yields that break the balance:

```
┌─────────────────────────────────────────────┐
│  ⛔ MASSABALANS GESCHONDEN                  │
│  Griller: 1,842.5 kg                       │
│  Onderdelen: 1,923.0 kg                    │
│  Verschil: +80.5 kg (4.37%)               │
│  ▶ Run Scenario is GEBLOKKEERD             │
│  Pas de yields aan zodat het totaal klopt.  │
└─────────────────────────────────────────────┘
```

### 6.4 Auto-Balance Option (UX Convenience)

When the user changes one part's yield, offer an **optional** auto-distribute button that proportionally adjusts remaining parts to maintain the balance. This is a UI helper, NOT an engine feature.

```
[🔄 Verdeel verschil over overige delen] — optional, user-triggered
```

---

## 7. DATA MODEL PROPOSAL

### 7.1 New Tables

#### `sandbox_scenarios`

```sql
CREATE TABLE sandbox_scenarios (
  scenario_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name   TEXT NOT NULL,
  description     TEXT,
  batch_id        UUID NOT NULL REFERENCES production_batches(id),
  inputs          JSONB NOT NULL,       -- ScenarioInput (overrides only)
  results         JSONB,                -- ScenarioResult (full L0-L7 output), NULL until computed
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'computed', 'saved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT DEFAULT 'system'
);

-- Index for batch lookup
CREATE INDEX idx_sandbox_scenarios_batch ON sandbox_scenarios(batch_id);

-- Trigger for updated_at
CREATE TRIGGER trg_sandbox_scenarios_updated
  BEFORE UPDATE ON sandbox_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Separate table (not `saved_scenarios`) | `sandbox_scenarios` | Sprint 10 may have broader `saved_scenarios`; keep sandbox independent |
| JSONB for inputs | Yes | Flexible schema for yield/price/cost overrides |
| JSONB for results | Yes | Full waterfall result is complex nested structure |
| No `scenario_results` table | Single table | v1 is simple; one scenario = one row |
| No RLS policies | Correct | Internal tool, single-user |
| Append-friendly | Yes | Old scenarios never deleted, status changes tracked |

### 7.2 Migration

```
supabase/migrations/20260212100119_create_sandbox_scenarios.sql
```

Single migration file. No changes to existing tables.

---

## 8. API DESIGN

### 8.1 Server Actions

All data access via Next.js Server Actions in `src/app/oil/sandbox/actions.ts`.

```typescript
// ── READ ──────────────────────────────────────────────

/** List all batches available for sandbox (dropdown) */
'use server'
export async function getAvailableBatches(): Promise<BatchSummary[]>

/** Load full baseline data for a batch (L0-L7) */
'use server'
export async function loadBaselineData(batchId: string): Promise<BaselineBatchData>

/** List saved scenarios (optionally filtered by batch) */
'use server'
export async function listScenarios(batchId?: string): Promise<ScenarioSummary[]>

/** Load a saved scenario by ID */
'use server'
export async function loadScenario(scenarioId: string): Promise<SavedScenario>


// ── COMPUTE ───────────────────────────────────────────

/** Run the scenario sandbox pipeline (no DB write) */
'use server'
export async function computeScenario(
  batchId: string,
  input: ScenarioInput
): Promise<ScenarioResult>


// ── WRITE ─────────────────────────────────────────────

/** Save scenario (inputs + results) to sandbox_scenarios */
'use server'
export async function saveScenario(
  input: ScenarioInput,
  result: ScenarioResult
): Promise<{ scenario_id: string }>

/** Update scenario name/description */
'use server'
export async function updateScenarioMeta(
  scenarioId: string,
  name: string,
  description?: string
): Promise<void>
```

### 8.2 Engine Module

Pure functions in `src/lib/engine/scenario-sandbox.ts` (NEW FILE).

```typescript
// Core pipeline
export function runScenarioSandbox(baseline, input): ScenarioResult
export function mergeOverrides(baseline, input): MergedInput
export function validateScenarioMassBalance(merged): MassBalanceCheck
export function computeDeltas(baseline, scenario): DeltaResult

// Helpers
export function autoDistributeYield(parts, targetTotal, changedPartCode): YieldOverride[]
```

### 8.3 No REST API

All interactions are Server Actions (Next.js App Router pattern). No separate REST endpoints needed for v1.

---

## 9. EXPORT FORMAT

### 9.1 CSV Export

File: `scenario_{scenario_name}_{date}.csv`

```csv
Level,Line Item,Unit,Baseline,Scenario,Delta,Delta %
L0,Live Price,€/kg,1.12,1.25,+0.13,+11.6%
L0,Transport,€,234.00,234.00,0.00,0.0%
L0,Catching,€,89.00,89.00,0.00,0.0%
L0,Slaughter,€/head,0.18,0.18,0.00,0.0%
L0,Total Landed Cost,€,5210.40,5701.90,+491.50,+9.4%
L1,Joint Cost Pool,€,4521.30,5012.80,+491.50,+10.9%
L2,By-product Credit,€,-186.40,-192.60,-6.20,+3.3%
L2,Net Joint Cost,€,4334.90,4820.20,+485.30,+11.2%
L3,SVASO breast_cap,% alloc,42.1%,48.5%,+6.4pp,—
L3,SVASO legs,% alloc,38.7%,33.8%,-4.9pp,—
L3,SVASO wings,% alloc,19.2%,17.7%,-1.5pp,—
L3,k-factor,ratio,0.847,0.731,-0.116,—
L3,Cost breast_cap,€/kg,3.42,3.18,-0.24,-7.0%
L3,Cost legs,€/kg,2.89,3.01,+0.12,+4.2%
L3,Cost wings,€/kg,2.15,2.34,+0.19,+8.8%
...
```

### 9.2 CSV Rules

- Header row always present.
- Decimal separator: period (`.`).
- All monetary values in EUR, 2 decimal places.
- All percentages with 1 decimal place.
- Delta % uses percentage points (pp) for allocation shares.
- Empty scenario fields show baseline value (no override).

### 9.3 Export Implementation

Client-side CSV generation (no server round-trip needed). Uses the already-computed `ScenarioResult` to build the CSV string, then triggers browser download.

---

## 10. TEST STRATEGY

### 10.1 Unit Tests (Engine)

Location: `src/lib/engine/__tests__/scenario-sandbox.test.ts`

| Test | Description | Priority |
|------|-------------|----------|
| `mergeOverrides: no overrides` | Returns identical to baseline | P0 |
| `mergeOverrides: live price only` | Only L0 input changed | P0 |
| `mergeOverrides: yield overrides` | Part weights updated, others unchanged | P0 |
| `mergeOverrides: price overrides` | Shadow prices updated | P0 |
| `validateMassBalance: valid` | Sum within tolerance → pass | P0 |
| `validateMassBalance: violated` | Sum exceeds tolerance → block | P0 |
| `validateMassBalance: edge at tolerance` | Exactly at 2% → pass | P1 |
| `runScenarioSandbox: baseline identity` | No overrides → scenario = baseline | P0 |
| `runScenarioSandbox: live cost increase` | Higher cost → L1 increases, SVASO amounts increase, allocation % unchanged | P0 |
| `runScenarioSandbox: price shift` | breast_cap price up → breast_cap gets larger SVASO share | P0 |
| `runScenarioSandbox: yield shift` | More breast_cap kg → by-product credit changes, SVASO weights change | P0 |
| `runScenarioSandbox: mass balance block` | Invalid yields → error result | P0 |
| `computeDeltas: correct signs` | Positive delta for increase, negative for decrease | P0 |
| `computeDeltas: k-factor change` | k-factor recomputes correctly on price shift | P1 |
| `autoDistributeYield: proportional` | Remaining weight distributed proportionally | P1 |
| `runScenarioSandbox: combined overrides` | All three override types simultaneously | P0 |
| `runScenarioSandbox: SVASO only joint products` | Non-joint products excluded from allocation | P0 |
| `runScenarioSandbox: by-product credit rate` | Always €0.20/kg, never scenario-dependent | P0 |
| `runScenarioSandbox: Decimal.js precision` | No floating point drift in financial calculations | P1 |

### 10.2 Integration Tests

| Test | Description |
|------|-------------|
| `loadBaselineData: real batch` | Loads complete L0-L7 from views |
| `saveScenario: round-trip` | Save → load → inputs match |
| `computeScenario: server action` | Full pipeline via Server Action |

### 10.3 Test Data

Use existing test fixtures from Sprint 7 tests. If no batch data exists in DB, create a seed fixture:

```typescript
export const SANDBOX_TEST_BATCH: BaselineBatchData = {
  batch_id: 'test-sandbox-001',
  batch_ref: '2026-W05-001',
  griller_weight_kg: 1842.5,
  // ... full L0-L7 baseline
};
```

### 10.4 Acceptance Criteria

- [ ] All P0 unit tests pass
- [ ] `npm test` passes (no regressions)
- [ ] `npm run build` succeeds
- [ ] Mass balance violation blocks Run Scenario
- [ ] Baseline panel shows correct actuals
- [ ] Scenario panel shows correct recalculated values
- [ ] Deltas are correct (manually verified against spreadsheet)
- [ ] Save/load round-trip preserves all data
- [ ] CSV export matches on-screen data
- [ ] Disclaimer banner visible on all sandbox pages

---

## 11. ROLLOUT PLAN

### 11.1 Implementation Phases

```
Phase 1: Engine + Tests (2-3 sessions)
  ├─ Create scenario-sandbox.ts
  ├─ Implement mergeOverrides, validateMassBalance, runScenarioSandbox
  ├─ Write all P0 unit tests
  └─ Verify: npm test pass

Phase 2: Data Layer (1 session)
  ├─ Create migration for sandbox_scenarios
  ├─ Create Server Actions (actions.ts)
  ├─ Implement save/load
  └─ Verify: npm run build pass

Phase 3: UI (2-3 sessions)
  ├─ Create /oil/sandbox route + page
  ├─ Build split-view layout
  ├─ Implement scenario input forms
  ├─ Wire Run Scenario → engine → display
  ├─ Add mass balance indicator
  ├─ Add disclaimer banner
  └─ Verify: visual inspection + build

Phase 4: Export + Polish (1 session)
  ├─ Implement CSV export
  ├─ Add loading states
  ├─ Error handling
  └─ Final verification: test + build + lint
```

### 11.2 Estimated Effort

| Phase | Sessions | Risk |
|-------|----------|------|
| Engine + Tests | 2-3 | Low — wraps existing functions |
| Data Layer | 1 | Low — single table + CRUD |
| UI | 2-3 | Medium — split view layout complexity |
| Export + Polish | 1 | Low |
| **Total** | **6-8 sessions** | |

### 11.3 Dependencies

```
Required BEFORE Sprint 11A:
  ✅ Sprint 7 (Canonical Cost Engine) — DONE

Recommended but not blocking:
  ⚠ Sprint 8 (Canon Alignment Audit) — verifies engine correctness

NOT required:
  ✗ Sprint 9 (Data Import) — sandbox works on seed/mock data
  ✗ Sprint 10 (Full Scenario Engine) — 11A is independent subset
```

---

## 12. RISKS & MITIGATIONS

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R1 | Baseline data incomplete (empty DB) | Cannot demo sandbox | High | Use seed fixtures for testing; sandbox works with any batch that has yields |
| R2 | Canonical engine has undiscovered bugs | Scenario results misleading | Medium | Sprint 8 (Canon Audit) should run first; sandbox exposes bugs via comparison |
| R3 | Mass balance tolerance too tight/loose | False blocks or invalid scenarios | Low | Use same 2% tolerance as mass-balance.ts; adjustable via config |
| R4 | JSONB schema drift | Old scenarios incompatible after engine changes | Low | Version-stamp all saved results; migration path for JSONB schema |
| R5 | Performance on large batches | Slow recompute | Low | Engine is pure math (ms-level); no DB calls during compute |
| R6 | User confuses scenario with actuals | Commercial misjudgment | Medium | Mandatory disclaimer banner (canon rule); scenario pages visually distinct |
| R7 | Decimal.js precision loss in merge | Financial calculation errors | Low | All merge operations use Decimal.js; never raw floats |
| R8 | Sprint 10 incompatibility | Rework needed | Low | sandbox_scenarios table is separate; Sprint 10 can extend or migrate |

---

## APPENDIX A: KEY ENGINE CONSTANTS (Reference)

```typescript
// From canonical-cost.ts — DO NOT MODIFY
JOINT_PRODUCT_CODES = ['breast_cap', 'legs', 'wings']
BY_PRODUCT_RATE_PER_KG = 0.20
SCENARIO_DISCLAIMER = 'Dit is een simulatie gebaseerd op aannames...'

// From mass-balance.ts — DO NOT MODIFY
balance_tolerance_pct = 2.0
max_unaccounted_pct = 5.0
expected_parts_count = 5
```

## APPENDIX B: File Map (New Files)

```
src/
├── lib/engine/
│   └── scenario-sandbox.ts          # NEW — sandbox engine wrapper
│   └── __tests__/
│       └── scenario-sandbox.test.ts  # NEW — unit tests
├── app/oil/sandbox/
│   ├── page.tsx                      # NEW — scenario list
│   ├── actions.ts                    # NEW — Server Actions
│   ├── loading.tsx                   # NEW — loading skeleton
│   └── [scenarioId]/
│       ├── page.tsx                  # NEW — split-view sandbox
│       └── loading.tsx               # NEW — loading skeleton
├── components/sandbox/
│   ├── ScenarioBatchSelector.tsx     # NEW
│   ├── CostWaterfallPanel.tsx        # NEW
│   ├── ScenarioInputField.tsx        # NEW
│   ├── YieldOverrideGrid.tsx         # NEW
│   ├── PriceOverrideGrid.tsx         # NEW
│   ├── MassBalanceIndicator.tsx      # NEW
│   ├── DeltaChip.tsx                 # NEW
│   ├── ScenarioDisclaimer.tsx        # NEW
│   └── RunScenarioButton.tsx         # NEW

supabase/migrations/
│   └── 20260212100119_create_sandbox_scenarios.sql  # NEW
```

---

*This document is the authoritative specification for Sprint 11A. Implementation must follow AGENT_RULES.md and pass all gates in UNIFIED_DEFINITION_OF_DONE.md.*
