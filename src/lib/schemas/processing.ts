/**
 * Zod Validation Schemas — Processing Module
 * Sprint: Wave 4 — A6-S3 (Input Validation Audit)
 *
 * Validates all WRITE action inputs in src/lib/actions/processing.ts
 */

import { z } from 'zod';

// ============================================================================
// Shared primitives
// ============================================================================

/** UUID v4 format */
const uuidSchema = z.string().uuid();

// ============================================================================
// createRecipe
// ============================================================================

export const createRecipeSchema = z.object({
  recipe_name: z.string().min(1).max(200),
  product_id: uuidSchema,
  yield_percentage: z.number().min(0).max(100).nullable(),
  instructions_json: z.record(z.string(), z.unknown()).nullable(),
  is_active: z.boolean(),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

// ============================================================================
// updateRecipe
// ============================================================================

export const updateRecipeParamsSchema = z.object({
  recipeId: uuidSchema,
});

export const updateRecipeBodySchema = z.object({
  recipe_name: z.string().min(1).max(200),
  yield_percentage: z.number().min(0).max(100).nullable(),
  instructions_json: z.record(z.string(), z.unknown()).nullable(),
  is_active: z.boolean(),
});

export type UpdateRecipeParams = z.infer<typeof updateRecipeParamsSchema>;
export type UpdateRecipeBody = z.infer<typeof updateRecipeBodySchema>;

// ============================================================================
// generateAndSaveInstructions
// ============================================================================

export const generateAndSaveInstructionsSchema = z.object({
  snapshotId: uuidSchema,
  recipeId: uuidSchema,
});

export type GenerateAndSaveInstructionsInput = z.infer<typeof generateAndSaveInstructionsSchema>;

// ============================================================================
// READ action param schemas (UUID-only, for consistency)
// ============================================================================

export const getRecipeDetailSchema = z.object({
  recipeId: uuidSchema,
});
