/**
 * KpiTile — Compact KPI display with monospace values (Design Directive)
 */

interface KpiTileProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: 'orange' | 'gold' | 'green' | 'red' | 'default';
  onClick?: () => void;
}

const COLOR_MAP = {
  orange: 'var(--color-oil-orange)',
  gold: 'var(--color-data-gold)',
  green: 'var(--color-data-green)',
  red: 'var(--color-data-red)',
  default: 'var(--color-text-main)',
} as const;

const TREND_ICONS = {
  up: '↑',
  down: '↓',
  flat: '→',
} as const;

export function KpiTile({
  label,
  value,
  unit,
  trend,
  trendValue,
  color = 'default',
  onClick,
}: KpiTileProps) {
  const valueColor = COLOR_MAP[color];
  const isClickable = !!onClick;

  return (
    <div
      className={`oil-card ${isClickable ? 'oil-card-interactive cursor-pointer' : ''} p-4`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter') onClick?.(); } : undefined}
    >
      <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-dim)' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono tabular-nums" style={{ color: valueColor }}>
          {value}
        </span>
        {unit && (
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{unit}</span>
        )}
      </div>
      {trend && trendValue && (
        <div className="mt-1 text-xs font-mono" style={{ color: trend === 'up' ? 'var(--color-data-green)' : trend === 'down' ? 'var(--color-data-red)' : 'var(--color-text-muted)' }}>
          {TREND_ICONS[trend]} {trendValue}
        </div>
      )}
    </div>
  );
}
