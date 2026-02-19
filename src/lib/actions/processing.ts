'use server';

/**
 * Server Actions voor Processing Recipes & Instructions
 * Sprint: Wave 4 — A3-S1 Processing CRUD
 *
 * REGRESSIE-CHECK:
 * - getRecipes: read-only (processing_recipes + products JOIN)
 * - getRecipeDetail: read-only
 * - createRecipe: INSERT into processing_recipes
 * - updateRecipe: UPDATE processing_recipes (allowed — has updated_at)
 * - getProductsForRecipeSelect: read-only helper
 * - generateAndSaveInstructions: INSERT into processing_instructions (APPEND-ONLY)
 */

import { createClient } from '@/lib/supabase/server';
import { generateInstructionData } from '@/lib/engine/processing/generateInstructions';
import type {
  ProcessingRecipe,
  ProcessingInstruction,
  OrderSchemaData,
} from '@/types/database';
import {
  createRecipeSchema,
  updateRecipeParamsSchema,
  updateRecipeBodySchema,
  generateAndSaveInstructionsSchema,
  getRecipeDetailSchema,
} from '@/lib/schemas/processing';

// ============================================================================
// READ ACTIONS
// ============================================================================

/**
 * Haal alle actieve recepten op met productnaam
 */
export async function getRecipes(): Promise<
  (ProcessingRecipe & { product_name: string })[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('processing_recipes')
    .select('*, products(description)')
    .order('recipe_name', { ascending: true });

  if (error) {
    console.error('Error fetching processing recipes:', error);
    throw new Error(`Failed to fetch recipes: ${error.message}`);
  }

  return (data || []).map((row) => {
    const typed = row as Record<string, unknown> & {
      products?: { description: string } | null;
    };
    const productName = typed.products?.description ?? 'Onbekend product';
    return {
      id: row.id,
      product_id: row.product_id,
      recipe_name: row.recipe_name,
      yield_percentage: row.yield_percentage,
      instructions_json: row.instructions_json,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      product_name: productName,
    } as ProcessingRecipe & { product_name: string };
  });
}

/**
 * Haal een enkel recept op (detail)
 */
export async function getRecipeDetail(
  recipeId: string,
): Promise<(ProcessingRecipe & { product_name: string }) | null> {
  const parsed = getRecipeDetailSchema.parse({ recipeId });
  const supabase = await createClient();
  recipeId = parsed.recipeId;

  const { data, error } = await supabase
    .from('processing_recipes')
    .select('*, products(description)')
    .eq('id', recipeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching recipe detail:', error);
    throw new Error(`Failed to fetch recipe: ${error.message}`);
  }

  const typed = data as Record<string, unknown> & {
    products?: { description: string } | null;
  };
  const productName = typed.products?.description ?? 'Onbekend product';

  return {
    id: data.id,
    product_id: data.product_id,
    recipe_name: data.recipe_name,
    yield_percentage: data.yield_percentage,
    instructions_json: data.instructions_json,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    product_name: productName,
  } as ProcessingRecipe & { product_name: string };
}

// ============================================================================
// WRITE ACTIONS
// ============================================================================

/**
 * Maak een nieuw recept aan
 */
export async function createRecipe(input: {
  recipe_name: string;
  product_id: string;
  yield_percentage: number | null;
  instructions_json: Record<string, unknown> | null;
  is_active: boolean;
}): Promise<ProcessingRecipe> {
  input = createRecipeSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('processing_recipes')
    .insert({
      recipe_name: input.recipe_name,
      product_id: input.product_id,
      yield_percentage: input.yield_percentage,
      instructions_json: input.instructions_json,
      is_active: input.is_active,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating recipe:', error);
    throw new Error(`Failed to create recipe: ${error.message}`);
  }

  return data;
}

/**
 * Werk een bestaand recept bij
 */
export async function updateRecipe(
  recipeId: string,
  input: {
    recipe_name: string;
    yield_percentage: number | null;
    instructions_json: Record<string, unknown> | null;
    is_active: boolean;
  },
): Promise<ProcessingRecipe> {
  const parsedParams = updateRecipeParamsSchema.parse({ recipeId });
  input = updateRecipeBodySchema.parse(input);
  recipeId = parsedParams.recipeId;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('processing_recipes')
    .update({
      recipe_name: input.recipe_name,
      yield_percentage: input.yield_percentage,
      instructions_json: input.instructions_json,
      is_active: input.is_active,
    })
    .eq('id', recipeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating recipe:', error);
    throw new Error(`Failed to update recipe: ${error.message}`);
  }

  return data;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Haal producten op voor recept-selectie dropdown
 */
export async function getProductsForRecipeSelect(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name:description')
    .eq('is_active', true)
    .order('description', { ascending: true });

  if (error) {
    console.error('Error fetching products for recipe select:', error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// INSTRUCTION GENERATION (APPEND-ONLY)
// ============================================================================

/**
 * Genereer en sla verwerkingsinstructies op vanuit een gefinaliseerde snapshot + recept
 * CRITICAL: Alleen INSERT in processing_instructions. NOOIT UPDATE bestaande rijen.
 */
export async function generateAndSaveInstructions(
  snapshotId: string,
  recipeId: string,
): Promise<ProcessingInstruction> {
  const parsed = generateAndSaveInstructionsSchema.parse({ snapshotId, recipeId });
  const supabase = await createClient();
  snapshotId = parsed.snapshotId;
  recipeId = parsed.recipeId;

  // 1. Fetch snapshot — must be finalized
  const { data: snapshot, error: snapshotError } = await supabase
    .from('order_schema_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (snapshotError) {
    throw new Error(`Failed to fetch snapshot: ${snapshotError.message}`);
  }
  if (snapshot.snapshot_type !== 'finalized') {
    throw new Error('Snapshot moet gefinaliseerd zijn om instructies te genereren');
  }

  // 2. Fetch recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('processing_recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  if (recipeError) {
    throw new Error(`Failed to fetch recipe: ${recipeError.message}`);
  }

  // 3. Fetch product name
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('description')
    .eq('id', recipe.product_id)
    .single();

  if (productError) {
    throw new Error(`Failed to fetch product: ${productError.message}`);
  }

  // 4. Call generateInstructionData (pure function)
  const instructionData = generateInstructionData(
    snapshot.schema_data as OrderSchemaData,
    recipe as ProcessingRecipe,
    product.description,
  );

  // 5. INSERT into processing_instructions (APPEND-ONLY — never UPDATE)
  const { data: instruction, error: insertError } = await supabase
    .from('processing_instructions')
    .insert({
      snapshot_id: snapshotId,
      recipe_id: recipeId,
      instruction_data: instructionData,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to save instruction: ${insertError.message}`);
  }

  // 6. Return the new row
  return instruction as ProcessingInstruction;
}
