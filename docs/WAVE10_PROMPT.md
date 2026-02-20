# WAVE 10 — UX Fixes, Order Flow & Data Correctness

**Repository (Windows):** `C:\Users\leend\A leenders\Oranjehoen - Documenten\Dashboard\oil-dashboard`

---

## CONTEXT

Wave 8 delivered articles + export. Wave 9 delivered design tokens + sidebar + glassmorphism styling.
The user has tested the full application and provided detailed feedback. This wave addresses **all user-reported issues** from the walkthrough. These are a mix of data correctness, UX flow, and visual polish problems.

Read these reference documents first:
1. `docs/DESIGN_DIRECTIVE.md` — Visual style guide (Mission Control theme)
2. `docs/WAVE8_REFERENCE_EXCEL.md` — The real Storteboom bestelschema format with all product names
3. `SYSTEM_STATE.md` — Current system status

**CRITICAL RULE:** Do NOT break existing tests. Run `npx vitest run` after every sprintlet. Run `npx next build` at the end.

**Protected files** (do NOT modify logic, only styling classes):
- `src/lib/engine/` — Pure computation engine (cascading, yields)
- `supabase/migrations/` — Do NOT modify existing migrations, only add new ones

---

## D1: Putten Productenlijst — Borstkap & Organen Zichtbaar

### Problem
The orders page (`/oil/orders/[slaughterId]`) shows too few Putten products:
- **Borstkap ontbreekt** — `OH-BORST-KAL-001` (Borstkappen met vel) IS in `location_yield_profiles` at 36.75% yield but may not show in the AvailabilityPanel
- **Organen (maagjes, levertjes, hartjes, nekken) staan los van Putten** — They ARE in the database as Putten primary products but are hidden in a collapsed "Organen & rest" section. The user wants them visible by default, or at least clearly labeled as Putten products.

### Investigation Results
The availability engine (`src/lib/actions/availability.ts`) correctly fetches from `location_yield_profiles` for Putten. The `AvailabilityPanel.tsx` (lines 227-340) splits products into "main" vs "organs" using keyword matching:
```typescript
const ORGAN_KEYWORDS = ['lever', 'hart', 'maag', 'nek', 'hals', 'vel', 'karkas'];
```

### Fix Required
1. **Verify borstkap shows**: Query `location_yield_profiles` joined with products where location = putten. Confirm `OH-BORST-KAL-001` has a row. If missing, create a new migration to add it.
2. **Show organen by default**: In `AvailabilityPanel.tsx`, change the organen section from collapsed-by-default to expanded-by-default. Or better: show ALL Putten products in one table (main + organs together), with a subtle separator row for organs. They're all Putten products and should be visually associated with that location.
3. **Confirm product count**: After fix, Putten should show AT LEAST these products:
   - Borstkappen met vel (36.75%)
   - Dij anatomisch (14.68%)
   - Drumstick 10kg bulk (16.56%)
   - Vleugels z/tip (9.57%)
   - Nekken (1.97%)
   - Levertjes (1.74%)
   - Maagjes (1.07%)
   - Hartjes (0.19%)

### Files to modify
- `src/components/oil/orders/AvailabilityPanel.tsx` — Show organs inline, not collapsed
- Possibly: new migration if borstkap is missing from yield profiles

### Tests
- Existing availability tests must still pass
- Visually verify: Putten section shows 8+ products

---

## D2: Productnamen Onderscheidend — Storteboom Naming

### Problem
There are multiple kipfilet variants that all show as "Kipfilet" in dropdowns and tables. The user cannot tell them apart. The Storteboom bestelschema Excel uses specific names that differentiate products.

### Current State
The `getProductsForSelect()` function in `src/lib/actions/orders.ts` uses `description` as the display name. Wave 6 migration set generic names:
- `OH-FILET-BULK-001` → "Kipfilet"
- `OH-FILET-VAC-001` → "Kipfilet vacuum"
- `OH-FILET-VAC-002` → "Kipfilet vacuum (2)"
- `OH-FILET-HALF-001` → "Filet half z/vel m/haas"

But the products table also has:
- `internal_name` — More distinctive (e.g., "Borstfilet Vacuüm", "Borstfilet Bulk")
- `storteboom_plu` — Article number (e.g., "540457")
- `packaging_type` — "Vacuüm", "Bulk", etc.
- `standard_weight_kg` — Package size

