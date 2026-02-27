/**
 * updateRenderer.ts — Wave 11 Update Engine
 *
 * Pure functions for converting Tiptap JSON → HTML (email) and → plain text (WhatsApp).
 * No database calls. No side effects. No UI concerns.
 *
 * Design decisions:
 * - Self-contained HTML renderer (no server-side Tiptap dependency needed)
 * - Brand-locked email template wrapper with Oranjehoen styling
 * - Plain text renderer strips all formatting for WhatsApp compatibility
 * - Product blocks rendered as styled cards (email) or structured text (WhatsApp)
 */

import type { TiptapDocument, TiptapNode, TiptapMark } from '@/types/outreach';

// =============================================================================
// CONSTANTS
// =============================================================================

const BRAND_ORANGE = '#F67E20';
const BRAND_BG = '#09090b';
const BRAND_CARD_BG = '#18181b';
const BRAND_TEXT = '#ffffff';
const BRAND_TEXT_MUTED = '#a1a1aa';
const BRAND_BORDER = 'rgba(255,255,255,0.08)';

// =============================================================================
// TIPTAP JSON → HTML
// =============================================================================

/** Render inline marks (bold, italic, link, etc.) */
function renderMarks(text: string, marks?: TiptapMark[]): string {
  if (!marks?.length) return escapeHtml(text);
  let result = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `<strong>${result}</strong>`;
        break;
      case 'italic':
        result = `<em>${result}</em>`;
        break;
      case 'link':
        result = `<a href="${escapeAttr(String(mark.attrs?.href ?? ''))}" style="color:${BRAND_ORANGE};text-decoration:underline;">${result}</a>`;
        break;
      case 'code':
        result = `<code style="background:rgba(255,255,255,0.08);padding:2px 4px;border-radius:3px;font-size:0.9em;">${result}</code>`;
        break;
      default:
        break;
    }
  }
  return result;
}

/** Recursively render a node's inline content (text + marks) */
function renderInlineContent(nodes?: TiptapNode[]): string {
  if (!nodes?.length) return '';
  return nodes
    .map((node) => {
      if (node.type === 'text') return renderMarks(node.text ?? '', node.marks);
      if (node.type === 'hardBreak') return '<br/>';
      return renderNodeToHtml(node);
    })
    .join('');
}

/** Render a single Tiptap node to inline HTML */
function renderNodeToHtml(node: TiptapNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(renderNodeToHtml).join('');

    case 'paragraph':
      return `<p style="margin:0 0 12px 0;line-height:1.6;color:${BRAND_TEXT};">${renderInlineContent(node.content) || '&nbsp;'}</p>`;

    case 'heading': {
      const level = node.attrs?.level ?? 2;
      const fontSize = level === 2 ? '20px' : '16px';
      return `<h${level} style="margin:24px 0 12px 0;font-size:${fontSize};font-weight:700;color:${BRAND_TEXT};">${renderInlineContent(node.content)}</h${level}>`;
    }

    case 'bulletList':
      return `<ul style="margin:0 0 12px 0;padding-left:24px;color:${BRAND_TEXT};">${(node.content ?? []).map(renderNodeToHtml).join('')}</ul>`;

    case 'orderedList':
      return `<ol style="margin:0 0 12px 0;padding-left:24px;color:${BRAND_TEXT};">${(node.content ?? []).map(renderNodeToHtml).join('')}</ol>`;

    case 'listItem':
      return `<li style="margin:0 0 4px 0;line-height:1.6;">${(node.content ?? []).map(renderNodeToHtml).join('')}</li>`;

    case 'blockquote':
      return `<blockquote style="margin:12px 0;padding:12px 16px;border-left:3px solid ${BRAND_ORANGE};background:rgba(246,126,32,0.08);border-radius:0 8px 8px 0;">${(node.content ?? []).map(renderNodeToHtml).join('')}</blockquote>`;

    case 'horizontalRule':
      return `<hr style="border:none;border-top:1px solid ${BRAND_BORDER};margin:24px 0;"/>`;

    case 'image':
      return `<img src="${escapeAttr(String(node.attrs?.src ?? ''))}" alt="${escapeAttr(String(node.attrs?.alt ?? ''))}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`;

    case 'productBlock':
      return renderProductBlockHtml(node);

    case 'hardBreak':
      return '<br/>';

    default:
      // Fallback: render children if any
      if (node.content?.length) {
        return (node.content ?? []).map(renderNodeToHtml).join('');
      }
      return '';
  }
}

