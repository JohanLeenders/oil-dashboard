# SPRINT 12.3 — UX Guided Editing & Conceptual Clarity (CLI-Executable)

**Versie:** 1.1.0
**Status:** READY FOR CLI
**Review:** CONDITIONAL GO → GO (2 micro-fixes applied: k-factor uitleg herschreven, redistribute upper-bound guard toegevoegd)
**Auteur:** Claude Orchestrator (Opus 4.6)
**Datum:** 2026-02-13
**Hangt af van:** Sprint 12.2 (DONE — commit `2f9d56e`)
**Blokkeert:** Niets — puur UI sprint, engine untouched

---

## 0. MISSION

Maak de Sandbox begrijpelijk voor commerciële/operationele gebruikers die denken in procenten en processtappen — niet in kilogrammen en DAG-structuren.

**Target:** Gebruiker begrijpt binnen 10 seconden wat elke sectie doet, kan yields in % aanpassen, ziet live of de massabalans klopt, en kan één klik een standaard-procesketen laden.

**Hard constraints:**
- Engine logic UNTOUCHED (geen wijzigingen aan `src/lib/engine/**`)
- Sandbox lib UNTOUCHED (`src/lib/sandbox/**`)
- Schema UNTOUCHED (geen migraties)
- `supabase/**` UNTOUCHED
- Handler logic in SandboxClient UNTOUCHED: geen wijzigingen aan branching, control flow, engine calls, state shape, of useState declarations. UI-helper functies (conversie, redistribute) zijn toegestaan zolang ze alleen bestaande state-setters aanroepen.
- `YieldOverride` interface blijft `weight_kg: number` — percentages zijn PUUR UI-weergave
- Bestaande functionaliteit mag NIET breken

---

## 1. PHASE 12.3.1 — Labels: Inline Uitleg + Resultaatuitleg

### Doel
Voeg inline verklarende teksten toe aan sandboxLabels.ts zodat elke sectie van de sandbox een korte uitleg heeft.

### 1.1 WIJZIG: `src/lib/ui/sandboxLabels.ts`

**Voeg toe aan BASELINE** (na regel 41, vóór `} as const;`):

```typescript
  // Inline uitleg
  explanation: 'Dit zijn de werkelijke productiecijfers van deze batch. Ze worden niet gewijzigd door het scenario.',
```

**Voeg toe aan INPUTS** (na regel 56, vóór `} as const;`):

```typescript
  // Inline uitleg
  explanation: 'Pas hieronder de scenario-invoer aan. Alleen gewijzigde waarden worden meegenomen in de berekening.',
  yieldToggleKg: 'kg',
  yieldTogglePct: '%',
  yieldModePctHelper: (grillerKg: string) => `Percentage van grillergewicht (${grillerKg} kg). Totaal moet optellen tot 100% (±0,1%).`,
```

**Voeg toe aan RESULTS** (na regel 124, vóór `} as const;`):

```typescript
  // Inline uitleg
  explanation: 'De k-factor is de verhouding tussen gezamenlijke kosten en totale marktwaarde (SVASO). ' +
    'Verschuivingen tonen hoe de kostenverdeling verandert ten opzichte van de actuele batch.',
  shadowPriceWarning: 'Let op: schaduwprijzen staan op standaardwaarden — geen actuele marktdata geladen.',
```

**Voeg toe aan CHAIN** (na regel 192, vóór `} as const;`):

```typescript
  // Templates
  templateHeading: 'Begin met een sjabloon:',
  templateStandard: 'Standaard Uitsnij (intern)',
  templateStandardDesc: 'Eén verwerkingsstap: griller → borst, poten, vleugels, rugkarkas (intern)',
  templateLoaded: (name: string) => `Sjabloon geladen: ${name}`,
```

**Voeg nieuwe sectie toe** (na ERRORS, vóór NUMBER FORMATTING):

```typescript
// ============================================================================
// MASS BALANCE INDICATOR (live feedback during editing)
// ============================================================================

export const MASS_BALANCE = {
  label: 'Massabalans',
  ok: 'Klopt',
  warning: 'Let op — buiten tolerantie',
  total: (currentKg: string, targetKg: string) => `${currentKg} / ${targetKg} kg`,
  delta: (deltaKg: string, deltaPct: string) => `Verschil: ${deltaKg} kg (${deltaPct})`,
} as const;
```

