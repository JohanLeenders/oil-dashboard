'use client';

/**
 * AvailabilityPanel — Cascaded availability display (Putten → Nijkerk)
 *
 * Layout:
 *   1. Griller summary bar (total kg from slaughter)
 *   2. Putten (Dag 0) — main products, then collapsible "Organen & rest"
 *   3. Nijkerk (Dag +1) — secondary products cascaded from unsold Putten parts
 *
 * "Organen & rest" groups: Levertjes, Hartjes, Maagjes, Nekken (+ Vel, Karkas if present)
 * Wave 9: OIL design tokens, monospace numbers
 */

import { useState } from 'react';
import type { CascadedAvailability, CascadedProduct, CascadedChild } from '@/lib/engine/availability/cascading';

interface AvailabilityPanelProps {
  availability: CascadedAvailability;
}

// Product descriptions that belong in the "Organen & rest" collapsible group
const ORGAN_KEYWORDS = ['lever', 'hart', 'maag', 'nek', 'hals', 'vel', 'karkas'];

function isOrganProduct(description: string): boolean {
  const lower = description.toLowerCase();
  return ORGAN_KEYWORDS.some((kw) => lower.includes(kw));
}

function formatKg(value: number): string {
  return value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

function getRowBgStyle(remaining: number, available: number, oversubscribed: number): React.CSSProperties | undefined {
  if (oversubscribed > 0) return { background: 'rgba(225, 29, 72, 0.08)' };
  if (available <= 0) return undefined;
  const ratio = remaining / available;
  if (ratio <= 0) return { background: 'rgba(225, 29, 72, 0.08)' };
  if (ratio < 0.25) return { background: 'rgba(255, 191, 0, 0.08)' };
  return undefined;
}

function getRemainingColor(remaining: number, available: number): string {
  if (available <= 0) return 'var(--color-text-dim)';
  const ratio = remaining / available;
  if (ratio <= 0) return 'var(--color-data-red)';
  if (ratio < 0.25) return 'var(--color-data-gold)';
  return 'var(--color-data-green)';
}

// ── Row renderers ──────────────────────────────────────────────────────────

function PrimaryRow({ product }: { product: CascadedProduct }) {
  const remaining = product.primary_available_kg - product.sold_primary_kg;
  const bgStyle = getRowBgStyle(remaining, product.primary_available_kg, product.oversubscribed_kg);
  const remainColor = getRemainingColor(remaining, product.primary_available_kg);
  return (
    <tr style={bgStyle}>
      <td className="py-2 px-3">
        <span className="font-medium text-xs" style={{ color: 'var(--color-text-main)' }}>
          {product.product_description}
        </span>
      </td>
      <td className="py-2 px-2 text-right font-mono tabular-nums text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {formatKg(product.primary_available_kg)}
      </td>
      <td className="py-2 px-2 text-right font-mono tabular-nums text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {product.sold_primary_kg > 0 ? formatKg(product.sold_primary_kg) : '\u2013'}
      </td>
      <td className="py-2 px-3 text-right font-mono tabular-nums text-xs font-semibold" style={{ color: remainColor }}>
        {product.oversubscribed_kg > 0 ? <>-{formatKg(product.oversubscribed_kg)}</> : <>{formatKg(remaining)}</>}
      </td>
    </tr>
  );
}

function SecondaryRow({ child }: { child: CascadedChild }) {
  const bgStyle = getRowBgStyle(child.net_available_kg, child.available_kg, 0);
  const remainColor = getRemainingColor(child.net_available_kg, child.available_kg);
  return (
    <tr style={bgStyle}>
      <td className="py-2 px-3">
        <span className="font-medium text-xs" style={{ color: 'var(--color-text-main)' }}>
          {child.product_description}
        </span>
      </td>
      <td className="py-2 px-2 text-right font-mono tabular-nums text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {formatKg(child.available_kg)}
      </td>
      <td className="py-2 px-2 text-right font-mono tabular-nums text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {child.sold_kg > 0 ? formatKg(child.sold_kg) : '\u2013'}
      </td>
      <td className="py-2 px-3 text-right font-mono tabular-nums text-xs font-semibold" style={{ color: remainColor }}>
        {formatKg(child.net_available_kg)}
      </td>
    </tr>
  );
}

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr style={{ background: 'var(--color-bg-elevated)' }}>
        {columns.map((col, i) => (
          <th
            key={col}
            className={`py-2 ${i === 0 ? 'text-left px-3' : 'text-right px-2'} ${i === columns.length - 1 ? 'px-3' : ''} text-xs font-medium`}
            style={{ color: 'var(--color-text-dim)' }}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AvailabilityPanel({ availability }: AvailabilityPanelProps) {
  const [organsOpen, setOrgansOpen] = useState(false);

  const hasPrimary = availability.primary_products.length > 0;
  const hasSecondary = availability.secondary_products.length > 0;

  if (!hasPrimary && !hasSecondary) {
    return (
      <div className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Geen beschikbaarheidsdata
      </div>
    );
  }

  // Split primary products into main vs organs
  const mainProducts = availability.primary_products.filter(
    (p) => !isOrganProduct(p.product_description)
  );
  const organProducts = availability.primary_products.filter(
    (p) => isOrganProduct(p.product_description)
  );

  // Also pull organ-type products from secondary (e.g. Vel cascades from Nijkerk)
  const mainSecondary = availability.secondary_products.filter(
    (c) => !isOrganProduct(c.product_description)
  );
  const organSecondary = availability.secondary_products.filter(
    (c) => isOrganProduct(c.product_description)
  );

  const hasOrgans = organProducts.length > 0 || organSecondary.length > 0;

  // Organ totals for collapsed summary
  const organTotalAvailable =
    organProducts.reduce((s, p) => s + p.primary_available_kg, 0) +
    organSecondary.reduce((s, c) => s + c.available_kg, 0);
  const organTotalSold =
    organProducts.reduce((s, p) => s + p.sold_primary_kg, 0) +
    organSecondary.reduce((s, c) => s + c.sold_kg, 0);
  const organTotalRemaining = organTotalAvailable - organTotalSold;

  // Grand totals
  const totalPrimarySold = availability.total_sold_primary_kg;
  const totalSecondarySold = availability.secondary_products.reduce((s, c) => s + c.sold_kg, 0);
  const totalSold = totalPrimarySold + totalSecondarySold;

  return (
    <div className="space-y-5">
      {/* ── Griller Summary ── */}
      <div
        className="rounded-lg p-3"
        style={{
          background: 'rgba(246, 126, 32, 0.1)',
          border: '1px solid rgba(246, 126, 32, 0.3)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-oil-orange)' }}>
              Griller totaal
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-text-main)' }}>
              {formatKg(availability.griller_kg)} kg
            </div>
          </div>
          <div className="text-right text-xs font-mono tabular-nums" style={{ color: 'var(--color-oil-orange)' }}>
            <div>Besteld: {formatKg(totalSold)} kg</div>
            <div>Rest: {formatKg(availability.griller_kg - totalSold)} kg</div>
          </div>
        </div>
      </div>

      {/* ── Putten (Dag 0) — Main Products ── */}
      {mainProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-oil-orange)' }} />
            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Putten — Dag 0
            </h4>
          </div>
          <div className="overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
            <table className="w-full text-sm">
              <TableHeader columns={['Product', 'Beschikbaar', 'Besteld', 'Rest']} />
              <tbody>
                {mainProducts.map((p) => (
                  <PrimaryRow key={p.product_id} product={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Nijkerk (Dag +1) — Main Cascade Products ── */}
      {mainSecondary.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              Nijkerk — Dag +1
            </h4>
          </div>
          <div className="overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
            <table className="w-full text-sm">
              <TableHeader columns={['Product', 'Cascade', 'Besteld', 'Rest']} />
              <tbody>
                {mainSecondary.map((c) => (
                  <SecondaryRow key={c.product_id} child={c} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[10px] italic" style={{ color: 'var(--color-text-dim)' }}>
            Cascade = onverkochte Putten-delen &rarr; Nijkerk fileerderij
          </p>
        </div>
      )}

      {/* ── Organen & rest (collapsible) ── */}
      {hasOrgans && (
        <div>
          <button
            type="button"
            onClick={() => setOrgansOpen(!organsOpen)}
            className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg transition-colors"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-text-dim)' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Organen &amp; rest
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
                {formatKg(organTotalRemaining)} kg rest
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${organsOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--color-text-dim)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {organsOpen && (
            <div className="mt-2 overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
              <table className="w-full text-sm">
                <TableHeader columns={['Product', 'Beschikbaar', 'Besteld', 'Rest']} />
                <tbody>
                  {organProducts.map((p) => (
                    <PrimaryRow key={p.product_id} product={p} />
                  ))}
                  {organSecondary.map((c) => (
                    <SecondaryRow key={c.product_id} child={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
