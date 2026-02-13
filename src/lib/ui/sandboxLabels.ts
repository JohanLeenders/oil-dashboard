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
  sandboxButton: 'Sandbox',
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
  kFactorEfficiency: 'k-factor (efficiëntie)',
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
  massBalanceViolated: 'Massabalans geschonden — totaalgewicht klopt niet',
  allocationFailed: 'Kostenverdeling klopt niet — neem contact op met beheerder',
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
