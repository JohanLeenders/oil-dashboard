/**
 * Batch Detail Page — Sprint 1
 *
 * SPRINT 1 CONTRACT:
 * - ✅ Massabalans-tabel is LEIDEND (not Sankey)
 * - ✅ Delta-indicator altijd zichtbaar
 * - ✅ Sankey is optioneel/uitleg, niet leidend
 * - ✅ Read-only display
 * - ✅ Data uit v_effective_* views
 * - ✅ THT via engine (70/90 Blueprint)
 * - ✅ Geen kostprijs, voorraad of klantlogica
 * - ✅ Alle cijfers herleidbaar tot uploads
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBatchDetail, getBatchMassBalance } from '@/lib/actions/batches';
import { ThtThermometer } from '@/components/ui/ThtThermometer';
import { DataStatusBadge } from '@/components/ui/StatusBadge';
import { MassBalanceSankey } from '@/components/charts/MassBalanceSankey';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function BatchDetailPage({ params }: PageProps) {
  const { batchId } = await params;
  const detail = await getBatchDetail(batchId);

  if (!detail) {
    notFound();
  }

  const { batch, massBalance, yields, costs, tht, validation } = detail;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/oil/batches"
              className="text-gray-500 hover:text-gray-700"
            >
              ← Batches
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">
            Batch {batch.batch_ref}
          </h2>
          <p className="text-gray-600 mt-1">
            Slachtdatum: {formatDate(batch.slaughter_date)} | Status: {batch.status}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/oil/batches/${batch.id}/cost-price`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kostprijs (NRV)
          </Link>
          <DataStatusBadge status={validation.data_status as any} />
        </div>
      </div>

      {/* Mass Balance Status Line */}
      <MassBalanceStatusLine
        isValid={validation.is_valid}
        dataStatus={validation.data_status}
        warningCount={validation.warnings.length}
      />

      {/* Validation Details (expandable when NEEDS_REVIEW) */}
      {validation.data_status === 'NEEDS_REVIEW' && validation.warnings.length > 0 && (
        <ValidationDetailsBlock warnings={validation.warnings} />
      )}

      {/* ================================================================
          SPRINT 1: MASSABALANS-TABEL (LEIDEND)
          Dit is de primaire waarheid-weergave per Sprint 1 contract
          ================================================================ */}
      {massBalance && (
        <MassBalanceTable
          massBalance={massBalance}
          batch={batch}
        />
      )}

      {/* KPIs + THT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* THT Thermometer */}
        <ThtThermometer
          status={tht.status}
          elapsedPct={tht.elapsed_pct}
          daysRemaining={tht.days_remaining}
          urgencyLabel={tht.urgency_label}
        />

        {/* Weight KPIs */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-4">Gewichten</h4>
          <div className="space-y-3">
            <KpiRow
              label="Levend gewicht"
              value={`${batch.live_weight_kg.toLocaleString('nl-NL')} kg`}
            />
            <KpiRow
              label="Griller gewicht"
              value={batch.griller_weight_kg
                ? `${batch.griller_weight_kg.toLocaleString('nl-NL')} kg`
                : '-'}
            />
            <KpiRow
              label="Griller yield"
              value={batch.griller_yield_pct
                ? `${batch.griller_yield_pct.toFixed(2)}%`
                : '-'}
              highlight={batch.griller_yield_pct != null && batch.griller_yield_pct < 70}
            />
            <KpiRow
              label="Aantal kippen"
              value={batch.bird_count.toLocaleString('nl-NL')}
            />
          </div>
        </div>

        {/* Loss KPIs */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-4">Verliesstromen</h4>
          <div className="space-y-3">
            <KpiRow
              label="Afkeur/DOA"
              value={`${batch.rejection_kg.toLocaleString('nl-NL')} kg`}
            />
            <KpiRow
              label="Slachtafval"
              value={`${batch.slaughter_waste_kg.toLocaleString('nl-NL')} kg`}
            />
            {massBalance && (
              <KpiRow
                label="Onverklaard"
                value={`${massBalance.loss_unaccounted.toLocaleString('nl-NL')} kg`}
                highlight={batch.griller_weight_kg != null && massBalance.loss_unaccounted > batch.griller_weight_kg * 0.05}
              />
            )}
          </div>
        </div>
      </div>

      {/* True-Up Delta Section */}
      {yields.length > 0 && (
        <TrueUpDeltaSection yields={yields} />
      )}

      {/* ================================================================
          Sankey Diagram (OPTIONEEL - uitleg, niet leidend)
          Per Sprint 1: "Optioneel: Sankey (uitleg, niet leidend)"
          ================================================================ */}
      {massBalance && (
        <details className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
            Massabalans Flow Diagram (uitleg) — Klik om te tonen
          </summary>
          <div className="p-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              Dit diagram is een visuele uitleg van de massabalans. De tabel hierboven is leidend.
            </p>
            <MassBalanceSankey massBalance={massBalance} />
          </div>
        </details>
      )}

      {/* Yields Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Cut-Up Yields (Effective)
          </h3>
          <p className="text-sm text-gray-500">
            Data uit v_effective_batch_yields (correcties geresolved)
          </p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Onderdeel
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Gewicht (kg)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Yield %
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Target
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Delta
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {yields.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Geen yield data beschikbaar
                </td>
              </tr>
            ) : (
              yields.map((y, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatPartName(y.anatomical_part)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {y.actual_weight_kg.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {y.yield_pct ? `${y.yield_pct.toFixed(2)}%` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 text-right">
                    {y.target_yield_min && y.target_yield_max
                      ? `${y.target_yield_min}-${y.target_yield_max}%`
                      : '-'}
                  </td>
                  <td className={`px-6 py-4 text-sm text-right font-medium ${
                    y.delta_from_target
                      ? y.delta_from_target > 0 ? 'text-green-600' : 'text-red-600'
                      : 'text-gray-400'
                  }`}>
                    {y.delta_from_target
                      ? `${y.delta_from_target > 0 ? '+' : ''}${y.delta_from_target.toFixed(2)}%`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${
                      y.data_status === 'CORRECTED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {y.data_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Costs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Kosten (Effective)
          </h3>
          <p className="text-sm text-gray-500">
            Data uit v_effective_batch_costs (adjustments geresolved)
          </p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Omschrijving
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Bedrag
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Factuur
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {costs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Geen kostendata beschikbaar
                </td>
              </tr>
            ) : (
              costs.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 capitalize">
                    {c.cost_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {c.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    €{c.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {c.invoice_ref || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${
                      c.cost_status === 'ADJUSTMENT'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {c.cost_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {costs.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900">Totaal</span>
              <span className="font-bold text-gray-900">
                €{costs.reduce((sum, c) => sum + c.amount, 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-800">Data Bronnen</p>
        <ul className="mt-2 text-blue-600 space-y-1">
          <li>• Yields: v_effective_batch_yields</li>
          <li>• Costs: v_effective_batch_costs</li>
          <li>• Mass Balance: v_batch_mass_balance</li>
          <li>• THT: Engine berekening (70/90 thresholds)</li>
        </ul>
      </div>
    </div>
  );
}

function KpiRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatPartName(part: string): string {
  const names: Record<string, string> = {
    breast_cap: 'Borstkap',
    leg_quarter: 'Achterkwartier',
    wings: 'Vleugels',
    back_carcass: 'Karkas/Rug',
    offal: 'Organen',
  };
  return names[part] || part;
}

/**
 * Mass Balance Status Line
 * Shows OK or NEEDS_REVIEW status prominently
 */
function MassBalanceStatusLine({
  isValid,
  dataStatus,
  warningCount,
}: {
  isValid: boolean;
  dataStatus: string;
  warningCount: number;
}) {
  const isOk = isValid && dataStatus !== 'NEEDS_REVIEW';

  return (
    <div className={`rounded-lg p-4 flex items-center justify-between ${
      isOk
        ? 'bg-green-50 border border-green-200'
        : 'bg-yellow-50 border border-yellow-200'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`text-2xl ${isOk ? 'text-green-600' : 'text-yellow-600'}`}>
          {isOk ? '✓' : '⚠'}
        </span>
        <div>
          <p className={`font-semibold ${isOk ? 'text-green-800' : 'text-yellow-800'}`}>
            Massabalans: {isOk ? 'OK' : 'NEEDS_REVIEW'}
          </p>
          <p className={`text-sm ${isOk ? 'text-green-600' : 'text-yellow-600'}`}>
            {isOk
              ? 'Alle balansen kloppen binnen tolerantie'
              : `${warningCount} aandachtspunt${warningCount !== 1 ? 'en' : ''} gevonden`}
          </p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
        isOk
          ? 'bg-green-100 text-green-700'
          : 'bg-yellow-100 text-yellow-700'
      }`}>
        {dataStatus}
      </span>
    </div>
  );
}

/**
 * Validation Details Block (expandable)
 * Shows when NEEDS_REVIEW
 */
function ValidationDetailsBlock({ warnings }: { warnings: string[] }) {
  return (
    <details className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
      <summary className="px-4 py-3 cursor-pointer font-medium text-yellow-800 hover:bg-yellow-100 transition-colors">
        Validatie Details ({warnings.length} items) - Klik om te tonen
      </summary>
      <div className="px-4 pb-4 pt-2 border-t border-yellow-200">
        <ul className="space-y-2">
          {warnings.map((warning, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-yellow-700">
              <span className="text-yellow-500 mt-0.5">•</span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-yellow-600">
          Handmatige controle aanbevolen. Data wordt NIET automatisch gecorrigeerd.
        </p>
      </div>
    </details>
  );
}

/**
 * True-Up Delta Section
 * Shows yield deviations from target
 */
function TrueUpDeltaSection({
  yields,
}: {
  yields: Array<{
    anatomical_part: string;
    yield_pct: number | null;
    target_yield_min: number | null;
    target_yield_max: number | null;
    delta_from_target: number | null;
  }>;
}) {
  // Filter yields with delta data
  const yieldsWithDelta = yields.filter(y => y.delta_from_target !== null);

  if (yieldsWithDelta.length === 0) {
    return null;
  }

  // Calculate total delta impact
  const totalDelta = yieldsWithDelta.reduce((sum, y) => sum + (y.delta_from_target || 0), 0);
  const avgDelta = totalDelta / yieldsWithDelta.length;

  // Count over/under performers
  const overPerformers = yieldsWithDelta.filter(y => (y.delta_from_target || 0) > 0).length;
  const underPerformers = yieldsWithDelta.filter(y => (y.delta_from_target || 0) < 0).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-500 mb-4">True-Up Delta Analyse</h4>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className={`text-2xl font-bold ${avgDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {avgDelta >= 0 ? '+' : ''}{avgDelta.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500">Gem. Delta</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{overPerformers}</p>
          <p className="text-xs text-gray-500">Boven target</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">{underPerformers}</p>
          <p className="text-xs text-gray-500">Onder target</p>
        </div>
      </div>

      {/* Delta bars */}
      <div className="space-y-2">
        {yieldsWithDelta.map((y, i) => {
          const delta = y.delta_from_target || 0;
          const absWidth = Math.min(Math.abs(delta) * 10, 100);

          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-24 text-xs text-gray-600 truncate">
                {formatPartName(y.anatomical_part)}
              </span>
              <div className="flex-1 h-4 bg-gray-100 rounded relative">
                <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300" />
                {delta !== 0 && (
                  <div
                    className={`absolute inset-y-0 rounded ${
                      delta > 0 ? 'bg-green-400 left-1/2' : 'bg-red-400 right-1/2'
                    }`}
                    style={{ width: `${absWidth / 2}%` }}
                  />
                )}
              </div>
              <span className={`w-16 text-xs text-right font-medium ${
                delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'
              }`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Sprint 1: Mass Balance Table (LEIDEND)
 * Dit is de primaire waarheid-weergave voor de massabalans
 * Alle cijfers herleidbaar tot uploads
 */
function MassBalanceTable({
  massBalance,
  batch,
}: {
  massBalance: {
    source_live_weight: number;
    loss_rejection: number;
    loss_slaughter: number;
    node_griller: number;
    node_breast_cap: number;
    node_leg_quarter: number;
    node_wings: number;
    node_back_carcass: number;
    node_offal: number;
    loss_unaccounted: number;
    data_status?: string;
  };
  batch: {
    live_weight_kg: number;
    griller_weight_kg: number | null;
  };
}) {
  // Level 1: Live → Griller
  const level1Input = massBalance.source_live_weight;
  const level1Output = massBalance.node_griller + massBalance.loss_rejection + massBalance.loss_slaughter;
  const level1Delta = level1Input - level1Output;

  // Level 2: Griller → Parts
  const totalParts =
    massBalance.node_breast_cap +
    massBalance.node_leg_quarter +
    massBalance.node_wings +
    massBalance.node_back_carcass +
    massBalance.node_offal;
  const level2Input = massBalance.node_griller;
  const level2Delta = massBalance.loss_unaccounted;

  // Delta indicator style
  const getDeltaStyle = (delta: number, total: number) => {
    const pct = total > 0 ? Math.abs(delta / total) * 100 : 0;
    if (Math.abs(delta) < 0.1) return 'text-green-600 bg-green-50';
    if (pct < 2) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-blue-200 bg-blue-50">
        <h3 className="text-lg font-bold text-blue-900">
          Massabalans-Tabel (LEIDEND)
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          Alle cijfers herleidbaar tot slachtrendement-uploads. Delta&apos;s blijven zichtbaar.
        </p>
      </div>

      {/* Level 1: Live → Griller */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Niveau 1: Levend → Griller
        </h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-2">Stroom</th>
              <th className="pb-2 text-right">Gewicht (kg)</th>
              <th className="pb-2 text-right">% van levend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="font-medium">
              <td className="py-2">Input: Levend gewicht</td>
              <td className="py-2 text-right">{massBalance.source_live_weight.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">100.00%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Griller</td>
              <td className="py-2 text-right">{massBalance.node_griller.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level1Input > 0 ? ((massBalance.node_griller / level1Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Afkeur/DOA</td>
              <td className="py-2 text-right">{massBalance.loss_rejection.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level1Input > 0 ? ((massBalance.loss_rejection / level1Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Slachtafval</td>
              <td className="py-2 text-right">{massBalance.loss_slaughter.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level1Input > 0 ? ((massBalance.loss_slaughter / level1Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr className={`font-semibold ${getDeltaStyle(level1Delta, level1Input)}`}>
              <td className="py-2">DELTA (Input - Output)</td>
              <td className="py-2 text-right">{level1Delta.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level1Input > 0 ? ((level1Delta / level1Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Level 2: Griller → Parts */}
      <div className="px-6 py-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Niveau 2: Griller → Onderdelen
        </h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-2">Stroom</th>
              <th className="pb-2 text-right">Gewicht (kg)</th>
              <th className="pb-2 text-right">% van griller</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="font-medium">
              <td className="py-2">Input: Griller</td>
              <td className="py-2 text-right">{massBalance.node_griller.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">100.00%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Borstkap</td>
              <td className="py-2 text-right">{massBalance.node_breast_cap.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level2Input > 0 ? ((massBalance.node_breast_cap / level2Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Achterkwartier</td>
              <td className="py-2 text-right">{massBalance.node_leg_quarter.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level2Input > 0 ? ((massBalance.node_leg_quarter / level2Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Vleugels</td>
              <td className="py-2 text-right">{massBalance.node_wings.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level2Input > 0 ? ((massBalance.node_wings / level2Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Karkas/Rug</td>
              <td className="py-2 text-right">{massBalance.node_back_carcass.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level2Input > 0 ? ((massBalance.node_back_carcass / level2Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-gray-600">→ Organen</td>
              <td className="py-2 text-right">{massBalance.node_offal.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level2Input > 0 ? ((massBalance.node_offal / level2Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr className="font-medium border-t border-gray-200">
              <td className="py-2">Subtotaal onderdelen</td>
              <td className="py-2 text-right">{totalParts.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level2Input > 0 ? ((totalParts / level2Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
            <tr className={`font-semibold ${getDeltaStyle(level2Delta, level2Input)}`}>
              <td className="py-2">DELTA (Onverklaard)</td>
              <td className="py-2 text-right">{level2Delta.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 text-right">{level2Input > 0 ? ((level2Delta / level2Input) * 100).toFixed(2) : '0.00'}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Data source info */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Bron: v_batch_mass_balance (v_effective_batch_yields) | Data Status: {massBalance.data_status || 'UNKNOWN'}
      </div>
    </div>
  );
}
