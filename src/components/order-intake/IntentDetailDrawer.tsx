'use client';

/**
 * IntentDetailDrawer — Slide-in detail panel for an order intent
 *
 * Shows: raw message, editable parse suggestion, accept/reject actions.
 * Context: last 3 messages from same customer.
 * Forwarding button disabled until Slice 5.
 */

import { useState, useEffect, useCallback, useTransition } from 'react';
import type {
  OrderIntentWithCustomer,
  OrderIntentLine,
  InboundMessage,
} from '@/types/order-intake';
import type { ForwardEmailOutput } from '@/lib/engine/order-intake/formatForwardEmail';
import {
  getOrderIntent,
  updateIntentParseSuggestion,
  rejectIntent,
  acceptAndForwardIntent,
  getRecentCommunication,
} from '@/lib/actions/order-intake';

// ─── UOM options ────────────────────────────────────────────────────────────

const UOM_OPTIONS = ['kg', 'gram', 'stuks', 'dozen', 'bakken'] as const;

// ─── Component ──────────────────────────────────────────────────────────────

interface IntentDetailDrawerProps {
  intent: OrderIntentWithCustomer;
  onClose: () => void;
  onUpdated: () => void;
}

export function IntentDetailDrawer({ intent, onClose, onUpdated }: IntentDetailDrawerProps) {
  const [lines, setLines] = useState<OrderIntentLine[]>(
    intent.parse_suggestion_json?.lines ?? []
  );
  const [linkedMessage, setLinkedMessage] = useState<InboundMessage | null>(null);
  const [recentMessages, setRecentMessages] = useState<InboundMessage[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualFallback, setManualFallback] = useState<ForwardEmailOutput | null>(null);

  // Fetch linked message and recent communication
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { message } = await getOrderIntent(intent.id);
        if (!cancelled) setLinkedMessage(message);
      } catch { /* noop */ }

      if (intent.customer_id) {
        try {
          const msgs = await getRecentCommunication(intent.customer_id, 3);
          if (!cancelled) setRecentMessages(msgs);
        } catch { /* noop */ }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [intent.id, intent.customer_id]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Line editing ────────────────────────────────────────────────────────

  const updateLine = useCallback((idx: number, field: keyof OrderIntentLine, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const removeLine = useCallback((idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { name_guess: '', qty: 0, uom: 'stuks' }]);
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleSaveParse = useCallback(() => {
    startTransition(async () => {
      try {
        await updateIntentParseSuggestion(intent.id, { lines });
        setActionMsg({ type: 'success', text: 'Parse opgeslagen' });
        onUpdated();
      } catch (err) {
        setActionMsg({ type: 'error', text: `Fout: ${err instanceof Error ? err.message : 'onbekend'}` });
      }
    });
  }, [intent.id, lines, onUpdated]);

  const handleReject = useCallback(() => {
    startTransition(async () => {
      try {
        await rejectIntent(intent.id);
        setActionMsg({ type: 'success', text: 'Gemarkeerd als geen order' });
        onUpdated();
        setTimeout(onClose, 800);
      } catch (err) {
        setActionMsg({ type: 'error', text: `Fout: ${err instanceof Error ? err.message : 'onbekend'}` });
      }
    });
  }, [intent.id, onUpdated, onClose]);

  const handleAcceptAndForward = useCallback(() => {
    const userName = localStorage.getItem('oil-outreach-username') || 'onbekend';
    startTransition(async () => {
      try {
        const result = await acceptAndForwardIntent(intent.id, userName);
        if (result.forwarded) {
          setActionMsg({ type: 'success', text: 'Geaccepteerd en doorgestuurd naar bestellingen@' });
          onUpdated();
          setTimeout(onClose, 1200);
        } else {
          // Manual fallback — show email content for copy
          setActionMsg({ type: 'success', text: 'Geaccepteerd. Geen email-provider geconfigureerd — stuur handmatig door.' });
          setManualFallback(result.email);
          onUpdated();
        }
      } catch (err) {
        setActionMsg({ type: 'error', text: `Fout: ${err instanceof Error ? err.message : 'onbekend'}` });
      }
    });
  }, [intent.id, onUpdated, onClose]);

  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setActionMsg({ type: 'success', text: 'Gekopieerd naar klembord' });
    } catch {
      setActionMsg({ type: 'error', text: 'Kopiëren mislukt' });
    }
  }, []);

  // ── Status helpers ──────────────────────────────────────────────────────

  const isEditable = intent.status === 'new' || intent.status === 'parsed' || intent.status === 'needs_review';
  const canAccept = isEditable && lines.length > 0 && lines.every((l) => l.name_guess && l.qty > 0);
  const canReject = isEditable;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col"
        style={{
          background: 'var(--color-bg-main)',
          borderLeft: '1px solid var(--color-border-subtle)',
          animation: 'slideInRight 200ms ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-main)' }}>
              Order Intent
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
              {intent.customer_name ?? 'Onbekende afzender'}{' '}
              &middot; {new Date(intent.created_at).toLocaleDateString('nl-NL')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-dim)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
            aria-label="Sluiten"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Action message */}
          {actionMsg && (
            <div
              className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{
                background: actionMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: actionMsg.type === 'success' ? 'rgb(74,222,128)' : 'rgb(248,113,113)',
              }}
            >
              {actionMsg.text}
            </div>
          )}

          {/* Raw message */}
          <section>
            <SectionLabel>Origineel bericht</SectionLabel>
            <div
              className="p-3 rounded-lg text-sm whitespace-pre-wrap"
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-main)',
                border: '1px solid var(--color-border-subtle)',
                maxHeight: '150px',
                overflowY: 'auto',
              }}
            >
              {intent.raw_text || '(leeg bericht)'}
            </div>
            <div className="flex gap-3 mt-1.5">
              <MetaChip label="Kanaal" value={intent.source_channel} />
              <MetaChip label="Score" value={`${Math.round(intent.confidence_score * 100)}%`} />
              <MetaChip label="Status" value={intent.status} />
            </div>
          </section>

          {/* Parse suggestion editor */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Parse suggestie</SectionLabel>
              {isEditable && (
                <button
                  type="button"
                  onClick={addLine}
                  className="text-[10px] px-2 py-1 rounded-lg"
                  style={{ color: 'var(--color-oil-orange)', background: 'rgba(249,115,22,0.1)' }}
                >
                  + Regel
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--color-text-dim)' }}>
                Geen productregels gedetecteerd
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}
                  >
                    {/* Product name */}
                    <input
                      type="text"
                      value={line.name_guess}
                      onChange={(e) => updateLine(idx, 'name_guess', e.target.value)}
                      disabled={!isEditable}
                      className="flex-1 text-xs px-2 py-1.5 rounded bg-transparent border"
                      style={{
                        borderColor: 'var(--color-border-subtle)',
                        color: 'var(--color-text-main)',
                      }}
                      placeholder="Product..."
                    />

                    {/* Qty */}
                    <input
                      type="number"
                      value={line.qty || ''}
                      onChange={(e) => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)}
                      disabled={!isEditable}
                      className="w-16 text-xs px-2 py-1.5 rounded bg-transparent border text-right"
                      style={{
                        borderColor: 'var(--color-border-subtle)',
                        color: 'var(--color-text-main)',
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                      placeholder="Qty"
                    />

                    {/* UOM */}
                    <select
                      value={line.uom}
                      onChange={(e) => updateLine(idx, 'uom', e.target.value)}
                      disabled={!isEditable}
                      className="text-xs px-2 py-1.5 rounded bg-transparent border"
                      style={{
                        borderColor: 'var(--color-border-subtle)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      {UOM_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>

                    {/* Remove */}
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-xs p-1 rounded"
                        style={{ color: 'rgb(248,113,113)' }}
                        title="Verwijder regel"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Save parse button */}
            {isEditable && (
              <button
                type="button"
                onClick={handleSaveParse}
                disabled={isPending}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {isPending ? 'Opslaan...' : 'Parse opslaan'}
              </button>
            )}
          </section>

          {/* Context: recent messages from customer */}
          {recentMessages.length > 0 && (
            <section>
              <SectionLabel>Recente berichten klant</SectionLabel>
              <div className="space-y-2">
                {recentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-2 rounded-lg text-xs"
                    style={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: 'var(--color-text-dim)' }}>
                        {msg.source_channel}
                      </span>
                      <span style={{ color: 'var(--color-text-dim)' }}>
                        {new Date(msg.created_at).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    <p
                      className="line-clamp-2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {msg.raw_text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Accept info for already-accepted intents */}
          {(intent.status === 'accepted' || intent.status === 'forwarded') && (
            <section>
              <SectionLabel>Acceptatie</SectionLabel>
              <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                {intent.accepted_by && <p>Door: {intent.accepted_by}</p>}
                {intent.accepted_at && (
                  <p>Op: {new Date(intent.accepted_at).toLocaleString('nl-NL')}</p>
                )}
                {intent.forwarded_at && (
                  <p>Doorgestuurd: {new Date(intent.forwarded_at).toLocaleString('nl-NL')}</p>
                )}
              </div>
            </section>
          )}

          {/* Notes */}
          {intent.notes && (
            <section>
              <SectionLabel>Notities</SectionLabel>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {intent.notes}
              </p>
            </section>
          )}

          {/* Manual fallback — shown when no PA provider */}
          {manualFallback && (
            <section>
              <SectionLabel>Handmatig doorsturen</SectionLabel>
              <div
                className="p-3 rounded-lg space-y-3"
                style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}
              >
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Geen email-provider geconfigureerd. Kopieer onderstaande en stuur handmatig.
                </p>

                {/* Subject */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-dim)' }}>
                      Onderwerp
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(manualFallback.subject)}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ color: 'var(--color-oil-orange)', background: 'rgba(249,115,22,0.1)' }}
                    >
                      Kopieer
                    </button>
                  </div>
                  <p className="text-xs font-mono" style={{ color: 'var(--color-text-main)' }}>
                    {manualFallback.subject}
                  </p>
                </div>

                {/* Body plain text */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-dim)' }}>
                      Inhoud
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(manualFallback.bodyPlain)}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ color: 'var(--color-oil-orange)', background: 'rgba(249,115,22,0.1)' }}
                    >
                      Kopieer
                    </button>
                  </div>
                  <pre
                    className="text-[11px] whitespace-pre-wrap overflow-y-auto"
                    style={{
                      color: 'var(--color-text-muted)',
                      maxHeight: '200px',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    {manualFallback.bodyPlain}
                  </pre>
                </div>

                {/* Mailto link */}
                <a
                  href={`mailto:bestellingen@oranjehoen.nl?subject=${encodeURIComponent(manualFallback.subject)}&body=${encodeURIComponent(manualFallback.bodyPlain)}`}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'var(--color-oil-orange)', color: '#fff' }}
                >
                  📧 Open in email
                </a>
              </div>
            </section>
          )}
        </div>

        {/* Footer actions */}
        {isEditable && (
          <div
            className="shrink-0 px-5 py-3 flex items-center gap-3"
            style={{ borderTop: '1px solid var(--color-border-subtle)' }}
          >
            <button
              type="button"
              onClick={handleAcceptAndForward}
              disabled={!canAccept || isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canAccept ? 'var(--color-oil-orange)' : 'var(--color-bg-elevated)' }}
            >
              {isPending ? 'Bezig...' : 'Accepteer & Forward'}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={!canReject || isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: 'rgb(248,113,113)',
              }}
            >
              Geen order
            </button>
          </div>
        )}
      </div>

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
      style={{ color: 'var(--color-text-dim)' }}
    >
      {children}
    </h3>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
      {label}: <span style={{ color: 'var(--color-text-muted)' }}>{value}</span>
    </span>
  );
}
