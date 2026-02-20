/**
 * OilCard — Glassmorphism card component (Design Directive)
 *
 * CSS recipe: frosted glass on dark background with 12px radius, 1px hairline border.
 */

import type { ReactNode } from 'react';

interface OilCardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: ReactNode;
  headerAction?: ReactNode;
  interactive?: boolean;
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export function OilCard({
  children,
  className = '',
  padding = 'md',
  header,
  headerAction,
  interactive = false,
}: OilCardProps) {
  return (
    <div
      className={`oil-card ${interactive ? 'oil-card-interactive' : ''} ${className}`}
    >
      {header && (
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {header}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={PADDING[padding]}>{children}</div>
    </div>
  );
}
