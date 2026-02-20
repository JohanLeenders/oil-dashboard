/**
 * Order & Slaughter status configuration — Wave 9
 *
 * Centralizes status labels, colors, and icons for consistent display.
 */

export const ORDER_STATUS_CONFIG = {
  draft:     { label: 'Concept',     color: 'muted'  as const, icon: '✎' },
  submitted: { label: 'Ingediend',   color: 'orange' as const, icon: '→' },
  confirmed: { label: 'Bevestigd',   color: 'green'  as const, icon: '✓' },
  cancelled: { label: 'Geannuleerd', color: 'red'    as const, icon: '✗' },
} as const;

export const SLAUGHTER_STATUS_CONFIG = {
  planned:      { label: 'Gepland',      color: 'muted'  as const, icon: '📅' },
  orders_open:  { label: 'Orders open',  color: 'orange' as const, icon: '🔓' },
  finalized:    { label: 'Definitief',   color: 'gold'   as const, icon: '🔒' },
  slaughtered:  { label: 'Geslacht',     color: 'green'  as const, icon: '✓' },
  completed:    { label: 'Afgerond',     color: 'green'  as const, icon: '✓✓' },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_CONFIG;
export type SlaughterStatus = keyof typeof SLAUGHTER_STATUS_CONFIG;
