/**
 * formatForwardEmail — Pure function to build forwarding email
 *
 * Generates subject + HTML body for forwarding an order intent
 * to bestellingen@oranjehoen.nl (or configured recipient).
 *
 * No side effects, no database, no env vars.
 */

import type { OrderIntentLine } from '@/types/order-intake';

// =============================================================================
// TYPES
// =============================================================================

export interface ForwardEmailInput {
  customerName: string | null;
  customerCode: string | null;
  sourceChannel: string;
  rawText: string;
  lines: OrderIntentLine[];
  intentDate: string; // ISO datetime
  confidenceScore: number;
}

export interface ForwardEmailOutput {
  subject: string;
  bodyHtml: string;
  bodyPlain: string; // for clipboard / manual fallback
}

// =============================================================================
// MAIN
// =============================================================================

export function formatForwardEmail(input: ForwardEmailInput): ForwardEmailOutput {
  const {
    customerName,
    customerCode,
    sourceChannel,
    rawText,
    lines,
    intentDate,
    confidenceScore,
  } = input;

  const displayName = customerName ?? 'Onbekende afzender';
  const dateStr = formatDate(intentDate);
  const channelLabel = CHANNEL_LABELS[sourceChannel] ?? sourceChannel;

  // ── Subject ─────────────────────────────────────────────────────────────
  const subject = `Order Intent: ${displayName} — ${dateStr}`;

  // ── HTML Body ───────────────────────────────────────────────────────────
  const linesHtml = lines.length > 0
    ? `
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left;padding:6px 12px;font-size:12px;color:#6b7280;">Product</th>
            <th style="text-align:right;padding:6px 12px;font-size:12px;color:#6b7280;">Hoeveelheid</th>
            <th style="text-align:left;padding:6px 12px;font-size:12px;color:#6b7280;">Eenheid</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((line) => `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:6px 12px;font-size:13px;">${escapeHtml(line.name_guess)}</td>
              <td style="text-align:right;padding:6px 12px;font-size:13px;font-family:monospace;">${line.qty}</td>
              <td style="padding:6px 12px;font-size:13px;">${escapeHtml(line.uom)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p style="color:#6b7280;font-style:italic;">Geen productregels gedetecteerd.</p>';

  const bodyHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;">
      <h2 style="color:#1f2937;font-size:18px;margin:0 0 4px 0;">
        Order Intent — ${escapeHtml(displayName)}
      </h2>
      ${customerCode ? `<p style="color:#6b7280;font-size:12px;margin:0 0 16px 0;">Klantcode: ${escapeHtml(customerCode)}</p>` : ''}

      <table style="font-size:12px;color:#6b7280;margin-bottom:16px;">
        <tr><td style="padding:2px 8px 2px 0;font-weight:600;">Kanaal</td><td>${escapeHtml(channelLabel)}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;font-weight:600;">Datum</td><td>${escapeHtml(dateStr)}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;font-weight:600;">Score</td><td>${Math.round(confidenceScore * 100)}%</td></tr>
      </table>

      <h3 style="color:#374151;font-size:14px;margin:16px 0 4px 0;">Orderregels</h3>
      ${linesHtml}

      <h3 style="color:#374151;font-size:14px;margin:16px 0 4px 0;">Origineel bericht</h3>
      <blockquote style="border-left:3px solid #f97316;padding:8px 12px;margin:0;background:#f9fafb;font-size:13px;white-space:pre-wrap;color:#374151;">
${escapeHtml(rawText)}
      </blockquote>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="font-size:11px;color:#9ca3af;">
        Gegenereerd door OIL Order Intake — ${escapeHtml(dateStr)}
      </p>
    </div>
  `.trim();

  // ── Plain text body (for clipboard / mailto) ───────────────────────────
  const linesPlain = lines.length > 0
    ? lines.map((l) => `  ${l.name_guess}: ${l.qty} ${l.uom}`).join('\n')
    : '  (geen productregels)';

  const bodyPlain = [
    `Order Intent — ${displayName}`,
    customerCode ? `Klantcode: ${customerCode}` : null,
    '',
    `Kanaal: ${channelLabel}`,
    `Datum: ${dateStr}`,
    `Score: ${Math.round(confidenceScore * 100)}%`,
    '',
    'Orderregels:',
    linesPlain,
    '',
    'Origineel bericht:',
    `> ${rawText.replace(/\n/g, '\n> ')}`,
    '',
    '---',
    `Gegenereerd door OIL Order Intake — ${dateStr}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, bodyHtml, bodyPlain };
}

// =============================================================================
// HELPERS
// =============================================================================

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  edi: 'EDI',
  manual: 'Handmatig',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
