/**
 * Order Intake Classifier — Wave 12
 *
 * Deterministic, rule-based classifier for detecting possible orders
 * in inbound messages. No AI, no external dependencies.
 *
 * Logic:
 *   IF (contains quantity token) AND (contains product keyword) → OrderIntent
 *   Confidence: 0.9 exact qty+product, 0.6 fuzzy, 0.3 partial
 *   No match → null (message stays only in OUT domain)
 */

import type { ClassificationResult, OrderIntentLine } from '@/types/order-intake';

// =============================================================================
// PRODUCT KEYWORD WHITELIST
// =============================================================================

/** Product keywords that indicate a poultry order. Lowercase, no diacritics needed for matching. */
const PRODUCT_KEYWORDS: readonly string[] = [
  'supremes',
  'supreme',
  'filet',
  'filets',
  'borstfilet',
  'borstfilets',
  'borstkapje',
  'borstkapjes',
  'borst',
  'dij',
  'dijen',
  'dijbout',
  'dijbouten',
  'drumstick',
  'drumsticks',
  'vleugel',
  'vleugels',
  'hele kip',
  'hele kippen',
  'oranjehoender',
  'oranjehoenders',
  'poot',
  'poten',
  'karkas',
  'karkassen',
  'haas',
  'haasjes',
  'zadel',
  'zadels',
  'boutjes',
  'bout',
  'bouten',
  'kippenvleugels',
  'kipfilet',
] as const;

// =============================================================================
// QUANTITY + UOM PATTERNS
// =============================================================================

/**
 * Match patterns like:
 *   "50 kg", "100 stuks", "3 dozen", "10x", "200 gram", "5 bak"
 *   Also: "50kg" (no space)
 */
const QTY_UOM_REGEX = /(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|gram|g|stuks?|doos|dozen|bakken|bak|x)\b/gi;

/**
 * Match bare number followed by product keyword:
 *   "50 filets", "100 hele kippen", "3 supremes"
 */
function buildBareNumberProductRegex(keyword: string): RegExp {
  return new RegExp(`(\\d+(?:[.,]\\d+)?)\\s+${escapeRegex(keyword)}\\b`, 'gi');
}

// =============================================================================
// MAIN CLASSIFIER
// =============================================================================

/**
 * Classify an inbound message text.
 * Returns ClassificationResult if message looks like an order, null otherwise.
 */
export function classifyInboundMessage(text: string): ClassificationResult | null {
  if (!text || text.trim().length === 0) return null;

  const lower = text.toLowerCase();

  // Detect product keywords present — longest first for specificity
  const rawMatches = PRODUCT_KEYWORDS
    .filter((kw) => lower.includes(kw))
    .sort((a, b) => b.length - a.length);

  // Deduplicate: if "borstfilet" matched, remove "borst" and "filet"
  const foundProducts = rawMatches.filter((kw) => {
    return !rawMatches.some((longer) => longer !== kw && longer.includes(kw));
  });
  const hasProducts = foundProducts.length > 0;

  // Detect quantity tokens
  const qtyMatches = [...lower.matchAll(QTY_UOM_REGEX)];
  const hasQty = qtyMatches.length > 0;

  // If neither found, not an order
  if (!hasProducts && !hasQty) return null;

  // If only one signal, low confidence — still not an intent
  // (per spec: IF qty AND product → create intent)
  if (!hasProducts || !hasQty) {
    // Check for bare number + product pattern as fallback
    const bareLines = extractBareNumberProductLines(lower, foundProducts);
    if (bareLines.length > 0) {
      return {
        lines: bareLines,
        confidence: roundConfidence(0.7),
      };
    }
    return null;
  }

  // Both qty and product found — parse lines
  const lines = parseOrderLines(lower, foundProducts);

  if (lines.length === 0) return null;

  // Confidence based on quality of parse
  const allHaveQty = lines.every((l) => l.qty > 0);
  const confidence = allHaveQty ? 0.9 : 0.6;

  return {
    lines,
    confidence: roundConfidence(confidence),
  };
}

