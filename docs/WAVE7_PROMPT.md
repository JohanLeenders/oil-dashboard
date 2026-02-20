# WAVE 7 — ORDER INTELLIGENCE & LIVE AVAILABILITY

You are Claude Code CLI running in **AGENT TEAMS** mode. Act as ORCHESTRATOR + Team Lead.

## EXECUTION MODE: AGENT TEAMS (mandatory)

- Use `TeamCreate` tool to create team `"oil-w7"`
- Spawn agents as `Task` with `team_name="oil-w7"`
- Agents communicate via `SendMessage`
- Do NOT execute sprintlets sequentially in a single thread
- Do NOT use `Task` without `team_name`

**Repository (Windows):** `C:\Users\leend\A leenders\Oranjehoen - Documenten\Dashboard\oil-dashboard`

---

## CONTEXT

Wave 6 delivered:
- `locations` table (Putten + Nijkerk)
- `location_yield_profiles` (yield stored as 0.0–1.0 scale)
- `product_yield_chains` (cascade chains)
- `computeCascadedAvailability()` in `src/lib/engine/availability/cascading.ts` (pure engine, 23 tests)
- ImportSlaughterDays restored
- **644 tests passing**, tagged `v0.6-wave6`, master clean

**Wave 7 goal:** Turn the cascade engine into live order intelligence.

No schema changes. No migration changes. No RLS changes.

Read the full Phase 2 plan: `docs/FASE2_UI_IMPROVEMENT_PLAN.md`

---

## HARD CONSTRAINTS

- Yield percentages are stored and used as **0.0–1.0** (never 0–100). UI displays × 100 with `%` suffix.
- No protected files may be modified (**all 8**):
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
- Do NOT modify `src/lib/engine/availability/cascading.ts` — use it as-is
- Do NOT modify `src/lib/engine/availability.ts` — old JA757 engine stays
- Everything stays theoretical (no actual yield override yet)
- All numbers in kg
- Dutch UI labels ("Beschikbaarheid", "Besteld", "Resterend")
- Tests must pass (vitest), build must pass, lint must pass

---

## PRE-FLIGHT (MANDATORY)

Run before ANY code changes:

```bash
npm run build
npm test -- --run
git diff HEAD -- src/lib/engine/svaso.ts src/lib/engine/cherry-picker.ts src/lib/engine/tht.ts src/lib/engine/mass-balance.ts src/lib/engine/sankey.ts src/lib/engine/true-up.ts src/lib/actions/batches.ts src/lib/actions/scenarios.ts
git status
```

**Stop if not clean. Baseline: 644 tests, 0 failures, 0 protected file diffs.**

---

## ARCHITECTURE DECISIONS (FINAL)

1. **N+1 queries are acceptable.** Max ~10 customers per slaughter. Simplicity > premature optimization.

2. **"Verdeel X kippen" distributes ONLY Putten parent products.** It does NOT auto-create Nijkerk child lines. Nijkerk availability is calculated from remaining forwarded volume.

3. **Oversubscribe is visible.** We NEVER silently clamp without exposing the deficit. Use `oversubscribed_kg` from the cascade engine.

4. **Live refresh uses `router.refresh()`.** We avoid custom client-side server-action fetch loops.

5. **`captureFullAvailability` definition:** `remaining_primary = primary_available_kg - sold_primary_kg` (NOT `forwarded_kg`).

---

## TEAM STRUCTURE

| Agent | Role |
|-------|------|
| ENGINE_AGENT | Pure functions (distribute, capture), availability aggregator, tests |
| UI_AGENT | Components (AvailabilityPanel, modals, inline editing), page wiring |
| QA_AGENT | Regression gate, protected files, build, QA report |

---

## SPRINTLET A1 — Availability Aggregator

**OWNER:** ENGINE_AGENT

Create: `src/lib/actions/availability.ts`

