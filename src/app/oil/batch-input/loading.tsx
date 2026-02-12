/**
 * Batch Input Page Loading State
 */

export default function BatchInputLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-36 bg-gray-200 rounded" />
        <div className="h-4 w-56 bg-gray-100 rounded mt-2" />
      </div>

      {/* Form skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-3 w-24 bg-gray-100 rounded mb-2" />
            <div className="h-10 w-full bg-gray-100 rounded" />
          </div>
        ))}
        <div className="h-10 w-32 bg-gray-200 rounded mt-4" />
      </div>
    </div>
  );
}
