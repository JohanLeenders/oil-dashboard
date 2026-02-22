/**
 * Kostprijs Overview — Berekeningen gegroepeerd per profiel.
 *
 * Top-level entry point for all cost price calculations.
 * Groups batches by batch_profile and shows them in profile cards.
 */

import Link from 'next/link';
import { getAllBatches } from '@/lib/data/batch-input-store';
import { KostprijsProfileCard } from '@/components/oil/kostprijs/KostprijsProfileCard';

const PROFILES = [
  {
    key: 'oranjehoen',
    label: 'Oranjehoen (Intern)',
    description: 'Interne productie: slacht, uitsnij, Mini-SVASO en sub-cuts',
    colorClass: 'blue',
  },
  {
    key: 'cuno_moormann',
    label: 'Cuno Moormann (Extern)',
    description: 'Externe verwerker met dynamische joint products en versnijdtoeslag',
    colorClass: 'purple',
  },
  {
    key: 'crisp',
    label: 'Crisp (Griller Direct)',
    description: 'Hele kip verkoop — 1 joint product, geen uitsnij',
    colorClass: 'green',
  },
  {
    key: 'picnic',
    label: 'Picnic (Multi-site)',
    description: 'Multi-site verwerkingsketen met routes via Cor Voet, Driessen, Storteboom',
    colorClass: 'orange',
  },
] as const;

export default function KostprijsOverviewPage() {
  const allBatches = getAllBatches();

  // Group by profile
  const byProfile = new Map<string, typeof allBatches>();
  for (const p of PROFILES) {
    byProfile.set(p.key, allBatches.filter(b => b.batch_profile === p.key));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-brand tracking-tight" style={{ color: 'var(--color-text-main)' }}>Kostprijs</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Kostprijsberekeningen per profiel &mdash; 7-level waterval van levend tot NRV
          </p>
        </div>
        <Link
          href="/oil/kostprijs/nieuwe-berekening"
          className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
          style={{ background: 'var(--color-oil-orange)' }}
        >
          + Nieuwe berekening
        </Link>
      </div>

      {/* Profile cards */}
      {PROFILES.map((p) => (
        <KostprijsProfileCard
          key={p.key}
          profile={p.key}
          label={p.label}
          description={p.description}
          colorClass={p.colorClass}
          calculations={byProfile.get(p.key) ?? []}
        />
      ))}

      {/* Info footer */}
      <div className="oil-card p-4 text-xs" style={{ color: 'var(--color-text-dim)' }}>
        <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>Kostprijsmodel:</span>{' '}
        L0 Landed &rarr; L1 Joint Cost Pool &rarr; L2 By-product Credit &rarr; L3 SVASO &rarr; L4 Mini-SVASO &rarr; L5 ABC &rarr; L6 SKU &rarr; L7 NRV
      </div>
    </div>
  );
}
