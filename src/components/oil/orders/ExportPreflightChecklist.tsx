'use client';

/**
 * ExportPreflightChecklist — Validated "launch sequence" for Storteboom export (UX-4)
 *
 * Shows a compact pre-flight checklist with green/red indicators.
 * Export CTA disabled (gray) until all error-level checks pass.
 * Warning-level checks show orange but don't block.
 * Failed checks can optionally scroll to the relevant section.
 */

interface PreflightCheck {
  label: string;
  passed: boolean;
  severity: 'error' | 'warning';
  scrollTo?: string; // CSS selector or element id
}

interface ExportPreflightChecklistProps {
  checks: PreflightCheck[];
  onExport: () => void;
  isExporting: boolean;
  isLoading?: boolean;
}

export default function ExportPreflightChecklist({
  checks,
  onExport,
  isExporting,
  isLoading = false,
}: ExportPreflightChecklistProps) {
  const hasErrors = checks.some((c) => !c.passed && c.severity === 'error');
  const hasWarnings = checks.some((c) => !c.passed && c.severity === 'warning');
  const allPassed = checks.every((c) => c.passed);
  const canExport = !hasErrors && !isExporting && !isLoading;

  const handleScrollTo = (selector?: string) => {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="oil-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">&#128640;</span>
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-main)' }}
        >
          Export Bestelschema
        </h3>
      </div>

      {/* Checklist */}
      {isLoading ? (
        <div
          className="py-3 text-center text-xs animate-pulse"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Pre-flight checks uitvoeren...
        </div>
      ) : (
        <div className="space-y-1.5">
          {checks.map((check, i) => {
            const icon = check.passed
              ? '\u2713'
              : check.severity === 'error'
                ? '\u2717'
                : '\u26A0';
            const color = check.passed
              ? 'var(--color-data-green)'
              : check.severity === 'error'
                ? 'var(--color-data-red)'
                : 'var(--color-oil-orange)';

            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="text-xs font-bold w-4 text-center shrink-0"
                  style={{ color }}
                >
                  {icon}
                </span>
                {!check.passed && check.scrollTo ? (
                  <button
                    type="button"
                    onClick={() => handleScrollTo(check.scrollTo)}
                    className="text-xs text-left underline decoration-dotted underline-offset-2 transition-colors"
                    style={{ color }}
                  >
                    {check.label}
                  </button>
                ) : (
                  <span
                    className="text-xs"
                    style={{
                      color: check.passed
                        ? 'var(--color-text-muted)'
                        : color,
                    }}
                  >
                    {check.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Separator */}
      <div style={{ borderTop: '1px solid var(--color-border-subtle)' }} />

      {/* Export CTA */}
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport}
        className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition-all"
        style={{
          background: canExport
            ? allPassed
              ? 'var(--color-oil-orange)'
              : hasWarnings
                ? 'var(--color-oil-orange)'
                : 'var(--color-bg-elevated)'
            : 'var(--color-bg-elevated)',
          color: canExport ? '#fff' : 'var(--color-text-dim)',
          cursor: canExport ? 'pointer' : 'not-allowed',
          opacity: isExporting ? 0.6 : 1,
          boxShadow: canExport && allPassed
            ? '0 0 12px rgba(246, 126, 32, 0.4)'
            : 'none',
        }}
      >
        {isExporting
          ? 'Exporteren...'
          : isLoading
            ? 'Controleren...'
            : canExport
              ? 'Genereer Storteboom Excel'
              : 'Pre-flight checks niet voltooid'}
      </button>

      {/* Warning note when exporting with warnings */}
      {canExport && hasWarnings && !isExporting && (
        <p
          className="text-[10px] text-center"
          style={{ color: 'var(--color-oil-orange)' }}
        >
          Export mogelijk ondanks waarschuwingen
        </p>
      )}
    </div>
  );
}
