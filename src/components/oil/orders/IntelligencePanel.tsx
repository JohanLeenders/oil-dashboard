'use client';

/**
 * IntelligencePanel — Compact slaughter day KPI bar (UX-3)
 *
 * Shows key numbers in a single horizontal bar:
 * Putten kg → cascade arrow → Nijkerk kg | Total | Orders count
 */

import type { CascadedAvailability } from '@/lib/engine/availability/cascading';
import type { CustomerOrder } from '@/types/database';

interface IntelligencePanelProps {
  availability: CascadedAvailability;
  orders: (CustomerOrder & { customer_name: string; chicken_equivalent: number })[];
}

export default function IntelligencePanel({
  availability,
  orders,
}: IntelligencePanelProps) {
  const puttenKg = availability.primary_products.reduce(
    (s, p) => s + p.primary_available_kg, 0
  );
  const nijkerkKg = availability.secondary_products.reduce(
    (s, p) => s + p.available_kg, 0
  );
  const totalKg = puttenKg + nijkerkKg;
  const totalOrdered = orders.reduce((s, o) => s + o.total_kg, 0);
  const benutPct = totalKg > 0 ? (totalOrdered / totalKg) * 100 : 0;

  const fmt = (v: number) => v.toLocaleString('nl-NL', { maximumFractionDigits: 0 });

  return (
    <div className="oil-card px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap text-xs">
        {/* Putten */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-oil-orange)' }} />
          <span style={{ color: 'var(--color-text-dim)' }}>Putten</span>
          <span className="font-mono tabular-nums font-medium" style={{ color: 'var(--color-text-main)' }}>
            {fmt(puttenKg)} kg
          </span>
        </div>

        {/* Cascade arrow */}
        <span className="font-mono" style={{ color: 'var(--color-oil-orange)' }}>&rarr;</span>

        {/* Nijkerk */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span style={{ color: 'var(--color-text-dim)' }}>Nijkerk</span>
          <span className="font-mono tabular-nums font-medium" style={{ color: 'var(--color-text-main)' }}>
            {fmt(nijkerkKg)} kg
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-4" style={{ background: 'var(--color-border-subtle)' }} />

        {/* Totaal beschikbaar */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--color-text-dim)' }}>Totaal</span>
          <span className="font-mono tabular-nums font-semibold" style={{ color: 'var(--color-text-main)' }}>
            {fmt(totalKg)} kg
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-4" style={{ background: 'var(--color-border-subtle)' }} />

        {/* Besteld */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--color-text-dim)' }}>Besteld</span>
          <span className="font-mono tabular-nums font-medium" style={{ color: totalOrdered > 0 ? 'var(--color-oil-orange)' : 'var(--color-text-dim)' }}>
            {fmt(totalOrdered)} kg
          </span>
          {benutPct > 0 && (
            <span className="font-mono tabular-nums" style={{
              color: benutPct > 90 ? 'var(--color-data-red)' : benutPct > 50 ? 'var(--color-oil-orange)' : 'var(--color-text-dim)',
            }}>
              ({benutPct.toFixed(0)}%)
            </span>
          )}
        </div>

        {/* Orders count */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
