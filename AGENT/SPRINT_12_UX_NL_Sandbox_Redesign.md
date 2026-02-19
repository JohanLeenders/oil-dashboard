# SPRINT 12 — UX Redesign & NL Translation (CLI-Executable)

**Versie:** 2.1.0
**Status:** READY FOR CLI
**Auteur:** Claude Orchestrator (Opus 4.6)
**Datum:** 2026-02-13
**Changelog v2.1.0:** Fix #1 handler-string rail, Fix #2 chain UX guard, Fix #3 yield preset mass-balance, Fix #4 label audit
**Hangt af van:** Sprint 11A (DONE), Sprint 11B.2 (DONE)
**Blokkeert:** Niets — puur UI sprint

---

## 0. MISSION

Make the Scenario Sandbox usable by the commercial team.
Target: user runs a scenario in <60 seconds without instruction.

**Hard constraints:**
- Engine logic UNTOUCHED (no changes to `src/lib/engine/`)
- Schema UNTOUCHED (no migrations)
- No i18n framework — hardcoded NL in centralized labels file
- SandboxClient handler **logic** UNTOUCHED: no changes to branching, control flow, engine calls, state shape, or useState declarations. **String literals** inside handlers (toast messages, default names) MAY be replaced with `sandboxLabels` constants. Adding `applyPreset()` — which only calls existing setters — is allowed.
- Only JSX layout, labels, and formatting change

---

## 1. PHASE 12.1 — Centralized Labels File

### 1.1 CREATE: `src/lib/ui/sandboxLabels.ts`

Create this file. It is the SINGLE SOURCE OF TRUTH for all UI text in the sandbox.
Every sandbox component imports labels from here. No hardcoded strings in TSX files.

