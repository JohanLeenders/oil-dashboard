'use client';

/**
 * IntentTable — Order Intake werkbak tabel
 *
 * Columns: datum, kanaal, klant, preview, confidence, status, acties
 * Filter tabs: Alle | Nieuw | Needs Review | Geaccepteerd | Doorgestuurd
 * Click row → opens detail drawer
 */

import { useState, useMemo } from 'react';
import type { OrderIntentWithCustomer, OrderIntentStatus } from '@/types/order-intake';

// ─── Filter tabs ────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'new' | 'needs_review' | 'accepted' | 'forwarded' | 'rejected';

const FILTER_TABS: { key: FilterTab; label: string; statuses?: OrderIntentStatus[] }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'new', label: 'Nieuw', statuses: ['new', 'parsed'] },
  { key: 'needs_review', label: 'Review', statuses: ['needs_review'] },
  { key: 'accepted', label: 'Geaccepteerd', statuses: ['accepted'] },
  { key: 'forwarded', label: 'Doorgestuurd', statuses: ['forwarded'] },
  { key: 'rejected', label: 'Afgewezen', statuses: ['rejected'] },
];

// ─── Channel icons ──────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, { icon: string; label: string }> = {
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  email: { icon: '📧', label: 'Email' },
  edi: { icon: '🔗', label: 'EDI' },
  manual: { icon: '✍️', label: 'Handmatig' },
};

// ─── Status badges ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OrderIntentStatus, { label: string; bg: string; color: string }> = {
  new: { label: 'Nieuw', bg: 'rgba(59, 130, 246, 0.15)', color: 'rgb(96, 165, 250)' },
  parsed: { label: 'Geparsed', bg: 'rgba(59, 130, 246, 0.15)', color: 'rgb(96, 165, 250)' },
  needs_review: { label: 'Review', bg: 'rgba(245, 158, 11, 0.15)', color: 'rgb(251, 191, 36)' },
  accepted: { label: 'Geaccepteerd', bg: 'rgba(34, 197, 94, 0.15)', color: 'rgb(74, 222, 128)' },
  forwarded: { label: 'Doorgestuurd', bg: 'rgba(34, 197, 94, 0.15)', color: 'rgb(74, 222, 128)' },
  rejected: { label: 'Afgewezen', bg: 'rgba(239, 68, 68, 0.15)', color: 'rgb(248, 113, 113)' },
};

// ─── Component ──────────────────────────────────────────────────────────────

interface IntentTableProps {
  intents: OrderIntentWithCustomer[];
  onSelect: (intent: OrderIntentWithCustomer) => void;
}

export function IntentTable({ intents, onSelect }: IntentTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.key === activeFilter);
    if (!tab?.statuses) return intents;
    return intents.filter((i) => tab.statuses!.includes(i.status));
  }, [intents, activeFilter]);

  // Count per tab
  const counts = useMemo(() => {
    const map: Record<FilterTab, number> = { all: intents.length, new: 0, needs_review: 0, accepted: 0, forwarded: 0, rejected: 0 };
    for (const i of intents) {
      if (i.status === 'new' || i.status === 'parsed') map.new++;
      else if (i.status === 'needs_review') map.needs_review++;
      else if (i.status === 'accepted') map.accepted++;
      else if (i.status === 'forwarded') map.forwarded++;
      else if (i.status === 'rejected') map.rejected++;
    }
    return map;
  }, [intents]);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              style={{
                background: isActive ? 'var(--color-oil-orange)' : 'var(--color-bg-elevated)',
                color: isActive ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-card)',
                    color: isActive ? '#fff' : 'var(--color-text-dim)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="oil-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Geen order intents in deze categorie
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {['Datum', 'Kanaal', 'Klant', 'Bericht', 'Score', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-dim)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((intent) => {
                  const channel = CHANNEL_ICONS[intent.source_channel] ?? CHANNEL_ICONS.manual;
                  const status = STATUS_CONFIG[intent.status];
                  const preview = intent.raw_text.length > 80
                    ? intent.raw_text.slice(0, 77) + '...'
                    : intent.raw_text;
                  const date = new Date(intent.created_at);
                  const dateStr = date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' });
                  const timeStr = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr
                      key={intent.id}
                      onClick={() => onSelect(intent)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = '';
                      }}
                    >
                      {/* Datum */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-main)' }}>
                          {dateStr}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                          {timeStr}
                        </p>
                      </td>

                      {/* Kanaal */}
                      <td className="px-4 py-3" title={channel.label}>
                        <span className="text-base">{channel.icon}</span>
                      </td>

                      {/* Klant */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>
                          {intent.customer_name ?? 'Onbekend'}
                        </p>
                        {intent.customer_code && (
                          <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                            {intent.customer_code}
                          </p>
                        )}
                      </td>

                      {/* Bericht preview */}
                      <td className="px-4 py-3 max-w-xs">
                        <p
                          className="text-xs truncate"
                          style={{ color: 'var(--color-text-muted)' }}
                          title={intent.raw_text}
                        >
                          {preview}
                        </p>
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ConfidenceBar value={intent.confidence_score} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="text-[10px] font-medium px-2 py-1 rounded-full"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confidence bar ─────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8 ? 'rgb(74, 222, 128)' :
    value >= 0.5 ? 'rgb(251, 191, 36)' :
    'rgb(248, 113, 113)';

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-12 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--color-bg-elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-[10px] font-mono"
        style={{ color: 'var(--color-text-dim)' }}
      >
        {pct}%
      </span>
    </div>
  );
}
