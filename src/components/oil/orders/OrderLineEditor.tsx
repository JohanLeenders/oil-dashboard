'use client';

/**
 * OrderLineEditor — Add/remove/edit order lines
 *
 * REGRESSIE-CHECK:
 * - Writes to order_lines via server actions (add, remove, update)
 * - Wave 7: Inline editing (click kg → input, Enter=save, Escape=cancel, Tab=save+next)
 * - Wave 7: Delete with confirmation dialog
 * - Wave 11 S3: Kippen-based invoer — enter bird count, auto-calculate kg.
 * - Wave 12: Batch add — meerdere regels tegelijk toevoegen.
 */

import { useState, useRef, useTransition, useCallback, useMemo } from 'react';
import { addOrderLine, removeOrderLine, updateOrderLine } from '@/lib/actions/orders';
import type { OrderLine } from '@/types/database';
import type { LocationYieldProfile, ProductYieldChain } from '@/lib/engine/availability/cascading';

interface OrderLineWithProduct extends OrderLine {
  product_name: string;
}

interface OrderLineEditorProps {
  orderId: string;
  lines: OrderLineWithProduct[];
  products: { id: string; name: string; category: string | null }[];
  onLinesChanged: () => void;
  avgBirdWeightKg?: number;
  yieldProfiles?: LocationYieldProfile[];
  yieldChains?: ProductYieldChain[];
}

const GRILLER_YIELD = 0.704;

interface NewLine {
  productId: string;
  birds: string;
  quantityKg: string;
  mode: 'birds' | 'kg';
}

const EMPTY_NEW_LINE = (): NewLine => ({ productId: '', birds: '', quantityKg: '', mode: 'birds' });

