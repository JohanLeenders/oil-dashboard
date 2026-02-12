/**
 * Alignment (Carcass Alignment) Page Loading State
 */

export default function AlignmentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-36 bg-gray-200 rounded" />
        <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
      </div>

      {/* Sankey/chart skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-[350px] flex items-center justify-center">
          <div className="h-48 w-full bg-gray-50 rounded flex items-center justify-center">
            <div className="h-4 w-40 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
