'use client';

/**
 * ManualEntryForm — Manual inbound message entry
 *
 * Allows operators to paste a message (email / phone / manual) and
 * run it through the classifier pipeline.
 */

import { useState, useTransition, useCallback } from 'react';
import type { InboundChannel } from '@/types/order-intake';
import { createInboundMessage, processInboundMessage } from '@/lib/actions/order-intake';

// ─── Channel options ────────────────────────────────────────────────────────

const CHANNELS: { value: InboundChannel; label: string; icon: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'manual', label: 'Handmatig', icon: '✍️' },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface ManualEntryFormProps {
  onComplete: () => void;
}

export function ManualEntryForm({ onComplete }: ManualEntryFormProps) {
  const [channel, setChannel] = useState<InboundChannel>('manual');
  const [sender, setSender] = useState('');
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const canSubmit = text.trim().length > 0 && !isPending;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        // Create inbound message
        const messageId = await createInboundMessage({
          source_channel: channel,
          sender_identifier: sender.trim() || 'handmatig',
          raw_text: text.trim(),
        });

        // Run classifier
        const intentId = await processInboundMessage(messageId);

        if (intentId) {
          setResult({
            type: 'success',
            text: 'Order intent aangemaakt! Het bericht is herkend als bestelling.',
          });
        } else {
          setResult({
            type: 'info',
            text: 'Bericht opgeslagen maar niet herkend als bestelling. Geen order intent aangemaakt.',
          });
        }

        // Reset form
        setText('');
        setSender('');
        onComplete();
      } catch (err) {
        setResult({
          type: 'error',
          text: `Fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`,
        });
      }
    });
  }, [canSubmit, channel, sender, text, onComplete]);

  return (
    <div className="oil-card p-4 space-y-4">
      <h3
        className="text-sm font-semibold"
        style={{ color: 'var(--color-text-main)' }}
      >
        Handmatig bericht invoeren
      </h3>

      {/* Result message */}
      {result && (
        <div
          className="px-3 py-2 rounded-lg text-xs font-medium"
          style={{
            background:
              result.type === 'success' ? 'rgba(34,197,94,0.15)' :
              result.type === 'error' ? 'rgba(239,68,68,0.15)' :
              'rgba(59,130,246,0.15)',
            color:
              result.type === 'success' ? 'rgb(74,222,128)' :
              result.type === 'error' ? 'rgb(248,113,113)' :
              'rgb(96,165,250)',
          }}
        >
          {result.text}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Channel selector */}
        <div>
          <label
            className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-text-dim)' }}
          >
            Kanaal
          </label>
          <div className="flex gap-1">
            {CHANNELS.map((ch) => (
              <button
                key={ch.value}
                type="button"
                onClick={() => setChannel(ch.value)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1"
                style={{
                  background: channel === ch.value ? 'var(--color-oil-orange)' : 'var(--color-bg-elevated)',
                  color: channel === ch.value ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                <span>{ch.icon}</span>
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sender identifier */}
        <div>
          <label
            className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-text-dim)' }}
          >
            Afzender (optioneel)
          </label>
          <input
            type="text"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder={channel === 'whatsapp' ? '+31612345678' : channel === 'email' ? 'klant@example.com' : 'Naam...'}
            className="w-full text-xs px-3 py-2 rounded-lg bg-transparent border"
            style={{
              borderColor: 'var(--color-border-subtle)',
              color: 'var(--color-text-main)',
            }}
          />
        </div>
      </div>

      {/* Message text */}
      <div>
        <label
          className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: 'var(--color-text-dim)' }}
        >
          Berichttekst
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Plak hier het bericht, bijv.: 'Graag 50 kg supremes en 20 kg dijbout voor donderdag'"
          rows={4}
          className="w-full text-xs px-3 py-2 rounded-lg bg-transparent border resize-none"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-main)',
          }}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
          Het bericht wordt opgeslagen en door de classifier gehaald
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: canSubmit ? 'var(--color-oil-orange)' : 'var(--color-bg-elevated)' }}
        >
          {isPending ? 'Verwerken...' : 'Verwerk bericht'}
        </button>
      </div>
    </div>
  );
}
