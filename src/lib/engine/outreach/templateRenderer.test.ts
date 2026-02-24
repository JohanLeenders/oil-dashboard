/**
 * templateRenderer.test.ts — Wave 10 Outreach Engine
 *
 * Tests for pure template rendering and selection functions.
 * No mocks needed — all functions are pure.
 */

import { describe, it, expect } from 'vitest';
import {
  renderTokens,
  renderTemplate,
  selectTemplate,
  detectSignedUrl,
  extractImageUrls,
  validateTemplateContent,
} from './templateRenderer';
import type { OutreachTemplate, OutreachTemplateVars } from '@/types/outreach';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const BASE_VARS: OutreachTemplateVars = {
  klant_naam: 'Landwinkel Hop & Zo',
  klant_code: 'LHZ001',
  week_nummer: '09',
};

const WHATSAPP_TEMPLATE: OutreachTemplate = {
  id: 'tpl-wa-001',
  name: 'Uitvraag WhatsApp A',
  channel: 'whatsapp',
  message_type: 'uitvraag',
  subject: null,
  body_html: null,
  body_text: 'Hoi {{klant_naam}}, wat mag het deze week zijn? Week {{week_nummer}}.',
  is_active: true,
  created_at: '2026-02-24T00:00:00Z',
};

const EMAIL_TEMPLATE: OutreachTemplate = {
  id: 'tpl-em-001',
  name: 'Uitvraag Email A',
  channel: 'email',
  message_type: 'uitvraag',
  subject: 'Week {{week_nummer}} — wat mogen wij voor {{klant_naam}} inpakken?',
  body_html: '<p>Goedemorgen {{klant_naam}},</p><p>Week {{week_nummer}} is bijna!</p>',
  body_text: null,
  is_active: true,
  created_at: '2026-02-24T00:00:00Z',
};

const BOTH_TEMPLATE: OutreachTemplate = {
  id: 'tpl-bo-001',
  name: 'Uitvraag Both A',
  channel: 'both',
  message_type: 'uitvraag',
  subject: 'Uitvraag week {{week_nummer}}',
  body_html: '<p>{{klant_naam}}, wat mag het zijn?</p>',
  body_text: '{{klant_naam}}, wat mag het zijn deze week?',
  is_active: true,
  created_at: '2026-02-24T00:00:00Z',
};

const INACTIVE_TEMPLATE: OutreachTemplate = {
  ...WHATSAPP_TEMPLATE,
  id: 'tpl-wa-inactive',
  is_active: false,
};

// =============================================================================
// renderTokens
// =============================================================================

describe('renderTokens', () => {
  it('replaces known tokens with values', () => {
    const result = renderTokens('Hoi {{klant_naam}}!', BASE_VARS);
    expect(result).toBe('Hoi Landwinkel Hop & Zo!');
  });

  it('replaces multiple tokens in one pass', () => {
    const result = renderTokens(
      '{{klant_naam}} ({{klant_code}}) — week {{week_nummer}}',
      BASE_VARS,
    );
    expect(result).toBe('Landwinkel Hop & Zo (LHZ001) — week 09');
  });

  it('leaves unknown tokens intact (no silent deletion)', () => {
    const result = renderTokens('Beste {{onbekend}}, groet!', BASE_VARS);
    expect(result).toBe('Beste {{onbekend}}, groet!');
  });

  it('handles optional product_aanbieding when present', () => {
    const vars = { ...BASE_VARS, product_aanbieding: 'Kipfilet 10% korting' };
    const result = renderTokens('Aanbieding: {{product_aanbieding}}', vars);
    expect(result).toBe('Aanbieding: Kipfilet 10% korting');
  });

  it('replaces optional token with empty string when undefined', () => {
    // product_aanbieding is optional — may be undefined
    const vars: OutreachTemplateVars = { ...BASE_VARS, product_aanbieding: undefined };
    const result = renderTokens('Aanbieding: {{product_aanbieding}}', vars);
    expect(result).toBe('Aanbieding: ');
  });

  it('returns original string unchanged when no tokens present', () => {
    const input = 'Geen variabelen hier.';
    expect(renderTokens(input, BASE_VARS)).toBe(input);
  });

  it('handles empty string input', () => {
    expect(renderTokens('', BASE_VARS)).toBe('');
  });
});

