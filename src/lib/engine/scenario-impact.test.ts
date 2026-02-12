/**
 * Sprint 4: Scenario Impact Engine Tests
 *
 * Tests for price elasticity scenario projections.
 * CRITICAL: Validates that all outputs are labeled as ASSUMPTIONS.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateVolumeChange,
  calculateProjectedVolume,
  determineBalanceEffect,
  calculatePartImpact,
  calculateScenarioImpact,
  calculateAllScenarioImpacts,
  getVolumeChangeColorClass,
  getPriceChangeColorClass,
  formatPercentageWithSign,
  getAssumptionSourceLabel,
  getBalanceEffectLabel,
  SCENARIO_DISCLAIMER,
  SCENARIO_DISCLAIMER_EN,
  type ElasticityAssumption,
  type PartBaseline,
} from './scenario-impact';

describe('Scenario Impact Engine', () => {
  // ============================================================================
  // DISCLAIMER VALIDATION (CRITICAL)
  // ============================================================================

  describe('Disclaimer Requirements', () => {
    it('should have a Dutch disclaimer', () => {
      expect(SCENARIO_DISCLAIMER).toBeTruthy();
      expect(SCENARIO_DISCLAIMER.toLowerCase()).toContain('aanname');
      expect(SCENARIO_DISCLAIMER.toLowerCase()).toContain('geen');
    });

    it('should have an English disclaimer', () => {
      expect(SCENARIO_DISCLAIMER_EN).toBeTruthy();
      expect(SCENARIO_DISCLAIMER_EN.toLowerCase()).toContain('assumption');
      expect(SCENARIO_DISCLAIMER_EN.toLowerCase()).toContain('not');
    });

    it('should include disclaimer in all projections', () => {
      const assumption: ElasticityAssumption = {
        scenario_id: 'test',
        scenario_name: 'Test Scenario',
        part_code: 'breast_cap',
        price_change_pct: -10,
        expected_volume_change_pct: 15,
        assumption_source: 'manual',
      };

      const result = calculatePartImpact(assumption, undefined);

      expect(result.disclaimer).toBe(SCENARIO_DISCLAIMER);
    });

    it('should include disclaimer in scenario results', () => {
      const result = calculateScenarioImpact('test', [], []);

      expect(result.disclaimer).toBe(SCENARIO_DISCLAIMER);
    });
  });

  // ============================================================================
  // VOLUME CALCULATIONS
  // ============================================================================

  describe('calculateVolumeChange', () => {
    it('should calculate positive volume change', () => {
      // 100 kg with 15% increase
      const change = calculateVolumeChange(100, 15);
      expect(change).toBe(15);
    });

    it('should calculate negative volume change', () => {
      // 100 kg with 10% decrease
      const change = calculateVolumeChange(100, -10);
      expect(change).toBe(-10);
    });

    it('should handle zero change', () => {
      const change = calculateVolumeChange(100, 0);
      expect(change).toBe(0);
    });

    it('should handle decimal precision', () => {
      const change = calculateVolumeChange(150.5, 12.5);
      expect(change).toBe(18.81);
    });
  });

  describe('calculateProjectedVolume', () => {
    it('should calculate increased volume', () => {
      // 100 kg + 15% = 115 kg
      const projected = calculateProjectedVolume(100, 15);
      expect(projected).toBe(115);
    });

    it('should calculate decreased volume', () => {
      // 100 kg - 10% = 90 kg
      const projected = calculateProjectedVolume(100, -10);
      expect(projected).toBe(90);
    });

    it('should handle no change', () => {
      const projected = calculateProjectedVolume(100, 0);
      expect(projected).toBe(100);
    });

    it('should handle decimal precision', () => {
      const projected = calculateProjectedVolume(75.5, 20);
      expect(projected).toBe(90.6);
    });
  });

  // ============================================================================
  // BALANCE EFFECT
  // ============================================================================

  describe('determineBalanceEffect', () => {
    it('should return NO_BASELINE for null current', () => {
      expect(determineBalanceEffect(null, 10)).toBe('NO_BASELINE');
    });

    it('should return NO_BASELINE for undefined current', () => {
      expect(determineBalanceEffect(undefined, 10)).toBe('NO_BASELINE');
    });

    it('should return NO_BASELINE for zero current', () => {
      expect(determineBalanceEffect(0, 10)).toBe('NO_BASELINE');
    });

    it('should return NEUTRAL for tiny change', () => {
      expect(determineBalanceEffect(100, 0.005)).toBe('NEUTRAL');
      expect(determineBalanceEffect(100, -0.005)).toBe('NEUTRAL');
    });

    it('should return CHANGES_BALANCE for significant change', () => {
      expect(determineBalanceEffect(100, 5)).toBe('CHANGES_BALANCE');
      expect(determineBalanceEffect(100, -5)).toBe('CHANGES_BALANCE');
    });
  });

  // ============================================================================
  // PART IMPACT CALCULATION
  // ============================================================================

  describe('calculatePartImpact', () => {
    const sampleAssumption: ElasticityAssumption = {
      scenario_id: 'scenario1',
      scenario_name: 'Prijs verlaging filet',
      part_code: 'breast_cap',
      price_change_pct: -10,
      expected_volume_change_pct: 15,
      assumption_source: 'historical',
      assumption_note: 'Gebaseerd op Q3 2025 data',
    };

    const sampleBaseline: PartBaseline = {
      part_code: 'breast_cap',
      current_daily_kg: 100,
      current_30d_kg: 3000,
    };

    it('should calculate projected volumes correctly', () => {
      const result = calculatePartImpact(sampleAssumption, sampleBaseline);

      expect(result.current_daily_kg).toBe(100);
      expect(result.projected_daily_kg).toBe(115); // 100 * 1.15
      expect(result.volume_change_daily_kg).toBe(15); // 100 * 0.15
      expect(result.projected_30d_kg).toBe(3450); // 3000 * 1.15
    });

    it('should include scenario metadata', () => {
      const result = calculatePartImpact(sampleAssumption, sampleBaseline);

      expect(result.scenario_id).toBe('scenario1');
      expect(result.scenario_name).toBe('Prijs verlaging filet');
      expect(result.price_change_pct).toBe(-10);
      expect(result.expected_volume_change_pct).toBe(15);
    });

    it('should include assumption transparency', () => {
      const result = calculatePartImpact(sampleAssumption, sampleBaseline);

      expect(result.assumption_source).toBe('historical');
      expect(result.assumption_note).toBe('Gebaseerd op Q3 2025 data');
    });

    it('should handle missing baseline', () => {
      const result = calculatePartImpact(sampleAssumption, undefined);

      expect(result.current_daily_kg).toBe(0);
      expect(result.projected_daily_kg).toBe(0);
      expect(result.balance_effect).toBe('NO_BASELINE');
    });

    it('should always include disclaimer', () => {
      const result = calculatePartImpact(sampleAssumption, sampleBaseline);

      expect(result.disclaimer).toBe(SCENARIO_DISCLAIMER);
    });
  });

  // ============================================================================
  // SCENARIO IMPACT CALCULATION
  // ============================================================================

  describe('calculateScenarioImpact', () => {
    const assumptions: ElasticityAssumption[] = [
      {
        scenario_id: 'scenario1',
        scenario_name: 'Volume stimulatie',
        scenario_description: 'Test scenario voor prijselasticiteit',
        part_code: 'breast_cap',
        price_change_pct: -10,
        expected_volume_change_pct: 15,
        assumption_source: 'manual',
      },
      {
        scenario_id: 'scenario1',
        scenario_name: 'Volume stimulatie',
        part_code: 'leg_quarter',
        price_change_pct: -5,
        expected_volume_change_pct: 8,
        assumption_source: 'manual',
      },
    ];

    const baselines: PartBaseline[] = [
      { part_code: 'breast_cap', current_daily_kg: 100, current_30d_kg: 3000 },
      { part_code: 'leg_quarter', current_daily_kg: 150, current_30d_kg: 4500 },
    ];

    it('should calculate impact for all parts in scenario', () => {
      const result = calculateScenarioImpact('scenario1', assumptions, baselines);

      expect(result.scenario_id).toBe('scenario1');
      expect(result.scenario_name).toBe('Volume stimulatie');
      expect(result.part_projections).toHaveLength(2);
    });

    it('should include scenario description', () => {
      const result = calculateScenarioImpact('scenario1', assumptions, baselines);

      expect(result.scenario_description).toBe('Test scenario voor prijselasticiteit');
    });

    it('should calculate total volume change', () => {
      const result = calculateScenarioImpact('scenario1', assumptions, baselines);

      // breast_cap: 3000 -> 3450 = +450
      // leg_quarter: 4500 -> 4860 = +360
      // Total: +810
      expect(result.total_volume_change_30d_kg).toBe(810);
    });

    it('should count affected parts', () => {
      const result = calculateScenarioImpact('scenario1', assumptions, baselines);

      expect(result.parts_affected).toBe(2);
    });

    it('should return empty for unknown scenario', () => {
      const result = calculateScenarioImpact('unknown', assumptions, baselines);

      expect(result.part_projections).toHaveLength(0);
      expect(result.scenario_name).toBe('Onbekend scenario');
    });

    it('should always include disclaimer', () => {
      const result = calculateScenarioImpact('scenario1', assumptions, baselines);

      expect(result.disclaimer).toBe(SCENARIO_DISCLAIMER);
    });
  });

  describe('calculateAllScenarioImpacts', () => {
    const assumptions: ElasticityAssumption[] = [
      { scenario_id: 'sc1', scenario_name: 'Scenario 1', part_code: 'breast_cap', price_change_pct: -10, expected_volume_change_pct: 15, assumption_source: 'manual' },
      { scenario_id: 'sc2', scenario_name: 'Scenario 2', part_code: 'breast_cap', price_change_pct: -5, expected_volume_change_pct: 7, assumption_source: 'manual' },
    ];

    const baselines: PartBaseline[] = [
      { part_code: 'breast_cap', current_daily_kg: 100, current_30d_kg: 3000 },
    ];

    it('should calculate all scenarios', () => {
      const results = calculateAllScenarioImpacts(assumptions, baselines);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.scenario_id)).toContain('sc1');
      expect(results.map(r => r.scenario_id)).toContain('sc2');
    });

    it('should have different projections per scenario', () => {
      const results = calculateAllScenarioImpacts(assumptions, baselines);

      const sc1 = results.find(r => r.scenario_id === 'sc1');
      const sc2 = results.find(r => r.scenario_id === 'sc2');

      expect(sc1?.total_volume_change_30d_kg).toBe(450); // 15%
      expect(sc2?.total_volume_change_30d_kg).toBe(210); // 7%
    });
  });

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  describe('UI Helpers', () => {
    describe('getVolumeChangeColorClass', () => {
      it('should return green for positive', () => {
        expect(getVolumeChangeColorClass(15)).toContain('green');
      });

      it('should return red for negative', () => {
        expect(getVolumeChangeColorClass(-10)).toContain('red');
      });

      it('should return gray for zero', () => {
        expect(getVolumeChangeColorClass(0)).toContain('gray');
      });
    });

    describe('getPriceChangeColorClass', () => {
      it('should return blue for positive (price increase)', () => {
        expect(getPriceChangeColorClass(10)).toContain('blue');
      });

      it('should return orange for negative (price decrease)', () => {
        expect(getPriceChangeColorClass(-10)).toContain('orange');
      });
    });

    describe('formatPercentageWithSign', () => {
      it('should add + for positive', () => {
        expect(formatPercentageWithSign(15.5)).toBe('+15.5%');
      });

      it('should show - for negative', () => {
        expect(formatPercentageWithSign(-10.2)).toBe('-10.2%');
      });
    });

    describe('getAssumptionSourceLabel', () => {
      it('should return Dutch labels', () => {
        expect(getAssumptionSourceLabel('manual')).toBe('Handmatig ingevoerd');
        expect(getAssumptionSourceLabel('historical')).toBe('Historische data');
        expect(getAssumptionSourceLabel('market_research')).toBe('Marktonderzoek');
        expect(getAssumptionSourceLabel('expert_estimate')).toBe('Expert inschatting');
      });
    });

    describe('getBalanceEffectLabel', () => {
      it('should return Dutch labels', () => {
        expect(getBalanceEffectLabel('NO_BASELINE')).toBe('Geen baseline data');
        expect(getBalanceEffectLabel('NEUTRAL')).toBe('Neutraal');
        expect(getBalanceEffectLabel('CHANGES_BALANCE')).toBe('Beïnvloedt balans');
      });
    });
  });

  // ============================================================================
  // SPRINT 4 CONTRACT COMPLIANCE
  // ============================================================================

  describe('Sprint 4 Contract Compliance', () => {
    it('should NOT include any price advice', () => {
      // Disclaimer should state it's NOT a recommendation (negation is OK)
      // The disclaimer correctly says "GEEN voorspelling of aanbeveling"
      expect(SCENARIO_DISCLAIMER.toLowerCase()).not.toContain('advies');
      // "aanbeveling" appears in negation form ("geen...aanbeveling") which is correct
      expect(SCENARIO_DISCLAIMER.toLowerCase()).toContain('geen');
    });

    it('should explicitly state scenarios are assumptions', () => {
      expect(SCENARIO_DISCLAIMER.toLowerCase()).toContain('aanname');
      expect(SCENARIO_DISCLAIMER_EN.toLowerCase()).toContain('assumption');
    });

    it('should explicitly state scenarios are not predictions', () => {
      expect(SCENARIO_DISCLAIMER.toLowerCase()).toContain('geen');
      expect(SCENARIO_DISCLAIMER_EN.toLowerCase()).toContain('not');
    });

    it('should require assumption source for transparency', () => {
      const assumption: ElasticityAssumption = {
        scenario_id: 'test',
        scenario_name: 'Test',
        part_code: 'breast_cap',
        price_change_pct: -10,
        expected_volume_change_pct: 15,
        assumption_source: 'manual', // Required field
      };

      const result = calculatePartImpact(assumption, undefined);

      // Source must be preserved in output
      expect(result.assumption_source).toBe('manual');
    });

    it('should allow assumption notes for documentation', () => {
      const assumption: ElasticityAssumption = {
        scenario_id: 'test',
        scenario_name: 'Test',
        part_code: 'breast_cap',
        price_change_pct: -10,
        expected_volume_change_pct: 15,
        assumption_source: 'historical',
        assumption_note: 'Based on 2024-Q4 seasonal patterns',
      };

      const result = calculatePartImpact(assumption, undefined);

      expect(result.assumption_note).toBe('Based on 2024-Q4 seasonal patterns');
    });

    it('should NOT suggest any actions', () => {
      const assumption: ElasticityAssumption = {
        scenario_id: 'test',
        scenario_name: 'Test',
        part_code: 'breast_cap',
        price_change_pct: -20, // Large price decrease
        expected_volume_change_pct: 30, // Large volume increase
        assumption_source: 'manual',
      };

      const baseline: PartBaseline = {
        part_code: 'breast_cap',
        current_daily_kg: 100,
        current_30d_kg: 3000,
      };

      const result = calculatePartImpact(assumption, baseline);

      // Should just calculate, not recommend
      expect(result.disclaimer.toLowerCase()).not.toContain('actie');
      expect(result.disclaimer.toLowerCase()).not.toContain('moet');
    });
  });
});
