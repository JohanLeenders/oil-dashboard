# OIL System State - Logboek

**Project:** Oranjehoen Intelligence Layer (OIL)
**Laatste Update:** 2026-02-27 (Wave 12 — Order Intake Module)
**Huidige Fase:** Order Intake MVP — Wave 12 Complete

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
| `slaughter_calendar` | ✅ Klaar | 20260219100000_order_module_core_tables.sql |
| `customer_orders` | ✅ Klaar | 20260219100000_order_module_core_tables.sql |
| `order_lines` | ✅ Klaar | 20260219100000_order_module_core_tables.sql |
| `order_schema_snapshots` | ✅ Klaar | 20260219100000_order_module_core_tables.sql |
| `locations` | ✅ Klaar | 20260220120000_wave6_locations.sql |
| `location_yield_profiles` | ✅ Klaar | 20260220120001_wave6_location_yield_profiles.sql |
| `product_yield_chains` | ✅ Klaar | 20260220120002_wave6_product_yield_chains.sql |
| `product_article_numbers` | ✅ Klaar + Seed | 20260221100000_wave8_product_article_numbers.sql |
| `customer_delivery_info` | ✅ Klaar | 20260221100002_wave8_customer_delivery_info.sql |
| `inbound_messages` | ✅ Klaar | 20260227100000_wave12_order_intake.sql |
| `order_intents` | ✅ Klaar | 20260227100000_wave12_order_intake.sql |

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
- 2 locaties (Putten + Nijkerk), 8 yield profiles, 6 cascade chains
- 28 artikelnummers (vacuum/niet-vacuum) uit Storteboom bestelschema

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
| availability/cascading.ts | `computeCascadedAvailability()` | ✅ Wave 6 | ✅ 23 tests, 4 mass balance invariants |
| orders/captureFullAvailability.ts | `captureFullAvailability()` | ✅ Wave 7 | ✅ remaining = available - sold (NOT forwarded) |
| orders/distributeByBirds.ts | `distributeByBirds()` | ✅ Wave 7 | ✅ Putten-only distribution |
| export/orderSchemaExport.ts | `exportStorteboomBestelschema()` | ✅ Wave 8 | ✅ Storteboom-format Excel (8 secties) |
| export/storteboomValidator.ts | `validateStorteboomExport()` | ✅ Wave 8 | ✅ Massabalans + artikelnummers + REST |
| order-intake/classifier.ts | `classifyInboundMessage()` | ✅ Wave 12 | ✅ 20 tests, deterministic rule-based |
| order-intake/formatForwardEmail.ts | `formatForwardEmail()` | ✅ Wave 12 | ✅ 17 tests, HTML + plain text |

### Server Actions (src/lib/actions/)

| Module | Functie | Status |
|--------|---------|--------|
| availability.ts | `getCascadedAvailabilityForSlaughter()` | ✅ Wave 7 |
| orders.ts | `updateOrderLine()` | ✅ Wave 7 |
| article-numbers.ts | `getArticleNumbersForProducts()` | ✅ Wave 8 |
| article-numbers.ts | `getArticleNumbersByLocation()` | ✅ Wave 8 |
| delivery-info.ts | `getDeliveryInfoForCustomers()` | ✅ Wave 8 |
| delivery-info.ts | `upsertDeliveryInfo()` | ✅ Wave 8 |
| export.ts | `buildStorteboomExportData()` | ✅ Wave 8 |
| order-intake.ts | `getOrderIntents()` | ✅ Wave 12 |
| order-intake.ts | `getOrderIntent()` | ✅ Wave 12 |
| order-intake.ts | `createInboundMessage()` | ✅ Wave 12 |
| order-intake.ts | `processInboundMessage()` | ✅ Wave 12 |
| order-intake.ts | `updateIntentParseSuggestion()` | ✅ Wave 12 |
| order-intake.ts | `rejectIntent()` | ✅ Wave 12 |
| order-intake.ts | `acceptIntent()` | ✅ Wave 12 |
| order-intake.ts | `acceptAndForwardIntent()` | ✅ Wave 12 |
| order-intake.ts | `getForwardEmail()` | ✅ Wave 12 |
| order-intake.ts | `getRecentCommunication()` | ✅ Wave 12 |
| order-intake.ts | `getIntentCounts()` | ✅ Wave 12 |

