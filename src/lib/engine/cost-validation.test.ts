/**
 * Cost Validation Helpers — Test Suite (Phase 1.1)
 *
 * Tests that validation is opt-in and never affects costing results.
 */

import { describe, it, expect } from 'vitest';
import {
  validateByProductInputs,
  validateMiniSVASOInputs,
} from './cost-validation';
import {
  calculateLandedCost,
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation,
  calculateMiniSVASO,
  type LandedCostInput,
  type ByProductPhysical,
  type JointProductInput,
  type JointProductAllocation,
  type SubJointCutInput,
} from './canonical-cost';

// ============================================================================
// TEST DATA
// ============================================================================

const LANDED_INPUT: LandedCostInput = {
  batch_id: 'VAL-001',
  input_live_kg: 10000,
  input_count: 5000,
  live_price_per_kg: 2.60,
  transport_cost_eur: 400,
  catching_fee_eur: 150,
  slaughter_fee_per_head: 0.28,
  doa_count: 50,
  doa_threshold_pct: 0.02,
};

const CLEAN_BY_PRODUCTS: ByProductPhysical[] = [
  { id: 'blood', type: 'blood', weight_kg: 270 },
  { id: 'feathers', type: 'feathers', weight_kg: 470 },
  { id: 'offal', type: 'offal', weight_kg: 350 },
  { id: 'back', type: 'back_carcass', weight_kg: 798 },
];

const JOINT_PRODUCTS: JointProductInput[] = [
  { part_code: 'breast_cap', weight_kg: 2443, shadow_price_per_kg: 9.50 },
  { part_code: 'legs', weight_kg: 3010, shadow_price_per_kg: 5.50 },
  { part_code: 'wings', weight_kg: 749, shadow_price_per_kg: 4.50 },
];

function setupSVASO() {
  const landed = calculateLandedCost(LANDED_INPUT);
  const level1 = calculateJointCostPool('VAL-001', landed, 1400, 7000);
  const level2 = calculateByProductCredit('VAL-001', level1, CLEAN_BY_PRODUCTS);
  return calculateSVASOAllocation('VAL-001', level2, JOINT_PRODUCTS);
}

// ============================================================================
// BY-PRODUCT VALIDATION TESTS
// ============================================================================

describe('validateByProductInputs', () => {
  it('should return no warnings for clean inputs', () => {
    const warnings = validateByProductInputs(CLEAN_BY_PRODUCTS);
    expect(warnings).toHaveLength(0);
  });

  it('should warn when type is "other" without explicit subtype', () => {
    const byProducts: ByProductPhysical[] = [
      { id: 'other', type: 'other', weight_kg: 100 },
    ];
    const warnings = validateByProductInputs(byProducts);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('WARNING');
    expect(warnings[0].code).toBe('BP_OTHER_NO_SUBTYPE');
  });

  it('should warn when type is "other" with empty id', () => {
    const byProducts: ByProductPhysical[] = [
      { id: '', type: 'other', weight_kg: 50 },
    ];
    const warnings = validateByProductInputs(byProducts);
    expect(warnings.some(w => w.code === 'BP_OTHER_NO_SUBTYPE')).toBe(true);
  });

  it('should NOT warn when type is "other" with descriptive id', () => {
    const byProducts: ByProductPhysical[] = [
      { id: 'neck_skin', type: 'other', weight_kg: 100 },
    ];
    const warnings = validateByProductInputs(byProducts);
    expect(warnings.some(w => w.code === 'BP_OTHER_NO_SUBTYPE')).toBe(false);
  });

  it('should error on negative weight', () => {
    const byProducts: ByProductPhysical[] = [
      { id: 'blood', type: 'blood', weight_kg: -10 },
    ];
    const warnings = validateByProductInputs(byProducts);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('ERROR');
    expect(warnings[0].code).toBe('BP_NEGATIVE_WEIGHT');
  });

  it('should warn on zero weight', () => {
    const byProducts: ByProductPhysical[] = [
      { id: 'feathers', type: 'feathers', weight_kg: 0 },
    ];
    const warnings = validateByProductInputs(byProducts);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('WARNING');
    expect(warnings[0].code).toBe('BP_ZERO_WEIGHT');
  });

  it('should return multiple warnings for multiple issues', () => {
    const byProducts: ByProductPhysical[] = [
      { id: 'other', type: 'other', weight_kg: 0 },
    ];
    const warnings = validateByProductInputs(byProducts);
    expect(warnings).toHaveLength(2);
    expect(warnings.map(w => w.code).sort()).toEqual([
      'BP_OTHER_NO_SUBTYPE',
      'BP_ZERO_WEIGHT',
    ]);
  });
});

// ============================================================================
// MINI-SVASO VALIDATION TESTS
// ============================================================================

