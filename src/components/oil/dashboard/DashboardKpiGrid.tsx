'use client';

/**
 * DashboardKpiGrid — Clickable KPI tiles with drill-down modals (UX-5)
 *
 * Receives batch stats from the server page, renders OIL-themed KpiTiles,
 * and opens OilModal with detail content on click.
 */

import { useState } from 'react';
import { KpiTile } from '@/components/oil/ui/KpiTile';
import OilModal from '@/components/oil/ui/OilModal';

interface BatchStats {
  total_batches: number;
  total_live_weight_kg: number;
  avg_griller_yield_pct: number;
  batches_needs_review: number;
  batches_tht_warning: number;
}

interface DashboardKpiGridProps {
  stats: BatchStats;
}

type ModalView = 'batches' | 'weight' | 'yield' | 'attention' | null;

function formatWeight(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)}t`;
  }
  return `${kg.toFixed(0)} kg`;
}

export default function DashboardKpiGrid({ stats }: DashboardKpiGridProps) {
  const [activeModal, setActiveModal] = useState<ModalView>(null);

  const needsAttention = stats.batches_needs_review + stats.batches_tht_warning;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Totaal Batches"
          value={stats.total_batches.toString()}
          unit="in systeem"
          onClick={() => setActiveModal('batches')}
        />
        <KpiTile
          label="Levend Gewicht"
          value={formatWeight(stats.total_live_weight_kg)}
          unit="totaal"
          onClick={() => setActiveModal('weight')}
        />
        <KpiTile
          label="Gem. Griller Yield"
          value={`${stats.avg_griller_yield_pct}%`}
          unit="target: 70.7%"
          color={stats.avg_griller_yield_pct < 70 ? 'orange' : undefined}
          onClick={() => setActiveModal('yield')}
        />
        <KpiTile
          label="Aandacht Nodig"
          value={needsAttention.toString()}
          unit={`${stats.batches_needs_review} review, ${stats.batches_tht_warning} THT`}
          color={needsAttention > 0 ? 'red' : 'green'}
          onClick={() => setActiveModal('attention')}
        />
      </div>

      {/* Drill-down Modals (UX-5) */}
      <OilModal
        isOpen={activeModal === 'batches'}
        onClose={() => setActiveModal(null)}
        title="Batches Overzicht"
      >
        <ModalPlaceholder
          title="Batch detail overzicht"
          description="Hier komt een gedetailleerde tabel met alle batches, inclusief status, THT, en massabalans per batch."
        />
      </OilModal>

      <OilModal
        isOpen={activeModal === 'weight'}
        onClose={() => setActiveModal(null)}
        title="Levend Gewicht Detail"
      >
        <ModalPlaceholder
          title="Gewicht verdeling"
          description="Hier komt een uitsplitsing van levend gewicht per batch, met trend-grafieken en vergelijking met voorgaande periodes."
        />
      </OilModal>

      <OilModal
        isOpen={activeModal === 'yield'}
        onClose={() => setActiveModal(null)}
        title="Griller Yield Analyse"
      >
        <ModalPlaceholder
          title="Yield analyse"
          description="Hier komt een gedetailleerde analyse van griller rendement per batch, met afwijkingen en trends over tijd."
        />
      </OilModal>

      <OilModal
        isOpen={activeModal === 'attention'}
        onClose={() => setActiveModal(null)}
        title="Items die Aandacht Nodig Hebben"
      >
        <ModalPlaceholder
          title="Aandacht items"
          description={`${stats.batches_needs_review} batch(es) wachtend op review, ${stats.batches_tht_warning} batch(es) met THT waarschuwing. Detail view coming in Phase 3.`}
        />
      </OilModal>
    </>
  );
}

function ModalPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="text-center py-12 px-6 rounded-lg"
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div
        className="text-3xl mb-3"
        style={{ color: 'var(--color-text-dim)' }}
      >
        &#128202;
      </div>
      <h4
        className="text-sm font-semibold mb-2"
        style={{ color: 'var(--color-text-main)' }}
      >
        {title}
      </h4>
      <p
        className="text-xs max-w-md mx-auto"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {description}
      </p>
      <p
        className="text-[10px] mt-4"
        style={{ color: 'var(--color-text-dim)' }}
      >
        Detail view coming in Phase 3
      </p>
    </div>
  );
}
