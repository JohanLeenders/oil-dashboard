/**
 * Tests for generateInstructionData pure function
 *
 * REGRESSIE-CHECK:
 * - Pure function tests, no DB
 * - 10 tests covering all edge cases
 */

import { describe, it, expect } from 'vitest';
import { generateInstructionData } from '../generateInstructions';
import type {
  OrderSchemaData,
  ProcessingRecipe,
} from '@/types/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(
  surplusDeficit: OrderSchemaData['surplus_deficit'] = [],
): OrderSchemaData {
  return {
    slaughter_id: 'sl-1',
    snapshot_date: '2026-02-19',
    availability: [],
    orders: [],
    surplus_deficit: surplusDeficit,
  };
}

function makeRecipe(overrides: Partial<ProcessingRecipe> = {}): ProcessingRecipe {
  return {
    id: 'recipe-1',
    product_id: 'prod-A',
    recipe_name: 'Filet snijden',
    yield_percentage: 72.5,
    instructions_json: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateInstructionData', () => {
  it('returns quantity_kg = 0 when surplus_deficit is empty', () => {
    const snapshot = makeSnapshot([]);
    const recipe = makeRecipe();
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.quantity_kg).toBe(0);
    expect(result.expected_output_kg).toBe(0);
  });

  it('finds correct product in surplus_deficit and returns ordered_kg', () => {
    const snapshot = makeSnapshot([
      { product_id: 'prod-A', available_kg: 100, ordered_kg: 250, delta_kg: -150 },
    ]);
    const recipe = makeRecipe({ product_id: 'prod-A' });
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.quantity_kg).toBe(250);
  });

  it('calculates expected_output_kg when yield_percentage is set', () => {
    const snapshot = makeSnapshot([
      { product_id: 'prod-A', available_kg: 200, ordered_kg: 400, delta_kg: -200 },
    ]);
    const recipe = makeRecipe({ yield_percentage: 72.5 });
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.expected_output_kg).toBe(400 * 0.725);
  });

  it('returns expected_output_kg as null when yield_percentage is null', () => {
    const snapshot = makeSnapshot([
      { product_id: 'prod-A', available_kg: 100, ordered_kg: 200, delta_kg: -100 },
    ]);
    const recipe = makeRecipe({ yield_percentage: null });
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.expected_output_kg).toBeNull();
    expect(result.yield_percentage).toBeNull();
  });

  it('extracts steps from recipe instructions_json', () => {
    const recipe = makeRecipe({
      instructions_json: {
        steps: [
          { description: 'Snij de filet' },
          { description: 'Vacuumeer', parameters: { temp: -2 } },
          { description: 'Verpak' },
        ],
      },
    });
    const snapshot = makeSnapshot([
      { product_id: 'prod-A', available_kg: 100, ordered_kg: 100, delta_kg: 0 },
    ]);
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]).toEqual({ step_number: 1, description: 'Snij de filet' });
    expect(result.steps[1]).toEqual({
      step_number: 2,
      description: 'Vacuumeer',
      parameters: { temp: -2 },
    });
    expect(result.steps[2]).toEqual({ step_number: 3, description: 'Verpak' });
  });

  it('returns empty steps array when instructions_json has no steps', () => {
    const recipe = makeRecipe({ instructions_json: { notes: 'geen stappen' } });
    const snapshot = makeSnapshot([]);
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.steps).toEqual([]);
  });

  it('returns empty steps array when instructions_json is null', () => {
    const recipe = makeRecipe({ instructions_json: null });
    const snapshot = makeSnapshot([]);
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.steps).toEqual([]);
  });

  it('matches correct product among multiple surplus_deficit entries', () => {
    const snapshot = makeSnapshot([
      { product_id: 'prod-X', available_kg: 50, ordered_kg: 30, delta_kg: 20 },
      { product_id: 'prod-A', available_kg: 200, ordered_kg: 500, delta_kg: -300 },
      { product_id: 'prod-Y', available_kg: 100, ordered_kg: 80, delta_kg: 20 },
    ]);
    const recipe = makeRecipe({ product_id: 'prod-A' });
    const result = generateInstructionData(snapshot, recipe, 'Kipfilet');

    expect(result.quantity_kg).toBe(500);
  });

  it('returns all recipe metadata fields correctly', () => {
    const snapshot = makeSnapshot([
      { product_id: 'prod-A', available_kg: 100, ordered_kg: 200, delta_kg: -100 },
    ]);
    const recipe = makeRecipe({
      id: 'recipe-99',
      recipe_name: 'Test Recept',
      product_id: 'prod-A',
      yield_percentage: 50,
    });
    const result = generateInstructionData(snapshot, recipe, 'Productnaam');

    expect(result.recipe_id).toBe('recipe-99');
    expect(result.recipe_name).toBe('Test Recept');
    expect(result.product_id).toBe('prod-A');
    expect(result.product_name).toBe('Productnaam');
    expect(result.quantity_kg).toBe(200);
    expect(result.yield_percentage).toBe(50);
    expect(result.expected_output_kg).toBe(100);
  });

  it('handles full realistic flow with snapshot, recipe, and steps', () => {
    const snapshot = makeSnapshot([
      { product_id: 'prod-filet', available_kg: 800, ordered_kg: 1200, delta_kg: -400 },
      { product_id: 'prod-dij', available_kg: 300, ordered_kg: 250, delta_kg: 50 },
    ]);
    const recipe = makeRecipe({
      id: 'recipe-filet-std',
      recipe_name: 'Filet Standaard',
      product_id: 'prod-filet',
      yield_percentage: 68,
      instructions_json: {
        steps: [
          { description: 'Ontbeen de borst' },
          { description: 'Snij filet op maat', parameters: { max_gewicht_g: 200 } },
          { description: 'Vacuumverpakking' },
          { description: 'Weeg en label' },
        ],
      },
    });

    const result = generateInstructionData(snapshot, recipe, 'Kipfilet 200g');

    expect(result.recipe_id).toBe('recipe-filet-std');
    expect(result.recipe_name).toBe('Filet Standaard');
    expect(result.product_id).toBe('prod-filet');
    expect(result.product_name).toBe('Kipfilet 200g');
    expect(result.quantity_kg).toBe(1200);
    expect(result.yield_percentage).toBe(68);
    expect(result.expected_output_kg).toBe(1200 * 0.68);
    expect(result.steps).toHaveLength(4);
    expect(result.steps[0]).toEqual({ step_number: 1, description: 'Ontbeen de borst' });
    expect(result.steps[1]).toEqual({
      step_number: 2,
      description: 'Snij filet op maat',
      parameters: { max_gewicht_g: 200 },
    });
    expect(result.steps[3]).toEqual({ step_number: 4, description: 'Weeg en label' });
  });
});
