/**
 * Integration tests: Full Processing Flow
 * Wave 4 — A7-S3: End-to-end pure function chain
 *
 * Tests the complete flow:
 *   Availability -> OrderSchemaData -> ProcessingInstructions -> Export + Validation
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no DB, no Supabase mock
 * - All data constructed in-test
 * - Covers: generateInstructionData, computeTheoreticalAvailability,
 *   computeSurplusDeficit, exportOrderSchemaToExcel, validateForStorteboom
 * - Verifies ProcessingInstruction has NO updated_at field (append-only contract)
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { generateInstructionData } from '@/lib/engine/processing/generateInstructions';
import {
  computeTheoreticalAvailability,
  JA757_YIELDS,
} from '@/lib/engine/availability';
import { computeSurplusDeficit } from '@/lib/engine/orders/computeSurplusDeficit';
import { exportOrderSchemaToExcel } from '@/lib/export/orderSchemaExport';
import { validateForStorteboom } from '@/lib/export/storteboomValidator';
import type {
  OrderSchemaData,
  OrderSchemaAvailability,
  ProcessingRecipe,
  ProcessingInstruction,
  ProcessingInstructionData,
} from '@/types/database';

// ============================================================================
// Helpers
// ============================================================================

function makeSnapshot(
  overrides?: Partial<OrderSchemaData>,
): OrderSchemaData {
  return {
    slaughter_id: 'sl-integration-1',
    snapshot_date: '2026-02-19',
    availability: [],
    orders: [],
    surplus_deficit: [],
    ...overrides,
  };
}

function makeRecipe(overrides?: Partial<ProcessingRecipe>): ProcessingRecipe {
  return {
    id: 'recipe-int-1',
    product_id: 'prod-filet',
    recipe_name: 'Filet Standaard',
    yield_percentage: 72.5,
    instructions_json: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    ...overrides,
  };
}

/**
 * Convert theoretical availability to OrderSchemaAvailability format
 */
function toSchemaAvailability(
  theoretical: ReturnType<typeof computeTheoreticalAvailability>,
  location: 'putten' | 'nijkerk' = 'putten',
): OrderSchemaAvailability[] {
  return theoretical.map((t) => ({
    product_id: t.part,
    product_name: t.name,
    location,
    expected_kg: t.expected_kg,
  }));
}

// ============================================================================
// 1. Create order schema -> Generate instruction data
// ============================================================================

describe('Integration: OrderSchemaData -> generateInstructionData', () => {
  it('builds OrderSchemaData with surplus_deficit and generates correct instruction data', () => {
    // Step 1: Build an OrderSchemaData with surplus_deficit entries
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-filet', available_kg: 800, ordered_kg: 1200, delta_kg: -400 },
        { product_id: 'prod-bout', available_kg: 600, ordered_kg: 300, delta_kg: 300 },
      ],
      orders: [
        {
          customer_id: 'cust-1',
          customer_name: 'Restaurant De Kroon',
          lines: [
            { product_id: 'prod-filet', quantity_kg: 700 },
            { product_id: 'prod-bout', quantity_kg: 300 },
          ],
        },
        {
          customer_id: 'cust-2',
          customer_name: 'Slagerij Van Dam',
          lines: [{ product_id: 'prod-filet', quantity_kg: 500 }],
        },
      ],
    });

    // Step 2: Create a ProcessingRecipe mock
    const recipe = makeRecipe({
      id: 'recipe-filet-std',
      product_id: 'prod-filet',
      recipe_name: 'Filet Snijden & Verpakken',
      yield_percentage: 68,
      instructions_json: {
        steps: [
          { description: 'Ontbeen de borst' },
          { description: 'Snij filet op maat', parameters: { max_gewicht_g: 200 } },
          { description: 'Vacuumverpakking' },
        ],
      },
    });

    // Step 3: Call generateInstructionData
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet 200g');

    // Step 4: Verify instruction data
    expect(result.product_id).toBe('prod-filet');
    expect(result.product_name).toBe('Kipfilet 200g');
    expect(result.recipe_id).toBe('recipe-filet-std');
    expect(result.recipe_name).toBe('Filet Snijden & Verpakken');
    expect(result.quantity_kg).toBe(1200); // from surplus_deficit.ordered_kg
    expect(result.yield_percentage).toBe(68);
    expect(result.expected_output_kg).toBe(1200 * 0.68); // 816
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]).toEqual({ step_number: 1, description: 'Ontbeen de borst' });
    expect(result.steps[1]).toEqual({
      step_number: 2,
      description: 'Snij filet op maat',
      parameters: { max_gewicht_g: 200 },
    });
    expect(result.steps[2]).toEqual({ step_number: 3, description: 'Vacuumverpakking' });
  });
});

