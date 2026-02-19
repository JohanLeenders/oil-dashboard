'use client';

/**
 * MixComparisonBar — Horizontale vergelijkingsbalk
 *
 * Toont klant-percentage vs anatomische norm als twee balken,
 * met kleur-codering voor over/under/balanced.
 */

interface Props {
  label: string;
  customerPct: number;
  anatomicalPct: number;
  maxPct?: number; // Schaal, default 50
}

export function MixComparisonBar({
  label,
  customerPct,
  anatomicalPct,
  maxPct = 50,
}: Props) {
  const deviation = customerPct - anatomicalPct;
  const isOver = deviation > 5;
  const isUnder = deviation < -5;

  const barColor = isOver
    ? 'bg-red-500'
    : isUnder
      ? 'bg-blue-400'
      : 'bg-green-500';

  const normColor = 'bg-gray-300 dark:bg-gray-600';

  const customerWidth = Math.min((customerPct / maxPct) * 100, 100);
  const normWidth = Math.min((anatomicalPct / maxPct) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700 dark:text-gray-300 w-24 truncate">
          {label}
        </span>
        <span className={`text-xs font-mono ${
          isOver ? 'text-red-600' : isUnder ? 'text-blue-500' : 'text-green-600'
        }`}>
          {customerPct.toFixed(1)}%
          {deviation !== 0 && (
            <span className="text-gray-400 ml-1">
              ({deviation > 0 ? '+' : ''}{deviation.toFixed(1)})
            </span>
          )}
        </span>
      </div>
      <div className="relative h-4 w-full">
        {/* Anatomische norm (achtergrond) */}
        <div
          className={`absolute inset-y-0 left-0 ${normColor} rounded-sm opacity-50`}
          style={{ width: `${normWidth}%` }}
        />
        {/* Klant percentage (voorgrond) */}
        <div
          className={`absolute inset-y-0 left-0 ${barColor} rounded-sm`}
          style={{ width: `${customerWidth}%`, opacity: 0.85 }}
        />
        {/* Norm marker lijn */}
        {anatomicalPct > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-gray-800 dark:bg-white z-10"
            style={{ left: `${normWidth}%` }}
            title={`Anatomische norm: ${anatomicalPct}%`}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>0%</span>
        <span>norm: {anatomicalPct}%</span>
      </div>
    </div>
  );
}
