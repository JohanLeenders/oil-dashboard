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
          <h1 className="text-2xl font-brand tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            Verwerking
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Verwerkingsrecepten en instructies
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {recipes.length} recept{recipes.length !== 1 ? 'en' : ''}
          </span>
          <Link
            href="/oil/processing/new"
            className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors"
            style={{ background: 'var(--color-oil-orange)' }}
          >
            Nieuw recept
          </Link>
        </div>
      </div>

      {/* Wave 10 D6: Explanation card */}
      <div
        className="oil-card p-4"
        style={{ borderLeft: '3px solid var(--color-oil-orange)' }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-main)' }}>
          Verwerkingsrecepten
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Hier zie je hoe producten worden verwerkt van primaire snijdelen (Putten) naar secundaire producten (Nijkerk).
          Elk recept definieert het rendement: hoeveel kg uitgangsproduct wordt hoeveel kg eindproduct.
          De cascade-berekening gebruikt deze recepten om automatisch de beschikbaarheid in Nijkerk te berekenen.
        </p>
      </div>

      <RecipeList recipes={recipes} />
    </div>
  );
}