### Unit Tests
| Test File | Status | Coverage |
|-----------|--------|----------|
| svaso.test.ts | ✅ Geschreven | SVASO allocatie, prijsimpact, som=1.0 |
| cherry-picker.test.ts | ✅ Geschreven | Detectie, balance score <50 bij >30% filet |
| tht.test.ts | ✅ FIXED | **Blueprint thresholds (70/90)** |
| mass-balance.test.ts | ✅ Nieuw | Balance checks, NEEDS_REVIEW signals |
| append-only.test.ts | ✅ Nieuw | Correction patterns, no double-counting |
| cascading.test.ts | ✅ Wave 6 | 23 tests — cascade engine |
| availability.test.ts | ✅ Wave 7 | 5 tests — server action wiring |
| captureFullAvailability.test.ts | ✅ Wave 7 | 5 tests — pure function |
| distributeByBirds.test.ts | ✅ Wave 7 | 5 tests — pure function |
| article-numbers.test.ts | ✅ Wave 8 | 5 tests — server action mocks |
| delivery-info.test.ts | ✅ Wave 8 | 3 tests — upsert + fetch |
| storteboomExport.test.ts | ✅ Wave 8 | 18 tests — full Excel generation |
| storteboomValidator.test.ts | ✅ Wave 8 | 5 tests — validation checks |
| classifier.test.ts | ✅ Wave 12 | 20 tests — product+qty parsing, edge cases |
| formatForwardEmail.test.ts | ✅ Wave 12 | 17 tests — email formatting, XSS escaping |

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
- [x] `AvailabilityPanel` - Wave 7: Putten + Nijkerk beschikbaarheid (kleurcodering)
- [x] `AutoDistributeModal` - Wave 7: "Verdeel X kippen" verdeling
- [x] `FullAvailabilityButton` - Wave 7: "Volledige beschikbaarheid" capture
- [x] `OrderLineEditor` - Wave 7: Inline editing (Enter/Escape/Tab)
- [x] `DeliveryInfoEditor` - Wave 8: Collapsible bezorginfo tabel per klant
- [x] `ExportButton` - Wave 8: Storteboom bestelschema Excel export + simulator toggle
- [x] `OilCard` - Wave 9: Glassmorphism card wrapper (backdrop-blur, 12px radius)
- [x] `KpiTile` - Wave 9: Clickable KPI card with color variants + trends
- [x] `DataBadge` - Wave 9: Status badge (green/orange/red/gold/muted)
- [x] `OilModal` - Wave 9: Full-screen modal with backdrop blur + size variants
- [x] `Sidebar` - Wave 9: Collapsible nav with localStorage persistence
- [x] `DashboardKpiGrid` - Wave 9: Dashboard KPI tiles with drill-down modals
- [x] `OrderStatusTiles` - Wave 9: Order status overview on dashboard
- [x] `ExportPreflightChecklist` - Wave 9: Pre-flight validation checklist UI
- [x] `IntentTable` - Wave 12: Order intake werkbak tabel (filter tabs, confidence bar)
- [x] `IntentDetailDrawer` - Wave 12: Slide-in drawer met parse editor + forward/reject
- [x] `ManualEntryForm` - Wave 12: Handmatig bericht invoeren + classifier
- [ ] `OpportunityCostModal` - Detail modal (TODO)

### Data Fetching (Server Actions)
- [x] `getBatchList()` - Met THT + data status
- [x] `getBatchDetail()` - Uit v_effective_* views
- [x] `getBatchMassBalance()` - Voor Sankey
- [x] `getCustomersWithAnalysis()` - Met cherry-picker analyse
- [x] `getCascadedAvailabilityForSlaughter()` - Wave 7: Live availability