export default function OrderLineEditor({
  orderId,
  lines,
  products,
  onLinesChanged,
  avgBirdWeightKg = 2.5,
  yieldProfiles = [],
  yieldChains = [],
}: OrderLineEditorProps) {
  // Batch add state — multiple new lines at once
  const [newLines, setNewLines] = useState<NewLine[]>([EMPTY_NEW_LINE()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Inline edit state
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Build yield lookup (same logic as OrderEntryForm + cascade engine)
  // Putten→Putten chains and Putten→Nijkerk chains are computed SEPARATELY
  // to avoid incorrect normalization when mixed.
  const productYieldMap = useMemo(() => {
    const map = new Map<string, number>();

    const isPuttenCut = (c: ProductYieldChain) =>
      c.source_location_id && c.target_location_id && c.source_location_id === c.target_location_id;
    const isNijkerkCascade = (c: ProductYieldChain) =>
      !c.source_location_id || !c.target_location_id || c.source_location_id !== c.target_location_id;

    // 1. Primary products (parent pools)
    for (const p of yieldProfiles) {
      map.set(p.product_id, GRILLER_YIELD * p.yield_percentage);
    }

    // 2a. Putten→Putten cut children (no normalization, skip loss products)
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
        map.set(chain.child_product_id,
          existing + GRILLER_YIELD * parentProfile.yield_percentage * effectiveChildYield);
      }
    }

    // 3. Variant fallback
    const categoryYield = new Map<string, number>();
    for (const prod of products) {
      if (prod.category && map.has(prod.id)) {
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

  function hasYield(prodId: string): boolean {
    return productYieldMap.has(prodId);
  }

  function getLineKg(line: NewLine): number {
    if (line.mode === 'kg') return parseFloat(line.quantityKg) || 0;
    const birdCount = parseInt(line.birds) || 0;
    if (!line.productId || birdCount <= 0) return 0;
    const yld = productYieldMap.get(line.productId);
    if (!yld) return 0;
    return birdCount * avgBirdWeightKg * yld;
  }

  function updateNewLine(index: number, field: keyof NewLine, value: string) {
    setNewLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function toggleNewLineMode(index: number) {
    setNewLines((prev) => {
      const next = [...prev];
      const line = next[index];
      if (line.mode === 'birds') {
        const kg = getLineKg(line);
        next[index] = { ...line, mode: 'kg', quantityKg: kg > 0 ? String(Math.round(kg * 10) / 10) : line.quantityKg };
      } else {
        const kg = parseFloat(line.quantityKg) || 0;
        const yld = line.productId ? productYieldMap.get(line.productId) : undefined;
        let birds = '';
        if (kg > 0 && yld && yld > 0) birds = String(Math.round(kg / (avgBirdWeightKg * yld)));
        next[index] = { ...line, mode: 'birds', birds: birds || line.birds };
      }
      return next;
    });
  }

  function removeNewLine(index: number) {
    setNewLines((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  }

  function addNewLineRow() {
    setNewLines((prev) => [...prev, EMPTY_NEW_LINE()]);
  }

  // Submit ALL new lines at once
  function handleBatchAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validLines = newLines
      .filter((l) => l.productId)
      .map((l) => ({ productId: l.productId, kg: getLineKg(l) }))
      .filter((l) => l.kg > 0);

    if (validLines.length === 0) {
      setError('Vul minimaal één productregel in');
      return;
    }

    startTransition(async () => {
      try {
        // Add lines sequentially (server actions recalculate totals each time)
        for (const line of validLines) {
          await addOrderLine(orderId, line.productId, line.kg);
        }
        setNewLines([EMPTY_NEW_LINE()]);
        onLinesChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij toevoegen');
      }
    });
  }

  function handleRemove(lineId: string) {
    setConfirmDeleteId(null);
    startTransition(async () => {
      try {
        await removeOrderLine(lineId);
        onLinesChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij verwijderen');
      }
    });
  }

  const startEditing = useCallback((lineId: string, currentKg: number) => {
    setEditingLineId(lineId);
    setEditValue(String(currentKg));
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingLineId(null);
    setEditValue('');
  }, []);

  const saveEditing = useCallback((lineId: string, nextLineId?: string) => {
    const kg = parseFloat(editValue);
    if (isNaN(kg) || kg <= 0) { cancelEditing(); return; }
    startTransition(async () => {
      try {
        await updateOrderLine(lineId, kg);
        setEditingLineId(null);
        setEditValue('');
        if (nextLineId) {
          const nextLine = lines.find((l) => l.id === nextLineId);
          if (nextLine) startEditing(nextLineId, nextLine.quantity_kg);
        }
        onLinesChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij opslaan');
      }
    });
  }, [editValue, cancelEditing, startEditing, lines, onLinesChanged]);

  function handleEditKeyDown(e: React.KeyboardEvent, lineId: string, lineIndex: number) {
    if (e.key === 'Enter') { e.preventDefault(); saveEditing(lineId); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
    else if (e.key === 'Tab') { e.preventDefault(); saveEditing(lineId, lines[lineIndex + 1]?.id); }
  }

  const confirmLine = confirmDeleteId ? lines.find((l) => l.id === confirmDeleteId) : null;

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-main)',
  };

  const batchTotalKg = newLines.reduce((s, l) => s + getLineKg(l), 0);

  return (
    <div className="space-y-3">
      {/* Existing lines */}
      {lines.length > 0 && (
        <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
          {lines.map((line, index) => (
            <div
              key={line.id}
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: index < lines.length - 1 ? '1px solid var(--color-border-subtle)' : undefined }}
            >
              <div className="text-sm flex items-center gap-2">
                <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>
                  {line.product_name}
                </span>
                {editingLineId === line.id ? (
                  <input
                    ref={editInputRef}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, line.id, index)}
                    onBlur={() => saveEditing(line.id)}
                    className="w-20 text-right rounded px-2 py-0.5 text-sm focus:ring-1 focus:ring-orange-500"
                    style={{ ...inputStyle, borderColor: 'var(--color-oil-orange)' }}
                    disabled={isPending}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(line.id, line.quantity_kg)}
                    className="ml-1 cursor-pointer tabular-nums transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Klik om te bewerken"
                  >
                    {line.quantity_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(line.id)}
                disabled={isPending}
                className="text-xs disabled:opacity-50"
                style={{ color: 'var(--color-data-red)' }}
              >
                Verwijder
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && confirmLine && (
        <div className="rounded-md p-3 flex items-center justify-between" style={{ background: 'rgba(225, 29, 72, 0.08)', border: '1px solid rgba(225, 29, 72, 0.2)' }}>
          <span className="text-sm" style={{ color: 'var(--color-data-red)' }}>
            Verwijderen? ({confirmLine.quantity_kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg {confirmLine.product_name})
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 text-xs rounded" style={{ color: 'var(--color-text-muted)' }}>Annuleren</button>
            <button type="button" onClick={() => handleRemove(confirmDeleteId)} disabled={isPending} className="px-2 py-1 text-xs text-white rounded disabled:opacity-50" style={{ background: 'var(--color-data-red)' }}>Verwijderen</button>
          </div>
        </div>
      )}

      {/* ── Batch add form — multiple lines at once ── */}
      <form onSubmit={handleBatchAdd} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Regels toevoegen</span>
          <button
            type="button"
            onClick={addNewLineRow}
            className="text-xs font-medium px-2 py-0.5 rounded transition-colors"
            style={{ color: 'var(--color-oil-orange)', background: 'rgba(246, 126, 32, 0.1)' }}
          >
            + Regel
          </button>
        </div>

        {/* Column headers */}
        <div className="flex gap-2 items-center px-0.5">
          <span className="flex-1 text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-dim)' }}>Product</span>
          <span className="w-14 text-[10px] uppercase tracking-wider font-medium text-center" style={{ color: 'var(--color-text-dim)' }}>Modus</span>
          <span className="w-20 text-[10px] uppercase tracking-wider font-medium text-right" style={{ color: 'var(--color-text-dim)' }}>Aantal</span>
          <span className="w-20 text-[10px] uppercase tracking-wider font-medium text-right" style={{ color: 'var(--color-text-dim)' }}>= kg</span>
          <span className="w-5" />
        </div>

        <div className="space-y-1.5">
          {newLines.map((nl, index) => {
            const nlHasYield = nl.productId ? hasYield(nl.productId) : true;
            const nlKg = getLineKg(nl);
            return (
              <div key={index} className="flex gap-2 items-center">
                <select
                  value={nl.productId}
                  onChange={(e) => {
                    updateNewLine(index, 'productId', e.target.value);
                    if (e.target.value && !hasYield(e.target.value)) {
                      setNewLines((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], productId: e.target.value, mode: 'kg' };
                        return next;
                      });
                    }
                  }}
                  className="flex-1 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-500"
                  style={inputStyle}
                  disabled={isPending}
                >
                  <option value="">-- Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => nlHasYield ? toggleNewLineMode(index) : undefined}
                  className="w-14 rounded-md px-1 py-1.5 text-xs font-medium text-center transition-colors"
                  style={{
                    background: nl.mode === 'birds' && nlHasYield ? 'rgba(246, 126, 32, 0.15)' : 'var(--color-bg-elevated)',
                    border: '1px solid ' + (nl.mode === 'birds' && nlHasYield ? 'rgba(246, 126, 32, 0.4)' : 'var(--color-border-subtle)'),
                    color: nl.mode === 'birds' && nlHasYield ? 'var(--color-oil-orange)' : 'var(--color-text-muted)',
                    cursor: nlHasYield ? 'pointer' : 'default',
                    opacity: nlHasYield ? 1 : 0.5,
                  }}
                  disabled={isPending}
                >
                  {nl.mode === 'birds' && nlHasYield ? 'Kippen' : 'kg'}
                </button>

                {nl.mode === 'birds' && nlHasYield ? (
                  <input
                    type="number" step="1" min="1"
                    value={nl.birds}
                    onChange={(e) => updateNewLine(index, 'birds', e.target.value)}
                    placeholder="aantal"
                    className="w-20 rounded-md px-2 py-1.5 text-sm text-right font-mono focus:ring-1 focus:ring-orange-500"
                    style={inputStyle}
                    disabled={isPending}
                  />
                ) : (
                  <input
                    type="number" step="0.1" min="0.1"
                    value={nl.quantityKg}
                    onChange={(e) => updateNewLine(index, 'quantityKg', e.target.value)}
                    placeholder="kg"
                    className="w-20 rounded-md px-2 py-1.5 text-sm text-right font-mono focus:ring-1 focus:ring-orange-500"
                    style={inputStyle}
                    disabled={isPending}
                  />
                )}

                <div className="w-20 text-right">
                  {nlKg > 0 ? (
                    <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                      {nlKg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>&mdash;</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeNewLine(index)}
                  disabled={isPending || newLines.length <= 1}
                  className="w-5 text-xs rounded transition-colors disabled:opacity-30"
                  style={{ color: 'var(--color-data-red)' }}
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>

        {/* Batch total + submit */}
        <div className="flex items-center justify-between pt-1">
          {batchTotalKg > 0 ? (
            <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-oil-orange)' }}>
              Totaal: {batchTotalKg.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kg
            </span>
          ) : <span />}
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-oil-orange)' }}
          >
            {isPending ? 'Bezig...' : 'Toevoegen'}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-data-red)' }}>{error}</p>
      )}
    </div>
  );
}
