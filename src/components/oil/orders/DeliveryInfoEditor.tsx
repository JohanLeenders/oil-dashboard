'use client';

/**
 * DeliveryInfoEditor — Per-customer delivery info (address, transport, delivery days)
 *
 * Wave 12: Auto-calculates delivery days from slaughter date:
 *   - Putten products: slaughter date + 1 day
 *   - Nijkerk products: slaughter date + 2 days
 */

import { useState, useCallback, useMemo } from 'react';
import { upsertDeliveryInfo } from '@/lib/actions/delivery-info';
import type { CustomerDeliveryInfo } from '@/types/database';

interface CustomerDeliveryRow extends CustomerDeliveryInfo {
  customer_name: string;
}

interface DeliveryInfoEditorProps {
  customerIds: string[];
  customerNames: Record<string, string>;
  initialData: CustomerDeliveryRow[];
  slaughterDate?: string; // ISO date string, e.g. "2026-04-28"
}

const DAY_NAMES_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'] as const;

/** Format a date offset from slaughter date into a human-readable string */
function getDeliveryDateInfo(slaughterDate: string | undefined, offsetDays: number): { dayName: string; dateStr: string } | null {
  if (!slaughterDate) return null;
  const d = new Date(slaughterDate + 'T12:00:00'); // noon to avoid timezone issues
  d.setDate(d.getDate() + offsetDays);
  const dayName = DAY_NAMES_NL[d.getDay()];
  const dateStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  return { dayName, dateStr };
}

export default function DeliveryInfoEditor({
  customerIds,
  customerNames,
  initialData,
  slaughterDate,
}: DeliveryInfoEditorProps) {
  const [rows, setRows] = useState<Record<string, Partial<CustomerDeliveryRow>>>(() => {
    const map: Record<string, Partial<CustomerDeliveryRow>> = {};
    for (const row of initialData) {
      map[row.customer_id] = row;
    }
    for (const id of customerIds) {
      if (!map[id]) {
        map[id] = {
          customer_id: id,
          customer_name: customerNames[id] ?? '',
          delivery_address: '',
          transport_by_koops: false,
          putten_delivery_day: null,
          nijkerk_delivery_day: null,
        };
      }
    }
    return map;
  });

  const [saving, setSaving] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  // Compute delivery day info from slaughter date
  const puttenDelivery = useMemo(() => getDeliveryDateInfo(slaughterDate, 1), [slaughterDate]);
  const nijkerkDelivery = useMemo(() => getDeliveryDateInfo(slaughterDate, 2), [slaughterDate]);

  const handleSave = useCallback(async (customerId: string, field: string, value: unknown) => {
    setSaving(customerId);
    try {
      await upsertDeliveryInfo(customerId, { [field]: value });
      setRows((prev) => ({
        ...prev,
        [customerId]: { ...prev[customerId], [field]: value },
      }));
    } catch {
      // Keep previous value on error
    } finally {
      setSaving(null);
    }
  }, []);

  if (customerIds.length === 0) return null;

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-main)',
  };

  return (
    <div className="oil-card overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold transition-colors"
        style={{ color: 'var(--color-text-main)' }}
      >
        <span>Bezorginfo ({customerIds.length} klanten)</span>
        <span style={{ color: 'var(--color-text-dim)' }}>{collapsed ? '\u25B8' : '\u25BE'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Computed delivery dates */}
          {(puttenDelivery || nijkerkDelivery) && (
            <div className="flex gap-4 text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {puttenDelivery && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-oil-orange)' }} />
                  <span>Putten bezorging:</span>
                  <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {puttenDelivery.dayName} {puttenDelivery.dateStr}
                  </span>
                  <span>(slacht+1)</span>
                </div>
              )}
              {nijkerkDelivery && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Nijkerk bezorging:</span>
                  <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {nijkerkDelivery.dayName} {nijkerkDelivery.dateStr}
                  </span>
                  <span>(slacht+2)</span>
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th className="py-2 pr-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-dim)' }}>Klant</th>
                  <th className="py-2 pr-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-dim)' }}>Afleveradres</th>
                  <th className="py-2 pr-3 text-center text-xs font-medium" style={{ color: 'var(--color-text-dim)' }}>Koops?</th>
                  <th className="py-2 pr-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-dim)' }}>
                    Bezorgdag Putten
                    {puttenDelivery && (
                      <span className="ml-1 font-normal" style={{ color: 'var(--color-text-dim)' }}>
                        ({puttenDelivery.dayName} {puttenDelivery.dateStr})
                      </span>
                    )}
                  </th>
                  <th className="py-2 pr-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-dim)' }}>
                    Bezorgdag Nijkerk
                    {nijkerkDelivery && (
                      <span className="ml-1 font-normal" style={{ color: 'var(--color-text-dim)' }}>
                        ({nijkerkDelivery.dayName} {nijkerkDelivery.dateStr})
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {customerIds.map((cid) => {
                  const row = rows[cid] ?? {};
                  const isSaving = saving === cid;
                  return (
                    <tr
                      key={cid}
                      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    >
                      <td className="py-2 pr-3 font-medium whitespace-nowrap" style={{ color: 'var(--color-text-main)' }}>
                        {customerNames[cid] ?? cid.slice(0, 8)}
                        {isSaving && (
                          <span className="ml-1 text-xs animate-pulse" style={{ color: 'var(--color-oil-orange)' }}>...</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          defaultValue={row.delivery_address ?? ''}
                          onBlur={(e) => {
                            if (e.target.value !== (row.delivery_address ?? '')) {
                              handleSave(cid, 'delivery_address', e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="w-full px-2 py-1 text-sm rounded focus:ring-1 focus:ring-orange-500"
                          style={inputStyle}
                          placeholder="Adres..."
                        />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.transport_by_koops ?? false}
                          onChange={(e) => handleSave(cid, 'transport_by_koops', e.target.checked)}
                          className="rounded"
                          style={{ accentColor: 'var(--color-oil-orange)' }}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.putten_delivery_day ?? (puttenDelivery?.dayName ?? '')}
                          onChange={(e) =>
                            handleSave(cid, 'putten_delivery_day', e.target.value || null)
                          }
                          className="w-full px-2 py-1 text-sm rounded focus:ring-1 focus:ring-orange-500"
                          style={inputStyle}
                        >
                          <option value="">&mdash;</option>
                          {DAY_NAMES_NL.filter(d => d !== 'zondag' && d !== 'zaterdag').map((d) => (
                            <option key={d} value={d}>
                              {d.charAt(0).toUpperCase() + d.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.nijkerk_delivery_day ?? (nijkerkDelivery?.dayName ?? '')}
                          onChange={(e) =>
                            handleSave(cid, 'nijkerk_delivery_day', e.target.value || null)
                          }
                          className="w-full px-2 py-1 text-sm rounded focus:ring-1 focus:ring-orange-500"
                          style={inputStyle}
                        >
                          <option value="">&mdash;</option>
                          {DAY_NAMES_NL.filter(d => d !== 'zondag' && d !== 'zaterdag').map((d) => (
                            <option key={d} value={d}>
                              {d.charAt(0).toUpperCase() + d.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
