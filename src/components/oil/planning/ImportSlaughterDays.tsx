'use client';

/**
 * ImportSlaughterDays — Upload opzetplanning PDF's en importeer slachtdagen
 *
 * Workflow:
 * 1. Gebruiker uploadt PDF van opzetplanning (bijv. Groenestege, Klein Hurksveld)
 * 2. PDF wordt client-side geparsed (tekst extractie)
 * 3. Gebruiker vult locatienaam + gem. gewicht in
 * 4. Preview van gevonden slachtdagen
 * 5. Importeer naar database (merge als datum al bestaat)
 */

import { useState, useCallback } from 'react';
import { importSlaughterDays, clearSlaughterCalendar } from '@/lib/actions/planning';
import { parseOpzetplanning } from '@/lib/utils/parseOpzetplanning';
import type { SlaughterDayImport } from '@/lib/utils/parseOpzetplanning';

interface ImportResult {
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}

export default function ImportSlaughterDays({ onImportComplete }: { onImportComplete?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [pdfText, setPdfText] = useState('');
  const [locationName, setLocationName] = useState('');
  const [avgWeight, setAvgWeight] = useState('2.65');
  const [parsedDays, setParsedDays] = useState<SlaughterDayImport[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Gebruik FileReader om PDF text te lezen
    // Voor echte PDF parsing zou je pdf.js nodig hebben, maar de opzetplanningen
    // kunnen ook als tekst worden geplakt (copy-paste uit PDF viewer)
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setPdfText(text);
    } else {
      // PDF — vraag gebruiker om tekst te plakken
      setPasteMode(true);
    }
  }, []);

  const handleParse = useCallback(() => {
    if (!pdfText || !locationName) return;

    const days = parseOpzetplanning(pdfText, locationName, parseFloat(avgWeight) || 2.65);
    setParsedDays(days);
    setStep('preview');
  }, [pdfText, locationName, avgWeight]);

  const handleImport = useCallback(async () => {
    if (parsedDays.length === 0) return;

    setIsLoading(true);
    try {
      const importResult = await importSlaughterDays(parsedDays);
      setResult(importResult);
      setStep('result');
      if (importResult.errors.length === 0) {
        onImportComplete?.();
      }
    } catch (err) {
      setResult({ inserted: 0, updated: 0, rejected: 0, errors: [`Onverwachte fout: ${err}`] });
      setStep('result');
    } finally {
      setIsLoading(false);
    }
  }, [parsedDays, onImportComplete]);

  const handleClear = useCallback(async () => {
    if (!confirm('Weet je zeker dat je ALLE slachtdagen wilt verwijderen? Dit kan niet ongedaan worden.')) return;

    setIsLoading(true);
    try {
      const clearResult = await clearSlaughterCalendar();
      if (clearResult.error) {
        alert(`Fout: ${clearResult.error}`);
      } else {
        alert(`${clearResult.deleted} slachtdagen verwijderd.`);
        onImportComplete?.();
      }
    } finally {
      setIsLoading(false);
    }
  }, [onImportComplete]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setPdfText('');
    setLocationName('');
    setAvgWeight('2.65');
    setParsedDays([]);
    setResult(null);
    setPasteMode(false);
  }, []);

  if (!isOpen) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Importeer opzetplanning
        </button>
        <button
          onClick={handleClear}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Wis alles
        </button>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Slachtdagen importeren vanuit opzetplanning
        </h3>
        <button onClick={() => { setIsOpen(false); handleReset(); }} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Plak de tekst uit een opzetplanning PDF (Storteboom/mester). De parser herkent automatisch
            rondenummers, stallen, opzetaantallen en vermoedelijke slachtdatums.
          </p>

          {/* Locatie naam */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mester / Locatie naam *
            </label>
            <input
              type="text"
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              placeholder="bijv. Klein Hurksveld, Groenestege"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Gem. gewicht */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gem. levend gewicht (kg/dier)
            </label>
            <input
              type="number"
              step="0.01"
              value={avgWeight}
              onChange={e => setAvgWeight(e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <span className="ml-2 text-xs text-gray-500">757 S (Hubbard): ~2.65 kg | RRG: ~2.80 kg</span>
          </div>

          {/* Tekst plakken */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Plak opzetplanning tekst *
            </label>
            <textarea
              value={pdfText}
              onChange={e => setPdfText(e.target.value)}
              rows={12}
              placeholder={`Plak hier de tekst uit de opzetplanning PDF...\n\nVoorbeeld:\nRondenummer: 18 (na 20 dagen leegstand)\n1  MA  29-12-2025  2.000  MA  23-2-2026  56  1.980  757 S  ORHO  MORPUT  FORFA\n2  MA  29-12-2025  3.600  MA  23-2-2026  56  3.564  757 S  ORHO  MORPUT  FORFA`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Of upload txt bestand */}
          <div className="text-sm text-gray-500">
            Of upload een .txt bestand:
            <input
              type="file"
              accept=".txt,.text"
              onChange={handleFileUpload}
              className="ml-2 text-sm"
            />
          </div>

          <button
            onClick={handleParse}
            disabled={!pdfText || !locationName}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Analyseer &rarr;
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-600">
              ✓ {parsedDays.length} slachtdag{parsedDays.length !== 1 ? 'en' : ''} gevonden
            </span>
            <span className="text-sm text-gray-500">voor {locationName}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Slachtdatum</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Dieren</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Gewicht (kg)</th>
                  <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Stallen</th>
                  <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Opmerking</th>
                </tr>
              </thead>
              <tbody>
                {parsedDays.map((day, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 font-mono">{day.slaughter_date}</td>
                    <td className="py-2 pr-4 text-right">{day.expected_birds.toLocaleString('nl-NL')}</td>
                    <td className="py-2 pr-4 text-right">{day.expected_live_weight_kg.toLocaleString('nl-NL')}</td>
                    <td className="py-2">{day.mester_breakdown.length} stallen</td>
                    <td className="py-2 text-gray-500 text-xs">{day.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Als een slachtdatum al bestaat in de database, worden de stallen samengevoegd (merge).
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              &larr; Terug
            </button>
            <button
              onClick={handleImport}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Importeren...' : `Importeer ${parsedDays.length} slachtdagen`}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${result.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
            <p className="text-sm font-medium">
              {result.errors.length === 0 ? '✅ Import succesvol!' : '⚠️ Import voltooid met fouten'}
            </p>
            <ul className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {result.inserted > 0 && <li>✓ {result.inserted} nieuwe slachtdag{result.inserted !== 1 ? 'en' : ''} toegevoegd</li>}
              {result.updated > 0 && <li>✓ {result.updated} bestaande slachtdag{result.updated !== 1 ? 'en' : ''} bijgewerkt</li>}
              {result.rejected > 0 && <li>⚠ {result.rejected} rij{result.rejected !== 1 ? 'en' : ''} afgekeurd</li>}
              {result.errors.map((err, i) => <li key={i} className="text-red-600">✗ {err}</li>)}
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { handleReset(); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Nog een import
            </button>
            <button
              onClick={() => { setIsOpen(false); handleReset(); window.location.reload(); }}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              Sluiten &amp; vernieuwen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}