// ============================================================================
// 2. Finalized snapshot + recipe -> instruction generation
// ============================================================================

describe('Integration: Finalized snapshot (multiple products/orders) + recipe -> instructions', () => {
  it('generates correct instructions from realistic multi-product snapshot', () => {
    // Create realistic OrderSchemaData with multiple products and multiple orders
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-filet', available_kg: 2000, ordered_kg: 2500, delta_kg: -500 },
        { product_id: 'prod-bout', available_kg: 1500, ordered_kg: 1000, delta_kg: 500 },
        { product_id: 'prod-vleugel', available_kg: 400, ordered_kg: 350, delta_kg: 50 },
      ],
      orders: [
        {
          customer_id: 'cust-1',
          customer_name: 'Horeca Groothandel',
          lines: [
            { product_id: 'prod-filet', quantity_kg: 1500 },
            { product_id: 'prod-bout', quantity_kg: 600 },
          ],
        },
        {
          customer_id: 'cust-2',
          customer_name: 'Supermarkt Keten',
          lines: [
            { product_id: 'prod-filet', quantity_kg: 1000 },
            { product_id: 'prod-bout', quantity_kg: 400 },
            { product_id: 'prod-vleugel', quantity_kg: 350 },
          ],
        },
      ],
    });

    // Recipe with steps in instructions_json
    const recipe = makeRecipe({
      id: 'recipe-bout-std',
      product_id: 'prod-bout',
      recipe_name: 'Bout Portioneren',
      yield_percentage: 85,
      instructions_json: {
        steps: [
          { description: 'Scheid dij van drumstick' },
          { description: 'Weeg porties', parameters: { target_g: 350 } },
          { description: 'Verpak in trays' },
          { description: 'Label met THT-datum' },
        ],
      },
    });

    const result = generateInstructionData(snapshot, recipe, 'Kipbout 350g');

    // Verify steps extracted correctly
    expect(result.steps).toHaveLength(4);
    expect(result.steps[0].step_number).toBe(1);
    expect(result.steps[0].description).toBe('Scheid dij van drumstick');
    expect(result.steps[1].step_number).toBe(2);
    expect(result.steps[1].parameters).toEqual({ target_g: 350 });
    expect(result.steps[3].step_number).toBe(4);
    expect(result.steps[3].description).toBe('Label met THT-datum');

    // Verify quantity_kg comes from surplus_deficit.ordered_kg for prod-bout
    expect(result.quantity_kg).toBe(1000);
    expect(result.yield_percentage).toBe(85);
    expect(result.expected_output_kg).toBe(1000 * 0.85); // 850
  });

  it('generates instruction for each product in the snapshot independently', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-filet', available_kg: 500, ordered_kg: 800, delta_kg: -300 },
        { product_id: 'prod-bout', available_kg: 300, ordered_kg: 200, delta_kg: 100 },
      ],
    });

    const filetRecipe = makeRecipe({
      id: 'recipe-filet',
      product_id: 'prod-filet',
      recipe_name: 'Filet Basic',
      yield_percentage: 70,
      instructions_json: { steps: [{ description: 'Snijden' }] },
    });

    const boutRecipe = makeRecipe({
      id: 'recipe-bout',
      product_id: 'prod-bout',
      recipe_name: 'Bout Basic',
      yield_percentage: 90,
      instructions_json: { steps: [{ description: 'Portioneren' }, { description: 'Verpakken' }] },
    });

    const filetResult = generateInstructionData(snapshot, filetRecipe, 'Kipfilet');
    const boutResult = generateInstructionData(snapshot, boutRecipe, 'Kipbout');

    // Each instruction gets correct quantity from its own product entry
    expect(filetResult.quantity_kg).toBe(800);
    expect(filetResult.expected_output_kg).toBe(800 * 0.70);
    expect(filetResult.steps).toHaveLength(1);

    expect(boutResult.quantity_kg).toBe(200);
    expect(boutResult.expected_output_kg).toBe(200 * 0.90);
    expect(boutResult.steps).toHaveLength(2);
  });
});

