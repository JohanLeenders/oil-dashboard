/**
 * OIL Planning Page — Placeholder (A5-S1)
 *
 * Future: Slaughter calendar view, availability calculations,
 * and order deadline management.
 *
 * REGRESSIE-CHECK:
 * - ✅ Geen mutations of forms
 * - ✅ Read-only placeholder
 * - ✅ Server Component (no 'use client')
 */

export default function PlanningPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Planning
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Slachtkalender en beschikbaarheidsplanning
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-12">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Planning — Binnenkort beschikbaar
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hier komt de slachtkalender met verwachte aantallen, beschikbaarheids&shy;berekeningen
            en orderdeadlines.
          </p>
        </div>
      </div>
    </div>
  );
}
