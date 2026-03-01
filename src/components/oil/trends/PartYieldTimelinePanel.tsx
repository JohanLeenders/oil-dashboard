'use client';

/**
 * PartYieldTimelinePanel — Rendement t.o.v. griller per onderdeel over tijd
 *
 * Shows yield percentages for each anatomical part (bouten, borsten, vleugels, etc.)
 * and individual organ yields (levers, magen, harten) across all slaughter dates.
 * Also shows borstfilet yield (Cor Voet) as a summary card.
 *
 * Marge & volume placeholders are included but greyed out (data not yet available).
 */

import { useMemo } from 'react';
import type { SlaughterReport, SlaughterReportLine } from '@/types/slaughter-reports';
import type { CorvoetReportRow } from '@/lib/actions/slaughter-reports';

interface Props {
  reports: SlaughterReport[];
  lines: SlaughterReportLine[];
  corvoetReports?: CorvoetReportRow[];
}

// The onderdelen to track: verwerking + organen (in display order)
// Note: achterrug removed, borstfilet (Cor Voet) handled separately as summary card
const ONDERDELEN = [
  { code: 'bouten', label: 'Bouten', shortLabel: 'Bout.', group: 'verwerking' },
  { code: 'borsten', label: 'Borsten', shortLabel: 'Borst', group: 'verwerking' },
  { code: 'vleugels', label: 'Vleugels', shortLabel: 'Vleug.', group: 'verwerking' },
  { code: 'voorrug', label: 'Voorrug', shortLabel: 'V.rug', group: 'verwerking' },
  { code: 'staarten', label: 'Staarten', shortLabel: 'Start.', group: 'verwerking' },
  { code: 'levers', label: 'Levers', shortLabel: 'Lever', group: 'organen' },
  { code: 'magen', label: 'Magen', shortLabel: 'Maag', group: 'organen' },
  { code: 'harten', label: 'Harten', shortLabel: 'Hart', group: 'organen' },
] as const;

type OnderdeelCode = (typeof ONDERDELEN)[number]['code'];

interface SlachtdagRow {
  date: string;
  mester: string;
  lotNumber: string;
  grillerYieldPct: number | null;
  yields: Record<string, number | null>; // product_code → yield_pct
}

interface OnderdeelSummary {
  code: string;
  label: string;
  shortLabel: string;
  avgYield: number | null;
  minYield: number | null;
  maxYield: number | null;
  trend: 'up' | 'down' | 'stable' | 'insufficient';
  recentAvg: number | null;
  priorAvg: number | null;
  dataPoints: number;
}

function computeSummaries(rows: SlachtdagRow[]): OnderdeelSummary[] {
  // Rows are sorted newest-first
  return ONDERDELEN.map(({ code, label, shortLabel }) => {
    const values = rows
      .map((r) => r.yields[code])
      .filter((v): v is number => v !== null && v !== undefined);

    if (values.length === 0) {
      return {
        code,
        label,
        shortLabel,
        avgYield: null,
        minYield: null,
        maxYield: null,
        trend: 'insufficient' as const,
        recentAvg: null,
        priorAvg: null,
        dataPoints: 0,
      };
    }

    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Trend: compare first half (recent) vs second half (older)
    let trend: 'up' | 'down' | 'stable' | 'insufficient' = 'insufficient';
    if (values.length >= 2) {
      const mid = Math.ceil(values.length / 2);
      const recentVals = values.slice(0, mid); // newest first
      const priorVals = values.slice(mid);
      const recentAvg = recentVals.reduce((s, v) => s + v, 0) / recentVals.length;
      const priorAvg = priorVals.reduce((s, v) => s + v, 0) / priorVals.length;
      const diff = recentAvg - priorAvg;
      const threshold = 0.5; // 0.5 percentage point change

      trend = Math.abs(diff) < threshold ? 'stable' : diff > 0 ? 'up' : 'down';

      return {
        code,
        label,
        shortLabel,
        avgYield: Math.round(avg * 100) / 100,
        minYield: Math.round(min * 100) / 100,
        maxYield: Math.round(max * 100) / 100,
        trend,
        recentAvg: Math.round(recentAvg * 100) / 100,
        priorAvg: Math.round(priorAvg * 100) / 100,
        dataPoints: values.length,
      };
    }

    return {
      code,
      label,
      shortLabel,
      avgYield: Math.round(avg * 100) / 100,
      minYield: Math.round(min * 100) / 100,
      maxYield: Math.round(max * 100) / 100,
      trend,
      recentAvg: null,
      priorAvg: null,
      dataPoints: values.length,
    };
  });
}

