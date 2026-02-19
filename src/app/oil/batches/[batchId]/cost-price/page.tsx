/**
 * Cost Price Detail Page — Sprint 2
 *
 * SPRINT 2 CONTRACT:
 * - ✅ NRV kostprijsmodel per batch
 * - ✅ Tekstuele uitleg per stap: batch → joint cost → split-off → NRV
 * - ✅ Joint cost = ONLY live bird purchase
 * - ✅ Allocation ONLY via Sales Value at Split-Off (SVASO)
 * - ✅ NRV applied AFTER split-off
 * - ✅ NO weight-based allocation
 * - ✅ NO price advice or optimization
 * - ✅ Everything traceable to batch
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { generateCostExplanation } from '@/lib/engine';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

/**
 * Fetch NRV cost data for a batch
 */
async function getBatchNrvCosts(batchId: string) {
  const supabase = await createClient();

  // Get batch info
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('id, batch_ref, slaughter_date, status')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    return null;
  }

  // Get joint costs
  const { data: jointCosts } = await supabase
    .from('joint_costs')
    .select('*')
    .eq('batch_id', batchId);

  // Get NRV by SKU from view
  const { data: nrvData } = await supabase
    .from('v_batch_nrv_by_sku')
    .select('*')
    .eq('batch_id', batchId)
    .order('part_code');

  // Get split-off allocation from view
  const { data: splitoffData } = await supabase
    .from('v_batch_splitoff_allocation')
    .select('*')
    .eq('batch_id', batchId)
    .order('part_code');

  return {
    batch,
    jointCosts: jointCosts || [],
    nrvData: nrvData || [],
    splitoffData: splitoffData || [],
  };
}