```typescript
/**
 * Sandbox UI Labels — Sprint 12.1
 *
 * Single source of truth for all Dutch UI text in the scenario sandbox.
 * Components import from here — no hardcoded strings in TSX.
 */

// ============================================================================
// PAGE-LEVEL
// ============================================================================

export const PAGE = {
  backLink: (batchRef: string) => `← Batch ${batchRef}`,
  title: 'Scenario Sandbox',
  subtitle: 'Verken wat-als scenario\u2019s voor deze batch',
  disclaimerTitle: 'Simulatie',
  disclaimerBody:
    'Dit is een simulatietool. Alle resultaten zijn hypothetisch. Gebruik dit NIET als boekhoudkundig advies.',
} as const;

// ============================================================================
// BASELINE SUMMARY (Step 1 — always visible)
// ============================================================================

export const BASELINE = {
  heading: 'Batchgegevens (Actueel)',
  liveWeight: 'Levend gewicht',
  grillerWeight: 'Grillergewicht',
  birdCount: 'Aantal dieren',
  livePrice: 'Levende prijs',
  kFactor: 'k-factor',
  svasoHeading: 'SVASO Verdeling (actueel)',
  baselineWaterfall: 'Kostenwaterval (Basis)',
  scenarioPrefix: (name: string) => `Scenario: ${name}`,
  // Waterfall labels
  l0: 'Inkoopkosten (L0)',
  l1: 'Gezamenlijke Kostenpool (L1)',
  l2: 'Netto Gezamenlijke Kosten (L2)',
  l3: 'SVASO Verdeling (L3)',
} as const;

// ============================================================================
// INPUT OVERRIDES (Step 2)
// ============================================================================

export const INPUTS = {
  heading: 'Wat wil je wijzigen?',
  livePrice: 'Levende prijs (€/kg)',
  livePriceHelper: (value: string) => `Huidig: €${value}/kg`,
  yieldHeading: (count: number) => `Opbrengsten aanpassen (${count})`,
  yieldHelper: (kg: string) => `Totaal moet optellen tot ${kg} kg (±0,1%)`,
  priceHeading: (count: number) => `Schaduwprijzen aanpassen (${count})`,
  priceHelper: 'Schaduwprijzen worden gebruikt voor SVASO-verdeling (Sales Value at Split-Off)',
  show: 'Tonen',
  hide: 'Verbergen',
} as const;

// ============================================================================
// SCENARIO PRESETS
// ============================================================================

export const PRESETS = {
  heading: 'Snelstart scenario\u2019s',
  items: [
    {
      id: 'breast_price_up_10',
      label: 'Filetprijs +10%',
      description: 'Wat als de filetmarktprijs 10% stijgt?',
      icon: '📈',
    },
    {
      id: 'live_price_up_010',
      label: 'Levend +€0,10/kg',
      description: 'Wat als de inkoopprijs €0,10 per kg stijgt?',
      icon: '🐔',
    },
    {
      id: 'legs_price_up_15',
      label: 'Poten duurder',
      description: 'Wat als de potenprijs 15% stijgt?',
      icon: '🦵',
    },
    {
      id: 'yield_down_2',
      label: 'Minder filet/poten/vleugels',
      description: 'Wat als de uitsnij-opbrengst 2% lager is? (extra rugkarkas)',
      icon: '📉',
    },
  ],
} as const;

// ============================================================================
// BUTTONS
// ============================================================================

export const BUTTONS = {
  runScenario: 'Bereken Scenario',
  running: 'Berekenen...',
  reset: 'Wissen',
  save: 'Scenario Opslaan',
  exportCsv: 'Exporteer CSV',
  advanced: 'Geavanceerd: Procesketeneditor',
} as const;

// ============================================================================
// RESULTS DISPLAY (Step 3)
// ============================================================================

export const RESULTS = {
  scenarioWaterfall: 'Kostenwaterval (Scenario)',
  deltaAnalysis: 'Verschilanalyse',
  svasoShifts: 'SVASO Verschuivingen',
  allocation: 'Verdeling',
  costPerKg: 'Kosten/kg',
  massBalanceValid: 'Massabalans Klopt',
  massBalanceViolated: 'Massabalans Geschonden',
  parts: 'Onderdelen',
  griller: 'Griller',
  delta: 'Verschil',
  tolerance: 'Tolerantie',
  computed: 'Berekend',
  engine: 'Engine',
  kFactorEfficiency: 'k-factor (effici\u00ebntie)',
} as const;

// ============================================================================
// PROCESS CHAIN EDITOR
// ============================================================================

export const CHAIN = {
  heading: 'Procesketeneditor (Geavanceerd)',
  enable: 'Procesketen Activeren',
  disable: 'Procesketen Deactiveren',
  nodes: 'Stappen',
  addNode: '+ Stap Toevoegen',
  remove: 'Verwijder',
  editNode: 'Stap Bewerken',
  newNodeLabel: 'Nieuwe Stap',
  label: 'Naam',
  nodeType: 'Type Bewerking',
  entity: 'Uitvoerder',
  variableCost: 'Variabel (€/kg)',
  fixedCost: 'Vast (€)',
  inputPartCode: 'Invoer Onderdeel',
  outputsHeading: 'Uitvoer (totaal ≤ 100%)',
  byProduct: 'Bijproduct',
  edges: 'Verbindingen',
  addEdge: '+ Verbinding Toevoegen',
  validate: 'Keten Valideren',
  validationErrors: 'Validatiefouten',
  lossDerived: 'Verlies (berekend)',
  // Chain results
  chainLayerTitle: 'Verwerkingskosten (Procesketen)',
  chainSummary: 'Overzicht Ketenkosten',
  totalChainCost: 'Totale Ketenkosten',
  variableCosts: 'Variabele Kosten',
  fixedCosts: 'Vaste Kosten',
  perNodeBreakdown: 'Kosten per Stap',
  finalOutputCosts: 'Eindproduct Kosten',
  input: 'Invoer',
  output: 'Uitvoer',
  loss: 'Verlies',
  lossKg: 'Verlies kg',
  outputs: 'Uitvoer:',
  // Edge editor
  edgeFrom: 'Van',
  edgeTo: 'Naar',
  edgePart: 'Onderdeel',
  // UX guard — shown above ChainResultsDisplay
  processingCostNote:
    'Procesketen = extra verwerkingskosten bovenop de SVASO-verdeling. ' +
    'Totale kostprijs = L3 (SVASO) + procesketen.',
  // Chain disabled state
  chainDisabledTitle: 'Procesketen (Sandbox)',
  chainDisabledDescription: 'Activeer om verwerkingsketens met meerdere stappen te modelleren',
  // Empty states
  noNodesYet: 'Nog geen stappen. Klik op "Stap Toevoegen" om te beginnen.',
  noEdgesYet: 'Nog geen verbindingen. Voeg verbindingen toe om stappen te koppelen.',
  selectNodeHint: 'Selecteer een stap om de eigenschappen te bewerken',
  addOutput: '+ Uitvoer Toevoegen',
  // Chain error state
  chainExecutionFailed: 'Ketenberekening Mislukt',
  massBalanceError: 'Massabalans Fout',
  totalInput: 'Totale Invoer',
  totalOutput: 'Totale Uitvoer',
  totalLoss: 'Totaal Verlies',
  relativeError: 'Relatieve Fout',
  total: 'Totaal',
  // Chain description (replaces English "Multi-step transformation costs...")
  chainDescription: 'Verwerkingskosten verdeeld naar uitvoerverhouding (niet SVASO)',
  error: 'Fout',
} as const;

// ============================================================================
// NODE TYPES (dropdown labels)
// ============================================================================

export const NODE_TYPES: Record<string, string> = {
  slaughter: 'Slacht',
  primal_cut: 'Primaire Uitsnij',
  sub_cut: 'Verdere Uitsnij',
  packaging: 'Verpakking',
  logistics: 'Logistiek',
  external_service: 'Externe Dienst',
};

// ============================================================================
// ENTITY TYPES (dropdown labels)
// ============================================================================

export const ENTITY_TYPES: Record<string, string> = {
  internal: 'Intern',
  contractor_a: 'Loonwerker A',
  contractor_b: 'Loonwerker B',
  contractor_c: 'Loonwerker C',
};

// ============================================================================
// PART CODE DISPLAY NAMES
// ============================================================================

export const PART_NAMES: Record<string, string> = {
  breast_cap: 'Borst',
  legs: 'Poten',
  wings: 'Vleugels',
  back_carcass: 'Rugkarkas',
  offal: 'Slachtafval',
  blood: 'Bloed',
  feathers: 'Veren',
};

/** Get NL display name for part_code. Falls back to raw code. */
export function partName(code: string): string {
  return PART_NAMES[code] ?? code;
}

// ============================================================================
// SAVE SCENARIO DIALOG
// ============================================================================

export const SAVE_DIALOG = {
  title: 'Scenario Opslaan',
  nameLabel: 'Scenarionaam *',
  namePlaceholder: 'bijv. Filetprijs +10%, Vleugels -5%',
  nameRequired: 'Voer een scenarionaam in',
  descriptionLabel: 'Beschrijving (optioneel)',
  descriptionPlaceholder: 'Beschrijf de aannames en het doel van dit scenario...',
  save: 'Opslaan',
  cancel: 'Annuleren',
} as const;

// ============================================================================
// SCENARIO LIST
// ============================================================================

export const SCENARIO_LIST = {
  heading: (count: number) => `Opgeslagen scenario\u2019s (${count})`,
  show: 'Tonen',
  hide: 'Verbergen',
  load: 'Laden',
  active: 'Actief',
  created: 'Aangemaakt',
  defaultName: 'Nieuw Scenario',
} as const;

// ============================================================================
// TOAST MESSAGES
// ============================================================================

export const TOASTS = {
  scenarioSuccess: 'Scenario succesvol berekend',
  scenarioChainSuccess: 'Scenario met procesketen berekend',
  scenarioFailed: 'Berekening mislukt',
  csvExported: 'CSV gedownload',
  csvFailed: 'CSV export mislukt',
  scenarioSaved: 'Scenario opgeslagen',
  scenarioSaveFailed: 'Opslaan mislukt',
  scenarioLoaded: (name: string) => `Scenario geladen: ${name}`,
  chainValidationFailed: (errors: string) => `Procesketen validatie mislukt: ${errors}`,
} as const;

// ============================================================================
// ERROR MESSAGES (chain validation)
// ============================================================================

export const ERRORS = {
  cycleDetected: 'Circulaire verwijzing gevonden in de procesketen',
  depthExceeded: 'Procesketen is te diep (maximaal 10 stappen)',
  invalidTransition: (from: string, to: string) =>
    `Ongeldige volgorde: ${from} mag niet gevolgd worden door ${to}`,
  cannotProcessByProduct: (code: string) =>
    `Bijproduct ${code} kan niet verder verwerkt worden`,
  outputsExceed100: (nodeLabel: string) =>
    `Stap ${nodeLabel}: uitvoer overschrijdt 100%`,
  disconnectedNodes: 'Er zijn losse stappen die nergens aan verbonden zijn',
  massBalanceViolated: 'Massabalans geschonden \u2014 totaalgewicht klopt niet',
  allocationFailed: 'Kostenverdeling klopt niet \u2014 neem contact op met beheerder',
  scenarioFailed: 'Berekening mislukt',
  massBalanceDetails: 'Massabalans Details',
  deltaExceedsTolerance: (deltaKg: string, toleranceKg: string) =>
    `Verschil: ${deltaKg} kg (overschrijdt tolerantie van ${toleranceKg} kg)`,
  fixInstruction: (grillerKg: string, toleranceKg: string) =>
    `Pas opbrengsten aan zodat het totaal uitkomt op ${grillerKg} kg ±${toleranceKg} kg`,
} as const;

// ============================================================================
// NUMBER FORMATTING (display-only)
// ============================================================================

const nlCurrency = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nlCurrencyPerKg = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nlWeight = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const nlWeightPrecise = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nlPct = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const nlKFactor = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const nlInteger = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format euro amount: "€ 11.700,00"
 * DISPLAY-ONLY — engine always receives raw numbers.
 */
export function fmtEur(value: number): string {
  return nlCurrency.format(value);
}

/** Format euro per kg: "€ 2,60/kg" */
export function fmtEurKg(value: number): string {
  return `${nlCurrencyPerKg.format(value)}/kg`;
}

/** Format weight: "4.500 kg" or "3.182,5 kg" */
export function fmtKg(value: number): string {
  return `${nlWeight.format(value)} kg`;
}

/** Format weight precise: "3.182,50 kg" */
export function fmtKgPrecise(value: number): string {
  return `${nlWeightPrecise.format(value)} kg`;
}

/** Format percentage: "42,1%" */
export function fmtPct(value: number): string {
  return `${nlPct.format(value)}%`;
}

/** Format k-factor: "0,847" */
export function fmtK(value: number): string {
  return nlKFactor.format(value);
}

/** Format integer: "1.800" */
export function fmtInt(value: number): string {
  return nlInteger.format(value);
}

/**
 * Format delta with sign: "+€ 450,00" or "-€ 123,45"
 * Uses raw formatDelta from engine for sign logic.
 */
export function fmtDeltaEur(value: number): string {
  if (value === 0) return '±€ 0,00';
  const sign = value > 0 ? '+' : '';
  return `${sign}${nlCurrency.format(value)}`;
}

/** Format delta percentage: "+6,4 pp" or "-1,5 pp" */
export function fmtDeltaPp(value: number): string {
  if (value === 0) return '±0,0 pp';
  const sign = value > 0 ? '+' : '';
  return `${sign}${nlPct.format(value)} pp`;
}

/** Format delta pct: "+3,2%" or "-1,5%" */
export function fmtDeltaPct(value: number): string {
  if (value === 0) return '±0,0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${nlPct.format(value)}%`;
}
```

### 1.2 CREATE: `src/lib/ui/__tests__/sandboxLabels.test.ts`

```typescript
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
```

### 1.3 GO/NO-GO GATE 12.1

Run:
```
npm test
npm run build
npm run lint
```

**Pass criteria:**
- [ ] `sandboxLabels.test.ts` — all tests pass
- [ ] `npm run build` — success (no TS errors in new file)
- [ ] All 392+ existing tests still pass
- [ ] No lint errors

**STOP after Phase 12.1. Report results. Wait for GO.**

---

## 2. PHASE 12.2 — Component Rewrites (Labels + Layout)

### 2.0 RULES

- Import ALL labels from `@/lib/ui/sandboxLabels`
- Import ALL formatters from `@/lib/ui/sandboxLabels`
- ZERO hardcoded English strings in TSX (except HTML attributes like `type="number"`)
- State management in SandboxClient.tsx: **DO NOT TOUCH** useState hooks, handler functions, or engine calls
- Only change: JSX return block, label text, formatting of displayed values
- `<input type="number">` keeps raw number values — formatting is display-only
- Process Chain Editor goes inside an accordion, default collapsed

### 2.1 MODIFY: `src/app/oil/batches/[batchId]/sandbox/page.tsx`

**What changes:**
- Import `PAGE` from `@/lib/ui/sandboxLabels`
- Replace all hardcoded text with `PAGE.*` constants
- Change disclaimer to amber (⚠ SIMULATIE)

**Exact replacements:**
| Line | Old | New |
|------|-----|-----|
| 48 | `← Batch {batchDetail.batch.batch_ref}` | `{PAGE.backLink(batchDetail.batch.batch_ref)}` |
| 52 | `Scenario Sandbox` | `{PAGE.title}` |
| 55 | `What-if analyse: wijzig inputs...` | `{PAGE.subtitle}` |
| 61 | `className="bg-blue-50 border border-blue-200..."` | `className="bg-amber-50 border border-amber-200..."` |
| 67 | `Scenario Disclaimer` | `{PAGE.disclaimerTitle}` |
| 69-70 | English disclaimer text | `{PAGE.disclaimerBody}` |

All blue → amber in disclaimer div (bg-blue-50 → bg-amber-50, border-blue-200 → border-amber-200, text-blue-900 → text-amber-900, text-blue-700 → text-amber-700, text-blue-600 → text-amber-600).

### 2.2 MODIFY: `src/app/oil/batches/[batchId]/sandbox/SandboxClient.tsx`

**CRITICAL: Handler LOGIC is UNTOUCHED.**

What MUST NOT change:
- All `useState` declarations (types, initial values stay identical except `'Unsaved Scenario'` → `SCENARIO_LIST.defaultName`)
- `const baseline = mapBatchToBaseline(batchDetail)` — untouched
- Branching, control flow, try/catch, if/else in all handler functions — untouched
- Engine calls: `runScenarioSandbox`, `applyProcessChainLayer`, `createScenario`, `exportScenarioCSV` — untouched
- State setters called and their arguments — untouched (except string literal replacements)

What MAY change inside handlers:
- String literals passed to `setToast({ message: '...' })` → replaced with `TOASTS.*` constants
- String literal `'Unsaved Scenario'` → `SCENARIO_LIST.defaultName`
- Template literals like `` `Loaded scenario: ${name}` `` → `TOASTS.scenarioLoaded(name)`

What is ADDED:
- `applyPreset()` function (calls only existing setters — see section 2.2)
- New imports from `sandboxLabels` and new components

**What changes: imports, string literals in handlers, JSX return block, and `applyPreset()` addition.**

Add imports:
```typescript
import {
  PAGE, BASELINE, INPUTS, BUTTONS, TOASTS, SCENARIO_LIST,
  PRESETS, CHAIN, ERRORS,
  fmtEur, fmtEurKg, fmtKg, fmtPct, fmtK, fmtInt, partName,
} from '@/lib/ui/sandboxLabels';
import { ScenarioPresets } from './ScenarioPresets';
```

**Toast messages — replace in handler functions (string changes only, no logic change):**

In `handleRunScenario`:
- `'Scenario with chain computed successfully'` → `TOASTS.scenarioChainSuccess`
- `'Scenario computed successfully'` → `TOASTS.scenarioSuccess`
- `result.error || 'Scenario failed'` → `result.error || TOASTS.scenarioFailed`
- `'Error running scenario'` → `TOASTS.scenarioFailed`
- `Chain validation failed: ${chainValidationErrors.join(', ')}` → `TOASTS.chainValidationFailed(chainValidationErrors.join(', '))`

In `handleSaveScenario`:
- `'Scenario saved successfully'` → `TOASTS.scenarioSaved`
- `result.error || 'Failed to save scenario'` → `result.error || TOASTS.scenarioSaveFailed`

In `handleLoadScenario`:
- `` `Loaded scenario: ${scenario.name}` `` → `TOASTS.scenarioLoaded(scenario.name)`

In `handleExportCSV`:
- `'CSV exported successfully'` → `TOASTS.csvExported`
- `'Failed to export CSV'` → `TOASTS.csvFailed`

In `handleReset`:
- `'Unsaved Scenario'` → `SCENARIO_LIST.defaultName`

Initial state:
- Line 58: `'Unsaved Scenario'` → `SCENARIO_LIST.defaultName`

**JSX layout rewrite:**

Replace the JSX return block (lines 201-401) with a single-column stepped layout:

```
<div className="space-y-6">
  {/* Step 1: Baseline — ALWAYS visible */}
  <BaselineCard baseline={baseline} scenarioResult={scenarioResult} />

  {/* Step 2: Inputs */}
  <InputSection>
    <ScenarioPresets baseline={baseline} onApply={applyPreset} />
    <InputOverridesForm ... (same props as current) />
    <Accordion label={BUTTONS.advanced}>
      <ProcessChainEditor ... (same props as current) />
    </Accordion>
  </InputSection>

  {/* Run / Reset buttons */}
  <ButtonBar />

  {/* Step 3: Results (only after run) */}
  {scenarioResult && scenarioResult.scenario && (
    <ResultsDisplay ... />
  )}
  {scenarioResult && scenarioResult.chain_layer && (
    <ChainResultsDisplay ... />
  )}

  {/* Save / Export */}
  ...

  {/* Saved scenarios — collapsed at bottom */}
  <ScenarioList ... />
