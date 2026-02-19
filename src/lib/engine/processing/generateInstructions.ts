/**
 * Generate processing instructions from a finalized snapshot + recipe
 * Pure function — no DB access
 *
 * REGRESSIE-CHECK:
 * - Pure function, no DB
 * - Returns ProcessingInstructionData
 * - Reads surplus_deficit from snapshot to find ordered_kg
 * - Extracts steps from recipe instructions_json
 */

import type {
  OrderSchemaData,
  ProcessingRecipe,
  ProcessingInstructionData,
} from '@/types/database';

export function generateInstructionData(
  snapshotData: OrderSchemaData,
  recipe: ProcessingRecipe,
  productName: string,
): ProcessingInstructionData {
  // Find total ordered kg for this recipe's product from surplus_deficit
  const surplusEntry = snapshotData.surplus_deficit.find(
    (sd) => sd.product_id === recipe.product_id,
  );
  const quantity_kg = surplusEntry?.ordered_kg ?? 0;
  const yield_pct = recipe.yield_percentage;
  const expected_output_kg =
    yield_pct != null ? quantity_kg * (yield_pct / 100) : null;

  // Build steps from recipe instructions_json
  const rawSteps =
    (
      recipe.instructions_json as {
        steps?: Array<{
          description: string;
          parameters?: Record<string, unknown>;
        }>;
      }
    )?.steps ?? [];

  const steps = rawSteps.map((s, i) => ({
    step_number: i + 1,
    description: s.description,
    ...(s.parameters ? { parameters: s.parameters } : {}),
  }));

  return {
    recipe_id: recipe.id,
    recipe_name: recipe.recipe_name,
    product_id: recipe.product_id,
    product_name: productName,
    quantity_kg,
    yield_percentage: yield_pct,
    expected_output_kg,
    steps,
  };
}
