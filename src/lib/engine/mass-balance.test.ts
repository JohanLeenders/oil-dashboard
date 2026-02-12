/**
 * Unit Tests voor Mass Balance Validation
 *
 * Tests:
 * 1. Valid batch passes validation
 * 2. Imbalanced batch generates errors
 * 3. Missing yields generates NEEDS_REVIEW warning
 * 4. Corrections don't cause double-counting (via effective views)
 */

import { describe, it, expect } from 'vitest';
import {
  validateMassBalance,
  validateAllMassBalances,
  generateNeedsReviewSignal,
  type MassBalanceValidation,
} from './mass-balance';
import type { BatchMassBalance } from '@/types/database';

describe('validateMassBalance', () => {
  // Valid batch data (based on demo batch P2520210)
  const validBatch: BatchMassBalance = {
    batch_id: 'batch-001',
    batch_ref: 'P2520210',
    slaughter_date: '2026-01-21',
    source_live_weight: 5000.0,
    loss_rejection: 25.0,
    loss_slaughter: 1450.0,
    node_griller: 3525.0,  // 5000 - 25 - 1450 = 3525
    node_breast_cap: 1230.18,
    node_leg_quarter: 1555.40,
    node_wings: 378.25,
    node_back_carcass: 265.13,
    node_offal: 88.38,
    // 3517.34 total parts, ~7.66 kg unaccounted
    loss_unaccounted: 7.66,
  };

  it('moet geldige batch valideren zonder errors', () => {
    const result = validateMassBalance(validBatch);

    expect(result.is_valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.batch_ref).toBe('P2520210');
  });

  it('moet 5 parts tellen voor complete batch', () => {
    const result = validateMassBalance(validBatch);

    expect(result.metrics.parts_present).toBe(5);
    expect(result.metrics.parts_expected).toBe(5);
  });

  it('moet balance within tolerance accepteren', () => {
    const result = validateMassBalance(validBatch);

    // Level 1: Live -> Griller balance
    // 5000 - (3525 + 25 + 1450) = 0, perfect balance
    expect(result.metrics.live_to_griller_balance_kg).toBeCloseTo(0, 1);
    expect(result.metrics.live_to_griller_balance_pct).toBeCloseTo(0, 1);
  });

  it('moet error genereren bij grote imbalance', () => {
    const imbalancedBatch: BatchMassBalance = {
      ...validBatch,
      node_griller: 4000.0,  // Way too high for the losses
    };

    const result = validateMassBalance(imbalancedBatch);

    expect(result.is_valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LEVEL1_IMBALANCE')).toBe(true);
  });

  it('moet warning genereren bij ontbrekende yields', () => {
    const incompleteYields: BatchMassBalance = {
      ...validBatch,
      node_breast_cap: 0,
      node_leg_quarter: 0,
      node_wings: 0,
      node_back_carcass: 0,
      node_offal: 0,
      loss_unaccounted: 3525.0,
    };

    const result = validateMassBalance(incompleteYields);

    expect(result.warnings.some(w => w.code === 'NEEDS_REVIEW')).toBe(true);
    expect(result.metrics.parts_present).toBe(0);
  });

  it('moet error genereren bij negatief unaccounted (parts > griller)', () => {
    const overweightParts: BatchMassBalance = {
      ...validBatch,
      node_breast_cap: 2000.0,  // Way too high
      loss_unaccounted: -500.0, // Negative = impossible
    };

    const result = validateMassBalance(overweightParts);

    expect(result.errors.some(e => e.code === 'NEGATIVE_UNACCOUNTED')).toBe(true);
  });

  it('moet warning genereren bij hoog unaccounted percentage', () => {
    const highUnaccounted: BatchMassBalance = {
      ...validBatch,
      node_breast_cap: 1000.0,
      node_leg_quarter: 1200.0,
      node_wings: 300.0,
      node_back_carcass: 200.0,
      node_offal: 80.0,
      loss_unaccounted: 745.0,  // ~21% unaccounted
    };

    const result = validateMassBalance(highUnaccounted);

    expect(result.warnings.some(w => w.code === 'HIGH_UNACCOUNTED')).toBe(true);
    expect(result.metrics.unaccounted_pct).toBeGreaterThan(5);
  });

  it('moet critical error geven bij ontbrekende griller weight', () => {
    const noGriller: BatchMassBalance = {
      ...validBatch,
      node_griller: 0,
    };

    const result = validateMassBalance(noGriller);

    expect(result.errors.some(e =>
      e.code === 'MISSING_GRILLER' && e.severity === 'critical'
    )).toBe(true);
  });
});

describe('validateAllMassBalances', () => {
  it('moet summary geven voor meerdere batches', () => {
    const batches: BatchMassBalance[] = [
      {
        batch_id: 'b1',
        batch_ref: 'P001',
        slaughter_date: '2026-01-21',
        source_live_weight: 5000,
        loss_rejection: 25,
        loss_slaughter: 1450,
        node_griller: 3525,
        node_breast_cap: 1230,
        node_leg_quarter: 1555,
        node_wings: 378,
        node_back_carcass: 265,
        node_offal: 88,
        loss_unaccounted: 9,
      },
      {
        batch_id: 'b2',
        batch_ref: 'P002',
        slaughter_date: '2026-01-22',
        source_live_weight: 5000,
        loss_rejection: 0,
        loss_slaughter: 0,
        node_griller: 4000,  // Invalid: 1000 kg missing (20% imbalance > 2% tolerance)
        node_breast_cap: 0,
        node_leg_quarter: 0,
        node_wings: 0,
        node_back_carcass: 0,
        node_offal: 0,
        loss_unaccounted: 4000,
      },
    ];

    const result = validateAllMassBalances(batches);

    expect(result.total).toBe(2);
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.needs_review).toBeGreaterThan(0);
  });
});

