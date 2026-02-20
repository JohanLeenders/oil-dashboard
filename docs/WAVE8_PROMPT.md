# WAVE 8 — Storteboom Bestelschema Export & Artikelnummers

**Repository (Windows):** `C:\Users\leend\A leenders\Oranjehoen - Documenten\Dashboard\oil-dashboard`

---

## CONTEXT

Wave 7 delivered:
- Live cascaded availability (Putten Dag 0 + Nijkerk Dag +1)
- AvailabilityPanel, AutoDistributeModal, FullAvailabilityButton, OrderLineEditor
- Inline editing (Enter/Escape/Tab)
- PlanningSimulator with whole-bird-pull logic (hele hoenen eruit halen)
- `computeSimulatedAvailability()` pure function
- PDF import for opzetplanning
- **686 tests passing**, build clean

**Wave 8 goal:** Generate a Storteboom-exact Excel bestelschema that matches the format Oranjehoen currently sends manually. Add article numbers to products. Include simulator output per klant.

Read these reference documents first:
1. `docs/WAVE8_REFERENCE_EXCEL.md` — the EXACT Excel layout based on the real file Oranjehoen uses today
2. `docs/DESIGN_DIRECTIVE.md` — UI style guide ("Mission Control" glassmorphism, dark mode, design tokens). Apply to ALL new UI components.
3. `docs/FASE2_UI_IMPROVEMENT_PLAN.md` — broader context

---

## HARD CONSTRAINTS

- Yield percentages: **0.0–1.0** in code, display × 100 with `%` suffix in Excel
- No protected files may be modified (**8 files**):
  ```
  src/lib/engine/svaso.ts
  src/lib/engine/cherry-picker.ts
  src/lib/engine/tht.ts
  src/lib/engine/mass-balance.ts
  src/lib/engine/sankey.ts
  src/lib/engine/true-up.ts
  src/lib/actions/batches.ts
  src/lib/actions/scenarios.ts
  ```
- Do NOT modify `src/lib/engine/availability/cascading.ts`
- Do NOT modify `src/lib/engine/availability/simulator.ts`
- All numbers in kg
- Dutch UI labels, NL number format in Excel (punt = duizendtal, komma = decimaal)
- Tests must pass (vitest), build must pass
- Existing `src/lib/export/orderSchemaExport.ts` and `storteboomValidator.ts` may be **replaced entirely** — the current 2-sheet format is a placeholder

---

## PRE-FLIGHT (MANDATORY)

Run before ANY code changes:

```bash
npm run build
npm test -- --run
git diff HEAD -- src/lib/engine/svaso.ts src/lib/engine/cherry-picker.ts src/lib/engine/tht.ts src/lib/engine/mass-balance.ts src/lib/engine/sankey.ts src/lib/engine/true-up.ts src/lib/actions/batches.ts src/lib/actions/scenarios.ts
git status
```

**Stop if not clean. Baseline: 686 tests, 0 failures, 0 protected file diffs.**

---

## SPRINTLET B1 — Artikelnummers Tabel + Seed

**Doel:** Artikelnummers per product opslaan (vacuum en niet-vacuum variant).

### B1a. Migratie

Create: `supabase/migrations/20260221100000_wave8_product_article_numbers.sql`

```sql
-- Product article numbers (vacuum / niet-vacuum per locatie)
CREATE TABLE IF NOT EXISTS product_article_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  location TEXT NOT NULL CHECK (location IN ('putten', 'nijkerk')),
  article_type TEXT NOT NULL CHECK (article_type IN ('vacuum', 'niet_vacuum')),
  article_number TEXT NOT NULL,
  packaging_size TEXT,  -- e.g. "15kg", "10kg", "250kg"
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product_id, location, article_type)
);

-- RLS
ALTER TABLE product_article_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_article_numbers"
  ON product_article_numbers FOR SELECT TO anon USING (true);

CREATE POLICY "anon_write_article_numbers"
  ON product_article_numbers FOR ALL TO anon USING (true) WITH CHECK (true);
```

### B1b. Seed data

Create: `supabase/migrations/20260221100001_wave8_seed_article_numbers.sql`

Seed ALL article numbers from `docs/WAVE8_REFERENCE_EXCEL.md` section "Artikelnummers Master".

**CRITICAL:** Match article numbers to existing products in the `products` table by `description` or `internal_name`. Use subqueries like:
```sql
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '400560', '11,6kg'
FROM products p WHERE p.description ILIKE '%hele hoen%1300%1600%' OR p.internal_name ILIKE '%hele hoen%1300%'
LIMIT 1;
```

Products that exist in BOTH Putten and Nijkerk get rows for both locations.
Some products have both vacuum AND niet-vacuum article numbers (e.g., Drumvlees: 430574 vacuum, 430406 niet-vacuum).

### B1c. Types

