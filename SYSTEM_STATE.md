# OIL System State - Logboek

**Project:** Oranjehoen Intelligence Layer (OIL)
**Laatste Update:** 2026-01-24 (Verification Patch)
**Huidige Fase:** Fase 2 - UI & Visualisatie

---

## 1. Database Status

### Schema (PostgreSQL/Supabase)
| Tabel | Status | Migratie |
|-------|--------|----------|
| `production_batches` | ✅ Klaar | 001_initial_schema.sql |
| `batch_yields` | ✅ Klaar | 001_initial_schema.sql |
| `products` | ✅ Klaar + Seed | 002_seed_products.sql |
| `sales_transactions` | ✅ Klaar | 001_initial_schema.sql |
| `customers` | ✅ Klaar | 001_initial_schema.sql |
| `batch_costs` | ✅ Klaar | 001_initial_schema.sql |
| `market_benchmarks` | ✅ Klaar + Seed | 002_seed_products.sql |
| `commercial_norms` | ✅ Klaar + Seed | 002_seed_products.sql |
| `commercial_signals` | ✅ Klaar | 001_initial_schema.sql |
| `computed_snapshots` | ✅ Klaar | 001_initial_schema.sql |
| `technical_definitions` | ✅ Klaar | 004_sku_provenance.sql |

### Views
| View | Status | Beschrijving |
|------|--------|-------------|
| `v_batch_mass_balance` | ✅ Updated | Sankey-ready massabalans data (uses effective yields) |
| `v_effective_batch_yields` | ✅ Nieuw | Resolves corrections to show effective values |
| `v_effective_batch_costs` | ✅ Nieuw | Resolves adjustments to show effective costs |
| `v_effective_batch_totals` | ✅ Nieuw | Aggregated batch totals with data quality flags |

### Seed Data
- 25 SKU's met Storteboom PLU mapping
- 2 demo batches (P2520210, P2535609)
- 3 klanten (1 balanced, 1 cherry-picker, 1 dark-meat focused)
- Marktprijzen en commercial norms

---

## 2. Math Engine Status

### Functies (src/lib/engine/)

| Module | Functie | Status | Spec Validatie |
|--------|---------|--------|----------------|
| svaso.ts | `calculateSvasoAllocation()` | ✅ Klaar | ✅ Som factoren = 1.0 |
| svaso.ts | `validateSvasoResult()` | ✅ Klaar | ✅ |
| svaso.ts | `simulatePriceImpact()` | ✅ Klaar | ✅ Hogere prijs → hogere cost |
| cherry-picker.ts | `analyzeCherryPicker()` | ✅ Klaar | ✅ Score < 50 bij >30% filet |
| cherry-picker.ts | `analyzeAllCustomers()` | ✅ Klaar | ✅ |
| tht.ts | `calculateThtStatus()` | ✅ FIXED | ✅ **70%/90% Blueprint thresholds** |
| true-up.ts | `calculateTrueUp()` | ✅ Klaar | ✅ Delta yield berekening |
| sankey.ts | `generateMassBalanceSankey()` | ✅ Klaar | ✅ Visx-compatible |
| mass-balance.ts | `validateMassBalance()` | ✅ Nieuw | ✅ Tolerance checks + NEEDS_REVIEW |

### Unit Tests
| Test File | Status | Coverage |
|-----------|--------|----------|
| svaso.test.ts | ✅ Geschreven | SVASO allocatie, prijsimpact, som=1.0 |
| cherry-picker.test.ts | ✅ Geschreven | Detectie, balance score <50 bij >30% filet |
| tht.test.ts | ✅ FIXED | **Blueprint thresholds (70/90)** |
| mass-balance.test.ts | ✅ Nieuw | Balance checks, NEEDS_REVIEW signals |
| append-only.test.ts | ✅ Nieuw | Correction patterns, no double-counting |

---

## 3. DEFINITIEVE THRESHOLDS (Blueprint Spec)

### THT Kleuren ✅ VERIFIED
```
- Groen:  < 70% verstreken
- Oranje: 70-90% verstreken
- Rood:   > 90% verstreken
```
**Files updated:** tht.ts, tht.test.ts, 001_initial_schema.sql (calc_tht_status)

### Cherry-Picker Detectie
- Threshold: Omzet > €10.000
- Alert: Filet afname > 30% (anatomisch ~24%)
- Balance Score: 0-100 (hoger = beter)

### SVASO Allocatie
```
1. Totale Marktwaarde = Σ(Kg × Marktprijs)
2. Allocatie Factor = Marktwaarde_deel / Totale_Marktwaarde
3. Toegewezen Kosten = Totale_Kosten × Allocatie_Factor
```
**Validatie:** Som allocatie factoren MOET 1.0 zijn (tolerance: 0.0001).

---

## 4. SKU/Product Provenance

### Data Sources
| Field | Source | Status |
|-------|--------|--------|
| `storteboom_plu` | Storteboom invoices/pakbonnen | ✅ VERIFIED |
| `sku_code` (OH-*) | Generated internal codes | ✅ GENERATED |
| `exact_itemcode` | Exact Online | ❌ TODO Phase 3 |

### Provenance Table
De `technical_definitions` tabel (004_sku_provenance.sql) bevat:
- SKU mapping provenance records
- Yield target sources (Hubbard JA757)
- Threshold definitions met source documents

**Belangrijk:** Waar codes NIET gevalideerd zijn, staat `status: "TODO"` in de JSONB data.

