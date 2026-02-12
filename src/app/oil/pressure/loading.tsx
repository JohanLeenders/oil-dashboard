/**
 * Pressure (Voorraaddruk) Page Loading State
 */

export default function PressureLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-3 w-24 bg-gray-100 rounded mb-2" />
            <div className="h-8 w-20 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="px-6 py-4 grid grid-cols-5 gap-4 border-t border-gray-100">
            {[1, 2, 3, 4, 5].map((col) => (
              <div key={col} className="h-4 bg-gray-100 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