// ============================================================================
// 3. Validate no update path exists (append-only contract)
// ============================================================================

describe('Integration: ProcessingInstruction has no updated_at field (append-only)', () => {
  it('ProcessingInstruction interface keys do NOT include updated_at', () => {
    // Type-level verification via runtime shape check:
    // Create a conforming ProcessingInstruction object with all known fields
    const instruction: ProcessingInstruction = {
      id: 'pi-1',
      snapshot_id: 'snap-1',
      recipe_id: 'recipe-1',
      instruction_data: {
        recipe_id: 'recipe-1',
        recipe_name: 'Test',
        product_id: 'prod-1',
        product_name: 'Test Product',
        quantity_kg: 100,
        yield_percentage: 70,
        expected_output_kg: 70,
        steps: [],
      },
      status: 'pending',
      generated_at: '2026-02-19T00:00:00Z',
      created_by: null,
    };

    // Verify the keys — updated_at must NOT be present
    const keys = Object.keys(instruction);
    expect(keys).not.toContain('updated_at');

    // Verify required fields ARE present
    expect(keys).toContain('id');
    expect(keys).toContain('snapshot_id');
    expect(keys).toContain('recipe_id');
    expect(keys).toContain('instruction_data');
    expect(keys).toContain('status');
    expect(keys).toContain('generated_at');
    expect(keys).toContain('created_by');
  });

  it('ProcessingInstruction has exactly the expected fields (no extras)', () => {
    const instruction: ProcessingInstruction = {
      id: 'pi-2',
      snapshot_id: 'snap-2',
      recipe_id: 'recipe-2',
      instruction_data: {
        recipe_id: 'recipe-2',
        recipe_name: 'Bout',
        product_id: 'prod-bout',
        product_name: 'Kipbout',
        quantity_kg: 50,
        yield_percentage: null,
        expected_output_kg: null,
        steps: [],
      },
      status: 'completed',
      generated_at: '2026-02-19T12:00:00Z',
      created_by: 'system',
    };

    const expectedKeys = [
      'id',
      'snapshot_id',
      'recipe_id',
      'instruction_data',
      'status',
      'generated_at',
      'created_by',
    ];
    expect(Object.keys(instruction).sort()).toEqual(expectedKeys.sort());
  });
});

// ============================================================================
// 4. Export + validation pipeline
// ============================================================================

