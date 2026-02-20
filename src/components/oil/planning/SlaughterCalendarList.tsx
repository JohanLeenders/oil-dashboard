/**
 * SlaughterCalendarList — Tabel met slachtkalender entries
 * Sprint: Wave 2 — A1-S1 Planning UI
 *
 * REGRESSIE-CHECK:
 * - Read-only display component
 * - Geen mutations of forms
 * - Server Component (no 'use client')
 * - Wave 9: OIL design tokens, SlaughterStatusBadge
 */

import Link from 'next/link';
import type { SlaughterCalendar, SlaughterStatus } from '@/types/database';
import { SlaughterStatusBadge } from '@/components/oil/ui/OrderStatusBadge';

interface SlaughterCalendarListProps {
  items: SlaughterCalendar[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SlaughterCalendarList({ items }: SlaughterCalendarListProps) {
  if (items.length === 0) {
    return (
      <div className="oil-card p-12" style={{ borderStyle: 'dashed' }}>
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12"
            style={{ color: 'var(--color-text-dim)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-white">
            Geen slachtdagen gevonden
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Er zijn momenteel geen geplande slachtdagen in de kalender.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="oil-card overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Datum
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Week
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Verwachte dieren
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Gewicht (kg)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Locatie
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Actie
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="transition-colors hover:bg-oil-elevated"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/oil/planning/${item.id}`}
                  className="text-sm font-medium text-white hover:text-oil-orange transition-colors"
                >
                  {formatDate(item.slaughter_date)}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Wk {item.week_number}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right font-mono tabular-nums">
                {item.expected_birds.toLocaleString('nl-NL')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-right font-mono tabular-nums">
                {item.expected_live_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {item.slaughter_location ?? '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <SlaughterStatusBadge status={item.status as SlaughterStatus} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <Link
                  href={`/oil/planning/${item.id}`}
                  className="text-sm transition-colors"
                  style={{ color: 'var(--color-oil-orange)' }}
                >
                  Details →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
