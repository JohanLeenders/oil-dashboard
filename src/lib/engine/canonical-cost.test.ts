/**
 * OIL Costing Engine — Phase 1 Test Suite
 *
 * Tests the 7-level cost accounting model per the new CANON.
 *
 * MANDATORY TESTS (per CANON):
 * 1. By-product carries 0 joint cost (back_carcass gets flat rate, no SVASO)
 * 2. SVASO sum = C_netto_joint (exact reconciliation)
 * 3. SVASO fails on scope violation (back_carcass, offal, etc.)
 * 4. NRV cannot influence costing (read-only, frozen object)
 * 5. ABC never affects SVASO (additive only)
 * 6. Mini-SVASO sum = parent allocated cost
 *
 * Plus legacy backward-compatibility tests.
 */

import { describe, it, expect } from 'vitest';
import {
  // New CANON functions
  calculateLandedCost,
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation,
  calculateMiniSVASO,
  calculateABCCosts,
  calculateFullSKUCost,
  calculateNRV,
  assertJointProduct,
  isJointProduct,
  // Constants
  JOINT_PRODUCT_CODES,
  BY_PRODUCT_RATE_PER_KG,
  SCENARIO_DISCLAIMER,
  // Profiles (Sprint 13)
  PROFILE_ORANJEHOEN,
  PROFILE_CUNO_MOORMANN,
  BATCH_PROFILES,
  getBatchProfile,
  type BatchProfile,
  // Legacy backward compatibility
  calculateGrillerCost,
  calculatePrimalAllocation,
  calculateSecondaryProcessingCost,
  calculateSkuCost,
  simulateScenarioImpact,
  generateCostWaterfall,
  calculateLiveToMeatMultiplier,
  getKFactorInterpretation,
  DEFAULT_STD_PRICES,
  JA757_CARCASS_SHARES,
  // Types
  type LandedCostInput,
  type ByProductPhysical,
  type JointProductInput,
  type SubJointCutInput,
  type ABCCostDriver,
  type SkuDefinition,
  type NRVInput,
  type ByProductInput,
  type PrimalCutInput,
  type SecondaryProcessingInput,
  type SkuAssemblyInput,
  type ScenarioPriceVector,
} from './canonical-cost';

// ============================================================================
// TEST DATA — NEW CANON
// ============================================================================

const TEST_LANDED_COST_INPUT: LandedCostInput = {
  batch_id: 'CANON-001',
  input_live_kg: 10000,
  input_count: 5000,
  live_price_per_kg: 2.60,
  transport_cost_eur: 400,
  catching_fee_eur: 150,
  slaughter_fee_per_head: 0.28,
  doa_count: 50,
  doa_threshold_pct: 0.02,
};

const TEST_BY_PRODUCTS: ByProductPhysical[] = [
  { id: 'blood', type: 'blood', weight_kg: 270 },
  { id: 'feathers', type: 'feathers', weight_kg: 470 },
  { id: 'offal', type: 'offal', weight_kg: 350 },
  { id: 'back', type: 'back_carcass', weight_kg: 798 },
];

const TEST_JOINT_PRODUCTS: JointProductInput[] = [
  { part_code: 'breast_cap', weight_kg: 2443, shadow_price_per_kg: 9.50 },
  { part_code: 'legs', weight_kg: 3010, shadow_price_per_kg: 5.50 },
  { part_code: 'wings', weight_kg: 749, shadow_price_per_kg: 4.50 },
];

// Legacy test data (for backward compat tests)
const TEST_LEGACY_BY_PRODUCTS: ByProductInput[] = [
  { id: 'blood', type: 'blood', weight_kg: 270, nrv_price_per_kg: 0.05 },
  { id: 'feathers', type: 'feathers', weight_kg: 470, nrv_price_per_kg: -0.02 },
  { id: 'offal', type: 'offal', weight_kg: 350, nrv_price_per_kg: 0.15 },
];

const TEST_LEGACY_PRIMAL_CUTS: PrimalCutInput[] = [
  { part_code: 'breast_cap', weight_kg: 2443, std_market_price_per_kg: 9.50 },
  { part_code: 'leg_quarter', weight_kg: 3010, std_market_price_per_kg: 5.50 },
  { part_code: 'wings', weight_kg: 749, std_market_price_per_kg: 4.50 },
  { part_code: 'back_carcass', weight_kg: 798, std_market_price_per_kg: 0.50 },
];

// ============================================================================
// LEVEL 0: LANDED COST TESTS
// ============================================================================

describe('Level 0: Landed Cost', () => {
  it('should calculate total landed cost correctly', () => {
    const result = calculateLandedCost(TEST_LANDED_COST_INPUT);
    // 10000 × 2.60 + 400 + 150 = 26550
    expect(result.landed_cost_eur).toBeCloseTo(26550, 0);
  });

  it('should handle normal DOA by absorbing into surviving birds', () => {
    const result = calculateLandedCost(TEST_LANDED_COST_INPUT);
    expect(result.usable_live_kg).toBeLessThan(TEST_LANDED_COST_INPUT.input_live_kg);
    expect(result.abnormal_doa_variance_eur).toBe(0);
  });

  it('should separate abnormal DOA into variance', () => {
    const input: LandedCostInput = {
      ...TEST_LANDED_COST_INPUT,
      doa_count: 200, // 4% > 2% threshold
    };
    const result = calculateLandedCost(input);
    expect(result.abnormal_doa_variance_eur).toBeGreaterThan(0);
  });

  it('should increase per-kg cost when DOA occurs', () => {
    const noDOA = calculateLandedCost({ ...TEST_LANDED_COST_INPUT, doa_count: 0 });
    const withDOA = calculateLandedCost({ ...TEST_LANDED_COST_INPUT, doa_count: 100 });
    expect(withDOA.landed_cost_per_kg).toBeGreaterThan(noDOA.landed_cost_per_kg);
  });

  it('should include audit trail', () => {
    const result = calculateLandedCost(TEST_LANDED_COST_INPUT);
    expect(result.audit_trail.length).toBeGreaterThan(0);
    expect(result.audit_trail[0].step).toBe('Raw Material Cost');
  });
});