</div>
```

**Button text replacements (inside the JSX return):**
- `{isRunning ? 'Running...' : 'Run Scenario'}` → `{isRunning ? BUTTONS.running : BUTTONS.runScenario}`
- `"Reset"` button → `{BUTTONS.reset}`
- `"Export CSV"` button → `{BUTTONS.exportCsv}`
- `"Save Scenario"` button → `{BUTTONS.save}`
- `"Baseline (Actueel)"` heading → `{BASELINE.heading}`
- `"Scenario: {currentScenarioName}"` heading → `{BASELINE.scenarioPrefix(currentScenarioName)}`
- `"Live weight:"` → `{BASELINE.liveWeight}:`
- `"Griller weight:"` → `{BASELINE.grillerWeight}:`
- `"Bird count:"` → `{BASELINE.birdCount}:`
- `"Baseline Waterfall"` → `{BASELINE.baselineWaterfall}`
- `"L0 Landed Cost:"` → `{BASELINE.l0}:`
- `"L1 Joint Cost Pool:"` → `{BASELINE.l1}:`
- `"L2 Net Joint Cost:"` → `{BASELINE.l2}:`
- `"L3 k-factor:"` → `{BASELINE.l3}:`
- All `€{value.toFixed(2)}` in baseline card → `{fmtEur(value)}`
- All `.toFixed(3)` k-factor → `{fmtK(value)}`
- All `{value.toFixed(0)} kg` → `{fmtKg(value)}`

The baseline card replaces the old left-column baseline section. It extracts the baseline data display and the baseline waterfall into a single always-visible card with NL labels:

**Baseline card content (inline in SandboxClient or extract as sub-component):**
- Heading: `BASELINE.heading`
- Labels: `BASELINE.liveWeight`, `BASELINE.grillerWeight`, `BASELINE.birdCount`
- Values: `fmtKg(baseline.live_weight_kg)`, `fmtKg(baseline.griller_weight_kg)`, `fmtInt(baseline.bird_count)`
- Live price: `fmtEurKg(baseline.live_price_per_kg)`
- k-factor from waterfall: `fmtK(baseline.waterfall.l3_svaso_allocation.k_factor)`
- SVASO distribution: show each joint product with `partName(jp.part_code)` and `fmtPct(allocation_pct)`
- Waterfall summary: use `BASELINE.l0` through `BASELINE.l3` with `fmtEur(...)` values

The old two-column `grid grid-cols-1 lg:grid-cols-2` is removed. Everything is single-column.

**Add preset application handler** (this is NOT new business logic — it only calls existing setters):

```typescript
const applyPreset = (presetId: string) => {
  switch (presetId) {
    case 'breast_price_up_10': {
      const bp = baseline.joint_products.find(jp => jp.part_code === 'breast_cap');
      if (bp) {
        setPriceOverrides([{ part_code: 'breast_cap', price_per_kg: bp.shadow_price_per_kg * 1.10 }]);
      }
      break;
    }
    case 'live_price_up_010': {
      setLivePriceOverride(baseline.live_price_per_kg + 0.10);
      break;
    }
    case 'legs_price_up_15': {
      const lp = baseline.joint_products.find(jp => jp.part_code === 'legs');
      if (lp) {
        setPriceOverrides([{ part_code: 'legs', price_per_kg: lp.shadow_price_per_kg * 1.15 }]);
      }
      break;
    }
    case 'yield_down_2': {
      // Scale joint products down 2%, add the freed weight to back_carcass
      // so total still equals griller_weight_kg → no mass-balance hard-block.
      const jointReduction = baseline.joint_products.reduce(
        (sum, jp) => sum + jp.weight_kg * 0.02, 0
      );
      const newYields: YieldOverride[] = baseline.joint_products.map(jp => ({
        part_code: jp.part_code,
        weight_kg: jp.weight_kg * 0.98,
      }));
      // Push the freed weight onto back_carcass (it's a by-product in all_parts)
      const backCarcass = baseline.by_products.find(bp => bp.type === 'back_carcass');
      if (backCarcass) {
        newYields.push({
          part_code: backCarcass.id, // 'back' — mergeOverrides matches on bp.id
          weight_kg: backCarcass.weight_kg + jointReduction,
        });
      }
      setYieldOverrides(newYields);
      break;
    }
  }
};
```

**Preset rules:**
- Presets ONLY call existing state setters (setLivePriceOverride, setYieldOverrides, setPriceOverrides)
- Presets NEVER call handleRunScenario — user must click "Bereken Scenario"
- Presets NEVER modify processChain state
- Presets compute relative to baseline (not absolute values)
- **MASS-BALANCE SAFETY**: Any preset that modifies yields MUST keep the sum of `all_parts` equal to `griller_weight_kg`. The `yield_down_2` preset achieves this by adding the freed joint-product weight to `back_carcass`.

### 2.3 CREATE: `src/app/oil/batches/[batchId]/sandbox/ScenarioPresets.tsx`

```typescript
'use client';

