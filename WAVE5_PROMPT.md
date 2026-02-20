# WAVE 5 — FINALE QA (A7-S3 + A7-S4)

## CONTEXT
Je werkt in `oil-dashboard/`. Dit is de **laatste wave** van Phase 1 van het OIL Order Module project.
Waves 1-4 zijn succesvol afgerond. Er draaien 600 tests, build is clean, 28 routes.
Plan: `../OIL_ORDER_MODULE_PLAN_v3.md` (§3 A7-S3, A7-S4; §2.5 protected files; §4.9 data contracts).

## HARD CONSTRAINTS
- **Protected files mogen NIET worden gewijzigd** (zie lijst hieronder)
- Alle exports/imports in tests moeten werken met bestaande pure functions (geen DB calls in tests)
- Tests zijn puur: geen Supabase, geen fetch, geen env vars
- Gebruik `vitest` (al geconfigureerd), `describe/it/expect` globals
- Gebruik bestaande test-utils uit `src/lib/test-utils/factories.ts`
- UI placeholder fixes zijn WEL toegestaan (zie SPRINTLET A7-S2b hieronder)

## PROTECTED FILES — VERIFY ZERO MODIFICATIONS
```
src/lib/engine/svaso.ts
src/lib/engine/svaso.test.ts
src/lib/engine/cherry-picker.ts
src/lib/engine/cherry-picker.test.ts
src/lib/engine/tht.ts
src/lib/engine/tht.test.ts
src/lib/engine/mass-balance.ts
src/lib/engine/mass-balance.test.ts
src/lib/engine/sankey.ts
src/lib/engine/true-up.ts
src/lib/actions/batches.ts
src/lib/actions/scenarios.ts
src/components/oil/MassBalanceSankey.tsx
supabase/migrations/20260101* through 20260212*  (alle pre-Wave-1 migrations)
```

## PRE-FLIGHT CHECK (run first)
```bash
npm run build          # must pass, 0 errors
npm test -- --run      # must pass, note exact count
git status             # working tree status
```

---

## SPRINTLET A7-S2b: Placeholder Cleanup — Vergeten Wave 3/4 UI fixes

### Probleem
Sommige UI componenten tonen nog "wordt toegevoegd in Wave X" placeholder tekst terwijl de onderliggende functionaliteit al WEL is gebouwd. Dit moet worden opgeruimd vóór Phase 1 release.

### Fix 1: Beschikbaarheid placeholder verwijderen in SlaughterDetail.tsx

**File:** `src/components/oil/planning/SlaughterDetail.tsx` (regels 168-178)

De `AvailabilityTable` component bestaat al en toont theoretische beschikbaarheid correct. Maar `SlaughterDetail.tsx` bevat ook een hardcoded placeholder blok:
```tsx
{/* Beschikbaarheid placeholder */}
<div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 ...">
  <p>Beschikbaarheidsberekening wordt toegevoegd in Wave 3</p>
</div>
```
**Actie:** Verwijder dit hele blok (regels 168-178). De echte AvailabilityTable wordt al gerenderd op de planning detail page (`src/app/oil/planning/[slaughterId]/page.tsx`).

### Fix 2: EstimateVsActual placeholder update

**File:** `src/components/oil/planning/EstimateVsActual.tsx`

Dit component toont "Schatting vs. werkelijk — Wordt toegevoegd in een volgende fase". Dit is bewust Fase 2 functionaliteit, maar de tekst moet duidelijker:
**Actie:** Verander de tekst naar: "Schatting vs. werkelijk — Beschikbaar in Fase 2 (werkelijke batch yields koppeling)"

### Fix 3: Zoek naar ALLE overgebleven placeholders

**Actie:** Doorzoek de hele `src/` directory op:
- `wordt toegevoegd`
- `coming soon`
- `Wave 3` / `Wave 2` / `Wave 4` in user-facing tekst (NIET in code comments)
- `border-dashed` containers met placeholder tekst

Rapporteer elk gevonden resultaat in het QA rapport. Fix alle placeholders die verwijzen naar reeds-geïmplementeerde features.

---

## SPRINTLET A7-S3: Integration Test — Snapshot → Verwerkingsopdrachten

### Output file
`src/lib/engine/__tests__/integration-snapshot-processing.test.ts`

### Dependencies (import these)
```typescript
import { buildOrderSchema } from '@/lib/engine/orders/buildOrderSchema';
import { computeSurplusDeficit } from '@/lib/engine/orders/computeSurplusDeficit';
import { generateInstructionData } from '@/lib/engine/processing/generateInstructions';
import { exportOrderSchemaToExcel } from '@/lib/export/orderSchemaExport';
import { validateForStorteboom } from '@/lib/export/storteboomValidator';
```

### Test scenarios (minimum 8 tests)

**describe('E2E: Snapshot → Processing Instructions')**

1. **Happy path** — Valid snapshot met 3 producten + 1 recept → instruction bevat correct `quantity_kg`, `expected_output_kg = quantity_kg * yield_pct / 100`, complete `steps[]`
2. **Zero quantity** — Product in surplus_deficit met `ordered_kg = 0` → instruction `quantity_kg = 0`, `expected_output_kg = 0`
3. **Product not in snapshot** — Recept referenceert product_id dat niet in surplus_deficit zit → graceful handling (0 of error)
4. **Complex recipe (5+ steps)** — Recept met 5 stappen elk met `parameters` object → alle stappen + parameters exact bewaard in output
5. **Multiple recipes same slaughter** — 3 recepten voor zelfde slachtdag → 3 onafhankelijke instructions, geen cross-contamination
6. **Yield percentage edge cases** — yield 100%, yield 0%, yield null → correcte output berekening

