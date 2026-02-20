/**
 * AvailabilityProgressBar — Horizontal bar showing ordered vs available kg
 *
 * Green fill for ordered %, gray for remaining. Red overshoot if > 100%.
 */

interface AvailabilityProgressBarProps {
  availableKg: number;
  orderedKg: number;
  compact?: boolean;
}

export function AvailabilityProgressBar({
  availableKg,
  orderedKg,
  compact = false,
}: AvailabilityProgressBarProps) {
  const pct = availableKg > 0 ? (orderedKg / availableKg) * 100 : 0;
  const clamped = Math.min(pct, 100);
  const overshoot = pct > 100;

  const barColor = overshoot
    ? 'var(--color-data-red)'
    : pct >= 80
      ? 'var(--color-data-green)'
      : pct >= 50
        ? 'var(--color-oil-orange)'
        : 'var(--color-text-dim)';

  return (
    <div className={compact ? '' : 'space-y-1'}>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height: compact ? '6px' : '8px',
          background: 'var(--color-bg-elevated)',
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${clamped}%`,
            background: barColor,
          }}
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          <span>{Math.round(pct)}% verkocht</span>
          <span>{orderedKg.toLocaleString('nl-NL')} / {availableKg.toLocaleString('nl-NL')} kg</span>
        </div>
      )}
    </div>
  );
}
