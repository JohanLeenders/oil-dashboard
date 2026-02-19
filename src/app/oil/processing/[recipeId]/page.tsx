/**
 * OIL Processing Recipe Detail — Edit or create a recipe
 * Sprint: Wave 4 — A3-S1 Processing CRUD
 *
 * REGRESSIE-CHECK:
 * - Server Component shell with client RecipeForm
 * - Reads processing_recipes (single) + products
 * - Writes via RecipeForm (createRecipe / updateRecipe)
 * - Supports 'new' as recipeId for create mode
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecipeDetail, getProductsForRecipeSelect } from '@/lib/actions/processing';
import RecipeForm from '@/components/oil/processing/RecipeForm';

interface PageProps {
  params: Promise<{ recipeId: string }>;
}

export default async function RecipeDetailPage({ params }: PageProps) {
  const { recipeId } = await params;
  const isNew = recipeId === 'new';

  const products = await getProductsForRecipeSelect();

  if (isNew) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/oil/processing"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            &larr; Terug naar verwerking
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            Nieuw recept
          </h1>
        </div>

        <RecipeForm mode="create" products={products} />
      </div>
    );
  }

  const recipe = await getRecipeDetail(recipeId);

  if (!recipe) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/oil/processing"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          &larr; Terug naar verwerking
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {recipe.recipe_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Product: {recipe.product_name}
        </p>
      </div>

      <RecipeForm mode="edit" recipe={recipe} products={products} />
    </div>
  );
}