**describe('E2E: Snapshot → Excel Export')**

7. **Full chain** — buildOrderSchema → computeSurplusDeficit → exportOrderSchemaToExcel → parse xlsx → verify sheet names + row count + data accuracy
8. **Validation before export** — validateForStorteboom returns `valid: true` for correct data, `valid: false` + errors for corrupt data

### Data fixtures
Bouw realistische testdata gebaseerd op echte Oranjehoen producten:
- Kipfilet (product_id: 'breast_fillet', ~€8.50/kg)
- Dijfilet (product_id: 'thigh_fillet', ~€4.20/kg)
- Drumsticks (product_id: 'drumsticks', ~€2.80/kg)
- Kippenvleugels (product_id: 'wings', ~€1.90/kg)
- Kipgehakt (product_id: 'minced', ~€3.50/kg)

---

## SPRINTLET A7-S4: Performance & Regressie

### Stap 1: Protected Files Check
```bash
# Verify ZERO modifications to protected files since Wave 1
# Compare against first wave commit
git diff d58e42a -- src/lib/engine/svaso.ts src/lib/engine/cherry-picker.ts src/lib/engine/tht.ts src/lib/engine/mass-balance.ts src/lib/engine/sankey.ts src/lib/engine/true-up.ts src/lib/actions/batches.ts src/lib/actions/scenarios.ts
```
Resultaat moet LEEG zijn. Als er diff output is → **NO-GO**.

### Stap 2: Full Test Suite
```bash
npm test -- --run 2>&1
```
- Alle tests moeten PASS (0 failures)
- Noteer exact aantal tests

### Stap 3: Build Gate
```bash
npm run build 2>&1
```
- 0 errors
- Noteer aantal routes

### Stap 4: Test Coverage Overzicht

Categoriseer alle tests:

| Categorie | Pattern | Verwacht |
|-----------|---------|----------|
| Engine core (svaso, tht, mass-balance, etc.) | `engine/*.test.ts` | 100+ tests |
| Cherry-picker | `cherry-picker.test.ts` | 10+ tests |
| Scenario sandbox | `scenario-sandbox.test.ts` | 10+ tests |
| Process chain | `__tests__/process-chain.test.ts` | 10+ tests |
| Availability-Orders integration | `availability-orders-integration.test.ts` | 5+ tests |
| Order schema | `buildOrderSchema.test.ts` | 10+ tests |
| Processing instructions | `generateInstructions.test.ts` | 10+ tests |
| Excel export | `orderSchemaExport.test.ts` | 7+ tests |
| Storteboom validator | `storteboomValidator.test.ts` | 10+ tests |
| Test utils/factories | `factories.test.ts` | 15+ tests |
| **NEW: Snapshot→Processing E2E** | `integration-snapshot-processing.test.ts` | 8+ tests |
| **TOTAAL** | | **600+** |

### Stap 5: QA Rapport schrijven

**Output file:** `docs/qa-report-wave5.md`

Format:
```markdown
# OIL Order Module — Wave 5 QA Report
**Date:** [datum]
**Agent:** Claude Code QA
**Build:** [commit hash]

## 1. Test Summary
| Category | Tests | Status |
|----------|-------|--------|
| ... | ... | ✅/❌ |
| **TOTAL** | **N** | **✅ ALL PASS** |

## 2. Protected Files Verification
| File | Modified? | Status |
|------|-----------|--------|
| svaso.ts | No | ✅ |
| ... | ... | ... |

## 3. Migration Integrity
- Pre-Wave-1 migrations (001-119): ✅ Unchanged
- Wave 1-4 migrations (120-125): ✅ Present and applied

## 4. Build & Performance
- `npm run build`: ✅ [N] routes, 0 errors
- `npm test`: ✅ [N] tests in [X]s
- Build time: [X]s

## 5. Known Issues
[List any non-blocking issues found]

## 6. Go/No-Go Decision
**DECISION: GO / NO-GO**
**Rationale:** [explain]

Phase 1 Order Module is production-ready / not ready because...
```

---

## GATE CRITERIA (alle moeten PASS)
- [ ] Alle bestaande tests PASS (0 fail, 0 skip)
- [ ] Nieuwe A7-S3 integration tests PASS (8+ tests)
- [ ] Protected files ZERO modifications
- [ ] `npm run build` — 0 errors
- [ ] Alle "wordt toegevoegd in Wave X" placeholders opgeruimd (A7-S2b)
- [ ] QA rapport geschreven met Go/No-Go
- [ ] Git commit met tag `v0.5-wave5`

## OUTPUT VERWACHT
1. `src/components/oil/planning/SlaughterDetail.tsx` (GEWIJZIGD — placeholder verwijderd)
2. `src/components/oil/planning/EstimateVsActual.tsx` (GEWIJZIGD — tekst update)
3. `src/lib/engine/__tests__/integration-snapshot-processing.test.ts` (NIEUW)
4. `docs/qa-report-wave5.md` (NIEUW — inclusief placeholder audit)
5. Git commit + tag
6. Samenvatting: test count, gate status, placeholder fixes, Go/No-Go
