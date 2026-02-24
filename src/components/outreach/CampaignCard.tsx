/**
 * CampaignCard — Wave 10 Outreach
 * Campaign summary with send progress and template pool.
 */

import type { OutreachCampaignWithTemplates } from '@/types/outreach';
import { DataBadge } from '@/components/oil/ui/DataBadge';

const CAMPAIGN_STATUS: Record<
  string,
  { label: string; variant: 'green' | 'orange' | 'red' | 'gold' | 'muted' }
> = {
  draft:     { label: 'Concept',   variant: 'muted'   },
  scheduled: { label: 'Gepland',   variant: 'gold'    },
  sending:   { label: 'Versturen', variant: 'orange'  },
  sent:      { label: 'Verzonden', variant: 'green'   },
  failed:    { label: 'Mislukt',   variant: 'red'     },
};

const CHANNEL_LABEL: Record<string, string> = {
  email:    '✉ Email',
  whatsapp: '💬 WhatsApp',
  both:     '✉ + 💬',
};

export function CampaignCard({ campaign }: { campaign: OutreachCampaignWithTemplates }) {
  const status = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.draft;
  const pct = campaign.send_count > 0
    ? Math.round((campaign.processed_count / campaign.send_count) * 100)
    : 0;
  const formattedDate = campaign.scheduled_at
    ? new Date(campaign.scheduled_at).toLocaleDateString('nl-NL', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : null;

  return (
    <div className="oil-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
              {campaign.name}
            </h3>
            {campaign.week_key && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-dim)' }}
              >
                {campaign.week_key}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {CHANNEL_LABEL[campaign.channel] ?? campaign.channel}
            </span>
            {formattedDate && (
              <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                {formattedDate}
              </span>
            )}
          </div>
        </div>
        <DataBadge label={status.label} variant={status.variant} />
      </div>

      {/* Progress bar */}
      {campaign.send_count > 0 && (
        <div className="space-y-1.5">
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: 'var(--color-text-dim)' }}
          >
            <span>Verzonden</span>
            <span>{campaign.processed_count} / {campaign.send_count} ({pct}%)</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--color-bg-elevated)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? 'var(--color-data-green)' : 'var(--color-oil-orange)',
              }}
            />
          </div>
        </div>
      )}

      {/* Template pool */}
      {campaign.templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {campaign.templates.map((t) => (
            <span
              key={t.id}
              className="text-[10px] px-2 py-0.5 rounded-full border"
              style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-dim)' }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
