/**
 * OIL Processing Page — Recipes overview with product and yield info
 * Sprint: Wave 4 — A3-S1 Processing CRUD
 *
 * REGRESSIE-CHECK:
 * - Reads processing_recipes + products JOIN
 * - Server Component (no 'use client')
 * - Links to /oil/processing/[recipeId] and /oil/processing/new
 */

import Link from 'next/link';
import { getRecipes } from '@/lib/actions/processing';
import RecipeList from '@/components/oil/processing/RecipeList';

export default async function ProcessingPage() {
  const recipes = await getRecipes();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Verwerking
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Verwerkingsrecepten en instructies
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {recipes.length} recept{recipes.length !== 1 ? 'en' : ''}
          </span>
          <Link
            href="/oil/processing/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Nieuw recept
          </Link>
        </div>
      </div>

      <RecipeList recipes={recipes} />
    </div>
  );
}
