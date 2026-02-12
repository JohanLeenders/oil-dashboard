/**
 * Batches Page Loading State
 * Shows table skeleton matching batch list layout
 */

export default function BatchesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-80 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded" />
      </div>

      {/* THT Legend skeleton */}
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 grid grid-cols-8 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-3 bg-gray-200 rounded" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="px-6 py-4 grid grid-cols-8 gap-4 border-t border-gray-100">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((col) => (
              <div key={col} className="h-4 bg-gray-100 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