/** Render a product block node as styled HTML card */
function renderProductBlockHtml(node: TiptapNode): string {
  const attrs = node.attrs ?? {};
  const name = String(attrs.productName ?? 'Product');
  const desc = String(attrs.description ?? '');
  const price = String(attrs.pricePerKg ?? '');
  const unit = String(attrs.unit ?? 'kg');

  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;">
  <tr>
    <td style="background:${BRAND_CARD_BG};border:1px solid ${BRAND_BORDER};border-radius:8px;padding:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td>
            <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:${BRAND_TEXT};">${escapeHtml(name)}</p>
            ${desc ? `<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_TEXT_MUTED};">${escapeHtml(desc)}</p>` : ''}
          </td>
          ${price ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;">
            <span style="font-size:16px;font-weight:700;color:${BRAND_ORANGE};">€${escapeHtml(String(price))}</span>
            <span style="font-size:11px;color:${BRAND_TEXT_MUTED};">/${escapeHtml(unit)}</span>
          </td>` : ''}
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

/** Wrap rendered content in branded email template */
function wrapEmailTemplate(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BRAND_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px 0;">
              <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND_ORANGE};letter-spacing:0.5px;">ORANJEHOEN</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background:${BRAND_CARD_BG};border:1px solid ${BRAND_BORDER};border-radius:12px;padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:${BRAND_TEXT_MUTED};">
                Oranjehoen — Premium Pluimvee
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// =============================================================================
// TIPTAP JSON → PLAIN TEXT (WhatsApp)
// =============================================================================

/** Recursively extract plain text from inline content */
function extractInlineText(nodes?: TiptapNode[]): string {
  if (!nodes?.length) return '';
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text ?? '';
      if (node.type === 'hardBreak') return '\n';
      return extractNodeText(node);
    })
    .join('');
}

/** Recursively extract plain text from a node */
function extractNodeText(node: TiptapNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(extractNodeText).join('');

    case 'paragraph':
      return extractInlineText(node.content) + '\n\n';

    case 'heading':
      return `*${extractInlineText(node.content)}*\n\n`;

    case 'bulletList':
      return (node.content ?? []).map((li) => `• ${extractListItemText(li)}`).join('\n') + '\n\n';

    case 'orderedList':
      return (node.content ?? []).map((li, i) => `${i + 1}. ${extractListItemText(li)}`).join('\n') + '\n\n';

    case 'listItem':
      return extractListItemText(node) + '\n';

    case 'blockquote':
      return `> ${(node.content ?? []).map(extractNodeText).join('').trim()}\n\n`;

    case 'horizontalRule':
      return '---\n\n';

    case 'image':
      return node.attrs?.alt ? `[${String(node.attrs.alt)}]\n` : '';

    case 'productBlock':
      return renderProductBlockText(node);

    default:
      if (node.content?.length) {
        return (node.content ?? []).map(extractNodeText).join('');
      }
      return '';
  }
}

/** Extract text from a list item (strips trailing newlines for inline use) */
function extractListItemText(node: TiptapNode): string {
  return (node.content ?? []).map(extractNodeText).join('').replace(/\n+$/, '');
}

/** Render a product block as structured WhatsApp text */
function renderProductBlockText(node: TiptapNode): string {
  const attrs = node.attrs ?? {};
  const name = String(attrs.productName ?? 'Product');
  const desc = String(attrs.description ?? '');
  const price = String(attrs.pricePerKg ?? '');
  const unit = String(attrs.unit ?? 'kg');

  let result = `📦 *${name}*`;
  if (price) result += ` — €${price}/${unit}`;
  result += '\n';
  if (desc) result += `   ${desc}\n`;
  result += '\n';
  return result;
}

// =============================================================================
// HTML HELPERS
// =============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Render Tiptap JSON document to a full branded HTML email.
 * Returns a complete HTML document ready for email delivery.
 */
export function renderUpdateToHtml(
  content: TiptapDocument,
  title: string,
): string {
  const bodyHtml = renderNodeToHtml(content as unknown as TiptapNode);
  return wrapEmailTemplate(bodyHtml, title);
}

/**
 * Render Tiptap JSON document to plain text for WhatsApp.
 * Uses WhatsApp formatting (*bold*, bullet points, etc.).
 * Returns cleaned-up plain text with no trailing whitespace.
 */
export function renderUpdateToText(
  content: TiptapDocument,
  title: string,
): string {
  const heading = `*${title}*\n\n`;
  const body = extractNodeText(content as unknown as TiptapNode);
  // Clean up: collapse 3+ newlines, trim
  const cleaned = (heading + body).replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

/**
 * Render Tiptap JSON to body-only HTML (no wrapper template).
 * Useful for previews and inline display.
 */
export function renderUpdateToBodyHtml(
  content: TiptapDocument,
): string {
  return renderNodeToHtml(content as unknown as TiptapNode);
}
