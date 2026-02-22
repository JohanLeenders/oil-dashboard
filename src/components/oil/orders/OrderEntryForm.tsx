'use client';

/**
 * OrderEntryForm — Create a new order with inline product lines
 *
 * Wave 10 D3: Direct producten invullen bij aanmaken.
 * Wave 11 S3: Kippen-based invoer — enter bird count, auto-calculate kg.
 *
 * Per line: select product → enter bird count → auto-calc kg based on yields.
 * Fallback: manual kg entry if yield data unavailable for a product.
 */

import { useState, useTransition, useMemo } from 'react';
import { createOrderWithLines } from '@/lib/actions/orders';
import type { LocationYieldProfile, ProductYieldChain } from '@/lib/engine/availability/cascading';

interface OrderLine {
  productId: string;
  birds: string;      // bird count input
  quantityKg: string; // manual kg override (used when no yield available)
  mode: 'birds' | 'kg'; // input mode
}

interface OrderEntryFormProps {
  slaughterId: string;
  customers: { id: string; name: string }[];
  products: { id: string; name: string; category: string | null }[];
  onOrderCreated: () => void;
  onCancel: () => void;
  avgBirdWeightKg?: number;
  yieldProfiles?: LocationYieldProfile[];
  yieldChains?: ProductYieldChain[];
}

const GRILLER_YIELD = 0.704;

const EMPTY_LINE = (): OrderLine => ({ productId: '', birds: '', quantityKg: '', mode: 'birds' });

