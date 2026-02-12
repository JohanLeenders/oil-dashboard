/**
 * NRV Cost Engine Tests — Sprint 2
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNrvCosts,
  validateNrvResult,
  generateCostExplanation,
  type NrvInputItem,
  type ProcessingCostInput,
} from './nrv-cost';

describe('NRV Cost Engine', () => {
  // Test data
  const sampleItems: NrvInputItem[] = [
    { id: 'breast', part_code: 'breast_cap', quantity_kg: 350, market_price_per_kg: 9.50 },
    { id: 'leg', part_code: 'leg_quarter', quantity_kg: 420, market_price_per_kg: 5.50 },
    { id: 'wings', part_code: 'wings', quantity_kg: 105, market_price_per_kg: 5.00 },
    { id: 'back', part_code: 'back_carcass', quantity_kg: 75, market_price_per_kg: 2.50 },
    { id: 'offal', part_code: 'offal', quantity_kg: 40, market_price_per_kg: 1.50 },
  ];

  const sampleProcessingCosts: ProcessingCostInput[] = [
    { process_step: 'cutting', cost_per_kg: 0.15, applies_to_part_code: null, applies_to_sku: null, source: 'contract' },
    { process_step: 'vacuum', cost_per_kg: 0.08, applies_to_part_code: 'breast_cap', applies_to_sku: null, source: 'abc' },
    { process_step: 'packaging', cost_per_kg: 0.05, applies_to_part_code: null, applies_to_sku: null, source: 'manual' },
  ];

  const jointCost = 5000.00;

  describe('calculateNrvCosts', () => {
    it('should calculate NRV costs correctly', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      expect(result.batch_id).toBe('batch-123');
      expect(result.total_joint_cost).toBe(jointCost);
      expect(result.results).toHaveLength(5);
      expect(result.is_valid).toBe(true);
    });

    it('should allocate joint cost via SVASO (market value)', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, []);

      // Breast has highest market value, should get highest allocation
      const breast = result.results.find(r => r.part_code === 'breast_cap');
      const leg = result.results.find(r => r.part_code === 'leg_quarter');

      expect(breast).toBeDefined();
      expect(leg).toBeDefined();

      // Breast: 350 × 9.50 = 3325 market value
      // Leg: 420 × 5.50 = 2310 market value
      // Breast should have higher allocation factor
      expect(breast!.allocation_factor).toBeGreaterThan(leg!.allocation_factor);
    });

    it('should NOT allocate by weight', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, []);

      // Leg has more weight (420kg) than breast (350kg)
      // But breast has higher market value
      const breast = result.results.find(r => r.part_code === 'breast_cap');
      const leg = result.results.find(r => r.part_code === 'leg_quarter');

      // Weight ratio: leg/breast = 420/350 = 1.2 (leg is heavier)
      // But allocation ratio should favor breast (higher value)
      expect(breast!.allocated_joint_cost).toBeGreaterThan(leg!.allocated_joint_cost);
    });

    it('should sum allocation factors to 1.0', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      expect(result.sum_allocation_factors).toBeCloseTo(1.0, 4);
    });

    it('should add processing costs after split-off', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      const breast = result.results.find(r => r.part_code === 'breast_cap');

      // Breast should have cutting + vacuum + packaging = 0.15 + 0.08 + 0.05 = 0.28/kg
      expect(breast!.processing_costs_per_kg).toBeCloseTo(0.28, 4);

      // NRV = split-off cost + processing
      expect(breast!.nrv_cost_per_kg).toBeCloseTo(
        breast!.cost_splitoff_per_kg + 0.28,
        4
      );
    });

    it('should apply part-specific processing costs correctly', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      const breast = result.results.find(r => r.part_code === 'breast_cap');
      const leg = result.results.find(r => r.part_code === 'leg_quarter');

      // Breast: cutting + vacuum + packaging = 0.28/kg
      // Leg: cutting + packaging = 0.20/kg (no vacuum)
      expect(breast!.processing_costs_per_kg).toBeCloseTo(0.28, 4);
      expect(leg!.processing_costs_per_kg).toBeCloseTo(0.20, 4);
    });

    it('should calculate total NRV correctly', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      // Total NRV should equal joint cost + total processing costs
      // Note: There may be small rounding differences due to per-item rounding
      const expectedTotal = result.total_joint_cost + result.total_processing_costs;
      // Use 1% tolerance to account for cumulative rounding across items
      const tolerance = expectedTotal * 0.01;
      expect(Math.abs(result.total_nrv_cost - expectedTotal)).toBeLessThan(tolerance);
    });

    it('should handle empty processing costs', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, []);

      // NRV should equal split-off cost when no processing
      result.results.forEach(r => {
        expect(r.processing_costs_per_kg).toBe(0);
        expect(r.nrv_cost_per_kg).toBe(r.cost_splitoff_per_kg);
      });
    });

    it('should include processing breakdown for traceability', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      const breast = result.results.find(r => r.part_code === 'breast_cap');

      expect(breast!.processing_breakdown).toHaveLength(3);
      expect(breast!.processing_breakdown.map(pb => pb.process_step)).toContain('cutting');
      expect(breast!.processing_breakdown.map(pb => pb.process_step)).toContain('vacuum');
      expect(breast!.processing_breakdown.map(pb => pb.process_step)).toContain('packaging');
    });
  });

  describe('validateNrvResult', () => {
    it('should validate correct result as valid', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);
      const validation = validateNrvResult(result);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect allocation factor sum mismatch', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      // Manually corrupt the result
      result.sum_allocation_factors = 0.9;

      const validation = validateNrvResult(result);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('1.0'))).toBe(true);
    });
  });

  describe('generateCostExplanation', () => {
    it('should generate readable cost explanation', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);
      const breast = result.results.find(r => r.part_code === 'breast_cap')!;

      const explanation = generateCostExplanation(breast, 'P2520210', jointCost);

      // Check key sections exist
      expect(explanation).toContain('Kostprijsopbouw');
      expect(explanation).toContain('BATCH');
      expect(explanation).toContain('SPLIT-OFF ALLOCATIE');
      expect(explanation).toContain('VERWERKING');
      expect(explanation).toContain('NRV KOSTPRIJS');
      expect(explanation).toContain('P2520210');
    });

    it('should handle zero processing costs', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, []);
      const breast = result.results.find(r => r.part_code === 'breast_cap')!;

      const explanation = generateCostExplanation(breast, 'P2520210', jointCost);

      expect(explanation).toContain('Geen verwerkingskosten');
    });
  });

  describe('Sprint 2 Contract Compliance', () => {
    it('should only use Sales Value at Split-Off for allocation', () => {
      // This is verified by checking that higher market value = higher allocation
      // regardless of weight
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, []);

      // Calculate expected allocations based on market value
      const totalMarketValue = sampleItems.reduce(
        (sum, item) => sum + item.quantity_kg * item.market_price_per_kg,
        0
      );

      sampleItems.forEach(item => {
        const expectedFactor = (item.quantity_kg * item.market_price_per_kg) / totalMarketValue;
        const actual = result.results.find(r => r.id === item.id)!;
        expect(actual.allocation_factor).toBeCloseTo(expectedFactor, 4);
      });
    });

    it('should apply NRV only after split-off', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      // Split-off cost should be calculated without processing costs
      // NRV should be split-off + processing
      result.results.forEach(r => {
        const expectedNrv = r.cost_splitoff_per_kg + r.processing_costs_per_kg;
        expect(r.nrv_cost_per_kg).toBeCloseTo(expectedNrv, 4);
      });
    });

    it('should be fully traceable to batch', () => {
      const result = calculateNrvCosts('batch-123', sampleItems, jointCost, sampleProcessingCosts);

      expect(result.batch_id).toBe('batch-123');
      expect(result.total_joint_cost).toBe(jointCost);

      // Each result should have full breakdown
      result.results.forEach(r => {
        expect(r.allocated_joint_cost).toBeDefined();
        expect(r.allocation_factor).toBeDefined();
        expect(r.processing_breakdown).toBeDefined();
      });
    });
  });
});
