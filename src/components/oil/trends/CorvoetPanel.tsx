'use client';

/**
 * CorvoetPanel — Upload & display Corvoet fileer massabalans reports
 *
 * Stage B: borstkappen → filet/haasjes (rendement ~70%)
 * Drag & drop xlsx upload + weekly overview table.
 */

import { useState, useCallback } from 'react';
import type { CorvoetUploadResult } from '@/types/slaughter-reports';
import type { CorvoetReportRow } from '@/lib/actions/slaughter-reports';

interface CorvoetPanelProps {
  reports: CorvoetReportRow[];
}

export default function CorvoetPanel({
  reports: initialReports,
}: CorvoetPanelProps) {
  const [reports] = useState(initialReports);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<CorvoetUploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // ---- Upload handlers ----

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/slaughter-reports/upload-corvoet', {
        method: 'POST',
        body: formData,
      });

      const result: CorvoetUploadResult = await res.json();
      setUploadResult(result);

      if (result.success) {
        window.location.reload();
      }
    } catch (err) {
      setUploadResult({
        success: false,
        report_id: null,
        report: null,
        errors: [`Upload fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`],
        warnings: [],
      });
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  // ---- Helpers ----

  const getLineKg = (report: CorvoetReportRow, productCode: string): number | null => {
    const line = report.lines.find(l => l.product_code === productCode);
    return line?.weight_kg ?? null;
  };

  const getLinePct = (report: CorvoetReportRow, productCode: string): number | null => {
    const line = report.lines.find(l => l.product_code === productCode);
    return line?.yield_pct ?? null;
  };

  const fmtKg = (kg: number | null): string => {
    if (kg === null) return '\u2014';
    return kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  };

  const fmtPct = (pct: number | null): string => {
    if (pct === null) return '\u2014';
    return `${pct.toFixed(1)}%`;
  };

  // Extract week label from lot_number (e.g., "W09-2026" → "W09")
  const weekLabel = (lotNumber: string): string => {
    const match = lotNumber.match(/W(\d{1,2})/i);
    return match ? `W${match[1].padStart(2, '0')}` : lotNumber;
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragActive
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-400">
            {uploading ? 'Uploaden...' : 'Sleep een Corvoet massabalans (.xlsx) hierheen'}
          </p>
          <label className="cursor-pointer text-xs text-orange-400 hover:text-orange-300 underline">
            of kies een bestand
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`rounded-lg p-4 text-sm ${
          uploadResult.success
            ? 'bg-green-500/10 border border-green-500/30 text-green-300'
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          {uploadResult.success && (
            <p>Massabalans ge&uuml;pload: Week {uploadResult.report?.week_number} &mdash; filet rendement {uploadResult.report?.filet_yield_pct}%</p>
          )}
          {uploadResult.errors.map((e, i) => <p key={i}>{e}</p>)}
          {uploadResult.warnings.map((w, i) => <p key={`w${i}`} className="text-yellow-400">{w}</p>)}
        </div>
      )}

      {/* ── Overzicht Massabalans ── */}
      {reports.length > 0 && (
        <div className="oil-card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-base font-semibold text-gray-100">Overzicht per Week</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Week</th>
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-right">Borstkappen in</th>
                  <th className="px-4 py-3 text-right">Filet/haasjes uit</th>
                  <th className="px-4 py-3 text-right">Filet %</th>
                  <th className="px-4 py-3 text-right border-l border-white/10">Vellen</th>
                  <th className="px-4 py-3 text-right">Vellen %</th>
                  <th className="px-4 py-3 text-right border-l border-white/10">Dijenvlees in</th>
                  <th className="px-4 py-3 text-right">Dijenvlees uit</th>
                  <th className="px-4 py-3 text-right">Dij %</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const filetPct = getLinePct(r, 'filet_haasjes_uit');
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-medium text-gray-100">
                        {weekLabel(r.lot_number)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(r.slaughter_date).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">
                        {fmtKg(getLineKg(r, 'borstkappen_in'))} kg
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">
                        {fmtKg(getLineKg(r, 'filet_haasjes_uit'))} kg
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-100">
                        <span className={
                          filetPct !== null
                            ? filetPct >= 70 ? 'text-green-400' : filetPct >= 65 ? 'text-yellow-400' : 'text-red-400'
                            : ''
                        }>
                          {fmtPct(filetPct)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono border-l border-white/10">
                        {fmtKg(getLineKg(r, 'vellen_uit'))} kg
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 font-mono">
                        {fmtPct(getLinePct(r, 'vellen_uit'))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono border-l border-white/10">
                        {fmtKg(getLineKg(r, 'dijenvlees_in'))} kg
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">
                        {fmtKg(getLineKg(r, 'dijenvlees_uit'))} kg
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 font-mono">
                        {fmtPct(getLinePct(r, 'dijenvlees_uit'))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {reports.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nog geen Corvoet massabalansen</p>
          <p className="text-sm mt-1">Upload een massabalans .xlsx om te beginnen</p>
        </div>
      )}
    </div>
  );
}