### Pagina's
- [x] `/oil` - Dashboard met KPIs
- [x] `/oil/batches` - Batch lijst met THT/status badges
- [x] `/oil/batches/[batchId]` - Detail met Sankey, yields, costs
- [x] `/oil/customers` - Cherry-picker analyse tabel
- [x] `/oil/planning` - Slachtkalender + import
- [x] `/oil/orders` - Order overzicht per slachtdag
- [x] `/oil/orders/[slaughterId]` - **Wave 8: Split-view + Storteboom export + bezorginfo**
- [x] `/oil/order-intake` - **Wave 12: Order Intake werkbak (tabel + drawer + manual entry)**

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
- ✅ Enhanced BatchDetailView
- ✅ Implemented MassBalanceSankey with Visx
- ✅ All components read-only, v_effective_* views only

### 2026-02-19 - Wave 1 (Order Module Schema)
- ✅ Migration: 20260219100000_order_module_core_tables.sql applied to remote DB
- ✅ Enums: slaughter_status, order_status, snapshot_type
- ✅ Tables: slaughter_calendar, customer_orders, order_lines, order_schema_snapshots
- ✅ TypeScript types added to src/types/database.ts
- ✅ Append-only enforced on order_schema_snapshots (no update trigger)
- ✅ All 120 migrations applied and verified

### 2026-02-19 - Wave 2 (Order Module Core Workflow)
- ✅ A1-S1 Planning UI
- ✅ A2-S1 Orders UI
- ✅ A2-S2 Orders Engine
- ✅ QA+Security Review
- ✅ Gates: 532 tests passed, clean build, zero lint warnings

### 2026-02-20 - Wave 6 (Location & Cascade Engine Foundation + Import)
- ✅ 3 migrations: locations, location_yield_profiles, product_yield_chains
- ✅ Seed script: 2 locaties, 8 yield profiles, 6 cascade chains
- ✅ Cascade engine: `computeCascadedAvailability()` — pure function, 23 tests
- ✅ Import restored: `importSlaughterDays`, `clearSlaughterCalendar` — 6 tests
- ✅ Tagged `v0.6-wave6`, 644 tests passing

### 2026-02-20 - Wave 7 (Order Intelligence & Live Availability)
- ✅ **A1: Availability Aggregator** — `getCascadedAvailabilityForSlaughter()` server action + 5 tests
- ✅ **A2: captureFullAvailability** — Pure function (remaining = available - sold) + 5 tests
- ✅ **A3: distributeByBirds** — Pure function (Putten-only) + 5 tests
- ✅ **A4: Live Availability UI**
  - AvailabilityPanel: Putten + Nijkerk tables with green/yellow/red color coding
  - AutoDistributeModal: "Verdeel X kippen" with editable preview + merge/replace
  - FullAvailabilityButton: "Volledige beschikbaarheid" capture with oversubscribe warnings
  - OrderLineEditor: Inline editing (click→input, Enter=save, Escape=cancel, Tab=save+next)
  - Delete confirmation dialog
  - Split-view layout (orders left, availability right, responsive stack on mobile)
  - `updateOrderLine` server action added to orders.ts
  - `availability: never[] = []` stub REMOVED
- ✅ **A5: QA Gate** — 659 tests, build clean, 8 protected files unchanged
- ✅ No schema changes, no migration changes, no RLS changes

### 2026-02-20 - Wave 8 (Storteboom Bestelschema Export & Artikelnummers)
- ✅ **B1: Artikelnummers** — `product_article_numbers` tabel + seed (28 art.nrs, 7 nieuwe producten)
- ✅ **B2: Bezorginfo** — `customer_delivery_info` tabel + `DeliveryInfoEditor` UI + upsert
- ✅ **B3: Storteboom Excel** — Volledige Storteboom-format Excel export (8 secties)
  - Putten + Nijkerk halves, artikelnummers, NL numberformat
  - Dynamic klant-kolommen met REST + Totaal
  - Transport info, hele hoenen aftrek, massabalans validator
- ✅ **B4: Export UI** — `ExportButton` met simulator toggle, async `buildStorteboomExportData()`
  - `DeliveryInfoEditor` in SlaughterOrdersClient, mester prop doorgesluisd
- ✅ **B5: QA Gate** — 698 tests, build clean, 10 protected files unchanged
- ✅ Backward-compatible legacy wrappers voor bestaande integration tests

