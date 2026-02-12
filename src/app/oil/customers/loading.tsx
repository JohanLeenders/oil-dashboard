/**
 * Customers Page Loading State
 * Shows customer list skeleton
 */

export default function CustomersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
        </div>
      </div>

      {/* Customer cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-5 w-36 bg-gray-200 rounded mb-3" />
            <div className="h-3 w-24 bg-gray-100 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-gray-100 rounded" />
              <div className="h-3 w-3/4 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
