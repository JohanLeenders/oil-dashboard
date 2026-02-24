'use client';

import { useState } from 'react';
import { dispatchCampaignSends } from '@/lib/actions/outreach';

interface Props {
  campaignId: string;
  pendingCount: number;
}

export function CampaignSendButton({ campaignId, pendingCount }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (pendingCount === 0) return null;

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const r = await dispatchCampaignSends(campaignId);
      setResult(
        r.dispatched > 0
          ? `${r.dispatched} verstuurd${r.failed > 0 ? `, ${r.failed} mislukt` : ''}`
          : r.failed > 0 ? `${r.failed} mislukt` : 'Geen sends verwerkt',
      );
    } catch {
      setResult('Fout bij versturen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center justify-between gap-3 pt-3 border-t"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded font-medium transition-opacity disabled:opacity-50"
        style={{ background: 'var(--color-oil-orange)', color: 'white' }}
      >
        {loading ? 'Bezig...' : `Verstuur nu (${pendingCount})`}
      </button>
      {result && (
        <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
          {result}
        </span>
      )}
    </div>
  );
}
