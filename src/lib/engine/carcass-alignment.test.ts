/**
 * Sprint 4: Carcass Alignment Engine Tests
 *
 * Tests for vierkantsverwaarding alignment calculations.
 * Validates analytical-only approach per Sprint 4 contract.
 */

import { describe, it, expect } from 'vitest';
import {
  getCarcassShare,
  calculateDeviation,
  categorizeDeviation,
  calculateAlignmentScore,
  calculateCustomerAlignment,
  calculateAllAlignments,
  generateAlignmentExplanation,
  getPartNameDutch,
  getAlignmentColorClass,
  getDeviationColorClass,
  getDeviationLabel,
  formatDeviation,
  JA757_CARCASS_REFERENCE,
  DEFAULT_DEVIATION_THRESHOLDS,
  type CustomerIntakeItem,
  type PartDeviation,
} from './carcass-alignment';

describe('Carcass Alignment Engine', () => {
  // ============================================================================
  // JA757 REFERENCE
  // ============================================================================

  describe('JA757 Carcass Reference', () => {
    it('should have all 5 anatomical parts', () => {
      expect(JA757_CARCASS_REFERENCE).toHaveLength(5);

      const partCodes = JA757_CARCASS_REFERENCE.map(r => r.part_code);
      expect(partCodes).toContain('breast_cap');
      expect(partCodes).toContain('leg_quarter');
      expect(partCodes).toContain('wings');
      expect(partCodes).toContain('back_carcass');
      expect(partCodes).toContain('offal');
    });

    it('should have proportions summing close to 100%', () => {
      const sum = JA757_CARCASS_REFERENCE.reduce((s, r) => s + r.carcass_share_pct, 0);
      // Allow some tolerance for rounding
      expect(sum).toBeCloseTo(101.55, 1); // Actual sum of midpoints
    });

    it('should match KPI_DEFINITIONS.md values', () => {
      const breastCap = JA757_CARCASS_REFERENCE.find(r => r.part_code === 'breast_cap');
      expect(breastCap?.min_pct).toBe(34.8);
      expect(breastCap?.max_pct).toBe(36.9);
      expect(breastCap?.carcass_share_pct).toBe(35.85); // Midpoint

      const legQuarter = JA757_CARCASS_REFERENCE.find(r => r.part_code === 'leg_quarter');
      expect(legQuarter?.min_pct).toBe(42.0);
      expect(legQuarter?.max_pct).toBe(44.8);
    });
  });

  describe('getCarcassShare', () => {
    it('should return correct share for breast_cap', () => {
      expect(getCarcassShare('breast_cap')).toBe(35.85);
    });

    it('should return correct share for leg_quarter', () => {
      expect(getCarcassShare('leg_quarter')).toBe(43.40);
    });

    it('should return 0 for unknown part', () => {
      expect(getCarcassShare('unknown' as 'breast_cap')).toBe(0);
    });
  });

  // ============================================================================
  // DEVIATION CALCULATION
  // ============================================================================

  describe('calculateDeviation', () => {
    it('should return positive deviation for over-uptake', () => {
      // Customer buys 45% breast, carcass is 35.85%
      const deviation = calculateDeviation(45, 35.85);
      expect(deviation).toBe(9.15);
    });

    it('should return negative deviation for under-uptake', () => {
      // Customer buys 30% leg, carcass is 43.40%
      const deviation = calculateDeviation(30, 43.40);
      expect(deviation).toBe(-13.40);
    });

    it('should return 0 for perfect alignment', () => {
      const deviation = calculateDeviation(35.85, 35.85);
      expect(deviation).toBe(0);
    });

    it('should handle decimal precision', () => {
      const deviation = calculateDeviation(40.123, 35.85);
      expect(deviation).toBe(4.27);
    });
  });

  describe('categorizeDeviation', () => {
    it('should categorize >10% as OVER_UPTAKE_HIGH', () => {
      expect(categorizeDeviation(11)).toBe('OVER_UPTAKE_HIGH');
      expect(categorizeDeviation(15)).toBe('OVER_UPTAKE_HIGH');
    });

    it('should categorize 5-10% as OVER_UPTAKE_MODERATE', () => {
      expect(categorizeDeviation(6)).toBe('OVER_UPTAKE_MODERATE');
      expect(categorizeDeviation(10)).toBe('OVER_UPTAKE_MODERATE');
    });

    it('should categorize ±5% as BALANCED', () => {
      expect(categorizeDeviation(0)).toBe('BALANCED');
      expect(categorizeDeviation(4.9)).toBe('BALANCED');
      expect(categorizeDeviation(-4.9)).toBe('BALANCED');
    });

    it('should categorize -5 to -10% as UNDER_UPTAKE_MODERATE', () => {
      expect(categorizeDeviation(-6)).toBe('UNDER_UPTAKE_MODERATE');
      expect(categorizeDeviation(-10)).toBe('UNDER_UPTAKE_MODERATE');
    });

    it('should categorize <-10% as UNDER_UPTAKE_HIGH', () => {
      expect(categorizeDeviation(-11)).toBe('UNDER_UPTAKE_HIGH');
      expect(categorizeDeviation(-15)).toBe('UNDER_UPTAKE_HIGH');
    });

    it('should respect custom thresholds', () => {
      const customThresholds = { moderate_pct: 3, high_pct: 7 };
      expect(categorizeDeviation(8, customThresholds)).toBe('OVER_UPTAKE_HIGH');
      expect(categorizeDeviation(5, customThresholds)).toBe('OVER_UPTAKE_MODERATE');
    });
  });

  // ============================================================================
  // ALIGNMENT SCORE
  // ============================================================================

  describe('calculateAlignmentScore', () => {
    it('should return 100 for 0% deviation', () => {
      expect(calculateAlignmentScore(0)).toBe(100);
    });

    it('should return 0 for 25%+ deviation', () => {
      expect(calculateAlignmentScore(25)).toBe(0);
      expect(calculateAlignmentScore(30)).toBe(0);
    });

    it('should scale linearly (4 points per 1%)', () => {
      expect(calculateAlignmentScore(5)).toBe(80);
      expect(calculateAlignmentScore(10)).toBe(60);
      expect(calculateAlignmentScore(12.5)).toBe(50);
    });

    it('should not go below 0', () => {
      expect(calculateAlignmentScore(50)).toBe(0);
    });
  });

  // ============================================================================
  // CUSTOMER ALIGNMENT
  // ============================================================================

  describe('calculateCustomerAlignment', () => {
    const sampleIntake: CustomerIntakeItem[] = [
      { customer_id: 'cust1', part_code: 'breast_cap', quantity_kg: 100, share_of_total_pct: 40 },
      { customer_id: 'cust1', part_code: 'leg_quarter', quantity_kg: 80, share_of_total_pct: 32 },
      { customer_id: 'cust1', part_code: 'wings', quantity_kg: 35, share_of_total_pct: 14 },
      { customer_id: 'cust1', part_code: 'back_carcass', quantity_kg: 25, share_of_total_pct: 10 },
      { customer_id: 'cust1', part_code: 'offal', quantity_kg: 10, share_of_total_pct: 4 },
    ];

    it('should calculate alignment for a customer', () => {
      const result = calculateCustomerAlignment('cust1', sampleIntake);

      expect(result.customer_id).toBe('cust1');
      expect(result.parts_analyzed).toBe(5);
      expect(result.part_deviations).toHaveLength(5);
      expect(result.alignment_score).toBeGreaterThanOrEqual(0);
      expect(result.alignment_score).toBeLessThanOrEqual(100);
    });

    it('should calculate correct deviations per part', () => {
      const result = calculateCustomerAlignment('cust1', sampleIntake);

      const breastDev = result.part_deviations.find(d => d.part_code === 'breast_cap');
      expect(breastDev?.customer_share_pct).toBe(40);
      expect(breastDev?.carcass_share_pct).toBe(35.85);
      expect(breastDev?.deviation_pct).toBe(4.15);
      expect(breastDev?.deviation_category).toBe('BALANCED');
    });

    it('should return empty result for unknown customer', () => {
      const result = calculateCustomerAlignment('unknown', sampleIntake);

      expect(result.parts_analyzed).toBe(0);
      expect(result.alignment_score).toBe(0);
      expect(result.explanation).toContain('Geen verkoopdata');
    });

    it('should generate Dutch explanation', () => {
      const result = calculateCustomerAlignment('cust1', sampleIntake);

      expect(result.explanation).toBeTruthy();
      expect(typeof result.explanation).toBe('string');
    });
  });

  describe('calculateAllAlignments', () => {
    const multiCustomerIntake: CustomerIntakeItem[] = [
      { customer_id: 'cust1', part_code: 'breast_cap', quantity_kg: 100, share_of_total_pct: 50 },
      { customer_id: 'cust1', part_code: 'leg_quarter', quantity_kg: 50, share_of_total_pct: 25 },
      { customer_id: 'cust2', part_code: 'breast_cap', quantity_kg: 30, share_of_total_pct: 30 },
      { customer_id: 'cust2', part_code: 'leg_quarter', quantity_kg: 70, share_of_total_pct: 70 },
    ];

    it('should calculate alignment for all customers', () => {
      const results = calculateAllAlignments(multiCustomerIntake);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.customer_id)).toContain('cust1');
      expect(results.map(r => r.customer_id)).toContain('cust2');
    });

    it('should calculate different scores for different profiles', () => {
      const results = calculateAllAlignments(multiCustomerIntake);

      const cust1 = results.find(r => r.customer_id === 'cust1');
      const cust2 = results.find(r => r.customer_id === 'cust2');

      expect(cust1?.alignment_score).not.toBe(cust2?.alignment_score);
    });
  });

  // ============================================================================
  // EXPLANATION GENERATION
  // ============================================================================

  describe('generateAlignmentExplanation', () => {
    it('should generate positive message for high alignment', () => {
      const deviations: PartDeviation[] = [
        { part_code: 'breast_cap', customer_share_pct: 36, carcass_share_pct: 35.85, deviation_pct: 0.15, deviation_category: 'BALANCED' },
      ];
      const explanation = generateAlignmentExplanation(85, deviations);

      expect(explanation).toContain('dicht bij karkasbalans');
    });

    it('should mention over-uptake parts', () => {
      const deviations: PartDeviation[] = [
        { part_code: 'breast_cap', customer_share_pct: 50, carcass_share_pct: 35.85, deviation_pct: 14.15, deviation_category: 'OVER_UPTAKE_HIGH' },
      ];
      const explanation = generateAlignmentExplanation(50, deviations);

      expect(explanation).toContain('Meer afname');
      expect(explanation).toContain('Filet');
    });

    it('should mention under-uptake parts', () => {
      const deviations: PartDeviation[] = [
        { part_code: 'leg_quarter', customer_share_pct: 25, carcass_share_pct: 43.40, deviation_pct: -18.40, deviation_category: 'UNDER_UPTAKE_HIGH' },
      ];
      const explanation = generateAlignmentExplanation(30, deviations);

      expect(explanation).toContain('Minder afname');
      expect(explanation).toContain('Poot');
    });

    it('should generate Dutch text', () => {
      const deviations: PartDeviation[] = [];
      const explanation = generateAlignmentExplanation(90, deviations);

      // Check for Dutch language markers
      expect(explanation).toMatch(/profiel|karkasbalans|afname/i);
    });
  });

  describe('getPartNameDutch', () => {
    it('should return Dutch names for all parts', () => {
      expect(getPartNameDutch('breast_cap')).toBe('Filet');
      expect(getPartNameDutch('leg_quarter')).toBe('Poot');
      expect(getPartNameDutch('wings')).toBe('Vleugels');
      expect(getPartNameDutch('back_carcass')).toBe('Rug/karkas');
      expect(getPartNameDutch('offal')).toBe('Organen');
    });
  });

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  describe('UI Helpers', () => {
    describe('getAlignmentColorClass', () => {
      it('should return green for high alignment', () => {
        expect(getAlignmentColorClass(85)).toContain('green');
      });

      it('should return yellow for medium alignment', () => {
        expect(getAlignmentColorClass(60)).toContain('yellow');
      });

      it('should return red for low alignment', () => {
        expect(getAlignmentColorClass(30)).toContain('red');
      });
    });

    describe('getDeviationColorClass', () => {
      it('should return blue for over-uptake', () => {
        expect(getDeviationColorClass('OVER_UPTAKE_HIGH')).toContain('blue');
        expect(getDeviationColorClass('OVER_UPTAKE_MODERATE')).toContain('blue');
      });

      it('should return orange for under-uptake', () => {
        expect(getDeviationColorClass('UNDER_UPTAKE_HIGH')).toContain('orange');
        expect(getDeviationColorClass('UNDER_UPTAKE_MODERATE')).toContain('orange');
      });

      it('should return green for balanced', () => {
        expect(getDeviationColorClass('BALANCED')).toContain('green');
      });
    });

    describe('getDeviationLabel', () => {
      it('should return Dutch labels', () => {
        expect(getDeviationLabel('OVER_UPTAKE_HIGH')).toBe('Sterke over-afname');
        expect(getDeviationLabel('BALANCED')).toBe('Gebalanceerd');
      });
    });

    describe('formatDeviation', () => {
      it('should add + sign for positive', () => {
        expect(formatDeviation(5.5)).toBe('+5.5%');
      });

      it('should show - sign for negative', () => {
        expect(formatDeviation(-3.2)).toBe('-3.2%');
      });

      it('should add + for zero', () => {
        expect(formatDeviation(0)).toBe('+0.0%');
      });
    });
  });

  // ============================================================================
  // SPRINT 4 CONTRACT COMPLIANCE
  // ============================================================================

  describe('Sprint 4 Contract Compliance', () => {
    it('should NOT include any price advice', () => {
      const result = calculateCustomerAlignment('cust1', [
        { customer_id: 'cust1', part_code: 'breast_cap', quantity_kg: 100, share_of_total_pct: 60 },
      ]);

      // Explanation should not contain price-related terms
      expect(result.explanation.toLowerCase()).not.toContain('prijs');
      expect(result.explanation.toLowerCase()).not.toContain('korting');
      expect(result.explanation.toLowerCase()).not.toContain('advies');
    });

    it('should NOT include any recommendations', () => {
      const deviations: PartDeviation[] = [
        { part_code: 'breast_cap', customer_share_pct: 60, carcass_share_pct: 35.85, deviation_pct: 24.15, deviation_category: 'OVER_UPTAKE_HIGH' },
      ];
      const explanation = generateAlignmentExplanation(10, deviations);

      // Should not tell what to do
      expect(explanation.toLowerCase()).not.toContain('moet');
      expect(explanation.toLowerCase()).not.toContain('actie');
      expect(explanation.toLowerCase()).not.toContain('aanbeveling');
    });

    it('should use JA757 as normative reference', () => {
      const breastRef = JA757_CARCASS_REFERENCE.find(r => r.part_code === 'breast_cap');
      expect(breastRef).toBeDefined();
      // Verify it matches the locked values from KPI_DEFINITIONS.md
      expect(breastRef?.min_pct).toBe(34.8);
      expect(breastRef?.max_pct).toBe(36.9);
    });

    it('should be descriptive, not judgmental', () => {
      // Labels should describe, not judge
      expect(getDeviationLabel('OVER_UPTAKE_HIGH')).not.toContain('slecht');
      expect(getDeviationLabel('UNDER_UPTAKE_HIGH')).not.toContain('probleem');
      expect(getDeviationLabel('BALANCED')).not.toContain('goed');
    });
  });
});