Add to `src/types/database.ts`:

```typescript
export interface ProductArticleNumber {
  id: string;
  product_id: string;
  location: 'putten' | 'nijkerk';
  article_type: 'vacuum' | 'niet_vacuum';
  article_number: string;
  packaging_size: string | null;
  created_at: string;
}
```

### B1d. Server action

Create: `src/lib/actions/article-numbers.ts`

```typescript
export async function getArticleNumbersForProducts(
  productIds: string[]
): Promise<ProductArticleNumber[]>

export async function getArticleNumbersByLocation(
  location: 'putten' | 'nijkerk'
): Promise<(ProductArticleNumber & { product_description: string })[]>
```

**5 tests** in `src/lib/actions/__tests__/article-numbers.test.ts`:
- Returns article numbers for known product IDs
- Filters by location correctly
- Returns both vacuum and niet_vacuum variants
- Returns empty for unknown product IDs
- Includes product description in joined result

---

## SPRINTLET B2 — Klant Bezorginfo Tabel

**Doel:** Afleveradres, transporteur, bezorgdag per klant opslaan.

### B2a. Migratie

Create: `supabase/migrations/20260221100002_wave8_customer_delivery_info.sql`

```sql
CREATE TABLE IF NOT EXISTS customer_delivery_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) UNIQUE,
  delivery_address TEXT,
  transport_provider TEXT,          -- e.g. "Koops", "Eigen vervoer"
  transport_by_koops BOOLEAN DEFAULT false,
  putten_delivery_day TEXT CHECK (putten_delivery_day IN ('maandag','dinsdag','woensdag','donderdag','vrijdag')),
  nijkerk_delivery_day TEXT CHECK (nijkerk_delivery_day IN ('maandag','dinsdag','woensdag','donderdag','vrijdag')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customer_delivery_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_delivery_info"
  ON customer_delivery_info FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_delivery_info"
  ON customer_delivery_info FOR ALL TO anon USING (true) WITH CHECK (true);
```

### B2b. Types

Add to `src/types/database.ts`:

```typescript
export interface CustomerDeliveryInfo {
  id: string;
  customer_id: string;
  delivery_address: string | null;
  transport_provider: string | null;
  transport_by_koops: boolean;
  putten_delivery_day: string | null;
  nijkerk_delivery_day: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### B2c. Server actions + UI

Create: `src/lib/actions/delivery-info.ts`

```typescript
export async function getDeliveryInfoForCustomers(
  customerIds: string[]
): Promise<(CustomerDeliveryInfo & { customer_name: string })[]>

export async function upsertDeliveryInfo(
  customerId: string,
  data: Partial<Omit<CustomerDeliveryInfo, 'id' | 'customer_id' | 'created_at' | 'updated_at'>>
): Promise<CustomerDeliveryInfo>
```

Create: `src/components/oil/orders/DeliveryInfoEditor.tsx`
- Inline editable table showing delivery info per customer in the current order
- Columns: Klant | Afleveradres | Transport Koops? | Bezorgdag Putten | Bezorgdag Nijkerk
- Click to edit, Enter to save
- Auto-creates row on first edit (upsert pattern)

**3 tests** for server actions.

---

## SPRINTLET B3 — Storteboom Excel Generator (KERN)

**Doel:** Genereer een Excel dat het exacte Storteboom bestelschema format volgt.

### B3a. Replace export engine

**Replace entirely:** `src/lib/export/orderSchemaExport.ts`

New pure function:

```typescript
export interface StorteboomExportInput {
  // Algemeen
  slaughter_date: string;          // ISO date
  lot_number: string;              // e.g. "P2520310"
  mester: string;                  // e.g. "Leenders"
  ras: string;                     // e.g. "Oranjehoen"
  hok_count: number;               // e.g. 2

  // Aanvoer
  total_birds: number;
  total_live_weight_kg: number;
  avg_live_weight_kg: number;
  dead_on_arrival: number;
  dead_weight_kg: number;

  // Rendement
  griller_yield_pct: number;       // 0.0-1.0
  griller_kg: number;
  griller_count: number;
  avg_griller_weight_kg: number;
  rejected_count: number;
  rejected_weight_kg: number;

  // Hele hoenen eruit (uit simulator)
  whole_bird_pulls: {
    label: string;       // "1300-1600", "1700-1800", etc.
    count: number;
    total_kg: number;
  }[];
  remaining_birds_for_cutting: number;
  remaining_griller_kg: number;
  adjusted_avg_griller_weight: number;

  // Beschikbaarheid Putten
  putten_products: {
    product_id: string;
    description: string;
    article_number_vacuum: string | null;
    article_number_niet_vacuum: string | null;
    yield_pct: number | null;      // 0.0-1.0
    kg_from_slaughter: number;
    packaging_size: string | null;
  }[];