```typescript
export async function getCascadedAvailabilityForSlaughter(
  slaughterId: string
): Promise<CascadedAvailability>
```

Steps:
1. Fetch slaughter row (birds, avg weight)
2. Compute `grillerKg = expected_birds × avg_weight_kg × 0.704`
3. Fetch Putten location id from `locations` table
4. Fetch yield profiles for Putten from `location_yield_profiles`
5. Fetch yield chains from `product_yield_chains`
6. Fetch all orders for this slaughter
7. For each order: fetch order lines, accumulate into `existing_orders_primary[]`
8. Call `computeCascadedAvailability()` from cascading.ts — DO NOT change its logic

**Important:** This is a server action that wires DB data to the pure engine. The engine itself stays pure.

**5 unit tests:**
- no orders → full availability
- one order reduces availability
- oversubscribe parent → `oversubscribed_kg > 0`
- oversubscribe child → clamped correctly
- multiple customers aggregate correctly

---

## SPRINTLET A2 — Capture Full Availability

**OWNER:** ENGINE_AGENT

Create: `src/lib/engine/orders/captureFullAvailability.ts`

Pure function — no DB access.

Captures all remaining availability as order line suggestions.

**Definition:**
```
remaining_primary = primary_available_kg - sold_primary_kg
```
(NOT `forwarded_kg` — that is a cascade calculation, not a remaining stock calculation)

Return:
```typescript
{ product_id: string; product_description: string; quantity_kg: number }[]
```

- Primary products: include if `primary_available_kg - sold_primary_kg > 0`
- Secondary products: include if `net_available_kg > 0`
- All quantities rounded to 2 decimal places

**5 tests:**
- nothing sold → all products returned
- everything sold → empty result
- oversubscribed → excluded (remaining = 0)
- secondary products included
- rounding correct

---

## SPRINTLET A3 — Distribute by Birds

**OWNER:** ENGINE_AGENT

Create: `src/lib/engine/orders/distributeByBirds.ts`

Pure function — no DB access.

```typescript
distributeByBirds({
  bird_count: number,
  avg_weight_kg: number,
  griller_yield_pct: number,    // 0.0-1.0
  yield_profiles: LocationYieldProfile[]
}): DistributionPreview
```

Logic:
```
griller_kg = bird_count × avg_weight_kg × griller_yield_pct
per profile: kg = griller_kg × yield_percentage
```

Returns order line suggestions for **Putten only**. Does NOT create Nijkerk child lines.

**5 tests:**
- 1000 birds → correct kg distribution
- zero birds → zero/empty lines
- fractional birds → handled correctly
- custom yield profiles
- rounding consistency (2 decimal places)

---

## SPRINTLET A4 — Live Availability UI

**OWNER:** UI_AGENT

### 4a. AvailabilityPanel component

Create: `src/components/oil/orders/AvailabilityPanel.tsx`

Read-only component, no state. Props: `{ availability: CascadedAvailability }`.

Display two tables:

**PUTTEN (Dag 0):**

| Product | Beschikbaar | Besteld | Resterend |
|---------|-------------|---------|-----------|
| Borstkappen | 438 kg | 150 kg | 288 kg |

**NIJKERK (Dag +1):**

| Product | Cascade kg | Besteld | Resterend |
|---------|-----------|---------|-----------|
| Filet met haas | 121 kg | 0 kg | 121 kg |

Color coding:
- Green: remaining > 50% of available
- Yellow: remaining < 25% of available
- Red: `oversubscribed_kg > 0` (show deficit)

### 4b. Wire into orders page

Modify `src/app/oil/orders/[slaughterId]/page.tsx`:
- Add `getCascadedAvailabilityForSlaughter(slaughterId)` to `Promise.all`
- Pass `availability` prop to `SlaughterOrdersClient`

Modify `src/app/oil/orders/[slaughterId]/SlaughterOrdersClient.tsx`:
- Split-view layout: orders left, availability right
- Responsive: stack on mobile (< 1024px)

