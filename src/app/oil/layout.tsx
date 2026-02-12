/**
 * OIL Dashboard Layout
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only navigatie
 * - ✅ Geen mutations of forms
 */

import Link from 'next/link';

export default function OilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐔</span>
              <h1 className="text-xl font-bold text-gray-900">
                OIL
              </h1>
              <span className="text-sm text-gray-500">
                Oranjehoen Intelligence Layer
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex gap-6">
              <Link
                href="/oil"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/oil/batches"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Batches
              </Link>
              <Link
                href="/oil/batch-input"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Batch Input
              </Link>
              <Link
                href="/oil/customers"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Klanten
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-gray-500 text-center">
            OIL v0.1 | THT Thresholds: 70/90 (Blueprint) | SVASO Allocatie | Append-Only
          </p>
        </div>
      </footer>
    </div>
  );
}
