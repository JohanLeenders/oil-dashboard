/**
 * Batch Detail Loading State
 * Shows detail card skeleton
 */

export default function BatchDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-48 bg-gray-100 rounded" />

      {/* Header */}
      <div>
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-100 rounded mt-2" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
            <div className="h-6 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Yield table skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex gap-6 py-3 border-t border-gray-100">
            {[1, 2, 3, 4].map((col) => (
              <div key={col} className="h-4 w-20 bg-gray-100 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
