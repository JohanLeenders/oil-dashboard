/**
 * DataBadge — Small status indicators (Design Directive)
 */

interface DataBadgeProps {
  label: string;
  variant: 'green' | 'orange' | 'red' | 'gold' | 'muted';
  size?: 'sm' | 'md';
  icon?: string;
}

const VARIANT_CLASSES = {
  green: 'badge-green',
  orange: 'badge-orange',
  red: 'badge-red',
  gold: 'badge-gold',
  muted: 'badge-gray',
} as const;

export function DataBadge({ label, variant, size = 'sm', icon }: DataBadgeProps) {
  return (
    <span className={`badge ${VARIANT_CLASSES[variant]} ${size === 'md' ? 'px-3 py-1 text-sm' : ''}`}>
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </span>
  );
}