// =============================================================================
// LINE PARSING
// =============================================================================

/**
 * Parse structured order lines from text.
 * Tries to associate quantity+uom with the nearest product keyword.
 */
function parseOrderLines(text: string, foundProducts: string[]): OrderIntentLine[] {
  const lines: OrderIntentLine[] = [];
  const used = new Set<number>(); // track which qty matches are consumed

  // Strategy 1: qty+uom directly followed by or near a product keyword
  const qtyMatches = [...text.matchAll(QTY_UOM_REGEX)];

  for (const match of qtyMatches) {
    const qty = parseQty(match[1]);
    const uom = normalizeUom(match[2]);
    const matchEnd = (match.index ?? 0) + match[0].length;

    // Look for a product keyword near this qty (within 40 chars after)
    const afterText = text.slice(matchEnd, matchEnd + 40);
    const nearProduct = foundProducts.find((kw) => afterText.includes(kw));

    if (nearProduct) {
      lines.push({ name_guess: nearProduct, qty, uom });
      used.add(match.index ?? 0);
    }
  }

  // Strategy 2: bare number + product keyword (e.g. "50 filets")
  for (const product of foundProducts) {
    // Skip if already matched by Strategy 1
    if (lines.some((l) => l.name_guess === product)) continue;

    const bareRegex = buildBareNumberProductRegex(product);
    const bareMatches = [...text.matchAll(bareRegex)];

    for (const match of bareMatches) {
      const qty = parseQty(match[1]);
      lines.push({ name_guess: product, qty, uom: 'stuks' });
    }
  }

  // Strategy 3: unmatched qty tokens — try to assign to remaining products
  for (const match of qtyMatches) {
    if (used.has(match.index ?? 0)) continue;
    if (lines.length > 0) continue; // only use this if we have no lines at all

    const qty = parseQty(match[1]);
    const uom = normalizeUom(match[2]);

    // Take the first unassigned product
    const unassigned = foundProducts.find(
      (kw) => !lines.some((l) => l.name_guess === kw)
    );
    if (unassigned) {
      lines.push({ name_guess: unassigned, qty, uom });
    }
  }

  return deduplicateLines(lines);
}

/**
 * Extract lines from bare number + product patterns (no explicit UOM).
 */
function extractBareNumberProductLines(
  text: string,
  foundProducts: string[]
): OrderIntentLine[] {
  const lines: OrderIntentLine[] = [];

  for (const product of foundProducts) {
    const regex = buildBareNumberProductRegex(product);
    const matches = [...text.matchAll(regex)];

    for (const match of matches) {
      lines.push({
        name_guess: product,
        qty: parseQty(match[1]),
        uom: 'stuks',
      });
    }
  }

  return lines;
}

// =============================================================================
// HELPERS
// =============================================================================

function parseQty(raw: string): number {
  // Handle comma as decimal separator
  const normalized = raw.replace(',', '.');
  return parseFloat(normalized) || 0;
}

function normalizeUom(raw: string): string {
  const lower = raw.toLowerCase();
  const map: Record<string, string> = {
    kg: 'kg',
    kilo: 'kg',
    kilogram: 'kg',
    gram: 'gram',
    g: 'gram',
    stuk: 'stuks',
    stuks: 'stuks',
    x: 'stuks',
    doos: 'dozen',
    dozen: 'dozen',
    bak: 'bakken',
    bakken: 'bakken',
  };
  return map[lower] ?? lower;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function deduplicateLines(lines: OrderIntentLine[]): OrderIntentLine[] {
  const seen = new Map<string, OrderIntentLine>();
  for (const line of lines) {
    const key = `${line.name_guess}:${line.uom}`;
    const existing = seen.get(key);
    if (existing) {
      existing.qty += line.qty;
    } else {
      seen.set(key, { ...line });
    }
  }
  return Array.from(seen.values());
}
