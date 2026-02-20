'use client';

import { useState, useCallback } from 'react';
import { upsertDeliveryInfo } from '@/lib/actions/delivery-info';
import type { CustomerDeliveryInfo } from '@/types/database';

interface CustomerDeliveryRow extends CustomerDeliveryInfo {
  customer_name: string;
}

interface DeliveryInfoEditorProps {
  customerIds: string[];
  customerNames: Record<string, string>;
  initialData: CustomerDeliveryRow[];
}

const DAY_OPTIONS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'] as const;

export default function DeliveryInfoEditor({
  customerIds,
  customerNames,
  initialData,
}: DeliveryInfoEditorProps) {
  const [rows, setRows] = useState<Record<string, Partial<CustomerDeliveryRow>>>(() => {
    const map: Record<string, Partial<CustomerDeliveryRow>> = {};
    for (const row of initialData) {
      map[row.customer_id] = row;
    }
    // Ensure all customers with orders have a row
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

  const handleSave = useCallback(async (customerId: string, field: string, value: any) => {
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
      >
        <span>Bezorginfo ({customerIds.length} klanten)</span>
        <span className="text-gray-400">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-3 font-medium">Klant</th>
                <th className="py-2 pr-3 font-medium">Afleveradres</th>
                <th className="py-2 pr-3 font-medium">Koops?</th>
                <th className="py-2 pr-3 font-medium">Bezorgdag Putten</th>
                <th className="py-2 pr-3 font-medium">Bezorgdag Nijkerk</th>
              </tr>
            </thead>
            <tbody>
              {customerIds.map((cid) => {
                const row = rows[cid] ?? {};
                const isSaving = saving === cid;
                return (
                  <tr
                    key={cid}
                    className="border-b border-gray-100 dark:border-gray-700/50"
                  >
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {customerNames[cid] ?? cid.slice(0, 8)}
                      {isSaving && (
                        <span className="ml-1 text-xs text-blue-500 animate-pulse">...</span>
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
                        className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Adres..."
                      />
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.transport_by_koops ?? false}
                        onChange={(e) => handleSave(cid, 'transport_by_koops', e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={row.putten_delivery_day ?? ''}
                        onChange={(e) =>
                          handleSave(cid, 'putten_delivery_day', e.target.value || null)
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {DAY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={row.nijkerk_delivery_day ?? ''}
                        onChange={(e) =>
                          handleSave(cid, 'nijkerk_delivery_day', e.target.value || null)
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {DAY_OPTIONS.map((d) => (
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
      )}
    </div>
  );
}