// =============================================================================
// renderTemplate
// =============================================================================

describe('renderTemplate', () => {
  it('renders WhatsApp body_text with tokens replaced', () => {
    const result = renderTemplate(WHATSAPP_TEMPLATE, BASE_VARS, 'whatsapp');
    expect(result.channel).toBe('whatsapp');
    expect(result.body).toContain('Landwinkel Hop & Zo');
    expect(result.body).toContain('Week 09');
    expect(result.subject).toBeNull();
  });

  it('renders email body_html and subject with tokens replaced', () => {
    const result = renderTemplate(EMAIL_TEMPLATE, BASE_VARS, 'email');
    expect(result.channel).toBe('email');
    expect(result.body).toContain('Landwinkel Hop & Zo');
    expect(result.body).toContain('Week 09');
    expect(result.subject).toBe('Week 09 — wat mogen wij voor Landwinkel Hop & Zo inpakken?');
  });

  it('throws when requesting WhatsApp but template has no body_text', () => {
    expect(() => renderTemplate(EMAIL_TEMPLATE, BASE_VARS, 'whatsapp')).toThrow(
      /no body_text/,
    );
  });

  it('throws when requesting email but template has no body_html', () => {
    expect(() => renderTemplate(WHATSAPP_TEMPLATE, BASE_VARS, 'email')).toThrow(
      /no body_html/,
    );
  });

  it('renders both-channel template for WhatsApp using body_text', () => {
    const result = renderTemplate(BOTH_TEMPLATE, BASE_VARS, 'whatsapp');
    expect(result.body).toBe('Landwinkel Hop & Zo, wat mag het zijn deze week?');
    expect(result.subject).toBeNull();
  });

  it('renders both-channel template for email using body_html', () => {
    const result = renderTemplate(BOTH_TEMPLATE, BASE_VARS, 'email');
    expect(result.body).toContain('Landwinkel Hop & Zo');
    expect(result.subject).toBe('Uitvraag week 09');
  });
});

// =============================================================================
// selectTemplate — rotation
// =============================================================================

describe('selectTemplate', () => {
  const pool: OutreachTemplate[] = [
    { ...WHATSAPP_TEMPLATE, id: 'tpl-1' },
    { ...WHATSAPP_TEMPLATE, id: 'tpl-2' },
    { ...WHATSAPP_TEMPLATE, id: 'tpl-3' },
    INACTIVE_TEMPLATE,
  ];

  it('returns null for empty pool', () => {
    expect(selectTemplate([], null)).toBeNull();
  });

  it('returns null when all templates are inactive', () => {
    expect(selectTemplate([INACTIVE_TEMPLATE], null)).toBeNull();
  });

  it('filters inactive templates out of selection', () => {
    const selected = selectTemplate(pool, null);
    expect(selected?.id).not.toBe('tpl-wa-inactive');
  });

  it('never selects lastUsedTemplateId when alternatives exist', () => {
    // Force RNG to always return 0 (first item in pool)
    const alwaysFirst = () => 0;
    const selected = selectTemplate(pool, 'tpl-1', alwaysFirst);
    // Pool after exclusion: ['tpl-2', 'tpl-3'], index 0 → tpl-2
    expect(selected?.id).toBe('tpl-2');
  });

  it('falls back to lastUsedTemplateId when it is the only active template', () => {
    const singlePool: OutreachTemplate[] = [{ ...WHATSAPP_TEMPLATE, id: 'only-one' }];
    const selected = selectTemplate(singlePool, 'only-one');
    expect(selected?.id).toBe('only-one');
  });

  it('distributes selection across pool (randomness check)', () => {
    const counts: Record<string, number> = { 'tpl-1': 0, 'tpl-2': 0, 'tpl-3': 0 };
    let i = 0;
    // Cycle through 0, 0.33, 0.66 repeatedly
    const cycleRng = () => [0, 0.34, 0.67][i++ % 3];

    for (let run = 0; run < 30; run++) {
      const selected = selectTemplate(pool, null, cycleRng);
      if (selected) counts[selected.id] = (counts[selected.id] ?? 0) + 1;
    }
    // Each template should have been picked at least once
    expect(counts['tpl-1']).toBeGreaterThan(0);
    expect(counts['tpl-2']).toBeGreaterThan(0);
    expect(counts['tpl-3']).toBeGreaterThan(0);
  });
});

