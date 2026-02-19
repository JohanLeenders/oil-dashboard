'use client';

/**
 * FileUploadStep — Stap 1: Bestand uploaden + klantnaam
 */

import { useState, useCallback } from 'react';
import { parseExactSalesExport, type ExactSalesRow } from '@/lib/data/customer-import-store';

interface Props {
  onComplete: (data: {
    rows: ExactSalesRow[];
    customerName: string;
    filename: string;
  }) => void;
}

export function FileUploadStep({ onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    // Auto-fill klantnaam uit bestandsnaam
    const name = selectedFile.name.replace(/\.(xlsx?|xls)$/i, '');
    // Probeer klantnaam te extraheren (bijv. "8029033-Oranjehoen_B.V.-15-02-2026-SlsSalesAnalysis")
    const parts = name.split('-');
    if (parts.length >= 2) {
      // Neem het deel na het eerste nummer
      const namePart = parts.slice(1).find(p => !/^\d+$/.test(p) && !p.includes('SlsSales'));
      if (namePart) {
        setCustomerName(namePart.replace(/_/g, ' '));
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && /\.(xlsx?|xls)$/i.test(droppedFile.name)) {
      handleFile(droppedFile);
    } else {
      setError('Alleen Excel-bestanden (.xlsx, .xls) worden ondersteund.');
    }
  }, [handleFile]);

  const handleSubmit = async () => {
    if (!file) return;
    if (!customerName.trim()) {
      setError('Vul een klantnaam in.');
      return;
    }

    setParsing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const { rows, customerHint, errors } = parseExactSalesExport(buffer);

      if (errors.length > 0) {
        setError(errors.join('\n'));
        setParsing(false);
        return;
      }

      if (rows.length === 0) {
        setError('Geen productregels gevonden in het bestand.');
        setParsing(false);
        return;
      }

      // Update klantnaam als hint beschikbaar is en veld nog leeg
      const finalName = customerName.trim() || customerHint || 'Onbekende klant';

      onComplete({
        rows,
        customerName: finalName,
        filename: file.name,
      });
    } catch (err) {
      setError(`Fout bij het lezen van het bestand: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : file
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="space-y-2">
            <div className="text-3xl">📊</div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {file.name}
            </p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={() => { setFile(null); setCustomerName(''); }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Ander bestand kiezen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">📥</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sleep een Excel-bestand hierheen of{' '}
              <label className="text-blue-600 hover:text-blue-700 cursor-pointer underline">
                kies een bestand
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </p>
            <p className="text-xs text-gray-400">
              Exact Online → Verkoopanalyse → Excel export (.xlsx)
            </p>
          </div>
        )}
      </div>

      {/* Klantnaam */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Klantnaam
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Bijv. Zorg&Natuur BV"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || parsing}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium
                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {parsing ? 'Bezig met importeren...' : 'Importeer & Analyseer'}
      </button>
    </div>
  );
}
