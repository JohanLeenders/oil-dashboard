/**
 * THT (Tenminste Houdbaar Tot) Status Engine
 *
 * Blueprint Spec (DEFINITIEF):
 * - Groen: < 70% verstreken
 * - Oranje: 70-90% verstreken
 * - Rood: > 90% verstreken
 */

import type { ThtStatus } from '@/types/database';

// ============================================================================
// TYPES
// ============================================================================

export interface ThtCalculation {
  /** Status kleur */
  status: ThtStatus;
  /** Percentage verstreken */
  elapsed_pct: number;
  /** Dagen over */
  days_remaining: number;
  /** Totale houdbaarheid in dagen */
  total_days: number;
  /** Dagen verstreken */
  days_elapsed: number;
  /** Is verlopen? */
  is_expired: boolean;
  /** Urgentie label */
  urgency_label: string;
}

export interface ThtThresholds {
  /** Grens voor oranje (default: 70 per Blueprint) */
  orange_pct: number;
  /** Grens voor rood (default: 90 per Blueprint) */
  red_pct: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Blueprint Spec Thresholds:
 * - Green: < 70%
 * - Orange: 70-90%
 * - Red: > 90%
 */
export const DEFAULT_THT_THRESHOLDS: ThtThresholds = {
  orange_pct: 70,
  red_pct: 90,
};

// ============================================================================
// CORE ENGINE
// ============================================================================

/**
 * Bereken THT status voor een product/batch
 *
 * @param productionDate - Productie datum
 * @param expiryDate - THT datum
 * @param checkDate - Datum om te checken (default: vandaag)
 * @param thresholds - Thresholds voor oranje/rood
 *
 * @example
 * ```ts
 * const tht = calculateThtStatus(
 *   new Date('2026-01-15'),
 *   new Date('2026-02-15'),
 *   new Date('2026-01-27') // 12 dagen van 31 = 38.7% verstreken
 * );
 * // Returns: { status: 'green', elapsed_pct: 38.7, ... }
 * ```
 */
export function calculateThtStatus(
  productionDate: Date | string,
  expiryDate: Date | string,
  checkDate: Date | string = new Date(),
  thresholds: ThtThresholds = DEFAULT_THT_THRESHOLDS
): ThtCalculation {
  // Converteer naar Date objecten
  const production = new Date(productionDate);
  const expiry = new Date(expiryDate);
  const check = new Date(checkDate);

  // Reset tijd naar middernacht voor consistente berekening
  production.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  check.setHours(0, 0, 0, 0);

  // Bereken dagen
  const totalDays = Math.ceil(
    (expiry.getTime() - production.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysElapsed = Math.ceil(
    (check.getTime() - production.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = Math.ceil(
    (expiry.getTime() - check.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Edge cases
  if (totalDays <= 0) {
    return {
      status: 'red',
      elapsed_pct: 100,
      days_remaining: 0,
      total_days: 0,
      days_elapsed: 0,
      is_expired: true,
      urgency_label: 'Ongeldige THT data',
    };
  }

  // Bereken percentage verstreken
  const elapsedPct = (daysElapsed / totalDays) * 100;
  const isExpired = daysRemaining < 0;

  // Bepaal status
  let status: ThtStatus;
  let urgencyLabel: string;

  if (isExpired) {
    status = 'red';
    urgencyLabel = 'VERLOPEN';
  } else if (elapsedPct >= thresholds.red_pct) {
    status = 'red';
    urgencyLabel = `URGENT: ${daysRemaining} dagen resterend`;
  } else if (elapsedPct >= thresholds.orange_pct) {
    status = 'orange';
    urgencyLabel = `Aandacht: ${daysRemaining} dagen resterend`;
  } else {
    status = 'green';
    urgencyLabel = `${daysRemaining} dagen resterend`;
  }

  return {
    status,
    elapsed_pct: Number(elapsedPct.toFixed(1)),
    days_remaining: Math.max(0, daysRemaining),
    total_days: totalDays,
    days_elapsed: Math.max(0, daysElapsed),
    is_expired: isExpired,
    urgency_label: urgencyLabel,
  };
}

/**
 * Bereken THT status voor meerdere batches
 */
export function calculateBatchThtStatuses(
  batches: Array<{
    id: string;
    batch_ref: string;
    production_date: string | null;
    expiry_date: string | null;
  }>,
  checkDate: Date = new Date()
): Map<string, ThtCalculation> {
  const results = new Map<string, ThtCalculation>();

  for (const batch of batches) {
    if (!batch.production_date || !batch.expiry_date) {
      results.set(batch.id, {
        status: 'green',
        elapsed_pct: 0,
        days_remaining: 999,
        total_days: 999,
        days_elapsed: 0,
        is_expired: false,
        urgency_label: 'Geen THT data',
      });
      continue;
    }

    results.set(
      batch.id,
      calculateThtStatus(batch.production_date, batch.expiry_date, checkDate)
    );
  }

  return results;
}

/**
 * Filter batches op THT status
 */
export function filterBatchesByThtStatus(
  batches: Array<{
    id: string;
    batch_ref: string;
    production_date: string | null;
    expiry_date: string | null;
  }>,
  status: ThtStatus | ThtStatus[],
  checkDate: Date = new Date()
): typeof batches {
  const statusArray = Array.isArray(status) ? status : [status];
  const thtMap = calculateBatchThtStatuses(batches, checkDate);

  return batches.filter(batch => {
    const tht = thtMap.get(batch.id);
    return tht && statusArray.includes(tht.status);
  });
}

/**
 * Krijg THT kleur als CSS class
 */
export function getThtColorClass(status: ThtStatus): string {
  const colors: Record<ThtStatus, string> = {
    green: 'bg-status-green text-white',
    orange: 'bg-status-orange text-white',
    red: 'bg-status-red text-white',
  };
  return colors[status];
}

/**
 * Krijg THT kleur als hex waarde
 */
export function getThtColor(status: ThtStatus): string {
  const colors: Record<ThtStatus, string> = {
    green: '#22c55e',
    orange: '#f97316',
    red: '#ef4444',
  };
  return colors[status];
}
