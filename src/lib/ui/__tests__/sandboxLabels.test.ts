/**
 * Sandbox Labels Tests — Sprint 12.1
 *
 * Validates formatting functions produce correct NL output.
 * Engine receives raw numbers — these are display-only.
 */
import { describe, it, expect } from 'vitest';
import {
  fmtEur,
  fmtEurKg,
  fmtKg,
  fmtPct,
  fmtK,
  fmtInt,
  fmtDeltaEur,
  fmtDeltaPp,
  partName,
  PAGE,
  BASELINE,
  PRESETS,
  CHAIN,
  TOASTS,
  ERRORS,
  BUTTONS,
  SCENARIO_LIST,
} from '../sandboxLabels';

describe('sandboxLabels formatting', () => {
  it('fmtEur: formats euro with NL locale', () => {
    const result = fmtEur(11700);
    // Must contain 11.700 (dot as thousands) and comma as decimal
    expect(result).toContain('11.700');
    expect(result).toContain('€');
  });

  it('fmtEurKg: appends /kg', () => {
    const result = fmtEurKg(2.6);
    expect(result).toContain('2,60');
    expect(result).toContain('/kg');
  });

  it('fmtKg: formats weight with NL locale', () => {
    const result = fmtKg(4500);
    expect(result).toContain('4.500');
    expect(result).toContain('kg');
  });

  it('fmtPct: formats percentage with comma', () => {
    expect(fmtPct(42.1)).toContain('42,1');
    expect(fmtPct(42.1)).toContain('%');
  });

  it('fmtK: formats k-factor 3 decimals', () => {
    expect(fmtK(0.847)).toContain('0,847');
  });

  it('fmtInt: formats integer with dot thousands separator', () => {
    expect(fmtInt(1800)).toBe('1.800');
  });

  it('fmtDeltaEur: positive shows +', () => {
    const result = fmtDeltaEur(450);
    expect(result).toMatch(/^\+/);
    expect(result).toContain('450');
  });

  it('fmtDeltaEur: negative shows -', () => {
    const result = fmtDeltaEur(-123.45);
    expect(result).toContain('-');
    expect(result).toContain('123');
  });

  it('fmtDeltaEur: zero shows ±', () => {
    expect(fmtDeltaEur(0)).toContain('±');
  });

  it('fmtDeltaPp: formats percentage points', () => {
    expect(fmtDeltaPp(6.4)).toContain('+');
    expect(fmtDeltaPp(6.4)).toContain('pp');
    expect(fmtDeltaPp(-1.5)).toContain('-');
  });

  it('partName: returns NL name for known codes', () => {
    expect(partName('breast_cap')).toBe('Borst');
    expect(partName('legs')).toBe('Poten');
    expect(partName('wings')).toBe('Vleugels');
  });

  it('partName: falls back to raw code for unknown', () => {
    expect(partName('unknown_part')).toBe('unknown_part');
  });

  it('PRESETS: has exactly 4 presets', () => {
    expect(PRESETS.items).toHaveLength(4);
  });

  it('labels are defined and non-empty', () => {
    expect(PAGE.title).toBeTruthy();
    expect(BASELINE.heading).toBeTruthy();
    expect(BUTTONS.runScenario).toBeTruthy();
    expect(SCENARIO_LIST.defaultName).toBeTruthy();
  });

  it('CHAIN: all chain labels defined', () => {
    expect(CHAIN.processingCostNote).toBeTruthy();
    expect(CHAIN.chainExecutionFailed).toBeTruthy();
    expect(CHAIN.chainDisabledTitle).toBeTruthy();
    expect(CHAIN.noNodesYet).toBeTruthy();
    expect(CHAIN.newNodeLabel).toBe('Nieuwe Stap');
  });

  it('TOASTS: function labels produce strings', () => {
    expect(TOASTS.scenarioLoaded('Test')).toContain('Test');
    expect(TOASTS.chainValidationFailed('err')).toContain('err');
  });

  it('ERRORS: function labels produce strings', () => {
    expect(ERRORS.deltaExceedsTolerance('1,50', '0,32')).toContain('1,50');
    expect(ERRORS.fixInstruction('320,00', '0,32')).toContain('320,00');
    expect(ERRORS.invalidTransition('Slacht', 'Logistiek')).toContain('Slacht');
  });
});
