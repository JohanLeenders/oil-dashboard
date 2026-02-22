'use client';

/**
 * AvailabilityPanel — Cascaded availability display (Putten → Nijkerk)
 *
 * Layout:
 *   1. Griller summary bar (total kg from slaughter)
 *   2. Putten (Dag 0) — ALL products in one table (main + organs with separator)
 *   3. Nijkerk (Dag +1) — secondary products cascaded from unsold Putten parts
 *
 * Wave 10: Organs shown inline with main Putten products (no longer collapsed)
 * Wave 9: OIL design tokens, monospace numbers
 */

import { useState, useEffect, useRef } from 'react';
import type { CascadedProduct, CascadedChild } from '@/lib/engine/availability/cascading';
import type { AvailabilityWithWholeChicken } from '@/lib/actions/availability';

interface AvailabilityPanelProps {
  availability: AvailabilityWithWholeChicken;
}

// Product descriptions that belong in the "Organen & rest" group (shown after separator)
const ORGAN_KEYWORDS = ['lever', 'hart', 'maag', 'nek', 'hals', 'vel', 'karkas'];
// Products that should NEVER be classified as organs, even if they contain organ keywords
const ORGAN_EXCEPTIONS = ['borstkap'];

function isOrganProduct(description: string): boolean {
  const lower = description.toLowerCase();
  if (ORGAN_EXCEPTIONS.some((ex) => lower.includes(ex))) return false;
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
  const hasPrimary = availability.primary_products.length > 0;
  const hasSecondary = availability.secondary_products.length > 0;

  // Refresh indicator — detect when availability data changes
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [flash, setFlash] = useState(false);
  const prevGrillerRef = useRef(availability.griller_kg);
  const prevSoldRef = useRef(availability.total_sold_primary_kg);

  useEffect(() => {
    const grillerChanged = prevGrillerRef.current !== availability.griller_kg;
    const soldChanged = prevSoldRef.current !== availability.total_sold_primary_kg;
    if (grillerChanged || soldChanged) {
      prevGrillerRef.current = availability.griller_kg;
      prevSoldRef.current = availability.total_sold_primary_kg;
      setLastRefresh(new Date());
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [availability.griller_kg, availability.total_sold_primary_kg]);

  if (!hasPrimary && !hasSecondary) {
    return (
      <div className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Geen beschikbaarheidsdata
      </div>
    );
  }

  // Split primary products into main cuts vs organs (for separator row)
  const mainProducts = availability.primary_products.filter(
    (p) => !isOrganProduct(p.product_description)
  );
  const organProducts = availability.primary_products.filter(
    (p) => isOrganProduct(p.product_description)
  );

  // Secondary products (Nijkerk cascade) — keep separate table
  const mainSecondary = availability.secondary_products.filter(
    (c) => !isOrganProduct(c.product_description)
  );
  const organSecondary = availability.secondary_products.filter(
    (c) => isOrganProduct(c.product_description)
  );

  // Whole-bird deduction info (hele kip / naakt karkas uit verdeling gehaald)
  const wholeChickenKg = availability.whole_chicken_order_kg ?? 0;
  const originalGrillerKg = availability.original_griller_kg ?? availability.griller_kg;

  // Grand totals (besteld = primary parts + secondary parts + whole birds)
  const totalPrimarySold = availability.total_sold_primary_kg;
  const totalSecondarySold = availability.secondary_products.reduce((s, c) => s + c.sold_kg, 0);
  const totalSold = totalPrimarySold + totalSecondarySold + wholeChickenKg;

  const hasOrgans = organProducts.length > 0 || organSecondary.length > 0;

  return (
    <div
      className="space-y-5"
      style={{
        transition: 'box-shadow 0.4s ease',
        boxShadow: flash ? 'inset 0 0 0 2px rgba(246, 126, 32, 0.4)' : 'none',
        borderRadius: 'var(--radius-card)',
      }}
    >
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
              {formatKg(originalGrillerKg)} kg
            </div>
          </div>
          <div className="text-right text-xs font-mono tabular-nums" style={{ color: 'var(--color-oil-orange)' }}>
            <div>Besteld: {formatKg(totalSold)} kg</div>
            <div>Rest: {formatKg(originalGrillerKg - totalSold)} kg</div>
          </div>
        </div>
        {wholeChickenKg > 0 && (
          <div
            className="mt-2 pt-2 flex items-center justify-between text-xs font-mono tabular-nums"
            style={{ borderTop: '1px solid rgba(246, 126, 32, 0.2)', color: 'var(--color-text-muted)' }}
          >
            <span>Hele kip uit verdeling: <strong style={{ color: 'var(--color-data-gold)' }}>−{formatKg(wholeChickenKg)} kg</strong></span>
            <span>Te delen: <strong style={{ color: 'var(--color-text-main)' }}>{formatKg(availability.griller_kg)} kg</strong></span>
          </div>
        )}
      </div>

      {/* ── Putten (Dag 0) — ALL products in one table ── */}
      {(mainProducts.length > 0 || organProducts.length > 0) && (
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
                {/* Subtle separator between main cuts and organs */}
                {hasOrgans && mainProducts.length > 0 && (
                  <tr>
                    <td colSpan={4} className="py-0">
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
                        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-dim)' }}>
                          Organen &amp; rest
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
                      </div>
                    </td>
                  </tr>
                )}
                {organProducts.map((p) => (
                  <PrimaryRow key={p.product_id} product={p} />
                ))}
                {organSecondary.map((c) => (
                  <SecondaryRow key={c.product_id} child={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Nijkerk (Dag +1) — Cascade Products ── */}
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

      {/* ── Refresh timestamp ── */}
      <div
        className="flex items-center justify-end gap-1.5 pt-2"
        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: flash ? 'var(--color-oil-orange)' : 'var(--color-data-green)',
            transition: 'background 0.4s ease',
          }}
        />
        <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
          Berekend {lastRefresh.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
