'use client';

import type { MassBalanceStatus } from '@/lib/data/demo-batch-v2';

interface Props {
  status: MassBalanceStatus;
  deviationPct: number;
  size?: 'sm' | 'lg';
}

const STATUS_CONFIG: Record<MassBalanceStatus, { emoji: string; label: string; bg: string; text: string }> = {
  green:  { emoji: '\uD83D\uDFE2', label: 'OK',            bg: 'bg-green-50',  text: 'text-green-800' },
  yellow: { emoji: '\uD83D\uDFE1', label: 'Waarschuwing',   bg: 'bg-yellow-50', text: 'text-yellow-800' },
  red:    { emoji: '\u26D4',        label: 'Geblokkeerd',    bg: 'bg-red-50',    text: 'text-red-800' },
};

export function MassBalanceIndicator({ status, deviationPct, size = 'sm' }: Props) {
  const config = STATUS_CONFIG[status];

  if (size === 'lg') {
    return (
      <div>
        <div className={`text-xl font-bold ${config.text}`}>
          {config.emoji} {deviationPct.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-500">{config.label}</div>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.emoji} {deviationPct.toFixed(1)}% — {config.label}
    </span>
  );
}