### 2026-02-20 - Wave 9 (Mission Control Design System & UX Polish)
- ✅ **C1: Design Tokens & Global Styles** — CSS custom properties (colors, typography, shape)
  - Background #09090b, glassmorphism `.oil-card`, 12px radius, 1px hairlines
  - Font loading: Inter (body), JetBrains Mono (data), Playfair Display (brand)
  - Dark mode as permanent only mode (no toggle)
- ✅ **C2: OilCard, KpiTile, DataBadge** — Reusable UI components
  - OilCard: glassmorphism wrapper (backdrop-blur, padding variants)
  - KpiTile: clickable KPI card (color variants, trends, onClick)
  - DataBadge: status badge (green/orange/red/gold/muted)
- ✅ **C3: Sidebar Navigation** — Progressive disclosure sidebar
  - 3 collapsible groups (Operationeel, Data, Beheer)
  - localStorage persistence for collapse state
  - Responsive (collapses on mobile)
  - Active route orange highlight
- ✅ **C4: Order Status Visualization** — Status badges + calendar progress bars
  - DataBadge integration for order statuses (concept/ingediend/bevestigd/geannuleerd)
  - Availability progress bars on slaughter calendar
- ✅ **C5: Intelligence Panel (UX-3)** — Putten/Nijkerk cascade flow
  - Orange flow connector between locations
  - KPI tiles at top with monospace values
- ✅ **C6: Simulator Impact Zone (UX-2)** — Real-time delta feedback
  - Product rows flash red/green on >10% change
  - Impact summary banner with delta breakdown
  - Delta tracking via useRef + useEffect
- ✅ **C7: Export Launch Sequence (UX-4)** — Pre-flight validation
  - ExportPreflightChecklist with green/red/orange indicators
  - Export button disabled until error checks pass, orange glow when ready
  - Failed checks are clickable links (scroll to section)
- ✅ **C8: Drill-down Modals & Component Migration (UX-5)**
  - OilModal: full-screen overlay, backdrop blur 20px, 4 size variants
  - DashboardKpiGrid: 4 clickable KPI tiles → modal drill-down
  - AvailabilityPanel + PlanningSimulator: full OIL token migration
  - Heading hierarchy: brand serif for titles, Inter for body
- ✅ **C9: QA Gate** — 698 tests, build clean, 10 protected files unchanged
  - Visual verification: 30+ checklist items passed
  - Decision: GO

### 2026-02-27 - Wave 12 (Order Intake Module)
- ✅ **Slice 1: Database + Types**
  - Migration: `20260227100000_wave12_order_intake.sql` — `inbound_messages` + `order_intents` tabellen
  - IN/OUT domain separation: OUT = communicatie-log, IN = operationele werkbak
  - RLS policies voor `authenticated`, `anon`, `service_role`
  - Types: `InboundMessage`, `OrderIntent`, `OrderIntentWithCustomer`, `ClassificationResult`, `MetaWebhookPayload`
  - NO `processed` boolean field (domain separation = klassificatie bepaalt IN/OUT)
- ✅ **Slice 2: WhatsApp Webhook Transport**
  - `GET /api/whatsapp/webhook` — Meta verify token handshake
  - `POST /api/whatsapp/webhook` — Receives Meta Cloud API payloads, logs to `inbound_messages`
  - Phone normalization: Dutch 06→+316, 0031→+31
  - Customer matching via `customer_delivery_info.whatsapp_number`
- ✅ **Slice 3: Classifier Engine + Tests**
  - `classifyInboundMessage()` — deterministic, rule-based, no AI
  - Product keyword whitelist (55 keywords incl. plurals)
  - Qty+UOM regex + bare number+product fallback
  - Longest-match-first with substring deduplication
  - Confidence: 0.9 (exact), 0.7 (bare), 0.6 (fuzzy)
  - 20 unit tests including edge cases
  - Server actions: `processInboundMessage`, `getOrderIntents`, etc.
  - Hooked into webhook: classifier runs on every inbound WhatsApp message
- ✅ **Slice 4: Order Intake UI**
  - Route: `/oil/order-intake` — Server Component + Client shell
  - `IntentTable`: filter tabs (Alle/Nieuw/Review/Geaccepteerd/Doorgestuurd/Afgewezen), confidence bar, channel icons
  - `IntentDetailDrawer`: slide-in panel, editable parse suggestion (product/qty/uom), accept/reject
  - `ManualEntryForm`: channel selector, sender field, text area → classifier pipeline
  - Sidebar updated with "Order Intake" nav item
