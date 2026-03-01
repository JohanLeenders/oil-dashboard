'use client';

/**
 * OrderIntakeClient — Client shell for Order Intake werkbak
 *
 * Manages: intent table, drawer, manual entry, stats overview.
 * Follows outreach client tab pattern with OIL design tokens.
 */

import { useState, useCallback } from 'react';
import type { OrderIntentWithCustomer, OrderIntentStatus } from '@/types/order-intake';
import { IntentTable } from '@/components/order-intake/IntentTable';
import { IntentDetailDrawer } from '@/components/order-intake/IntentDetailDrawer';
import { ManualEntryForm } from '@/components/order-intake/ManualEntryForm';
import { getOrderIntents } from '@/lib/actions/order-intake';

// ─── Component ──────────────────────────────────────────────────────────────

interface OrderIntakeClientProps {
  initialIntents: OrderIntentWithCustomer[];
  counts: Record<OrderIntentStatus, number>;
}

export default function OrderIntakeClient({
  initialIntents,
  counts: initialCounts,
}: OrderIntakeClientProps) {
  const [intents, setIntents] = useState(initialIntents);
  const [counts, setCounts] = useState(initialCounts);
  const [selectedIntent, setSelectedIntent] = useState<OrderIntentWithCustomer | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Refresh data from server
  const refresh = useCallback(async () => {
    try {
      const fresh = await getOrderIntents();
      setIntents(fresh);
      // Recalculate counts
      const newCounts: Record<string, number> = {
        new: 0, parsed: 0, needs_review: 0, accepted: 0, forwarded: 0, rejected: 0,
      };
      for (const i of fresh) {
        if (i.status in newCounts) newCounts[i.status]++;
      }
      setCounts(newCounts as Record<OrderIntentStatus, number>);
    } catch { /* noop */ }
  }, []);

  const handleSelectIntent = useCallback((intent: OrderIntentWithCustomer) => {
    setSelectedIntent(intent);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedIntent(null);
  }, []);

  const handleIntentUpdated = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleManualComplete = useCallback(() => {
    refresh();
  }, [refresh]);

  // Active count = new + needs_review
  const activeCount = (counts.new ?? 0) + (counts.needs_review ?? 0);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon="📥" label="Nieuw" value={counts.new + (counts.parsed ?? 0)} />
        <StatTile icon="🔍" label="Review" value={counts.needs_review} color="rgb(251, 191, 36)" />
        <StatTile icon="✅" label="Geaccepteerd" value={counts.accepted} color="rgb(74, 222, 128)" />
        <StatTile icon="📤" label="Doorgestuurd" value={counts.forwarded} color="rgb(74, 222, 128)" />
        <StatTile icon="❌" label="Afgewezen" value={counts.rejected} />
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {activeCount > 0
            ? `${activeCount} ${activeCount === 1 ? 'intent' : 'intents'} vereist actie`
            : 'Geen openstaande intents'
          }
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}
          >
            Vernieuwen
          </button>
          <button
            type="button"
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ background: 'var(--color-oil-orange)' }}
          >
            {showManualEntry ? 'Sluiten' : '+ Handmatig invoeren'}
          </button>
        </div>
      </div>

      {/* Manual entry form */}
      {showManualEntry && (
        <ManualEntryForm onComplete={handleManualComplete} />
      )}

      {/* Intent table */}
      <IntentTable
        intents={intents}
        onSelect={handleSelectIntent}
      />

      {/* Detail drawer */}
      {selectedIntent && (
        <IntentDetailDrawer
          intent={selectedIntent}
          onClose={handleCloseDrawer}
          onUpdated={handleIntentUpdated}
        />
      )}
    </div>
  );
}

// ─── Stat tile ──────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="oil-card p-4 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p
          className="text-lg font-semibold"
          style={{
            color: color ?? 'var(--color-text-main)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {value}
        </p>
        <p
          className="text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-dim)' }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
