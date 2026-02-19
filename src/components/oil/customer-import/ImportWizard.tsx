'use client';

/**
 * ImportWizard — Hoofd client-component voor klantprofiel import.
 *
 * 4-staps state machine:
 * 1. Upload → parse Excel
 * 2. Mapping review → resolve artikelcodes
 * 3. Preview → toon aggregatie
 * 4. Resultaat → cherry-picker analyse
 */

import { useState, useCallback } from 'react';
import type { CherryPickerAnalysis, CustomerProductMix } from '@/lib/engine/cherry-picker';
import {
  type ExactSalesRow,
  type MappedSalesRow,
  type ArtikelMapping,
  type SplitRule,
  type ExcludedItem,
  resolveArtikelMappings,
  aggregateToProductMix,
  runImportAnalysis,
  getAllMappings,
  getAllSplitRules,
  addUserMapping,
  addUserSplitRule,
  generateImportId,
  saveImport,
} from '@/lib/data/customer-import-store';
import { FileUploadStep } from './FileUploadStep';
import { MappingReviewStep } from './MappingReviewStep';
import { PreviewStep } from './PreviewStep';
import { AnalysisResultStep } from './AnalysisResultStep';

type WizardStep = 'upload' | 'mapping' | 'preview' | 'result';

const STEP_LABELS: Record<WizardStep, string> = {
  upload: '1. Upload',
  mapping: '2. Mapping',
  preview: '3. Preview',
  result: '4. Resultaat',
};

const STEPS: WizardStep[] = ['upload', 'mapping', 'preview', 'result'];

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>('upload');

  // Stap 1 data
  const [parsedRows, setParsedRows] = useState<ExactSalesRow[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [filename, setFilename] = useState('');

  // Stap 2 data
  const [mappedRows, setMappedRows] = useState<MappedSalesRow[]>([]);
  const [unmappedCodes, setUnmappedCodes] = useState<string[]>([]);
  const [activeSplitRules, setActiveSplitRules] = useState<Record<string, SplitRule>>(getAllSplitRules());

  // Stap 3 data
  const [productMix, setProductMix] = useState<CustomerProductMix[]>([]);
  const [excludedItems, setExcludedItems] = useState<ExcludedItem[]>([]);
  const [totalKg, setTotalKg] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExcludedRevenue, setTotalExcludedRevenue] = useState(0);

  // Stap 4 data
  const [analysis, setAnalysis] = useState<CherryPickerAnalysis | null>(null);

  // ---- Stap 1 → Stap 2 ----
  const handleUploadComplete = useCallback((data: {
    rows: ExactSalesRow[];
    customerName: string;
    filename: string;
  }) => {
    setParsedRows(data.rows);
    setCustomerName(data.customerName);
    setFilename(data.filename);

    // Run initial mapping
    const allMappings = getAllMappings();
    const { mapped, unmappedCodes: unmapped } = resolveArtikelMappings(data.rows, allMappings);
    setMappedRows(mapped);
    setUnmappedCodes(unmapped);

    setStep('mapping');
  }, []);

  // ---- Stap 2 → Stap 3 ----
  const handleMappingConfirm = useCallback((
    updatedMappings: ArtikelMapping[],
    updatedSplitRules: Record<string, SplitRule>
  ) => {
    // Sla user mappings op
    for (const mapping of updatedMappings) {
      addUserMapping(mapping);
    }
    for (const [key, rule] of Object.entries(updatedSplitRules)) {
      if (key.startsWith('custom_')) {
        addUserSplitRule(rule);
      }
    }

    // Re-resolve met bijgewerkte mappings
    const allMappings = getAllMappings();
    const mergedSplitRules = { ...getAllSplitRules(), ...updatedSplitRules };
    setActiveSplitRules(mergedSplitRules);

    const { mapped } = resolveArtikelMappings(parsedRows, allMappings);
    setMappedRows(mapped);
    setUnmappedCodes([]);

    // Aggregeer
    const result = aggregateToProductMix(mapped, mergedSplitRules);
    setProductMix(result.productMix);
    setExcludedItems(result.excludedItems);
    setTotalKg(result.totalKg);
    setTotalRevenue(result.totalRevenue);
    setTotalExcludedRevenue(result.totalExcludedRevenue);

    setStep('preview');
  }, [parsedRows]);

  // ---- Stap 3 → Stap 4 ----
  const handleAnalyze = useCallback(() => {
    const importId = generateImportId();
    const result = runImportAnalysis(importId, customerName, productMix);
    setAnalysis(result);

    // Sla op in store
    saveImport({
      import_id: importId,
      customer_name: customerName,
      import_date: new Date().toISOString(),
      source_filename: filename,
      raw_rows: parsedRows,
      mapped_rows: mappedRows,
      unmapped_codes: [],
      product_mix: productMix,
      excluded_items: excludedItems,
      total_kg: totalKg,
      total_revenue: totalRevenue,
      total_excluded_revenue: totalExcludedRevenue,
      analysis: result,
    });

    setStep('result');
  }, [customerName, productMix, filename, parsedRows, mappedRows, excludedItems, totalKg, totalRevenue, totalExcludedRevenue]);

  // ---- Reset ----
  const handleNewImport = useCallback(() => {
    setParsedRows([]);
    setCustomerName('');
    setFilename('');
    setMappedRows([]);
    setUnmappedCodes([]);
    setProductMix([]);
    setExcludedItems([]);
    setTotalKg(0);
    setTotalRevenue(0);
    setTotalExcludedRevenue(0);
    setAnalysis(null);
    setStep('upload');
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => {
          const isActive = s === step;
          const isPast = STEPS.indexOf(s) < STEPS.indexOf(step);
          return (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isPast
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
              }`}>
                {isPast ? '✓' : i + 1}
                <span className="hidden sm:inline">{STEP_LABELS[s].split('. ')[1]}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${
                  isPast ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 'upload' && (
        <FileUploadStep onComplete={handleUploadComplete} />
      )}

      {step === 'mapping' && (
        <MappingReviewStep
          mappedRows={mappedRows}
          unmappedCodes={unmappedCodes}
          splitRules={activeSplitRules}
          onConfirm={handleMappingConfirm}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          customerName={customerName}
          productMix={productMix}
          excludedItems={excludedItems}
          totalKg={totalKg}
          totalRevenue={totalRevenue}
          totalExcludedRevenue={totalExcludedRevenue}
          onAnalyze={handleAnalyze}
          onBack={() => setStep('mapping')}
        />
      )}

      {step === 'result' && analysis && (
        <AnalysisResultStep
          analysis={analysis}
          onNewImport={handleNewImport}
          onBack={() => setStep('preview')}
        />
      )}
    </div>
  );
}
