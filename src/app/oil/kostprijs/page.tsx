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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Kostprijs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Kostprijsberekeningen per profiel &mdash; 7-level waterval van levend tot NRV
          </p>
        </div>
        <Link
          href="/oil/kostprijs/nieuwe-berekening"
          className="px-4 py-2 bg-oranje-500 text-white text-sm font-medium rounded-lg hover:bg-oranje-600 transition-colors shadow-sm"
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
      <div className="bg-gray-100/60 dark:bg-gray-800/60 rounded-xl p-4 text-xs text-gray-400">
        <span className="font-semibold text-gray-500 dark:text-gray-300">Kostprijsmodel:</span>{' '}
        L0 Landed &rarr; L1 Joint Cost Pool &rarr; L2 By-product Credit &rarr; L3 SVASO &rarr; L4 Mini-SVASO &rarr; L5 ABC &rarr; L6 SKU &rarr; L7 NRV
      </div>
    </div>
  );
}
