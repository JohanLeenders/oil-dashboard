'use client';

/**
 * CoProductInsight — Shows co-production impact for the selected order.
 *
 * Placed directly below the OrderLineEditor so the user immediately sees
 * which order triggers forced co-production (zadel opensnijden).
 *
 * Visibility is controlled by the parent component: it is only rendered when
 * the selected order's line_categories overlap with putten_cut_trigger_categories
 * (computed server-side). This avoids brittle product_id / description matching.
 */

import type { AvailabilityWithWholeChicken } from '@/lib/actions/availability';

interface CoProductInsightProps {
  availability: AvailabilityWithWholeChicken;
}

function formatKg(value: number): string {
  return value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

export default function CoProductInsight({ availability }: CoProductInsightProps) {
  // Find all parent products that have Putten-cut routing with required cuts
  const parentsWithCuts = availability.primary_products.filter(
    (p) => p.putten_cut && p.putten_cut.required_cut_kg > 0
  );

  if (parentsWithCuts.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-data-gold)' }} />
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
          Co-product inzicht
        </h4>
      </div>
      {parentsWithCuts.map((parent) => {
        const cut = parent.putten_cut!;
        const nonLossChildren = cut.children.filter((c) => !c.is_loss);

        return (
          <div
            key={parent.product_id}
            className="rounded-lg p-3 space-y-2 mb-2"
            style={{
              background: 'rgba(255, 191, 0, 0.06)',
              border: '1px solid rgba(255, 191, 0, 0.25)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>
                {parent.product_description} opensnijden
              </span>
              <span className="font-mono tabular-nums" style={{ color: 'var(--color-data-gold)' }}>
                {formatKg(cut.required_cut_kg)} kg gesneden
              </span>
            </div>
            <div className="space-y-1">
              {nonLossChildren.map((child) => (
                <div
                  key={child.product_id}
                  className="flex items-center justify-between text-xs px-1"
                >
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {child.product_description}
                    <span className="ml-1 text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                      ({(child.yield_pct * 100).toFixed(1)}%)
                    </span>
                  </span>
                  <span className="font-mono tabular-nums flex gap-3">
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {formatKg(child.produced_kg)} kg
                    </span>
                    {child.co_product_free_kg > 0 && (
                      <span style={{ color: 'var(--color-data-gold)' }} title="Co-product vrije voorraad">
                        +{formatKg(child.co_product_free_kg)} vrij
                      </span>
                    )}
                    {child.unfulfilled_kg > 0 && (
                      <span style={{ color: 'var(--color-data-red)' }} title="Niet leverbaar">
                        −{formatKg(child.unfulfilled_kg)} tekort
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="flex items-center justify-between text-[10px] pt-1.5"
              style={{ borderTop: '1px solid rgba(255, 191, 0, 0.2)', color: 'var(--color-text-dim)' }}
            >
              <span>Snijverlies: {formatKg(cut.cut_loss_kg)} kg</span>
              <span>→ Nijkerk: {formatKg(cut.forwarded_to_nijkerk_kg)} kg</span>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] italic" style={{ color: 'var(--color-text-dim)' }}>
        Eén snij-operatie levert alle producten tegelijk op (gekoppeld)
      </p>
    </div>
  );
}