describe('Integration: validateForStorteboom -> exportOrderSchemaToExcel pipeline', () => {
  it('valid data passes validation then exports successfully', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'filet', available_kg: 500, ordered_kg: 300, delta_kg: 200 },
        { product_id: 'bout', available_kg: 400, ordered_kg: 350, delta_kg: 50 },
      ],
      orders: [
        {
          customer_id: 'cust-1',
          customer_name: 'Klant A',
          lines: [
            { product_id: 'filet', quantity_kg: 300 },
            { product_id: 'bout', quantity_kg: 350 },
          ],
        },
      ],
    });

    // Step 1: Validate
    const validation = validateForStorteboom(snapshot);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Step 2: Export (only if valid)
    const excelBuffer = exportOrderSchemaToExcel(snapshot, '2026-02-20');
    expect(excelBuffer).toBeInstanceOf(Uint8Array);
    expect(excelBuffer.length).toBeGreaterThan(0);

    // Step 3: Verify export content
    const wb = XLSX.read(excelBuffer, { type: 'array' });
    expect(wb.SheetNames).toContain('Bestelschema');
    expect(wb.SheetNames).toContain('Info');

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Bestelschema']);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Product']).toBe('filet');
    expect(rows[1]['Product']).toBe('bout');
  });

  it('invalid data (empty surplus_deficit) fails validation, export is skipped', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [],
      orders: [
        {
          customer_id: 'cust-1',
          customer_name: 'Klant A',
          lines: [{ product_id: 'filet', quantity_kg: 100 }],
        },
      ],
    });

    // Step 1: Validate
    const validation = validateForStorteboom(snapshot);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Geen producten in bestelschema');

    // Step 2: Export should be skipped when validation fails
    // (Simulating the real application logic: only export if valid)
    let exported = false;
    if (validation.valid) {
      exportOrderSchemaToExcel(snapshot, '2026-02-20');
      exported = true;
    }
    expect(exported).toBe(false);
  });

  it('data with negative weights fails validation, export is skipped', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'filet', available_kg: -10, ordered_kg: 50, delta_kg: -60 },
      ],
    });

    const validation = validateForStorteboom(snapshot);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);

    let exported = false;
    if (validation.valid) {
      exportOrderSchemaToExcel(snapshot, '2026-02-20');
      exported = true;
    }
    expect(exported).toBe(false);
  });

  it('data with warnings still validates and can be exported', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'bout', available_kg: 50, ordered_kg: 200, delta_kg: -150 },
      ],
      orders: [
        {
          customer_id: 'cust-1',
          customer_name: 'Klant A',
          lines: [{ product_id: 'bout', quantity_kg: 200 }],
        },
      ],
    });

    const validation = validateForStorteboom(snapshot);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.warnings[0]).toContain('Groot deficit');

    // Should still be exportable
    const excelBuffer = exportOrderSchemaToExcel(snapshot, '2026-02-20');
    expect(excelBuffer).toBeInstanceOf(Uint8Array);
    expect(excelBuffer.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 5. Full chain: Availability -> Order Schema -> Instructions -> Export
// ============================================================================

describe('Integration: Full chain — Availability -> Schema -> Instructions -> Export -> Validate', () => {
  it('complete pipeline from live weight to validated export', () => {
    // Step 1: computeTheoreticalAvailability
    const liveWeightKg = 10000;
    const availability = computeTheoreticalAvailability(liveWeightKg);
    expect(availability.length).toBe(Object.keys(JA757_YIELDS).length);

    // Verify known availability values
    const breastAvail = availability.find((a) => a.part === 'breast_fillet');
    expect(breastAvail).toBeDefined();
    expect(breastAvail!.expected_kg).toBe(2320); // 10000 * 0.232

    // Step 2: Build OrderSchemaData from availability + mock orders
    const schemaAvailability = toSchemaAvailability(availability);

    const orders = new Map<string, number>([
      ['breast_fillet', 3000],
      ['leg_quarter', 2000],
      ['wing', 500],
    ]);

    const surplusDeficit = computeSurplusDeficit(schemaAvailability, orders);

    const snapshot: OrderSchemaData = {
      slaughter_id: 'sl-full-chain',
      snapshot_date: '2026-02-19',
      availability: schemaAvailability,
      orders: [
        {
          customer_id: 'cust-horeca',
          customer_name: 'Horeca Groothandel',
          lines: [
            { product_id: 'breast_fillet', quantity_kg: 2000 },
            { product_id: 'leg_quarter', quantity_kg: 1500 },
          ],
        },
        {
          customer_id: 'cust-retail',
          customer_name: 'Supermarkt Keten',
          lines: [
            { product_id: 'breast_fillet', quantity_kg: 1000 },
            { product_id: 'leg_quarter', quantity_kg: 500 },
            { product_id: 'wing', quantity_kg: 500 },
          ],
        },
      ],
      surplus_deficit: surplusDeficit,
    };

    // Step 3: generateInstructionData with a recipe
    const breastRecipe = makeRecipe({
      id: 'recipe-breast-chain',
      product_id: 'breast_fillet',
      recipe_name: 'Borstfilet Premium',
      yield_percentage: 72,
      instructions_json: {
        steps: [
          { description: 'Ontbeen borstkapje' },
          { description: 'Verwijder vel en pezen' },
          { description: 'Snij op gewicht', parameters: { target_g: 180 } },
          { description: 'Vacuumverpak' },
        ],
      },
    });

    const instructionData = generateInstructionData(snapshot, breastRecipe, 'Borstfilet 180g');

    // Verify instruction uses ordered_kg from surplus_deficit
    const breastSd = surplusDeficit.find((sd) => sd.product_id === 'breast_fillet');
    expect(breastSd).toBeDefined();
    expect(instructionData.quantity_kg).toBe(breastSd!.ordered_kg);
    expect(instructionData.quantity_kg).toBe(3000);
    expect(instructionData.expected_output_kg).toBe(3000 * 0.72); // 2160
    expect(instructionData.steps).toHaveLength(4);

    // Step 4: exportOrderSchemaToExcel
    const excelBuffer = exportOrderSchemaToExcel(snapshot, '2026-02-20');
    expect(excelBuffer).toBeInstanceOf(Uint8Array);
    expect(excelBuffer.length).toBeGreaterThan(0);

    // Verify exported data
    const wb = XLSX.read(excelBuffer, { type: 'array' });
    const dataRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Bestelschema']);
    expect(dataRows.length).toBe(surplusDeficit.length);

    // Step 5: validateForStorteboom
    const validation = validateForStorteboom(snapshot);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // breast_fillet has deficit -680, which is > -100, so should trigger a warning
    const breastDelta = breastSd!.delta_kg; // 2320 - 3000 = -680
    expect(breastDelta).toBe(-680);
    expect(validation.warnings.some((w) => w.includes('breast_fillet'))).toBe(true);
  });

  it('full chain with zero live weight still produces valid pipeline output', () => {
    // Step 1: Zero availability
    const availability = computeTheoreticalAvailability(0);
    const schemaAvailability = toSchemaAvailability(availability);

    // All expected_kg should be 0
    for (const a of schemaAvailability) {
      expect(a.expected_kg).toBe(0);
    }

    // Step 2: Build schema with some orders
    const orders = new Map<string, number>([['breast_fillet', 100]]);
    const surplusDeficit = computeSurplusDeficit(schemaAvailability, orders);

    const snapshot: OrderSchemaData = {
      slaughter_id: 'sl-zero',
      snapshot_date: '2026-02-19',
      availability: schemaAvailability,
      orders: [
        {
          customer_id: 'cust-1',
          customer_name: 'Klant',
          lines: [{ product_id: 'breast_fillet', quantity_kg: 100 }],
        },
      ],
      surplus_deficit: surplusDeficit,
    };

    // Step 3: Generate instruction
    const recipe = makeRecipe({
      product_id: 'breast_fillet',
      yield_percentage: 70,
      instructions_json: { steps: [{ description: 'Snij' }] },
    });
    const instruction = generateInstructionData(snapshot, recipe, 'Borstfilet');
    expect(instruction.quantity_kg).toBe(100);
    expect(instruction.expected_output_kg).toBe(70);

    // Step 4: Export
    const excelBuffer = exportOrderSchemaToExcel(snapshot, '2026-02-19');
    expect(excelBuffer).toBeInstanceOf(Uint8Array);

    // Step 5: Validate — should be valid (no negative weights, just deficit warnings)
    const validation = validateForStorteboom(snapshot);
    expect(validation.valid).toBe(true);
  });
});

// ============================================================================
// 6. Edge cases
// ============================================================================

describe('Integration: Edge cases', () => {
  it('recipe with no steps produces instruction with empty steps array', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-A', available_kg: 100, ordered_kg: 50, delta_kg: 50 },
      ],
    });

    // Recipe with instructions_json that has no steps key
    const recipe = makeRecipe({
      product_id: 'prod-A',
      instructions_json: { notes: 'Geen stappen nodig' },
    });

    const result = generateInstructionData(snapshot, recipe, 'Product A');
    expect(result.steps).toEqual([]);
    expect(result.quantity_kg).toBe(50);
  });

  it('recipe with null instructions_json produces empty steps array', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-A', available_kg: 100, ordered_kg: 50, delta_kg: 50 },
      ],
    });

    const recipe = makeRecipe({
      product_id: 'prod-A',
      instructions_json: null,
    });

    const result = generateInstructionData(snapshot, recipe, 'Product A');
    expect(result.steps).toEqual([]);
  });

  it('recipe with null yield_percentage produces expected_output_kg = null', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-A', available_kg: 200, ordered_kg: 150, delta_kg: 50 },
      ],
    });

    const recipe = makeRecipe({
      product_id: 'prod-A',
      yield_percentage: null,
    });

    const result = generateInstructionData(snapshot, recipe, 'Product A');
    expect(result.yield_percentage).toBeNull();
    expect(result.expected_output_kg).toBeNull();
    expect(result.quantity_kg).toBe(150); // ordered_kg still found
  });

  it('product not in surplus_deficit produces quantity_kg = 0', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-filet', available_kg: 500, ordered_kg: 300, delta_kg: 200 },
      ],
    });

    // Recipe for a product NOT in the surplus_deficit
    const recipe = makeRecipe({
      product_id: 'prod-ONBEKEND',
      yield_percentage: 80,
    });

    const result = generateInstructionData(snapshot, recipe, 'Onbekend Product');
    expect(result.quantity_kg).toBe(0);
    expect(result.expected_output_kg).toBe(0); // 0 * 0.80 = 0
  });

  it('multiple recipes for same snapshot data each get correct quantities', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-filet', available_kg: 800, ordered_kg: 1200, delta_kg: -400 },
        { product_id: 'prod-bout', available_kg: 600, ordered_kg: 400, delta_kg: 200 },
        { product_id: 'prod-vleugel', available_kg: 300, ordered_kg: 250, delta_kg: 50 },
      ],
    });

    const filetRecipe = makeRecipe({
      id: 'recipe-1',
      product_id: 'prod-filet',
      recipe_name: 'Filet Recept',
      yield_percentage: 70,
      instructions_json: {
        steps: [
          { description: 'Ontbeen' },
          { description: 'Snij' },
        ],
      },
    });

    const boutRecipe = makeRecipe({
      id: 'recipe-2',
      product_id: 'prod-bout',
      recipe_name: 'Bout Recept',
      yield_percentage: 85,
      instructions_json: {
        steps: [
          { description: 'Portioneer' },
        ],
      },
    });

    const vleugelRecipe = makeRecipe({
      id: 'recipe-3',
      product_id: 'prod-vleugel',
      recipe_name: 'Vleugel Recept',
      yield_percentage: null,
      instructions_json: {
        steps: [
          { description: 'Marineer', parameters: { marinade: 'piri-piri' } },
          { description: 'Verpak' },
          { description: 'Label' },
        ],
      },
    });

    const filetResult = generateInstructionData(snapshot, filetRecipe, 'Kipfilet');
    const boutResult = generateInstructionData(snapshot, boutRecipe, 'Kipbout');
    const vleugelResult = generateInstructionData(snapshot, vleugelRecipe, 'Kipvleugel');

    // Each recipe gets the correct quantity from its own product
    expect(filetResult.quantity_kg).toBe(1200);
    expect(filetResult.expected_output_kg).toBe(1200 * 0.70);
    expect(filetResult.steps).toHaveLength(2);
    expect(filetResult.recipe_id).toBe('recipe-1');

    expect(boutResult.quantity_kg).toBe(400);
    expect(boutResult.expected_output_kg).toBe(400 * 0.85);
    expect(boutResult.steps).toHaveLength(1);
    expect(boutResult.recipe_id).toBe('recipe-2');

    expect(vleugelResult.quantity_kg).toBe(250);
    expect(vleugelResult.expected_output_kg).toBeNull(); // null yield
    expect(vleugelResult.steps).toHaveLength(3);
    expect(vleugelResult.steps[0].parameters).toEqual({ marinade: 'piri-piri' });
    expect(vleugelResult.recipe_id).toBe('recipe-3');
  });

  it('recipe with empty steps array in instructions_json produces empty steps', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-A', available_kg: 100, ordered_kg: 75, delta_kg: 25 },
      ],
    });

    const recipe = makeRecipe({
      product_id: 'prod-A',
      instructions_json: { steps: [] },
    });

    const result = generateInstructionData(snapshot, recipe, 'Product A');
    expect(result.steps).toEqual([]);
  });

  it('surplus_deficit with zero ordered_kg produces quantity_kg = 0 in instruction', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-A', available_kg: 500, ordered_kg: 0, delta_kg: 500 },
      ],
    });

    const recipe = makeRecipe({
      product_id: 'prod-A',
      yield_percentage: 80,
    });

    const result = generateInstructionData(snapshot, recipe, 'Product A');
    expect(result.quantity_kg).toBe(0);
    expect(result.expected_output_kg).toBe(0); // 0 * 0.80 = 0
  });

  it('very large quantities are handled without precision errors', () => {
    const snapshot = makeSnapshot({
      surplus_deficit: [
        { product_id: 'prod-A', available_kg: 50000, ordered_kg: 100000, delta_kg: -50000 },
      ],
    });

    const recipe = makeRecipe({
      product_id: 'prod-A',
      yield_percentage: 100,
    });

    const result = generateInstructionData(snapshot, recipe, 'Bulk Product');
    expect(result.quantity_kg).toBe(100000);
    expect(result.expected_output_kg).toBe(100000); // 100% yield
  });

  it('full pipeline: availability feeds surplusDeficit which feeds instruction + export + validation', () => {
    // This test verifies data flows correctly through every pure function in sequence

    // 1. Availability
    const avail = computeTheoreticalAvailability(5000);
    const schemaAvail = toSchemaAvailability(avail);

    // 2. Surplus/Deficit
    const orders = new Map<string, number>([
      ['breast_fillet', 1500],
      ['griller', 2000],
    ]);
    const sd = computeSurplusDeficit(schemaAvail, orders);

    // 3. Build snapshot
    const snapshot: OrderSchemaData = {
      slaughter_id: 'sl-pipeline',
      snapshot_date: '2026-02-19',
      availability: schemaAvail,
      orders: [
        {
          customer_id: 'c1',
          customer_name: 'Test Customer',
          lines: [
            { product_id: 'breast_fillet', quantity_kg: 1500 },
            { product_id: 'griller', quantity_kg: 2000 },
          ],
        },
      ],
      surplus_deficit: sd,
    };

    // 4. Generate instruction
    const recipe = makeRecipe({
      product_id: 'breast_fillet',
      yield_percentage: 72,
      instructions_json: { steps: [{ description: 'Process' }] },
    });
    const instr = generateInstructionData(snapshot, recipe, 'Borstfilet');

    const breastSd = sd.find((s) => s.product_id === 'breast_fillet');
    expect(instr.quantity_kg).toBe(breastSd!.ordered_kg);
    expect(instr.quantity_kg).toBe(1500);

    // 5. Export
    const buf = exportOrderSchemaToExcel(snapshot, '2026-02-19');
    expect(buf.length).toBeGreaterThan(0);

    // 6. Validate
    const val = validateForStorteboom(snapshot);
    expect(val.valid).toBe(true);
  });
});
