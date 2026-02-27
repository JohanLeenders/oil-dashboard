/**
 * updateRenderer.test.ts — Wave 11 Update Engine
 *
 * Tests for Tiptap JSON → HTML and → plain text rendering.
 * Pure function tests — no DB, no side effects.
 */

import { describe, it, expect } from 'vitest';
import {
  renderUpdateToHtml,
  renderUpdateToText,
  renderUpdateToBodyHtml,
} from './updateRenderer';
import type { TiptapDocument } from '@/types/outreach';

// =============================================================================
// FIXTURES
// =============================================================================

const SIMPLE_DOC: TiptapDocument = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Welkom bij Oranjehoen' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Dit is een ' },
        { type: 'text', text: 'mooie', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' update.' },
      ],
    },
  ],
};

const DOC_WITH_LISTS: TiptapDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Beschikbaar deze week:' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Kipfilet' }] },
          ],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Kippenpoten' }] },
          ],
        },
      ],
    },
  ],
};

const DOC_WITH_PRODUCT_BLOCK: TiptapDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Productaanbod:' }],
    },
    {
      type: 'productBlock',
      attrs: {
        productName: 'Kipfilet',
        description: 'Vers, grillklaar',
        pricePerKg: '8.50',
        unit: 'kg',
        source: 'database',
      },
    },
    {
      type: 'productBlock',
      attrs: {
        productName: 'Kippenpoten',
        pricePerKg: '3.20',
        unit: 'kg',
        source: 'manual',
      },
    },
  ],
};

const DOC_WITH_BLOCKQUOTE: TiptapDocument = {
  type: 'doc',
  content: [
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Kwaliteit is onze passie.' }],
        },
      ],
    },
  ],
};

const DOC_WITH_LINK: TiptapDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Bekijk onze ' },
        {
          type: 'text',
          text: 'website',
          marks: [{ type: 'link', attrs: { href: 'https://oranjehoen.nl' } }],
        },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

const EMPTY_DOC: TiptapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

// =============================================================================
// HTML RENDERING
// =============================================================================

describe('renderUpdateToHtml', () => {
  it('renders a complete HTML email with brand wrapper', () => {
    const html = renderUpdateToHtml(SIMPLE_DOC, 'Test Update');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('ORANJEHOEN');
    expect(html).toContain('Test Update');
    expect(html).toContain('#09090b'); // Brand BG
    expect(html).toContain('#F67E20'); // Brand orange
  });

  it('renders headings', () => {
    const html = renderUpdateToHtml(SIMPLE_DOC, 'Test');
    expect(html).toContain('<h2');
    expect(html).toContain('Welkom bij Oranjehoen');
  });

  it('renders bold marks', () => {
    const html = renderUpdateToHtml(SIMPLE_DOC, 'Test');
    expect(html).toContain('<strong>mooie</strong>');
  });

  it('renders bullet lists', () => {
    const html = renderUpdateToHtml(DOC_WITH_LISTS, 'Test');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('Kipfilet');
    expect(html).toContain('Kippenpoten');
  });

  it('renders product blocks as styled tables', () => {
    const html = renderUpdateToHtml(DOC_WITH_PRODUCT_BLOCK, 'Test');
    expect(html).toContain('Kipfilet');
    expect(html).toContain('€8.50');
    expect(html).toContain('Vers, grillklaar');
    expect(html).toContain('Kippenpoten');
    expect(html).toContain('€3.20');
  });

  it('renders blockquote with orange left border', () => {
    const html = renderUpdateToHtml(DOC_WITH_BLOCKQUOTE, 'Test');
    expect(html).toContain('<blockquote');
    expect(html).toContain('border-left');
    expect(html).toContain('Kwaliteit is onze passie.');
  });

  it('renders links with brand color', () => {
    const html = renderUpdateToHtml(DOC_WITH_LINK, 'Test');
    expect(html).toContain('href="https://oranjehoen.nl"');
    expect(html).toContain('#F67E20');
    expect(html).toContain('website');
  });

  it('handles empty document gracefully', () => {
    const html = renderUpdateToHtml(EMPTY_DOC, 'Leeg');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Leeg');
    // Should not throw
  });

  it('escapes HTML entities in text', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '<script>alert("xss")</script>' }],
        },
      ],
    };
    const html = renderUpdateToHtml(doc, 'XSS Test');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

// =============================================================================
// BODY-ONLY HTML
// =============================================================================