describe('validateMiniSVASOInputs', () => {
  it('should return no warnings for valid sub-cuts within parent weight', () => {
    const svaso = setupSVASO();
    const legAlloc = svaso.allocations.find(a => a.part_code === 'legs')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: 1800, shadow_price_per_kg: 7.00 },
      { parent_joint_code: 'legs', sub_cut_code: 'drum_meat', weight_kg: 1210, shadow_price_per_kg: 4.00 },
    ];

    const warnings = validateMiniSVASOInputs(legAlloc, subCuts);
    expect(warnings).toHaveLength(0);
  });

  it('should warn when sub-cut weights exceed parent weight', () => {
    const svaso = setupSVASO();
    const legAlloc = svaso.allocations.find(a => a.part_code === 'legs')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: 2500, shadow_price_per_kg: 7.00 },
      { parent_joint_code: 'legs', sub_cut_code: 'drum_meat', weight_kg: 1500, shadow_price_per_kg: 4.00 },
    ];
    // Total: 4000 kg > parent 3010 kg

    const warnings = validateMiniSVASOInputs(legAlloc, subCuts);
    expect(warnings.some(w => w.code === 'MINI_SVASO_WEIGHT_EXCEEDS_PARENT')).toBe(true);
    const w = warnings.find(w => w.code === 'MINI_SVASO_WEIGHT_EXCEEDS_PARENT')!;
    expect(w.severity).toBe('WARNING');
    expect((w.context as any).excess_kg).toBeGreaterThan(0);
  });

  it('should warn when sub-cut coverage is below 80%', () => {
    const svaso = setupSVASO();
    const legAlloc = svaso.allocations.find(a => a.part_code === 'legs')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: 1000, shadow_price_per_kg: 7.00 },
    ];
    // 1000 / 3010 = 33% < 80%

    const warnings = validateMiniSVASOInputs(legAlloc, subCuts);
    expect(warnings.some(w => w.code === 'MINI_SVASO_WEIGHT_LOW_COVERAGE')).toBe(true);
  });

  it('should error on negative sub-cut weight', () => {
    const svaso = setupSVASO();
    const legAlloc = svaso.allocations.find(a => a.part_code === 'legs')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: -100, shadow_price_per_kg: 7.00 },
    ];

    const warnings = validateMiniSVASOInputs(legAlloc, subCuts);
    expect(warnings.some(w => w.code === 'MINI_SVASO_NEGATIVE_WEIGHT')).toBe(true);
    expect(warnings.find(w => w.code === 'MINI_SVASO_NEGATIVE_WEIGHT')!.severity).toBe('ERROR');
  });

  it('should warn on zero shadow price', () => {
    const svaso = setupSVASO();
    const legAlloc = svaso.allocations.find(a => a.part_code === 'legs')!;

    const subCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: 1800, shadow_price_per_kg: 7.00 },
      { parent_joint_code: 'legs', sub_cut_code: 'trim', weight_kg: 200, shadow_price_per_kg: 0 },
    ];

    const warnings = validateMiniSVASOInputs(legAlloc, subCuts);
    expect(warnings.some(w => w.code === 'MINI_SVASO_ZERO_PRICE')).toBe(true);
  });
});

// ============================================================================
// ISOLATION: VALIDATION NEVER AFFECTS COSTING
// ============================================================================

describe('Validation isolation', () => {
  it('should not affect canonical costing results', () => {
    const landed = calculateLandedCost(LANDED_INPUT);
    const level1 = calculateJointCostPool('VAL-001', landed, 1400, 7000);

    // Run costing WITH problematic inputs
    const problematicBPs: ByProductPhysical[] = [
      { id: 'other', type: 'other', weight_kg: 100 },
      { id: '', type: 'other', weight_kg: 0 },
      ...CLEAN_BY_PRODUCTS,
    ];

    // Validation returns warnings
    const warnings = validateByProductInputs(problematicBPs);
    expect(warnings.length).toBeGreaterThan(0);

    // Costing proceeds normally — validation does not touch it
    const level2 = calculateByProductCredit('VAL-001', level1, problematicBPs);
    expect(level2.net_joint_cost_eur).toBeGreaterThan(0);

    // Costing with clean inputs for comparison
    const level2Clean = calculateByProductCredit('VAL-001', level1, CLEAN_BY_PRODUCTS);

    // Credit difference should only be the extra 100kg at €0.20
    const creditDiff = level2.by_product_credit_eur - level2Clean.by_product_credit_eur;
    expect(creditDiff).toBeCloseTo(100 * 0.20, 2);
  });

  it('Mini-SVASO validation should not change allocation results', () => {
    const svaso = setupSVASO();
    const legAlloc = svaso.allocations.find(a => a.part_code === 'legs')!;

    // Sub-cuts that exceed parent weight (warning-worthy)
    const overweightCuts: SubJointCutInput[] = [
      { parent_joint_code: 'legs', sub_cut_code: 'thigh_fillet', weight_kg: 2500, shadow_price_per_kg: 7.00 },
      { parent_joint_code: 'legs', sub_cut_code: 'drum_meat', weight_kg: 1500, shadow_price_per_kg: 4.00 },
    ];

    // Validation warns
    const warnings = validateMiniSVASOInputs(legAlloc, overweightCuts);
    expect(warnings.length).toBeGreaterThan(0);

    // Costing proceeds and still reconciles (sum = parent cost)
    const miniResult = calculateMiniSVASO(legAlloc, overweightCuts);
    expect(miniResult.is_valid).toBe(true);
    expect(miniResult.sum_sub_allocated_cost_eur).toBeCloseTo(
      legAlloc.allocated_cost_total_eur, 2
    );
  });
});
