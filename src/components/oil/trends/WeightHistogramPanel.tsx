'use client';

/**
 * WeightHistogramPanel — Interactive weight distribution histograms
 *
 * Shows:
 * 1. Gewogen gemiddelde across all rondes (weighted by bird count)
 * 2. Laatste ronde per mester (small cards)
 * 3. Optional: per-ronde detail (dropdown) + last 3 rounds
 */

import { useState, useMemo } from 'react';
import type { HistogramDataRow, WeightBin } from '@/lib/actions/slaughter-reports';

interface Props {
  distributions: HistogramDataRow[];
}

/** Compute weighted average bins across multiple distributions */
function computeWeightedAverage(distributions: HistogramDataRow[]): WeightBin[] {
  if (distributions.length === 0) return [];

  const binMap: Record<string, { lower_g: number; upper_g: number; totalCount: number }> = {};

  for (const dist of distributions) {
    for (const bin of dist.bins) {
      const key = `${bin.lower_g}-${bin.upper_g}`;
      if (!binMap[key]) {
        binMap[key] = { lower_g: bin.lower_g, upper_g: bin.upper_g, totalCount: 0 };
      }
      binMap[key].totalCount += bin.bird_count;
    }
  }

  const allBins = Object.values(binMap).sort((a, b) => a.lower_g - b.lower_g);
  const grandTotal = allBins.reduce((s, b) => s + b.totalCount, 0);

  return allBins.map(b => ({
    lower_g: b.lower_g,
    upper_g: b.upper_g,
    bird_count: b.totalCount,
    pct: grandTotal > 0 ? (b.totalCount / grandTotal) * 100 : 0,
  }));
}

