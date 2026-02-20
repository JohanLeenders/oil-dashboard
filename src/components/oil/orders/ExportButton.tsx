'use client';

/**
 * ExportButton — Storteboom Excel export with pre-flight checklist (UX-4)
 *
 * Wave 8: Full Storteboom-format export with simulator toggle.
 * Wave 9: Pre-flight "launch sequence" — validates before enabling export.
 *
 * REGRESSIE-CHECK:
 * - Pure client component, no DB access
 * - Uses exportStorteboomBestelschema (pure function)
 * - Validates with validateStorteboomExport before export
 * - Wave 9: ExportPreflightChecklist shows visual check results
 */

import { useState, useEffect, useCallback } from 'react';
import {
  exportStorteboomBestelschema,
  type StorteboomExportInput,
} from '@/lib/export/orderSchemaExport';
import { validateStorteboomExport } from '@/lib/export/storteboomValidator';
import { buildStorteboomExportData } from '@/lib/actions/export';
import type { SimulatedAvailability } from '@/lib/engine/availability/simulator';
import ExportPreflightChecklist from './ExportPreflightChecklist';

interface PreflightCheck {
  label: string;
  passed: boolean;
  severity: 'error' | 'warning';
  scrollTo?: string;
}

interface ExportButtonProps {
  slaughterId: string;
  slaughterDate: string;
  mester?: string;
  simulatorResult?: SimulatedAvailability | null;
  /** Order statuses from parent — allows pre-flight checks without server call */
  orderStatuses?: string[];
  /** Whether all customers with orders have delivery info */
  deliveryInfoComplete?: boolean;
}

export default function ExportButton({
  slaughterId,
  slaughterDate,
  mester,
  simulatorResult,
  orderStatuses = [],
  deliveryInfoComplete,
}: ExportButtonProps) {
  const [includeSimulator, setIncludeSimulator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [exportData, setExportData] = useState<StorteboomExportInput | null>(null);

  // Build pre-flight checks from:
  // 1. Local data (order statuses, delivery info) — instant
  // 2. Server validation (mass balance, article numbers) — async
  const runPreflightChecks = useCallback(async () => {
    setChecking(true);
    const newChecks: PreflightCheck[] = [];

    // Check 1: Orders confirmed (from props)
    if (orderStatuses.length > 0) {
      const nonConfirmed = orderStatuses.filter((s) => s !== 'confirmed');
      newChecks.push({
        label: nonConfirmed.length === 0
          ? 'Alle orders bevestigd'
          : `${nonConfirmed.length} order(s) nog niet bevestigd`,
        passed: nonConfirmed.length === 0,
        severity: 'warning',
        scrollTo: '[data-section="order-list"]',
      });
    }

    // Check 2: Delivery info (from props)
    if (deliveryInfoComplete !== undefined) {
      newChecks.push({
        label: deliveryInfoComplete
          ? 'Bezorginfo ingevuld'
          : 'Bezorginfo ontbreekt',
        passed: deliveryInfoComplete,
        severity: 'warning',
        scrollTo: '[data-section="delivery-info"]',
      });
    }

    try {
      // Fetch full export data for server-side validation
      const data = await buildStorteboomExportData(
        slaughterId,
        includeSimulator && simulatorResult ? simulatorResult : undefined
      );
      setExportData(data);

      const validation = validateStorteboomExport(data);

      // Check 3: Mass balance
      const massBalanceErrors = validation.errors.filter((e) => e.includes('Massabalans'));
      const massBalanceWarnings = validation.warnings.filter((w) => w.includes('Massabalans'));
      newChecks.push({
        label: massBalanceErrors.length > 0
          ? massBalanceErrors[0]
          : massBalanceWarnings.length > 0
            ? massBalanceWarnings[0]
            : 'Massabalans OK',
        passed: massBalanceErrors.length === 0 && massBalanceWarnings.length === 0,
        severity: massBalanceErrors.length > 0 ? 'error' : 'warning',
      });

      // Check 4: Negative stock (tekorten)
      const tekortWarnings = validation.warnings.filter((w) => w.includes('Tekort'));
      newChecks.push({
        label: tekortWarnings.length > 0
          ? `${tekortWarnings.length} product(en) met tekort`
          : 'Geen negatieve voorraad',
        passed: tekortWarnings.length === 0,
        severity: 'warning',
      });

      // Check 5: Article numbers
      const artWarnings = validation.warnings.filter((w) => w.includes('artikelnummer'));
      newChecks.push({
        label: artWarnings.length > 0
          ? `${artWarnings.length} product(en) zonder artikelnummer`
          : 'Artikelnummers compleet',
        passed: artWarnings.length === 0,
        severity: 'warning',
      });

      // Check 6: Basic data errors (birds, weight, date)
      const basicErrors = validation.errors.filter(
        (e) => !e.includes('Massabalans') && !e.includes('Dubbele')
      );
      if (basicErrors.length > 0) {
        newChecks.push({
          label: basicErrors[0],
          passed: false,
          severity: 'error',
        });
      }
    } catch {
      newChecks.push({
        label: 'Fout bij laden export data',
        passed: false,
        severity: 'error',
      });
    }

    setChecks(newChecks);
    setChecking(false);
  }, [slaughterId, includeSimulator, simulatorResult, orderStatuses, deliveryInfoComplete]);

  // Run pre-flight checks on mount and when relevant props change
  useEffect(() => {
    runPreflightChecks();
  }, [runPreflightChecks]);

  async function handleExport() {
    setLoading(true);
    try {
      // Use cached export data if available, otherwise fetch fresh
      let data = exportData;
      if (!data) {
        data = await buildStorteboomExportData(
          slaughterId,
          includeSimulator && simulatorResult ? simulatorResult : undefined
        );
      }

      // Final validation
      const validation = validateStorteboomExport(data);
      if (!validation.valid) {
        alert(
          'Export niet mogelijk:\n\n' + validation.errors.map((e) => '\u2022 ' + e).join('\n')
        );
        return;
      }

      // Generate Excel
      const buffer = exportStorteboomBestelschema(data);
      const blob = new Blob([buffer.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateParts = slaughterDate.split('-');
      const fileDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      a.download = `bestelschema_${mester ?? 'onbekend'}_${fileDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-3">
      {/* Simulator toggle */}
      {simulatorResult && (
        <label
          className="flex items-center gap-1.5 text-xs cursor-pointer"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <input
            type="checkbox"
            checked={includeSimulator}
            onChange={(e) => setIncludeSimulator(e.target.checked)}
            className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Met simulator data
        </label>
      )}

      {/* Pre-flight Checklist (UX-4) */}
      <ExportPreflightChecklist
        checks={checks}
        onExport={handleExport}
        isExporting={loading}
        isLoading={checking}
      />
    </div>
  );
}
