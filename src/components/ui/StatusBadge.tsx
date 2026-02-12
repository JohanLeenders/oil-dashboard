/**
 * Status Badge Component
 *
 * REGRESSIE-CHECK:
 * - ✅ Geen aannames over thresholds (alleen kleuren)
 * - ✅ Read-only presentatie
 */

import type { ThtStatus } from '@/types/database';

interface StatusBadgeProps {
  status: ThtStatus | 'COMPLETE' | 'NEEDS_REVIEW' | 'HAS_CORRECTIONS';
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  const statusConfig: Record<string, { bg: string; text: string; defaultLabel: string }> = {
    // THT statuses (Blueprint: 70/90)
    green: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      defaultLabel: 'OK',
    },
    orange: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      defaultLabel: 'Aandacht',
    },
    red: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      defaultLabel: 'Urgent',
    },
    // Data statuses
    COMPLETE: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      defaultLabel: 'Compleet',
    },
    NEEDS_REVIEW: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      defaultLabel: 'Review nodig',
    },
    HAS_CORRECTIONS: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      defaultLabel: 'Gecorrigeerd',
    },
  };

  const config = statusConfig[status] || statusConfig.green;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}
    >
      {label || config.defaultLabel}
    </span>
  );
}

interface ThtBadgeProps {
  status: ThtStatus;
  daysRemaining: number;
  size?: 'sm' | 'md';
}

export function ThtBadge({ status, daysRemaining, size = 'md' }: ThtBadgeProps) {
  const label = daysRemaining === 999
    ? 'Geen THT'
    : daysRemaining === 0
      ? 'Verlopen'
      : `${daysRemaining}d`;

  return <StatusBadge status={status} label={label} size={size} />;
}

interface DataStatusBadgeProps {
  status: 'COMPLETE' | 'NEEDS_REVIEW' | 'HAS_CORRECTIONS';
  size?: 'sm' | 'md';
}

export function DataStatusBadge({ status, size = 'md' }: DataStatusBadgeProps) {
  return <StatusBadge status={status} size={size} />;
}