// ============================================================================
// LEVEL 1: JOINT COST POOL (C_joint) TESTS
// ============================================================================

describe('Level 1: Joint Cost Pool (C_joint)', () => {
  it('should calculate C_joint = landed + slaughter (NO by-product credit)', () => {
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const slaughter_fee = 1400;
    const result = calculateJointCostPool('CANON-001', landed, slaughter_fee, 7000);

    // C_joint = landed + slaughter, NOT minus by-product credit
    expect(result.joint_cost_pool_eur).toBeCloseTo(landed.landed_cost_eur + slaughter_fee, 2);
  });

  it('should NOT subtract by-product credit at Level 1', () => {
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const slaughter_fee = 1400;
    const result = calculateJointCostPool('CANON-001', landed, slaughter_fee, 7000);

    // Verify: no by_product_credit field in result (it does not exist at this level)
    expect(result.joint_cost_pool_eur).toBe(landed.landed_cost_eur + slaughter_fee);
  });

  it('should calculate griller yield and cost per kg', () => {
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const result = calculateJointCostPool('CANON-001', landed, 1400, 7000);

    expect(result.griller_yield_pct).toBeGreaterThan(0);
    expect(result.griller_cost_per_kg).toBeGreaterThan(0);
    expect(result.griller_cost_per_kg).toBeCloseTo(result.joint_cost_pool_eur / 7000, 2);
  });
});

// ============================================================================
// LEVEL 2: BY-PRODUCT CREDIT TESTS
// ============================================================================

describe('Level 2: By-Product Credit', () => {
  const setupLevel1 = () => {
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    return calculateJointCostPool('CANON-001', landed, 1400, 7000);
  };

  it('should use flat €0.20/kg for ALL by-products (CANON RULE)', () => {
    const level1 = setupLevel1();
    const result = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);

    // Total weight = 270 + 470 + 350 + 798 = 1888 kg
    // Credit = 1888 × 0.20 = 377.60
    const expectedCredit = TEST_BY_PRODUCTS.reduce((s, bp) => s + bp.weight_kg, 0) * BY_PRODUCT_RATE_PER_KG;
    expect(result.by_product_credit_eur).toBeCloseTo(expectedCredit, 2);
  });

  it('should apply SAME rate to back_carcass as to blood (flat rate, no variable NRV)', () => {
    const level1 = setupLevel1();
    const result = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);

    // Every by-product should have rate_per_kg = 0.20
    for (const detail of result.by_product_details) {
      expect(detail.rate_per_kg).toBe(BY_PRODUCT_RATE_PER_KG);
    }
  });

  it('should calculate C_netto_joint = C_joint - credit', () => {
    const level1 = setupLevel1();
    const result = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);

    expect(result.net_joint_cost_eur).toBeCloseTo(
      level1.joint_cost_pool_eur - result.by_product_credit_eur,
      2
    );
  });

  it('should include breakdown per by-product in details', () => {
    const level1 = setupLevel1();
    const result = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);

    expect(result.by_product_details).toHaveLength(TEST_BY_PRODUCTS.length);
    const backDetail = result.by_product_details.find(d => d.type === 'back_carcass');
    expect(backDetail).toBeDefined();
    expect(backDetail!.credit_eur).toBeCloseTo(798 * 0.20, 2);
  });
});

// ============================================================================
// LEVEL 3: SVASO ALLOCATION TESTS
// ============================================================================

describe('Level 3: SVASO Allocation', () => {
  const setupLevel2 = () => {
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const level1 = calculateJointCostPool('CANON-001', landed, 1400, 7000);
    return calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);
  };

  it('should allocate C_netto_joint over exactly 3 joint products', () => {
    const level2 = setupLevel2();
    const result = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    expect(result.allocations).toHaveLength(3);
    expect(result.allocations.map(a => a.part_code).sort()).toEqual(
      ['breast_cap', 'legs', 'wings']
    );
  });

  it('MANDATORY: SVASO sum = C_netto_joint (HARD INVARIANT)', () => {
    const level2 = setupLevel2();
    const result = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    // Sum of allocations MUST equal net_joint_cost_eur
    expect(result.sum_allocated_cost_eur).toBeCloseTo(level2.net_joint_cost_eur, 2);
    expect(result.reconciliation_delta_eur).toBeLessThan(0.01);
    expect(result.is_valid).toBe(true);
  });

  it('MANDATORY: SVASO fails on scope violation (back_carcass)', () => {
    const level2 = setupLevel2();
    const invalidProducts = [
      ...TEST_JOINT_PRODUCTS,
      { part_code: 'back_carcass' as any, weight_kg: 798, shadow_price_per_kg: 0.50 },
    ];

    expect(() => {
      calculateSVASOAllocation('CANON-001', level2, invalidProducts);
    }).toThrow('SCOPE VIOLATION');
  });

  it('MANDATORY: SVASO fails on scope violation (offal)', () => {
    const level2 = setupLevel2();
    const invalidProducts = [
      { part_code: 'offal' as any, weight_kg: 350, shadow_price_per_kg: 0.10 },
    ];

    expect(() => {
      calculateSVASOAllocation('CANON-001', level2, invalidProducts);
    }).toThrow('SCOPE VIOLATION');
  });

  it('should calculate k-factor correctly', () => {
    const level2 = setupLevel2();
    const result = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    const expectedTMV = TEST_JOINT_PRODUCTS.reduce(
      (s, jp) => s + jp.weight_kg * jp.shadow_price_per_kg, 0
    );
    const expectedK = level2.net_joint_cost_eur / expectedTMV;
    expect(result.k_factor).toBeCloseTo(expectedK, 4);
  });

  it('should allocate based on market value, not weight', () => {
    const level2 = setupLevel2();
    const result = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    const breast = result.allocations.find(a => a.part_code === 'breast_cap')!;
    const wings = result.allocations.find(a => a.part_code === 'wings')!;

    // Breast has higher shadow price → higher allocated cost per kg
    expect(breast.allocated_cost_per_kg).toBeGreaterThan(wings.allocated_cost_per_kg);
  });

  it('should have allocation factors summing to 1.0', () => {
    const level2 = setupLevel2();
    const result = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    expect(result.sum_allocation_factors).toBeCloseTo(1.0, 4);
  });

  it('should include audit trail for every allocation step', () => {
    const level2 = setupLevel2();
    const result = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    expect(result.audit_trail.length).toBeGreaterThan(0);
    const svasoSteps = result.audit_trail.filter(e => e.step.startsWith('SVASO Allocation:'));
    expect(svasoSteps).toHaveLength(3);
  });
});

