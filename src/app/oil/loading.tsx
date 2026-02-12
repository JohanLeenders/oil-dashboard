/**
 * OIL Dashboard Loading State
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only skeleton display
 * - ✅ Geen mutations of forms
 * - ✅ Consistent met layout styling
 */

export default function OilLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-6 w-24 bg-gray-100 rounded" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="bg-gray-50 px-6 py-3 flex gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 w-20 bg-gray-200 rounded" />
          ))}
        </div>

        {/* Data rows */}
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="px-6 py-4 flex gap-6 border-t border-gray-100"
          >
            {[1, 2, 3, 4, 5].map((col) => (
              <div
                key={col}
                className="h-4 bg-gray-100 rounded"
                style={{ width: `${60 + Math.random() * 40}px` }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Info box skeleton */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="h-4 w-32 bg-blue-100 rounded" />
        <div className="h-3 w-64 bg-blue-100 rounded mt-2" />
      </div>
    </div>
  );
}
