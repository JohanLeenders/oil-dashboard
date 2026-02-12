/**
 * Customer Detail Loading State
 */

export default function CustomerDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-48 bg-gray-100 rounded" />
      <div className="h-8 w-56 bg-gray-200 rounded" />

      {/* Intake profile skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-8 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