export default async function CostPriceDetailPage({ params }: PageProps) {
  const { batchId } = await params;
  const data = await getBatchNrvCosts(batchId);

  if (!data) {
    notFound();
  }

  const { batch, jointCosts, nrvData, splitoffData } = data;

  // Calculate totals
  const totalJointCost = jointCosts.reduce((sum, jc) => sum + Number(jc.amount_eur || 0), 0);
  const totalNrvCost = nrvData.reduce((sum, n) => sum + Number(n.nrv_total_eur || 0), 0);
  const totalProcessingCosts = nrvData.reduce(
    (sum, n) => sum + (Number(n.extra_processing_cost_per_kg || 0) * Number(n.weight_kg || 0)),
    0
  );

  // Check if allocation factors sum to 1.0
  const totalAllocationPct = splitoffData.reduce(
    (sum, s) => sum + Number(s.allocation_pct || 0),
    0
  );
  const allocationIsValid = Math.abs(totalAllocationPct - 100) < 0.01;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/oil/batches/${batchId}`}
              className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:text-gray-600"
            >
              ← Batch {batch.batch_ref}
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            Kostprijsopbouw (NRV)
          </h2>
          <p className="text-gray-600 dark:text-gray-600 mt-1">
            Batch {batch.batch_ref} | Slachtdatum: {formatDate(batch.slaughter_date)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          allocationIsValid
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          Allocatie: {allocationIsValid ? 'VALID' : 'INVALID'}
        </span>
      </div>

      {/* Sprint 2 Contract Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800">Sprint 2: NRV Kostprijsmodel</h4>
        <ul className="mt-2 text-sm text-blue-700 space-y-1">
          <li>• <strong>SVASO:</strong> Allocatie op basis van marktwaarde (NIET gewicht)</li>
          <li>• <strong>Joint Cost:</strong> Alleen levende kip inkoop</li>
          <li>• <strong>NRV:</strong> Split-off kosten + verwerkingskosten</li>
        </ul>
      </div>

      {/* Step 1: Joint Cost */}
      <CostStep
        stepNumber={1}
        title="Joint Cost (Levende Kip Inkoop)"
        description="De gezamenlijke kosten worden verdeeld over alle onderdelen op basis van marktwaarde."
      >
        {jointCosts.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-500 italic">
            Geen joint costs geregistreerd voor deze batch.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Leverancier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Factuur</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jointCosts.map((jc) => (
                <tr key={jc.id}>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{jc.cost_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600">{jc.supplier || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600">{jc.invoice_ref || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                    {formatEur(jc.amount_eur)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Totaal Joint Cost
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100 text-right">
                  {formatEur(totalJointCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </CostStep>

      {/* Step 2: Split-Off Allocation (SVASO) */}
      <CostStep
        stepNumber={2}
        title="Split-Off Allocatie (SVASO)"
        description="Joint cost wordt verdeeld op basis van Sales Value at Split-Off. NIET op gewicht."
      >
        {splitoffData.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-500 italic">
            Geen split-off waarden geregistreerd. Voer batch_splitoff_values in.
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Onderdeel</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Gewicht (kg)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Marktprijs/kg</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Marktwaarde</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Allocatie %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Toegewezen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {splitoffData.map((s) => (
                  <tr key={s.splitoff_value_id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatPartName(s.part_code)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600 text-right">
                      {formatNumber(s.weight_kg)} kg
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600 text-right">
                      €{formatNumber(s.price_per_kg, 4)}/kg
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600 text-right">
                      {formatEur(s.sales_value_eur)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                      {formatNumber(s.allocation_pct, 2)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-bold">
                      {formatEur(s.allocated_joint_cost_eur)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Totaal
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold text-right ${
                    allocationIsValid ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {formatNumber(totalAllocationPct, 2)}%
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100 text-right">
                    {formatEur(totalJointCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {!allocationIsValid && (
              <div className="mt-2 text-sm text-red-600">
                ⚠ Allocatie percentages moeten optellen tot 100%. Huidige som: {formatNumber(totalAllocationPct, 2)}%
              </div>
            )}
          </>
        )}
      </CostStep>

      {/* Step 3: Processing Costs */}
      <CostStep
        stepNumber={3}
        title="Verwerkingskosten (ná Split-Off)"
        description="Kosten voor snijden, vacuüm, portioneren etc. worden toegevoegd NA de split-off allocatie."
      >
        <div className="text-sm text-gray-600 dark:text-gray-600 mb-4">
          Verwerkingskosten worden per kg berekend en toegevoegd aan de split-off kostprijs.
          Zie de NRV tabel hieronder voor de totalen per SKU.
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700 dark:text-gray-600">Totaal verwerkingskosten deze batch:</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatEur(totalProcessingCosts)}</span>
          </div>
        </div>
      </CostStep>

      {/* Step 4: NRV Cost Result */}
      <CostStep
        stepNumber={4}
        title="NRV Kostprijs (Resultaat)"
        description="NRV = Split-off kosten + Verwerkingskosten. Dit is de volledige productiekostprijs."
      >
        {nrvData.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-500 italic">
            Geen NRV data beschikbaar. Controleer of alle upstream tabellen zijn ingevuld.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Onderdeel</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Split-off/kg</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">+ Verwerking/kg</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">= NRV/kg</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-500 uppercase">Totaal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {nrvData.map((n, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:bg-gray-900">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {n.sku || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600">
                    {formatPartName(n.part_code)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600 text-right">
                    €{formatNumber(n.cost_per_kg_splitoff, 4)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-600 text-right">
                    €{formatNumber(n.extra_processing_cost_per_kg, 4)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                    €{formatNumber(n.nrv_cost_per_kg, 4)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-bold">
                    {formatEur(n.nrv_total_eur)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Totaal NRV
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100 text-right">
                  {formatEur(totalNrvCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </CostStep>

      {/* Cost Formula Summary */}
      <div className="bg-gray-900 text-white rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4">Kostprijsformule (Sprint 2)</h4>
        <div className="font-mono text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-500">1.</span>
            <span>Allocatie Factor = Marktwaarde / Σ Marktwaarde</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-500">2.</span>
            <span>Split-off Cost = Joint Cost × Allocatie Factor</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-500">3.</span>
            <span>NRV Cost/kg = (Split-off Cost / gewicht) + Verwerking/kg</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400 dark:text-gray-500">
          Methodes: allocation_method = SVASO | costing_method = NRV
        </div>
      </div>

      {/* Data Source Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-800">Data Bronnen (Sprint 2)</p>
        <ul className="mt-2 text-blue-600 space-y-1">
          <li>• Joint Costs: joint_costs (cost_type = live_bird_purchase)</li>
          <li>• Split-Off: v_batch_splitoff_allocation (batch_splitoff_values)</li>
          <li>• Part Cost: v_batch_part_cost</li>
          <li>• NRV: v_batch_nrv_by_sku (processing_costs)</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Cost Step Component
 */
function CostStep({
  stepNumber,
  title,
  description,
  children,
}: {
  stepNumber: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
            {stepNumber}
          </span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/**
 * Format helpers
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatEur(value: number | null | undefined): string {
  if (value == null) return '-';
  return `€${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value == null) return '-';
  return Number(value).toLocaleString('nl-NL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPartName(part: string | null): string {
  if (!part) return '-';
  const names: Record<string, string> = {
    breast_cap: 'Borstkap',
    leg_quarter: 'Achterkwartier',
    wings: 'Vleugels',
    back_carcass: 'Karkas/Rug',
    offal: 'Organen',
  };
  return names[part] || part;
}
