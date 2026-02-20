'use client';

/**
 * IntelligencePanel — Slaughter day overview with Putten→Nijkerk cascade flow (UX-3)
 *
 * Shows KPI tiles (total kg, sold kg, utilization %),
 * per-location progress bars with glowing orange cascade flow connector.
 * Uses ONLY existing CascadedAvailability data — no new engine logic.
 */

import type { CascadedAvailability } from '@/lib/engine/availability/cascading';
import type { CustomerOrder } from '@/types/database';
import { KpiTile } from '@/components/oil/ui/KpiTile';
import { AvailabilityProgressBar } from '@/components/oil/ui/AvailabilityProgressBar';

interface OrderWithCustomer extends CustomerOrder {
  customer_name: string;
}

interface IntelligencePanelProps {
  availability: CascadedAvailability;
  orders: OrderWithCustomer[];
}

export default function IntelligencePanel({
  availability,
  orders,
}: IntelligencePanelProps) {
  // Compute totals from availability data
  const puttenAvailable = availability.primary_products.reduce(
    (s, p) => s + p.primary_available_kg, 0
  );
  const nijkerkAvailable = availability.secondary_products.reduce(
    (s, p) => s + p.available_kg, 0
  );
  const totalAvailable = puttenAvailable + nijkerkAvailable;

  // Compute ordered kg from orders
  const totalOrdered = orders.reduce((s, o) => s + o.total_kg, 0);

  // Estimate Putten/Nijkerk ordered split (approximate: orders don't track location directly)
  // Use a heuristic: assume Putten takes ~65% of ordered kg (typical primary product share)
  const puttenOrdered = Math.min(totalOrdered * 0.65, puttenAvailable);
  const nijkerkOrdered = totalOrdered - puttenOrdered;

  const utilizationPct = totalAvailable > 0
    ? Math.round((totalOrdered / totalAvailable) * 100)
    : 0;

  // Cascade flow: what Putten doesn't sell flows to Nijkerk
  const puttenRest = Math.max(0, puttenAvailable - puttenOrdered);

  const utilizationColor = utilizationPct >= 80 ? 'green' : utilizationPct >= 50 ? 'orange' : 'red';

  return (
    <div className="oil-card p-4 space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
        Slachtdag Overzicht
      </h3>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-3">
        <KpiTile
          label="Totaal"
          value={totalAvailable.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
          unit="kg"
        />
        <KpiTile
          label="Verkocht"
          value={totalOrdered.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
          unit="kg"
          color={utilizationColor as 'green' | 'orange' | 'red'}
        />
        <KpiTile
          label="Benut"
          value={`${utilizationPct}%`}
          color={utilizationColor as 'green' | 'orange' | 'red'}
        />
      </div>

      {/* Putten section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Putten (Dag 0)
          </span>
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
            {puttenAvailable.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
          </span>
        </div>
        <AvailabilityProgressBar
          availableKg={puttenAvailable}
          orderedKg={puttenOrdered}
          compact
        />
      </div>

      {/* Cascade flow connector (UX-3) */}
      <div className="flex items-center gap-2 pl-4">
        <div
          className="w-0.5 h-8 rounded-full"
          style={{
            background: 'var(--color-oil-orange)',
            boxShadow: '0 0 8px var(--color-oil-orange)',
          }}
        />
        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums" style={{ color: 'var(--color-oil-orange)' }}>
          <span>→</span>
          <span>{puttenRest.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg cascade</span>
        </div>
      </div>

      {/* Nijkerk section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Nijkerk (Dag +1)
          </span>
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
            {nijkerkAvailable.toLocaleString('nl-NL', { maximumFractionDigits: 0 })} kg
          </span>
        </div>
        <AvailabilityProgressBar
          availableKg={nijkerkAvailable}
          orderedKg={nijkerkOrdered}
          compact
        />
      </div>
    </div>
  );
}