export default function OrderEntryForm({
  slaughterId,
  customers,
  products,
  onOrderCreated,
  onCancel,
  avgBirdWeightKg = 2.5,
  yieldProfiles = [],
  yieldChains = [],
}: OrderEntryFormProps) {
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([EMPTY_LINE(), EMPTY_LINE(), EMPTY_LINE()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Build lookup: productId → effective yield from live bird weight
  // Primary (Putten): grillerYield × profileYield
  // Putten-cut children: grillerYield × parentYield × childYield (from Putten→Putten chains)
  // Secondary (Nijkerk): grillerYield × parentYield × childYield (from Putten→Nijkerk chains, normalized)
  //
  // IMPORTANT: Putten→Putten chains and Putten→Nijkerk chains must be computed SEPARATELY.
  // They have independent yield sums and different normalization rules.
  const productYieldMap = useMemo(() => {
    const map = new Map<string, number>();

    // Helper: check if chain is Putten→Putten (same source & target location)
    const isPuttenCut = (c: ProductYieldChain) =>
      c.source_location_id && c.target_location_id && c.source_location_id === c.target_location_id;
    const isNijkerkCascade = (c: ProductYieldChain) =>
      !c.source_location_id || !c.target_location_id || c.source_location_id !== c.target_location_id;

    // 1. Primary products (Putten yield profiles — parent pools)
    for (const p of yieldProfiles) {
      map.set(p.product_id, GRILLER_YIELD * p.yield_percentage);
    }

    // 2a. Putten→Putten cut children (forced co-production)
    // These are direct products of cutting the parent at Putten.
    // Yield = grillerYield × parentYield × childYield (no normalization needed: sum = 1.0 with loss)
    // Filter out loss products (verlies) — they are not orderable
    const puttenCutChains = yieldChains.filter(isPuttenCut);
    const puttenChainsByParent = new Map<string, ProductYieldChain[]>();
    for (const chain of puttenCutChains) {
      const existing = puttenChainsByParent.get(chain.parent_product_id) ?? [];
      existing.push(chain);
      puttenChainsByParent.set(chain.parent_product_id, existing);
    }

    for (const [parentId, chains] of puttenChainsByParent) {
      const parentProfile = yieldProfiles.find(pr => pr.product_id === parentId);
      if (!parentProfile) continue;

      for (const chain of chains) {
        // Skip loss products (not orderable)
        const lowerDesc = chain.child_product_description.toLowerCase();
        if (lowerDesc.includes('verlies') || lowerDesc.includes('loss')) continue;

        const effectiveYield = GRILLER_YIELD * parentProfile.yield_percentage * chain.yield_pct;
        const existing = map.get(chain.child_product_id) ?? 0;
        map.set(chain.child_product_id, existing + effectiveYield);
      }
    }

    // 2b. Nijkerk cascade chains — with normalization per parent
    const nijkerkChains = yieldChains.filter(isNijkerkCascade);
    const nijkerkChainsByParent = new Map<string, ProductYieldChain[]>();
    for (const chain of nijkerkChains) {
      const existing = nijkerkChainsByParent.get(chain.parent_product_id) ?? [];
      existing.push(chain);
      nijkerkChainsByParent.set(chain.parent_product_id, existing);
    }

    for (const [parentId, chains] of nijkerkChainsByParent) {
      const parentProfile = yieldProfiles.find(pr => pr.product_id === parentId);
      if (!parentProfile) continue;

      const rawYieldSum = chains.reduce((s, c) => s + c.yield_pct, 0);
      const normFactor = rawYieldSum > 1.0 ? rawYieldSum : 1.0;

      for (const chain of chains) {
        const effectiveChildYield = chain.yield_pct / normFactor;
        const existing = map.get(chain.child_product_id) ?? 0;
        map.set(
          chain.child_product_id,
          existing + GRILLER_YIELD * parentProfile.yield_percentage * effectiveChildYield
        );
      }
    }

    // 3. Variant fallback: products not in yield profiles or chains inherit
    //    the yield of a product with the same category that IS in the map.
    //    E.g. "Drumvlees vacuum 15kg" (drumvlees) inherits from "Drumvlees" (drumvlees).
    //    E.g. "Dijvlees Vacuüm" (dij) inherits from "Dijfilet bulk" (dij).
    const categoryYield = new Map<string, number>();
    for (const prod of products) {
      if (prod.category && map.has(prod.id)) {
        // First product per category wins (they should all be the same yield)
        if (!categoryYield.has(prod.category)) {
          categoryYield.set(prod.category, map.get(prod.id)!);
        }
      }
    }
    for (const prod of products) {
      if (!map.has(prod.id) && prod.category && categoryYield.has(prod.category)) {
        map.set(prod.id, categoryYield.get(prod.category)!);
      }
    }

    return map;
  }, [yieldProfiles, yieldChains, products]);

  /** Get the effective kg for a line */
  function getLineKg(line: OrderLine): number {
    if (line.mode === 'kg') {
      return parseFloat(line.quantityKg) || 0;
    }
    const birdCount = parseInt(line.birds) || 0;
    if (!line.productId || birdCount <= 0) return 0;
    const effectiveYield = productYieldMap.get(line.productId);
    if (!effectiveYield) return 0;
    return birdCount * avgBirdWeightKg * effectiveYield;
  }

  function updateLine(index: number, field: keyof OrderLine, value: string) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function addLine() {
    setLines((prev) => [...prev, EMPTY_LINE()]);
  }

  function toggleMode(index: number) {
    setLines((prev) => {
      const next = [...prev];
      const line = next[index];
      if (line.mode === 'birds') {
        // Switching birds → kg: convert current bird count to kg
        const kg = getLineKg(line);
        next[index] = {
          ...line,
          mode: 'kg',
          quantityKg: kg > 0 ? String(Math.round(kg * 10) / 10) : line.quantityKg,
        };
      } else {
        // Switching kg → birds: try to reverse-calculate bird count from kg
        const kg = parseFloat(line.quantityKg) || 0;
        const effectiveYield = line.productId ? productYieldMap.get(line.productId) : undefined;
        let birds = '';
        if (kg > 0 && effectiveYield && effectiveYield > 0) {
          birds = String(Math.round(kg / (avgBirdWeightKg * effectiveYield)));
        }
        next[index] = {
          ...line,
          mode: 'birds',
          birds: birds || line.birds,
        };
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Selecteer een klant');
      return;
    }

    const validLines = lines
      .filter((l) => l.productId)
      .map((l) => ({
        productId: l.productId,
        quantityKg: getLineKg(l),
      }))
      .filter((l) => l.quantityKg > 0);

    if (validLines.length === 0) {
      setError('Voeg minimaal één productregel toe');
      return;
    }

    startTransition(async () => {
      try {
        await createOrderWithLines(slaughterId, customerId, validLines, notes || undefined);
        onOrderCreated();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Er ging iets mis bij het aanmaken'
        );
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-main)',
  };

  const totalKg = lines.reduce((sum, l) => sum + getLineKg(l), 0);

  return (
    <form
      onSubmit={handleSubmit}
      className="oil-card p-4 space-y-4"
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
        Nieuwe order
      </h3>

      {/* Customer selector */}
      <div>
        <label htmlFor="customer" className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Klant
        </label>
        <select
          id="customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="block w-full rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
          style={inputStyle}
          disabled={isPending}
        >
          <option value="">-- Selecteer klant --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Product lines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Productregels
          </label>
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-medium px-2 py-0.5 rounded transition-colors"
            style={{ color: 'var(--color-oil-orange)', background: 'rgba(246, 126, 32, 0.1)' }}
          >
            + Regel toevoegen
          </button>
        </div>

        {/* Column headers */}
        <div className="flex gap-2 items-center mb-1 px-0.5">
          <span className="flex-1 text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-dim)' }}>
            Product
          </span>
          <span className="w-16 text-[10px] uppercase tracking-wider font-medium text-center" style={{ color: 'var(--color-text-dim)' }}>
            Modus
          </span>
          <span className="w-24 text-[10px] uppercase tracking-wider font-medium text-right" style={{ color: 'var(--color-text-dim)' }}>
            Aantal
          </span>
          <span className="w-24 text-[10px] uppercase tracking-wider font-medium text-right" style={{ color: 'var(--color-text-dim)' }}>
            = kg
          </span>
          <span className="w-6" />
        </div>

        <div className="space-y-2">
          {lines.map((line, index) => {
            const hasYield = line.productId ? productYieldMap.has(line.productId) : true;
            const lineKg = getLineKg(line);

            return (
              <div key={index} className="flex gap-2 items-center">
                {/* Product dropdown */}
                <select
                  value={line.productId}
                  onChange={(e) => updateLine(index, 'productId', e.target.value)}
                  className="flex-1 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-500"
                  style={inputStyle}
                  disabled={isPending}
                >
                  <option value="">-- Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                {/* Mode toggle — kippen vs kg */}
                <button
                  type="button"
                  onClick={() => hasYield ? toggleMode(index) : undefined}
                  className="w-16 rounded-md px-1 py-1.5 text-xs font-medium text-center transition-colors"
                  style={{
                    background: line.mode === 'birds' && hasYield
                      ? 'rgba(246, 126, 32, 0.15)'
                      : 'var(--color-bg-elevated)',
                    border: '1px solid ' + (line.mode === 'birds' && hasYield
                      ? 'rgba(246, 126, 32, 0.4)'
                      : 'var(--color-border-subtle)'),
                    color: line.mode === 'birds' && hasYield
                      ? 'var(--color-oil-orange)'
                      : 'var(--color-text-muted)',
                    cursor: hasYield ? 'pointer' : 'default',
                    opacity: hasYield ? 1 : 0.5,
                  }}
                  title={hasYield ? (line.mode === 'birds' ? 'Klik voor kg-invoer' : 'Klik voor kippen-invoer') : 'Geen yield data — alleen kg'}
                  disabled={isPending}
                >
                  {line.mode === 'birds' && hasYield ? 'Kippen' : 'kg'}
                </button>

                {/* Bird count OR manual kg input */}
                {line.mode === 'birds' && hasYield ? (
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="aantal"
                    value={line.birds}
                    onChange={(e) => updateLine(index, 'birds', e.target.value)}
                    className="w-24 rounded-md px-2 py-1.5 text-sm text-right font-mono focus:ring-1 focus:ring-orange-500"
                    style={inputStyle}
                    disabled={isPending}
                  />
                ) : (
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="kg"
                    value={line.quantityKg}
                    onChange={(e) => updateLine(index, 'quantityKg', e.target.value)}
                    className="w-24 rounded-md px-2 py-1.5 text-sm text-right font-mono focus:ring-1 focus:ring-orange-500"
                    style={inputStyle}
                    disabled={isPending}
                  />
                )}

                {/* Calculated kg display */}
                <div className="w-24 text-right">
                  {lineKg > 0 ? (
                    <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                      {lineKg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>—</span>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  disabled={isPending || lines.length <= 1}
                  className="w-6 text-xs px-1 py-0.5 rounded transition-colors disabled:opacity-30"
                  style={{ color: 'var(--color-data-red)' }}
                  title="Verwijder regel"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Total */}
        {totalKg > 0 && (
          <div className="flex justify-end mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <span className="text-xs font-medium font-mono tabular-nums" style={{ color: 'var(--color-oil-orange)' }}>
              Totaal: {totalKg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Notities (optioneel)
        </label>
        <input
          id="notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Eventuele opmerkingen"
          className="block w-full rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500"
          style={inputStyle}
          disabled={isPending}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-data-red)' }}>{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'var(--color-oil-orange)' }}
        >
          {isPending ? 'Bezig...' : 'Order aanmaken'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)' }}
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
