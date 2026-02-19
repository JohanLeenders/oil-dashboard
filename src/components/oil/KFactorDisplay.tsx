'use client';

interface Props {
  kFactor: number;
  interpretation: 'PROFITABLE' | 'BREAK_EVEN' | 'LOSS';
  size?: 'sm' | 'lg';
}

function getBadgeClass(interpretation: string): string {
  switch (interpretation) {
    case 'PROFITABLE': return 'bg-green-100 text-green-800';
    case 'BREAK_EVEN': return 'bg-yellow-100 text-yellow-800';
    case 'LOSS': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
  }
}

function getLabel(interpretation: string): string {
  switch (interpretation) {
    case 'PROFITABLE': return 'Winstgevend';
    case 'BREAK_EVEN': return 'Break-even';
    case 'LOSS': return 'Verliesgevend';
    default: return interpretation;
  }
}

export function KFactorDisplay({ kFactor, interpretation, size = 'sm' }: Props) {
  const badgeClass = getBadgeClass(interpretation);

  if (size === 'lg') {
    return (
      <div>
        <div className={`inline-flex items-center px-2 py-0.5 rounded text-xl font-bold ${badgeClass}`}>
          {kFactor.toFixed(4)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">{getLabel(interpretation)}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-500">k:</span>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
        {kFactor.toFixed(4)}
      </span>
    </div>
  );
}
