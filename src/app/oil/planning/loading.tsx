/**
 * Planning Loading State
 * Sprint: Wave 2 — A1-S1 Planning UI
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only skeleton display
 * - ✅ Geen mutations of forms
 * - ✅ Consistent met layout styling
 */

export default function PlanningLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded mt-2" />
        </div>
        <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header row */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>

        {/* Data rows */}
        {[1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="px-6 py-4 flex gap-6 border-t border-gray-100 dark:border-gray-700"
          >
            {[1, 2, 3, 4, 5, 6].map((col) => (
              <div
                key={col}
                className="h-4 bg-gray-100 dark:bg-gray-700 rounded"
                style={{ width: `${60 + col * 10}px` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