### Fix Required
1. **Create a new migration** that updates product descriptions to be distinctive using the Storteboom bestelschema naming. Use the reference at `docs/WAVE8_REFERENCE_EXCEL.md` section "Artikelnummers Master". Examples:
   - "Kipfilet" → "Kipfilet bulk 15kg"
   - "Kipfilet vacuum" → "Kipfilet z/vel z/haas vacuum 15kg"
   - "Kipfilet vacuum (2)" → "Kipfilet z/vel z/haas 195-220g"
   - "Filet half z/vel m/haas" → "Filet half z/vel m/haas 15kg"
   - "Haasjes vacuum" → "Haasjes vacuum"
   - "Dijvlees bulk" → "Dijvlees 15kg"
   - "Drumvlees" → "Drumvlees 15kg"

2. **Show article number in UI** — In product dropdowns and order line display, show the Storteboom PLU code next to the name: `[540327] Kipfilet z/vel z/haas 15kg`

3. **Update getProductsForSelect()** — Include `storteboom_plu` in the select query and format display as: `[PLU] description`

### Files to modify
- New migration: `supabase/migrations/2026MMDD_wave10_distinctive_product_names.sql`
- `src/lib/actions/orders.ts` — `getProductsForSelect()` to include PLU
- `src/components/oil/orders/OrderLineEditor.tsx` — Show PLU in line display
- `src/components/oil/orders/AvailabilityPanel.tsx` — Show PLU codes

### Tests
- No existing tests should break (names are display-only)
- Build must pass

---

## D3: Nieuwe Order Flow — Direct Producten Invullen

### Problem
Current flow: Click "Nieuwe order" → only pick customer → creates empty order → must click order to add lines separately. The user wants to immediately fill in 5-10 product lines when creating an order.

Also: existing order lines are not visible in the OrderList — you have to click into an order to see what's been ordered.

### Fix Required

#### A) Order Creation with Inline Lines
Redesign `OrderEntryForm.tsx` to include:
1. Customer selector (existing)
2. **Product line section** — A dynamic list of rows where each row has:
   - Product dropdown (showing all available products with PLU codes from D2)
   - Quantity (kg) input
   - Remove row button (×)
3. "Nog een regel toevoegen" button to add more rows (start with 3 empty rows)
4. Submit creates the order AND all lines in one server action call

Update the server action `createCustomerOrder` or create a new `createOrderWithLines` action that:
- INSERT into `customer_orders`
- INSERT all lines into `order_lines`
- Returns the complete order

#### B) Order Lines Visible in List
Update `OrderList.tsx` to show order lines inline:
- Under each order row, show a mini-table or comma-separated summary of product lines
- Format: `Kipfilet 500kg, Haasjes 200kg, Dijvlees 150kg`
- Or at minimum show the product names in a subtitle under the customer name

### Files to modify
- `src/components/oil/orders/OrderEntryForm.tsx` — Major rewrite with inline product lines
- `src/components/oil/orders/OrderList.tsx` — Show order line summary
- `src/lib/actions/orders.ts` — New `createOrderWithLines` server action
- `src/app/oil/orders/[slaughterId]/SlaughterOrdersClient.tsx` — Wire up new flow

### Tests
- Add test for `createOrderWithLines` action
- Existing order tests must still pass

---

## D4: Massabalans Validatie — 25% Benut ≠ OK

### Problem
The export pre-flight checklist shows "Massabalans OK" even when only 25% of griller weight is allocated to orders. That's clearly not correct — if 75% of the chicken is unaccounted for, the mass balance is NOT okay.

### Current State
File: `src/lib/export/storteboomValidator.ts`
The validator checks for negative stock and duplicate products, but likely doesn't check for LOW utilization.

### Fix Required
1. **Read the validator** and understand current checks
2. **Add utilization warning**: If total ordered kg < 80% of total available kg, show a warning:
   - `< 50%` → error: "Massabalans: slechts X% benut (minimaal 50% vereist)"
   - `50-80%` → warning: "Massabalans: X% benut — controleer of alle orders zijn ingevoerd"
   - `> 80%` → OK: "Massabalans OK (X% benut)"
3. **Update ExportButton.tsx** pre-flight checks to reflect the new severity levels

### Files to modify
- `src/lib/export/storteboomValidator.ts`
- `src/components/oil/orders/ExportButton.tsx` (if needed)

### Tests
- Add tests for low-utilization scenarios in validator tests
- Existing validation tests must still pass

---

## D5: UI Kleuren — Minder Agressief, Betere Hiërarchie

### Problem
The user finds:
- Input fields at kostprijs page have aggressive colors
- Marges and waterfall pages have too bright/aggressive colors
- Klanten page has aggressive light colors
- At kostprijs, the colors don't guide the eye toward actionable areas (like "details" links)
- Kostprijsberekeningen look like one continuous block instead of distinct cards

