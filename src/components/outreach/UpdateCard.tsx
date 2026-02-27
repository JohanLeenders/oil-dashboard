'use client';

/**
 * UpdateCard — Displays an outreach update in the list view.
 * Shows title, status, template type, team info, and delivery stats.
 */

import type { OutreachUpdateWithDetails } from '@/types/outreach';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Concept', bg: 'rgba(161, 161, 170, 0.15)', color: 'var(--color-text-muted)' },
  ready: { label: 'Klaar', bg: 'rgba(255, 191, 0, 0.15)', color: 'var(--color-data-gold)' },
  sending: { label: 'Versturen...', bg: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-oil-orange)' },
  sent: { label: 'Verzonden', bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-data-green)' },
};

interface UpdateCardProps {
  update: OutreachUpdateWithDetails;
  onEdit: (id: string) => void;
}

export function UpdateCard({ update, onEdit }: UpdateCardProps) {
  const status = STATUS_CONFIG[update.status] ?? STATUS_CONFIG.draft;

  const timeAgo = getTimeAgo(update.updated_at);

  return (
    <div
      className="oil-card oil-card-interactive p-5 cursor-pointer"
      onClick={() => onEdit(update.id)}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--color-text-main)' }}
            >
              {update.title}
            </h3>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            {update.target_type === 'personal' && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(249, 115, 22, 0.1)',
                  color: 'var(--color-oil-orange)',
                }}
              >
                persoonlijk
              </span>
            )}
          </div>

          {/* Template type */}
          {update.template && update.template.template_type && (
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>
              {TEMPLATE_TYPE_LABELS[update.template.template_type] ?? update.template.template_type}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
            {update.created_by && (
              <span>door {update.created_by}</span>
            )}
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Right: stats */}
        {(update.status === 'sent' || update.status === 'ready' || update.status === 'sending') && update.recipient_count > 0 && (
          <div className="text-right shrink-0">
            <div className="flex items-center gap-3">
              <StatPill label="Verzonden" value={update.dispatched_count} color="var(--color-text-muted)" />
              <StatPill label="Afgeleverd" value={update.delivered_count} color="var(--color-data-green)" />
              {update.failed_count > 0 && (
                <StatPill label="Mislukt" value={update.failed_count} color="var(--color-data-red)" />
              )}
            </div>
          </div>
        )}

        {update.status === 'draft' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(update.id);
            }}
            className="text-xs shrink-0 px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--color-oil-orange)', background: 'rgba(249,115,22,0.1)' }}
          >
            Bewerken
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  wekelijkse_update: 'Wekelijkse update',
  batch_spotlight: 'Batch spotlight',
  persoonlijke_followup: 'Persoonlijke follow-up',
};

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div
        className="text-sm font-semibold"
        style={{ color, fontFamily: 'var(--font-mono, monospace)' }}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
        {label}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'zojuist';
  if (minutes < 60) return `${minutes}m geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d geleden`;
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
