'use client';

/**
 * OilModal — Frosted glass modal overlay for drill-down views (UX-5)
 *
 * - Full-screen overlay with backdrop-filter: blur(20px)
 * - Content area uses oil-card glassmorphism
 * - Close on Escape, click-outside, or X button
 * - Smooth open/close animation (opacity + scale)
 */

import { useEffect, useRef, useCallback, type ReactNode } from 'react';

interface OilModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'full';
}

const SIZE_CLASSES: Record<string, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export default function OilModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'lg',
}: OilModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click-outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(0, 0, 0, 0.6)',
        animation: 'oil-modal-overlay-in 200ms ease-out',
      }}
    >
      <div
        ref={contentRef}
        className={`w-full ${SIZE_CLASSES[size]} max-h-[90vh] overflow-y-auto`}
        style={{
          background: 'var(--color-bg-card)',
          backdropFilter: 'blur(var(--blur-glass))',
          WebkitBackdropFilter: 'blur(var(--blur-glass))',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          animation: 'oil-modal-content-in 200ms ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
        >
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--color-text-main)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-dim)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-elevated)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-main)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-dim)';
            }}
            aria-label="Sluiten"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