// ============================================================================
// LEVEL 4: MINI-SVASO TESTS
// ============================================================================

describe('Level 4: Mini-SVASO', () => {
  const setupLevel3 = () => {
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const level1 = calculateJointCostPool('CANON-001', landed, 1400, 7000);
    const level2 = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);
    return calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);
  };

  it('should sub-allocate leg cost to thigh_fillet + drum_meat', () => {
    const svaso = setupLevel3();
    const legAllocation = svaso.allocations.find(a => a.part_code === 'legs')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: 1800, shadow_price_per_kg: 7.00 },
      { parent_joint_code: 'legs', sub_cut_code: 'drum_meat', weight_kg: 1210, shadow_price_per_kg: 4.00 },
    ];

    const result = calculateMiniSVASO(legAllocation, subCuts);

    expect(result.sub_allocations).toHaveLength(2);
    expect(result.parent_joint_code).toBe('legs');
  });

  it('MANDATORY: Mini-SVASO sum = parent allocated cost', () => {
    const svaso = setupLevel3();
    const legAllocation = svaso.allocations.find(a => a.part_code === 'legs')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: 1800, shadow_price_per_kg: 7.00 },
      { parent_joint_code: 'legs', sub_cut_code: 'drum_meat', weight_kg: 1210, shadow_price_per_kg: 4.00 },
    ];

    const result = calculateMiniSVASO(legAllocation, subCuts);

    expect(result.sum_sub_allocated_cost_eur).toBeCloseTo(legAllocation.allocated_cost_total_eur, 2);
    expect(result.is_valid).toBe(true);
  });

  it('should handle breast_cap → 100% filet (single sub-cut)', () => {
    const svaso = setupLevel3();
    const breastAllocation = svaso.allocations.find(a => a.part_code === 'breast_cap')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'breast_cap', sub_cut_code: 'filet', weight_kg: 2443, shadow_price_per_kg: 9.50 },
    ];

    const result = calculateMiniSVASO(breastAllocation, subCuts);

    expect(result.sub_allocations).toHaveLength(1);
    expect(result.sub_allocations[0].allocation_factor).toBeCloseTo(1.0, 4);
    expect(result.sub_allocations[0].allocated_cost_total_eur).toBeCloseTo(
      breastAllocation.allocated_cost_total_eur, 2
    );
  });
});

// ============================================================================
// LEVEL 5: ABC COSTS TESTS
// ============================================================================

describe('Level 5: ABC Costs', () => {
  it('should calculate additive ABC costs', () => {
    const drivers: ABCCostDriver[] = [
      { driver_code: 'LABOR', driver_name: 'Arbeid', rate_per_unit: 0.50, units_consumed: 2 },
      { driver_code: 'MACHINE', driver_name: 'Machine uren', rate_per_unit: 0.30, units_consumed: 1 },
    ];

    const result = calculateABCCosts('SKU-001', drivers);
    expect(result.total_abc_cost_eur).toBeCloseTo(1.30, 2);
    expect(result.abc_drivers).toHaveLength(2);
  });

  it('MANDATORY: ABC never affects SVASO (additive only, no redistribution)', () => {
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const level1 = calculateJointCostPool('CANON-001', landed, 1400, 7000);
    const level2 = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);
    const svaso = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    // ABC happens AFTER SVASO — verify SVASO result is unchanged
    const abc = calculateABCCosts('SKU-001', [
      { driver_code: 'TEST', driver_name: 'Test', rate_per_unit: 100, units_consumed: 10 },
    ]);

    // ABC should be purely additive — SVASO allocations remain unchanged
    expect(abc.total_abc_cost_eur).toBe(1000);
    expect(svaso.sum_allocated_cost_eur).toBeCloseTo(level2.net_joint_cost_eur, 2);
    // No field in SVASO references ABC
  });

  it('should handle empty drivers', () => {
    const result = calculateABCCosts('SKU-001', []);
    expect(result.total_abc_cost_eur).toBe(0);
    expect(result.abc_drivers).toHaveLength(0);
  });
});

// ============================================================================
// LEVEL 6: FULL SKU COST TESTS
// ============================================================================

describe('Level 6: Full SKU Cost', () => {
  it('should calculate total SKU cost = meat + packaging + ABC + giveaway', () => {
    const abc = calculateABCCosts('SKU-001', [
      { driver_code: 'LABOR', driver_name: 'Arbeid', rate_per_unit: 0.50, units_consumed: 1 },
    ]);

    const sku: SkuDefinition = {
      sku_code: 'THIGH-200G',
      source_product_code: 'thigh_fillet',
      meat_content_kg: 0.200,
      packaging_cost_eur: 0.15,
      abc_drivers: [],
      weight_type: 'catch',
    };

    const result = calculateFullSKUCost(sku, 9.50, abc);

    // meat = 0.200 × 9.50 = 1.90
    // packaging = 0.15
    // abc = 0.50
    // total = 2.55
    expect(result.meat_cost_eur).toBeCloseTo(1.90, 2);
    expect(result.total_sku_cost_eur).toBeCloseTo(2.55, 2);
  });

  it('should include giveaway cost for E-mark', () => {
    const abc = calculateABCCosts('SKU-001', []);
    const sku: SkuDefinition = {
      sku_code: 'BREAST-200G-FIXED',
      source_product_code: 'filet',
      meat_content_kg: 0.200,
      packaging_cost_eur: 0.20,
      abc_drivers: [],
      weight_type: 'fixed',
      label_weight_kg: 0.200,
      actual_fill_weight_kg: 0.204,
    };

    const result = calculateFullSKUCost(sku, 9.50, abc);
    // Giveaway = (0.204 - 0.200) × 9.50 = 0.038
    expect(result.giveaway_cost_eur).toBeCloseTo(0.038, 2);
  });
});

