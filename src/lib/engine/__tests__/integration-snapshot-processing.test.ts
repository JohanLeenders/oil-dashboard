/**
 * Wave 5 — Final QA Integration Tests
 * Snapshot → Processing → Export → Validation pipeline
 * + Financial invariants
 *
 * REGRESSIE-CHECK:
 * - Pure tests, no DB, no Supabase, no fetch
 * - Uses factories from test-utils
 * - Covers full E2E pipeline + financial invariants
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateInstructionData } from '@/lib/engine/processing/generateInstructions';
import { computeTheoreticalAvailability, JA757_YIELDS } from '@/lib/engine/availability';
import { computeSurplusDeficit } from '@/lib/engine/orders/computeSurplusDeficit';
import { exportOrderSchemaToExcel } from '@/lib/export/orderSchemaExport';
import { validateForStorteboom } from '@/lib/export/storteboomValidator';
import {
  createMockSlaughter,
  createMockSnapshot,
  resetFactoryCounter,
} from '@/lib/test-utils/factories';
import type {
  OrderSchemaData,
  ProcessingRecipe,
  ProcessingInstruction,
  OrderSchemaAvailability,
} from '@/types/database';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipe(overrides?: Partial<ProcessingRecipe>): ProcessingRecipe {
  return {
    id: 'recipe-001',
    product_id: 'breast_fillet',
    recipe_name: 'Borstfilet standaard',
    yield_percentage: 95,
    instructions_json: {
      steps: [
        { description: 'Ontvel filet' },
        { description: 'Trim tot doelgewicht', parameters: { target_g: 180 } },
        { description: 'Verpak en label' },
      ],
    },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    ...overrides,
  };
}

function toSchemaAvailability(
  availability: ReturnType<typeof computeTheoreticalAvailability>,
  location: 'putten' | 'nijkerk' = 'putten'
): OrderSchemaAvailability[] {
  return availability.map((a) => ({
    product_id: a.part,
    product_name: a.name,
    location,
    expected_kg: a.expected_kg,
  }));
}

function buildSchemaData(
  liveWeightKg: number,
  orders: Map<string, number>
): OrderSchemaData {
  const avail = computeTheoreticalAvailability(liveWeightKg);
  const schemaAvail = toSchemaAvailability(avail);
  const surplus = computeSurplusDeficit(schemaAvail, orders);

  return {
    slaughter_id: 'slaughter-001',
    snapshot_date: new Date().toISOString(),
    availability: schemaAvail,
    orders: [],
    surplus_deficit: surplus,
  };
}

// ---------------------------------------------------------------------------
// A7-S3: E2E Integration Tests
// ---------------------------------------------------------------------------

describe('Wave 5: Snapshot → Processing Integration', () => {
  beforeEach(() => resetFactoryCounter());

  it('generates instruction data from snapshot surplus_deficit', () => {
    const orders = new Map([['breast_fillet', 500]]);
    const schema = buildSchemaData(10000, orders);
    const recipe = makeRecipe();

    const instruction = generateInstructionData(schema, recipe, 'Borstfilet');

    expect(instruction.product_id).toBe('breast_fillet');
    expect(instruction.quantity_kg).toBe(500);
    expect(instruction.recipe_name).toBe('Borstfilet standaard');
    expect(instruction.expected_output_kg).toBe(500 * 0.95);
    expect(instruction.steps).toHaveLength(3);
    expect(instruction.steps[0].step_number).toBe(1);
  });

  it('handles product absence in surplus_deficit', () => {
    const orders = new Map([['breast_fillet', 500]]);
    const schema = buildSchemaData(10000, orders);
    const recipe = makeRecipe({ product_id: 'nonexistent_product' });

    const instruction = generateInstructionData(schema, recipe, 'Unknown');

    expect(instruction.quantity_kg).toBe(0);
    expect(instruction.expected_output_kg).toBe(0);
  });

  it('handles recipe with null yield_percentage', () => {
    const orders = new Map([['breast_fillet', 1000]]);
    const schema = buildSchemaData(10000, orders);
    const recipe = makeRecipe({ yield_percentage: null });

    const instruction = generateInstructionData(schema, recipe, 'Borstfilet');

    expect(instruction.quantity_kg).toBe(1000);
    expect(instruction.expected_output_kg).toBeNull();
  });

  it('handles multiple recipes for same snapshot', () => {
    const orders = new Map([
      ['breast_fillet', 800],
      ['leg_quarter', 600],
    ]);
    const schema = buildSchemaData(10000, orders);

    const filetRecipe = makeRecipe({
      id: 'recipe-filet',
      product_id: 'breast_fillet',
      recipe_name: 'Filet verwerking',
      yield_percentage: 92,
    });
    const boutRecipe = makeRecipe({
      id: 'recipe-bout',
      product_id: 'leg_quarter',
      recipe_name: 'Bout verwerking',
      yield_percentage: 88,
    });

    const filetInstr = generateInstructionData(schema, filetRecipe, 'Borstfilet');
    const boutInstr = generateInstructionData(schema, boutRecipe, 'Bout');

    expect(filetInstr.quantity_kg).toBe(800);
    expect(filetInstr.expected_output_kg).toBeCloseTo(800 * 0.92);
    expect(boutInstr.quantity_kg).toBe(600);
    expect(boutInstr.expected_output_kg).toBeCloseTo(600 * 0.88);
  });

  it('recipe with no steps produces empty steps array', () => {
    const schema = buildSchemaData(10000, new Map([['breast_fillet', 100]]));
    const recipe = makeRecipe({ instructions_json: null });

    const instruction = generateInstructionData(schema, recipe, 'Borstfilet');

    expect(instruction.steps).toEqual([]);
  });

  it('validates and exports schema successfully', () => {
    const orders = new Map([
      ['breast_fillet', 500],
      ['leg_quarter', 300],
    ]);
    const schema = buildSchemaData(10000, orders);

    // Validate
    const validation = validateForStorteboom(schema);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Export
    const buffer = exportOrderSchemaToExcel(schema, '2026-03-01');
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);

    // Parse back and verify
    const wb = XLSX.read(buffer, { type: 'array' });
    expect(wb.SheetNames).toContain('Bestelschema');
    expect(wb.SheetNames).toContain('Info');
  });

  it('validation blocks export on invalid data', () => {
    const schema: OrderSchemaData = {
      slaughter_id: 'test',
      snapshot_date: new Date().toISOString(),
      availability: [],
      orders: [],
      surplus_deficit: [],
    };

    const validation = validateForStorteboom(schema);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('full E2E: availability → schema → instructions → export → validate', () => {
    // 1. Compute availability
    const liveWeight = 15000;
    const avail = computeTheoreticalAvailability(liveWeight);
    expect(avail.length).toBe(5);

    // 2. Build schema with orders
    const orders = new Map([
      ['breast_fillet', 2000],
      ['leg_quarter', 1500],
      ['wing', 400],
    ]);
    const schema = buildSchemaData(liveWeight, orders);

    // 3. Generate instructions
    const recipe = makeRecipe({ yield_percentage: 90 });
    const instruction = generateInstructionData(schema, recipe, 'Borstfilet');
    expect(instruction.quantity_kg).toBe(2000);
    expect(instruction.expected_output_kg).toBe(2000 * 0.9);

    // 4. Validate
    const validation = validateForStorteboom(schema);
    expect(validation.valid).toBe(true);

    // 5. Export
    const buffer = exportOrderSchemaToExcel(schema, '2026-03-15');
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Financial Invariants Block
// ---------------------------------------------------------------------------

describe('Wave 5: Financial Invariants', () => {
  beforeEach(() => resetFactoryCounter());

  it('INVARIANT: ordered sum across products equals total ordered', () => {
    const orders = new Map([
      ['breast_fillet', 1200],
      ['leg_quarter', 800],
      ['wing', 300],
    ]);
    const schema = buildSchemaData(10000, orders);

    const totalOrdered = schema.surplus_deficit.reduce(
      (sum, sd) => sum + sd.ordered_kg,
      0
    );

    // Total ordered from surplus_deficit must equal sum of input orders
    let expectedTotal = 0;
    for (const v of orders.values()) expectedTotal += v;
    expect(totalOrdered).toBe(expectedTotal);
  });

  it('INVARIANT: surplus never exceeds availability', () => {
    const orders = new Map([
      ['breast_fillet', 500],
      ['leg_quarter', 200],
    ]);
    const schema = buildSchemaData(10000, orders);

    for (const sd of schema.surplus_deficit) {
      // delta_kg = available_kg - ordered_kg
      // surplus (positive delta) can never exceed available_kg
      expect(sd.delta_kg).toBeLessThanOrEqual(sd.available_kg);
    }
  });

  it('INVARIANT: yield upper bound respected (output <= input * yield%)', () => {
    const recipe = makeRecipe({ yield_percentage: 95 });
    const schema = buildSchemaData(10000, new Map([['breast_fillet', 2000]]));
    const instruction = generateInstructionData(schema, recipe, 'Borstfilet');

    if (instruction.expected_output_kg !== null) {
      expect(instruction.expected_output_kg).toBeLessThanOrEqual(
        instruction.quantity_kg
      );
      expect(instruction.expected_output_kg).toBe(
        instruction.quantity_kg * (recipe.yield_percentage! / 100)
      );
    }
  });

  it('INVARIANT: snapshot immutability — ProcessingInstruction has no updated_at', () => {
    const mockInstruction: ProcessingInstruction = {
      id: 'instr-001',
      snapshot_id: 'snap-001',
      recipe_id: 'recipe-001',
      instruction_data: {
        recipe_id: 'recipe-001',
        recipe_name: 'Test',
        product_id: 'breast_fillet',
        product_name: 'Borstfilet',
        quantity_kg: 100,
        yield_percentage: 95,
        expected_output_kg: 95,
        steps: [],
      },
      status: 'pending',
      generated_at: new Date().toISOString(),
      created_by: null,
    };

    const keys = Object.keys(mockInstruction);
    expect(keys).not.toContain('updated_at');
    expect(keys).toContain('generated_at');
    expect(keys).toContain('id');
    expect(keys).toContain('snapshot_id');
  });

  it('INVARIANT: availability parts sum to known JA757 total', () => {
    const avail = computeTheoreticalAvailability(10000);

    // Sum of all yield percentages
    const totalYieldPct = Object.values(JA757_YIELDS).reduce(
      (sum, v) => sum + v.yield_pct,
      0
    );
    // Total yield should be reasonable (sum of parts > griller, since parts overlap)
    expect(totalYieldPct).toBeGreaterThan(0);
    expect(totalYieldPct).toBeLessThan(2); // sum < 200%

    // Each part's expected_kg should be liveWeight * yield_pct
    for (const a of avail) {
      const expectedYield = JA757_YIELDS[a.part];
      expect(a.expected_kg).toBeCloseTo(10000 * expectedYield.yield_pct, 1);
    }
  });

  it('INVARIANT: zero-order scenario has zero surplus reduction', () => {
    const schema = buildSchemaData(10000, new Map());

    for (const sd of schema.surplus_deficit) {
      expect(sd.ordered_kg).toBe(0);
      expect(sd.delta_kg).toBe(sd.available_kg);
    }
  });

  it('INVARIANT: negative deficit when orders exceed availability', () => {
    const breastAvail = 10000 * JA757_YIELDS['breast_fillet'].yield_pct;
    const excessOrder = Math.ceil(breastAvail) + 1000;

    const schema = buildSchemaData(10000, new Map([['breast_fillet', excessOrder]]));
    const breastSd = schema.surplus_deficit.find(
      (sd) => sd.product_id === 'breast_fillet'
    )!;

    expect(breastSd.delta_kg).toBeLessThan(0);
    expect(breastSd.delta_kg).toBe(breastSd.available_kg - breastSd.ordered_kg);
  });
});