describe('renderUpdateToBodyHtml', () => {
  it('renders without email wrapper', () => {
    const html = renderUpdateToBodyHtml(SIMPLE_DOC);
    expect(html).not.toContain('<!DOCTYPE html>');
    expect(html).not.toContain('ORANJEHOEN');
    expect(html).toContain('<h2');
    expect(html).toContain('Welkom bij Oranjehoen');
  });
});

// =============================================================================
// PLAIN TEXT RENDERING (WhatsApp)
// =============================================================================

describe('renderUpdateToText', () => {
  it('renders heading as WhatsApp bold', () => {
    const text = renderUpdateToText(SIMPLE_DOC, 'Test Update');
    expect(text).toContain('*Test Update*');
    expect(text).toContain('*Welkom bij Oranjehoen*');
  });

  it('renders bold text as plain text (no marks in WhatsApp)', () => {
    const text = renderUpdateToText(SIMPLE_DOC, 'Test');
    expect(text).toContain('Dit is een mooie update.');
  });

  it('renders bullet list with bullet markers', () => {
    const text = renderUpdateToText(DOC_WITH_LISTS, 'Test');
    expect(text).toContain('• Kipfilet');
    expect(text).toContain('• Kippenpoten');
  });

  it('renders product blocks as structured text', () => {
    const text = renderUpdateToText(DOC_WITH_PRODUCT_BLOCK, 'Test');
    expect(text).toContain('📦 *Kipfilet*');
    expect(text).toContain('€8.50/kg');
    expect(text).toContain('Vers, grillklaar');
    expect(text).toContain('📦 *Kippenpoten*');
    expect(text).toContain('€3.20/kg');
  });

  it('renders blockquote with > prefix', () => {
    const text = renderUpdateToText(DOC_WITH_BLOCKQUOTE, 'Test');
    expect(text).toContain('> Kwaliteit is onze passie.');
  });

  it('handles empty document', () => {
    const text = renderUpdateToText(EMPTY_DOC, 'Leeg');
    expect(text).toContain('*Leeg*');
    // Should not throw
  });

  it('collapses excessive newlines', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Eerste' }] },
        { type: 'paragraph' },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Tweede' }] },
      ],
    };
    const text = renderUpdateToText(doc, 'Test');
    // Should not have more than 2 consecutive newlines
    expect(text).not.toMatch(/\n{3,}/);
  });

  it('strips HTML from text content (no HTML entities)', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Prijs: €5 per kg' }],
        },
      ],
    };
    const text = renderUpdateToText(doc, 'Test');
    expect(text).toContain('Prijs: €5 per kg');
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge cases', () => {
  it('handles horizontal rule in both renderers', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Boven' }] },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Onder' }] },
      ],
    };
    const html = renderUpdateToHtml(doc, 'Test');
    expect(html).toContain('<hr');

    const text = renderUpdateToText(doc, 'Test');
    expect(text).toContain('---');
  });

  it('handles image nodes', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: 'https://example.com/kip.jpg', alt: 'Kipfilet' },
        },
      ],
    };
    const html = renderUpdateToHtml(doc, 'Test');
    expect(html).toContain('src="https://example.com/kip.jpg"');
    expect(html).toContain('alt="Kipfilet"');

    const text = renderUpdateToText(doc, 'Test');
    expect(text).toContain('[Kipfilet]');
  });

  it('handles ordered lists', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Eerste' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Tweede' }] },
              ],
            },
          ],
        },
      ],
    };
    const html = renderUpdateToHtml(doc, 'Test');
    expect(html).toContain('<ol');

    const text = renderUpdateToText(doc, 'Test');
    expect(text).toContain('1. Eerste');
    expect(text).toContain('2. Tweede');
  });

  it('handles hardBreak in text', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Regel 1' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Regel 2' },
          ],
        },
      ],
    };
    const html = renderUpdateToBodyHtml(doc);
    expect(html).toContain('Regel 1<br/>Regel 2');

    const text = renderUpdateToText(doc, 'Test');
    expect(text).toContain('Regel 1\nRegel 2');
  });

  it('handles product block without price', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'productBlock',
          attrs: {
            productName: 'Kippenvleugels',
            description: 'Vers',
          },
        },
      ],
    };
    const html = renderUpdateToBodyHtml(doc);
    expect(html).toContain('Kippenvleugels');
    expect(html).not.toContain('€'); // No price shown

    const text = renderUpdateToText(doc, 'Test');
    expect(text).toContain('📦 *Kippenvleugels*');
    expect(text).not.toContain('€');
  });
});