/**
 * Scenario Presets Component — Sprint 12.2
 *
 * Quick-start scenario buttons. Clicking fills inputs only.
 * User must still click "Bereken Scenario" to run.
 */

import { PRESETS } from '@/lib/ui/sandboxLabels';

interface ScenarioPresetsProps {
  onApply: (presetId: string) => void;
}

export function ScenarioPresets({ onApply }: ScenarioPresetsProps) {
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-gray-700">
        {PRESETS.heading}
      </h5>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.items.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onApply(preset.id)}
            className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-left text-sm transition-colors"
            title={preset.description}
          >
            <span className="text-lg">{preset.icon}</span>
            <div>
              <p className="font-medium text-gray-900">{preset.label}</p>
              <p className="text-xs text-gray-500">{preset.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 2.4 MODIFY: `src/app/oil/batches/[batchId]/sandbox/InputOverridesForm.tsx`

**What changes:**
- Add import: `import { INPUTS, fmtEurKg } from '@/lib/ui/sandboxLabels';`
- Replace `"Input Overrides"` → `{INPUTS.heading}`
- Replace `"Live Price (€/kg)"` → `{INPUTS.livePrice}`
- Replace `` `Baseline: €${baseline.live_price_per_kg.toFixed(2)}/kg` `` → `{INPUTS.livePriceHelper(baseline.live_price_per_kg.toFixed(2))}`
- Replace `` `Yield Overrides (${yieldOverrides.length})` `` → `{INPUTS.yieldHeading(yieldOverrides.length)}`
- Replace `'Hide'` / `'Show'` → `{showYieldForm ? INPUTS.hide : INPUTS.show}` (both toggles)
- Replace `'Shadow Prices'` → `{INPUTS.priceHeading(priceOverrides.length)}`
- Replace `Note: Total must balance to...` → `{INPUTS.yieldHelper(baseline.griller_weight_kg.toFixed(0))}`
- Replace `Shadow prices are used for SVASO allocation...` → `{INPUTS.priceHelper}`
- Replace `{jp.part_code}:` labels → `{partName(jp.part_code)}:`

NOTE: `<input type="number">` values remain raw numbers. Do NOT apply fmtEur to input values.

### 2.5 MODIFY: `src/app/oil/batches/[batchId]/sandbox/ResultsDisplay.tsx`

**What changes:**
- Add imports: `import { RESULTS, BASELINE, fmtEur, fmtK, fmtDeltaEur, fmtDeltaPct, fmtDeltaPp, fmtKgPrecise, partName } from '@/lib/ui/sandboxLabels';`
- Replace `"Scenario Waterfall"` → `{RESULTS.scenarioWaterfall}`
- Replace `"L0 Landed Cost:"` → `{BASELINE.l0}`
- Replace `"L1 Joint Cost Pool:"` → `{BASELINE.l1}`
- Replace `"L2 Net Joint Cost:"` → `{BASELINE.l2}`
- Replace `"L3 k-factor:"` → `{BASELINE.l3}`
- Replace `"Delta Analysis"` → `{RESULTS.deltaAnalysis}`
- Replace `"SVASO Allocation Shifts"` → `{RESULTS.svasoShifts}`
- Replace `"k-factor (efficiency):"` → `{RESULTS.kFactorEfficiency}`
- Replace `"Allocation:"` → `{RESULTS.allocation}:`
- Replace `"Cost/kg:"` → `{RESULTS.costPerKg}:`
- Replace `"Mass Balance Valid"` → `{RESULTS.massBalanceValid}`
- Replace `"Mass Balance Violated"` → `{RESULTS.massBalanceViolated}`
- Replace `"Parts:"` → `{RESULTS.parts}:`
- Replace `"Griller:"` → `{RESULTS.griller}:`
- Replace `"Delta:"` → `{RESULTS.delta}:`
- Replace `"Tolerance:"` → `{RESULTS.tolerance}:`
- Replace all `.toFixed(2)` euro displays → `fmtEur(value)`
- Replace all `.toFixed(3)` k-factor displays → `fmtK(value)`
- Replace `{alloc.part_code}` → `{partName(alloc.part_code)}`
- Replace `"Computed:"` → `{RESULTS.computed}:`
- Replace `"Engine:"` → `{RESULTS.engine}:`
- Replace `"Parts:"` / `"Griller:"` / `"Delta:"` / `"(Tolerance:"` in mass balance section → use `RESULTS.parts`, `RESULTS.griller`, `RESULTS.delta`, `RESULTS.tolerance` with `fmtKgPrecise(...)` formatting
- Remove old `formatDelta`/`formatDeltaPct`/`getDeltaColorClass` imports — replace with NL formatters

NOTE: `getDeltaColorClass` can still be imported from `@/lib/engine/scenario-sandbox` as it returns CSS classes (language-neutral). Or inline it.

### 2.6 MODIFY: `src/app/oil/batches/[batchId]/sandbox/ChainResultsDisplay.tsx`

**What changes:**
- Add import: `import { CHAIN, RESULTS, ERRORS, fmtEur, fmtKg, fmtPct, fmtEurKg } from '@/lib/ui/sandboxLabels';`
- **ADD UX GUARD** at the top of the success render path (before chain cost summary):
  ```tsx
  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
    <p className="text-sm text-purple-800">{CHAIN.processingCostNote}</p>
  </div>
  ```
  This ensures the user understands chain costs are ADDITIVE to SVASO, not a replacement.
- Replace all English strings with `CHAIN.*` and `RESULTS.*` constants
- Replace `.toFixed(2)` euro → `fmtEur(value)`
- Replace `.toFixed(1) kg` → `fmtKg(value)`
- Replace `.toFixed(1)%` → `fmtPct(value)`
- Replace `.toFixed(2)/kg` → `fmtEurKg(value)`
- Specific replacements (error path, lines 17-47):
  - `"Chain Execution Failed"` → `{CHAIN.chainExecutionFailed}`
  - `"Mass Balance Error:"` → `{CHAIN.massBalanceError}:`
  - `"Total Input:"` → `{CHAIN.totalInput}:`
  - `"Total Output:"` → `{CHAIN.totalOutput}:`
  - `"Total Loss:"` → `{CHAIN.totalLoss}:`
  - `"Relative Error:"` → `{CHAIN.relativeError}:`
  - `"Tolerance:"` → `{RESULTS.tolerance}:`
- Specific replacements (success path, lines 50-197):
  - `"Chain Layer (L4+ Processing Costs)"` → `{CHAIN.chainLayerTitle}`
  - `"Multi-step transformation costs allocated by yield proportion (NOT SVASO)"` → `{CHAIN.chainDescription}`
  - `"Chain Cost Summary"` → `{CHAIN.chainSummary}`
  - `"Total Chain Cost"` → `{CHAIN.totalChainCost}`
  - `"Variable Costs"` → `{CHAIN.variableCosts}`
  - `"Fixed Costs"` → `{CHAIN.fixedCosts}`
  - `"Per-Node Breakdown"` → `{CHAIN.perNodeBreakdown}`
  - `"Final Output Costs"` → `{CHAIN.finalOutputCosts}`
  - `"Mass Balance Valid"` → `{RESULTS.massBalanceValid}`
  - `"Error:"` (in mass balance success) → `{CHAIN.error}:`
  - `"Input:"`, `"Output:"`, `"Loss:"`, `"Loss kg:"` → `{CHAIN.input}:`, `{CHAIN.output}:`, `{CHAIN.loss}:`, `{CHAIN.lossKg}:`
  - `"Outputs:"` → `{CHAIN.outputs}`
  - `"(by-product)"` → `(${CHAIN.byProduct})`
  - `"Total:"` (in final outputs) → `{CHAIN.total}:`

### 2.7 MODIFY: `src/app/oil/batches/[batchId]/sandbox/ProcessChainEditor.tsx`

**What changes:**
- Add import: `import { CHAIN, NODE_TYPES, ENTITY_TYPES, partName } from '@/lib/ui/sandboxLabels';`
- Replace all English strings with `CHAIN.*` constants
- Replace node type dropdowns: instead of showing raw `slaughter`, show `NODE_TYPES[type] ?? type`
- Replace entity dropdowns: instead of showing raw `internal`, show `ENTITY_TYPES[entity] ?? entity`
- Replace part_code displays: `partName(code)` instead of raw code
- Put the entire component content inside an accordion wrapper in SandboxClient (not inside this component)

Specific string replacements:
- `"Process Chain Editor (v1 — Form-based)"` → `{CHAIN.heading}`
- `"Enable Chain"` → `{CHAIN.enable}`
- `"Disable Chain"` → `{CHAIN.disable}`
- `"Nodes"` → `{CHAIN.nodes}`
- `"Add Node"` → `{CHAIN.addNode}`
- `"Remove"` → `{CHAIN.remove}`
- `"Label"` → `{CHAIN.label}`
- `"Node Type"` → `{CHAIN.nodeType}`
- `"Entity"` → `{CHAIN.entity}`
- `"Variable (€/kg)"` → `{CHAIN.variableCost}`
- `"Fixed (€)"` → `{CHAIN.fixedCost}`
- `"Outputs"` → `{CHAIN.outputsHeading}`
- `"By-prod"` → `{CHAIN.byProduct}`
- `"Edges"` → `{CHAIN.edges}`
- `"Add Edge"` → `{CHAIN.addEdge}`
- `"Validation Errors"` → `{CHAIN.validationErrors}`
- `"Validate Chain"` (button) → `{CHAIN.validate}`
- `"Edit Node"` → `{CHAIN.editNode}`
- `"Input Part Code"` → `{CHAIN.inputPartCode}`
- `'New Node'` (default label in handleAddNode) → `CHAIN.newNodeLabel`
- `"Process Chain (Sandbox)"` (disabled state title) → `{CHAIN.chainDisabledTitle}`
- `"Enable to model custom processing chains..."` (disabled state description) → `{CHAIN.chainDisabledDescription}`
- `"No nodes yet. Click 'Add Node' to start."` → `{CHAIN.noNodesYet}`
- `"Select a node to edit its properties"` → `{CHAIN.selectNodeHint}`
- `"No edges yet. Add edges to connect nodes."` → `{CHAIN.noEdgesYet}`
- `"+ Add Output"` → `{CHAIN.addOutput}`
- `"Type:"` / `"Entity:"` inline labels → `{CHAIN.nodeType}: ... | {CHAIN.entity}: ...`
- `"Loss: ... (derived)"` → `{CHAIN.lossDerived}: ...`

### 2.8 MODIFY: `src/app/oil/batches/[batchId]/sandbox/SaveScenarioDialog.tsx`

**What changes:**
- Add import: `import { SAVE_DIALOG } from '@/lib/ui/sandboxLabels';`
- Replace `"Save Scenario"` → `{SAVE_DIALOG.title}`
- Replace `"Scenario Name *"` → `{SAVE_DIALOG.nameLabel}`
- Replace placeholder `"e.g., Live price +10%..."` → `{SAVE_DIALOG.namePlaceholder}`
- Replace `"Description (optional)"` → `{SAVE_DIALOG.descriptionLabel}`
- Replace placeholder `"Describe the scenario..."` → `{SAVE_DIALOG.descriptionPlaceholder}`
- Replace `alert('Please enter a scenario name')` → `alert(SAVE_DIALOG.nameRequired)`
- Replace `"Save"` button → `{SAVE_DIALOG.save}`
- Replace `"Cancel"` button → `{SAVE_DIALOG.cancel}`

### 2.9 MODIFY: `src/app/oil/batches/[batchId]/sandbox/ScenarioList.tsx`

**What changes:**
- Add import: `import { SCENARIO_LIST } from '@/lib/ui/sandboxLabels';`
- Replace `"Saved Scenarios (${scenarios.length})"` → `{SCENARIO_LIST.heading(scenarios.length)}`
- Replace `"Hide"` / `"Show"` → `{isExpanded ? SCENARIO_LIST.hide : SCENARIO_LIST.show}`
- Replace `"Load"` button → `{SCENARIO_LIST.load}`
- Replace `"Active"` badge → `{SCENARIO_LIST.active}`
- Replace `"Created:"` → `{SCENARIO_LIST.created}:`

### 2.10 MODIFY: `src/app/oil/batches/[batchId]/sandbox/SandboxClient.tsx` — Error display

The error display section (lines 337-362) needs NL labels:
- Replace `"Scenario Failed"` → `{ERRORS.scenarioFailed}`
- Replace `"Mass Balance Details:"` → `{ERRORS.massBalanceDetails}:`
- Replace `"Parts Total:"` → `{RESULTS.parts}:`
- Replace `"Griller Weight:"` → `{RESULTS.griller}:`
- Replace `"Delta: {deltaKg} kg (exceeds tolerance of {toleranceKg} kg)"` → `{ERRORS.deltaExceedsTolerance(fmtKgPrecise(delta_kg), fmtKgPrecise(tolerance_kg))}`
- Replace `"Fix:"` instruction → use `ERRORS.fixInstruction(fmtKgPrecise(griller_kg), fmtKgPrecise(tolerance_kg))`
- Format all kg values with `fmtKgPrecise(...)`

### 2.11 GO/NO-GO GATE 12.2

Run:
```
npm test
npm run build
npm run lint
```

**Pass criteria:**
- [ ] All 392+ existing tests still pass
- [ ] `npm run build` — success
- [ ] No lint errors
- [ ] Zero English UI strings visible in sandbox components (check with grep)

**Verification grep (must return 0 results for sandbox files):**
```bash
grep -rn "Scenario Sandbox\|Input Overrides\|Run Scenario\|Save Scenario\|Export CSV\|Mass Balance\|Landed Cost\|Joint Cost\|SVASO Allocation\|Shadow Prices\|Yield Overrides\|Bird count\|Live weight\|Griller weight\|Enable Chain\|Disable Chain\|Validate Chain\|Validation Errors\|Add Node\|Edit Node\|New Node\|Chain Execution Failed\|Variable Costs\|Fixed Costs\|Per-Node\|Final Output" src/app/oil/batches/\[batchId\]/sandbox/ --include="*.tsx"
```

Any matches = fail. All text must come from `sandboxLabels.ts`.

**STOP after Phase 12.2. Report results. Wait for GO.**

---

## 3. PHASE 12.3 — Accordion Component + Edge Editor

### 3.1 CREATE: `src/app/oil/batches/[batchId]/sandbox/Accordion.tsx`

Simple disclosure component used to wrap Process Chain Editor.

```typescript
'use client';

import { useState } from 'react';

interface AccordionProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ label, defaultOpen = false, children, className = '' }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-gray-200 rounded-lg ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <span>{label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
```

### 3.2 CREATE: `src/app/oil/batches/[batchId]/sandbox/EdgeEditor.tsx`

Replace the placeholder edge editor in ProcessChainEditor with working dropdowns.

```typescript
'use client';

/**
 * Edge Editor Component — Sprint 12.3
 *
 * Dropdown-based edge creation with transition validation.
 * Only shows valid "To" nodes based on ALLOWED_TRANSITIONS.
 */

import { useState } from 'react';
import type { ProcessChain, ProcessEdge } from '@/lib/engine/chain';
import { ALLOWED_TRANSITIONS } from '@/lib/engine/chain';
import { CHAIN, NODE_TYPES, partName } from '@/lib/ui/sandboxLabels';

interface EdgeEditorProps {
  chain: ProcessChain;
  onAddEdge: (edge: ProcessEdge) => void;
  onRemoveEdge: (index: number) => void;
}

export function EdgeEditor({ chain, onAddEdge, onRemoveEdge }: EdgeEditorProps) {
  const [fromNodeId, setFromNodeId] = useState('');
  const [toNodeId, setToNodeId] = useState('');
  const [partCode, setPartCode] = useState('');

  const fromNode = chain.nodes.find(n => n.id === fromNodeId);
  const toNode = chain.nodes.find(n => n.id === toNodeId);

  // Filter "To" nodes: only those with allowed transition from selected "From" node
  const validToNodes = fromNode
    ? chain.nodes.filter(n => {
        if (n.id === fromNodeId) return false;
        const allowed = ALLOWED_TRANSITIONS[fromNode.type];
        return allowed?.includes(n.type) ?? false;
      })
    : [];

  // Available outputs from the "From" node
  const availableOutputs = fromNode?.outputs ?? [];

  const handleAdd = () => {
    if (!fromNodeId || !toNodeId || !partCode) return;
    onAddEdge({
      id: `edge-${Date.now()}`,
      source_node_id: fromNodeId,
      target_node_id: toNodeId,
      part_code: partCode,
      flow_kg: null,
    });
    setFromNodeId('');
    setToNodeId('');
    setPartCode('');
  };

  return (
    <div className="space-y-3">
      <h5 className="text-sm font-medium text-gray-700">
        {CHAIN.edges} ({chain.edges.length})
      </h5>

      {/* Existing edges */}
      {chain.edges.map((edge, idx) => {
        const from = chain.nodes.find(n => n.id === edge.source_node_id);
        const to = chain.nodes.find(n => n.id === edge.target_node_id);
        return (
          <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2 border border-gray-200">
            <span>
              {from?.label ?? edge.source_node_id} → {to?.label ?? edge.target_node_id} ({partName(edge.part_code)})
            </span>
            <button
              onClick={() => onRemoveEdge(idx)}
              className="text-red-600 hover:text-red-700 text-xs"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Add edge form */}
      <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-200">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{CHAIN.edgeFrom}</label>
            <select
              value={fromNodeId}
              onChange={(e) => {
                setFromNodeId(e.target.value);
                setToNodeId('');
                setPartCode('');
              }}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
            >
              <option value="">—</option>
              {chain.nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.label} ({NODE_TYPES[n.type] ?? n.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{CHAIN.edgeTo}</label>
            <select
              value={toNodeId}
              onChange={(e) => setToNodeId(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              disabled={!fromNodeId}
            >
              <option value="">—</option>
              {validToNodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.label} ({NODE_TYPES[n.type] ?? n.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{CHAIN.edgePart}</label>
            <select
              value={partCode}
              onChange={(e) => setPartCode(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              disabled={!fromNodeId}
            >
              <option value="">—</option>
              {availableOutputs.map(o => (
                <option key={o.part_code} value={o.part_code}>
                  {partName(o.part_code)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={!fromNodeId || !toNodeId || !partCode}
          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {CHAIN.addEdge}
        </button>
      </div>
    </div>
  );
}
```

**NOTE:** This component requires `ALLOWED_TRANSITIONS` to be exported from `@/lib/engine/chain`. Verify this export exists. If not, export it from `src/lib/engine/chain/types.ts` and re-export from `src/lib/engine/chain/index.ts`.

### 3.3 MODIFY: `src/app/oil/batches/[batchId]/sandbox/ProcessChainEditor.tsx`

- Import `EdgeEditor` component
- Replace the placeholder edge section (the basic input-based edge add) with `<EdgeEditor chain={chain} onAddEdge={...} onRemoveEdge={...} />`
- The `onAddEdge` and `onRemoveEdge` handlers already exist in ProcessChainEditor — just wire them to EdgeEditor

### 3.4 GO/NO-GO GATE 12.3

Run:
```
npm test
npm run build
npm run lint
```

**Pass criteria:**
- [ ] All 392+ existing tests still pass
- [ ] `npm run build` — success
- [ ] `ALLOWED_TRANSITIONS` properly exported
- [ ] EdgeEditor component compiles without TS errors

**STOP after Phase 12.3. Report results. Wait for GO.**

---

## 4. PHASE 12.4 — Polish & Verification

### 4.1 Final pass: replace ALL remaining `.toFixed()` calls in sandbox components

Grep for `.toFixed(` in sandbox TSX files. Every instance should be replaced with the appropriate `fmtEur`, `fmtKg`, `fmtPct`, `fmtK`, `fmtEurKg`, or `fmtKgPrecise` function.

**Exception:** `.toFixed()` inside `<input>` placeholder attributes may stay as-is since they show what the user should type.

### 4.2 Verify: no English in UI

Run:
```bash
grep -rn '"[A-Z][a-z].*"' src/app/oil/batches/\[batchId\]/sandbox/ --include="*.tsx" | grep -v import | grep -v className | grep -v "type=" | grep -v "key=" | grep -v "//"
```

Any remaining English UI strings must be moved to `sandboxLabels.ts`.

### 4.3 Responsive check

Ensure all new components use existing Tailwind responsive patterns:
- `grid-cols-2` for presets on mobile stays `grid-cols-2` (small buttons)
- Accordion works on all viewports (full-width by default)
- No horizontal overflow on `< 768px`

### 4.4 GO/NO-GO GATE 12.4 (FINAL)

Run:
```
npm test
npm run build
npm run lint
```

**Pass criteria:**
- [ ] All 392+ existing tests still pass
- [ ] `sandboxLabels.test.ts` — all tests pass
- [ ] `npm run build` — success
- [ ] No lint errors
- [ ] Zero English strings in sandbox TSX (grep verification)
- [ ] All number formatting uses `fmtEur/fmtKg/fmtPct/fmtK/fmtInt` (no raw `.toFixed()` in display)

**STOP. Report full results. Wait for user visual inspection + GO for commit.**

---

## 5. DEFINITION OF DONE

### Must-have (all required for PASS):

- [ ] `src/lib/ui/sandboxLabels.ts` exists and exports all labels + formatters
- [ ] `src/lib/ui/__tests__/sandboxLabels.test.ts` exists and passes
- [ ] All sandbox TSX files import labels from `sandboxLabels.ts` — zero hardcoded English
- [ ] `ScenarioPresets.tsx` created with 4 presets
- [ ] Presets only modify ScenarioInput state (no auto-run, no chain mutation)
- [ ] Preset values are baseline-relative (not absolute)
- [ ] All number display uses `Intl.NumberFormat('nl-NL')` via `fmtEur/fmtKg/fmtPct/fmtK`
- [ ] `<input type="number">` values remain raw numbers (formatting is display-only)
- [ ] Process Chain Editor wrapped in Accordion (default collapsed)
- [ ] `EdgeEditor.tsx` created with dropdown-based edge creation
- [ ] Edge "To" dropdown filtered by `ALLOWED_TRANSITIONS`
- [ ] `Accordion.tsx` created (reusable disclosure component)
- [ ] SandboxClient state management UNCHANGED (all useState + handlers identical)
- [ ] SandboxClient handler string literals replaced with `TOASTS.*` / `SCENARIO_LIST.*` constants
- [ ] Chain UX guard (`CHAIN.processingCostNote`) rendered above ChainResultsDisplay
- [ ] `yield_down_2` preset redistributes freed weight to back_carcass (mass-balance safe)
- [ ] No changes to `src/lib/engine/` directory
- [ ] No schema changes / no migrations
- [ ] `npm test` PASS (all existing + new tests)
- [ ] `npm run build` PASS
- [ ] `npm run lint` PASS

### Nice-to-have (not blocking):

- [ ] `part_code` displayed as Dutch name everywhere (Borst, Poten, Vleugels)
- [ ] Disclaimer uses amber styling (⚠ SIMULATIE)
- [ ] Single-column layout (remove two-column grid)

---

## 6. FILES SUMMARY

### New files (5):

| File | Purpose |
|------|---------|
| `src/lib/ui/sandboxLabels.ts` | Centralized NL labels + number formatters |
| `src/lib/ui/__tests__/sandboxLabels.test.ts` | Unit tests for formatters |
| `src/app/oil/batches/[batchId]/sandbox/ScenarioPresets.tsx` | Quick-start preset buttons |
| `src/app/oil/batches/[batchId]/sandbox/Accordion.tsx` | Reusable accordion component |
| `src/app/oil/batches/[batchId]/sandbox/EdgeEditor.tsx` | Dropdown-based edge editor |

### Modified files (8):

| File | What changes |
|------|-------------|
| `page.tsx` | NL labels from `PAGE.*`, amber disclaimer |
| `SandboxClient.tsx` | NL labels, single-column layout, presets, accordion for chain |
| `InputOverridesForm.tsx` | NL labels from `INPUTS.*`, `partName()` |
| `ResultsDisplay.tsx` | NL labels from `RESULTS.*`, NL formatters |
| `ChainResultsDisplay.tsx` | NL labels from `CHAIN.*`, NL formatters |
| `ProcessChainEditor.tsx` | NL labels from `CHAIN.*`, `NODE_TYPES`, `ENTITY_TYPES`, EdgeEditor integration |
| `SaveScenarioDialog.tsx` | NL labels from `SAVE_DIALOG.*` |
| `ScenarioList.tsx` | NL labels from `SCENARIO_LIST.*` |

### Untouched files (must NOT be modified):

| File | Reason |
|------|--------|
| `src/lib/engine/*` | Engine canon — NEVER modify |
| `src/lib/engine/scenario-sandbox.ts` | Engine wrapper — NEVER modify |
| `src/lib/engine/sandbox/*` | Sandbox engine modules — NEVER modify |
| `src/lib/engine/chain/*` | Chain engine — NEVER modify |
| `src/lib/sandbox/mapBatchToBaseline.ts` | Mapper — no changes needed |
| `src/lib/sandbox/applyProcessChainLayer.ts` | Chain layer — no changes needed |
| `src/lib/sandbox/exportScenarioCSV.ts` | CSV export — no changes needed |
| `Toast.tsx` | Generic component — no changes needed |
| `supabase/migrations/*` | No schema changes |

---

*This document is CLI-executable. Each phase has exact file paths, string replacements, and a GO/NO-GO gate. The engine, schema, and state management are untouched.*
