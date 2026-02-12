/**
 * Sales Pressure Engine Tests — Sprint 3
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDsi,
  getPressureFlag,
  generatePressureExplanation,
  calculatePartPressure,
  calculateAllPressures,
  getPressureColorClass,
  getPressureLabel,
  getVelocityTrendArrow,
  DEFAULT_PRESSURE_THRESHOLDS,
  type InventoryInput,
  type VelocityInput,
  type ThtRiskInput,
  type PressureFlag,
} from './sales-pressure';

describe('Sales Pressure Engine', () => {
  describe('calculateDsi', () => {
    it('should calculate DSI correctly', () => {
      // 1400 kg / 100 kg/day = 14 days
      expect(calculateDsi(1400, 100)).toBe(14);
    });

    it('should return null for zero velocity', () => {
      expect(calculateDsi(1000, 0)).toBeNull();
    });

    it('should return null for negative velocity', () => {
      expect(calculateDsi(1000, -10)).toBeNull();
    });

    it('should handle decimal values', () => {
      // 350 kg / 25 kg/day = 14 days
      expect(calculateDsi(350, 25)).toBe(14);
    });
  });

  describe('getPressureFlag', () => {
    it('should return green for DSI < 14', () => {
      expect(getPressureFlag(100, 10)).toBe('green');
      expect(getPressureFlag(100, 13.9)).toBe('green');
    });

    it('should return orange for DSI 14-28', () => {
      expect(getPressureFlag(100, 14)).toBe('orange');
      expect(getPressureFlag(100, 20)).toBe('orange');
      expect(getPressureFlag(100, 27.9)).toBe('orange');
    });

    it('should return red for DSI >= 28', () => {
      expect(getPressureFlag(100, 28)).toBe('red');
      expect(getPressureFlag(100, 50)).toBe('red');
      expect(getPressureFlag(100, 100)).toBe('red');
    });

    it('should return no_stock for zero inventory', () => {
      expect(getPressureFlag(0, 14)).toBe('no_stock');
      expect(getPressureFlag(-10, 14)).toBe('no_stock');
    });

    it('should return no_velocity for null DSI', () => {
      expect(getPressureFlag(100, null)).toBe('no_velocity');
    });

    it('should respect custom thresholds', () => {
      const customThresholds = { green_max_days: 7, orange_max_days: 14 };
      expect(getPressureFlag(100, 6, customThresholds)).toBe('green');
      expect(getPressureFlag(100, 10, customThresholds)).toBe('orange');
      expect(getPressureFlag(100, 20, customThresholds)).toBe('red');
    });
  });

  describe('generatePressureExplanation', () => {
    it('should generate Dutch explanation for no_stock', () => {
      const result = generatePressureExplanation(0, null, 'no_stock');
      expect(result).toBe('Geen voorraad beschikbaar.');
    });

    it('should generate Dutch explanation for no_velocity', () => {
      const result = generatePressureExplanation(100, null, 'no_velocity');
      expect(result).toBe('Geen verkoopdata beschikbaar voor berekening verkoopdruk.');
    });

    it('should generate Dutch explanation for green', () => {
      const result = generatePressureExplanation(100, 10, 'green');
      expect(result).toContain('Normale voorraaddruk');
      expect(result).toContain('10 dagen');
    });

    it('should generate Dutch explanation for orange', () => {
      const result = generatePressureExplanation(100, 20, 'orange');
      expect(result).toContain('Verhoogde voorraaddruk');
      expect(result).toContain('THT-risico');
    });

    it('should generate Dutch explanation for red', () => {
      const result = generatePressureExplanation(100, 35, 'red');
      expect(result).toContain('Hoge voorraaddruk');
      expect(result).toContain('Actie vereist');
    });
  });

  describe('calculatePartPressure', () => {
    const sampleInventory: InventoryInput = {
      part_code: 'breast_cap',
      inventory_kg: 700,
      batch_count: 3,
    };

    const sampleVelocity: VelocityInput = {
      part_code: 'breast_cap',
      avg_daily_sales_kg: 50,
      velocity_trend: 'STABLE',
    };

    const sampleTht: ThtRiskInput = {
      part_code: 'breast_cap',
      batches_red: 0,
      batches_orange: 1,
      batches_green: 2,
    };

    it('should calculate pressure correctly', () => {
      const result = calculatePartPressure(sampleInventory, sampleVelocity, sampleTht);

      expect(result.part_code).toBe('breast_cap');
      expect(result.inventory_kg).toBe(700);
      expect(result.avg_daily_sales_kg).toBe(50);
      expect(result.days_sales_inventory).toBe(14); // 700/50 = 14
      expect(result.pressure_flag).toBe('orange'); // DSI=14 is orange
    });

    it('should include THT risk data', () => {
      const result = calculatePartPressure(sampleInventory, sampleVelocity, sampleTht);

      expect(result.tht_risk.batches_red).toBe(0);
      expect(result.tht_risk.batches_orange).toBe(1);
      expect(result.tht_risk.batches_green).toBe(2);
      expect(result.tht_risk.has_urgent_tht).toBe(false);
    });

    it('should detect urgent THT', () => {
      const urgentTht: ThtRiskInput = {
        part_code: 'breast_cap',
        batches_red: 2,
        batches_orange: 1,
        batches_green: 0,
      };
      const result = calculatePartPressure(sampleInventory, sampleVelocity, urgentTht);

      expect(result.tht_risk.has_urgent_tht).toBe(true);
    });

    it('should handle missing velocity', () => {
      const result = calculatePartPressure(sampleInventory, null, sampleTht);

      expect(result.days_sales_inventory).toBeNull();
      expect(result.pressure_flag).toBe('no_velocity');
      expect(result.data_status).toBe('NO_VELOCITY_DATA');
    });

    it('should handle zero inventory', () => {
      const zeroInventory: InventoryInput = {
        part_code: 'breast_cap',
        inventory_kg: 0,
        batch_count: 0,
      };
      const result = calculatePartPressure(zeroInventory, sampleVelocity, null);

      expect(result.pressure_flag).toBe('no_stock');
    });
  });

  describe('calculateAllPressures', () => {
    it('should calculate pressures for multiple parts', () => {
      const inventories: InventoryInput[] = [
        { part_code: 'breast_cap', inventory_kg: 350, batch_count: 2 },
        { part_code: 'leg_quarter', inventory_kg: 1400, batch_count: 4 },
        { part_code: 'wings', inventory_kg: 200, batch_count: 2 },
      ];

      const velocities: VelocityInput[] = [
        { part_code: 'breast_cap', avg_daily_sales_kg: 50, velocity_trend: 'STABLE' },
        { part_code: 'leg_quarter', avg_daily_sales_kg: 40, velocity_trend: 'DECELERATING' },
        { part_code: 'wings', avg_daily_sales_kg: 20, velocity_trend: 'ACCELERATING' },
      ];

      const results = calculateAllPressures(inventories, velocities, []);

      expect(results).toHaveLength(3);
    });

    it('should sort by pressure (red first)', () => {
      const inventories: InventoryInput[] = [
        { part_code: 'green_part', inventory_kg: 100, batch_count: 1 },
        { part_code: 'red_part', inventory_kg: 3000, batch_count: 5 },
        { part_code: 'orange_part', inventory_kg: 1000, batch_count: 3 },
      ];

      const velocities: VelocityInput[] = [
        { part_code: 'green_part', avg_daily_sales_kg: 10, velocity_trend: 'STABLE' },
        { part_code: 'red_part', avg_daily_sales_kg: 50, velocity_trend: 'STABLE' },
        { part_code: 'orange_part', avg_daily_sales_kg: 50, velocity_trend: 'STABLE' },
      ];

      const results = calculateAllPressures(inventories, velocities, []);

      // DSI: green=10, red=60, orange=20
      expect(results[0].pressure_flag).toBe('red');
      expect(results[1].pressure_flag).toBe('orange');
      expect(results[2].pressure_flag).toBe('green');
    });
  });

  describe('UI Helpers', () => {
    it('should return correct color classes', () => {
      expect(getPressureColorClass('green')).toContain('green');
      expect(getPressureColorClass('orange')).toContain('orange');
      expect(getPressureColorClass('red')).toContain('red');
    });

    it('should return Dutch labels', () => {
      expect(getPressureLabel('green')).toBe('Normaal');
      expect(getPressureLabel('orange')).toBe('Verhoogd');
      expect(getPressureLabel('red')).toBe('Hoog');
      expect(getPressureLabel('no_stock')).toBe('Geen voorraad');
    });

    it('should return correct trend arrows', () => {
      expect(getVelocityTrendArrow('ACCELERATING')).toBe('↑');
      expect(getVelocityTrendArrow('DECELERATING')).toBe('↓');
      expect(getVelocityTrendArrow('STABLE')).toBe('→');
      expect(getVelocityTrendArrow('NO_DATA')).toBe('-');
    });
  });

  describe('Sprint 3 Contract Compliance', () => {
    it('should be observational only - no action recommendations', () => {
      const inventory: InventoryInput = {
        part_code: 'breast_cap',
        inventory_kg: 5000,
        batch_count: 10,
      };
      const velocity: VelocityInput = {
        part_code: 'breast_cap',
        avg_daily_sales_kg: 50,
        velocity_trend: 'STABLE',
      };

      const result = calculatePartPressure(inventory, velocity, null);

      // Should signal, not recommend action
      expect(result.explanation).not.toContain('Verkoop tegen korting');
      expect(result.explanation).not.toContain('Verlaag prijs');
      expect(result.explanation).not.toContain('Neem contact op');
    });

    it('should NOT include price advice', () => {
      const inventory: InventoryInput = {
        part_code: 'leg_quarter',
        inventory_kg: 10000,
        batch_count: 20,
      };
      const velocity: VelocityInput = {
        part_code: 'leg_quarter',
        avg_daily_sales_kg: 20,
        velocity_trend: 'DECELERATING',
      };

      const result = calculatePartPressure(inventory, velocity, null);

      expect(result.explanation).not.toContain('prijs');
      expect(result.explanation).not.toContain('korting');
      expect(result.explanation).not.toContain('€');
    });

    it('should use default thresholds that are LOCKED', () => {
      expect(DEFAULT_PRESSURE_THRESHOLDS.green_max_days).toBe(14);
      expect(DEFAULT_PRESSURE_THRESHOLDS.orange_max_days).toBe(28);
    });
  });
});
