# Validation Batch Test Instructions

**Sprint:** 8 (Canon Alignment)
**Purpose:** Verify canonical engine produces correct results
**Status:** Ready to execute

---

## OBJECTIVE

Run one canonical batch through the complete 0-7 level pipeline to verify:
1. Total joint pool calculated correctly
2. k-factor matches expected value
3. Allocated costs sum to net joint cost (±€0.01)
4. Mass balance within ±2% tolerance
5. No unexpected errors or warnings

---

## PREREQUISITES

- ✅ Sprint 8 canon validation complete (8/8 PASS)
- ✅ Deprecated functions marked
- ✅ Shadow prices documented
- ✅ Database at migration 118
- ✅ npm test passing

---

## VALIDATION BATCH PARAMETERS

Use the Validatiegolf 1 batch or any production batch with complete data:

```
Batch ID: VALIDATIE-2025-09-22
Live weight: 2,448 kg
Bird count: 1,200
Live price: €2.60/kg
Transport: €91.68
Slaughter fee: €0.276/head
```

---

## EXECUTION STEPS

### Option A: Via Batch Input UI

1. Navigate to `/oil/batch-input/new`
2. Enter validation batch parameters
3. Submit batch
4. Navigate to batch detail page
5. Verify cost waterfall displays correctly
6. Check k-factor value

### Option B: Via Test Suite

Run the canonical cost engine test:

```bash
npm test -- canonical-cost.test.ts
```

Expected: All tests PASS

### Option C: Via Node REPL

```typescript
import {
  calculateLandedCost,
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation
} from '@/lib/engine/canonical-cost';

// 1. Level 0: Landed Cost
const landed = calculateLandedCost({
  batch_id: 'TEST-001',
  input_live_kg: 2448,
  input_count: 1200,
  live_price_per_kg: 2.60,
  transport_cost_eur: 91.68,
  catching_fee_eur: 0,
  slaughter_fee_per_head: 0.276,
  doa_count: 0,
  doa_threshold_pct: 0.02
});

console.log('Landed cost:', landed.landed_cost_eur);

// 2. Level 1: Joint Cost Pool
const joint = calculateJointCostPool(
  'TEST-001',
  landed,
  1200 * 0.276, // Slaughter fee
  1728 // Griller weight (70.6% yield)
);

console.log('Joint cost pool:', joint.joint_cost_pool_eur);
console.log('Griller cost/kg:', joint.griller_cost_per_kg);

// 3. Level 2: By-Product Credit
const byProducts = [
  { id: 'blood', type: 'blood', weight_kg: 66 },
  { id: 'feathers', type: 'feathers', weight_kg: 115 },
  { id: 'back', type: 'back_carcass', weight_kg: 202 },
];

const netJoint = calculateByProductCredit('TEST-001', joint, byProducts);

console.log('By-product credit:', netJoint.by_product_credit_eur);
console.log('Net joint cost:', netJoint.net_joint_cost_eur);

// 4. Level 3: SVASO Allocation
const jointProducts = [
  { part_code: 'breast_cap', weight_kg: 604, shadow_price_per_kg: 9.50 },
  { part_code: 'legs', weight_kg: 743, shadow_price_per_kg: 5.50 },
  { part_code: 'wings', weight_kg: 179, shadow_price_per_kg: 4.50 },
];

const svaso = calculateSVASOAllocation('TEST-001', netJoint, jointProducts);

console.log('k-factor:', svaso.k_factor);
console.log('k-factor interpretation:', svaso.k_factor_interpretation);
console.log('TMV:', svaso.total_market_value_eur);
console.log('Reconciliation delta:', svaso.reconciliation_delta_eur);

// Verify reconciliation
if (Math.abs(svaso.reconciliation_delta_eur) < 0.01) {
  console.log('✅ PASS: Reconciliation within tolerance');
} else {
  console.log('❌ FAIL: Reconciliation exceeds €0.01');
}

// Verify k-factor logic
if (svaso.k_factor < 1 && svaso.k_factor_interpretation === 'PROFITABLE') {
  console.log('✅ PASS: k-factor interpretation correct');
} else if (svaso.k_factor >= 1) {
  console.log('⚠️ WARNING: Batch is not profitable (k ≥ 1)');
}
```

---

## EXPECTED RESULTS

### Level 0: Landed Cost
- Landed cost: €6,360 - €6,370
- Per-kg live: €2.60
- No abnormal DOA variance

### Level 1: Joint Cost Pool
- Joint cost pool: €6,690 - €6,700
- Griller cost/kg: €3.87 - €3.88
- Griller yield: 70.5% - 70.6%

### Level 2: By-Product Credit
- By-product credit: €76.60 (383 kg × €0.20)
- Net joint cost: €6,613 - €6,623

### Level 3: SVASO Allocation
- TMV: €9,525 - €9,535
- k-factor: 0.69 - 0.70 (PROFITABLE)
- Reconciliation delta: < €0.01

### Allocated Costs per kg
- Breast cap: €6.55 - €6.65/kg
- Legs: €3.80 - €3.90/kg
- Wings: €3.10 - €3.20/kg

---

## VALIDATION CHECKLIST

| Check | Expected | Status |
|-------|----------|--------|
| Landed cost calculated | ✅ EUR amount | |
| Joint cost pool = landed + slaughter | ✅ Match | |
| By-product credit = weight × €0.20 | ✅ Match | |
| Net joint cost = joint − by-product | ✅ Match | |
| TMV = Σ(weight × shadow_price) | ✅ Match | |
| k-factor = net_joint / TMV | ✅ Match | |
| k < 1 → PROFITABLE | ✅ Correct interpretation | |
| Allocated costs sum = net joint cost | ✅ Within €0.01 | |
| No errors in audit trail | ✅ Clean | |
| No TypeScript errors | ✅ Compiles | |

---

## SUCCESS CRITERIA

**Sprint 8 validation batch PASSES if:**
1. ✅ All calculations complete without errors
2. ✅ Reconciliation delta < €0.01
3. ✅ k-factor interpretation matches formula (k < 1 = PROFITABLE)
4. ✅ Audit trail contains no warnings
5. ✅ Results are deterministic (same input → same output)

---

## NOTES FOR USER

Since the CLI orchestrator doesn't have direct database access in this session, the actual batch run should be executed by you in your development environment using one of the three options above.

The canonical engine has been validated at the code level (8/8 canon rules PASS). This validation batch test is a **smoke test** to confirm end-to-end integration works correctly.

If you encounter any issues during validation batch execution, the most likely causes are:
1. Input data out of range (e.g., negative weights)
2. Missing shadow prices for a product
3. Division by zero (TMV = 0)

All of these scenarios have defensive checks in the canonical engine and should produce clear error messages.

---

**Status:** Ready for execution. Execute before marking Sprint 8 as DONE.