### 1.2 WIJZIG: `src/lib/ui/__tests__/sandboxLabels.test.ts`

Voeg tests toe voor de nieuwe labels:

```typescript
describe('MASS_BALANCE labels', () => {
  it('has all required keys', () => {
    expect(MASS_BALANCE.label).toBe('Massabalans');
    expect(MASS_BALANCE.ok).toBe('Klopt');
    expect(MASS_BALANCE.warning).toBeTruthy();
  });

  it('formats total correctly', () => {
    expect(MASS_BALANCE.total('2.980,0', '3.000,0')).toContain('2.980,0');
    expect(MASS_BALANCE.total('2.980,0', '3.000,0')).toContain('3.000,0');
  });
});

describe('inline explanation labels', () => {
  it('BASELINE has explanation', () => {
    expect(BASELINE.explanation).toBeTruthy();
  });

  it('INPUTS has yield toggle labels', () => {
    expect(INPUTS.yieldToggleKg).toBe('kg');
    expect(INPUTS.yieldTogglePct).toBe('%');
  });

  it('INPUTS has pct mode helper', () => {
    expect(INPUTS.yieldModePctHelper('3.000')).toContain('3.000');
  });

  it('RESULTS has explanation', () => {
    expect(RESULTS.explanation).toBeTruthy();
  });

  it('CHAIN has template labels', () => {
    expect(CHAIN.templateHeading).toBeTruthy();
    expect(CHAIN.templateStandard).toBeTruthy();
    expect(CHAIN.templateLoaded('test')).toContain('test');
  });
});
```

Update imports at the top of the test file to include `MASS_BALANCE`.

### 1.3 WIJZIG: Componenten — inline uitleg invoegen

**`SandboxClient.tsx`** — Voeg `MASS_BALANCE` toe aan import. Na de baseline heading (huidige regel 258), voeg toe:

```tsx
<p className="text-xs text-gray-500 mt-1">{BASELINE.explanation}</p>
```

**`InputOverridesForm.tsx`** — Na de heading (huidige regel 42), voeg toe:

```tsx
<p className="text-xs text-gray-500">{INPUTS.explanation}</p>
```

**`ResultsDisplay.tsx`** — Na de scenario waterfall card (na regel 69, vóór de deltas card), voeg toe:

```tsx
{/* Uitleg blok */}
<div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
  <p className="text-xs text-blue-800">{RESULTS.explanation}</p>
</div>
```

### Verificatie fase 12.3.1

```bash
npm test
npm run build
npm run lint
```

**STOP na Phase 12.3.1. Report results. Wait for GO.**

---

## 2. PHASE 12.3.2 — KG/% Toggle + Live Massabalans-indicator

### Doel
Gebruiker kan yields bewerken in kg (huidige modus) of in % van grillergewicht. Live indicator toont of de massabalans klopt.

### ARCHITECTUURGARANTIE
```
Canonical truth = YieldOverride.weight_kg (altijd kg).
Percentage is PUUR UI-conversie. Nooit opgeslagen. Nooit naar engine gestuurd.

Conversie:
  kg → %:  displayPct = (weight_kg / griller_weight_kg) × 100
  % → kg:  weight_kg  = Math.round((pct / 100) × griller_weight_kg * 10) / 10
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         Afronding op 1 decimaal (0,1 kg) voorkomt floating-point drift.
```

### 2.1 WIJZIG: `InputOverridesForm.tsx`

**Voeg state toe** (na regel 37):

```typescript
const [yieldMode, setYieldMode] = useState<'kg' | 'pct'>('pct'); // Default = % (user mental model)
```

**Voeg conversie-helpers toe** (vóór de return statement):