// =============================================================================
// detectSignedUrl
// =============================================================================

describe('detectSignedUrl', () => {
  it('detects a Supabase signed storage URL', () => {
    const signed =
      'https://abc.supabase.co/storage/v1/object/sign/outreach/image.jpg?token=xyz';
    expect(detectSignedUrl(signed)).toBe(true);
  });

  it('does not flag a public storage URL', () => {
    const pub =
      'https://abc.supabase.co/storage/v1/object/public/outreach/image.jpg';
    expect(detectSignedUrl(pub)).toBe(false);
  });

  it('does not flag external image URLs', () => {
    expect(detectSignedUrl('https://cdn.example.com/image.png')).toBe(false);
  });

  it('does not flag empty string', () => {
    expect(detectSignedUrl('')).toBe(false);
  });
});

// =============================================================================
// extractImageUrls
// =============================================================================

describe('extractImageUrls', () => {
  it('extracts a single img src', () => {
    const html = '<p><img src="https://example.com/img.jpg" /></p>';
    expect(extractImageUrls(html)).toEqual(['https://example.com/img.jpg']);
  });

  it('extracts multiple img srcs', () => {
    const html =
      '<img src="https://a.com/1.jpg"><img src="https://b.com/2.png">';
    expect(extractImageUrls(html)).toEqual([
      'https://a.com/1.jpg',
      'https://b.com/2.png',
    ]);
  });

  it('returns empty array when no images', () => {
    expect(extractImageUrls('<p>Geen afbeeldingen</p>')).toEqual([]);
  });

  it('handles both single and double quotes', () => {
    const html = `<img src='https://single.com/img.jpg'>`;
    expect(extractImageUrls(html)).toEqual(['https://single.com/img.jpg']);
  });
});

// =============================================================================
// validateTemplateContent
// =============================================================================

describe('validateTemplateContent', () => {
  it('valid WhatsApp template passes with no errors or warnings', () => {
    const result = validateTemplateContent(WHATSAPP_TEMPLATE);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('valid email template passes', () => {
    const result = validateTemplateContent(EMAIL_TEMPLATE);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('valid both-channel template passes', () => {
    const result = validateTemplateContent(BOTH_TEMPLATE);
    expect(result.valid).toBe(true);
  });

  it('email template without subject produces hard error', () => {
    const noSubject: OutreachTemplate = { ...EMAIL_TEMPLATE, subject: null };
    const result = validateTemplateContent(noSubject);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /subject/i.test(e))).toBe(true);
  });

  it('email template without body_html produces hard error', () => {
    const noHtml: OutreachTemplate = { ...EMAIL_TEMPLATE, body_html: null };
    const result = validateTemplateContent(noHtml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /body_html/i.test(e))).toBe(true);
  });

  it('WhatsApp template without body_text produces hard error', () => {
    const noText: OutreachTemplate = { ...WHATSAPP_TEMPLATE, body_text: null };
    const result = validateTemplateContent(noText);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /body_text/i.test(e))).toBe(true);
  });

  it('body_html with signed URL produces soft warning, not error', () => {
    const signed: OutreachTemplate = {
      ...EMAIL_TEMPLATE,
      body_html:
        '<img src="https://x.supabase.co/storage/v1/object/sign/out/img.jpg?token=abc">',
    };
    const result = validateTemplateContent(signed);
    expect(result.valid).toBe(true); // warnings do not block activation
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/signed/i);
  });

  it('body_html with public URL produces no warnings', () => {
    const pub: OutreachTemplate = {
      ...EMAIL_TEMPLATE,
      body_html:
        '<img src="https://x.supabase.co/storage/v1/object/public/out/img.jpg">',
    };
    const result = validateTemplateContent(pub);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