/** Bar chart component */
function BarChart({
  bins,
  maxPct,
  color,
  label,
  totalBirds,
  height: chartHeight = 'h-32',
}: {
  bins: WeightBin[];
  maxPct: number;
  color: string;
  label: string;
  totalBirds: number;
  height?: string;
}) {
  const significantBins = bins.filter(b => b.pct >= 0.01);
  if (significantBins.length === 0) return null;

  const totalCount = bins.reduce((s, b) => s + b.bird_count, 0);
  let cumulative = 0;
  let p5Lower = significantBins[0].lower_g;
  let p95Upper = significantBins[significantBins.length - 1].upper_g;
  for (const b of significantBins) {
    cumulative += b.bird_count;
    if (cumulative / totalCount < 0.02) p5Lower = b.lower_g;
    if (cumulative / totalCount <= 0.98) p95Upper = b.upper_g;
  }

  const displayBins = significantBins.filter(
    b => b.lower_g >= p5Lower - 100 && b.upper_g <= p95Upper + 100
  );

  const weightedSum = bins.reduce((s, b) => s + b.bird_count * ((b.lower_g + b.upper_g) / 2), 0);
  const avgWeight = totalCount > 0 ? weightedSum / totalCount : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <span className="text-xs text-gray-500">
          {totalBirds.toLocaleString('nl-NL')} dieren | gem.{' '}
          <span className="text-gray-300 font-mono">{(avgWeight / 1000).toFixed(2)} kg</span>
        </span>
      </div>
      <div className={`flex items-end gap-[1px] ${chartHeight}`}>
        {displayBins.map((bin) => {
          const height = maxPct > 0 ? (bin.pct / maxPct) * 100 : 0;
          return (
            <div
              key={bin.lower_g}
              className="flex-1 h-full flex flex-col justify-end group relative"
            >
              <div
                className={`${color} rounded-t-[1px] min-w-[3px] transition-opacity group-hover:opacity-80`}
                style={{ height: `${Math.max(height, 0.5)}%` }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-gray-900 border border-white/10 rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                  <div className="text-gray-300 font-mono">
                    {(bin.lower_g / 1000).toFixed(1)}-{(bin.upper_g / 1000).toFixed(1)} kg
                  </div>
                  <div className="text-gray-400">
                    {bin.bird_count.toLocaleString('nl-NL')} ({bin.pct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-600">
          {(displayBins[0]?.lower_g / 1000).toFixed(1)} kg
        </span>
        <span className="text-[10px] text-gray-600">
          {((displayBins[displayBins.length - 1]?.upper_g ?? 0) / 1000).toFixed(1)} kg
        </span>
      </div>
    </div>
  );
}

/** Mini histogram card for per-mester summary */
function MiniHistogramCard({
  dist,
  globalMaxPct,
  onClick,
  selected,
}: {
  dist: HistogramDataRow;
  globalMaxPct: number;
  onClick: () => void;
  selected: boolean;
}) {
  const totalBirds = dist.bins.reduce((s, b) => s + b.bird_count, 0);
  const weightedSum = dist.bins.reduce(
    (s, b) => s + b.bird_count * ((b.lower_g + b.upper_g) / 2),
    0
  );
  const avgW = totalBirds > 0 ? weightedSum / totalBirds : 0;

  return (
    <button
      onClick={onClick}
      className={`oil-card p-4 text-left transition-all cursor-pointer ${
        selected ? 'ring-1 ring-orange-500/50' : 'hover:bg-white/5'
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">
          {new Date(dist.slaughter_date).toLocaleDateString('nl-NL')}
        </span>
        <span className="text-xs text-gray-500">{dist.mester}</span>
      </div>
      <div className="flex items-end gap-[1px] h-10">
        {dist.bins
          .filter(b => b.pct >= 0.3)
          .map((bin) => {
            const height = globalMaxPct > 0 ? (bin.pct / globalMaxPct) * 100 : 0;
            return (
              <div key={bin.lower_g} className="flex-1 h-full flex flex-col justify-end">
                <div
                  className="bg-sky-500/60 rounded-t-[1px] min-w-[2px]"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
            );
          })}
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[11px]">
        <span className="text-gray-500">
          {totalBirds.toLocaleString('nl-NL')} dieren
        </span>
        <span className="text-gray-400 font-mono">
          gem. {(avgW / 1000).toFixed(2)} kg
        </span>
      </div>
    </button>
  );
}

type ViewMode = 'latest' | 'last3' | 'all';

export default function WeightHistogramPanel({ distributions }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('latest');

  const weightedAvg = useMemo(
    () => computeWeightedAverage(distributions),
    [distributions]
  );

  // Get last round per mester
  const lastPerMester = useMemo(() => {
    const mesterMap = new Map<string, HistogramDataRow>();
    // distributions are sorted by date (newest first), so first occurrence is latest
    for (const d of distributions) {
      if (!mesterMap.has(d.mester)) {
        mesterMap.set(d.mester, d);
      }
    }
    return Array.from(mesterMap.values());
  }, [distributions]);

  // Get last 3 rounds (overall)
  const last3 = useMemo(
    () => distributions.slice(0, 3),
    [distributions]
  );

  // Determine which mini cards to show based on view mode
  const displayCards = useMemo(() => {
    switch (viewMode) {
      case 'latest': return lastPerMester;
      case 'last3': return last3;
      case 'all': return distributions;
    }
  }, [viewMode, lastPerMester, last3, distributions]);

  const globalMaxPct = useMemo(() => {
    let max = 0;
    for (const d of distributions) {
      for (const b of d.bins) {
        if (b.pct > max) max = b.pct;
      }
    }
    for (const b of weightedAvg) {
      if (b.pct > max) max = b.pct;
    }
    return max;
  }, [distributions, weightedAvg]);

  const totalBirdsAll = useMemo(
    () => distributions.reduce((s, d) => s + d.bins.reduce((s2, b) => s2 + b.bird_count, 0), 0),
    [distributions]
  );

  if (distributions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Nog geen gewichtsverdelingen</p>
        <p className="text-sm mt-1">Upload slachtrapporten met Meyn scans om te beginnen</p>
      </div>
    );
  }

  const selected = selectedIdx !== null ? distributions[selectedIdx] : null;

  return (
    <div className="space-y-6">
      {/* Gewogen Gemiddelde */}
      <div className="oil-card p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-100 uppercase tracking-wide">
            Gewogen Gemiddelde
          </h4>
          <span className="text-xs text-gray-500">
            {distributions.length} rondes &middot; {totalBirdsAll.toLocaleString('nl-NL')} dieren
          </span>
        </div>
        <BarChart
          bins={weightedAvg}
          maxPct={globalMaxPct}
          color="bg-orange-500"
          label="Alle rondes gecombineerd"
          totalBirds={totalBirdsAll}
        />
      </div>

      {/* Per Ronde — dropdown selector */}
      <div className="oil-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-100 uppercase tracking-wide">
            Per Ronde
          </h4>
          <select
            className="bg-gray-800 border border-white/10 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-orange-500/50"
            value={selectedIdx ?? ''}
            onChange={(e) => setSelectedIdx(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Kies een ronde...</option>
            {distributions.map((d, i) => (
              <option key={d.report_id} value={i}>
                {new Date(d.slaughter_date).toLocaleDateString('nl-NL')} — {d.mester}
              </option>
            ))}
          </select>
        </div>

        {selected ? (
          <BarChart
            bins={selected.bins}
            maxPct={globalMaxPct}
            color="bg-sky-500"
            label={`${new Date(selected.slaughter_date).toLocaleDateString('nl-NL')} — ${selected.mester}`}
            totalBirds={selected.bins.reduce((s, b) => s + b.bird_count, 0)}
          />
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-600 text-sm">
            Selecteer een ronde om de verdeling te zien
          </div>
        )}
      </div>

      {/* Mini cards — view mode selector + cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-100 uppercase tracking-wide">
            Overzicht
          </h4>
          <div className="flex gap-1">
            {(['latest', 'last3', 'all'] as const).map((mode) => {
              const labels: Record<ViewMode, string> = {
                latest: 'Laatste per mester',
                last3: 'Laatste 3 rondes',
                all: `Alle rondes (${distributions.length})`,
              };
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === mode
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displayCards.map((d) => {
            const idx = distributions.findIndex(dd => dd.report_id === d.report_id);
            return (
              <MiniHistogramCard
                key={d.report_id}
                dist={d}
                globalMaxPct={globalMaxPct}
                onClick={() => setSelectedIdx(idx)}
                selected={selectedIdx === idx}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
