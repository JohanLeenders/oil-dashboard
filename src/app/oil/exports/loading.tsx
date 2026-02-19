/**
 * Loading state for Exports page
 * Wave 4 — A4-S1
 *
 * REGRESSIE-CHECK:
 * - Pure UI skeleton, no DB access
 */

export default function ExportsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="mt-2 h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
