/**
 * OIL Dashboard Layout — Mission Control with sidebar navigation
 *
 * REGRESSIE-CHECK:
 * - Read-only navigatie
 * - Sidebar with progressive disclosure (UX-1)
 * - Dark mode permanent (no toggle)
 */

'use client';

import { Sidebar } from '@/components/oil/layout/Sidebar';

export default function OilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen" style={{ background: 'var(--color-bg-main)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
