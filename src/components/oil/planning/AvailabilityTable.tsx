/**
 * AvailabilityTable — Theoretische beschikbaarheid op basis van JA757 yields
 * Sprint: Wave 3 — A1-S2 Availability Calc
 *
 * REGRESSIE-CHECK:
 * - Server Component (no 'use client')
 * - Read-only display, no mutations
 * - Uses standalone availability engine (no barrel imports)
 */

import { computeTheoreticalAvailability } from '@/lib/engine/availability';

interface AvailabilityTableProps {
  expectedLiveWeightKg: number;
}

export default function AvailabilityTable({ expectedLiveWeightKg }: AvailabilityTableProps) {
  const availability = computeTheoreticalAvailability(expectedLiveWeightKg);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Theoretische beschikbaarheid (JA757)
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Gebaseerd op Hubbard JA757 standaard yields — Phase 1 referentie
        </p>
      </div>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Deel
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Yield %
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Verwacht (kg)
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {availability.map((row) => (
            <tr key={row.part} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                {row.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                {(row.yield_pct * 100).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                {row.expected_kg.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