```typescript
// Conversion helpers — UI-only, engine always receives weight_kg
const grillerKg = baseline.griller_weight_kg;

const toDisplayValue = (weightKg: number): string => {
  if (yieldMode === 'kg') return weightKg.toFixed(1);
  return ((weightKg / grillerKg) * 100).toFixed(1);
};

const fromInputValue = (inputValue: number, partCode: string): number => {
  if (yieldMode === 'kg') return inputValue;
  // % → kg: round to 0.1 kg to prevent floating-point drift
  return Math.round((inputValue / 100) * grillerKg * 10) / 10;
};

const unitSuffix = yieldMode === 'kg' ? 'kg' : '%';

// Live mass balance calculation
const computeMassBalance = (): { totalKg: number; deltaKg: number; deltaPct: number; valid: boolean } => {
  // Start with current overrides applied to baseline
  const parts = baseline.joint_products.map(jp => {
    const override = yieldOverrides.find(yo => yo.part_code === jp.part_code);
    return override ? override.weight_kg : jp.weight_kg;
  });
  // Add by-products that count toward griller mass balance (back_carcass + offal)
  const byProductKg = baseline.by_products
    .filter(bp => bp.type === 'back_carcass' || bp.type === 'offal')
    .map(bp => {
      const override = yieldOverrides.find(yo => yo.part_code === bp.id);
      return override ? override.weight_kg : bp.weight_kg;
    });
  const totalKg = parts.reduce((s, v) => s + v, 0) + byProductKg.reduce((s, v) => s + v, 0);
  const deltaKg = totalKg - grillerKg;
  const deltaPct = grillerKg > 0 ? (deltaKg / grillerKg) * 100 : 0;
  const valid = Math.abs(deltaKg / grillerKg) <= 0.001; // SANDBOX_MASS_BALANCE_TOLERANCE
  return { totalKg, deltaKg, deltaPct, valid };
};

const massBalance = computeMassBalance();
```

**Vervang de yield-sectie header** (huidige regels 64-73) met:

