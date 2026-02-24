/**
 * templateRenderer.ts — Wave 10 Outreach Engine
 *
 * Pure functions for template rendering and selection.
 * No database calls. No side effects. No UI concerns.
 *
 * Responsibilities:
 *   - Render {{variable}} placeholders in body_text / body_html
 *   - Select a template from a pool using rotation (≠ last used)
 *   - Validate template content and detect signed / expiring image URLs
 */

import type {
  OutreachTemplate,
  OutreachSendChannel,
  OutreachTemplateVars,
} from '@/types/outreach';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RenderedMessage {
  channel: OutreachSendChannel;
  /** Rendered body — either plain text (WhatsApp) or HTML (email) */
  body: string;
  /** Email subject (null for WhatsApp) */
  subject: string | null;
}

// =============================================================================
// TEMPLATE VARIABLE RENDERING
// =============================================================================

/**
 * Replace all {{variable}} tokens in a template string.
 * Unknown tokens are left as-is (no silent deletion).
 * Pure function — input string is never mutated.
 */
export function renderTokens(
  template: string,
  vars: OutreachTemplateVars,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key in vars) {
      return String(vars[key as keyof OutreachTemplateVars] ?? '');
    }
    return `{{${key}}}`; // Leave unknown tokens intact — never silently empty
  });
}

/**
 * Render a template for a specific send channel.
 * Returns the channel-appropriate body with all tokens replaced.
 *
 * @throws Error if the template has no content for the requested channel
 */
export function renderTemplate(
  template: OutreachTemplate,
  vars: OutreachTemplateVars,
  channel: OutreachSendChannel,
): RenderedMessage {
  if (channel === 'whatsapp') {
    if (!template.body_text) {
      throw new Error(
        `Template "${template.name}" (${template.id}) has no body_text for WhatsApp`,
      );
    }
    return {
      channel: 'whatsapp',
      body: renderTokens(template.body_text, vars),
      subject: null,
    };
  }

  // channel === 'email'
  if (!template.body_html) {
    throw new Error(
      `Template "${template.name}" (${template.id}) has no body_html for email`,
    );
  }
  return {
    channel: 'email',
    body: renderTokens(template.body_html, vars),
    subject: template.subject ? renderTokens(template.subject, vars) : null,
  };
}

// =============================================================================
// TEMPLATE ROTATION / SELECTION
// =============================================================================

/**
 * Select a template from a pool using rotation logic.
 * Prefers a template that was NOT used last (anti-robot measure).
 *
 * Rules:
 *   1. Filter to active templates only
 *   2. If > 1 template available, exclude lastUsedTemplateId
 *   3. Pick randomly from the remaining pool
 *   4. If only 1 template exists, use it regardless of lastUsedTemplateId
 *   5. Returns null if the pool is empty
 *
 * Pure — randomness injected via optional `random` param for testability.
 */
export function selectTemplate(
  templates: OutreachTemplate[],
  lastUsedTemplateId: string | null,
  random: () => number = Math.random,
): OutreachTemplate | null {
  const active = templates.filter((t) => t.is_active);
  if (active.length === 0) return null;

  // Only apply rotation exclusion when we have more than 1 candidate
  const pool =
    active.length > 1 && lastUsedTemplateId !== null
      ? active.filter((t) => t.id !== lastUsedTemplateId)
      : active;

  const index = Math.floor(random() * pool.length);
  return pool[index];
}

// =============================================================================
// TEMPLATE VALIDATION
// =============================================================================

/**
 * Pattern that matches Supabase signed (expiring) Storage URLs.
 * These should never be used in outreach emails — they expire.
 *
 * ✗ https://xxx.supabase.co/storage/v1/object/sign/...?token=...
 * ✓ https://xxx.supabase.co/storage/v1/object/public/...
 */
const SIGNED_URL_PATTERN = /\/storage\/v1\/object\/sign\//i;

/**
 * Returns true if the URL is a Supabase signed (expiring) storage URL.
 * Produces a soft warning — not a hard error.
 */
export function detectSignedUrl(url: string): boolean {
  return SIGNED_URL_PATTERN.test(url);
}

/**
 * Extract all <img src="..."> URLs from an HTML string.
 * Pure string parsing — no DOM required.
 */
export function extractImageUrls(html: string): string[] {
  const pattern = /<img[^>]+src=["']([^"']+)["']/gi;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/**
 * Validate a template before marking it active.
 * Returns errors (hard blockers) and warnings (soft hints).
 *
 * Hard errors → template must NOT be activated:
 *   - No content for the declared channel
 *   - Email template missing subject
 *
 * Warnings → shown in UI, do not block activation:
 *   - body_html contains signed/expiring image URLs
 *   - Template has no active content for any channel
 */
export function validateTemplateContent(
  template: OutreachTemplate,
): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Hard errors ---

  const needsHtml = template.channel === 'email' || template.channel === 'both';
  const needsText =
    template.channel === 'whatsapp' || template.channel === 'both';

  if (needsHtml && !template.body_html) {
    errors.push(
      `Channel "${template.channel}" requires body_html — add email HTML content`,
    );
  }

  if (needsText && !template.body_text) {
    errors.push(
      `Channel "${template.channel}" requires body_text — add WhatsApp text content`,
    );
  }

  if (needsHtml && template.channel !== 'whatsapp' && !template.subject) {
    errors.push(
      `Email templates require a subject line — add one before activating`,
    );
  }

  // --- Soft warnings ---

  if (template.body_html) {
    const imageUrls = extractImageUrls(template.body_html);
    const signedUrls = imageUrls.filter(detectSignedUrl);
    if (signedUrls.length > 0) {
      warnings.push(
        `body_html contains ${signedUrls.length} signed Supabase Storage URL(s) that will expire. ` +
          `Use public URLs instead: /storage/v1/object/public/... ` +
          `Found: ${signedUrls.map((u) => u.substring(0, 60) + '...').join(', ')}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