function trendIcon(trend: string): string {
  switch (trend) {
    case 'up':
      return '↗';
    case 'down':
      return '↘';
    case 'stable':
      return '→';
    default:
      return '·';
  }
}

function trendColor(trend: string): string {
  switch (trend) {
    case 'up':
      return 'text-emerald-400';
    case 'down':
      return 'text-red-400';
    case 'stable':
      return 'text-gray-400';
    default:
      return 'text-gray-600';
  }
}

function trendBgColor(trend: string): string {
  switch (trend) {
    case 'up':
      return 'bg-emerald-500/10 border-emerald-500/20';
    case 'down':
      return 'bg-red-500/10 border-red-500/20';
    case 'stable':
      return 'bg-gray-500/10 border-gray-500/20';
    default:
      return 'bg-gray-500/5 border-gray-500/10';
  }
}

/** Color cell based on deviation from average */
function yieldCellClass(value: number | null, avg: number | null): string {
  if (value === null || avg === null) return 'text-gray-600';
  const diff = value - avg;
  if (Math.abs(diff) < 0.3) return 'text-gray-200'; // within normal range
  if (diff > 0) return 'text-emerald-400'; // above average
  return 'text-amber-400'; // below average
}

/** Reusable summary card for a single onderdeel */
function SummaryCard({ summary: s, isOrgaan = false }: { summary: OnderdeelSummary; isOrgaan?: boolean }) {
  return (
    <div className={`oil-card p-4 border ${trendBgColor(s.trend)}`}>
      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-xs font-medium uppercase tracking-wider ${isOrgaan ? 'text-purple-400/80' : 'text-gray-400'}`}>
          {s.label}
        </span>
        <span className={`text-sm font-bold ${trendColor(s.trend)}`}>
          {trendIcon(s.trend)}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-100 font-mono">
        {s.avgYield !== null ? `${s.avgYield.toFixed(1)}%` : '—'}
      </div>
      {s.minYield !== null && s.maxYield !== null && s.dataPoints > 1 && (
        <div className="text-[10px] text-gray-500 mt-1 font-mono">
          {s.minYield.toFixed(1)} – {s.maxYield.toFixed(1)}%
        </div>
      )}
      <div className="text-[10px] text-gray-600 mt-0.5">
        {s.dataPoints} slachtdag{s.dataPoints !== 1 ? 'en' : ''}
        {isOrgaan && <span className="text-purple-500/50"> · orgaan</span>}
      </div>
    </div>
  );
}

export default function PartYieldTimelinePanel({ reports, lines, corvoetReports = [] }: Props) {
  // Compute borstfilet (Cor Voet) summary
  const borstfiletSummary = useMemo((): OnderdeelSummary => {
    const values = corvoetReports
      .map((r) => {
        const filetLine = r.lines.find((l) => l.product_code === 'filet_haasjes_uit');
        return filetLine?.yield_pct ? Number(filetLine.yield_pct) : null;
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      return {
        code: 'borstfilet',
        label: 'Borstfilet',
        shortLabel: 'B.filet',
        avgYield: null,
        minYield: null,
        maxYield: null,
        trend: 'insufficient',
        recentAvg: null,
        priorAvg: null,
        dataPoints: 0,
      };
    }

    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    let trend: 'up' | 'down' | 'stable' | 'insufficient' = 'insufficient';
    let recentAvg: number | null = null;
    let priorAvg: number | null = null;
    if (values.length >= 2) {
      const mid = Math.ceil(values.length / 2);
      const rv = values.slice(0, mid);
      const pv = values.slice(mid);
      recentAvg = Math.round((rv.reduce((s, v) => s + v, 0) / rv.length) * 100) / 100;
      priorAvg = Math.round((pv.reduce((s, v) => s + v, 0) / pv.length) * 100) / 100;
      const diff = recentAvg - priorAvg;
      trend = Math.abs(diff) < 0.5 ? 'stable' : diff > 0 ? 'up' : 'down';
    }

    return {
      code: 'borstfilet',
      label: 'Borstfilet',
      shortLabel: 'B.filet',
      avgYield: Math.round(avg * 100) / 100,
      minYield: Math.round(min * 100) / 100,
      maxYield: Math.round(max * 100) / 100,
      trend,
      recentAvg,
      priorAvg,
      dataPoints: values.length,
    };
  }, [corvoetReports]);

  // Compute griller yield summary (griller % t.o.v. levend)
  const grillerSummary = useMemo((): OnderdeelSummary => {
    const values = reports
      .map((r) => r.griller_yield_pct)
      .filter((v): v is number => v !== null && v !== undefined);

    if (values.length === 0) {
      return { code: 'griller', label: 'Griller', shortLabel: 'Grill.', avgYield: null, minYield: null, maxYield: null, trend: 'insufficient', recentAvg: null, priorAvg: null, dataPoints: 0 };
    }

    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    let trend: 'up' | 'down' | 'stable' | 'insufficient' = 'insufficient';
    let recentAvg: number | null = null;
    let priorAvg: number | null = null;
    if (values.length >= 2) {
      const mid = Math.ceil(values.length / 2);
      const rv = values.slice(0, mid);
      const pv = values.slice(mid);
      recentAvg = Math.round((rv.reduce((s, v) => s + v, 0) / rv.length) * 100) / 100;
      priorAvg = Math.round((pv.reduce((s, v) => s + v, 0) / pv.length) * 100) / 100;
      const diff = recentAvg - priorAvg;
      trend = Math.abs(diff) < 0.5 ? 'stable' : diff > 0 ? 'up' : 'down';
    }

    return {
      code: 'griller', label: 'Griller', shortLabel: 'Grill.',
      avgYield: Math.round(avg * 100) / 100,
      minYield: Math.round(min * 100) / 100,
      maxYield: Math.round(max * 100) / 100,
      trend, recentAvg, priorAvg, dataPoints: values.length,
    };
  }, [reports]);

  const { rows, summaries } = useMemo(() => {
    // Build per-slachtdag rows (include both verwerking and organen sections)
    const linesByReport = new Map<string, SlaughterReportLine[]>();
    for (const line of lines) {
      if (line.section !== 'verwerking' && line.section !== 'organen') continue;
      const existing = linesByReport.get(line.report_id) || [];
      existing.push(line);
      linesByReport.set(line.report_id, existing);
    }

    const slachtdagRows: SlachtdagRow[] = reports
      .filter((r) => linesByReport.has(r.id))
      .sort(
        (a, b) =>
          new Date(b.slaughter_date).getTime() - new Date(a.slaughter_date).getTime()
      )
      .map((r) => {
        const reportLines = linesByReport.get(r.id) || [];
        const yields: Record<string, number | null> = {};
        for (const line of reportLines) {
          yields[line.product_code] = line.yield_pct;
        }
        return {
          date: r.slaughter_date,
          mester: r.mester,
          lotNumber: r.lot_number,
          grillerYieldPct: r.griller_yield_pct,
          yields,
        };
      });

    return {
      rows: slachtdagRows,
      summaries: computeSummaries(slachtdagRows),
    };
  }, [reports, lines]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Nog geen verwerkingsdata</p>
        <p className="text-sm mt-1">
          Upload slachtrapporten met verwerking om rendementen per onderdeel te zien
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards — 5-column grid, 2 rows */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Row 1: Griller, Bouten, Borsten, Borstfilet, Vleugels */}

        {/* Griller rendement t.o.v. levend */}
        <div className={`oil-card p-4 border ${trendBgColor(grillerSummary.trend)}`}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-medium text-orange-500/80 uppercase tracking-wider">
              Griller
            </span>
            <span className={`text-sm font-bold ${trendColor(grillerSummary.trend)}`}>
              {trendIcon(grillerSummary.trend)}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-100 font-mono">
            {grillerSummary.avgYield !== null ? `${grillerSummary.avgYield.toFixed(1)}%` : '—'}
          </div>
          {grillerSummary.minYield !== null && grillerSummary.maxYield !== null && grillerSummary.dataPoints > 1 && (
            <div className="text-[10px] text-gray-500 mt-1 font-mono">
              {grillerSummary.minYield.toFixed(1)} – {grillerSummary.maxYield.toFixed(1)}%
            </div>
          )}
          <div className="text-[10px] text-gray-600 mt-0.5">
            {grillerSummary.dataPoints} slachtdag{grillerSummary.dataPoints !== 1 ? 'en' : ''} · <span className="text-orange-500/50">t.o.v. levend</span>
          </div>
        </div>

        {/* Bouten + Borsten */}
        {summaries.filter(s => s.code === 'bouten' || s.code === 'borsten').map((s) => (
          <SummaryCard key={s.code} summary={s} />
        ))}

        {/* Borstfilet (Cor Voet) — directly right of borsten */}
        <div className={`oil-card p-4 border ${trendBgColor(borstfiletSummary.trend)}`}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-medium text-orange-400/80 uppercase tracking-wider">
              Borstfilet
            </span>
            <span className={`text-sm font-bold ${trendColor(borstfiletSummary.trend)}`}>
              {trendIcon(borstfiletSummary.trend)}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-100 font-mono">
            {borstfiletSummary.avgYield !== null ? `${borstfiletSummary.avgYield.toFixed(1)}%` : '—'}
          </div>
          {borstfiletSummary.minYield !== null && borstfiletSummary.maxYield !== null && borstfiletSummary.dataPoints > 1 && (
            <div className="text-[10px] text-gray-500 mt-1 font-mono">
              {borstfiletSummary.minYield.toFixed(1)} – {borstfiletSummary.maxYield.toFixed(1)}%
            </div>
          )}
          <div className="text-[10px] text-gray-600 mt-0.5">
            {borstfiletSummary.dataPoints} week{borstfiletSummary.dataPoints !== 1 ? 'en' : ''} · <span className="text-orange-500/50">Cor Voet</span>
          </div>
        </div>

        {/* Vleugels */}
        {summaries.filter(s => s.code === 'vleugels').map((s) => (
          <SummaryCard key={s.code} summary={s} />
        ))}

        {/* Row 2: Voorrug, Staarten, Levers, Magen, Harten */}
        {summaries.filter(s => s.code === 'voorrug' || s.code === 'staarten').map((s) => (
          <SummaryCard key={s.code} summary={s} />
        ))}
        {summaries.filter(s => ['levers', 'magen', 'harten'].includes(s.code)).map((s) => (
          <SummaryCard key={s.code} summary={s} isOrgaan />
        ))}
      </div>

      {/* Timeline Table */}
      <div className="oil-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  Mester
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-orange-500/70 uppercase tracking-wider">
                  Griller
                </th>
                {ONDERDELEN.map((o) => (
                  <th
                    key={o.code}
                    className={`px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider ${
                      o.group === 'organen' ? 'text-purple-400/60' : 'text-gray-500'
                    } ${o.code === 'levers' ? 'border-l border-white/10' : ''}`}
                  >
                    {o.shortLabel}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                  Marge
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {rows.map((row, idx) => (
                <tr
                  key={`${row.date}-${row.lotNumber}`}
                  className={`${
                    idx === 0
                      ? 'bg-orange-500/5'
                      : 'hover:bg-white/[0.02]'
                  } transition-colors`}
                >
                  <td className="px-3 py-2 text-gray-300 font-mono text-xs whitespace-nowrap">
                    {new Date(row.date).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {row.mester}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-orange-400">
                    {row.grillerYieldPct !== null
                      ? `${row.grillerYieldPct.toFixed(1)}%`
                      : '—'}
                  </td>
                  {ONDERDELEN.map((o) => {
                    const val = row.yields[o.code] ?? null;
                    const avg = summaries.find((s) => s.code === o.code)?.avgYield ?? null;
                    return (
                      <td
                        key={o.code}
                        className={`px-3 py-2 text-right font-mono text-xs ${yieldCellClass(val, avg)} ${o.code === 'levers' ? 'border-l border-white/10' : ''}`}
                      >
                        {val !== null ? `${val.toFixed(1)}%` : '—'}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-xs text-gray-700 italic">
                    —
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700 italic">
                    —
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Averages footer */}
            <tfoot>
              <tr className="border-t border-white/10 bg-white/[0.02]">
                <td className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase">
                  Gemiddeld
                </td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono text-xs text-orange-400/60">
                  {rows.length > 0
                    ? `${(
                        rows.reduce((s, r) => s + (r.grillerYieldPct ?? 0), 0) /
                        rows.filter((r) => r.grillerYieldPct !== null).length
                      ).toFixed(1)}%`
                    : '—'}
                </td>
                {summaries.map((s) => (
                  <td
                    key={s.code}
                    className="px-3 py-2 text-right font-mono text-xs text-gray-400"
                  >
                    {s.avgYield !== null ? `${s.avgYield.toFixed(1)}%` : '—'}
                  </td>
                ))}
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Placeholder notice for Marge & Volume */}
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-600" />
        <span>
          Kolommen <span className="text-gray-500">Marge</span> en{' '}
          <span className="text-gray-500">Volume</span> worden ingevuld zodra
          margegegevens per onderdeel beschikbaar zijn.
        </span>
      </div>
    </div>
  );
}