describe('generateNeedsReviewSignal', () => {
  it('moet signal genereren voor NEEDS_REVIEW warning', () => {
    const validation: MassBalanceValidation = {
      batch_id: 'test-batch',
      batch_ref: 'TEST001',
      is_valid: true,
      errors: [],
      warnings: [{
        code: 'NEEDS_REVIEW',
        message: 'No cut-up yields recorded',
        severity: 'warning',
        affected_field: 'cut_up_yields',
      }],
      metrics: {
        live_to_griller_balance_kg: 0,
        live_to_griller_balance_pct: 0,
        griller_to_parts_balance_kg: 0,
        griller_to_parts_balance_pct: 0,
        total_parts_kg: 0,
        unaccounted_pct: 0,
        parts_present: 0,
        parts_expected: 5,
      },
    };

    const signal = generateNeedsReviewSignal(validation);

    expect(signal).not.toBeNull();
    expect(signal?.signal_type).toBe('yield_missing');
    expect(signal?.severity).toBe('warning');
    expect(signal?.batch_id).toBe('test-batch');
  });

  it('moet null geven als geen NEEDS_REVIEW warning', () => {
    const validation: MassBalanceValidation = {
      batch_id: 'test-batch',
      batch_ref: 'TEST001',
      is_valid: true,
      errors: [],
      warnings: [],
      metrics: {
        live_to_griller_balance_kg: 0,
        live_to_griller_balance_pct: 0,
        griller_to_parts_balance_kg: 0,
        griller_to_parts_balance_pct: 0,
        total_parts_kg: 3500,
        unaccounted_pct: 0.5,
        parts_present: 5,
        parts_expected: 5,
      },
    };

    const signal = generateNeedsReviewSignal(validation);

    expect(signal).toBeNull();
  });
});

describe('Corrections handling (no double-counting)', () => {
  // This test documents the expected behavior when using effective views
  it('moet alleen effectieve waarden gebruiken (geen dubbeltelling)', () => {
    // Scenario: Original yield was 1200 kg, corrected to 1230.18 kg
    // The validation should use only the corrected value
    // This is enforced by v_effective_batch_yields in the database

    const correctedBatch: BatchMassBalance = {
      batch_id: 'batch-corrected',
      batch_ref: 'P2520210',
      slaughter_date: '2026-01-21',
      source_live_weight: 5000.0,
      loss_rejection: 25.0,
      loss_slaughter: 1450.0,
      node_griller: 3525.0,
      // These values should come from v_effective_batch_yields
      // which resolves corrections automatically
      node_breast_cap: 1230.18,  // Corrected value, not 1200 + 1230.18
      node_leg_quarter: 1555.40,
      node_wings: 378.25,
      node_back_carcass: 265.13,
      node_offal: 88.38,
      loss_unaccounted: 7.66,
    };

    const result = validateMassBalance(correctedBatch);

    // If there was double-counting, total would be way over griller
    // and we'd get NEGATIVE_UNACCOUNTED error
    expect(result.errors.some(e => e.code === 'NEGATIVE_UNACCOUNTED')).toBe(false);
    expect(result.metrics.total_parts_kg).toBeCloseTo(3517.34, 0);
    expect(result.is_valid).toBe(true);
  });
});
