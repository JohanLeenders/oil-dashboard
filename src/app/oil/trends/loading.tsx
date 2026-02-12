/**
 * Trends Page Loading State
 * Shows chart + table skeleton
 */

export default function TrendsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-56 bg-gray-100 rounded mt-2" />
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-[300px] flex items-end gap-2 justify-center">
          {[40, 55, 70, 60, 80, 65, 75, 50, 85, 70, 60, 90].map((h, i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-t flex-1"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
