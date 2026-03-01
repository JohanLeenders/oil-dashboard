/**
 * Classifier Tests — Wave 12 Order Intake
 *
 * Deterministic rule-based classifier for detecting order intents.
 * ≥15 tests covering: multi-line, no-order, edge cases, qty formats, products.
 */

import { describe, it, expect } from 'vitest';
import { classifyInboundMessage } from './classifier';

describe('classifyInboundMessage', () => {
  // =========================================================================
  // POSITIVE: should detect orders
  // =========================================================================

  it('detects "50 kg supremes" as order', () => {
    const result = classifyInboundMessage('Graag 50 kg supremes');
    expect(result).not.toBeNull();
    expect(result!.lines).toHaveLength(1);
    expect(result!.lines[0].name_guess).toBe('supremes');
    expect(result!.lines[0].qty).toBe(50);
    expect(result!.lines[0].uom).toBe('kg');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects "100 stuks hele kip" as order', () => {
    const result = classifyInboundMessage('Wij willen graag 100 stuks hele kip bestellen');
    expect(result).not.toBeNull();
    expect(result!.lines).toHaveLength(1);
    expect(result!.lines[0].name_guess).toBe('hele kip');
    expect(result!.lines[0].qty).toBe(100);
    expect(result!.lines[0].uom).toBe('stuks');
  });

  it('detects "3 dozen drumsticks" as order', () => {
    const result = classifyInboundMessage('Stuur alsjeblieft 3 dozen drumsticks');
    expect(result).not.toBeNull();
    expect(result!.lines).toHaveLength(1);
    expect(result!.lines[0].name_guess).toBe('drumsticks');
    expect(result!.lines[0].qty).toBe(3);
    expect(result!.lines[0].uom).toBe('dozen');
  });

  it('detects "50 filets" (bare number + product)', () => {
    const result = classifyInboundMessage('Ik wil 50 filets');
    expect(result).not.toBeNull();
    expect(result!.lines).toHaveLength(1);
    expect(result!.lines[0].name_guess).toContain('filet');
    expect(result!.lines[0].qty).toBe(50);
  });

  it('detects multi-line order: "50 kg supremes en 20 kg dijbout"', () => {
    const result = classifyInboundMessage(
      'Graag 50 kg supremes en 20 kg dijbout voor vrijdag'
    );
    expect(result).not.toBeNull();
    expect(result!.lines.length).toBeGreaterThanOrEqual(2);
    expect(result!.confidence).toBeGreaterThanOrEqual(0.8);

    const names = result!.lines.map((l) => l.name_guess);
    expect(names).toContain('supremes');
    expect(names).toContain('dijbout');
  });

  it('detects "10 kg borstfilet" as order', () => {
    const result = classifyInboundMessage('Bestelling: 10 kg borstfilet');
    expect(result).not.toBeNull();
    expect(result!.lines[0].name_guess).toBe('borstfilet');
    expect(result!.lines[0].qty).toBe(10);
  });

  it('detects "5 bak vleugels" as order', () => {
    const result = classifyInboundMessage('Leveren: 5 bak vleugels');
    expect(result).not.toBeNull();
    expect(result!.lines[0].name_guess).toBe('vleugels');
    expect(result!.lines[0].qty).toBe(5);
    expect(result!.lines[0].uom).toBe('bakken');
  });

  it('detects decimal quantities like "2,5 kg filet"', () => {
    const result = classifyInboundMessage('Graag 2,5 kg filet');
    expect(result).not.toBeNull();
    expect(result!.lines[0].qty).toBe(2.5);
    expect(result!.lines[0].uom).toBe('kg');
  });

  it('detects "oranjehoender" as product keyword', () => {
    const result = classifyInboundMessage('Graag 25 kg oranjehoender');
    expect(result).not.toBeNull();
    expect(result!.lines[0].name_guess).toBe('oranjehoender');
  });

  it('detects "200 gram haas" as order', () => {
    const result = classifyInboundMessage('Ik wil 200 gram haas bestellen');
    expect(result).not.toBeNull();
    expect(result!.lines[0].qty).toBe(200);
    expect(result!.lines[0].uom).toBe('gram');
    expect(result!.lines[0].name_guess).toBe('haas');
  });

  // =========================================================================
  // NEGATIVE: should NOT detect orders
  // =========================================================================

  it('returns null for "Wanneer is de volgende levering?"', () => {
    const result = classifyInboundMessage('Wanneer is de volgende levering?');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(classifyInboundMessage('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(classifyInboundMessage('   \n  ')).toBeNull();
  });

  it('returns null for message with only numbers, no products', () => {
    const result = classifyInboundMessage('Ik heb 50 kg nodig voor mijn project');
    expect(result).toBeNull();
  });

  it('returns null for message with only product, no quantity', () => {
    const result = classifyInboundMessage('Hebben jullie supremes en dijbout?');
    expect(result).toBeNull();
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  it('handles multiline WhatsApp message', () => {
    const msg = `Hoi, bestelling voor deze week:
- 30 kg supremes
- 15 kg drumsticks
- 10 dozen vleugels
Groeten, Piet`;

    const result = classifyInboundMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.lines.length).toBeGreaterThanOrEqual(2);
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('handles case-insensitive matching', () => {
    const result = classifyInboundMessage('50 KG SUPREMES');
    expect(result).not.toBeNull();
    expect(result!.lines[0].name_guess).toBe('supremes');
  });

  it('handles "x" as unit (e.g. "10x")', () => {
    const result = classifyInboundMessage('10x drumsticks graag');
    expect(result).not.toBeNull();
    expect(result!.lines[0].qty).toBe(10);
    expect(result!.lines[0].uom).toBe('stuks');
  });

  it('deduplicates same product mentioned twice', () => {
    const result = classifyInboundMessage('20 kg supremes, nog 10 kg supremes');
    expect(result).not.toBeNull();
    // Should either merge (30kg) or have 2 separate lines
    const supremeLines = result!.lines.filter((l) => l.name_guess === 'supremes');
    const totalQty = supremeLines.reduce((sum, l) => sum + l.qty, 0);
    expect(totalQty).toBe(30);
  });

  it('confidence is always between 0 and 1', () => {
    const result = classifyInboundMessage('50 kg supremes');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });
});