---

## 5. Append-Only Correctheid

### Pattern
```
Origineel Record → is_correction: false, corrects_yield_id: null
Correctie Record → is_correction: true, corrects_yield_id: <original_id>
```

### Effective Views
Views resolven corrections automatisch:
- `v_effective_batch_yields`: Toont alleen meest recente/gecorrigeerde yields
- `v_effective_batch_costs`: Filtert superseded costs
- `v_batch_mass_balance`: Gebruikt effective yields (geen double-counting)

### Protection (Production)
In 005_effective_views.sql staan triggers (commented) om updates/deletes te blokkeren:
- `prevent_yield_update()` - Blokkeert wijziging core fields
- `prevent_cost_update()` - Idem voor costs

---

## 6. Fase 2 - UI Status

### UI Componenten
- [x] `MassBalanceSankey` - Flow diagram (simplified, Visx ready)
- [x] `BatchDetailView` - Pagina met yields, costs, THT
- [x] `CherryPickerTable` - Gesorteerde klantentabel
- [x] `ThtThermometer` - Visuele THT status balk (70/90)
- [x] `StatusBadge` - THT + Data status badges
- [ ] `OpportunityCostModal` - Detail modal (TODO)

### Data Fetching (Server Actions)
- [x] `getBatchList()` - Met THT + data status
- [x] `getBatchDetail()` - Uit v_effective_* views
- [x] `getBatchMassBalance()` - Voor Sankey
- [x] `getCustomersWithAnalysis()` - Met cherry-picker analyse

### Pagina's
- [x] `/oil` - Dashboard met KPIs
- [x] `/oil/batches` - Batch lijst met THT/status badges
- [x] `/oil/batches/[batchId]` - Detail met Sankey, yields, costs
- [x] `/oil/customers` - Cherry-picker analyse tabel

---

## 7. Sessie Log

### 2026-01-24 - Sessie 1 (Fase 1)
- ✅ Database schema ontworpen en gemigreerd
- ✅ Math engine functies geïmplementeerd
- ✅ Unit tests geschreven
- ✅ Sankey data generator voorbereid

### 2026-01-24 - Sessie 2 (Verification Patch)
- ✅ THT thresholds gecorrigeerd naar Blueprint (70/90)
- ✅ SKU provenance gedocumenteerd (004_sku_provenance.sql)
- ✅ Effective views toegevoegd (005_effective_views.sql)
- ✅ Mass balance validation engine toegevoegd
- ✅ Append-only tests toegevoegd
- ✅ SYSTEM_STATE.md bijgewerkt

### 2026-01-24 - Sessie 3 (Phase 2 UI)
- ✅ OIL layout met navigatie
- ✅ Dashboard pagina met KPIs
- ✅ Batches lijst pagina
- ✅ Batch detail pagina met Sankey + THT thermometer
- ✅ Customers/Cherry-picker analyse pagina
- ✅ Server Actions (read-only, v_effective_* views)
- ✅ Regressie-checks per component gedocumenteerd

### 2026-01-24 - Sessie 4 (Phase 2 Step 1 Execution)
- ✅ Verified /oil/batches implementation
- ✅ Fixed cherry-picker.test.ts (revenue threshold)
- ✅ Fixed mass-balance.test.ts (imbalance calculation)
- ✅ Fixed TypeScript errors (nullable types, Link href)
- ✅ Added ESLint config (eslint.config.mjs)
- ✅ npm test: 53 tests PASSED
- ✅ npm run build: SUCCESS
- ✅ npm run lint: PASSED (0 errors)

### 2026-01-24 - Sessie 5 (Phase 2 Step 2 Execution)
- ✅ PRE-STEP: Removed `href as any` casts (disabled typedRoutes in next.config.ts)
- ✅ PRE-STEP: Updated npm run lint to use ESLint directly
- ✅ Enhanced BatchDetailView:
  - Added MassBalanceStatusLine (OK / NEEDS_REVIEW)
  - Added ValidationDetailsBlock (expandable when NEEDS_REVIEW)
  - Added TrueUpDeltaSection (yield deviations from target)
- ✅ Implemented MassBalanceSankey with Visx:
  - Full Sankey diagram with @visx/sankey
  - Hover tooltips showing kg and percentage
  - Color-coded nodes (premium=blue, product=green, loss=gray)
  - No writes, no edits, no auto-corrections
- ✅ All components read-only, v_effective_* views only

---

## 8. Bekende Issues / Aandachtspunten

1. **Batch koppeling heuristiek:** `batch_ref_source` in sales is MVP-heuristiek (TODO: robuuste matching)
2. **Exact Online integratie:** Nog niet geïmplementeerd (Phase 3)
3. **Visx dependencies:** Controleer compatibiliteit met React 19
4. **Append-only triggers:** Commented out voor development, uncomment in production

---

## 9. Migratie Bestanden

| File | Beschrijving |
|------|-------------|
| `001_initial_schema.sql` | Core tables, enums, v_batch_mass_balance, calc_tht_status |
| `002_seed_products.sql` | 25 SKU's, commercial norms, market benchmarks |
| `003_seed_demo_data.sql` | Demo batches en klanten |
| `004_sku_provenance.sql` | technical_definitions table + provenance records |
| `005_effective_views.sql` | v_effective_* views, append-only protection |

---

*Dit document wordt automatisch bijgewerkt aan het einde van elke sessie.*
