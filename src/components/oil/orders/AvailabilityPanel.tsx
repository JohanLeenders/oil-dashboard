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

function getRowStyle(remaining: number, available: number, oversubscribed: number): string {
  if (oversubscribed > 0) return 'bg-red-50 dark:bg-red-900/20';
  if (available <= 0) return '';
  const ratio = remaining / available;
  if (ratio <= 0) return 'bg-red-50 dark:bg-red-900/20';
  if (ratio < 0.25) return 'bg-yellow-50 dark:bg-yellow-900/20';
  return '';
}

function getRemainingColor(remaining: number, available: number): string {
  if (available <= 0) return 'text-gray-500';
  const ratio = remaining / available;
  if (ratio <= 0) return 'text-red-600 dark:text-red-400';
  if (ratio < 0.25) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

// ── Row renderers ──────────────────────────────────────────────────────────

function PrimaryRow({ product }: { product: CascadedProduct }) {
  const remaining = product.primary_available_kg - product.sold_primary_kg;
  const rowStyle = getRowStyle(remaining, product.primary_available_kg, product.oversubscribed_kg);
  const remainColor = getRemainingColor(remaining, product.primary_available_kg);
  return (
    <tr className={rowStyle}>
      <td className="py-2 px-3">
        <span className="font-medium text-gray-900 dark:text-gray-100 text-xs">
          {product.product_description}
        </span>
      </td>
      <td className="py-2 px-2 text-right tabular-nums text-xs text-gray-600 dark:text-gray-400">
        {formatKg(product.primary_available_kg)}
      </td>
      <td className="py-2 px-2 text-right tabular-nums text-xs text-gray-600 dark:text-gray-400">
        {product.sold_primary_kg > 0 ? formatKg(product.sold_primary_kg) : '–'}
      </td>
      <td className={`py-2 px-3 text-right tabular-nums text-xs font-semibold ${remainColor}`}>
        {product.oversubscribed_kg > 0 ? <>-{formatKg(product.oversubscribed_kg)}</> : <>{formatKg(remaining)}</>}
      </td>
    </tr>
  );
}

function SecondaryRow({ child }: { child: CascadedChild }) {
  const rowStyle = getRowStyle(child.net_available_kg, child.available_kg, 0);
  const remainColor = getRemainingColor(child.net_available_kg, child.available_kg);
  return (
    <tr className={rowStyle}>
      <td className="py-2 px-3">
        <span className="font-medium text-gray-900 dark:text-gray-100 text-xs">
          {child.product_description}
        </span>
      </td>
      <td className="py-2 px-2 text-right tabular-nums text-xs text-gray-600 dark:text-gray-400">
        {formatKg(child.available_kg)}
      </td>
      <td className="py-2 px-2 text-right tabular-nums text-xs text-gray-600 dark:text-gray-400">
        {child.sold_kg > 0 ? formatKg(child.sold_kg) : '–'}
      </td>
      <td className={`py-2 px-3 text-right tabular-nums text-xs font-semibold ${remainColor}`}>
        {formatKg(child.net_available_kg)}
      </td>
    </tr>
  );
}

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="bg-gray-50 dark:bg-gray-900/50">
        {columns.map((col, i) => (
          <th
            key={col}
            className={`py-2 ${i === 0 ? 'text-left px-3' : 'text-right px-2'} ${i === columns.length - 1 ? 'px-3' : ''} text-xs font-medium text-gray-500 dark:text-gray-400`}
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
      <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
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
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Griller totaal
            </div>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 tabular-nums">
              {formatKg(availability.griller_kg)} kg
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Besteld: {formatKg(totalSold)} kg
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Rest: {formatKg(availability.griller_kg - totalSold)} kg
            </div>
          </div>
        </div>
      </div>

      {/* ── Putten (Dag 0) — Main Products ── */}
      {mainProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Putten — Dag 0
            </h4>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <TableHeader columns={['Product', 'Beschikbaar', 'Besteld', 'Rest']} />
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
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
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Nijkerk — Dag +1
            </h4>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <TableHeader columns={['Product', 'Cascade', 'Besteld', 'Rest']} />
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {mainSecondary.map((c) => (
                  <SecondaryRow key={c.product_id} child={c} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 italic">
            Cascade = onverkochte Putten-delen → Nijkerk fileerderij
          </p>
        </div>
      )}

      {/* ── Organen & rest (collapsible) ── */}
      {hasOrgans && (
        <div>
          <button
            type="button"
            onClick={() => setOrgansOpen(!organsOpen)}
            className="w-full flex items-center justify-between gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Organen &amp; rest
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {formatKg(organTotalRemaining)} kg rest
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${organsOpen ? 'rotate-180' : ''}`}
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
            <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <TableHeader columns={['Product', 'Beschikbaar', 'Besteld', 'Rest']} />
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
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