// ============================================================================
// LEVEL 7: NRV (READ-ONLY) TESTS
// ============================================================================

describe('Level 7: NRV (Read-Only)', () => {
  it('should calculate NRV correctly', () => {
    const input: NRVInput = {
      product_code: 'filet',
      selling_price_per_kg: 12.00,
      completion_cost_per_kg: 0.50,
      selling_cost_per_kg: 0.30,
    };

    const result = calculateNRV(input, 9.50);
    // NRV = 12.00 - 0.50 - 0.30 = 11.20
    expect(result.nrv_per_kg).toBeCloseTo(11.20, 4);
    expect(result.nrv_exceeds_cost).toBe(true);
    expect(result.writedown_required).toBe(false);
  });

  it('should flag writedown when NRV < cost', () => {
    const input: NRVInput = {
      product_code: 'drum_meat',
      selling_price_per_kg: 4.00,
      completion_cost_per_kg: 0.50,
      selling_cost_per_kg: 0.30,
    };

    const result = calculateNRV(input, 5.00);
    // NRV = 4.00 - 0.50 - 0.30 = 3.20
    expect(result.nrv_per_kg).toBeCloseTo(3.20, 4);
    expect(result.nrv_exceeds_cost).toBe(false);
    expect(result.writedown_required).toBe(true);
    expect(result.writedown_amount_per_kg).toBeCloseTo(1.80, 4);
  });

  it('MANDATORY: NRV cannot influence costing (frozen object)', () => {
    const input: NRVInput = {
      product_code: 'filet',
      selling_price_per_kg: 12.00,
      completion_cost_per_kg: 0.50,
      selling_cost_per_kg: 0.30,
    };

    const result = calculateNRV(input, 9.50);

    // Object.freeze should prevent mutation
    expect(() => {
      (result as any).cost_per_kg = 0;
    }).toThrow();

    expect(() => {
      (result as any).nrv_per_kg = 999;
    }).toThrow();

    // Audit trail should also be frozen
    expect(() => {
      (result.audit_trail as any).push({ step: 'HACK' });
    }).toThrow();
  });

  it('should include audit trail with READ-ONLY source', () => {
    const input: NRVInput = {
      product_code: 'filet',
      selling_price_per_kg: 12.00,
      completion_cost_per_kg: 0.50,
      selling_cost_per_kg: 0.30,
    };

    const result = calculateNRV(input, 9.50);
    const readOnlyEntries = result.audit_trail.filter(e =>
      e.source.includes('READ-ONLY')
    );
    expect(readOnlyEntries.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// HARD RAIL TESTS
// ============================================================================

describe('Hard Rails', () => {
  it('assertJointProduct should pass for breast_cap, legs, wings', () => {
    expect(() => assertJointProduct('breast_cap')).not.toThrow();
    expect(() => assertJointProduct('legs')).not.toThrow();
    expect(() => assertJointProduct('wings')).not.toThrow();
  });

  it('assertJointProduct should throw for back_carcass', () => {
    expect(() => assertJointProduct('back_carcass')).toThrow('SCOPE VIOLATION');
  });

  it('assertJointProduct should throw for offal', () => {
    expect(() => assertJointProduct('offal')).toThrow('SCOPE VIOLATION');
  });

  it('assertJointProduct should throw for arbitrary strings', () => {
    expect(() => assertJointProduct('drumstick')).toThrow('SCOPE VIOLATION');
    expect(() => assertJointProduct('')).toThrow('SCOPE VIOLATION');
  });

  it('isJointProduct should return correct boolean', () => {
    expect(isJointProduct('breast_cap')).toBe(true);
    expect(isJointProduct('legs')).toBe(true);
    expect(isJointProduct('wings')).toBe(true);
    expect(isJointProduct('back_carcass')).toBe(false);
    expect(isJointProduct('offal')).toBe(false);
  });

  it('JOINT_PRODUCT_CODES should contain exactly 3 entries', () => {
    expect(JOINT_PRODUCT_CODES).toHaveLength(3);
    expect([...JOINT_PRODUCT_CODES].sort()).toEqual(['breast_cap', 'legs', 'wings']);
  });

  it('BY_PRODUCT_RATE_PER_KG should be €0.20', () => {
    expect(BY_PRODUCT_RATE_PER_KG).toBe(0.20);
  });

  it('MANDATORY: by-product carries 0 joint cost', () => {
    // Back_carcass is a by-product → gets flat rate credit only, NO SVASO allocation
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const level1 = calculateJointCostPool('CANON-001', landed, 1400, 7000);
    const level2 = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);
    const svaso = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);

    // Back should NOT appear in SVASO allocations
    const backAllocation = svaso.allocations.find(a => a.part_code === 'back_carcass' as any);
    expect(backAllocation).toBeUndefined();

    // Back only appears in by-product credit (flat €0.20/kg)
    const backCredit = level2.by_product_details.find(d => d.type === 'back_carcass');
    expect(backCredit).toBeDefined();
    expect(backCredit!.rate_per_kg).toBe(0.20);
    expect(backCredit!.credit_eur).toBeCloseTo(798 * 0.20, 2);
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe('Determinism', () => {
  it('should produce identical results on repeated runs', () => {
    const r1 = calculateLandedCost(TEST_LANDED_COST_INPUT);
    const r2 = calculateLandedCost(TEST_LANDED_COST_INPUT);
    expect(r1.landed_cost_eur).toBe(r2.landed_cost_eur);
    expect(r1.landed_cost_per_kg).toBe(r2.landed_cost_per_kg);
    expect(r1.usable_live_kg).toBe(r2.usable_live_kg);
  });

  it('should have audit trail on every calculation', () => {
    const result = calculateLandedCost(TEST_LANDED_COST_INPUT);
    expect(result.audit_trail.length).toBeGreaterThan(0);
    result.audit_trail.forEach(entry => {
      expect(entry.step).toBeDefined();
      expect(entry.formula).toBeDefined();
      expect(entry.inputs).toBeDefined();
      expect(entry.output).toBeDefined();
      expect(entry.source).toBeDefined();
    });
  });
});

// ============================================================================
// FULL PIPELINE TEST (Level 0 → Level 7)
// ============================================================================

describe('Full Pipeline: Level 0 → Level 7', () => {
  it('should flow through all 7 levels without error', () => {
    // Level 0
    const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
    expect(landed.landed_cost_eur).toBeGreaterThan(0);

    // Level 1
    const level1 = calculateJointCostPool('CANON-001', landed, 1400, 7000);
    expect(level1.joint_cost_pool_eur).toBeGreaterThan(landed.landed_cost_eur);

    // Level 2
    const level2 = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);
    expect(level2.net_joint_cost_eur).toBeLessThan(level1.joint_cost_pool_eur);

    // Level 3
    const level3 = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);
    expect(level3.is_valid).toBe(true);
    expect(level3.sum_allocated_cost_eur).toBeCloseTo(level2.net_joint_cost_eur, 2);

    // Level 4
    const breastAlloc = level3.allocations.find(a => a.part_code === 'breast_cap')!;
    const miniSvaso = calculateMiniSVASO(breastAlloc, [
      { parent_joint_code: 'breast_cap', sub_cut_code: 'filet', weight_kg: 2443, shadow_price_per_kg: 9.50 },
    ]);
    expect(miniSvaso.is_valid).toBe(true);

    // Level 5
    const abc = calculateABCCosts('SKU-FILET-200G', [
      { driver_code: 'LABOR', driver_name: 'Arbeid', rate_per_unit: 0.50, units_consumed: 1 },
    ]);
    expect(abc.total_abc_cost_eur).toBe(0.50);

    // Level 6
    const sku: SkuDefinition = {
      sku_code: 'SKU-FILET-200G',
      source_product_code: 'filet',
      meat_content_kg: 0.200,
      packaging_cost_eur: 0.15,
      abc_drivers: [],
      weight_type: 'catch',
    };
    const fullSku = calculateFullSKUCost(sku, miniSvaso.sub_allocations[0].allocated_cost_per_kg, abc);
    expect(fullSku.total_sku_cost_eur).toBeGreaterThan(0);

    // Level 7
    const nrv = calculateNRV({
      product_code: 'filet',
      selling_price_per_kg: 12.00,
      completion_cost_per_kg: 0.50,
      selling_cost_per_kg: 0.30,
    }, fullSku.cost_per_kg);

    expect(nrv.nrv_per_kg).toBeCloseTo(11.20, 2);
    // NRV should not have mutated any upstream result
    expect(level3.sum_allocated_cost_eur).toBeCloseTo(level2.net_joint_cost_eur, 2);
  });
});

// ============================================================================
// BACKWARD COMPATIBILITY: LEGACY TESTS
// ============================================================================

describe('Legacy Backward Compatibility', () => {
  describe('Level 0: Landed Cost (Legacy)', () => {
    it('should calculate raw material cost correctly', () => {
      const result = calculateLandedCost(TEST_LANDED_COST_INPUT);
      expect(result.landed_cost_eur).toBeCloseTo(26550, 0);
    });
  });

  describe('Level 1: Griller Cost (Legacy)', () => {
    it('should calculate griller cost with by-product credit', () => {
      const landedResult = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const griller_weight_kg = 7000;
      const slaughter_fee = TEST_LANDED_COST_INPUT.input_count * TEST_LANDED_COST_INPUT.slaughter_fee_per_head;

      const result = calculateGrillerCost(
        'TEST-001',
        landedResult,
        slaughter_fee,
        griller_weight_kg,
        TEST_LEGACY_BY_PRODUCTS
      );

      expect(result.by_product_credit_eur).toBeCloseTo(56.60, 1);
    });

    it('should handle negative NRV for disposal costs', () => {
      const landedResult = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const disposalByProducts: ByProductInput[] = [
        { id: 'cat3', type: 'cat3_waste', weight_kg: 1000, nrv_price_per_kg: -0.10 },
      ];

      const result = calculateGrillerCost('TEST-001', landedResult, 1400, 7000, disposalByProducts);
      expect(result.by_product_credit_eur).toBeLessThan(0);
      expect(result.joint_cost_pool_eur).toBeGreaterThan(landedResult.landed_cost_eur + 1400);
    });
  });

  describe('Level 2: Primal Allocation (Legacy)', () => {
    const setupGrillerCost = () => {
      const landedResult = calculateLandedCost(TEST_LANDED_COST_INPUT);
      return calculateGrillerCost('TEST-001', landedResult, 1400, 7000, TEST_LEGACY_BY_PRODUCTS);
    };

    it('should allocate costs based on market value', () => {
      const grillerCost = setupGrillerCost();
      const result = calculatePrimalAllocation('TEST-001', grillerCost, TEST_LEGACY_PRIMAL_CUTS);

      const breast = result.allocations.find(a => a.part_code === 'breast_cap')!;
      const back = result.allocations.find(a => a.part_code === 'back_carcass')!;
      expect(breast.allocated_cost_per_kg).toBeGreaterThan(back.allocated_cost_per_kg);
    });

    it('should ensure sum of allocated costs equals joint cost pool (HARD INVARIANT)', () => {
      const grillerCost = setupGrillerCost();
      const result = calculatePrimalAllocation('TEST-001', grillerCost, TEST_LEGACY_PRIMAL_CUTS);

      expect(result.sum_allocated_cost_eur).toBe(
        result.allocations.reduce((sum, a) => sum + a.allocated_cost_total_eur, 0)
      );
      expect(result.reconciliation_delta_eur).toBeLessThan(0.01);
      expect(result.sum_allocated_cost_eur).toBeCloseTo(grillerCost.joint_cost_pool_eur, 2);
    });

    it('should ensure total_market_value_eur equals sum of allocations.market_value_eur', () => {
      const grillerCost = setupGrillerCost();
      const result = calculatePrimalAllocation('TEST-001', grillerCost, TEST_LEGACY_PRIMAL_CUTS);

      const sumMarketValues = result.allocations.reduce((s, a) => s + a.market_value_eur, 0);
      expect(result.total_market_value_eur).toBe(sumMarketValues);
    });

    it('should ensure allocation factors sum to 1.0', () => {
      const grillerCost = setupGrillerCost();
      const result = calculatePrimalAllocation('TEST-001', grillerCost, TEST_LEGACY_PRIMAL_CUTS);
      expect(result.sum_allocation_factors).toBeCloseTo(1.0, 4);
      expect(result.is_valid).toBe(true);
    });
  });

  describe('Level 3: Secondary Processing (Legacy)', () => {
    it('should demonstrate yield as cost multiplier', () => {
      const processing: SecondaryProcessingInput = {
        input_part_code: 'leg_quarter',
        output_product_code: 'thigh_meat_boneless',
        input_kg: 100,
        output_meat_kg: 62.5,
        yield_pct: 62.5,
        by_products: [
          { id: 'bone', type: 'other', weight_kg: 12.9, nrv_price_per_kg: 0.09 },
        ],
        labor_cost_per_kg: 0.68,
      };

      const result = calculateSecondaryProcessingCost('leg_quarter', 5.50, processing);
      expect(result.yield_adjusted_cost_per_kg).toBeGreaterThan(5.50 * 1.5);
    });
  });

  describe('Level 4: SKU Assembly (Legacy)', () => {
    it('should calculate total SKU cost correctly', () => {
      const sku: SkuAssemblyInput = {
        sku_code: 'THIGH-200G-FIXED',
        meat_content_kg: 0.200,
        meat_cost_per_kg: 9.50,
        packaging_cost_eur: 0.15,
        labor_cost_eur: 0.08,
        overhead_per_kg: 0.50,
        weight_type: 'catch',
      };

      const result = calculateSkuCost(sku);
      expect(result.total_sku_cost_eur).toBeCloseTo(2.23, 2);
    });

    it('should include giveaway cost for fixed weight', () => {
      const sku: SkuAssemblyInput = {
        sku_code: 'BREAST-200G-FIXED',
        meat_content_kg: 0.200,
        meat_cost_per_kg: 9.50,
        packaging_cost_eur: 0.20,
        labor_cost_eur: 0.10,
        overhead_per_kg: 0.50,
        weight_type: 'fixed',
        label_weight_kg: 0.200,
        actual_fill_weight_kg: 0.204,
      };

      const result = calculateSkuCost(sku);
      expect(result.giveaway_cost_eur).toBeCloseTo(0.038, 2);
    });
  });

  describe('Scenario Simulation (Legacy)', () => {
    it('should simulate wing price drop affecting breast cost', () => {
      const landedResult = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const grillerCost = calculateGrillerCost('TEST-001', landedResult, 1400, 7000, TEST_LEGACY_BY_PRODUCTS);

      const scenarioPrices: ScenarioPriceVector = {
        scenario_id: 'WING_DROP',
        scenario_name: 'Vleugels -20%',
        prices: { breast_cap: 9.50, leg_quarter: 5.50, wings: 3.60, back_carcass: 0.50 },
      };

      const result = simulateScenarioImpact('TEST-001', grillerCost, TEST_LEGACY_PRIMAL_CUTS, scenarioPrices);
      const breastImpact = result.impact.find(i => i.part_code === 'breast_cap')!;
      const wingImpact = result.impact.find(i => i.part_code === 'wings')!;

      expect(wingImpact.cost_change_per_kg).toBeLessThan(0);
      expect(breastImpact.cost_change_per_kg).toBeGreaterThan(0);
    });

    it('should include mandatory disclaimer', () => {
      const landedResult = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const grillerCost = calculateGrillerCost('TEST-001', landedResult, 1400, 7000, TEST_LEGACY_BY_PRODUCTS);

      const result = simulateScenarioImpact('TEST-001', grillerCost, TEST_LEGACY_PRIMAL_CUTS, {
        scenario_id: 'TEST',
        scenario_name: 'Test',
        prices: DEFAULT_STD_PRICES,
      });

      expect(result.disclaimer).toBe(SCENARIO_DISCLAIMER);
      expect(result.disclaimer).toContain('GEEN voorspelling');
    });
  });

  describe('Cost Waterfall (Legacy)', () => {
    it('should generate complete waterfall', () => {
      const landedResult = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const grillerCost = calculateGrillerCost('TEST-001', landedResult, 1400, 7000, TEST_LEGACY_BY_PRODUCTS);
      const primalAllocation = calculatePrimalAllocation('TEST-001', grillerCost, TEST_LEGACY_PRIMAL_CUTS);

      const waterfall = generateCostWaterfall('TEST-001', grillerCost, primalAllocation, [], []);
      expect(waterfall.batch_id).toBe('TEST-001');
      expect(waterfall.level_0_landed_cost_eur).toBeGreaterThan(0);
    });
  });

  describe('Helper Functions (Legacy)', () => {
    it('should calculate live-to-meat multiplier with audit trail', () => {
      const result = calculateLiveToMeatMultiplier(2.68, 3.98);
      expect(result.multiplier).toBeCloseTo(3.98 / 2.68, 4);
      expect(result.definition).toBe('griller_cost_per_kg / landed_cost_per_kg');
      expect(result.audit_trail.inputs).toHaveProperty('landed_cost_per_kg');
    });

    it('should interpret k-factor correctly', () => {
      expect(getKFactorInterpretation(0.85)).toBe('Theoretisch winstgevend');
      expect(getKFactorInterpretation(1.00)).toBe('Break-even');
      expect(getKFactorInterpretation(1.15)).toBe('Theoretisch verliesgevend');
    });
  });

  describe('Sprint 7 Contract Compliance (Legacy)', () => {
    it('should use SVASO for primal allocation', () => {
      const landedResult = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const grillerCost = calculateGrillerCost('TEST', landedResult, 1400, 7000, TEST_LEGACY_BY_PRODUCTS);
      const result = calculatePrimalAllocation('TEST', grillerCost, TEST_LEGACY_PRIMAL_CUTS);

      const breast = result.allocations.find(a => a.part_code === 'breast_cap')!;
      const back = result.allocations.find(a => a.part_code === 'back_carcass')!;

      const costRatio = breast.allocated_cost_per_kg / back.allocated_cost_per_kg;
      const priceRatio = breast.std_market_price_per_kg / back.std_market_price_per_kg;
      expect(costRatio).toBeCloseTo(priceRatio, 0);
    });

    it('should use JA757 carcass reference correctly', () => {
      expect(JA757_CARCASS_SHARES.breast_cap).toBe(35.85);
      expect(JA757_CARCASS_SHARES.leg_quarter).toBe(43.40);
      expect(JA757_CARCASS_SHARES.wings).toBe(10.70);
    });
  });
});

// ============================================================================
// SPRINT 13: BATCH PROFILES — External Processor Support
// ============================================================================

describe('Sprint 13: BatchProfile System', () => {
  describe('Profile Registration', () => {
    it('should have at least 2 profiles (ORANJEHOEN + CUNO_MOORMANN)', () => {
      expect(BATCH_PROFILES.length).toBeGreaterThanOrEqual(2);
    });

    it('ORANJEHOEN profile should match JOINT_PRODUCT_CODES', () => {
      expect([...PROFILE_ORANJEHOEN.joint_product_codes].sort()).toEqual(
        [...JOINT_PRODUCT_CODES].sort()
      );
    });

    it('CUNO_MOORMANN profile should have 4 joint products', () => {
      expect([...PROFILE_CUNO_MOORMANN.joint_product_codes].sort()).toEqual(
        ['dijfilet_vel', 'drumsticks', 'filet_supremes', 'platte_vleugels']
      );
    });

    it('getBatchProfile should return correct profile', () => {
      expect(getBatchProfile('oranjehoen')).toBe(PROFILE_ORANJEHOEN);
      expect(getBatchProfile('cuno_moormann')).toBe(PROFILE_CUNO_MOORMANN);
    });

    it('getBatchProfile should fallback to ORANJEHOEN for unknown ID', () => {
      expect(getBatchProfile('unknown')).toBe(PROFILE_ORANJEHOEN);
    });
  });

  describe('assertJointProduct with profiles', () => {
    it('should pass for ORANJEHOEN joint products without profile', () => {
      expect(() => assertJointProduct('breast_cap')).not.toThrow();
      expect(() => assertJointProduct('legs')).not.toThrow();
      expect(() => assertJointProduct('wings')).not.toThrow();
    });

    it('should pass for ORANJEHOEN joint products with explicit profile', () => {
      expect(() => assertJointProduct('breast_cap', PROFILE_ORANJEHOEN)).not.toThrow();
      expect(() => assertJointProduct('legs', PROFILE_ORANJEHOEN)).not.toThrow();
      expect(() => assertJointProduct('wings', PROFILE_ORANJEHOEN)).not.toThrow();
    });

    it('should throw for CUNO products on default (ORANJEHOEN) profile', () => {
      expect(() => assertJointProduct('filet_supremes')).toThrow('SCOPE VIOLATION');
      expect(() => assertJointProduct('drumsticks')).toThrow('SCOPE VIOLATION');
    });

    it('should pass for CUNO products on CUNO profile', () => {
      expect(() => assertJointProduct('filet_supremes', PROFILE_CUNO_MOORMANN)).not.toThrow();
      expect(() => assertJointProduct('drumsticks', PROFILE_CUNO_MOORMANN)).not.toThrow();
    });

    it('should throw for ORANJEHOEN products on CUNO profile', () => {
      expect(() => assertJointProduct('breast_cap', PROFILE_CUNO_MOORMANN)).toThrow('SCOPE VIOLATION');
      expect(() => assertJointProduct('legs', PROFILE_CUNO_MOORMANN)).toThrow('SCOPE VIOLATION');
    });
  });

  describe('isJointProduct with profiles', () => {
    it('should work without profile (default = ORANJEHOEN)', () => {
      expect(isJointProduct('breast_cap')).toBe(true);
      expect(isJointProduct('filet_supremes')).toBe(false);
    });

    it('should work with CUNO profile', () => {
      expect(isJointProduct('filet_supremes', PROFILE_CUNO_MOORMANN)).toBe(true);
      expect(isJointProduct('drumsticks', PROFILE_CUNO_MOORMANN)).toBe(true);
      expect(isJointProduct('breast_cap', PROFILE_CUNO_MOORMANN)).toBe(false);
    });
  });

  describe('SVASO with CUNO_MOORMANN profile', () => {
    /**
     * CUNO batch scenario:
     * - Koopt 200 kg filet suprêmes @ €8,50/kg en 150 kg drumsticks @ €5,00/kg
     * - Verwerkingskosten: €0,85/kg × 350 kg = €297,50
     * - Totale inkoopkosten: (200 × 8,50) + (150 × 5,00) = €2.450
     * - Joint cost pool: €2.450 + €297,50 = €2.747,50
     * - Geen by-products → net_joint_cost = joint_cost_pool
     */
    const CUNO_LANDED_INPUT: LandedCostInput = {
      batch_id: 'CUNO-001',
      input_live_kg: 350, // total kg purchased
      input_count: 1,     // external batch = 1 "lot"
      live_price_per_kg: 7.00, // weighted average purchase price
      transport_cost_eur: 0,
      catching_fee_eur: 0,
      slaughter_fee_per_head: 0,
      doa_count: 0,
      doa_threshold_pct: 0.02,
    };

    const CUNO_JOINT_PRODUCTS: JointProductInput[] = [
      { part_code: 'filet_supremes', weight_kg: 200, shadow_price_per_kg: 15.35 },
      { part_code: 'drumsticks', weight_kg: 150, shadow_price_per_kg: 8.00 },
    ];

    it('should accept CUNO joint products with CUNO profile', () => {
      const landed = calculateLandedCost(CUNO_LANDED_INPUT);
      const level1 = calculateJointCostPool('CUNO-001', landed, 297.50, 350);
      const level2 = calculateByProductCredit('CUNO-001', level1, []); // no by-products

      expect(() => {
        calculateSVASOAllocation('CUNO-001', level2, CUNO_JOINT_PRODUCTS, PROFILE_CUNO_MOORMANN);
      }).not.toThrow();
    });

    it('should reject CUNO joint products WITHOUT profile (default scope)', () => {
      const landed = calculateLandedCost(CUNO_LANDED_INPUT);
      const level1 = calculateJointCostPool('CUNO-001', landed, 297.50, 350);
      const level2 = calculateByProductCredit('CUNO-001', level1, []);

      expect(() => {
        calculateSVASOAllocation('CUNO-001', level2, CUNO_JOINT_PRODUCTS);
      }).toThrow('SCOPE VIOLATION');
    });

    it('SVASO wiskunde is identiek: k-factor, allocatie, reconciliatie', () => {
      const landed = calculateLandedCost(CUNO_LANDED_INPUT);
      const level1 = calculateJointCostPool('CUNO-001', landed, 297.50, 350);
      const level2 = calculateByProductCredit('CUNO-001', level1, []);
      const result = calculateSVASOAllocation('CUNO-001', level2, CUNO_JOINT_PRODUCTS, PROFILE_CUNO_MOORMANN);

      // k-factor = net_joint_cost / TMV
      const expectedTMV = (200 * 15.35) + (150 * 8.00);
      const expectedK = level2.net_joint_cost_eur / expectedTMV;
      expect(result.k_factor).toBeCloseTo(expectedK, 4);
      expect(result.k_factor_interpretation).toBe('PROFITABLE'); // k < 1

      // Allocation factors sum to 1.0
      expect(result.sum_allocation_factors).toBeCloseTo(1.0, 4);

      // Reconciliation: sum = net_joint_cost
      expect(result.sum_allocated_cost_eur).toBeCloseTo(level2.net_joint_cost_eur, 2);
      expect(result.reconciliation_delta_eur).toBeLessThan(0.01);
      expect(result.is_valid).toBe(true);
    });

    it('should have 2 allocations (filet_supremes + drumsticks)', () => {
      const landed = calculateLandedCost(CUNO_LANDED_INPUT);
      const level1 = calculateJointCostPool('CUNO-001', landed, 297.50, 350);
      const level2 = calculateByProductCredit('CUNO-001', level1, []);
      const result = calculateSVASOAllocation('CUNO-001', level2, CUNO_JOINT_PRODUCTS, PROFILE_CUNO_MOORMANN);

      expect(result.allocations).toHaveLength(2);
      expect(result.allocations.map(a => a.part_code).sort()).toEqual(
        ['drumsticks', 'filet_supremes']
      );
    });

    it('filet_supremes gets higher cost/kg than drumsticks (higher shadow price)', () => {
      const landed = calculateLandedCost(CUNO_LANDED_INPUT);
      const level1 = calculateJointCostPool('CUNO-001', landed, 297.50, 350);
      const level2 = calculateByProductCredit('CUNO-001', level1, []);
      const result = calculateSVASOAllocation('CUNO-001', level2, CUNO_JOINT_PRODUCTS, PROFILE_CUNO_MOORMANN);

      const filet = result.allocations.find(a => a.part_code === 'filet_supremes')!;
      const drums = result.allocations.find(a => a.part_code === 'drumsticks')!;

      expect(filet.allocated_cost_per_kg).toBeGreaterThan(drums.allocated_cost_per_kg);
    });
  });

  describe('Regression: ORANJEHOEN unchanged', () => {
    it('existing SVASO test data produces identical results with and without profile', () => {
      const landed = calculateLandedCost(TEST_LANDED_COST_INPUT);
      const level1 = calculateJointCostPool('CANON-001', landed, 1400, 7000);
      const level2 = calculateByProductCredit('CANON-001', level1, TEST_BY_PRODUCTS);

      const withoutProfile = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS);
      const withProfile = calculateSVASOAllocation('CANON-001', level2, TEST_JOINT_PRODUCTS, PROFILE_ORANJEHOEN);

      expect(withProfile.k_factor).toBe(withoutProfile.k_factor);
      expect(withProfile.sum_allocated_cost_eur).toBe(withoutProfile.sum_allocated_cost_eur);
      expect(withProfile.is_valid).toBe(withoutProfile.is_valid);

      for (let i = 0; i < withoutProfile.allocations.length; i++) {
        expect(withProfile.allocations[i].allocated_cost_per_kg).toBe(
          withoutProfile.allocations[i].allocated_cost_per_kg
        );
        expect(withProfile.allocations[i].allocated_cost_total_eur).toBe(
          withoutProfile.allocations[i].allocated_cost_total_eur
        );
      }
    });
  });
});
