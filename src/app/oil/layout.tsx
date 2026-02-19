/**
 * OIL Dashboard Layout — Modern dark header with Oranjehoen branding
 *
 * REGRESSIE-CHECK:
 * - ✅ Read-only navigatie
 * - ✅ Geen mutations of forms
 * - ✅ Dark mode toggle met localStorage persistence
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DarkModeToggle } from '@/components/oil/DarkModeToggle';

const NAV_ITEMS = [
  { href: '/oil', label: 'Dashboard', exact: true },
  { href: '/oil/batches', label: 'Batches' },
  { href: '/oil/kostprijs', label: 'Kostprijs' },
  { href: '/oil/customers', label: 'Klanten' },
  { href: '/oil/planning', label: 'Planning' },
  { href: '/oil/orders', label: 'Orders' },
  { href: '/oil/processing', label: 'Verwerking' },
  { href: '/oil/exports', label: 'Exports' },
];

export default function OilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Header */}
      <header className="bg-gray-900 dark:bg-gray-950 dark:border-b dark:border-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <Link href="/oil" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-oranje-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:bg-oranje-400 transition-colors">
                O
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tracking-tight">OIL</span>
                <span className="text-xs text-gray-400 hidden sm:inline">
                  Oranjehoen Intelligence Layer
                </span>
              </div>
            </Link>

            {/* Navigation + Dark Mode */}
            <div className="flex items-center gap-3">
              <nav className="flex items-center gap-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive(item)
                        ? 'bg-oranje-500 text-white shadow-sm'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="h-5 w-px bg-gray-700" />
              <DarkModeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer — minimal */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-xs text-gray-400 text-center">
            OIL v0.1 — Oranjehoen B.V.
          </p>
        </div>
      </footer>
    </div>
  );
}