- ✅ **Slice 5: Forwarding with Provider Fallback**
  - `formatForwardEmail()` — HTML + plain text email formatting (17 tests, XSS-safe)
  - `acceptAndForwardIntent()` — provider-adaptive:
    - If `ORDER_FORWARD_PA_URL` set → POST to PA webhook, status = 'forwarded'
    - If not → status stays 'accepted', show manual fallback (copy subject/body + mailto link)
  - Only sets 'forwarded' when actual send succeeds
  - Manual fallback in drawer: copy buttons + "Open in email" mailto link
- ✅ **QA Gate** — 844 tests (46 files), build clean, lint clean

---

## 8. Agent Skills

| Skill | Pad | Domein | Status |
|-------|-----|--------|--------|
| `poultry-cascade` | `skills/poultry-cascade/` | Putten-Nijkerk massabalans & availability berekeningen | ✅ Actief |

### poultry-cascade

**Authoritative expert** voor alle availability- en massabalansberekeningen.

Bevat:
- `skill.md` — De 4 Wetten van de Massabalans, Data Contract (yields 0.0–100.0), Boundary Rules, referentie yields (JA757 + Storteboom)
- `tools/validate-balance.ts` — Valideert input-JSON tegen de 4 wetten → PASS/FAIL rapport
- `tools/project-yield.ts` — Berekent verwachte output in kg op basis van slachtaantal en yield chains

**Constraint:** Alle tools zijn pure functions — geen database, geen side effects, alleen wiskunde.

---

## 9. Bekende Issues / Aandachtspunten

1. **Batch koppeling heuristiek:** `batch_ref_source` in sales is MVP-heuristiek (TODO: robuuste matching)
2. **Exact Online integratie:** Nog niet geïmplementeerd (Phase 3)
3. **Visx dependencies:** Controleer compatibiliteit met React 19
4. **Append-only triggers:** Commented out voor development, uncomment in production
5. **Meta Cloud API setup:** Vereist handmatige setup (WABA account, webhook URL, access token). Zie plan B stap 1.
6. **Order Intake forwarding:** `ORDER_FORWARD_PA_URL` env var niet geconfigureerd → manual fallback actief. Configureer PA webhook voor automatisch doorsturen.
7. **Customer matching WhatsApp:** Afhankelijk van `customer_delivery_info.whatsapp_number`. Niet-gematchte nummers tonen als "Onbekende afzender".

---

## 10. Migratie Bestanden

| File | Beschrijving |
|------|-------------|
| `001_initial_schema.sql` | Core tables, enums, v_batch_mass_balance, calc_tht_status |
| `002_seed_products.sql` | 25 SKU's, commercial norms, market benchmarks |
| `003_seed_demo_data.sql` | Demo batches en klanten |
| `004_sku_provenance.sql` | technical_definitions table + provenance records |
| `005_effective_views.sql` | v_effective_* views, append-only protection |
| `20260212210000_table_sandbox_scenarios.sql` | Sprint 11A sandbox scenarios table |
| `20260219100000_order_module_core_tables.sql` | Wave 1: slaughter_calendar, customer_orders, order_lines, order_schema_snapshots + enums |
| `20260220120000_wave6_locations.sql` | Wave 6: locations table + RLS |
| `20260220120001_wave6_location_yield_profiles.sql` | Wave 6: yield profiles + RLS |
| `20260220120002_wave6_product_yield_chains.sql` | Wave 6: cascade chains + RLS |
| `20260221100000_wave8_product_article_numbers.sql` | Wave 8: artikelnummers tabel + RLS |
| `20260221100001_wave8_seed_article_numbers.sql` | Wave 8: seed 28 art.nrs + 7 nieuwe producten |
| `20260221100002_wave8_customer_delivery_info.sql` | Wave 8: bezorginfo tabel + RLS |
| `20260227100000_wave12_order_intake.sql` | Wave 12: inbound_messages + order_intents + RLS |

---

*Dit document wordt automatisch bijgewerkt aan het einde van elke sessie.*
