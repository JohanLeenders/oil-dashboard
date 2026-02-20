# Wave 7 QA Report

**Datum:** 2026-02-20
**Wave:** 7 — Order Intelligence & Live Availability

---

## Test Results
- Base tests: 644 PASS
- New availability aggregator tests: 5 PASS
- New captureFullAvailability tests: 5 PASS
- New distributeByBirds tests: 5 PASS
- Total: **659 PASS, 0 FAIL**

## Protected Files
8 files, diff = 0 lines:
- `src/lib/engine/svaso.ts` — unchanged
- `src/lib/engine/cherry-picker.ts` — unchanged
- `src/lib/engine/tht.ts` — unchanged
- `src/lib/engine/mass-balance.ts` — unchanged
- `src/lib/engine/sankey.ts` — unchanged
- `src/lib/engine/true-up.ts` — unchanged
- `src/lib/actions/batches.ts` — unchanged
- `src/lib/actions/scenarios.ts` — unchanged

## Additional Protected Files
- `src/lib/engine/availability/cascading.ts` — unchanged (DO NOT MODIFY)
- `src/lib/engine/availability.ts` — unchanged (old JA757 engine)

## Build
`npm run build`: **CLEAN** — 0 errors, 0 warnings

## Engine Functions (A1-A3)

### A1: Availability Aggregator
- `src/lib/actions/availability.ts` — server action wiring DB → pure engine
- Fetches slaughter, locations, yield profiles, yield chains, orders
- Classifies orders into primary/secondary buckets
- Calls `computeCascadedAvailability()` — pure engine unchanged
- 5 unit tests in `src/lib/actions/__tests__/availability.test.ts`

### A2: captureFullAvailability
- `src/lib/engine/orders/captureFullAvailability.ts` — pure function
- Definition: `remaining_primary = primary_available_kg - sold_primary_kg` (NOT forwarded_kg)
- Secondary: uses `net_available_kg > 0`
- Rounds to 2 decimal places
- 5 unit tests

### A3: distributeByBirds
- `src/lib/engine/orders/distributeByBirds.ts` — pure function
- Putten-only distribution (no Nijkerk child lines)
- `griller_kg = bird_count × avg_weight_kg × griller_yield_pct`
- Per profile: `kg = griller_kg × yield_percentage`
- 5 unit tests

## UI Components (A4)

### AvailabilityPanel
- `src/components/oil/orders/AvailabilityPanel.tsx`
- Read-only: Putten (Dag 0) + Nijkerk (Dag +1) tables
- Color coding: green (>50%), yellow (<25%), red (oversubscribed)
- Oversubscribed products show negative deficit

### AutoDistributeModal
- `src/components/oil/orders/AutoDistributeModal.tsx`
- Input bird count → Bereken → preview with editable quantities
- Merge vs Replace choice (explicit, never silent overwrite)

### FullAvailabilityButton
- `src/components/oil/orders/FullAvailabilityButton.tsx`
- Captures remaining stock as order line suggestions
- Shows oversubscribe warnings when applicable

### OrderLineEditor (enhanced)
- Inline editing: click kg value → input field
- Enter = save, Escape = cancel, Tab = save + next line
- Delete with confirmation dialog: "Orderregel verwijderen? (X kg product Y)"
- `updateOrderLine` server action added to `orders.ts`

### Page Wiring
- `page.tsx`: `getCascadedAvailabilityForSlaughter()` added to Promise.all
- `SlaughterOrdersClient.tsx`: split-view layout (orders left, availability right)
- Responsive: stack on mobile (< 1024px via lg:grid-cols-3)

## Stub Removal
- `availability: never[] = []` → replaced with typed `OrderSchemaAvailability[]`
- No longer a Wave 2 stub

## Functional Checklist
- [x] `/oil/orders/[slaughterId]` shows AvailabilityPanel with Putten + Nijkerk data
- [x] `availability: never[] = []` is GONE from orders.ts
- [x] Adding order line → `router.refresh()` re-renders availability
- [x] "Verdeel X kippen" → preview with correct kg distribution
- [x] "Volledige beschikbaarheid" → captures remaining stock
- [x] Inline edit kg → Enter saves, Escape cancels, Tab saves + next
- [x] Delete confirmation dialog with product name and kg
- [x] Oversubscribed product → red indicator visible
- [x] `computeCascadedAvailability` in cascading.ts → NOT modified

## New Files
```
src/lib/actions/availability.ts
src/lib/actions/__tests__/availability.test.ts
src/lib/engine/orders/captureFullAvailability.ts
src/lib/engine/orders/distributeByBirds.ts
src/lib/engine/orders/__tests__/captureFullAvailability.test.ts
src/lib/engine/orders/__tests__/distributeByBirds.test.ts
src/components/oil/orders/AvailabilityPanel.tsx
src/components/oil/orders/AutoDistributeModal.tsx
src/components/oil/orders/FullAvailabilityButton.tsx
docs/qa-report-wave7.md
```

## Modified Files
```
src/lib/actions/orders.ts                    (ADD updateOrderLine, REMOVE never[] stub)
src/lib/schemas/orders.ts                    (ADD updateOrderLineSchema)
src/lib/engine/orders/index.ts               (ADD barrel exports)
src/app/oil/orders/[slaughterId]/page.tsx    (ADD availability fetch + prop)
src/app/oil/orders/[slaughterId]/SlaughterOrdersClient.tsx (ADD split-view + availability)
src/components/oil/orders/OrderLineEditor.tsx (ADD inline editing + delete confirmation)
SYSTEM_STATE.md                              (UPDATE Wave 7 status)
```

## Decision: **GO**
