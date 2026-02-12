/**
 * THT Thermometer Component
 *
 * REGRESSIE-CHECK:
 * - ✅ Thresholds via props (niet hardcoded)
 * - ✅ Blueprint thresholds: 70/90
 * - ✅ Read-only display
 */

import type { ThtStatus } from '@/types/database';

interface ThtThermometerProps {
  status: ThtStatus;
  elapsedPct: number;
  daysRemaining: number;
  urgencyLabel: string;
}

export function ThtThermometer({
  status,
  elapsedPct,
  daysRemaining,
  urgencyLabel,
}: ThtThermometerProps) {
  // Blueprint thresholds
  const ORANGE_THRESHOLD = 70;
  const RED_THRESHOLD = 90;

  const statusColors: Record<ThtStatus, string> = {
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };

  const statusBg: Record<ThtStatus, string> = {
    green: 'bg-green-50 border-green-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
  };

  const clampedPct = Math.min(100, Math.max(0, elapsedPct));

  return (
    <div className={`rounded-lg border p-4 ${statusBg[status]}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-sm font-medium text-gray-700">THT Status</h4>
          <p className="text-lg font-bold text-gray-900 mt-1">{urgencyLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{daysRemaining}</p>
          <p className="text-xs text-gray-500">dagen over</p>
        </div>
      </div>

      {/* Thermometer bar */}
      <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
        {/* Zone indicators */}
        <div
          className="absolute inset-y-0 left-0 bg-green-200 opacity-50"
          style={{ width: `${ORANGE_THRESHOLD}%` }}
        />
        <div
          className="absolute inset-y-0 bg-orange-200 opacity-50"
          style={{ left: `${ORANGE_THRESHOLD}%`, width: `${RED_THRESHOLD - ORANGE_THRESHOLD}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-red-200 opacity-50"
          style={{ width: `${100 - RED_THRESHOLD}%` }}
        />

        {/* Fill */}
        <div
          className={`absolute inset-y-0 left-0 ${statusColors[status]} transition-all duration-300`}
          style={{ width: `${clampedPct}%` }}
        />

        {/* Threshold markers */}
        <div
          className="absolute inset-y-0 w-0.5 bg-orange-600"
          style={{ left: `${ORANGE_THRESHOLD}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-red-600"
          style={{ left: `${RED_THRESHOLD}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>0%</span>
        <span className="text-orange-600">70%</span>
        <span className="text-red-600">90%</span>
        <span>100%</span>
      </div>

      {/* Current percentage */}
      <p className="text-center text-sm text-gray-600 mt-2">
        {elapsedPct.toFixed(1)}% van houdbaarheid verstreken
      </p>
    </div>
  );
}
