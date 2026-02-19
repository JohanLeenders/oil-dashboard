/**
 * Processing Loading — Skeleton for processing page
 *
 * REGRESSIE-CHECK:
 * - Read-only loading skeleton
 * - No data fetching
 */

export default function ProcessingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  );
}
