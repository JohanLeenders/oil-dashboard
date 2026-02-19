'use client';

import { useState } from 'react';
import type { OverrideEvent } from '@/lib/data/demo-batch-v2';
import { formatPct } from '@/lib/data/demo-batch-v2';

interface Props {
  batchId: string;
  deviationPct: number;
  onConfirm: (event: OverrideEvent) => void;
  onCancel: () => void;
}

type Duration = '1h' | '4h' | 'end_of_day';

function calculateExpiry(duration: Duration): string {
  const now = new Date();
  switch (duration) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case '4h':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    case 'end_of_day': {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end.toISOString();
    }
  }
}

const DURATION_LABELS: Record<Duration, string> = {
  '1h': '1 uur',
  '4h': '4 uur',
  'end_of_day': 'Tot einde dag',
};

export function AdminOverrideModal({
  batchId,
  deviationPct,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<Duration>('1h');
  const [acknowledged, setAcknowledged] = useState(false);

  const canConfirm = reason.trim().length > 0 && acknowledged;

  const handleConfirm = () => {
    if (!canConfirm) return;

    const event: OverrideEvent = {
      timestamp: new Date().toISOString(),
      batch_id: batchId,
      deviation_pct: deviationPct,
      reason: reason.trim(),
      duration,
      expires_at: calculateExpiry(duration),
      user: 'admin',
    };

    onConfirm(event);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          Admin Override
        </h3>

        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">
            Massabalansafwijking: <strong>{formatPct(deviationPct)}</strong> (boven 7,5% drempel)
          </p>
          <p className="text-xs text-red-600 mt-1">
            Batch <strong>{batchId}</strong> is geblokkeerd voor scenario-analyse en NRV check.
          </p>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-600 mb-1">
            Reden voor override
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Bijv. 'Handmatige correctie in verwerking, afwijking is verwacht'"
            rows={3}
            className="w-full border border-gray-300 dark:border-gray-500 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
          />
        </div>

        {/* Duration */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-600 mb-1">
            Duur override
          </label>
          <div className="flex gap-2">
            {(Object.keys(DURATION_LABELS) as Duration[]).map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex-1 py-1.5 px-3 text-sm rounded-lg border transition-colors ${
                  duration === d
                    ? 'bg-orange-100 border-orange-300 text-orange-800 font-medium'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-600 hover:bg-gray-50 dark:bg-gray-900'
                }`}
              >
                {DURATION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Acknowledgment */}
        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 dark:border-gray-500"
          />
          <span className="text-xs text-gray-600 dark:text-gray-600">
            Ik begrijp dat deze override wordt gelogd en dat scenario-resultaten bij een hoge
            massabalansafwijking minder betrouwbaar zijn.
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-lg text-sm text-gray-700 dark:text-gray-600 hover:bg-gray-50 dark:bg-gray-900 transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              canConfirm
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-200 dark:bg-gray-900 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            Override activeren
          </button>
        </div>
      </div>
    </div>
  );
}