### Design Directive Reference
From `docs/DESIGN_DIRECTIVE.md`:
- Background: `#09090b`
- Card: `rgba(24,24,27,0.7)` with glassmorphism
- Borders: `rgba(255,255,255,0.1)` — subtle hairlines
- Text: white for primary, `#A1A1AA` for muted, `#71717A` for dim
- Orange accent `#F67E20` ONLY for primary CTA and critical data

### Fix Required
1. **Kostprijs pages** (`/oil/kostprijs`, `/oil/kostprijs/[id]`):
   - Replace bright backgrounds with `oil-card` glassmorphism cards
   - Add clear card separation between kostprijsberekeningen (gap + distinct cards)
   - Make "Details →" links stand out with orange accent color
   - Input fields: dark background (`var(--color-bg-elevated)`), subtle border, white text

2. **Marges page** (`/oil/margins`):
   - Tone down aggressive colors
   - Use `oil-card` for containers
   - Data colors should use the design token palette (gold, green, red) sparingly

3. **Waterfall page** (`/oil/cost-waterfall`):
   - Apply dark theme consistently
   - Charts should use the design token colors

4. **Klanten page** (`/oil/customers`):
   - Replace aggressive light colors with dark theme `oil-card` cards
   - Customer cards should have subtle borders, dark backgrounds

5. **General rule**: All pages must follow the Design Directive. No `bg-white`, `bg-gray-50`, `text-gray-900` — use the OIL design tokens exclusively.

### Files to modify
Search for all files under `src/app/oil/` and `src/components/oil/` that still use light-mode Tailwind classes (`bg-white`, `bg-gray-50`, `bg-gray-100`, `text-gray-900`, `border-gray-200`, etc.) and replace with design token equivalents.

Key mapping:
- `bg-white` / `bg-gray-50` → `oil-card` class or `bg-oil-card`
- `bg-gray-100` / `bg-gray-200` → `bg-oil-elevated`
- `text-gray-900` → `text-white` or `text-oil-text`
- `text-gray-600` / `text-gray-500` → `text-oil-muted`
- `text-gray-400` → `text-oil-dim`
- `border-gray-200` / `border-gray-300` → `border-oil-border`
- `hover:bg-gray-50` → `hover:bg-oil-elevated`
- `dark:` prefixes → Remove entirely (we're always dark)

### Tests
- Build must pass
- No functional changes, only CSS classes

---

## D6: Verwerkingstab Verduidelijken

### Problem
The user doesn't understand the purpose of the "Verwerking" tab.

### Fix Required
1. **Read** `src/app/oil/processing/page.tsx` to understand what it currently shows
2. **Add a clear heading and description** that explains the purpose:
   - "Verwerking" = Processing recipes — how products are transformed from primary cuts to secondary products
   - It shows yield chains: which parent product produces which child products and at what yield percentage
3. **If the page is empty or confusing**, add an explanation card at the top:
   ```
   Verwerkingsrecepten
   Hier zie je hoe producten worden verwerkt van primaire snijdelen (Putten) naar secundaire producten (Nijkerk).
   Elk recept definieert het rendement: hoeveel kg uitgangsproduct wordt hoeveel kg eindproduct.
   ```

### Files to modify
- `src/app/oil/processing/page.tsx`
- Possibly `src/components/oil/processing/` components

### Tests
- Build must pass

---

## D7: QA & Regression

### Checklist
1. `npx vitest run` — ALL tests pass
2. `npx next build` — Clean build, no errors
3. Manual check these pages work:
   - `/oil` — Dashboard
   - `/oil/planning` — Planning (PDF import werkt, tabel toont zonder error)
   - `/oil/orders` — Orders overzicht
   - `/oil/orders/[id]` — Order detail (Putten shows 8+ products, organen visible)
   - `/oil/kostprijs` — Kostprijs (dark theme, cards separated)
   - `/oil/customers` — Klanten (dark theme, no aggressive colors)
   - `/oil/processing` — Verwerking (clear explanation)
   - `/oil/exports` — Exports
4. Create `docs/qa-report-wave10.md` with findings

### Protected files (verify unchanged)
- `src/lib/engine/availability/cascading.ts` — Logic intact
- `src/lib/engine/availability/simulator.ts` — Logic intact
- `src/lib/export/orderSchemaExport.ts` — Export logic intact

---

## SPRINTLET ORDER

Execute in this order:
1. **D1** — Putten products fix (data correctness, most impactful)
2. **D2** — Product naming (prerequisite for D3)
3. **D3** — Order flow redesign (biggest UX improvement)
4. **D4** — Massabalans validation fix
5. **D5** — UI colors (apply dark theme everywhere)
6. **D6** — Verwerking tab explanation
7. **D7** — QA & regression

After each sprintlet: `npx vitest run` must pass.
After D7: `npx next build` must pass cleanly.
