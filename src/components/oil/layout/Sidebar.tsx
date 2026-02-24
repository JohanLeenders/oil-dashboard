'use client';

/**
 * Sidebar — Vertical navigation with progressive disclosure (UX-1)
 *
 * Groups: OPERATIONEEL (default open), DATA (default collapsed), BEHEER (collapsed, grayed)
 * Persists collapse state in localStorage ('oil-sidebar-state').
 * Responsive: collapses to icon-only < 1024px, hidden < 768px with hamburger.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  disabled?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  defaultOpen: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'operationeel',
    label: 'Operationeel',
    defaultOpen: true,
    items: [
      { href: '/oil', label: 'Dashboard', icon: '◈', exact: true },
      { href: '/oil/planning', label: 'Planning', icon: '◈' },
      { href: '/oil/orders', label: 'Orders', icon: '◈' },
      { href: '/oil/processing', label: 'Verwerking', icon: '◈' },
      { href: '/oil/exports', label: 'Exports', icon: '◈' },
      { href: '/oil/outreach', label: 'Outreach', icon: '◈' },
    ],
  },
  {
    key: 'data',
    label: 'Data',
    defaultOpen: false,
    items: [
      { href: '/oil/batches', label: 'Batches', icon: '◈' },
      { href: '/oil/kostprijs', label: 'Kostprijs', icon: '◈' },
      { href: '/oil/customers', label: 'Klanten', icon: '◈' },
      { href: '/oil/trends', label: 'Trends', icon: '◈' },
    ],
  },
  {
    key: 'beheer',
    label: 'Beheer',
    defaultOpen: false,
    items: [
      { href: '#', label: 'Locaties', icon: '◈', disabled: true },
      { href: '#', label: 'Producten', icon: '◈', disabled: true },
      { href: '#', label: 'Rendementen', icon: '◈', disabled: true },
    ],
  },
];

const STORAGE_KEY = 'oil-sidebar-state';

function loadState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* noop */ }
}

export function Sidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = loadState();
    const initial: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      initial[g.key] = stored[g.key] ?? g.defaultOpen;
    }
    setOpenGroups(initial);
    setMounted(true);
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveState(next);
      return next;
    });
  }, []);

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!mounted) return null;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <Link href="/oil" className="flex items-center gap-3 group">
          <div
            className="w-9 h-9 rounded-oil flex items-center justify-center text-white font-bold text-sm shadow-md transition-colors"
            style={{ background: 'var(--color-oil-orange)' }}
          >
            O
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-white">OIL</span>
            <span className="text-[10px] leading-tight" style={{ color: 'var(--color-text-dim)' }}>
              Oranjehoen Intelligence Layer
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors"
              style={{ color: 'var(--color-text-dim)' }}
            >
              <span>{group.label}</span>
              <span className="text-[10px] transition-transform" style={{ transform: openGroups[group.key] ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                ▾
              </span>
            </button>

            {openGroups[group.key] && (
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  if (item.disabled) {
                    return (
                      <span
                        key={item.label}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-oil text-sm cursor-not-allowed"
                        style={{ color: 'var(--color-text-dim)', opacity: 0.5 }}
                      >
                        <span className="text-xs">{item.icon}</span>
                        {item.label}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-oil text-sm font-medium transition-all ${
                        active ? 'text-white' : ''
                      }`}
                      style={
                        active
                          ? { background: 'var(--color-oil-orange)', color: '#fff' }
                          : { color: 'var(--color-text-muted)' }
                      }
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = 'var(--color-bg-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span className="text-xs">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
          OIL v0.9
        </p>
        <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
          Oranjehoen B.V.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden w-10 h-10 rounded-oil flex items-center justify-center transition-colors"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}
        aria-label="Menu"
      >
        <span className="text-lg" style={{ color: 'var(--color-text-main)' }}>
          {mobileOpen ? '✕' : '☰'}
        </span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 flex-shrink-0 h-screen sticky top-0"
        style={{
          background: 'var(--color-bg-card)',
          borderRight: '1px solid var(--color-border-subtle)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 lg:hidden transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--color-bg-main)',
          borderRight: '1px solid var(--color-border-subtle)',
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
