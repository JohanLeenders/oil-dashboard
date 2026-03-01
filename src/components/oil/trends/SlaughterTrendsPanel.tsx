'use client';

/**
 * SlaughterTrendsPanel — Upload & display slaughter yield reports
 *
 * Features:
 * - Drag & drop xlsx upload
 * - Per-mester overview table with verwerking breakdown
 * - Per-slaughter-day detail table
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  SlaughterReport,
  SlaughterReportLine,
  UploadResult,
} from '@/types/slaughter-reports';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlaughterTrendsPanelProps {
  reports: SlaughterReport[];
  reportLines: SlaughterReportLine[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SlaughterTrendsPanel({
  reports: initialReports,
  reportLines: initialLines,
}: SlaughterTrendsPanelProps) {
  const [reports, setReports] = useState(initialReports);
  const [allLines] = useState(initialLines);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedMester, setSelectedMester] = useState<string | null>(null);

  // ---- Lines lookup ----

  const linesByReport = useMemo(() => {
    const map: Record<string, SlaughterReportLine[]> = {};
    for (const line of allLines) {
      if (!map[line.report_id]) map[line.report_id] = [];
      map[line.report_id].push(line);
    }
    return map;
  }, [allLines]);

  /** Get verwerking yield % for a product code in a report */
  const getVerwerkingPct = useCallback(
    (reportId: string, productCode: string): number | null => {
      const lines = linesByReport[reportId] ?? [];
      const line = lines.find(
        (l) => l.section === 'verwerking' && l.product_code === productCode
      );
      return line?.yield_pct ?? null;
    },
    [linesByReport]
  );

  // ---- Mester summaries (with verwerking averages) ----

  const mesterSummaries = useMemo(() => {
    const groups = new Map<string, SlaughterReport[]>();
    for (const r of reports) {
      const existing = groups.get(r.mester) || [];
      existing.push(r);
      groups.set(r.mester, existing);
    }

    return Array.from(groups.entries()).map(([mester, mesterReports]) => {
      const count = mesterReports.length;
      const totalBirds = mesterReports.reduce((s, r) => s + (r.live_count ?? 0), 0);
      const totalRejected = mesterReports.reduce(
        (s, r) => s + (r.rejected_count ?? 0),
        0
      );
      const latestDate = mesterReports[0]?.slaughter_date ?? '';

      // Weighted averages — weighted by live_count (number of birds)
      // This gives a more accurate picture: larger flocks contribute more
      const weightedAvg = (getter: (r: SlaughterReport) => number | null) => {
        let sumWV = 0;
        let sumW = 0;
        for (const r of mesterReports) {
          const v = getter(r);
          const w = r.live_count ?? 0;
          if (v !== null && v !== undefined && w > 0) {
            sumWV += v * w;
            sumW += w;
          }
        }
        return sumW > 0 ? sumWV / sumW : 0;
      };

      const avgWeight = weightedAvg((r) => r.avg_live_weight_kg);
      const avgTotalYield = weightedAvg((r) => r.total_yield_pct);
      const avgGrillerYield = weightedAvg((r) => r.griller_yield_pct);

      const avgVerwerking = (code: string) => {
        let sumWV = 0;
        let sumW = 0;
        for (const r of mesterReports) {
          const v = getVerwerkingPct(r.id, code);
          const w = r.live_count ?? 0;
          if (v !== null && w > 0) {
            sumWV += v * w;
            sumW += w;
          }
        }
        return sumW > 0 ? sumWV / sumW : null;
      };

      return {
        mester,
        report_count: count,
        latest_date: latestDate,
        total_birds: totalBirds,
        avg_weight: avgWeight,
        total_rejected: totalRejected,
        avg_total_yield: avgTotalYield,
        avg_griller_yield: avgGrillerYield,
        bouten_pct: avgVerwerking('bouten'),
        vleugels_pct: avgVerwerking('vleugels'),
        borsten_pct: avgVerwerking('borsten'),
        staarten_pct: avgVerwerking('staarten'),
        voorrug_pct: avgVerwerking('voorrug'),
      };
    });
  }, [reports, getVerwerkingPct]);

  // ---- Filtered data ----

  const filteredReports = selectedMester
    ? reports.filter((r) => r.mester === selectedMester)
    : reports;

  // ---- Upload handlers ----

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('report_type', 'slacht_putten');

      const res = await fetch('/api/slaughter-reports/upload', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResult = await res.json();
      setUploadResult(result);

      if (result.success) {
        window.location.reload();
      }
    } catch (err) {
      setUploadResult({
        success: false,
        report_id: null,
        report: null,
        weight_distributions: [],
        errors: [
          `Upload fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`,
        ],
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

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragActive
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-8 h-8 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-gray-400">
            {uploading
              ? 'Uploaden...'
              : 'Sleep een slachtrapport (.xlsx) hierheen'}
          </p>
          <label className="cursor-pointer text-xs text-orange-400 hover:text-orange-300 underline">
            of kies een bestand
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div
          className={`rounded-lg p-4 text-sm ${
            uploadResult.success
              ? 'bg-green-500/10 border border-green-500/30 text-green-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}
        >
          {uploadResult.success && (
            <p>
              Rapport ge&uuml;pload: {uploadResult.report?.mester} &mdash;{' '}
              {uploadResult.report?.slaughter_date}
            </p>
          )}
          {uploadResult.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
          {uploadResult.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {/* ── Overzicht per Mester ── */}
      {mesterSummaries.length > 0 && (
        <div className="oil-card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-base font-semibold text-gray-100">
              Overzicht per Mester
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Mester</th>
                  <th className="px-4 py-3 text-right">Levend</th>
                  <th className="px-4 py-3 text-right">Gem. Gew.</th>
                  <th className="px-4 py-3 text-right">Afkeur</th>
                  <th className="px-4 py-3 text-right">Rendement</th>
                  <th className="px-4 py-3 text-right">Griller %</th>
                  <th className="px-4 py-3 text-right border-l border-white/10">
                    Bouten
                  </th>
                  <th className="px-4 py-3 text-right">Vleugels</th>
                  <th className="px-4 py-3 text-right">Borst</th>
                  <th className="px-4 py-3 text-right">Staarten</th>
                  <th className="px-4 py-3 text-right">Voorrug</th>
                </tr>
              </thead>
              <tbody>
                {mesterSummaries.map((s) => (
                  <tr
                    key={s.mester}
                    className={`border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                      selectedMester === s.mester ? 'bg-orange-500/10' : ''
                    }`}
                    onClick={() =>
                      setSelectedMester(
                        selectedMester === s.mester ? null : s.mester
                      )
                    }
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(s.latest_date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-100">
                      {s.mester}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {s.total_birds.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {s.avg_weight.toFixed(3)} kg
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {s.total_rejected.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {s.avg_total_yield.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-100 font-mono font-semibold">
                      {s.avg_griller_yield.toFixed(1)}%
                    </td>
                    {/* Verwerking columns */}
                    <td className="px-4 py-3 text-right text-gray-300 font-mono border-l border-white/10">
                      {fmtPct(s.bouten_pct)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {fmtPct(s.vleugels_pct)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {fmtPct(s.borsten_pct)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {fmtPct(s.staarten_pct)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {fmtPct(s.voorrug_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Slachtdagen ── */}
      {filteredReports.length > 0 && (
        <div className="oil-card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-100">
              Slachtdagen {selectedMester && `\u2014 ${selectedMester}`}
            </h3>
            {selectedMester && (
              <button
                onClick={() => setSelectedMester(null)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Alle mesters tonen
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Mester</th>
                  <th className="px-4 py-3 text-right">Levend</th>
                  <th className="px-4 py-3 text-right">Gem. Gew.</th>
                  <th className="px-4 py-3 text-right">Rendement</th>
                  <th className="px-4 py-3 text-right">Griller %</th>
                  <th className="px-4 py-3 text-right">Griller Gem.</th>
                  <th className="px-4 py-3 text-right">Afkeur</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-4 py-3 text-gray-300">
                      {new Date(r.slaughter_date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-100">
                      {r.mester}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {(r.live_count ?? 0).toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {(r.avg_live_weight_kg ?? 0).toFixed(3)} kg
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {(r.total_yield_pct ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-100 font-mono font-semibold">
                      {(r.griller_yield_pct ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono">
                      {(r.griller_avg_weight_kg ?? 0).toFixed(2)} kg
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span
                        className={
                          (r.cat2_pct ?? 0) > 1.5
                            ? 'text-red-400'
                            : 'text-green-400'
                        }
                      >
                        {(r.rejected_count ?? 0).toLocaleString('nl-NL')}{' '}
                        <span className="text-xs text-gray-500">
                          ({(r.cat2_pct ?? 0).toFixed(2)}%)
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {reports.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nog geen slachtrapporten</p>
          <p className="text-sm mt-1">
            Upload een .xlsx bestand om te beginnen
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a nullable percentage for table cells */
function fmtPct(value: number | null): string {
  if (value === null) return '\u2014';
  return `${value.toFixed(1)}%`;
}
