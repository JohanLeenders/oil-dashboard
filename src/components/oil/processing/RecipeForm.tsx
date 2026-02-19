'use client';

/**
 * RecipeForm — Form to create or edit a processing recipe
 *
 * REGRESSIE-CHECK:
 * - Creates/updates processing_recipes via server actions
 * - Validates recipe_name required, product_id required
 * - yield_percentage 0-100 range
 * - instructions_json parsed as JSON
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRecipe, updateRecipe } from '@/lib/actions/processing';
import type { ProcessingRecipe } from '@/types/database';

interface RecipeFormProps {
  mode: 'create' | 'edit';
  recipe?: ProcessingRecipe | null;
  products: { id: string; name: string }[];
}

export default function RecipeForm({ mode, recipe, products }: RecipeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [recipeName, setRecipeName] = useState(recipe?.recipe_name ?? '');
  const [productId, setProductId] = useState(recipe?.product_id ?? '');
  const [yieldPercentage, setYieldPercentage] = useState(
    recipe?.yield_percentage != null ? String(recipe.yield_percentage) : '',
  );
  const [instructionsJson, setInstructionsJson] = useState(
    recipe?.instructions_json
      ? JSON.stringify(recipe.instructions_json, null, 2)
      : '',
  );
  const [isActive, setIsActive] = useState(recipe?.is_active ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!recipeName.trim()) {
      setError('Receptnaam is verplicht');
      return;
    }
    if (!productId) {
      setError('Selecteer een product');
      return;
    }

    // Parse yield percentage
    let parsedYield: number | null = null;
    if (yieldPercentage.trim()) {
      const num = parseFloat(yieldPercentage);
      if (isNaN(num) || num < 0 || num > 100) {
        setError('Opbrengst % moet tussen 0 en 100 liggen');
        return;
      }
      parsedYield = num;
    }

    // Parse instructions JSON
    let parsedInstructions: Record<string, unknown> | null = null;
    if (instructionsJson.trim()) {
      try {
        parsedInstructions = JSON.parse(instructionsJson);
      } catch {
        setError('Instructies JSON is ongeldig');
        return;
      }
    }

    const input = {
      recipe_name: recipeName.trim(),
      product_id: productId,
      yield_percentage: parsedYield,
      instructions_json: parsedInstructions,
      is_active: isActive,
    };

    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createRecipe(input);
        } else if (recipe) {
          await updateRecipe(recipe.id, {
            recipe_name: input.recipe_name,
            yield_percentage: input.yield_percentage,
            instructions_json: input.instructions_json,
            is_active: input.is_active,
          });
        }
        router.push('/oil/processing');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Er ging iets mis bij het opslaan',
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-5 max-w-2xl"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {mode === 'create' ? 'Nieuw recept' : 'Recept bewerken'}
      </h3>

      {/* Recipe name */}
      <div>
        <label
          htmlFor="recipe_name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Receptnaam
        </label>
        <input
          id="recipe_name"
          type="text"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          placeholder="Bijv. Filet snijden standaard"
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={isPending}
        />
      </div>

      {/* Product select */}
      <div>
        <label
          htmlFor="product_id"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Product
        </label>
        <select
          id="product_id"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={isPending || mode === 'edit'}
        >
          <option value="">-- Selecteer product --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {mode === 'edit' && (
          <p className="mt-1 text-xs text-gray-400">
            Product kan niet meer gewijzigd worden na aanmaken.
          </p>
        )}
      </div>

      {/* Yield percentage */}
      <div>
        <label
          htmlFor="yield_percentage"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Opbrengst % (0–100)
        </label>
        <input
          id="yield_percentage"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={yieldPercentage}
          onChange={(e) => setYieldPercentage(e.target.value)}
          placeholder="Bijv. 72.5"
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={isPending}
        />
      </div>

      {/* Instructions JSON */}
      <div>
        <label
          htmlFor="instructions_json"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Instructies (JSON)
        </label>
        <textarea
          id="instructions_json"
          rows={8}
          value={instructionsJson}
          onChange={(e) => setInstructionsJson(e.target.value)}
          placeholder={'{\n  "steps": [\n    { "description": "Stap 1" }\n  ]\n}'}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={isPending}
        />
      </div>

      {/* Active checkbox */}
      <div className="flex items-center gap-2">
        <input
          id="is_active"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          disabled={isPending}
        />
        <label
          htmlFor="is_active"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Actief
        </label>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
        >
          {isPending ? 'Bezig...' : 'Opslaan'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/oil/processing')}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
