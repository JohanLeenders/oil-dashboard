'use client';

/**
 * TemplateForm — Wave 10 Outreach
 * Inline create / edit form for outreach templates.
 */

import { useState, useTransition, type FormEvent } from 'react';
import { createTemplate, updateTemplate } from '@/lib/actions/outreach';
import type { OutreachTemplate, OutreachChannel, OutreachMessageType } from '@/types/outreach';

interface TemplateFormProps {
  template?: OutreachTemplate;
  onSuccess?: (t: OutreachTemplate) => void;
  onCancel?: () => void;
}

export function TemplateForm({ template, onSuccess, onCancel }: TemplateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(template?.name ?? '');
  const [channel, setChannel] = useState<OutreachChannel>(template?.channel ?? 'email');
  const [messageType, setMessageType] = useState<OutreachMessageType>(
    template?.message_type ?? 'uitvraag',
  );
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html ?? '');
  const [bodyText, setBodyText] = useState(template?.body_text ?? '');
  const [error, setError] = useState<string | null>(null);

  const showEmail = channel === 'email' || channel === 'both';
  const showWhatsApp = channel === 'whatsapp' || channel === 'both';

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const input = {
          name,
          channel,
          message_type: messageType,
          subject: showEmail ? subject : null,
          body_html: showEmail ? bodyHtml : null,
          body_text: showWhatsApp ? bodyText : null,
        };
        const result = template
          ? await updateTemplate(template.id, input)
          : await createTemplate(input);
        onSuccess?.(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Naam *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm rounded-lg border"
          style={{
            background: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-main)',
          }}
          placeholder="Bijv. Wekelijkse uitvraag email"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Kanaal
          </label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as OutreachChannel)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-main)' }}
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="both">Beide</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Type
          </label>
          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as OutreachMessageType)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-main)' }}
          >
            <option value="uitvraag">Uitvraag</option>
            <option value="actie">Actie</option>
          </select>
        </div>
      </div>
      {showEmail && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Onderwerp (email)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-main)' }}
            placeholder="Bijv. Bestelling week {{week_nummer}}"
          />
        </div>
      )}
      {showEmail && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            E-mail body (HTML)
          </label>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 text-sm rounded-lg border font-mono"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-main)' }}
            placeholder="<p>Beste {{klant_naam}},</p>..."
          />
        </div>
      )}
      {showWhatsApp && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            WhatsApp tekst
          </label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-main)' }}
            placeholder="Beste {{klant_naam}}, uw wekelijkse bestelling..."
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-dim)' }}>
            Variabelen: {'{{klant_naam}}'} {'{{klant_code}}'} {'{{week_nummer}}'}
          </p>
        </div>
      )}
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ background: 'rgba(225, 29, 72, 0.1)', color: 'var(--color-data-red)' }}
        >
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Annuleer
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
          style={{ background: 'var(--color-oil-orange)' }}
        >
          {isPending ? 'Opslaan...' : template ? 'Bijwerken' : 'Aanmaken'}
        </button>
      </div>
    </form>
  );
}
