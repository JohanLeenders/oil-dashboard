/**
 * Cost Waterfall Loading State
 * Shows chart area skeleton
 */

export default function CostWaterfallLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-[400px] flex items-end gap-3 justify-center">
          {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-t w-16"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