  // Beschikbaarheid Nijkerk
  nijkerk_products: {
    product_id: string;
    description: string;
    article_number_vacuum: string | null;
    article_number_niet_vacuum: string | null;
    yield_pct: number | null;
    kg_from_slaughter: number;
    source_product: string;        // which Putten product it cascades from
    packaging_size: string | null;
  }[];

  // Orders per klant
  customer_orders: {
    customer_id: string;
    customer_name: string;
    delivery_address: string | null;
    transport_by_koops: boolean | null;
    putten_delivery_day: string | null;
    nijkerk_delivery_day: string | null;
    putten_lines: { product_id: string; quantity_kg: number }[];
    nijkerk_lines: { product_id: string; quantity_kg: number }[];
  }[];
}

export function exportStorteboomBestelschema(
  input: StorteboomExportInput
): Uint8Array
```

**Layout rules (see `docs/WAVE8_REFERENCE_EXCEL.md` for exact positions):**

1. Sheet name = slachtdatum in `DD-MM-YYYY` format
2. **Kolom A–J: Putten** | **Kolom M–T: Nijkerk** (kolom K–L leeg)
3. Secties in volgorde: Algemeen → Aanvoer → Slachterij/Rendement → Hele hoenen eruit → Inpak delen → Beschikbaarheid → Orders productlijst → Klant-orders (met transport header)
4. **NL number format**: punt voor duizendtallen (`15.820`), komma voor decimalen (`2,65`)
5. **Percentages**: `71,0%` (niet `0.71`)
6. **REST-kolom**: `Beschikbaar kg − SOM(klant-orders kg)` per product
7. **Totaal-kolom**: horizontale som van alle klant-orders per product
8. Klant-kolommen dynamisch: zoveel kolommen als er klanten zijn met orders

**Styling (nice to have, niet kritisch):**
- Headers bold
- Sectie-headers achtergrondkleur
- Negatieve REST-waarden rood

### B3b. Aggregator server action

Create: `src/lib/actions/export.ts`

```typescript
export async function buildStorteboomExportData(
  slaughterId: string,
  simulatorInput?: SimulatedAvailability  // optioneel: als simulator is gebruikt
): Promise<StorteboomExportInput>
```

Steps:
1. Fetch slaughter calendar (birds, weight, mester_breakdown, location)
2. Fetch cascaded availability (Putten + Nijkerk products)
3. Fetch article numbers for all products (both locations)
4. Fetch all customer orders + order lines for this slaughter
5. Fetch delivery info for all customers with orders
6. If simulatorInput is provided: use its whole_bird_pulls and adjusted values
7. Assemble `StorteboomExportInput` and return

### B3c. Replace validator

**Replace entirely:** `src/lib/export/storteboomValidator.ts`

```typescript
export function validateStorteboomExport(
  input: StorteboomExportInput
): ValidationResult
```

Validation checks:
1. All Putten products have at least one article number (vacuum or niet_vacuum)
2. All Nijkerk products have at least one article number
3. `REST ≥ 0` for all products (warn if negative = tekort)
4. `SOM(klant kg) = Totaal-kolom` per product (massabalans check)
5. `SOM(alle Putten product kg) ≈ remaining_griller_kg` (within 1% tolerance)
6. All customers with orders have delivery info
7. `griller_yield_pct` between 0.60 and 0.80 (sanity check)
8. `total_birds > 0` and `avg_live_weight_kg > 0`
9. Slaughter date is valid and in the future (or today)
10. No duplicate product_ids within Putten or Nijkerk lists

### B3d. Tests

**Minimum 15 tests** in `src/lib/export/__tests__/storteboomExport.test.ts`:

1. Generates valid Excel buffer (Uint8Array with length > 0)
2. Sheet name matches DD-MM-YYYY format
3. Algemeen section has correct lot number and mester
4. Aanvoer section has correct bird count and weight
5. Griller yield displays as percentage (not decimal)
6. Hele hoenen pulls are included when present
7. Hele hoenen pulls omitted when empty
8. Putten products listed with article numbers
9. Nijkerk products listed with article numbers
10. Customer orders create correct number of columns
11. REST column = Beschikbaar − Totaal besteld
12. Totaal column = SOM(alle klant-orders)
13. Transport info included per klant
14. NL number format (punt duizendtal)
15. Empty orders → no klant-kolommen, only product list with full REST

**5 validator tests** in `src/lib/export/__tests__/storteboomValidator.test.ts`:
1. Valid input passes
2. Missing article numbers → warning
3. Negative REST → warning (tekort)
4. Mass balance mismatch → error
5. Missing delivery info → warning

---

## SPRINTLET B4 — Export UI & Simulator Integratie

### B4a. Update ExportButton

Modify: `src/components/oil/orders/ExportButton.tsx`

- Add option: "Exporteer met simulator data" (checkbox of toggle)
- When checked: include the current simulator state (whole-bird pulls, adjusted values) in the export
- When unchecked: export based on raw slaughter data without pulls
- Validate before export, show warnings
- Download as `bestelschema_[mester]_[DD-MM-YYYY].xlsx`

### B4b. Wire export into SlaughterOrdersClient

Modify: `src/app/oil/orders/[slaughterId]/SlaughterOrdersClient.tsx`

- Pass current simulator state to ExportButton
- ExportButton calls `buildStorteboomExportData(slaughterId, simulatorResult)` server action
- Then `exportStorteboomBestelschema(data)` client-side for Excel generation
- Then `validateStorteboomExport(data)` for warnings

### B4c. DeliveryInfoEditor placement

Add `DeliveryInfoEditor` component below the orders list in the orders page.
- Only shows customers that have orders for this slaughter
- Expandable/collapsible section: "Bezorginfo"

---

## SPRINTLET B5 — QA & Regression

### 1. Protected files check

```bash
git diff HEAD -- src/lib/engine/svaso.ts src/lib/engine/cherry-picker.ts src/lib/engine/tht.ts src/lib/engine/mass-balance.ts src/lib/engine/sankey.ts src/lib/engine/true-up.ts src/lib/actions/batches.ts src/lib/actions/scenarios.ts src/lib/engine/availability/cascading.ts src/lib/engine/availability/simulator.ts
```

Expected: empty.

### 2. Test + Build

```bash
npm test -- --run
npm run build
```

- Zero failures
- Build clean
- Test count should be **686 + ~25 new = 711+**

### 3. Functional verification

- [ ] Artikelnummers seeded in DB (check via Supabase)
- [ ] `getArticleNumbersByLocation('putten')` returns Putten products with art.nrs
- [ ] Export generates valid .xlsx file
- [ ] Excel has correct sheet name (DD-MM-YYYY)
- [ ] Putten section shows products + art.nrs + rendement + kg
- [ ] Nijkerk section shows products + art.nrs + kg
- [ ] Klant-orders per kolom, met REST en Totaal
- [ ] Transport info (afleveradres, Koops, bezorgdag) in header
- [ ] Hele hoenen aftrek sectie present when pulls > 0
- [ ] NL numberformat in Excel (15.820 niet 15820)
- [ ] Massabalans: SOM(product kg) ≈ griller_kg
- [ ] Validator catches missing art.nrs, negative REST, imbalance
- [ ] DeliveryInfoEditor shows and saves delivery info
- [ ] Export with simulator data includes adjusted values
- [ ] Export without simulator uses raw slaughter values

### 4. QA Report

Write `docs/qa-report-wave8.md` with:
- Test counts (base + new)
- Protected files status
- Build status
- Functional checklist (above)
- Export sample verification (open generated Excel, check sections)
- Decision: GO / NO-GO

### 5. Update SYSTEM_STATE.md

---

## GATE CRITERIA

All must pass before tagging:

```
□ Build clean
□ All tests pass (711+)
□ 10 protected files unchanged (8 original + cascading.ts + simulator.ts)
□ product_article_numbers table created and seeded
□ customer_delivery_info table created
□ Export generates Storteboom-format Excel
□ NL number format correct
□ Klant-kolommen dynamic (1 klant → 1 kolom, 5 klanten → 5 kolommen)
□ REST-kolom = beschikbaar - totaal besteld
□ Massabalans validator catches errors
□ Simulator data optionally included in export
□ DeliveryInfoEditor functional
□ QA report written
□ SYSTEM_STATE.md updated
```

---

## FINAL STEPS

```bash
git add -A
git commit -m "feat: Wave 8 — Storteboom Bestelschema Export & Artikelnummers

- product_article_numbers table with seed data from real Storteboom schema
- customer_delivery_info table + editor UI
- Full Storteboom-format Excel export (Putten + Nijkerk, 8 secties)
- Article numbers (vacuum/niet-vacuum) per product per location
- Simulator whole-bird-pull data optionally in export
- Dynamic customer columns with REST + Totaal
- NL number format, transport info, bezorgdagen
- Validator: mass balance, article numbers, REST deficit check
- XXX tests passing (686 base + ~25 new)"
git tag v0.8-wave8
```

---

## END CONDITION

The orders page now:
- Has article numbers for all products (Putten + Nijkerk)
- Generates a Storteboom-exact Excel bestelschema
- Includes simulator whole-bird-pull data in export
- Shows delivery info per klant (editable)
- Dynamic klant-kolommen with REST and Totaal
- NL number format throughout Excel
- Mass balance validated before export
- No schema changes to existing tables
- No regression on existing 686 tests

**Start with Pre-flight. Then execute sprintlets sequentially (B1 → B2 → B3 → B4 → B5).**
