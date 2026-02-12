'use client';

/**
 * OIL Dashboard Error Boundary
 *
 * REGRESSIE-CHECK:
 * - ✅ Client component (required for error boundaries)
 * - ✅ Recovery via retry
 * - ✅ User-friendly Dutch messaging
 * - ✅ Geen mutations of data loss
 */

import { useEffect } from 'react';

export default function OilError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging (append-only, no mutations)
    console.error('[OIL Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="bg-white rounded-lg border border-red-200 p-8 max-w-lg text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Er ging iets mis
        </h2>
        <p className="text-gray-600 mb-4">
          {error.message.includes('fetch')
            ? 'Kan geen verbinding maken met de database. Controleer of Supabase bereikbaar is.'
            : error.message.includes('not found') || error.message.includes('404')
              ? 'De gevraagde data kon niet worden gevonden.'
              : 'Er is een onverwachte fout opgetreden bij het laden van deze pagina.'}
        </p>

        {/* Error digest for support */}
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">
            Ref: {error.digest}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Opnieuw proberen
          </button>
          <a
            href="/oil"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            Terug naar Dashboard
          </a>
        </div>

        {/* Technical details (collapsed) */}
        <details className="mt-6 text-left">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            Technische details
          </summary>
          <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded overflow-auto max-h-32">
            {error.message}
          </pre>
        </details>
      </div>
    </div>
  );
}
