/**
 * Tests for formatForwardEmail — Wave 12
 */

import { describe, it, expect } from 'vitest';
import { formatForwardEmail, type ForwardEmailInput } from './formatForwardEmail';

// =============================================================================
// HELPERS
// =============================================================================

function makeInput(overrides?: Partial<ForwardEmailInput>): ForwardEmailInput {
  return {
    customerName: 'Bakkerij De Graaf',
    customerCode: 'BDG-001',
    sourceChannel: 'whatsapp',
    rawText: 'Graag 50 kg supremes en 20 kg dijbout',
    lines: [
      { name_guess: 'supremes', qty: 50, uom: 'kg' },
      { name_guess: 'dijbout', qty: 20, uom: 'kg' },
    ],
    intentDate: '2026-02-27T10:30:00Z',
    confidenceScore: 0.9,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('formatForwardEmail', () => {
  it('generates correct subject with customer name and date', () => {
    const result = formatForwardEmail(makeInput());
    expect(result.subject).toBe('Order Intent: Bakkerij De Graaf — 27-02-2026');
  });

  it('uses "Onbekende afzender" when no customer name', () => {
    const result = formatForwardEmail(makeInput({ customerName: null }));
    expect(result.subject).toContain('Onbekende afzender');
  });

  it('HTML body contains product table rows', () => {
    const result = formatForwardEmail(makeInput());
    expect(result.bodyHtml).toContain('supremes');
    expect(result.bodyHtml).toContain('dijbout');
    expect(result.bodyHtml).toContain('50');
    expect(result.bodyHtml).toContain('20');
    expect(result.bodyHtml).toContain('kg');
  });

  it('HTML body contains customer code', () => {
    const result = formatForwardEmail(makeInput());
    expect(result.bodyHtml).toContain('BDG-001');
  });

  it('HTML body does not show customer code when null', () => {
    const result = formatForwardEmail(makeInput({ customerCode: null }));
    expect(result.bodyHtml).not.toContain('Klantcode');
  });

  it('HTML body contains original message in blockquote', () => {
    const result = formatForwardEmail(makeInput());
    expect(result.bodyHtml).toContain('blockquote');
    expect(result.bodyHtml).toContain('Graag 50 kg supremes en 20 kg dijbout');
  });

  it('HTML body contains channel label', () => {
    const result = formatForwardEmail(makeInput());
    expect(result.bodyHtml).toContain('WhatsApp');
  });

  it('HTML body contains confidence score as percentage', () => {
    const result = formatForwardEmail(makeInput());
    expect(result.bodyHtml).toContain('90%');
  });

  it('handles empty lines array gracefully', () => {
    const result = formatForwardEmail(makeInput({ lines: [] }));
    expect(result.bodyHtml).toContain('Geen productregels');
    expect(result.bodyPlain).toContain('geen productregels');
  });

  it('plain text body contains all essential info', () => {
    const result = formatForwardEmail(makeInput());
    expect(result.bodyPlain).toContain('Bakkerij De Graaf');
    expect(result.bodyPlain).toContain('BDG-001');
    expect(result.bodyPlain).toContain('supremes: 50 kg');
    expect(result.bodyPlain).toContain('dijbout: 20 kg');
    expect(result.bodyPlain).toContain('WhatsApp');
  });

  it('plain text body does not include customer code when null', () => {
    const result = formatForwardEmail(makeInput({ customerCode: null }));
    expect(result.bodyPlain).not.toContain('Klantcode');
  });

  it('escapes HTML entities in raw text', () => {
    const result = formatForwardEmail(makeInput({
      rawText: '<script>alert("xss")</script>',
    }));
    expect(result.bodyHtml).not.toContain('<script>');
    expect(result.bodyHtml).toContain('&lt;script&gt;');
  });

  it('escapes HTML in product names', () => {
    const result = formatForwardEmail(makeInput({
      lines: [{ name_guess: 'kip<b>vet</b>', qty: 10, uom: 'kg' }],
    }));
    expect(result.bodyHtml).not.toContain('<b>');
    expect(result.bodyHtml).toContain('kip&lt;b&gt;vet&lt;/b&gt;');
  });

  it('handles email channel label', () => {
    const result = formatForwardEmail(makeInput({ sourceChannel: 'email' }));
    expect(result.bodyHtml).toContain('Email');
  });

  it('handles manual channel label', () => {
    const result = formatForwardEmail(makeInput({ sourceChannel: 'manual' }));
    expect(result.bodyHtml).toContain('Handmatig');
  });

  it('formats confidence 0.7 as 70%', () => {
    const result = formatForwardEmail(makeInput({ confidenceScore: 0.7 }));
    expect(result.bodyHtml).toContain('70%');
    expect(result.bodyPlain).toContain('70%');
  });

  it('returns all three required fields', () => {
    const result = formatForwardEmail(makeInput());
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('bodyHtml');
    expect(result).toHaveProperty('bodyPlain');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.bodyHtml).toBe('string');
    expect(typeof result.bodyPlain).toBe('string');
  });
});