```tsx
<div className="flex items-center justify-between mb-2">
  <label className="block text-sm font-medium text-gray-700">
    {INPUTS.yieldHeading(yieldOverrides.length)}
  </label>
  <div className="flex items-center gap-2">
    {/* KG/% toggle */}
    <div className="flex rounded-md border border-gray-300 text-xs">
      <button
        type="button"
        onClick={() => setYieldMode('kg')}
        className={`px-2 py-1 rounded-l-md transition-colors ${
          yieldMode === 'kg' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {INPUTS.yieldToggleKg}
      </button>
      <button
        type="button"
        onClick={() => setYieldMode('pct')}
        className={`px-2 py-1 rounded-r-md transition-colors ${
          yieldMode === 'pct' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {INPUTS.yieldTogglePct}
      </button>
    </div>
    <button
      onClick={() => setShowYieldForm(!showYieldForm)}
      className="text-xs text-blue-600 hover:text-blue-700"
    >
      {showYieldForm ? INPUTS.hide : INPUTS.show}
    </button>
  </div>
</div>
```

**Vervang de yield input rij** (huidige regels 81-101) — per joint product:

```tsx
<div key={jp.part_code} className="flex items-center gap-2">
  <span className="text-xs text-gray-600 w-24">{partName(jp.part_code)}:</span>
  <input
    type="number"
    step={yieldMode === 'kg' ? '0.1' : '0.1'}
    placeholder={toDisplayValue(jp.weight_kg)}
    value={override ? toDisplayValue(override.weight_kg) : ''}
    onChange={(e) => {
      const raw = e.target.value ? parseFloat(e.target.value) : null;
      if (raw !== null) {
        const weightKg = fromInputValue(raw, jp.part_code);
        const newOverrides = yieldOverrides.filter((yo) => yo.part_code !== jp.part_code);
        newOverrides.push({ part_code: jp.part_code, weight_kg: weightKg });
        onYieldOverridesChange(newOverrides);
      } else {
        onYieldOverridesChange(yieldOverrides.filter((yo) => yo.part_code !== jp.part_code));
      }
    }}
    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
  />
  <span className="text-xs text-gray-500 w-6">{unitSuffix}</span>
</div>
```

**Vervang de yield helper text** (huidige regels 104-106) met:

```tsx
<p className="text-xs text-gray-500 mt-2">
  {yieldMode === 'kg'
    ? INPUTS.yieldHelper(baseline.griller_weight_kg.toFixed(0))
    : INPUTS.yieldModePctHelper(fmtKg(baseline.griller_weight_kg).replace(' kg', ''))}
</p>
```

**Voeg live massabalans-indicator toe** (direct onder de yield helper, nog binnen de `showYieldForm` block):

```tsx
{/* Live mass balance indicator */}
<div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
  massBalance.valid
    ? 'bg-green-50 border border-green-200 text-green-800'
    : 'bg-amber-50 border border-amber-200 text-amber-800'
}`}>
  <span className={`w-2 h-2 rounded-full ${massBalance.valid ? 'bg-green-500' : 'bg-amber-500'}`} />
  <span className="font-medium">{MASS_BALANCE.label}:</span>
  <span>{MASS_BALANCE.total(
    fmtKgPrecise(massBalance.totalKg).replace(' kg', ''),
    fmtKgPrecise(grillerKg).replace(' kg', '')
  )}</span>
  <span className={massBalance.valid ? 'text-green-600' : 'text-amber-600'}>
    ({MASS_BALANCE.delta(
      (massBalance.deltaKg >= 0 ? '+' : '') + fmtKgPrecise(Math.abs(massBalance.deltaKg)).replace(' kg', '') + ' kg',
      (massBalance.deltaPct >= 0 ? '+' : '') + massBalance.deltaPct.toFixed(1) + '%'
    )})
  </span>
  <span className="ml-auto">{massBalance.valid ? MASS_BALANCE.ok : MASS_BALANCE.warning}</span>
</div>
```

**Update imports** aan de bovenkant van InputOverridesForm.tsx:

```typescript
import { INPUTS, MASS_BALANCE, partName, fmtKg, fmtKgPrecise } from '@/lib/ui/sandboxLabels';
```

### 2.2 BELANGRIJK — Indicator toont ALTIJD, ook zonder overrides

De `computeMassBalance()` functie moet werken met baseline-waarden als fallback. Wanneer er geen overrides zijn, toont het: `3.000,00 / 3.000,00 kg (Verschil: +0,00 kg (+0,0%)) — Klopt`.

Dit is belangrijk zodat de gebruiker het effect van elke wijziging direct ziet.

### Verificatie fase 12.3.2

```bash
npm test
npm run build
npm run lint
```

**STOP na Phase 12.3.2. Report results. Wait for GO.**

---

## 3. PHASE 12.3.3 — Auto-redistribute Logica

### Doel
Wanneer de gebruiker één yield-onderdeel aanpast, bied aan om het verschil automatisch te verdelen over de overige onderdelen (primair naar back_carcass).

### ARCHITECTUURGARANTIE
```
Auto-redistribute is een UI-convenience functie.
Het roept alleen de bestaande onYieldOverridesChange setter aan.
Het wijzigt GEEN engine logica, GEEN mergeOverrides, GEEN validatie.
De gebruiker kan het resultaat altijd handmatig overschrijven.
```

### 3.1 WIJZIG: `src/lib/ui/sandboxLabels.ts`

**Voeg toe aan INPUTS** (na `yieldModePctHelper`):

```typescript
  autoRedistribute: 'Auto-verdelen',
  autoRedistributeHelper: 'Verdeel het verschil automatisch over rugkarkas',
  autoRedistributeApplied: (deltaKg: string) => `${deltaKg} kg herverdeeld naar rugkarkas`,
```

### 3.2 WIJZIG: `InputOverridesForm.tsx`

**Voeg auto-redistribute functie toe** (na `computeMassBalance`):

```typescript
// Auto-redistribute: push excess/deficit to back_carcass
const handleAutoRedistribute = () => {
  const { deltaKg } = computeMassBalance();
  if (Math.abs(deltaKg) < 0.01) return; // Already balanced

  const backCarcass = baseline.by_products.find(bp => bp.type === 'back_carcass');
  if (!backCarcass) return;

  // Current back_carcass weight (from override or baseline)
  const currentBackOverride = yieldOverrides.find(yo => yo.part_code === backCarcass.id);
  const currentBackKg = currentBackOverride ? currentBackOverride.weight_kg : backCarcass.weight_kg;

  // Adjust: subtract the delta (if total is over, reduce back; if under, increase back)
  const newBackKg = Math.round((currentBackKg - deltaKg) * 10) / 10;

  // Guard: don't let back_carcass go negative or exceed 40% of griller
  if (newBackKg < 0) return;
  if (newBackKg > grillerKg * 0.40) return; // Physically unrealistic — user must fix manually

  const newOverrides = yieldOverrides.filter(yo => yo.part_code !== backCarcass.id);
  newOverrides.push({ part_code: backCarcass.id, weight_kg: newBackKg });
  onYieldOverridesChange(newOverrides);
};
```

**Voeg redistribute-knop toe** (onder de massabalans-indicator, alleen zichtbaar als !valid):

```tsx
{!massBalance.valid && (
  <button
    type="button"
    onClick={handleAutoRedistribute}
    className="mt-2 w-full px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-md hover:bg-amber-200 transition-colors flex items-center justify-center gap-1"
  >
    <span>⚖️</span>
    <span>{INPUTS.autoRedistribute}</span>
    <span className="text-amber-600">— {INPUTS.autoRedistributeHelper}</span>
  </button>
)}
```

### 3.3 WIJZIG: `src/lib/ui/__tests__/sandboxLabels.test.ts`

Voeg test toe:

```typescript
it('INPUTS has auto-redistribute labels', () => {
  expect(INPUTS.autoRedistribute).toBe('Auto-verdelen');
  expect(INPUTS.autoRedistributeHelper).toBeTruthy();
  expect(INPUTS.autoRedistributeApplied('5,0')).toContain('5,0');
});
```

### Verificatie fase 12.3.3

```bash
npm test
npm run build
npm run lint
```

**STOP na Phase 12.3.3. Report results. Wait for GO.**

---

## 4. PHASE 12.3.4 — Chain Template: Standaard Uitsnij

### Doel
Eén-klik laden van een standaard procesketen zodat de chain-editor niet leeg begint.

### ARCHITECTUURGARANTIE
```
Template is een statisch ProcessChain object.
Het wordt geladen via de bestaande onChange callback.
Het passeert validateProcessChain() bij laden.
Geen engine wijzigingen. Geen nieuwe types.
```

### 4.1 NIEUW: `src/lib/ui/chainTemplates.ts`

Maak dit bestand:

```typescript
/**
 * Chain Templates — Sprint 12.3
 *
 * Pre-configured ProcessChain objects for common use cases.
 * Templates are validated at load time via validateProcessChain().
 */

import type { ProcessChain } from '@/lib/engine/chain';

export interface ChainTemplate {
  id: string;
  label: string;
  description: string;
  chain: ProcessChain;
}

/**
 * Template: Standaard uitsnij (alles intern)
 *
 * Single primal_cut node: griller → breast_cap (45%) + legs (30%) + wings (5%) + back_carcass (20%)
 * These are approximate industry-standard yields for griller cut-up.
 * Loss is 0% in this template — all input becomes output.
 */
export const STANDARD_CUT_TEMPLATE: ChainTemplate = {
  id: 'standard_cut_internal',
  label: 'Standaard Uitsnij (intern)',
  description: 'Eén verwerkingsstap: griller → borst, poten, vleugels, rugkarkas',
  chain: {
    version: '1.0.0',
    nodes: [
      {
        id: 'node-template-primal',
        type: 'primal_cut',
        label: 'Primaire Uitsnij',
        entity: 'internal',
        inputs: [{ part_code: 'griller', required_kg: null }],
        outputs: [
          { part_code: 'breast_cap', yield_pct: 45, is_by_product: false },
          { part_code: 'legs', yield_pct: 30, is_by_product: false },
          { part_code: 'wings', yield_pct: 5, is_by_product: false },
          { part_code: 'back_carcass', yield_pct: 20, is_by_product: true },
        ],
        variable_cost_per_kg: 0.50,
        fixed_cost_per_execution: 0,
        is_valid: true,
        validation_errors: [],
      },
    ],
    edges: [],
    created_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
  },
};

/** All available templates */
export const CHAIN_TEMPLATES: ChainTemplate[] = [
  STANDARD_CUT_TEMPLATE,
];
```

### 4.2 NIEUW: `src/lib/ui/__tests__/chainTemplates.test.ts`

```typescript
/**
 * Chain Templates Tests — Sprint 12.3
 */

import { describe, it, expect } from 'vitest';
import { CHAIN_TEMPLATES, STANDARD_CUT_TEMPLATE } from '../chainTemplates';
import { validateProcessChain } from '@/lib/engine/chain';

describe('chainTemplates', () => {
  it('exports at least one template', () => {
    expect(CHAIN_TEMPLATES.length).toBeGreaterThanOrEqual(1);
  });

  it('STANDARD_CUT_TEMPLATE has required fields', () => {
    expect(STANDARD_CUT_TEMPLATE.id).toBe('standard_cut_internal');
    expect(STANDARD_CUT_TEMPLATE.label).toBeTruthy();
    expect(STANDARD_CUT_TEMPLATE.chain.version).toBe('1.0.0');
    expect(STANDARD_CUT_TEMPLATE.chain.nodes).toHaveLength(1);
  });

  it('STANDARD_CUT_TEMPLATE node has correct outputs', () => {
    const node = STANDARD_CUT_TEMPLATE.chain.nodes[0];
    expect(node.type).toBe('primal_cut');
    expect(node.entity).toBe('internal');
    expect(node.outputs).toHaveLength(4);

    const totalYield = node.outputs.reduce((sum, o) => sum + o.yield_pct, 0);
    expect(totalYield).toBe(100); // No loss in standard template
  });

  it('STANDARD_CUT_TEMPLATE passes chain validation', () => {
    const result = validateProcessChain(STANDARD_CUT_TEMPLATE.chain);
    expect(result.valid).toBe(true);
  });

  it('all templates pass chain validation', () => {
    for (const template of CHAIN_TEMPLATES) {
      const result = validateProcessChain(template.chain);
      expect(result.valid).toBe(true);
    }
  });
});
```

### 4.3 WIJZIG: `ProcessChainEditor.tsx`

**Voeg import toe** (boven aan het bestand):

```typescript
import { CHAIN_TEMPLATES } from '@/lib/ui/chainTemplates';
import { validateProcessChain } from '@/lib/engine/chain';
```

**Voeg template-laad functie toe** (na `handleValidate`, rond regel 162):

```typescript
// Load a template chain
const handleLoadTemplate = (templateId: string) => {
  const template = CHAIN_TEMPLATES.find(t => t.id === templateId);
  if (!template) return;

  // Deep clone + fresh timestamps
  const clonedChain: ProcessChain = {
    ...template.chain,
    nodes: template.chain.nodes.map(n => ({
      ...n,
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      outputs: n.outputs.map(o => ({ ...o })),
      inputs: n.inputs.map(i => ({ ...i })),
    })),
    edges: [], // Templates with edges would need ID remapping
    created_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
  };

  onChange(clonedChain);

  // Validate immediately
  const result = validateProcessChain(clonedChain);
  if (result.valid) {
    onValidationChange(true, []);
    setValidationErrors([]);
  } else {
    const errors = result.error ? [result.error] : [];
    setValidationErrors(errors);
    onValidationChange(false, errors);
  }
};
```

**Voeg template-selectie toe** in de disabled state (huidige regels 172-189). Vervang het hele disabled-blok:

```tsx
if (!enabled) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{CHAIN.chainDisabledTitle}</h4>
          <p className="text-xs text-gray-600 mt-1">
            {CHAIN.chainDisabledDescription}
          </p>
        </div>
        <button
          onClick={() => handleToggle(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {CHAIN.enable}
        </button>
      </div>
    </div>
  );
}
```

**Voeg template-knoppen toe** in de enabled state, direct na het header-blok (na regel 214, vóór het validation panel):

```tsx
{/* Template loader — shown when chain has no nodes */}
{(!chain?.nodes || chain.nodes.length === 0) && (
  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4">
    <p className="text-xs font-medium text-gray-700 mb-2">{CHAIN.templateHeading}</p>
    <div className="flex flex-wrap gap-2">
      {CHAIN_TEMPLATES.map(template => (
        <button
          key={template.id}
          onClick={() => handleLoadTemplate(template.id)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-left text-xs transition-colors"
          title={template.description}
        >
          <span className="text-base">🏭</span>
          <div>
            <p className="font-medium text-gray-900">{template.label}</p>
            <p className="text-gray-500">{template.description}</p>
          </div>
        </button>
      ))}
    </div>
  </div>
)}
```

### Verificatie fase 12.3.4

```bash
npm test
npm run build
npm run lint
```

**STOP na Phase 12.3.4. Report results. Wait for GO.**

---

## 5. PHASE 12.3.5 — Edge Creator Functioneel

### Doel
Maak het edge-toevoeg formulier werkend met dropdowns voor bron, doel, en part_code. Gebruik ALLOWED_TRANSITIONS om ongeldige combinaties te filteren.

### ARCHITECTUURGARANTIE
```
Geen engine wijzigingen. ALLOWED_TRANSITIONS is al geëxporteerd uit chain/types.ts.
Edge creator roept de bestaande handleAddEdge callback aan.
Validatie is bestaande validateProcessChain.
```

### 5.1 WIJZIG: `ProcessChainEditor.tsx`

**Voeg import toe:**

```typescript
import { ALLOWED_TRANSITIONS } from '@/lib/engine/chain';
```

**Voeg edge-creator state toe** (na `validationErrors` state, rond regel 30):

```typescript
const [newEdgeSource, setNewEdgeSource] = useState<string>('');
const [newEdgeTarget, setNewEdgeTarget] = useState<string>('');
const [newEdgePartCode, setNewEdgePartCode] = useState<string>('');
```

**Vervang het edge-adder blok** (huidige regels 509-516, het "Simple edge adder" placeholder). Vervang met:

```tsx
{/* Edge creator form — only when 2+ nodes exist */}
{chain && chain.nodes.length >= 2 && (
  <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
    <p className="text-xs font-medium text-gray-700">{CHAIN.addEdge}</p>
    <div className="grid grid-cols-3 gap-2">
      {/* Source node dropdown */}
      <select
        value={newEdgeSource}
        onChange={(e) => {
          setNewEdgeSource(e.target.value);
          setNewEdgeTarget(''); // Reset target when source changes
        }}
        className="px-2 py-1 border border-gray-300 rounded text-xs"
      >
        <option value="">{CHAIN.edgeFrom}...</option>
        {chain.nodes.map(node => (
          <option key={node.id} value={node.id}>{node.label}</option>
        ))}
      </select>

      {/* Target node dropdown — filtered by ALLOWED_TRANSITIONS */}
      <select
        value={newEdgeTarget}
        onChange={(e) => setNewEdgeTarget(e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded text-xs"
        disabled={!newEdgeSource}
      >
        <option value="">{CHAIN.edgeTo}...</option>
        {chain.nodes
          .filter(node => {
            if (node.id === newEdgeSource) return false; // Can't connect to self
            const sourceNode = chain.nodes.find(n => n.id === newEdgeSource);
            if (!sourceNode) return false;
            return ALLOWED_TRANSITIONS[sourceNode.type]?.includes(node.type) ?? false;
          })
          .map(node => (
            <option key={node.id} value={node.id}>{node.label}</option>
          ))}
      </select>

      {/* Part code dropdown — from source node outputs */}
      <select
        value={newEdgePartCode}
        onChange={(e) => setNewEdgePartCode(e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded text-xs"
        disabled={!newEdgeSource}
      >
        <option value="">{CHAIN.edgePart}...</option>
        {chain.nodes
          .find(n => n.id === newEdgeSource)
          ?.outputs.map(output => (
            <option key={output.part_code} value={output.part_code}>
              {partName(output.part_code)}
            </option>
          ))}
      </select>
    </div>

    <button
      type="button"
      onClick={() => {
        if (newEdgeSource && newEdgeTarget && newEdgePartCode) {
          handleAddEdge(newEdgeSource, newEdgeTarget, newEdgePartCode);
          setNewEdgeSource('');
          setNewEdgeTarget('');
          setNewEdgePartCode('');
        }
      }}
      disabled={!newEdgeSource || !newEdgeTarget || !newEdgePartCode}
      className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
    >
      {CHAIN.addEdge}
    </button>
  </div>
)}
```

### Verificatie fase 12.3.5

```bash
npm test
npm run build
npm run lint
```

**STOP na Phase 12.3.5. Report results. Wait for GO.**

---

## 6. COMMIT & DEFINITION OF DONE

### 6.1 Files Changed Summary

| File | Phase | Action |
|------|-------|--------|
| `src/lib/ui/sandboxLabels.ts` | 12.3.1, 12.3.3 | ADD labels: BASELINE.explanation, INPUTS explanation + toggle + redistribute, RESULTS.explanation, CHAIN templates, MASS_BALANCE section |
| `src/lib/ui/__tests__/sandboxLabels.test.ts` | 12.3.1, 12.3.3 | ADD test cases for new labels |
| `src/lib/ui/chainTemplates.ts` | 12.3.4 | NEW — chain template definitions |
| `src/lib/ui/__tests__/chainTemplates.test.ts` | 12.3.4 | NEW — chain template tests + validation |
| `src/app/oil/.../sandbox/SandboxClient.tsx` | 12.3.1 | ADD inline explanation, import MASS_BALANCE |
| `src/app/oil/.../sandbox/InputOverridesForm.tsx` | 12.3.1, 12.3.2, 12.3.3 | ADD inline explanation, KG/% toggle, live mass balance indicator, auto-redistribute |
| `src/app/oil/.../sandbox/ResultsDisplay.tsx` | 12.3.1 | ADD inline explanation block |
| `src/app/oil/.../sandbox/ProcessChainEditor.tsx` | 12.3.4, 12.3.5 | ADD chain template loader, functional edge creator |

### 6.2 MUST NOT have changed

```bash
# These commands must return empty / no changes:
git diff HEAD -- src/lib/engine/
git diff HEAD -- src/lib/sandbox/
git diff HEAD -- supabase/
```

### 6.3 Verification commands (final)

```bash
npm test
npm run build
npm run lint

# Verify no remaining hardcoded English in sandbox UI:
grep -rn "Run Scenario\|Process Chain\|Yield Overrides\|Shadow Prices\|New Node\|Add Node\|Edit Node\|Validate Chain" \
  src/app/oil/batches/\[batchId\]/sandbox/ --include="*.tsx" \
  | grep -v "//\|/\*\|\*/"

# Verify boundaries respected:
git diff HEAD -- src/lib/engine/ | head -1
git diff HEAD -- src/lib/sandbox/ | head -1
git diff HEAD -- supabase/ | head -1
```

### 6.4 Commit

```bash
git add \
  src/lib/ui/sandboxLabels.ts \
  src/lib/ui/__tests__/sandboxLabels.test.ts \
  src/lib/ui/chainTemplates.ts \
  src/lib/ui/__tests__/chainTemplates.test.ts \
  src/app/oil/batches/\[batchId\]/sandbox/SandboxClient.tsx \
  src/app/oil/batches/\[batchId\]/sandbox/InputOverridesForm.tsx \
  src/app/oil/batches/\[batchId\]/sandbox/ResultsDisplay.tsx \
  src/app/oil/batches/\[batchId\]/sandbox/ProcessChainEditor.tsx

git commit -m "Sprint 12.3: UX guided editing — kg/% toggle, live mass balance, chain template, edge creator

- Add inline NL explanations per sandbox section
- Add kg/% toggle for yield editing (canonical truth = kg, % is UI-only)
- Add live mass balance indicator during yield editing
- Add auto-redistribute to back_carcass when mass balance is off
- Add chain template: Standaard Uitsnij (intern)
- Make edge creator functional with ALLOWED_TRANSITIONS filtering
- No engine/sandbox/schema changes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 7. WHAT IS NOT IN 12.3 (deferred)

| Item | Deferred to | Reason |
|------|-------------|--------|
| Drag-and-drop chain canvas | v2+ | Overkill for current user count |
| Multiple chain templates | 12.4 | Start with 1, validate with users |
| Shadow price data import | Sprint 13 | Requires schema + API work |
| Shadow price default-warning badge | 12.4 | Nice-to-have, not blocking |
| Preset effect preview | 12.4 | Nice-to-have, not blocking |
| i18n framework | Never | sandboxLabels.ts is sufficient |
