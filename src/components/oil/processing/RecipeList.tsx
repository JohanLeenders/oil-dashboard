/**
 * RecipeList — Table of processing recipes with status badges
 *
 * REGRESSIE-CHECK:
 * - Read-only display component
 * - No mutations, only presentation
 */

import Link from 'next/link';
import type { ProcessingRecipe } from '@/types/database';

interface RecipeWithProduct extends ProcessingRecipe {
  product_name: string;
}

interface RecipeListProps {
  recipes: RecipeWithProduct[];
}

function activeBadge(isActive: boolean) {
  if (isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        Actief
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
      Inactief
    </span>
  );
}

export default function RecipeList({ recipes }: RecipeListProps) {
  if (recipes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-12">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Geen recepten gevonden
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Er zijn nog geen verwerkingsrecepten aangemaakt.
          </p>
          <div className="mt-4">
            <Link
              href="/oil/processing/new"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Nieuw recept aanmaken
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Recept
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Product
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Opbrengst %
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actie
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {recipes.map((recipe) => (
            <tr
              key={recipe.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/oil/processing/${recipe.id}`}
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                >
                  {recipe.recipe_name}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {recipe.product_name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                {recipe.yield_percentage != null
                  ? `${recipe.yield_percentage.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%`
                  : '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {activeBadge(recipe.is_active)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <Link
                  href={`/oil/processing/${recipe.id}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                >
                  Bewerken
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