### 4c. Live refresh

After order mutations (add/remove line): call `router.refresh()` to re-render server component with fresh availability.

**Remove** the `availability: never[] = []` stub from `src/lib/actions/orders.ts`.

### 4d. Smart allocation buttons

Create `src/components/oil/orders/AutoDistributeModal.tsx`:
- Input: number of birds
- Click "Bereken" → calls `distributeByBirds()` client-side
- Preview table with editable quantities
- "Toevoegen als orderregels" → server action
- Merge vs Replace: ask explicitly, never silent overwrite

Create `src/components/oil/orders/FullAvailabilityButton.tsx`:
- Click → calls `captureFullAvailability()` client-side
- Preview modal with remaining products
- "Toevoegen" → server action
- Show oversubscribe warnings if applicable

### 4e. Inline editing

Modify `src/components/oil/orders/OrderLineEditor.tsx`:
- Click on kg value → inline `<input type="number">`
- Enter = save (`updateOrderLine` server action), Escape = cancel, Tab = save + next
- Add `updateOrderLine(lineId, quantityKg)` server action to `orders.ts`
- Delete with confirmation dialog: "Orderregel verwijderen? (X kg product Y)"

---

## SPRINTLET A5 — QA & Regression

**OWNER:** QA_AGENT

### 1. Protected files check

```bash
git diff v0.6-wave6...HEAD -- src/lib/engine/svaso.ts src/lib/engine/cherry-picker.ts src/lib/engine/tht.ts src/lib/engine/mass-balance.ts src/lib/engine/sankey.ts src/lib/engine/true-up.ts src/lib/actions/batches.ts src/lib/actions/scenarios.ts
```

Expected: empty.

### 2. Test + Build

```bash
npm test -- --run
npm run build
```

- Zero failures
- Build clean (zero errors)
- Test count should be **644 + ~20 new = 664+**

### 3. Functional verification

- `/oil/orders/[slaughterId]` shows AvailabilityPanel with Putten + Nijkerk data
- `availability: never[] = []` is GONE from orders.ts
- Adding order line → availability updates
- "Verdeel X kippen" for 1000 birds → preview with correct kg
- "Volledige beschikbaarheid" → captures remaining stock
- Inline edit kg → Enter saves, Escape cancels
- Oversubscribed product → red indicator visible
- `computeCascadedAvailability` in cascading.ts → NOT modified

### 4. QA Report

Write `docs/qa-report-wave7.md`:
- Test counts (base + new)
- Protected files status
- Build status
- Functional checklist
- Decision: GO / NO-GO

### 5. Update SYSTEM_STATE.md

Update `SYSTEM_STATE.md` with Wave 7 status, new test count, new components.

---

## GATE CRITERIA

All must pass before tagging:

```
□ Build clean
□ All tests pass (664+)
□ 8 protected files unchanged
□ availability: never[] = [] removed
□ AvailabilityPanel shows Putten + Nijkerk
□ Oversubscribe visible in UI (red indicator)
□ distributeByBirds works for 1000 birds
□ captureFullAvailability uses (available - sold), not forwarded
□ Inline editing: Enter/Escape/Tab
□ QA report written
□ SYSTEM_STATE.md updated
```

---

## FINAL STEPS

```bash
git add -A
git commit -m "feat: Wave 7 — Order Intelligence & Live Availability"
git tag v0.7-wave7
```

Note new test count in commit message body.

---

## END CONDITION

Orders page now:
- Reflects live Putten + Nijkerk availability
- Shows deficits clearly (red, oversubscribed_kg)
- Supports bird-based distribution (Putten only)
- Supports "geef volledige beschikbaarheid" capture
- Inline kg editing with keyboard controls
- Remains mass-balance correct
- No schema changes
- No regression

**Start with Pre-flight. Then spawn agents. Execute in parallel.**
